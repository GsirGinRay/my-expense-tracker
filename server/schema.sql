CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount     NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  category   TEXT NOT NULL,
  merchant   TEXT NOT NULL DEFAULT '',
  date       DATE NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_user_date
  ON records (user_id, date DESC, created_at DESC);

-- 投資損益專用欄位（一般記帳留 NULL）。
-- 用 category = '投資' AND stock_name IS NOT NULL 識別投資紀錄。
ALTER TABLE records ADD COLUMN IF NOT EXISTS stock_name   TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS shares       NUMERIC(14, 4);
ALTER TABLE records ADD COLUMN IF NOT EXISTS buy_price    NUMERIC(14, 4);
ALTER TABLE records ADD COLUMN IF NOT EXISTS sell_price   NUMERIC(14, 4);
ALTER TABLE records ADD COLUMN IF NOT EXISTS fee_discount NUMERIC(5, 4);
