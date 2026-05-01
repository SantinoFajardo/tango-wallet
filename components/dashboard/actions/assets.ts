"use server";

import { createServerClient } from "@/lib/supabase/server";

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
