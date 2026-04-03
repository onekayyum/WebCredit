# WebCredit (Caffeine/Motoko-free)

This project now runs on a **standard Node.js environment**:

- Frontend: React + Vite (`src/frontend`)
- Backend: Express + SQLite (`backend-node`)

No Motoko canister is required.
No Caffeine runtime service is required.

---

## Super simple Ubuntu setup (step-by-step)

Pretend we are doing this together, one tiny step at a time.

### 1) Open Terminal

Press `Ctrl + Alt + T`.

### 2) Install Node.js 20 and npm

Copy-paste these commands **one by one**:

```bash
sudo apt update
sudo apt install -y curl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
node -v
npm -v
```

If you see versions printed (like `v20.x.x`), you are good.

### 3) Go into the project folder

```bash
cd /path/to/WebCredit
```

(Replace `/path/to/WebCredit` with your real folder path.)

### 4) Install all dependencies

```bash
npm install
```

This installs both:
- frontend dependencies
- backend dependencies

### 5) Start the app (frontend + backend)

```bash
npm start
```

This starts:
- backend at `http://localhost:3001`
- frontend dev server (Vite) at `http://localhost:5173` (usually)

Open browser and visit:

```text
http://localhost:5173
```

---

## Data storage

SQLite database file is created at:

```text
backend-node/data.sqlite
```

Back up this file to keep your data.

---

## Production-like run on Ubuntu VPS

If you want it always running, use PM2.

### Install PM2

```bash
sudo npm install -g pm2
```

### Build frontend

```bash
npm run build
```

### Start backend with PM2

```bash
pm2 start npm --name webcredit-backend -- run start --workspace backend-node
pm2 save
pm2 startup
```

### Serve frontend build

Simplest way:

```bash
npm install -g serve
serve -s src/frontend/dist -l 4173
```

Then open:

```text
http://YOUR_SERVER_IP:4173
```

---

## API compatibility notes

The backend keeps the same method names as the original actor API using HTTP routes:

- `POST /api/addCustomer`
- `POST /api/updateCustomer`
- `POST /api/deleteCustomer`
- `POST /api/getAllCustomers`
- `POST /api/searchCustomers`
- `POST /api/addProduct`
- `POST /api/updateProduct`
- `POST /api/deleteProduct`
- `POST /api/getAllProducts`
- `POST /api/bulkImportProducts`
- `POST /api/searchProducts`
- `POST /api/addTransaction`
- `POST /api/addBatchTransaction`
- `POST /api/deleteTransaction`
- `POST /api/getTransactionsForCustomer`
- `POST /api/getCustomerBalanceSummary`
- `POST /api/getCustomersSortedByBalance`
- `POST /api/getHighBalanceCustomers`
- `POST /api/getInactiveCustomers`

Frontend method calls were preserved at hook/component level.

---

## Health check

```bash
curl http://localhost:3001/health
```

Expected result:

```json
{"ok":true}
```
