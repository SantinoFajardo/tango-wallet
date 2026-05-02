"use server";

import { createServerClient } from "@/lib/supabase/server";

interface WebhookBlock {
  number: string;
  timestamp: string;
}

interface InternalTx {
  from: string;
  to: string;
  value: string;
  transactionHash: string;
}

interface Erc20Transfer {
  transactionHash: string;
  contract: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: string;
  possibleSpam: boolean;
}

interface NativeBalance {
  address: string;
  balance: string;
}

export interface WebhookPayload {
  chainId: string;
  block: WebhookBlock;
  txsInternal: InternalTx[];
  erc20Transfers: Erc20Transfer[];
  nativeBalances: NativeBalance[];
}

export async function updateOrCreateTokenUserBalances(
  payload: WebhookPayload
): Promise<void> {
  const supabase = createServerClient();
  const chainId = parseInt(payload.chainId, 16);

  // Collect every address that appears in this webhook event.
  const allAddresses = new Set<string>();
  payload.nativeBalances.forEach((nb) =>
    allAddresses.add(nb.address.toLowerCase())
  );
  payload.txsInternal.forEach((tx) => {
    allAddresses.add(tx.from.toLowerCase());
    allAddresses.add(tx.to.toLowerCase());
  });
  payload.erc20Transfers.forEach((t) => {
    allAddresses.add(t.from.toLowerCase());
    allAddresses.add(t.to.toLowerCase());
  });

  if (allAddresses.size === 0) return;

  // Only process addresses that are registered users in our DB.
  const { data: registeredUsers, error: usersError } = await supabase
    .from("users")
    .select("address")
    .in("address", [...allAddresses]);

  if (usersError) {
    console.error(
      "[webhook] Failed to fetch registered users:",
      usersError.message
    );
    return;
  }

  const monitoredAddresses = new Set(
    (registeredUsers ?? []).map((u) => u.address.toLowerCase())
  );

  if (monitoredAddresses.size === 0) return;

  // Look up the native token for this chain.
  const { data: nativeToken, error: nativeTokenError } = await supabase
    .from("tokens")
    .select("symbol, name, decimals")
    .eq("chain_id", chainId)
    .eq("is_native", true)
    .maybeSingle();

  if (nativeTokenError) {
    console.error(
      "[webhook] Failed to fetch native token:",
      nativeTokenError.message
    );
  }

  const nativeSymbol = nativeToken?.symbol ?? "";
  const nativeName = nativeToken?.name ?? "";
  const nativeDecimals = nativeToken?.decimals ?? 18;

  // ── Native balances (exact value, only present when native transfer occurred) ─
  for (const nb of payload.nativeBalances) {
    const address = nb.address.toLowerCase();
    if (!monitoredAddresses.has(address)) continue;

    const { error } = await supabase.rpc("upsert_balance_exact", {
      p_user_address: address,
      p_chain_id: chainId,
      p_contract_address: null,
      p_symbol: nativeSymbol,
      p_token_name: nativeName,
      p_decimals: nativeDecimals,
      p_raw_balance: nb.balance,
    });
    if (error) {
      console.error(
        `[webhook] upsert_balance_exact failed for ${address}:`,
        error.message
      );
    }
  }

  // ── Native transactions (from txsInternal) ────────────────────────────────
  for (const tx of payload.txsInternal) {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();

    if (monitoredAddresses.has(from)) {
      const { error } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: tx.transactionHash,
        p_chain_id: chainId,
        p_user_address: from,
        p_from_address: from,
        p_to_address: to,
        p_value_raw: tx.value,
        p_contract_address: null,
        p_symbol: nativeSymbol,
        p_token_name: nativeName,
        p_decimals: nativeDecimals,
        p_direction: "out" as const,
        p_block_number: payload.block.number,
        p_block_timestamp: payload.block.timestamp,
        p_status: "SUCCESS",
      });
      if (error) {
        console.error(
          `[webhook] upsert_transaction (native out) failed for ${from}:`,
          error.message
        );
      }
    }

    if (monitoredAddresses.has(to)) {
      const { error } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: tx.transactionHash,
        p_chain_id: chainId,
        p_user_address: to,
        p_from_address: from,
        p_to_address: to,
        p_value_raw: tx.value,
        p_contract_address: null,
        p_symbol: nativeSymbol,
        p_token_name: nativeName,
        p_decimals: nativeDecimals,
        p_direction: "in" as const,
        p_block_number: payload.block.number,
        p_block_timestamp: payload.block.timestamp,
        p_status: "SUCCESS",
      });
      if (error) {
        console.error(
          `[webhook] upsert_transaction (native in) failed for ${to}:`,
          error.message
        );
      }
    }
  }

  // ── ERC20 transfers ───────────────────────────────────────────────────────
  for (const transfer of payload.erc20Transfers) {
    if (transfer.possibleSpam) continue;

    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    const contract = transfer.contract.toLowerCase();
    const decimals = parseInt(transfer.tokenDecimals, 10);

    if (monitoredAddresses.has(from)) {
      const { error: balErr } = await supabase.rpc("adjust_balance", {
        p_user_address: from,
        p_chain_id: chainId,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_delta: `-${transfer.value}`,
      });
      if (balErr) {
        console.error(
          `[webhook] adjust_balance (erc20 out) failed for ${from}:`,
          balErr.message
        );
      }
      const { error: txErr } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: transfer.transactionHash,
        p_chain_id: chainId,
        p_user_address: from,
        p_from_address: from,
        p_to_address: to,
        p_value_raw: transfer.value,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_direction: "out" as const,
        p_block_number: payload.block.number,
        p_block_timestamp: payload.block.timestamp,
        p_status: "SUCCESS",
      });
      if (txErr) {
        console.error(
          `[webhook] upsert_transaction (erc20 out) failed for ${from}:`,
          txErr.message
        );
      }
    }

    if (monitoredAddresses.has(to)) {
      const { error: balErr } = await supabase.rpc("adjust_balance", {
        p_user_address: to,
        p_chain_id: chainId,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_delta: transfer.value,
      });
      if (balErr) {
        console.error(
          `[webhook] adjust_balance (erc20 in) failed for ${to}:`,
          balErr.message
        );
      }

      const { error: txErr } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: transfer.transactionHash,
        p_chain_id: chainId,
        p_user_address: to,
        p_from_address: from,
        p_to_address: to,
        p_value_raw: transfer.value,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_direction: "in" as const,
        p_block_number: payload.block.number,
        p_block_timestamp: payload.block.timestamp,
        p_status: "SUCCESS",
      });
      if (txErr) {
        console.error(
          `[webhook] upsert_transaction (erc20 in) failed for ${to}:`,
          txErr.message
        );
      }
    }
  }
}

