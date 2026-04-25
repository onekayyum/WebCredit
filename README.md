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
- `ALLOWED_ORIGIN` supports **comma-separated origins** (recommended when serving both web + mobile), for example:
  `ALLOWED_ORIGIN=https://your-domain.com,https://localhost,http://localhost`

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

## Production deployment with webtox.one

### Overview

This guide covers deploying WebCredit to production on your VPS with the domain `webtox.one`.

The deployment branch (`deployment-ready`) includes:
- Production environment configuration
- GitHub Actions workflow for automated APK builds
- Mobile (APK) compatibility

### Prerequisites

- VPS with Ubuntu/Linux
- Node.js 20+ installed
- npm 10+
- SSL certificate for `https://webtox.one` (Let's Encrypt recommended)
- Reverse proxy (Nginx/Apache) handling SSL termination

### 1. Backend deployment on VPS

Clone the deployment-ready branch:

```bash
git clone -b deployment-ready <YOUR_REPO_URL> /var/www/webcredit
cd /var/www/webcredit
npm ci
npm ci --prefix src/frontend
npm run build:frontend
```

Create `.env` in repository root:

```bash
cat > .env <<'ENV'
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-key-min-32-chars-use-strong-random-string
ALLOWED_ORIGIN=https://webtox.one
DB_PATH=/var/www/webcredit/shared/data/app.db
ENV
chmod 600 .env
```

Start backend with PM2:

```bash
npm install -g pm2
pm2 start npm --name webcredit -- start
pm2 save
pm2 startup
```

Health check:

```bash
curl -i http://127.0.0.1:3001/health
```

### 2. Nginx reverse proxy configuration

Configure Nginx to forward traffic to your app on port 3001 with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name webtox.one;

    ssl_certificate /etc/letsencrypt/live/webtox.one/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webtox.one/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name webtox.one;
    return 301 https://$server_name$request_uri;
}
```

### 3. Frontend web access

Once deployed and Nginx is running:

```
https://webtox.one
```

The frontend is automatically served by the backend after `npm run build:frontend`.

### 4. Mobile APK builds with GitHub Actions

The `deployment-ready` branch automatically builds APKs on every push.

#### How it works

1. Push code to `deployment-ready` branch
2. GitHub Actions workflow triggers (see `.github/workflows/android.yml`)
3. Workflow:
   - Installs dependencies
   - Builds frontend with production env (`VITE_API_URL=https://webtox.one`)
   - Syncs Capacitor for Android
   - Builds APK using Gradle
   - Uploads APK as downloadable artifact

#### Download APK

1. Go to GitHub repository
2. Navigate to **Actions** tab
3. Find the latest **Build APK** workflow run
4. Download the **app-debug** artifact
5. Install on Android device: `adb install app-debug.apk`

#### Environment variables for APK

The APK automatically uses the production API URL from `src/frontend/.env.production`:

```env
VITE_API_URL=https://webtox.one
```

No additional configuration needed — the APK will connect to your backend at `https://webtox.one`.

---

## Production Upgrade & Rollback

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

### Deploy new version

```bash
cd /var/www/webcredit
git fetch --all --prune
git checkout deployment-ready
git pull origin deployment-ready
npm ci
npm ci --prefix src/frontend
npm run build:frontend
pm2 restart webcredit --update-env
```

### Rollback

```bash
# Restore to previous git state
git checkout <PREVIOUS_COMMIT_OR_BRANCH>

# Restore database if needed
cp backups/app-db-<TIMESTAMP>.sqlite shared/data/app.db

pm2 restart webcredit --update-env
```

---

## Verifying production setup

### Web access

```bash
curl -i https://webtox.one/health
# Should return: {"ok": true}
```

### APK functionality

On your Android device with the APK installed:

1. **Login:** Enter username and password
2. **API connectivity:** Open browser DevTools (if available) to verify requests to `https://webtox.one`
3. **Authentication:** Token should persist in localStorage (verified via login/logout)
4. **No errors:** Check console for "Missing bearer token" or HTML response errors

---

## Production Environment Configuration

### Backend `.env`

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<use-a-strong-random-string>
ALLOWED_ORIGIN=https://webtox.one
DB_PATH=/var/www/webcredit/shared/data/app.db

# Optional tuning
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important:**
- `JWT_SECRET` must be set and kept secret
- `ALLOWED_ORIGIN` must match your domain exactly
- For CORS to work with multiple origins (web + mobile), use comma-separated list

### Frontend `.env.production`

```env
VITE_API_URL=https://webtox.one
```

This is automatically used by the build pipeline for:
- Web builds
- Mobile APK builds (Capacitor)

---



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

Notes:
- Always use an absolute URL with scheme (`https://...` or `http://...`).
- Do not set `VITE_API_URL` to `/auth` or other path suffixes; use host/base only.

For web build served by backend on same host, leaving it empty is valid.

### CSV import rejects file

Ensure:

- file is CSV
- headers are exactly `name,price,barcode`
- file size <= 25MB

---

## License

MIT (see `LICENSE`).
