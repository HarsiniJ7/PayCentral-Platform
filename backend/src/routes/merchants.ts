import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/merchants - lightweight list for dropdowns / simulation tools
router.get("/", requireAuth, (_req, res) => {
  const rows = db
    .prepare(`SELECT id, name, category, country FROM Merchant ORDER BY name ASC`)
    .all();
  res.json({ data: rows });
});

export default router;
