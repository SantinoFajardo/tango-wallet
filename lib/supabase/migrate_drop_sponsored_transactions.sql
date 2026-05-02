-- Migration: drop sponsored_transactions, add gas + status columns to transactions
-- Run this once in your Supabase project → SQL Editor

-- 1. Add new columns to transactions.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SUCCESS')),
  ADD COLUMN IF NOT EXISTS gas_used         TEXT,
  ADD COLUMN IF NOT EXISTS gas_price        TEXT,
  ADD COLUMN IF NOT EXISTS sponsored_gas_wei TEXT,
  ADD COLUMN IF NOT EXISTS sponsored_gas_usd NUMERIC(18,8);

-- 2. Replace upsert_transaction with the version that handles status + merges on conflict.
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

-- 3. Drop the old table (irreversible — make sure you don't need the data).
DROP TABLE IF EXISTS sponsored_transactions;
