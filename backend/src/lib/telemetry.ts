/**
 * OpenTelemetry bootstrap.
 *
 * Must be imported before any other backend module (express, better-sqlite3,
 * etc.) so the auto-instrumentations can patch `require` before those modules
 * are loaded - hence this is the very first import in src/index.ts.
 *
 * Exports traces over OTLP/HTTP. If no collector is reachable (e.g. running
 * `npm run dev` on a laptop with nothing listening on 4318), the exporter
 * fails silently in the background and the app behaves exactly as if
 * tracing were disabled - it never blocks startup or requests. Point
 * OTEL_EXPORTER_OTLP_ENDPOINT at Jaeger/Tempo/Azure Monitor/Honeycomb etc.
 * to actually see traces.
 *
 * Set OTEL_ENABLED=false to skip this entirely (e.g. in the test suite).
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

export function startTelemetry() {
  if (process.env.OTEL_ENABLED === "false") return;

  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
      : "http://localhost:4318/v1/traces",
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "paycentral-api",
      [ATTR_SERVICE_VERSION]: "1.0.0",
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Filesystem instrumentation is extremely noisy (better-sqlite3 +
        // ts-node-dev hit the FS constantly) and adds little value here.
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ level: "info", message: "otel_started", endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318" })
    );
  } catch (err) {
    console.error(JSON.stringify({ level: "warn", message: "otel_start_failed", error: String(err) }));
  }

  process.on("SIGTERM", () => {
    sdk?.shutdown().catch(() => undefined);
  });
}
