# Database / ER Diagram

SQLite via `better-sqlite3` for the PoC (zero setup, file-based, easy to inspect). The schema is written so it maps cleanly onto SQL Server + EF Core migrations if/when this moves to the full.NET stack - see `backend/src/db/index.ts` for the actual `CREATE TABLE` statements.

```mermaid
erDiagram
    ROLES ||--o{ USERS : has
    USERS ||--o{ CARDS : owns
    CARDS ||--|| WALLETS : has
    CARDS ||--o{ TRANSACTIONS : records
    CARDS ||--o{ FRAUDALERTS : triggers
    CARDS ||--o{ CARDSTATUSHISTORY : tracks
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDITLOGS : performs
    MERCHANT ||--o{ TRANSACTIONS : involved_in

    ROLES {
        string id PK
        string name
    }
    USERS {
        string id PK
        string email
        string passwordHash
        string fullName
        string roleId FK
        string createdAt
    }
    CARDS {
        string id PK
        string cardNumber
        string maskedNumber
        string cardholderId FK
        string status
        string issuedAt
        string expiresAt
    }
    WALLETS {
        string id PK
        string cardId FK
        real balance
        string currency
        string updatedAt
    }
    MERCHANT {
        string id PK
        string name
        string category
        string country
    }
    TRANSACTIONS {
        string id PK
        string referenceNumber
        string cardId FK
        string merchantId FK
        string type
        real amount
        real availableBalanceAfter
        string status
        string date
        string idempotencyKey
    }
    FRAUDALERTS {
        string id PK
        string cardId FK
        string alertType
        string reason
        string severity
        string createdAt
        int resolved
    }
    NOTIFICATIONS {
        string id PK
        string userId FK
        string channel
        string type
        string message
        int read
        string createdAt
    }
    AUDITLOGS {
        string id PK
        string actorId FK
        string action
        string entityType
        string entityId
        string details
        string createdAt
    }
    CARDSTATUSHISTORY {
        string id PK
        string cardId FK
        string fromStatus
        string toStatus
        string changedBy FK
        string changedAt
        string reason
    }
```

## Design notes / things I'd reconsider with more time

- `cardNumber` is stored in clear text for this PoC so search-by-card-number works without a
  tokenisation service. In a real build this would be encrypted at rest (or tokenised via a PCI vault) with only the masked number queryable directly - flagged in the README "Assumptions".
- IDs are UUID strings rather than auto-increment ints, mainly to avoid leaking row counts/order through the API and to make merging/seeding data simpler.
- `idempotencyKey` on `Transactions` is how duplicate purchase/load requests are caught (see
  Functional Requirements -> Validation -> "Prevent duplicate requests").
