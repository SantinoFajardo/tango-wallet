"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getNativeTokenPriceUSD } from "@/lib/prices";

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
  is_stable: boolean;
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

export interface SwapToken extends TokenRow {
  raw_balance: string;
  display_balance: number;
  price_usd: number;
}

export async function getTokensForSwap(
  userAddress: string,
  chainId: number
): Promise<SwapToken[]> {
  const supabase = createServerClient();

  const tokensQuery = supabase
    .from("tokens")
    .select(
      "id, name, symbol, chain_id, contract_address, image_url, decimals, is_native, is_stable"
    )
    .eq("chain_id", chainId)
    .order("is_native", { ascending: false })
    .order("name");

  const balancesQuery = userAddress
    ? supabase
        .from("balances")
        .select("contract_address, raw_balance")
        .eq("user_address", userAddress)
        .eq("chain_id", chainId)
    : Promise.resolve({ data: [], error: null });

  const [tokensResult, balancesResult] = await Promise.all([
    tokensQuery,
    balancesQuery,
  ]);

  if (tokensResult.error) throw new Error(tokensResult.error.message);

  const tokens = tokensResult.data ?? [];
  const balances = balancesResult.data ?? [];

  const balanceMap = new Map<string | null, string>();
  for (const b of balances) {
    balanceMap.set(b.contract_address, b.raw_balance);
  }

  const nativeToken = tokens.find((t) => t.is_native);
  let nativePrice = 0;
  if (nativeToken && !nativeToken.is_stable) {
    nativePrice = await getNativeTokenPriceUSD(nativeToken.symbol).catch(
      () => 0
    );
  }

  return tokens.map((t) => {
    const rawBal = balanceMap.get(t.contract_address) ?? "0";
    const displayBalance = Number(rawBal) / Math.pow(10, t.decimals);
    const priceUsd = t.is_native ? nativePrice : t.is_stable ? 1.0 : 0;
    return {
      ...t,
      raw_balance: rawBal,
      display_balance: displayBalance,
      price_usd: priceUsd,
    };
  });
}

export async function getTokensByChain(chainId: number): Promise<TokenRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tokens")
    .select(
      "id, name, symbol, chain_id, contract_address, image_url, decimals, is_native, is_stable"
    )
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
  chainId: number
): Promise<TokenWithBalance[]> {
  const supabase = createServerClient();

  const [{ data: balances }, { data: tokens }] = await Promise.all([
    supabase
      .from("balances")
      .select("id, contract_address, symbol, token_name, decimals, raw_balance")
      .eq("user_address", userAddress)
      .eq("chain_id", chainId),
    supabase
      .from("tokens")
      .select("contract_address, is_native, is_stable")
      .eq("chain_id", chainId),
  ]);

  if (!balances || balances.length === 0) return [];

  const tokenMeta = new Map<
    string | null,
    { is_native: boolean; is_stable: boolean }
  >();
  for (const t of tokens ?? []) {
    tokenMeta.set(t.contract_address, {
      is_native: t.is_native,
      is_stable: t.is_stable,
    });
  }

  const nativeBalance = balances.find((b) => b.contract_address === null);
  const nativeMeta = tokenMeta.get(null);
  let nativePrice = 0;
  if (nativeBalance && !nativeMeta?.is_stable) {
    nativePrice = await getNativeTokenPriceUSD(nativeBalance.symbol);
  }

  const result: TokenWithBalance[] = [];
  for (const b of balances) {
    const displayBalance = Number(b.raw_balance) / Math.pow(10, b.decimals);
    if (displayBalance <= 0) continue;

    const meta = tokenMeta.get(b.contract_address);
    const isNative = b.contract_address === null;
    const isStable = meta?.is_stable ?? false;
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
      is_stable: isStable,
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
