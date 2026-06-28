import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db, logAudit } from "../db";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";
import { sendNotification, LOW_BALANCE_THRESHOLD } from "../services/notifications";
import { runFraudChecks, recordFraudAlerts } from "../services/fraudEngine";
import { emitToAdmins, emitToCard } from "../lib/realtime";
import { cache } from "../lib/cache";

const router = Router();

function getCardWithWallet(cardId: string) {
  return db
    .prepare(
      `SELECT c.*, w.balance, w.id as walletId FROM Cards c JOIN Wallets w ON w.cardId = c.id WHERE c.id = ?`
    )
    .get(cardId) as any;
}

function assertOwnership(req: AuthedRequest, card: any) {
  return req.user!.role === "Administrator" || card.cardholderId === req.user!.id;
}

// GET /api/wallet/:cardId/balance
router.get("/:cardId/balance", requireAuth, (req: AuthedRequest, res) => {
  const card = getCardWithWallet(req.params.cardId);
  if (!card) return res.status(404).json({ error: "Card not found." });
  if (!assertOwnership(req, card)) return res.status(403).json({ error: "Forbidden." });

  // Balance enquiry is itself a loggable transaction per the brief.
  db.prepare(
    `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
     VALUES (?, ?, ?, NULL, 'BalanceEnquiry', 0, ?, 'Completed', ?, NULL)`
  ).run(uuid(), `ENQ-${Date.now()}`, card.id, card.balance, new Date().toISOString());

  res.json({ cardId: card.id, balance: card.balance, currency: "ZAR" });
});

// POST /api/wallet/:cardId/load - admin loads funds onto a card
router.post("/:cardId/load", requireAuth, requireRole("Administrator"), async (req: AuthedRequest, res) => {
  const { amount, idempotencyKey } = req.body || {};
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number." });
  }

  const card = getCardWithWallet(req.params.cardId);
  if (!card) return res.status(404).json({ error: "Card not found." });

  if (idempotencyKey) {
    const existing = db
      .prepare("SELECT * FROM Transactions WHERE idempotencyKey = ?")
      .get(idempotencyKey);
    if (existing) return res.status(200).json({ message: "Duplicate request ignored.", transaction: existing });
  }

  const newBalance = parseFloat((card.balance + amount).toFixed(2));
  db.prepare("UPDATE Wallets SET balance = ?, updatedAt = ? WHERE id = ?").run(
    newBalance,
    new Date().toISOString(),
    card.walletId
  );

  const txnId = uuid();
  db.prepare(
    `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
     VALUES (?, ?, ?, NULL, 'Load', ?, ?, 'Completed', ?, ?)`
  ).run(txnId, `LOAD-${Date.now()}`, card.id, amount, newBalance, new Date().toISOString(), idempotencyKey || null);

  logAudit(req.user!.id, "LOAD_FUNDS", "Card", card.id, `Loaded R${amount}`);
  sendNotification(card.cardholderId, "FundsLoaded", `R${amount.toFixed(2)} has been loaded onto your card.`);
  emitToCard(card.id, "wallet:updated", { cardId: card.id, balance: newBalance });
  emitToAdmins("transaction:new", { cardId: card.id, type: "Load", amount, status: "Completed" });
  await cache.invalidate("reports:daily-summary:*");

  res.json({ id: txnId, cardId: card.id, newBalance });
});

