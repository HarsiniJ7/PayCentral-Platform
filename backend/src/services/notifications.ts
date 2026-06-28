import { db } from "../db";
import { v4 as uuid } from "uuid";

/**
 * Email / SMS / Push are mocked per the assessment brief - in a real
 * deployment these would call SendGrid / Twilio / Azure Notification Hubs
 * (or similar) from a background worker, not inline on the request thread.
 */
export type NotificationType =
  | "CardCreated"
  | "CardBlocked"
  | "CardUnblocked"
  | "FundsLoaded"
  | "PurchaseCompleted"
  | "RefundProcessed"
  | "LowBalance"
  | "FraudAlert";

const CHANNEL_BY_TYPE: Record<NotificationType, "Email" | "SMS" | "Push"> = {
  CardCreated: "Email",
  CardBlocked: "SMS",
  CardUnblocked: "SMS",
  FundsLoaded: "Push",
  PurchaseCompleted: "Push",
  RefundProcessed: "Email",
  LowBalance: "Push",
  FraudAlert: "SMS",
};

export function sendNotification(userId: string, type: NotificationType, message: string) {
  const channel = CHANNEL_BY_TYPE[type];
  db.prepare(
    "INSERT INTO Notifications (id, userId, channel, type, message, read, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)"
  ).run(uuid(), userId, channel, type, message, new Date().toISOString());

  // Mocked dispatch - in place of a real provider call we just log it.
  // eslint-disable-next-line no-console
  console.log(`[mock-${channel.toLowerCase()}] -> user:${userId} | ${type}: ${message}`);
}

export const LOW_BALANCE_THRESHOLD = 200;
