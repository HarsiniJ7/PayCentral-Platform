import path from "path";
import os from "os";
import fs from "fs";

process.env.DB_PATH = path.join(os.tmpdir(), `pc-test-fraud-${Date.now()}-${Math.random()}.db`);

import { db } from "../src/db";
import { runFraudChecks, recordFraudAlerts } from "../src/services/fraudEngine";
import { v4 as uuid } from "uuid";

afterAll(() => {
  fs.rmSync(process.env.DB_PATH as string, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-wal`, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-shm`, { force: true });
});

function makeCard() {
  const cardholder = db.prepare("SELECT id FROM Users WHERE roleId = (SELECT id FROM Roles WHERE name = 'Cardholder')").get() as { id: string };
  const cardId = uuid();
  db.prepare(
    "INSERT INTO Cards (id, cardNumber, maskedNumber, cardholderId, status, issuedAt, expiresAt) VALUES (?, ?, ?, ?, 'Active', ?, ?)"
  ).run(cardId, `TESTCARD${Date.now()}`, "**** **** **** TEST", cardholder.id, new Date().toISOString(), new Date().toISOString());
  return cardId;
}

describe("fraud rule engine", () => {
  it("flags a transaction that pushes the 10-minute window over R20,000", () => {
    const cardId = makeCard();
    const results = runFraudChecks(cardId, 25_000, "ZA");
    expect(results.some((r) => r.alertType === "HighValueVelocity")).toBe(true);
  });

  it("does not flag a small, isolated domestic transaction", () => {
    const cardId = makeCard();
    const results = runFraudChecks(cardId, 50, "ZA");
    expect(results).toHaveLength(0);
  });

  it("flags an international transaction", () => {
    const cardId = makeCard();
    const results = runFraudChecks(cardId, 50, "US");
    expect(results.some((r) => r.alertType === "InternationalTransaction")).toBe(true);
  });

  it("persists only triggered alerts via recordFraudAlerts", () => {
    const cardId = makeCard();
    const before = (db.prepare("SELECT COUNT(*) as c FROM FraudAlerts WHERE cardId = ?").get(cardId) as any).c;
    recordFraudAlerts(cardId, [
      { triggered: true, alertType: "InternationalTransaction", reason: "test", severity: "Low" },
      { triggered: false },
    ]);
    const after = (db.prepare("SELECT COUNT(*) as c FROM FraudAlerts WHERE cardId = ?").get(cardId) as any).c;
    expect(after - before).toBe(1);
  });
});
