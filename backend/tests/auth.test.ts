import path from "path";
import os from "os";
import { closeDb } from "../src/db";
import fs from "fs";

process.env.DB_PATH = path.join(os.tmpdir(), `pc-test-auth-${Date.now()}-${Math.random()}.db`);

import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

afterAll(() => {
  closeDb();
  fs.rmSync(process.env.DB_PATH as string, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-wal`, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-shm`, { force: true });
});

describe("POST /api/auth/login", () => {
  it("rejects a request missing credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("rejects an unknown user with a vague error (no user enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@paycentral.test", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password.");
  });

  it("rejects the demo admin with a wrong password using the same vague error", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@paycentral.test", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password.");
  });

  it("logs the seeded demo admin in and returns a usable JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@paycentral.test", password: "Admin@12345" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe("Administrator");

    // Token should be honoured on a protected route.
    const me = await request(app)
      .get("/api/cards")
      .set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/cards");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("rejects a missing refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("rejects an unknown/garbage refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "not-a-real-token" });
    expect(res.status).toBe(401);
  });

  it("exchanges a valid refresh token for a new access token, and rotates it", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@paycentral.test", password: "Admin@12345" });
    expect(login.body.refreshToken).toEqual(expect.any(String));

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toEqual(expect.any(String));
    expect(refreshed.body.token).not.toBe(login.body.token);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    // The new access token works on a protected route.
    const me = await request(app)
      .get("/api/cards")
      .set("Authorization", `Bearer ${refreshed.body.token}`);
    expect(me.status).toBe(200);

    // The old refresh token was rotated out and can't be reused (replay protection).
    const reused = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(reused.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token so it can no longer be exchanged", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@paycentral.test", password: "Admin@12345" });

    const logout = await request(app).post("/api/auth/logout").send({ refreshToken: login.body.refreshToken });
    expect(logout.status).toBe(204);

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(401);
  });
});
