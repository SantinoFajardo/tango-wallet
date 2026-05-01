"use server";

import { createServerClient } from "@/lib/supabase/server";

export async function upsertUser(
  address: string,
  loginMethod: string,
): Promise<void> {
  const supabase = createServerClient();

  // Use an RPC instead of PostgREST upsert. A partial upsert via PostgREST
  // sets omitted NOT NULL columns to NULL on the conflict branch, which
  // violates our constraints. The SQL function handles the conflict correctly.
  const { error } = await supabase.rpc("upsert_user", {
    p_address: address,
    p_login_method: loginMethod,
  } as any);

  if (error) throw new Error(`upsertUser: ${JSON.stringify(error, null, 2)}`);
}

export async function getUserSponsoredGas(address: string): Promise<{
  totalWei: string;
  totalUSD: number;
  txCount: number;
} | null> {
  const supabase = createServerClient();

  const { data, error }: any = await supabase
    .from("users")
    .select("total_sponsored_gas_wei, total_sponsored_gas_usd, tx_count")
    .eq("address", address)
    .single();

  if (error || !data) return null;

  return {
    totalWei: data.total_sponsored_gas_wei,
    totalUSD: Number(data.total_sponsored_gas_usd),
    txCount: data.tx_count,
  };
}
