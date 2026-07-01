import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import "./db"; // initialises + seeds the SQLite DB on first boot
import { openApiSpec } from "./openapi";
import { requestLogger } from "./lib/logger";
import healthRoutes from "./lib/health";

import authRoutes from "./routes/auth";
import cardRoutes from "./routes/cards";
import walletRoutes from "./routes/wallet";
import transactionRoutes from "./routes/transactions";
import fraudRoutes from "./routes/fraud";
import merchantRoutes from "./routes/merchants";
import reportRoutes from "./routes/reports";
import notificationRoutes from "./routes/notifications";
import auditRoutes from "./routes/audit";
import userRoutes from "./routes/users";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" })); // also guards against oversized payload attacks
  app.use(requestLogger);

  // Separate counters per route - refresh (silent token renewal, happens
  // routinely every ~15min per active session) must not share a budget with
  // login (a genuine brute-force target). Sharing one counter meant a normal
  // refresh flow could lock a user out of logging back in, and vice versa.
  function createAuthRateLimiter(maxAttempts: number) {
    const attempts = new Map<string, { count: number; resetAt: number }>();
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const key = req.ip || "unknown";
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || now > entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + 60_000 });
        return next();
      }
      if (entry.count >= maxAttempts) {
        return res.status(429).json({ error: "Too many attempts. Please try again in a minute." });
      }
      entry.count += 1;
      next();
    };
  }
  app.use("/api/auth/login", createAuthRateLimiter(10));
  app.use("/api/auth/refresh", createAuthRateLimiter(30));

  // /api/health/live, /api/health/ready, and /api/health (alias of ready)
  app.use("/api/health", healthRoutes);

  // Swagger UI - satisfies the brief's "API Documentation (Swagger)" deliverable.
  // Spec lives in src/openapi.ts and is kept in sync with docs/api-flow.md by hand (see that
  // file's header comment for why I didn't generate it from route JSDoc for a PoC this size).
  app.get("/api/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: "PayCentral API Docs" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/cards", cardRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/fraud-alerts", fraudRoutes);
  app.use("/api/merchants", merchantRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/users", userRoutes);

  // Centralised error handler - avoids leaking stack traces to clients (OWASP A09).
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on our end. Please try again." });
  });

  return app;
}
