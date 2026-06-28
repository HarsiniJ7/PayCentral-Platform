// Telemetry must be the very first import: OpenTelemetry's auto-instrumentation
// patches modules (http, express, etc.) as they're required, so it has to run
// before anything else pulls those modules in.
import { startTelemetry } from "./lib/telemetry";
startTelemetry();

import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import { initCache } from "./lib/cache";
import { initRealtime } from "./lib/realtime";
import { startBackgroundJobs } from "./jobs/lowBalanceSweep";
import { logger } from "./lib/logger";

const PORT = Number(process.env.PORT) || 4000;

initCache();

const app = createApp();
const server = http.createServer(app);

initRealtime(server);
startBackgroundJobs();

server.listen(PORT, () => {
  logger.info("server_started", { port: PORT });
  // eslint-disable-next-line no-console
  console.log(`PayCentral API listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});

function shutdown(signal: string) {
  logger.info("shutdown_signal_received", { signal });
  server.close(() => {
    logger.info("server_closed");
    process.exit(0);
  });
  // Force-exit if connections won't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
