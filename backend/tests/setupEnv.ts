process.env.OTEL_ENABLED = "false";
process.env.BACKGROUND_JOBS_ENABLED = "false";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
delete process.env.REDIS_URL; // force the in-memory cache fallback in tests
