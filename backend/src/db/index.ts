import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../paycentral.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Schema
// Kept intentionally close to the suggested table list in the brief. A real
// production build would split CardStatusHistory and Merchant out further
// and probably move this into EF Core migrations - see README "Assumptions".
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS Roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  fullName TEXT NOT NULL,
  roleId TEXT NOT NULL REFERENCES Roles(id),
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Cards (
  id TEXT PRIMARY KEY,
  cardNumber TEXT UNIQUE NOT NULL,
  maskedNumber TEXT NOT NULL,
  cardholderId TEXT NOT NULL REFERENCES Users(id),
  status TEXT NOT NULL DEFAULT 'Active', -- Active, Blocked, Suspended, Closed, PendingActivation
  issuedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Wallets (
  id TEXT PRIMARY KEY,
  cardId TEXT UNIQUE NOT NULL REFERENCES Cards(id),
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Merchant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA'
);

CREATE TABLE IF NOT EXISTS Transactions (
  id TEXT PRIMARY KEY,
  referenceNumber TEXT UNIQUE NOT NULL,
  cardId TEXT NOT NULL REFERENCES Cards(id),
  merchantId TEXT REFERENCES Merchant(id),
  type TEXT NOT NULL, -- Purchase, Reversal, Fee, BalanceEnquiry, Refund, Load, Credit, Debit
  amount REAL NOT NULL,
  availableBalanceAfter REAL NOT NULL,
  status TEXT NOT NULL, -- Completed, Declined, Pending, Reversed
  date TEXT NOT NULL,
  idempotencyKey TEXT
);

CREATE TABLE IF NOT EXISTS FraudAlerts (
  id TEXT PRIMARY KEY,
  cardId TEXT NOT NULL REFERENCES Cards(id),
  alertType TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL, -- Low, Medium, High, Critical
  createdAt TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES Users(id),
  channel TEXT NOT NULL, -- Email, SMS, Push (all mocked - see services/notifications.ts)
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS AuditLogs (
  id TEXT PRIMARY KEY,
  actorId TEXT REFERENCES Users(id),
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  details TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS CardStatusHistory (
  id TEXT PRIMARY KEY,
  cardId TEXT NOT NULL REFERENCES Cards(id),
  fromStatus TEXT,
  toStatus TEXT NOT NULL,
  changedBy TEXT REFERENCES Users(id),
  changedAt TEXT NOT NULL,
  reason TEXT
);

-- Refresh tokens are stored hashed (sha256), never in plaintext, so a DB leak
-- alone can't be replayed as a session - see docs/SECURITY.md.
CREATE TABLE IF NOT EXISTS RefreshTokens (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES Users(id),
  tokenHash TEXT UNIQUE NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  revokedAt TEXT
);
`);

// ---------------------------------------------------------------------------
// Seed - only runs once (checks if Roles table is empty)
// ---------------------------------------------------------------------------
const roleCount = db.prepare("SELECT COUNT(*) as c FROM Roles").get() as { c: number };

if (roleCount.c === 0) {
  const insertRole = db.prepare("INSERT INTO Roles (id, name) VALUES (?, ?)");
  const adminRoleId = uuid();
  const cardholderRoleId = uuid();
  insertRole.run(adminRoleId, "Administrator");
  insertRole.run(cardholderRoleId, "Cardholder");

  const insertUser = db.prepare(
    "INSERT INTO Users (id, email, passwordHash, fullName, roleId, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );

  // Demo credentials - documented in README, not meant for real prod use.
  const adminId = uuid();
  insertUser.run(
    adminId,
    "admin@paycentral.test",
    bcrypt.hashSync("Admin@12345", 10),
    "Harsini Jayaraman",
    adminRoleId,
    new Date().toISOString()
  );

  const cardholderNames = [
    "Pranushka P",
    "Praba J",
    "Anusiya A",
    "Mohana J",
    "Jayaraman N",
  ];

  const insertCard = db.prepare(
    "INSERT INTO Cards (id, cardNumber, maskedNumber, cardholderId, status, issuedAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertWallet = db.prepare(
    "INSERT INTO Wallets (id, cardId, balance, currency, updatedAt) VALUES (?, ?, ?, ?, ?)"
  );
  const insertMerchant = db.prepare(
    "INSERT INTO Merchant (id, name, category, country) VALUES (?, ?, ?, ?)"
  );
  const insertTxn = db.prepare(
    `INSERT INTO Transactions (id, referenceNumber, cardId, merchantId, type, amount, availableBalanceAfter, status, date, idempotencyKey)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHistory = db.prepare(
    "INSERT INTO CardStatusHistory (id, cardId, fromStatus, toStatus, changedBy, changedAt, reason) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const merchants = [
    { name: "Checkers Hyper", category: "Grocery", country: "ZA" },
    { name: "Takealot.com", category: "E-commerce", country: "ZA" },
    { name: "Uber", category: "Transport", country: "ZA" },
    { name: "Woolworths", category: "Grocery", country: "ZA" },
    { name: "Amazon.com", category: "E-commerce", country: "US" },
    { name: "Engen Garage", category: "Fuel", country: "ZA" },
  ];
  const merchantIds = merchants.map((m) => {
    const id = uuid();
    insertMerchant.run(id, m.name, m.category, m.country);
    return { id, ...m };
  });

  const cardholderUserIds: string[] = [];

  cardholderNames.forEach((name, idx) => {
    const userId = uuid();
    const email = `${name.split(" ")[0].toLowerCase()}@paycentral.test`;
    insertUser.run(
      userId,
      email,
      bcrypt.hashSync("Card@12345", 10),
      name,
      cardholderRoleId,
      new Date().toISOString()
    );
    cardholderUserIds.push(userId);

    const cardId = uuid();
    const cardNumber = `4000${(1000000000 + idx * 11111111).toString().slice(0, 12)}`;
    const masked = `**** **** **** ${cardNumber.slice(-4)}`;
    const status = idx === 3 ? "Blocked" : idx === 4 ? "Suspended" : "Active";

    insertCard.run(
      cardId,
      cardNumber,
      masked,
      userId,
      status,
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3).toISOString()
    );
    insertHistory.run(uuid(), cardId, null, status, adminId, new Date().toISOString(), "Initial issuance");

    let balance = 5000 + idx * 1500;
    insertWallet.run(uuid(), cardId, balance, "ZAR", new Date().toISOString());

    // A handful of historical transactions per card
    const txnCount = 6 + idx;
    for (let i = 0; i < txnCount; i++) {
      const merchant = merchantIds[Math.floor(Math.random() * merchantIds.length)];
      const amount = parseFloat((Math.random() * 1200 + 20).toFixed(2));
      balance = parseFloat((balance - amount).toFixed(2));
      const daysAgo = Math.floor(Math.random() * 20);
      insertTxn.run(
        uuid(),
        `TXN-${Date.now()}-${idx}-${i}`,
        cardId,
        merchant.id,
        "Purchase",
        amount,
        balance,
        "Completed",
        new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo).toISOString(),
        null
      );
    }

    db.prepare("UPDATE Wallets SET balance = ?, updatedAt = ? WHERE cardId = ?").run(
      balance,
      new Date().toISOString(),
      cardId
    );
  });

  // Seed one fraud alert for demo purposes
  const firstCard = db.prepare("SELECT id FROM Cards LIMIT 1").get() as { id: string };
  db.prepare(
    "INSERT INTO FraudAlerts (id, cardId, alertType, reason, severity, createdAt, resolved) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(
    uuid(),
    firstCard.id,
    "RapidPurchases",
    "4 purchases recorded within 90 seconds",
    "Medium",
    new Date().toISOString()
  );

  console.log("Database seeded with demo Administrator + 5 Cardholders.");
  console.log("Admin login: admin@paycentral.test / Admin@12345");
  console.log("Cardholder login (e.g.): thabo@paycentral.test / Card@12345");
}

export function logAudit(actorId: string | null, action: string, entityType: string, entityId?: string, details?: string) {
  db.prepare(
    "INSERT INTO AuditLogs (id, actorId, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), actorId, action, entityType, entityId || null, details || null, new Date().toISOString());
}
