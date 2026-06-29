/**
 * Background processing.
 *
 * A real platform would run this as a separate worker process/queue consumer
 * (Azure Service Bus + a dedicated worker, or Hangfire) so it scales
 * independently of the API and survives API restarts mid-job - see
 * docs/architecture.md "Future Improvements". For a single-process PoC,
 * node-cron running inside the API process demonstrates the same pattern
 * (scheduled, idempotent, side-effecting work outside the request/response
 * cycle) without the operational overhead of standing up a queue.
 *
 * Job: every minute, find Active cards below the low-balance threshold that
 * haven't already been notified in the last hour, and send a LowBalance
 * notification + push a realtime event to admins. Demonstrates: scheduled
 * execution, idempotency (the "already notified recently" guard), and
 * graceful failure (a thrown error logs and waits for the next tick instead
 * of crashing the process).
 */
import cron, { ScheduledTask } from "node-cron";
import { db } from "../db";
import { sendNotification, LOW_BALANCE_THRESHOLD } from "../services/notifications";
import { emitToAdmins } from "../lib/realtime";
import { logger } from "../lib/logger";

let task: ScheduledTask | undefined;

export function runLowBalanceSweep() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const candidates = db
    .prepare(
      `SELECT c.id as cardId, c.cardholderId, w.balance
       FROM Cards c
       JOIN Wallets w ON w.cardId = c.id
       WHERE c.status = 'Active' AND w.balance < ?
       AND NOT EXISTS (
         SELECT 1 FROM Notifications n
         WHERE n.userId = c.cardholderId
           AND n.type = 'LowBalance'
           AND n.createdAt >= ?
       )`
    )
    .all(LOW_BALANCE_THRESHOLD, cutoff) as { cardId: string; cardholderId: string; balance: number }[];

  for (const c of candidates) {
    sendNotification(c.cardholderId, "LowBalance", `Reminder: your card balance is low: R${c.balance.toFixed(2)}.`);
  }

  if (candidates.length > 0) {
    emitToAdmins("job:low-balance-sweep", { swept: candidates.length, at: new Date().toISOString() });
    logger.info("low_balance_sweep_completed", { cardsNotified: candidates.length });
  } else {
    logger.debug("low_balance_sweep_completed", { cardsNotified: 0 });
  }

  return candidates.length;
}

export function startBackgroundJobs() {
  if (process.env.BACKGROUND_JOBS_ENABLED === "false") {
    logger.info("background_jobs_disabled");
    return;
  }

  // Every minute. Cron schedule kept loose since this is a low-stakes sweep,
  // not a time-critical one.
  task = cron.schedule("* * * * *", () => {
    try {
      runLowBalanceSweep();
    } catch (err) {
      logger.error("low_balance_sweep_failed", { error: err instanceof Error ? err.message : String(err) });
    }
  });

  logger.info("background_jobs_started", { schedule: "every minute" });
}

export function stopBackgroundJobs() {
  task?.stop();
}
