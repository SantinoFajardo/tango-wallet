-- Fix adjust_balance to handle native tokens (contract_address IS NULL).
-- The original function only had an ON CONFLICT branch for ERC20 tokens.
-- Run this in Supabase → SQL Editor.

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
  IF p_contract_address IS NULL THEN
    INSERT INTO balances (user_address, chain_id, contract_address, symbol, token_name, decimals, raw_balance)
    VALUES (p_user_address, p_chain_id, NULL, p_symbol, p_token_name, p_decimals,
            GREATEST(0, p_delta::NUMERIC)::TEXT)
    ON CONFLICT (user_address, chain_id) WHERE contract_address IS NULL
    DO UPDATE SET
      raw_balance = GREATEST(0, balances.raw_balance::NUMERIC + p_delta::NUMERIC)::TEXT,
      symbol      = EXCLUDED.symbol,
      token_name  = EXCLUDED.token_name,
      decimals    = EXCLUDED.decimals,
      updated_at  = NOW();
  ELSE
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
  END IF;
END;
$$;
