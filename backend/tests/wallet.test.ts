import path from "path";
import os from "os";
import fs from "fs";

process.env.DB_PATH = path.join(os.tmpdir(), `pc-test-wallet-${Date.now()}-${Math.random()}.db`);

import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();
let adminToken: string;
let cardId: string;

beforeAll(async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@paycentral.test", password: "Admin@12345" });
  adminToken = login.body.token;

  const cards = await request(app).get("/api/cards?pageSize=1").set("Authorization", `Bearer ${adminToken}`);
  cardId = cards.body.data[0].id;
});

afterAll(() => {
  fs.rmSync(process.env.DB_PATH as string, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-wal`, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-shm`, { force: true });
});

describe("wallet business rules", () => {
  it("prevents a negative balance by declining a debit larger than the balance", async () => {
    const balanceRes = await request(app)
      .get(`/api/wallet/${cardId}/balance`)
      .set("Authorization", `Bearer ${adminToken}`);
    const balance = balanceRes.body.balance;

    const res = await request(app)
      .post(`/api/wallet/${cardId}/debit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: balance + 1_000_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient/i);
  });

  it("ignores a duplicate request sharing an idempotency key", async () => {
    const key = `test-idempotency-${Date.now()}`;
    const first = await request(app)
      .post(`/api/wallet/${cardId}/load`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 50, idempotencyKey: key });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/wallet/${cardId}/load`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 50, idempotencyKey: key });
    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/duplicate/i);
  });

  it("declines a transaction on a blocked card", async () => {
    await request(app)
      .patch(`/api/cards/${cardId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Blocked", reason: "test" });

    const res = await request(app)
      .post(`/api/wallet/${cardId}/debit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Blocked/);

    // restore for any later tests in the same run
    await request(app)
      .patch(`/api/cards/${cardId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Active", reason: "test cleanup" });
  });

  it("rejects a non-positive debit amount", async () => {
    const res = await request(app)
      .post(`/api/wallet/${cardId}/debit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -5 });
    expect(res.status).toBe(400);
  });
});
