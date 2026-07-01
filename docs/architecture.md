# Architecture

## Why this shape

This was built for the **Frontend & UX Focus** track. Most of the engineering depth in this
submission is in the React client: component structure, state, routing, accessibility and the
admin/cardholder UX. The backend exists to give that frontend something real to talk to — it is a small, honest Express + SQLite API, not a disguised attempt at the full .NET/Clean Architecture stack described for the backend track. I'd rather submit a working, well-reasoned Node API than a half-finished .NET solution I didn't have time to get right. See `docs/AI-USAGE.md` and the root README "Assumptions" section for the full reasoning.

If I were doing the backend-focused track instead, this would be a .NET 8 Web API with Clean
Architecture (Domain / Application / Infrastructure / API layers), MediatR for CQRS, EF Core
against SQL Server, and FluentValidation at the API boundary.

## High-level component diagram

![Solution architecture](diagrams/solution-architecture.svg)

<details>
<summary>Mermaid source (renders natively on GitHub)</summary>

```mermaid
flowchart LR
    subgraph Client["Browser"]
        A[React + TypeScript SPA]
    end

    subgraph API["Express API (Node/TS)"]
        B[Auth routes]
        C[Card routes]
        D[Wallet routes]
        E[Transaction routes]
        F[Fraud engine]
        G[Report routes]
        H[Notification service - mocked]
        I[Audit logger]
    end

    subgraph Data["SQLite (better-sqlite3)"]
        J[(Users / Roles)]
        K[(Cards / Wallets)]
        L[(Transactions / Merchant)]
        M[(FraudAlerts)]
        N[(AuditLogs)]
        O[(Notifications)]
    end

    A -- "JWT bearer token" --> B
    A --> C
    A --> D
    A --> E
    A --> G

    D --> F
    F --> M
    D --> H
    C --> H
    H --> O

    B --> J
    C --> K
    D --> K
    D --> L
    E --> L
    G --> L
    G --> M
    G --> K
    C --> I
    D --> I
    I --> N
```

</details>

## Backend layering

![Backend layering](diagrams/backend-layering.svg)

## Request flow: a card purchase

![Purchase request flow](diagrams/api-purchase-flow.svg)

<details>
<summary>Mermaid sequence diagram source (renders natively on GitHub)</summary>

```mermaid
sequenceDiagram
    participant U as Cardholder app (mocked POS call)
    participant API as Express API
    participant DB as SQLite
    participant Fraud as Fraud engine
    participant Notif as Notification service (mocked)

    U->>API: POST /wallet/:cardId/debit { amount, merchantId }
    API->>DB: Look up card + wallet
    alt card not Active
        API->>DB: Insert Declined transaction
        API->>Fraud: Record Critical "TransactionOnInactiveCard" alert
        API-->>U: 403 Card is Blocked
    else sufficient balance
        API->>DB: Update wallet balance
        API->>DB: Insert Completed transaction
        API->>Fraud: runFraudChecks(cardId, amount, merchantCountry)
        Fraud->>DB: Read recent transactions for velocity/value rules
        Fraud-->>API: list of triggered rules
        API->>DB: Insert FraudAlerts for each triggered rule
        API->>Notif: sendNotification(PurchaseCompleted)
        opt low balance after debit
            API->>Notif: sendNotification(LowBalance)
        end
        API-->>U: 201 { newBalance, fraudAlertsTriggered }
    else insufficient balance
        API->>DB: Insert Declined transaction
        API-->>U: 400 Insufficient funds
    end
```

</details>

*Colour key for both diagrams: gray is a neutral/structural step, teal is the API processing
layer (and the success path on the second diagram), amber is the data/storage layer (and
notifications), coral marks the two decline outcomes.*

## Frontend structure

```
frontend/src/
  api/client.ts        - thin fetch wrapper, attaches JWT, handles 401 redirect
  context/AuthContext   - login/logout/session restore
  components/           - AppShell (sidebar nav), Badge, Pagination, EmptyState, etc.
  pages/admin/           - 6 screens: overview, cards, card detail, transactions, fraud, reports, audit
  pages/cardholder/      - 3 screens: home, transactions, notifications
```

Routing is role-gated client-side (`ProtectedRoute`) and the API independently enforces role checks server-side - the frontend gate is a UX nicety, not the security boundary.

## Scaling notes (for the second-round discussion)

At higher scale the obvious next moves: move the fraud rule checks off the request path into a queue/worker (Azure Service Bus or similar) so a purchase isn't blocked on rule evaluation; replace SQLite with a managed Postgres/SQL Server instance with read replicas for reporting queries; add Redis for session/rate-limit state once this runs across more than one API instance; and put the SPA behind a CDN with the API behind a load balancer.
