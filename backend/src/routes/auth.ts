import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { db, logAudit } from "../db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-do-not-use-in-prod";

// Short-lived access token (carries identity + role, sent on every request)
// vs. long-lived refresh token (opaque, single-purpose, stored hashed).
// This split limits the damage window if an access token leaks (e.g. via XSS)
// while still letting the user stay signed in without re-entering a password.
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

function signAccessToken(user: { id: string; email: string; roleName: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.roleName, jti: uuid() },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions
  );
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Refresh tokens are opaque random strings, never JWTs - there's nothing to
// "decode", so the only way to use one is to present it back to /auth/refresh,
// where it's looked up by its hash. Stolen DB rows alone can't be replayed.
function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO RefreshTokens (id, userId, tokenHash, createdAt, expiresAt, revokedAt) VALUES (?, ?, ?, ?, ?, NULL)"
  ).run(uuid(), userId, hashToken(token), new Date().toISOString(), expiresAt);
  return token;
}

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db
    .prepare(
      `SELECT Users.*, Roles.name as roleName FROM Users
       JOIN Roles ON Users.roleId = Roles.id
       WHERE email = ?`
    )
    .get(email) as any;

  // Deliberately vague error message to avoid leaking which part was wrong (OWASP A07).
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);

  logAudit(user.id, "LOGIN", "User", user.id);

  res.json({
    token: accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.roleName },
  });
});

// Exchanges a still-valid refresh token for a new access token. The refresh
// token itself is rotated (old one revoked, new one issued) on every use -
// if a revoked token is ever presented again, that's a signal of token theft.
router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken is required." });
  }

  const tokenHash = hashToken(refreshToken);
  const record = db
    .prepare("SELECT * FROM RefreshTokens WHERE tokenHash = ?")
    .get(tokenHash) as any;

  if (!record || record.revokedAt || new Date(record.expiresAt) < new Date()) {
    return res.status(401).json({ error: "Invalid or expired refresh token. Please log in again." });
  }

  const user = db
    .prepare(
      `SELECT Users.*, Roles.name as roleName FROM Users
       JOIN Roles ON Users.roleId = Roles.id
       WHERE Users.id = ?`
    )
    .get(record.userId) as any;

  if (!user) {
    return res.status(401).json({ error: "Invalid or expired refresh token. Please log in again." });
  }

  // Rotate: revoke the presented token, issue a fresh pair.
  db.prepare("UPDATE RefreshTokens SET revokedAt = ? WHERE id = ?").run(new Date().toISOString(), record.id);
  const newAccessToken = signAccessToken(user);
  const newRefreshToken = issueRefreshToken(user.id);

  res.json({
    token: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.roleName },
  });
});

// Revokes the refresh token so it can't be used again even if it leaks later.
// The access token itself is stateless and simply expires on its own (15m).
router.post("/logout", (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    db.prepare("UPDATE RefreshTokens SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL").run(
      new Date().toISOString(),
      hashToken(refreshToken)
    );
  }
  res.status(204).send();
});

export default router;
