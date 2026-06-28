// Hand-written OpenAPI 3.0 spec, kept in sync with docs/api-flow.md by hand.
// I considered swagger-jsdoc (generating this from route comments) but for a PoC this size,
// one source-of-truth file was faster to keep accurate than annotating 9 route files - see
// docs/AI-USAGE.md for the actual reasoning behind that call.

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PayCentral Corporate Expense Card API",
    version: "1.0.0",
    description:
      "API for the PayCentral Corporate Expense Card platform PoC. Two roles: Administrator " +
      "and Cardholder. Every route except /auth/login and /health requires a Bearer JWT.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Card: {
        type: "object",
        properties: {
          id: { type: "string" },
          maskedNumber: { type: "string", example: "•••• •••• •••• 4218" },
          cardholderName: { type: "string" },
          status: { type: "string", enum: ["Active", "Blocked", "Suspended", "Closed"] },
          balance: { type: "number" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string" },
          referenceNumber: { type: "string" },
          cardNumber: { type: "string" },
          merchantName: { type: "string" },
          type: { type: "string", enum: ["Purchase", "Reversal", "Fee", "BalanceEnquiry", "Refund"] },
          amount: { type: "number" },
          availableBalance: { type: "number" },
          status: { type: "string", enum: ["Completed", "Declined", "Pending", "Reversed"] },
          date: { type: "string", format: "date-time" },
        },
      },
      FraudAlert: {
        type: "object",
        properties: {
          id: { type: "string" },
          cardholderName: { type: "string" },
          alertType: { type: "string" },
          reason: { type: "string" },
          severity: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
          resolved: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        security: [],
        responses: { "200": { description: "Service is up" } },
      },
    },
    "/auth/login": {
      post: {
        summary: "Sign in",
        tags: ["Auth"],
        security: [],
        description: "Rate-limited to 10 attempts/minute/IP. Returns a short-lived (15m) access token, a long-lived (7d) refresh token, and the user profile.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated" },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Too many attempts" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Exchange a refresh token for a new access token",
        tags: ["Auth"],
        security: [],
        description: "Rate-limited to 10 attempts/minute/IP. The refresh token is rotated on every use - the old one is revoked immediately, so it cannot be replayed.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "New access + refresh token pair issued" },
          "400": { description: "Missing refreshToken" },
          "401": { description: "Refresh token invalid, expired, or already used", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Too many attempts" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Revoke a refresh token",
        tags: ["Auth"],
        security: [],
        description: "Revokes the given refresh token so it can no longer be exchanged. The access token is stateless and simply expires on its own.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: { "204": { description: "Revoked (idempotent - also returns 204 if the token was already invalid)" } },
      },
    },
    "/cards": {
      get: {
        summary: "List cards",
        tags: ["Cards"],
        description: "Admins see all cards (with search/filter/pagination). Cardholders see only their own.",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated card list" } },
      },
      post: {
        summary: "Issue a new card",
        tags: ["Cards"],
        description: "Administrator only.",
        responses: { "201": { description: "Card created" }, "403": { description: "Not an administrator" } },
      },
    },
    "/cards/{id}": {
      get: {
        summary: "Card detail",
        tags: ["Cards"],
        description: "Includes status history. Cardholders may only fetch their own card.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Card detail", content: { "application/json": { schema: { $ref: "#/components/schemas/Card" } } } },
          "404": { description: "Not found" },
        },
      },
    },
    "/cards/{id}/status": {
      patch: {
        summary: "Change card status",
        tags: ["Cards"],
        description:
          "Administrator only. Transition is validated server-side against an explicit state " +
          "machine (e.g. Closed cannot go back to Active).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } } } } },
        },
        responses: { "200": { description: "Status updated" }, "400": { description: "Invalid transition" } },
      },
    },
    "/wallet/{cardId}/balance": {
      get: {
        summary: "Balance enquiry",
        tags: ["Wallet"],
        description: "Itself recorded as a BalanceEnquiry transaction.",
        parameters: [{ name: "cardId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Current balance" } },
      },
    },
    "/wallet/{cardId}/load": {
      post: {
        summary: "Load funds",
        tags: ["Wallet"],
        description: "Administrator only. Supports an idempotencyKey to safely ignore duplicate submits.",
        parameters: [{ name: "cardId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { amount: { type: "number" }, idempotencyKey: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "Funds loaded" } },
      },
    },
    "/wallet/{cardId}/debit": {
      post: {
        summary: "Debit funds (purchase)",
        tags: ["Wallet"],
        description:
          "Runs the fraud engine after a successful debit. Declines with a clear error on " +
          "insufficient balance or an inactive card status.",
        parameters: [{ name: "cardId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { amount: { type: "number" }, merchantId: { type: "string" } } },
            },
          },
        },
        responses: {
          "201": { description: "Transaction completed" },
          "400": { description: "Insufficient funds" },
          "403": { description: "Card is not active" },
        },
      },
    },
    "/wallet/{cardId}/refund": {
      post: {
        summary: "Refund a prior transaction",
        tags: ["Wallet"],
        description: "Administrator only.",
        parameters: [{ name: "cardId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Refund processed" } },
      },
    },
    "/transactions": {
      get: {
        summary: "Search transactions",
        tags: ["Transactions"],
        description: "Filter by card number, reference, merchant, status and date range. Paginated.",
        parameters: [
          { name: "cardNumber", in: "query", schema: { type: "string" } },
          { name: "reference", in: "query", schema: { type: "string" } },
          { name: "merchant", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        ],
        responses: { "200": { description: "Paginated transaction list" } },
      },
    },
    "/fraud-alerts": {
      get: {
        summary: "List fraud alerts",
        tags: ["Fraud"],
        description: "Administrator only. Filterable by severity and resolved state.",
        parameters: [
          { name: "severity", in: "query", schema: { type: "string" } },
          { name: "resolved", in: "query", schema: { type: "boolean" } },
        ],
        responses: { "200": { description: "List of alerts" } },
      },
    },
    "/fraud-alerts/{id}/resolve": {
      patch: {
        summary: "Resolve a fraud alert",
        tags: ["Fraud"],
        description: "Administrator only.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Alert resolved" } },
      },
    },
    "/reports/transactions": {
      get: {
        summary: "Transaction report",
        tags: ["Reports"],
        parameters: [{ name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } }],
        responses: { "200": { description: "CSV or JSON export" } },
      },
    },
    "/reports/fraud": {
      get: {
        summary: "Fraud report",
        tags: ["Reports"],
        parameters: [{ name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } }],
        responses: { "200": { description: "CSV or JSON export" } },
      },
    },
    "/reports/cards": {
      get: {
        summary: "Card report",
        tags: ["Reports"],
        parameters: [{ name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } }],
        responses: { "200": { description: "CSV or JSON export" } },
      },
    },
    "/reports/daily-summary": {
      get: {
        summary: "Daily summary report",
        tags: ["Reports"],
        description: "Spend, loads and declines grouped by day.",
        parameters: [{ name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } }],
        responses: { "200": { description: "CSV or JSON export" } },
      },
    },
    "/notifications": {
      get: {
        summary: "List my notifications",
        tags: ["Notifications"],
        description: "Latest 50 notifications for the logged-in user.",
        responses: { "200": { description: "Notification list" } },
      },
    },
    "/notifications/{id}/read": {
      patch: {
        summary: "Mark notification as read",
        tags: ["Notifications"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Marked as read" } },
      },
    },
    "/audit-logs": {
      get: {
        summary: "Audit trail",
        tags: ["Audit"],
        description: "Administrator only. Paginated log of sensitive actions.",
        parameters: [{ name: "page", in: "query", schema: { type: "integer", default: 1 } }],
        responses: { "200": { description: "Paginated audit log" } },
      },
    },
    "/users/cardholders": {
      get: {
        summary: "Lookup cardholders",
        tags: ["Users"],
        description: "Administrator only. Backs the \"issue card\" picker.",
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Cardholder list" } },
      },
    },
  },
};
