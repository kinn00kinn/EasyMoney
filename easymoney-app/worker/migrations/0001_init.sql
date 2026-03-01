PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'credit')),
  currency TEXT NOT NULL DEFAULT 'JPY',
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
  color TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  occurred_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('expense', 'income', 'transfer')),
  description TEXT NOT NULL,
  memo TEXT,
  amount INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  payment_method TEXT NOT NULL,
  counter_account_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES accounts(id),
  FOREIGN KEY(counter_account_id) REFERENCES accounts(id),
  FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  ledger_type TEXT NOT NULL CHECK (ledger_type IN ('account', 'category')),
  ledger_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_transaction ON entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_entries_ledger ON entries (ledger_type, ledger_id);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  original_filename TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rows_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS import_rows (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  description TEXT NOT NULL,
  memo TEXT,
  amount INTEGER NOT NULL,
  flow TEXT NOT NULL CHECK (flow IN ('inflow', 'outflow')),
  status TEXT NOT NULL DEFAULT 'pending',
  category_id TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_rows_import ON import_rows (import_id);
