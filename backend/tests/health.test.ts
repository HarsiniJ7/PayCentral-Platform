import path from "path";
import os from "os";
import fs from "fs";

process.env.DB_PATH = path.join(os.tmpdir(), `pc-test-health-${Date.now()}-${Math.random()}.db`);

import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

afterAll(() => {
  fs.rmSync(process.env.DB_PATH as string, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-wal`, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-shm`, { force: true });
});

describe("health checks", () => {
  it("GET /api/health/live returns 200 without checking dependencies", async () => {
    const res = await request(app).get("/api/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/health/ready reports a healthy database connection", async () => {
    const res = await request(app).get("/api/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks.database.status).toBe("ok");
    expect(res.body.checks.cache.backend).toBe("memory");
  });

  it("GET /api/health is an alias for /ready", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.checks).toBeDefined();
  });
});
