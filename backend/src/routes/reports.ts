import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { cache } from "../lib/cache";

const router = Router();

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    const s = val === null || val === undefined ? "" : String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function respond(req: any, res: any, rows: any[], filename: string) {
  const format = (req.query.format as string) || "json";
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json({ data: rows });
}

// GET /api/reports/transactions
router.get("/transactions", requireAuth, requireRole("Administrator"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.referenceNumber, c.cardNumber, m.name as merchant, t.type, t.amount, t.status, t.date
       FROM Transactions t
       JOIN Cards c ON t.cardId = c.id
       LEFT JOIN Merchant m ON t.merchantId = m.id
       ORDER BY t.date DESC`
    )
    .all();
  respond(req, res, rows, "transaction-report");
});

// GET /api/reports/fraud
router.get("/fraud", requireAuth, requireRole("Administrator"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT f.alertType, f.reason, f.severity, f.createdAt, f.resolved, c.cardNumber, u.fullName as cardholder
       FROM FraudAlerts f
       JOIN Cards c ON f.cardId = c.id
       JOIN Users u ON c.cardholderId = u.id
       ORDER BY f.createdAt DESC`
    )
    .all();
  respond(req, res, rows, "fraud-report");
});

// GET /api/reports/cards
router.get("/cards", requireAuth, requireRole("Administrator"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.cardNumber, c.status, c.issuedAt, c.expiresAt, u.fullName as cardholder, w.balance
       FROM Cards c JOIN Users u ON c.cardholderId = u.id JOIN Wallets w ON w.cardId = c.id
       ORDER BY c.issuedAt DESC`
    )
    .all();
  respond(req, res, rows, "card-report");
});

// GET /api/reports/daily-summary
// Cached for 30s - this query aggregates the whole Transactions table and is
// the one a dashboard would poll most often. Cache is invalidated on every
// wallet mutation (load/debit/refund) so it never serves stale-by-more-than-
// one-write data; the 30s TTL is just a backstop. Format isn't part of the
// cache key for "json" (the default/common case); CSV exports recompute
// fresh since they're infrequent and we'd rather not cache two payload shapes.
router.get("/daily-summary", requireAuth, requireRole("Administrator"), async (req, res) => {
  const format = (req.query.format as string) || "json";
  const cacheKey = "reports:daily-summary:json";

  if (format === "json") {
    const cached = await cache.getJSON<any[]>(cacheKey);
    if (cached) {
      return res.json({ data: cached, cached: true });
    }
  }

  const rows = db
    .prepare(
      `SELECT date(date) as day,
              COUNT(*) as transactionCount,
              SUM(CASE WHEN type = 'Purchase' THEN amount ELSE 0 END) as totalSpend,
              SUM(CASE WHEN type = 'Load' THEN amount ELSE 0 END) as totalLoaded,
              SUM(CASE WHEN status = 'Declined' THEN 1 ELSE 0 END) as declinedCount
       FROM Transactions
       GROUP BY date(date)
       ORDER BY day DESC`
    )
    .all();

  if (format === "json") {
    await cache.setJSON(cacheKey, rows, 30);
  }

  respond(req, res, rows, "daily-summary");
});

export default router;
