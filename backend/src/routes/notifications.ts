import { Router } from "express";
import { db } from "../db";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare("SELECT * FROM Notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50")
    .all(req.user!.id);
  res.json({ data: rows });
});

router.patch("/:id/read", requireAuth, (req: AuthedRequest, res) => {
  db.prepare("UPDATE Notifications SET read = 1 WHERE id = ? AND userId = ?").run(req.params.id, req.user!.id);
  res.json({ id: req.params.id, read: true });
});

export default router;
