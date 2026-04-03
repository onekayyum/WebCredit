# Caffeine/Motoko Backend Reverse Engineering (Commit 1 of 2)

This document captures the full backend contract discovered from the existing codebase so we can rebuild the server in a standard runtime without breaking the frontend.

## 1) Project structure

- Frontend: `src/frontend` (Vite + React + React Query).
- Existing backend logic: `src/backend/main.mo` (Motoko actor).
- Generated bindings used by frontend: `src/frontend/src/backend.ts` and `src/frontend/src/declarations/backend.did.d.ts`.

## 2) Frontend -> backend API surface (must remain identical)

The frontend uses this exact backend interface:

- `addBatchTransaction(customerId, totalAmount, itemsJson, note)`
- `addCustomer(name, mobile)`
- `addProduct(name, price, barcode)`
- `addTransaction(customerId, productName, note, amount, txType)`
- `bulkImportProducts(productList)`
- `deleteCustomer(id)`
- `deleteProduct(id)`
- `deleteTransaction(id)`
- `getAllCustomers()`
- `getAllProducts()`
- `getCustomerBalanceSummary(customerId)`
- `getCustomersSortedByBalance()`
- `getHighBalanceCustomers(threshold)`
- `getInactiveCustomers(days)`
- `getTransactionsForCustomer(customerId)`
- `searchCustomers(term)`
- `searchProducts(term)`
- `updateCustomer(id, name, mobile)`
- `updateProduct(id, name, price, barcode)`

## 3) Data models and behavior extracted from Motoko

### Customer
- Fields: `id`, `name`, `mobile`, `createdAt`.
- Constraints:
  - `mobile` cannot be empty.
  - `mobile` must be unique across customers.

### Product
- Fields: `id`, `name`, `price`, `barcode`, `createdAt`.
- Constraints:
  - `barcode` must be unique in `addProduct` and `bulkImportProducts`.
  - `updateProduct` does **not** validate barcode uniqueness in original code.

### Transaction
- Fields: `id`, `customerId`, `productName`, `note`, `amount`, `txType`, `timestamp`, optional `itemsJson`.
- Rules:
  - Transaction add only succeeds for existing customer.
  - `addBatchTransaction` creates:
    - `productName = "Batch"`
    - `txType = "udhaar"`
    - `itemsJson = provided JSON string`

### Balance logic
Per customer:
- `totalUdhaar`: sum of transaction amounts where `txType == "udhaar"`.
- `totalPaid`: sum of transaction amounts where `txType == "payment"`.
- `remainingBalance = totalUdhaar - totalPaid`.
- `lastPaymentDate`: latest timestamp among payment transactions, default `0`.

`getInactiveCustomers(days)` semantics preserved:
- If never paid (`lastPaymentDate = 0`), treated as `days + 1` days inactive.
- Otherwise compare elapsed days from nanosecond timestamps.

## 4) Authentication and storage observations

- Existing app includes Internet Identity plumbing in frontend hook, but backend methods are callable anonymously and business logic has no auth checks.
- Existing storage for business data is in-memory Motoko maps (volatile).
- Commit 1 replacement uses SQLite so data persists across restarts.

## 5) Commit 1 implementation scope

Implemented a new standard backend runtime:

- `backend-node/src/repository.js`
  - Full business logic reimplementation.
  - SQLite persistence.
  - Method names and behavior aligned with Motoko actor.
- `backend-node/src/server.js`
  - HTTP endpoints exposed as `POST /api/<methodName>`.
  - Each endpoint returns `{ ok, result }` envelope with BigInt-safe serialization.
- `backend-node/package.json`
  - Runnable scripts and dependencies.

## 6) Commit 2 planned scope

- Swap frontend actor creation from Caffeine/ICP client to a local API-backed client **without changing component API usage**.
- Remove/neutralize remaining Caffeine/Motoko runtime dependencies from app run path.
- Update root README with complete Ubuntu install/run/deploy commands from zero.
