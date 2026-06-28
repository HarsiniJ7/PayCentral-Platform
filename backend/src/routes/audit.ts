import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRole("Administrator"), (req, res) => {
  const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

  const total = (db.prepare("SELECT COUNT(*) as c FROM AuditLogs").get() as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT a.*, u.fullName as actorName FROM AuditLogs a
       LEFT JOIN Users u ON a.actorId = u.id
       ORDER BY a.createdAt DESC LIMIT ? OFFSET ?`
    )
    .all(ps, (p - 1) * ps);

  res.json({ data: rows, page: p, pageSize: ps, total });
});

export default router;
