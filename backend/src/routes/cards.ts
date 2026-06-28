import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db, logAudit } from "../db";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";
import { sendNotification } from "../services/notifications";
import { emitToAdmins, emitToCard } from "../lib/realtime";

const router = Router();

function maskCard(num: string) {
  return `**** **** **** ${num.slice(-4)}`;
}

// GET /api/cards - search + paginate (admin) or "my card" (cardholder)
router.get("/", requireAuth, (req: AuthedRequest, res) => {
  const { search, status, page = "1", pageSize = "10" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (req.user!.role === "Cardholder") {
    where += " AND c.cardholderId = ?";
    params.push(req.user!.id);
  }

  if (search) {
    where += " AND (c.cardNumber LIKE ? OR u.fullName LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND c.status = ?";
    params.push(status);
  }

  const total = (db
    .prepare(`SELECT COUNT(*) as c FROM Cards c JOIN Users u ON c.cardholderId = u.id ${where}`)
    .get(...params) as { c: number }).c;

  const rows = db
    .prepare(
      `SELECT c.id, c.cardNumber, c.maskedNumber, c.status, c.issuedAt, c.expiresAt,
              u.fullName as cardholderName, u.email as cardholderEmail,
              w.balance, w.currency
       FROM Cards c
       JOIN Users u ON c.cardholderId = u.id
       JOIN Wallets w ON w.cardId = c.id
       ${where}
       ORDER BY c.issuedAt DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, ps, (p - 1) * ps);

  res.json({ data: rows, page: p, pageSize: ps, total });
});

// GET /api/cards/:id
router.get("/:id", requireAuth, (req: AuthedRequest, res) => {
  const card = db
    .prepare(
      `SELECT c.*, u.fullName as cardholderName, u.email as cardholderEmail, w.balance, w.currency
       FROM Cards c JOIN Users u ON c.cardholderId = u.id JOIN Wallets w ON w.cardId = c.id
       WHERE c.id = ?`
    )
    .get(req.params.id) as any;

  if (!card) return res.status(404).json({ error: "Card not found." });
  if (req.user!.role === "Cardholder" && card.cardholderId !== req.user!.id) {
    return res.status(403).json({ error: "You can only view your own card." });
  }

  const history = db
    .prepare("SELECT * FROM CardStatusHistory WHERE cardId = ? ORDER BY changedAt DESC")
    .all(req.params.id);

  res.json({ ...card, history });
});

// POST /api/cards - issue a new card (admin only)
router.post("/", requireAuth, requireRole("Administrator"), (req: AuthedRequest, res) => {
  const { cardholderId, initialBalance = 0 } = req.body || {};
  if (!cardholderId) return res.status(400).json({ error: "cardholderId is required." });

  const user = db.prepare("SELECT * FROM Users WHERE id = ?").get(cardholderId) as any;
  if (!user) return res.status(404).json({ error: "Cardholder not found." });

  const cardId = uuid();
  const cardNumber = `4${Math.floor(100000000000000 + Math.random() * 899999999999999)}`.slice(0, 16);

  db.prepare(
    "INSERT INTO Cards (id, cardNumber, maskedNumber, cardholderId, status, issuedAt, expiresAt) VALUES (?, ?, ?, ?, 'Active', ?, ?)"
  ).run(
    cardId,
    cardNumber,
    maskCard(cardNumber),
    cardholderId,
    new Date().toISOString(),
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3).toISOString()
  );
  db.prepare("INSERT INTO Wallets (id, cardId, balance, currency, updatedAt) VALUES (?, ?, ?, 'ZAR', ?)").run(
    uuid(),
    cardId,
    initialBalance,
    new Date().toISOString()
  );
  db.prepare(
    "INSERT INTO CardStatusHistory (id, cardId, fromStatus, toStatus, changedBy, changedAt, reason) VALUES (?, ?, NULL, 'Active', ?, ?, 'Card issued')"
  ).run(uuid(), cardId, req.user!.id, new Date().toISOString());

  logAudit(req.user!.id, "ISSUE_CARD", "Card", cardId, `Issued to ${user.fullName}`);
  sendNotification(cardholderId, "CardCreated", "Your new PayCentral expense card is ready to use.");
  emitToAdmins("card:issued", { cardId, cardholderId, cardholderName: user.fullName, maskedNumber: maskCard(cardNumber) });

  res.status(201).json({ id: cardId, cardNumber, maskedNumber: maskCard(cardNumber) });
});

// PATCH /api/cards/:id/status - activate/block/unblock/suspend/close
const VALID_TRANSITIONS: Record<string, string[]> = {
  PendingActivation: ["Active"],
  Active: ["Blocked", "Suspended", "Closed"],
  Blocked: ["Active", "Closed"],
  Suspended: ["Active", "Closed"],
  Closed: [],
};

router.patch("/:id/status", requireAuth, requireRole("Administrator"), (req: AuthedRequest, res) => {
  const { status, reason } = req.body || {};
  const card = db.prepare("SELECT * FROM Cards WHERE id = ?").get(req.params.id) as any;
  if (!card) return res.status(404).json({ error: "Card not found." });

  const allowed = VALID_TRANSITIONS[card.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition card from ${card.status} to ${status}.`,
      allowedTransitions: allowed,
    });
  }

  db.prepare("UPDATE Cards SET status = ? WHERE id = ?").run(status, req.params.id);
  db.prepare(
    "INSERT INTO CardStatusHistory (id, cardId, fromStatus, toStatus, changedBy, changedAt, reason) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), req.params.id, card.status, status, req.user!.id, new Date().toISOString(), reason || null);

  logAudit(req.user!.id, `CARD_STATUS_${status.toUpperCase()}`, "Card", req.params.id, reason);

  if (status === "Blocked") {
    sendNotification(card.cardholderId, "CardBlocked", "Your PayCentral card has been blocked.");
  } else if (status === "Active" && card.status === "Blocked") {
    sendNotification(card.cardholderId, "CardUnblocked", "Your PayCentral card has been unblocked.");
  }

  emitToCard(req.params.id, "card:status-changed", { cardId: req.params.id, status });
  emitToAdmins("card:status-changed", { cardId: req.params.id, status, previousStatus: card.status });

  res.json({ id: req.params.id, status });
});

export default router;
