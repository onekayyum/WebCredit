import db from "./db.js";

/**
 * Simple migration system.
 * Each migration runs once and is tracked in the `migrations` table.
 * Migrations MUST be idempotent and backward-compatible.
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );
`);

const ALLOWED_TABLES = new Set(["customers", "products", "transactions"]);

function addUserIdColumnIfMissing(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`addUserIdColumnIfMissing: invalid table "${tableName}"`);
  }
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
  const hasUserId = columns.some((column) => column.name === "user_id");
  if (!hasUserId) {
    db.exec(`ALTER TABLE "${tableName}" ADD COLUMN user_id INTEGER`);
  }
}

function recreateTableWithoutGlobalUnique({
  tableName,
  createSql,
  columnList,
  copySelect,
}) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`recreateTableWithoutGlobalUnique: invalid table "${tableName}"`);
  }
  const tableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  if (!tableRow?.sql) return;
  if (!tableRow.sql.includes("UNIQUE")) return;

  db.exec(`
    ALTER TABLE "${tableName}" RENAME TO "${tableName}_old";
    ${createSql}
    INSERT INTO "${tableName}" (${columnList.join(", ")})
    SELECT ${copySelect}
    FROM "${tableName}_old";
    DROP TABLE "${tableName}_old";
  `);
}

const migrations = [
  {
    name: "001_initial_schema",
    up() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          mobile TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          user_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          barcode TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          user_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customerId INTEGER NOT NULL,
          productName TEXT NOT NULL,
          note TEXT NOT NULL,
          amount REAL NOT NULL,
          txType TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          itemsJson TEXT,
          user_id INTEGER,
          FOREIGN KEY(customerId) REFERENCES customers(id)
        );
        CREATE TABLE IF NOT EXISTS imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          total_rows INTEGER NOT NULL DEFAULT 0,
          processed_rows INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);

      addUserIdColumnIfMissing("customers");
      addUserIdColumnIfMissing("products");
      addUserIdColumnIfMissing("transactions");

      recreateTableWithoutGlobalUnique({
        tableName: "customers",
        createSql: `CREATE TABLE customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          mobile TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          user_id INTEGER
        );`,
        columnList: ["id", "name", "mobile", "createdAt", "user_id"],
        copySelect: "id, name, mobile, createdAt, user_id",
      });
      recreateTableWithoutGlobalUnique({
        tableName: "products",
        createSql: `CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          barcode TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          user_id INTEGER
        );`,
        columnList: ["id", "name", "price", "barcode", "createdAt", "user_id"],
        copySelect: "id, name, price, barcode, createdAt, user_id",
      });
    },
  },
  {
    name: "002_indexes",
    up() {
      db.exec("CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_barcode ON products(user_id, barcode)");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_mobile ON customers(user_id, mobile)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_imports_user_status ON imports(user_id, status)");
    },
  },
  {
    name: "003_user_settings",
    up() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          language TEXT NOT NULL DEFAULT 'en',
          currency TEXT NOT NULL DEFAULT 'USD',
          businessName TEXT NOT NULL DEFAULT '',
          threshold REAL NOT NULL DEFAULT 1000,
          inactiveDays INTEGER NOT NULL DEFAULT 7,
          reminderEnabled INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
      `);
    },
  },
];

export function runMigrations() {
  const applied = new Set(
    db
      .prepare("SELECT name FROM migrations")
      .all()
      .map((r) => r.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    console.log(`[migration] running: ${migration.name}`);
    db.transaction(() => {
      migration.up();
      db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(
        migration.name,
        new Date().toISOString(),
      );
    })();
    console.log(`[migration] completed: ${migration.name}`);
  }
}
