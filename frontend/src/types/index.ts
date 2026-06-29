export type Role = "Administrator" | "Cardholder";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export type CardStatus = "Active" | "Blocked" | "Suspended" | "Closed" | "PendingActivation";

export interface CardSummary {
  id: string;
  cardNumber: string;
  maskedNumber: string;
  status: CardStatus;
  issuedAt: string;
  expiresAt: string;
  cardholderName: string;
  cardholderEmail: string;
  balance: number;
  currency: string;
}

export interface CardStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  reason: string | null;
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  type: "Purchase" | "Reversal" | "Fee" | "BalanceEnquiry" | "Refund" | "Load" | "Credit" | "Debit";
  amount: number;
  availableBalanceAfter: number;
  status: "Completed" | "Declined" | "Pending" | "Reversed";
  date: string;
  cardNumber: string;
  maskedNumber: string;
  merchantName: string | null;
}

export type FraudSeverity = "Low" | "Medium" | "High" | "Critical";

export interface FraudAlert {
  id: string;
  alertType: string;
  reason: string;
  severity: FraudSeverity;
  createdAt: string;
  resolved: number;
  maskedNumber: string;
  cardholderName: string;
}

export interface NotificationItem {
  id: string;
  channel: "Email" | "SMS" | "Push";
  type: string;
  message: string;
  read: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface Merchant {
  id: string;
  name: string;
  category: string;
  country: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
