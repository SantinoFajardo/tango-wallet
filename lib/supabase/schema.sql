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
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- No public policies — only the service role key (server-side) can read/write.

-- ─── Balances ─────────────────────────────────────────────────────────────────
-- Current token balance per user/chain/token. contract_address NULL = native.
-- raw_balance stored as TEXT to avoid BigInt overflow.
CREATE TABLE IF NOT EXISTS balances (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address     TEXT        NOT NULL REFERENCES users(address) ON DELETE CASCADE,
  chain_id         INTEGER     NOT NULL,
  contract_address TEXT,
  symbol           TEXT        NOT NULL DEFAULT '',
  token_name       TEXT        NOT NULL DEFAULT '',
  decimals         INTEGER     NOT NULL DEFAULT 18,
  raw_balance      TEXT        NOT NULL DEFAULT '0',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique indexes handle NULL contract_address correctly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_balances_native
  ON balances (user_address, chain_id)
  WHERE contract_address IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_balances_erc20
  ON balances (user_address, chain_id, contract_address)
  WHERE contract_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_balances_user ON balances (user_address);

-- ─── Transactions ─────────────────────────────────────────────────────────────
-- All on-chain transfers sourced from Moralis webhooks.
-- contract_address NULL = native. direction is relative to user_address.
CREATE TABLE IF NOT EXISTS transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash          TEXT        NOT NULL,
  chain_id         INTEGER     NOT NULL,
  user_address     TEXT        NOT NULL REFERENCES users(address) ON DELETE CASCADE,
  from_address     TEXT        NOT NULL,
  to_address       TEXT        NOT NULL,
  value_raw        TEXT        NOT NULL DEFAULT '0',
  contract_address TEXT,
  symbol           TEXT        NOT NULL DEFAULT '',
  token_name       TEXT        NOT NULL DEFAULT '',
  decimals         INTEGER     NOT NULL DEFAULT 18,
  direction        TEXT        NOT NULL CHECK (direction IN ('in', 'out')),
  status           TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS')),
  block_number     TEXT        NOT NULL DEFAULT '',
  block_timestamp  TEXT        NOT NULL DEFAULT '',
  gas_used         TEXT,
  gas_price        TEXT,
  sponsored_gas_wei TEXT,
  sponsored_gas_usd NUMERIC(18,8),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_native
  ON transactions (tx_hash, chain_id, user_address, direction)
  WHERE contract_address IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_erc20
  ON transactions (tx_hash, chain_id, user_address, contract_address, direction)
  WHERE contract_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_address);

ALTER TABLE balances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

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

