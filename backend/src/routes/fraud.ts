import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/fraud-alerts - admin dashboard feed
router.get("/", requireAuth, requireRole("Administrator"), (req, res) => {
  const { severity, resolved } = req.query as Record<string, string>;
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (severity) {
    where += " AND f.severity = ?";
    params.push(severity);
  }
  if (resolved !== undefined) {
    where += " AND f.resolved = ?";
    params.push(resolved === "true" ? 1 : 0);
  }

  const rows = db
    .prepare(
      `SELECT f.id, f.alertType, f.reason, f.severity, f.createdAt, f.resolved,
              c.maskedNumber, u.fullName as cardholderName
       FROM FraudAlerts f
       JOIN Cards c ON f.cardId = c.id
       JOIN Users u ON c.cardholderId = u.id
       ${where}
       ORDER BY f.createdAt DESC`
    )
    .all(...params);

  res.json({ data: rows });
});

router.patch("/:id/resolve", requireAuth, requireRole("Administrator"), (req, res) => {
  db.prepare("UPDATE FraudAlerts SET resolved = 1 WHERE id = ?").run(req.params.id);
  res.json({ id: req.params.id, resolved: true });
});

export default router;
