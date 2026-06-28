import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/cardholders", requireAuth, requireRole("Administrator"), (req, res) => {
  const { search } = req.query as Record<string, string>;
  let query = `SELECT Users.id, Users.fullName, Users.email FROM Users
    JOIN Roles ON Users.roleId = Roles.id WHERE Roles.name = 'Cardholder'`;
  const params: any[] = [];
  if (search) {
    query += " AND (Users.fullName LIKE ? OR Users.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  const rows = db.prepare(query).all(...params);
  res.json({ data: rows });
});

export default router;