interface MoralisErc20Token {
  token_address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  balance: string;
  possible_spam: boolean;
}

export async function refreshBalancesFromChain(
  userAddress: string,
  chainId: number
) {
  const supabase = createServerClient();

  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) throw new Error("MORALIS_API_KEY is not set");

  // Ensure user row exists before writing balances (FK constraint).
  await supabase
    .from("users")
    .upsert(
      { address: userAddress, login_method: "wallet" },
      { onConflict: "address", ignoreDuplicates: true }
    );

  const hexChainId = `0x${chainId.toString(16)}`;
  const base = "https://deep-index.moralis.io/api/v2.2";
  const headers = { "X-Api-Key": apiKey };

  // Look up native token info from our DB for symbol/name/decimals.
  const { data: nativeToken } = await supabase
    .from("tokens")
    .select("symbol, name, decimals")
    .eq("chain_id", chainId)
    .eq("is_native", true)
    .maybeSingle();

  // ── Native balance ────────────────────────────────────────────────────────
  try {
    const nativeRes = await fetch(
      `${base}/${userAddress}/balance?chain=${hexChainId}`,
      { headers, cache: "no-store" }
    );
    if (!nativeRes.ok) throw new Error(await nativeRes.text());

    const { balance } = (await nativeRes.json()) as { balance: string };

    const { error } = await supabase.rpc("upsert_balance_exact", {
      p_user_address: userAddress,
      p_chain_id: chainId,
      p_contract_address: null,
      p_symbol: nativeToken?.symbol ?? "",
      p_token_name: nativeToken?.name ?? "",
      p_decimals: nativeToken?.decimals ?? 18,
      p_raw_balance: balance,
    });
    if (error)
      console.error(
        "[refreshBalancesFromChain] native upsert failed:",
        error.message
      );
  } catch (err) {
    console.error(
      "[refreshBalancesFromChain] native balance fetch failed:",
      err
    );
  }

  // ── ERC20 balances ────────────────────────────────────────────────────────
  try {
    const erc20Res = await fetch(
      `${base}/${userAddress}/erc20?chain=${hexChainId}&exclude_spam=true`,
      { headers, cache: "no-store" }
    );
    if (!erc20Res.ok) throw new Error(await erc20Res.text());

    const tokens = (await erc20Res.json()) as MoralisErc20Token[];

    for (const token of tokens) {
      if (token.possible_spam) continue;

      const { error } = await supabase.rpc("upsert_balance_exact", {
        p_user_address: userAddress,
        p_chain_id: chainId,
        p_contract_address: token.token_address.toLowerCase(),
        p_symbol: token.symbol ?? "",
        p_token_name: token.name ?? "",
        p_decimals: token.decimals ?? 18,
        p_raw_balance: token.balance,
      });
      if (error) {
        console.error(
          `[refreshBalancesFromChain] erc20 upsert failed for ${token.token_address}:`,
          error.message
        );
      }
    }
  } catch (err) {
    console.error("[refreshBalancesFromChain] ERC20 fetch failed:", err);
  }

  // Return the updated balances for this chain.
  const { data } = await supabase
    .from("balances")
    .select()
    .eq("user_address", userAddress)
    .eq("chain_id", chainId);

  return data ?? [];
}

export async function refreshAllBalances(userAddress: string) {
  const supabase = createServerClient();

  const { data: chains, error } = await supabase
    .from("chains")
    .select("chain_id");

  if (error) {
    console.error(
      "[refreshAllBalances] Failed to fetch chains:",
      error.message
    );
    return [];
  }

  await Promise.all(
    (chains ?? []).map((c) =>
      refreshBalancesFromChain(userAddress, c.chain_id).catch((err) =>
        console.error(`[refreshAllBalances] chain ${c.chain_id} failed:`, err)
      )
    )
  );

  const { data } = await supabase
    .from("balances")
    .select()
    .eq("user_address", userAddress);

  return data ?? [];
}

export async function getTokenUserBalance(token_id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("balances")
    .select()
    .eq("id", token_id)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getAllTokenUserBalances(userAddress: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("balances")
    .select()
    .eq("user_address", userAddress);
  if (error || !data) return null;
  return data;
}
