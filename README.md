# WebCredit

WebCredit is a full-stack credit ledger app for small businesses.

- **Backend:** Node.js + Express + SQLite
- **Frontend:** React + Vite + TypeScript
- **Auth:** JWT (username/password)
- **Data:** Local SQLite database with automatic migrations

---

## Features

- User authentication (`/auth/signup`, `/auth/login`)
- Customer management
- Product management
- CSV product export/import
- Udhaar/payment transaction tracking
- Batch transaction entry
- Dashboard analytics (high balance, inactive customers)
- User settings (language, currency, thresholds/reminders)

---

## Repository structure

```text
backend-server.js              # Legacy entry point (imports src/backend/server.js)
package.json                   # Root scripts and backend dependencies
src/backend/                   # Express backend
  db.js                        # SQLite connection and DB path
  migrations.js                # Schema migrations
  middleware/                  # auth, logger, rate limits
  routes/                      # auth/products/settings/api
src/frontend/                  # Vite React frontend
  package.json
  src/
    App.tsx
    components/
    hooks/
    restBackend.ts             # Frontend -> backend adapter
    apiConfig.ts               # API base URL resolution
```

---

## Requirements

- Node.js 20+
- npm 10+
- Linux/macOS/Windows (Ubuntu instructions below)

---

## Environment variables (backend)

Create a `.env` file in repository root for production.

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGIN=https://your-domain.com
DB_PATH=/absolute/path/to/app.db

# Optional tuning
IMPORT_BATCH_SIZE=500
MAX_IMPORT_ROWS=100000
MAX_BULK_IMPORT_ROWS=100000
BULK_IMPORT_CHUNK_SIZE=1000
BCRYPT_ROUNDS=10
```

### Important behavior

- In non-dev/test environments, backend startup **fails** if `ALLOWED_ORIGIN` is missing.
- In non-dev/test environments, backend startup **fails** if `JWT_SECRET` is left default.

---

## Local development

### 1) Install dependencies

```bash
npm install
npm run install:frontend
```

### 2) Run backend + frontend

Backend (port 3001):

```bash
npm run start:server
```

Frontend dev server (port 5173):

```bash
npm run dev:frontend
```

### 3) Build frontend for production serving

```bash
npm run build:frontend
```

After build, backend serves `src/frontend/dist` automatically.

---

## Production deployment on Ubuntu (safe method)

This approach keeps rollback easy.

### 1) Clone and install

```bash
git clone <YOUR_REPO_URL> /var/www/webcredit
cd /var/www/webcredit
npm ci
npm ci --prefix src/frontend
npm run build --prefix src/frontend
```

### 2) Create `.env`

```bash
cat > .env <<'ENV'
NODE_ENV=production
PORT=3001
JWT_SECRET=replace-with-strong-secret
ALLOWED_ORIGIN=https://your-domain.com
DB_PATH=/var/www/webcredit/shared/data/app.db
ENV
```

### 3) Start with PM2

```bash
npm install -g pm2
pm2 start npm --name webcredit -- start
pm2 save
pm2 startup
```

### 4) Health check

```bash
curl -i http://127.0.0.1:3001/health
```

---

## Upgrade with backup + rollback

### Backup current release

```bash
cd /var/www/webcredit
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

tar --exclude='node_modules' -czf backups/app-files-$TS.tgz .
[ -f .env ] && cp .env backups/.env-$TS

# SQLite backup
if [ -f shared/data/app.db ]; then
  sqlite3 shared/data/app.db ".backup 'backups/app-db-$TS.sqlite'"
fi
```

### Deploy new branch

```bash
git fetch --all --prune
git checkout WebCredit-Fixed
npm ci
npm ci --prefix src/frontend
npm run build --prefix src/frontend
pm2 restart webcredit --update-env
```

### Rollback

```bash
# restore previous git branch/commit
git checkout <PREVIOUS_BRANCH_OR_COMMIT>

# restore database backup if needed
cp backups/app-db-<TIMESTAMP>.sqlite shared/data/app.db

pm2 restart webcredit --update-env
```

---

## API surface

- `POST /auth/signup`
- `POST /auth/login`
- `GET /settings`
- `PUT /settings`
- `GET /products/export`
- `POST /products/import` (multipart form-data field name: `file`)
- `POST /api/backend/:method`
  - Customers: `addCustomer`, `updateCustomer`, `deleteCustomer`, `getAllCustomers`, `searchCustomers`
  - Products: `addProduct`, `updateProduct`, `deleteProduct`, `getAllProducts`, `searchProducts`, `bulkImportProducts`
  - Transactions: `addTransaction`, `addBatchTransaction`, `deleteTransaction`, `getTransactionsForCustomer`
  - Analytics: `getCustomerBalanceSummary`, `getCustomersSortedByBalance`, `getHighBalanceCustomers`, `getInactiveCustomers`

---

## CSV import notes

- Upload via `POST /products/import` with field name `file`.
- Required headers: `name,price,barcode`
- UTF-8 BOM headers are supported.
- Max upload size: **25MB**.
- Import summary returns: `totalRows`, `imported`, `updated`, `skipped`.

---

## Scripts

From repository root:

```bash
npm start                 # start backend through backend-server.js
npm run start:server      # start backend directly
npm run dev:frontend      # Vite dev server
npm run install:frontend
npm run build:frontend
npm run verify:frontend   # typecheck + lint + build (frontend)
```

---

## Troubleshooting

### Backend exits immediately

Check `.env`:

- `JWT_SECRET` must be set in production
- `ALLOWED_ORIGIN` must be set in production

### Frontend cannot call API

Set frontend env for mobile builds:

```env
VITE_API_URL=https://your-domain.com
```

For web build served by backend on same host, leaving it empty is valid.

### CSV import rejects file

Ensure:

- file is CSV
- headers are exactly `name,price,barcode`
- file size <= 25MB

---

## License

MIT (see `LICENSE`).
