-- Run this in your Supabase project → SQL Editor

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  address                 TEXT        PRIMARY KEY,
  login_method            TEXT        NOT NULL DEFAULT 'unknown',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sponsored_gas_wei TEXT        NOT NULL DEFAULT '0',   -- stored as TEXT to avoid BigInt overflow
  total_sponsored_gas_usd NUMERIC(18,8) NOT NULL DEFAULT 0,
  tx_count                INTEGER     NOT NULL DEFAULT 0
);

-- ─── Sponsored Transactions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsored_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address     TEXT        NOT NULL REFERENCES users(address) ON DELETE CASCADE,
  tx_hash          TEXT        NOT NULL,
  chain_id         INTEGER     NOT NULL,
  gas_used         TEXT        NOT NULL DEFAULT '0',
  gas_price        TEXT        NOT NULL DEFAULT '0',
  sponsored_gas_wei TEXT       NOT NULL DEFAULT '0',
  sponsored_gas_usd NUMERIC(18,8) NOT NULL DEFAULT 0,
  token_symbol     TEXT        NOT NULL DEFAULT 'ETH',
  receiver_address TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_txs_user
  ON sponsored_transactions (user_address);

-- ─── Chains ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chains (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  chain_id    INTEGER NOT NULL UNIQUE,
  image_url   TEXT    NOT NULL DEFAULT '',
  explorer_url TEXT   NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tokens ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT    NOT NULL,
  symbol           TEXT    NOT NULL,
  chain_id         INTEGER NOT NULL REFERENCES chains(chain_id) ON DELETE CASCADE,
  contract_address TEXT,                              -- NULL for native tokens
  image_url        TEXT    NOT NULL DEFAULT '',
  decimals         INTEGER NOT NULL DEFAULT 18,
  is_native        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens (chain_id);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
-- All writes go through Server Actions using the service role key, which bypasses RLS.
-- Enable RLS to prevent direct client access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsored_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- No public policies — only the service role key (server-side) can read/write.

-- ─── Safe user upsert ────────────────────────────────────────────────────────
-- Inserts a new user row or, on conflict, updates only login_method + updated_at.
-- This avoids PostgREST's partial-upsert issue where omitted NOT NULL columns
-- would be set to NULL on the conflict branch.
CREATE OR REPLACE FUNCTION upsert_user(
  p_address      TEXT,
  p_login_method TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO users (address, login_method)
  VALUES (p_address, p_login_method)
  ON CONFLICT (address) DO UPDATE SET
    login_method = EXCLUDED.login_method,
    updated_at   = NOW();
END;
$$;

-- ─── Atomic gas increment function ───────────────────────────────────────────
-- Called by the recordSponsoredTransaction server action to safely add gas
-- totals without a read-modify-write race condition.
CREATE OR REPLACE FUNCTION increment_user_gas(
  p_address TEXT,
  p_gas_wei TEXT,
  p_gas_usd NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET
    total_sponsored_gas_wei = (total_sponsored_gas_wei::NUMERIC + p_gas_wei::NUMERIC)::TEXT,
    total_sponsored_gas_usd = total_sponsored_gas_usd + p_gas_usd,
    tx_count                = tx_count + 1,
    updated_at              = NOW()
  WHERE address = p_address;
END;
$$;
