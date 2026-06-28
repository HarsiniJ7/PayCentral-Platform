import { Router } from "express";
import { db } from "../db";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/transactions - search/filter/paginate
router.get("/", requireAuth, (req: AuthedRequest, res) => {
  const {
    cardNumber,
    reference,
    merchant,
    status,
    dateFrom,
    dateTo,
    page = "1",
    pageSize = "10",
  } = req.query as Record<string, string>;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 10));

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (req.user!.role === "Cardholder") {
    where += " AND c.cardholderId = ?";
    params.push(req.user!.id);
  }
  if (cardNumber) {
    where += " AND c.cardNumber LIKE ?";
    params.push(`%${cardNumber}%`);
  }
  if (reference) {
    where += " AND t.referenceNumber LIKE ?";
    params.push(`%${reference}%`);
  }
  if (merchant) {
    where += " AND m.name LIKE ?";
    params.push(`%${merchant}%`);
  }
  if (status) {
    where += " AND t.status = ?";
    params.push(status);
  }
  if (dateFrom) {
    where += " AND t.date >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    where += " AND t.date <= ?";
    params.push(dateTo);
  }

  const baseQuery = `FROM Transactions t
    JOIN Cards c ON t.cardId = c.id
    LEFT JOIN Merchant m ON t.merchantId = m.id
    ${where}`;

  const total = (db.prepare(`SELECT COUNT(*) as c ${baseQuery}`).get(...params) as { c: number }).c;

  const rows = db
    .prepare(
      `SELECT t.id, t.referenceNumber, t.type, t.amount, t.availableBalanceAfter, t.status, t.date,
              c.cardNumber, c.maskedNumber, m.name as merchantName
       ${baseQuery}
       ORDER BY t.date DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, ps, (p - 1) * ps);

  res.json({ data: rows, page: p, pageSize: ps, total });
});

export default router;
