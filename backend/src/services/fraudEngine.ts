import { db } from "../db";
import { v4 as uuid } from "uuid";

/**
 * Simple, explainable rule engine - intentionally not ML based.
 * For a real platform this would likely move to a streaming
 * architecture (e.g. Azure Service Bus + a dedicated fraud worker)
 * so it doesn't block the request path. See docs/architecture.md.
 */

export type FraudSeverity = "Low" | "Medium" | "High" | "Critical";

interface FraudCheckResult {
  triggered: boolean;
  alertType?: string;
  reason?: string;
  severity?: FraudSeverity;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const HIGH_VALUE_WINDOW_LIMIT = 20000;

export function runFraudChecks(cardId: string, amount: number, merchantCountry: string): FraudCheckResult[] {
  const results: FraudCheckResult[] = [];
  const now = Date.now();

  // Rule 1: more than R20,000 spent within 10 minutes
  const recentTxns = db
    .prepare(
      `SELECT amount, date FROM Transactions WHERE cardId = ? AND type = 'Purchase' AND date >= ?`
    )
    .all(cardId, new Date(now - TEN_MINUTES_MS).toISOString()) as { amount: number; date: string }[];
  const recentTotal = recentTxns.reduce((sum, t) => sum + t.amount, 0) + amount;
  if (recentTotal > HIGH_VALUE_WINDOW_LIMIT) {
    results.push({
      triggered: true,
      alertType: "HighValueVelocity",
      reason: `R${recentTotal.toFixed(2)} spent within a 10 minute window`,
      severity: "High",
    });
  }

  // Rule 2: more than five failed transactions (declines) recently
  const recentDeclines = db
    .prepare(
      `SELECT COUNT(*) as c FROM Transactions WHERE cardId = ? AND status = 'Declined' AND date >= ?`
    )
    .get(cardId, new Date(now - TEN_MINUTES_MS).toISOString()) as { c: number };
  if (recentDeclines.c >= 5) {
    results.push({
      triggered: true,
      alertType: "RepeatedDeclines",
      reason: `${recentDeclines.c} failed transactions in the last 10 minutes`,
      severity: "Medium",
    });
  }

  // Rule 3: international transaction
  if (merchantCountry && merchantCountry !== "ZA") {
    results.push({
      triggered: true,
      alertType: "InternationalTransaction",
      reason: `Transaction originated from merchant country ${merchantCountry}`,
      severity: "Low",
    });
  }

  // Rule 4: rapid purchases (3+ purchases within 60 seconds)
  const lastMinuteTxns = db
    .prepare(`SELECT COUNT(*) as c FROM Transactions WHERE cardId = ? AND type = 'Purchase' AND date >= ?`)
    .get(cardId, new Date(now - ONE_MINUTE_MS).toISOString()) as { c: number };
  if (lastMinuteTxns.c >= 3) {
    results.push({
      triggered: true,
      alertType: "RapidPurchases",
      reason: `${lastMinuteTxns.c + 1} purchases attempted within 60 seconds`,
      severity: "Medium",
    });
  }

  // Rule 5: multiple merchant categories within one minute
  const lastMinuteCategories = db
    .prepare(
      `SELECT DISTINCT m.category as category
       FROM Transactions t JOIN Merchant m ON t.merchantId = m.id
       WHERE t.cardId = ? AND t.date >= ?`
    )
    .all(cardId, new Date(now - ONE_MINUTE_MS).toISOString()) as { category: string }[];
  if (lastMinuteCategories.length >= 3) {
    results.push({
      triggered: true,
      alertType: "MultiCategoryBurst",
      reason: `Purchases across ${lastMinuteCategories.length} different merchant categories within a minute`,
      severity: "Medium",
    });
  }

  // Rule 6: transaction attempted while card blocked is handled at the
  // call site (wallet route) since it short-circuits before this engine runs,
  // but we still log it as a Critical alert there.

  return results;
}

export function recordFraudAlerts(cardId: string, results: FraudCheckResult[]) {
  const insert = db.prepare(
    "INSERT INTO FraudAlerts (id, cardId, alertType, reason, severity, createdAt, resolved) VALUES (?, ?, ?, ?, ?, ?, 0)"
  );
  for (const r of results) {
    if (r.triggered) {
      insert.run(uuid(), cardId, r.alertType, r.reason, r.severity, new Date().toISOString());
    }
  }
}