-- ─── Balance: set exact value (native, from Moralis nativeBalances) ──────────
CREATE OR REPLACE FUNCTION upsert_balance_exact(
  p_user_address     TEXT,
  p_chain_id         INTEGER,
  p_contract_address TEXT,
  p_symbol           TEXT,
  p_token_name       TEXT,
  p_decimals         INTEGER,
  p_raw_balance      TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_contract_address IS NULL THEN
    INSERT INTO balances (user_address, chain_id, contract_address, symbol, token_name, decimals, raw_balance)
    VALUES (p_user_address, p_chain_id, NULL, p_symbol, p_token_name, p_decimals, p_raw_balance)
    ON CONFLICT (user_address, chain_id) WHERE contract_address IS NULL
    DO UPDATE SET raw_balance = EXCLUDED.raw_balance, symbol = EXCLUDED.symbol,
                  token_name = EXCLUDED.token_name, decimals = EXCLUDED.decimals, updated_at = NOW();
  ELSE
    INSERT INTO balances (user_address, chain_id, contract_address, symbol, token_name, decimals, raw_balance)
    VALUES (p_user_address, p_chain_id, p_contract_address, p_symbol, p_token_name, p_decimals, p_raw_balance)
    ON CONFLICT (user_address, chain_id, contract_address) WHERE contract_address IS NOT NULL
    DO UPDATE SET raw_balance = EXCLUDED.raw_balance, symbol = EXCLUDED.symbol,
                  token_name = EXCLUDED.token_name, decimals = EXCLUDED.decimals, updated_at = NOW();
  END IF;
END;
$$;

-- ─── Balance: apply signed delta (ERC20 transfers) ────────────────────────────
-- p_delta: positive = received, negative = sent (as string, e.g. '-500000').
CREATE OR REPLACE FUNCTION adjust_balance(
  p_user_address     TEXT,
  p_chain_id         INTEGER,
  p_contract_address TEXT,
  p_symbol           TEXT,
  p_token_name       TEXT,
  p_decimals         INTEGER,
  p_delta            TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO balances (user_address, chain_id, contract_address, symbol, token_name, decimals, raw_balance)
  VALUES (p_user_address, p_chain_id, p_contract_address, p_symbol, p_token_name, p_decimals,
          GREATEST(0, p_delta::NUMERIC)::TEXT)
  ON CONFLICT (user_address, chain_id, contract_address) WHERE contract_address IS NOT NULL
  DO UPDATE SET
    raw_balance = GREATEST(0, balances.raw_balance::NUMERIC + p_delta::NUMERIC)::TEXT,
    symbol      = EXCLUDED.symbol,
    token_name  = EXCLUDED.token_name,
    decimals    = EXCLUDED.decimals,
    updated_at  = NOW();
END;
$$;

-- ─── Transaction upsert (idempotent, merges data from client + webhook) ──────
-- p_status: 'PENDING' from client-side send, 'SUCCESS' from Moralis webhook.
-- On conflict: SUCCESS is sticky (can never revert to PENDING).
-- Real values (value_raw, block info) from the webhook overwrite the client placeholders.
-- Gas fields from the client are preserved when the webhook has none.
CREATE OR REPLACE FUNCTION upsert_transaction(
  p_tx_hash           TEXT,
  p_chain_id          INTEGER,
  p_user_address      TEXT,
  p_from_address      TEXT,
  p_to_address        TEXT,
  p_value_raw         TEXT,
  p_contract_address  TEXT,
  p_symbol            TEXT,
  p_token_name        TEXT,
  p_decimals          INTEGER,
  p_direction         TEXT,
  p_block_number      TEXT,
  p_block_timestamp   TEXT,
  p_status            TEXT    DEFAULT 'SUCCESS',
  p_gas_used          TEXT    DEFAULT NULL,
  p_gas_price         TEXT    DEFAULT NULL,
  p_sponsored_gas_wei TEXT    DEFAULT NULL,
  p_sponsored_gas_usd NUMERIC DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_contract_address IS NULL THEN
    INSERT INTO transactions (tx_hash, chain_id, user_address, from_address, to_address, value_raw,
      contract_address, symbol, token_name, decimals, direction, status, block_number, block_timestamp,
      gas_used, gas_price, sponsored_gas_wei, sponsored_gas_usd)
    VALUES (p_tx_hash, p_chain_id, p_user_address, p_from_address, p_to_address, p_value_raw,
      NULL, p_symbol, p_token_name, p_decimals, p_direction, p_status, p_block_number, p_block_timestamp,
      p_gas_used, p_gas_price, p_sponsored_gas_wei, p_sponsored_gas_usd)
    ON CONFLICT (tx_hash, chain_id, user_address, direction) WHERE contract_address IS NULL
    DO UPDATE SET
      status            = CASE WHEN transactions.status = 'SUCCESS' THEN 'SUCCESS' ELSE EXCLUDED.status END,
      value_raw         = CASE WHEN EXCLUDED.value_raw::NUMERIC > 0 THEN EXCLUDED.value_raw ELSE transactions.value_raw END,
      block_number      = CASE WHEN EXCLUDED.block_number <> '' THEN EXCLUDED.block_number ELSE transactions.block_number END,
      block_timestamp   = CASE WHEN EXCLUDED.block_timestamp <> '' THEN EXCLUDED.block_timestamp ELSE transactions.block_timestamp END,
      gas_used          = COALESCE(EXCLUDED.gas_used, transactions.gas_used),
      gas_price         = COALESCE(EXCLUDED.gas_price, transactions.gas_price),
      sponsored_gas_wei = COALESCE(EXCLUDED.sponsored_gas_wei, transactions.sponsored_gas_wei),
      sponsored_gas_usd = COALESCE(EXCLUDED.sponsored_gas_usd, transactions.sponsored_gas_usd);
  ELSE
    INSERT INTO transactions (tx_hash, chain_id, user_address, from_address, to_address, value_raw,
      contract_address, symbol, token_name, decimals, direction, status, block_number, block_timestamp,
      gas_used, gas_price, sponsored_gas_wei, sponsored_gas_usd)
    VALUES (p_tx_hash, p_chain_id, p_user_address, p_from_address, p_to_address, p_value_raw,
      p_contract_address, p_symbol, p_token_name, p_decimals, p_direction, p_status, p_block_number, p_block_timestamp,
      p_gas_used, p_gas_price, p_sponsored_gas_wei, p_sponsored_gas_usd)
    ON CONFLICT (tx_hash, chain_id, user_address, contract_address, direction) WHERE contract_address IS NOT NULL
    DO UPDATE SET
      status            = CASE WHEN transactions.status = 'SUCCESS' THEN 'SUCCESS' ELSE EXCLUDED.status END,
      value_raw         = CASE WHEN EXCLUDED.value_raw::NUMERIC > 0 THEN EXCLUDED.value_raw ELSE transactions.value_raw END,
      block_number      = CASE WHEN EXCLUDED.block_number <> '' THEN EXCLUDED.block_number ELSE transactions.block_number END,
      block_timestamp   = CASE WHEN EXCLUDED.block_timestamp <> '' THEN EXCLUDED.block_timestamp ELSE transactions.block_timestamp END,
      gas_used          = COALESCE(EXCLUDED.gas_used, transactions.gas_used),
      gas_price         = COALESCE(EXCLUDED.gas_price, transactions.gas_price),
      sponsored_gas_wei = COALESCE(EXCLUDED.sponsored_gas_wei, transactions.sponsored_gas_wei),
      sponsored_gas_usd = COALESCE(EXCLUDED.sponsored_gas_usd, transactions.sponsored_gas_usd);
  END IF;
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
