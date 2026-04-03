# WebCredit (Standard Node.js + SQLite Edition)

This project no longer needs Motoko, ICP canisters, or Caffeine runtime services.

You now run it like a normal app:
- Backend: **Node.js + Express**
- Database: **SQLite file** (`data/app.db`)
- Frontend: **React + Vite**

---

## 1) Project structure (what is what)

```text
backend-server.js                # Main backend server (all API methods)
package.json                     # Root scripts (npm start)
src/frontend/                    # Frontend app
src/frontend/src/backendTypes.ts # Shared API types frontend expects
src/frontend/src/restBackend.ts  # Frontend adapter -> calls backend endpoints
```

---

## 2) API compatibility promise

Frontend still calls the same backend method names:

- `addCustomer`, `updateCustomer`, `deleteCustomer`, `getAllCustomers`, `searchCustomers`
- `addProduct`, `updateProduct`, `deleteProduct`, `getAllProducts`, `searchProducts`, `bulkImportProducts`
- `addTransaction`, `addBatchTransaction`, `deleteTransaction`, `getTransactionsForCustomer`
- `getCustomerBalanceSummary`, `getCustomersSortedByBalance`, `getHighBalanceCustomers`, `getInactiveCustomers`

Route used by backend:

- `POST /api/backend/:method`

So frontend business flow stays the same, without changing component API calls.

---

## 3) Run locally (simple)

### Step A — Install Node.js (if not installed)

On Ubuntu:

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v
npm -v
```

### Step B — Go to project folder

```bash
cd /path/to/WebCredit
```

### Step C — Install backend dependencies

```bash
npm install
```

### Step D — Install frontend dependencies

```bash
npm run install:frontend
```

### Step E — Build frontend files

```bash
npm run build:frontend
```

### Step F — Start app

```bash
npm start
```

Now open browser:

- `http://localhost:3001`

Health check:

- `http://localhost:3001/health`

---

## 4) Host on Ubuntu server (ELI6 style)

Think of this like feeding and starting a toy robot.

### 4.1 Put code on server

```bash
git clone <YOUR_REPO_URL>
cd WebCredit
```

### 4.2 Install Node + npm

```bash
sudo apt update
sudo apt install -y nodejs npm
```

### 4.3 Install app packages

```bash
npm install
npm run install:frontend
```

### 4.4 Build the frontend

```bash
npm run build:frontend
```

### 4.5 Start app once (quick test)

```bash
npm start
```

Visit:

```text
http://YOUR_SERVER_IP:3001
```

Press `Ctrl + C` to stop.

### 4.6 Keep app running forever with PM2

Install PM2:

```bash
sudo npm install -g pm2
```

Start app with PM2:

```bash
pm2 start npm --name webcredit -- start
```

Save PM2 process list:

```bash
pm2 save
```

Enable restart on reboot:

```bash
pm2 startup
```

(Then copy-paste the command PM2 prints.)

### 4.7 Open firewall (if UFW enabled)

```bash
sudo ufw allow 3001/tcp
sudo ufw status
```

---

## 5) Optional: Nginx reverse proxy (nice domain)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create config:

```bash
sudo nano /etc/nginx/sites-available/webcredit
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/webcredit /etc/nginx/sites-enabled/webcredit
sudo nginx -t
sudo systemctl restart nginx
```

Now open:

- `http://YOUR_DOMAIN_OR_IP`

---

## 6) Data storage

SQLite database file is created automatically at:

```text
data/app.db
```

Backup example:

```bash
cp data/app.db data/app-backup-$(date +%F).db
```

---

## 7) Developer notes

- Frontend talks to backend through `src/frontend/src/restBackend.ts`.
- Backend route dispatcher is in `backend-server.js`.
- No Motoko backend is required to run the app.