// POST /api/wallet/:cardId/debit - e.g. a purchase
router.post("/:cardId/debit", requireAuth, async (req: AuthedRequest, res) => {
  const { amount, merchantId, idempotencyKey, type = "Purchase" } = req.body || {};
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number." });
  }

  const card = getCardWithWallet(req.params.cardId);
  if (!card) return res.status(404).json({ error: "Card not found." });
  if (!assertOwnership(req, card)) return res.status(403).json({ error: "Forbidden." });

  if (idempotencyKey) {
    const existing = db.prepare("SELECT * FROM Transactions WHERE idempotencyKey = ?").get(idempotencyKey);
    if (existing) return res.status(200).json({ message: "Duplicate request ignored.", transaction: existing });
  }

  if (card.status !== "Active") {
    // Transaction attempted on a non-active card -> Critical fraud alert + decline
    db.prepare(
      `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Declined', ?, ?)`
    ).run(uuid(), `TXN-${Date.now()}`, card.id, merchantId || null, type, amount, card.balance, new Date().toISOString(), idempotencyKey || null);

    recordFraudAlerts(card.id, [
      {
        triggered: true,
        alertType: "TransactionOnInactiveCard",
        reason: `Transaction attempted while card status was ${card.status}`,
        severity: "Critical",
      },
    ]);
    emitToAdmins("fraud:alert", { cardId: card.id, alertType: "TransactionOnInactiveCard", severity: "Critical" });

    return res.status(403).json({ error: `Card is ${card.status}. Transaction declined.` });
  }

  if (card.balance < amount) {
    db.prepare(
      `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Declined', ?, ?)`
    ).run(uuid(), `TXN-${Date.now()}`, card.id, merchantId || null, type, amount, card.balance, new Date().toISOString(), idempotencyKey || null);
    return res.status(400).json({ error: "Insufficient funds." });
  }

  const merchant = merchantId
    ? (db.prepare("SELECT * FROM Merchant WHERE id = ?").get(merchantId) as any)
    : null;

  const newBalance = parseFloat((card.balance - amount).toFixed(2));
  db.prepare("UPDATE Wallets SET balance = ?, updatedAt = ? WHERE id = ?").run(
    newBalance,
    new Date().toISOString(),
    card.walletId
  );

  const txnId = uuid();
  db.prepare(
    `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', ?, ?)`
  ).run(txnId, `TXN-${Date.now()}`, card.id, merchantId || null, type, amount, newBalance, new Date().toISOString(), idempotencyKey || null);

  // Run fraud rules after recording the transaction so velocity checks see it.
  const fraudResults = runFraudChecks(card.id, amount, merchant?.country || "ZA");
  recordFraudAlerts(card.id, fraudResults);
  fraudResults.forEach((r) => {
    if (r.triggered) {
      sendNotification(card.cardholderId, "FraudAlert", `Unusual activity detected: ${r.reason}`);
      emitToAdmins("fraud:alert", { cardId: card.id, alertType: r.alertType, severity: r.severity, reason: r.reason });
    }
  });

  sendNotification(card.cardholderId, "PurchaseCompleted", `Purchase of R${amount.toFixed(2)} approved.`);
  if (newBalance < LOW_BALANCE_THRESHOLD) {
    sendNotification(card.cardholderId, "LowBalance", `Your card balance is low: R${newBalance.toFixed(2)}.`);
  }

  emitToCard(card.id, "wallet:updated", { cardId: card.id, balance: newBalance });
  emitToAdmins("transaction:new", { cardId: card.id, type, amount, status: "Completed" });
  await cache.invalidate("reports:daily-summary:*");

  res.status(201).json({ id: txnId, cardId: card.id, newBalance, fraudAlertsTriggered: fraudResults.length });
});

// POST /api/wallet/:cardId/refund
router.post("/:cardId/refund", requireAuth, requireRole("Administrator"), async (req: AuthedRequest, res) => {
  const { amount, originalReferenceNumber } = req.body || {};
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number." });
  }
  const card = getCardWithWallet(req.params.cardId);
  if (!card) return res.status(404).json({ error: "Card not found." });

  const newBalance = parseFloat((card.balance + amount).toFixed(2));
  db.prepare("UPDATE Wallets SET balance = ?, updatedAt = ? WHERE id = ?").run(
    newBalance,
    new Date().toISOString(),
    card.walletId
  );

  const txnId = uuid();
  db.prepare(
    `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
     VALUES (?, ?, ?, NULL, 'Refund', ?, ?, 'Completed', ?, NULL)`
  ).run(txnId, `REF-${Date.now()}`, card.id, amount, newBalance, new Date().toISOString());

  logAudit(req.user!.id, "REFUND", "Card", card.id, `Refund of R${amount} (ref: ${originalReferenceNumber || "n/a"})`);
  sendNotification(card.cardholderId, "RefundProcessed", `A refund of R${amount.toFixed(2)} has been processed.`);
  emitToCard(card.id, "wallet:updated", { cardId: card.id, balance: newBalance });
  emitToAdmins("transaction:new", { cardId: card.id, type: "Refund", amount, status: "Completed" });
  await cache.invalidate("reports:daily-summary:*");

  res.json({ id: txnId, cardId: card.id, newBalance });
});

export default router;
