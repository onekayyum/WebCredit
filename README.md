## WebCredit migration (commit 1/2)

This repository originally came from Caffeine/ICP (Motoko canister backend).

### What was completed in this first migration commit

- Reverse engineered the Motoko backend (`src/backend/main.mo`) into equivalent standard server behavior.
- Implemented a new standalone Node.js backend server with SQLite storage in `backend-server.js`.
- Preserved backend method names and payload/return structures used by the frontend actor interface (`addCustomer`, `getAllCustomers`, `addTransaction`, etc.).
- Rewired frontend backend binding to a REST adapter, while keeping all existing frontend call sites unchanged (`actor.<methodName>(...)` still works).

### Current architecture after commit 1

- Frontend: Vite + React (unchanged UI/component logic).
- Backend: Express endpoint dispatcher at `/api/backend/:method`.
- Storage: local SQLite database (`data/app.db`).

### Files introduced/changed

- `backend-server.js` (new independent backend server)
- `src/frontend/src/restBackend.ts` (REST adapter implementing existing `backendInterface`)
- `src/frontend/src/config.ts` (uses REST adapter)
- `package.json` (server `start` script + backend dependencies)

### Compatibility target (kept)

The following method contract names and return semantics are preserved to match frontend expectations:

- `addCustomer`, `updateCustomer`, `deleteCustomer`, `getAllCustomers`, `searchCustomers`
- `addProduct`, `updateProduct`, `deleteProduct`, `getAllProducts`, `searchProducts`, `bulkImportProducts`
- `addTransaction`, `addBatchTransaction`, `deleteTransaction`, `getTransactionsForCustomer`
- `getCustomerBalanceSummary`, `getCustomersSortedByBalance`, `getHighBalanceCustomers`, `getInactiveCustomers`

---

## Commit 2 plan

In the next commit (`commit 2`), I will complete the remaining migration work:

- remove remaining Caffeine/Motoko/ICP runtime dependency paths from the project config/tooling,
- update root run scripts for a clean `npm install` + `npm start` flow,
- replace deployment/build docs fully with Ubuntu step-by-step hosting commands,
- provide final end-to-end setup/readme with "explain like I am six" command-by-command instructions.
