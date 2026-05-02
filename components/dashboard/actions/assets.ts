"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getNativeTokenPriceUSD } from "@/lib/prices";

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "FRAX", "USDD"]);

export interface ChainRow {
  id: string;
  name: string;
  chain_id: number;
  image_url: string;
  explorer_url: string;
}

export interface TokenRow {
  id: string;
  name: string;
  symbol: string;
  chain_id: number;
  contract_address: string | null;
  image_url: string;
  decimals: number;
  is_native: boolean;
}

export async function getChains(): Promise<ChainRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("chains")
    .select("id, name, chain_id, image_url, explorer_url")
    .order("name");
  if (error) throw new Error(`getChains: ${error.message}`);
  return data ?? [];
}

export async function getTokensByChain(chainId: number): Promise<TokenRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tokens")
    .select("id, name, symbol, chain_id, contract_address, image_url, decimals, is_native")
    .eq("chain_id", chainId)
    .order("is_native", { ascending: false })
    .order("name");
  if (error) throw new Error(`getTokensByChain: ${error.message}`);
  return data ?? [];
}

export interface TokenWithBalance extends TokenRow {
  display_balance: number;
  price_usd: number;
  usd_value: number;
}

export async function getTokensWithBalances(
  userAddress: string,
  chainId: number,
): Promise<TokenWithBalance[]> {
  const supabase = createServerClient();

  const { data: balances } = await supabase
    .from("balances")
    .select("id, contract_address, symbol, token_name, decimals, raw_balance")
    .eq("user_address", userAddress)
    .eq("chain_id", chainId);

  if (!balances || balances.length === 0) return [];

  const nativeBalance = balances.find((b) => b.contract_address === null);
  let nativePrice = 0;
  if (nativeBalance && !STABLECOINS.has(nativeBalance.symbol.toUpperCase())) {
    nativePrice = await getNativeTokenPriceUSD(nativeBalance.symbol);
  }

  const result: TokenWithBalance[] = [];
  for (const b of balances) {
    const displayBalance = Number(b.raw_balance) / Math.pow(10, b.decimals);
    if (displayBalance <= 0) continue;

    const isNative = b.contract_address === null;
    const isStable = STABLECOINS.has(b.symbol.toUpperCase());
    const priceUsd = isNative ? nativePrice : isStable ? 1.0 : 0;

    result.push({
      id: b.id,
      name: b.token_name,
      symbol: b.symbol,
      chain_id: chainId,
      contract_address: b.contract_address,
      image_url: "",
      decimals: b.decimals,
      is_native: isNative,
      display_balance: displayBalance,
      price_usd: priceUsd,
      usd_value: displayBalance * priceUsd,
    });
  }

  result.sort((a, b) => {
    if (a.is_native && !b.is_native) return -1;
    if (!a.is_native && b.is_native) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return result;
}
