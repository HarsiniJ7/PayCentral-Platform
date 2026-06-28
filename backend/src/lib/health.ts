/**
 * Health checks.
 *
 * Two endpoints, matching the standard Kubernetes/Azure App Service pattern:
 *  - /api/health/live  -> "is the process up at all" (no dependency checks,
 *                          used by an orchestrator to decide whether to restart
 *                          the container)
 *  - /api/health/ready -> "can this instance actually serve traffic" (checks
 *                          the DB is reachable; reports cache backend status
 *                          without failing readiness, since the app degrades
 *                          gracefully without Redis)
 * /api/health is kept as an alias of /ready for backwards compatibility with
 * anything already polling the original flat endpoint.
 */
import { Router } from "express";
import { db } from "../db";
import { cache } from "./cache";

const router = Router();
const startedAt = Date.now();

function checkDatabase(): { status: "ok" | "error"; latencyMs?: number; error?: string } {
  const start = Date.now();
  try {
    db.prepare("SELECT 1").get();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

router.get("/live", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
});

router.get(["/ready", "/"], (_req, res) => {
  const database = checkDatabase();
  const cacheStatus = { status: "ok" as const, backend: cache.isUsingRedis() ? "redis" : "memory" };

  const healthy = database.status === "ok";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    checks: {
      database,
      cache: cacheStatus,
    },
  });
});

export default router;
