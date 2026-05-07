"use server";

import { createServerClient } from "@/lib/supabase/server";

interface WebhookBlock {
  number: string;
  timestamp: string;
}

interface NormalTx {
  hash: string;
  fromAddress: string;
  toAddress: string;
  value: string;
  gasPrice: string;
  receiptGasUsed: string;
  receiptStatus: string;
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
  txs: NormalTx[];
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
  payload.txs.forEach((tx) => {
    allAddresses.add(tx.fromAddress.toLowerCase());
    if (tx.toAddress) allAddresses.add(tx.toAddress.toLowerCase());
  });
  payload.txsInternal.forEach((tx) => {
    allAddresses.add(tx.from.toLowerCase());
    allAddresses.add(tx.to.toLowerCase());
  });
  payload.erc20Transfers.forEach((t) => {
    allAddresses.add(t.from.toLowerCase());
    allAddresses.add(t.to.toLowerCase());
  });

  if (allAddresses.size === 0) return;

  // Case-insensitive address lookup — Moralis sends lowercase, DB stores checksum.
  const { data: registeredUsers, error: usersError } = await supabase
    .from("users")
    .select("address")
    .or([...allAddresses].map((a) => `address.ilike.${a}`).join(","));

  if (usersError) {
    console.error(
      "[webhook] Failed to fetch registered users:",
      usersError.message
    );
    return;
  }

  // Map lowercase → exact DB address so FK writes use the stored casing.
  const dbAddressMap = new Map<string, string>();
  for (const u of registeredUsers ?? []) {
    dbAddressMap.set(u.address.toLowerCase(), u.address);
  }
  const monitoredAddresses = new Set(dbAddressMap.keys());

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

  // Tracks addresses whose native balance was set exactly (idempotent).
  // Addresses NOT in this set will receive a delta adjustment from tx values.
  const exactBalanceUpdated = new Set<string>();

  // ── Native balances (exact value, only present when native transfer occurred) ─
  for (const nb of payload.nativeBalances) {
    const address = nb.address.toLowerCase();
    if (!monitoredAddresses.has(address)) continue;

    const { error } = await supabase.rpc("upsert_balance_exact", {
      p_user_address: dbAddressMap.get(address) ?? address,
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
    } else {
      exactBalanceUpdated.add(address);
    }
  }

  // Dedup key: prevents the same (hash, user, direction) from being written
  // twice when it appears in both txs and txsInternal.
  const writtenNativeTxs = new Set<string>();
  const nativeKey = (hash: string, user: string, dir: string) =>
    `${hash}:${user}:${dir}`;

  async function adjustNativeBalance(userAddress: string, delta: string) {
    const dbAddress = dbAddressMap.get(userAddress) ?? userAddress;

    const { data: existing, error: fetchErr } = await supabase
      .from("balances")
      .select("id, raw_balance")
      .eq("user_address", dbAddress)
      .eq("chain_id", chainId)
      .is("contract_address", null)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[webhook] native balance fetch failed for ${userAddress}:`, fetchErr.message);
      return;
    }

    const current = BigInt(existing?.raw_balance ?? "0");
    const isNeg = delta.startsWith("-");
    const abs = BigInt(isNeg ? delta.slice(1) : delta);
    const next = isNeg
      ? current > abs ? current - abs : 0n
      : current + abs;

    if (existing) {
      const { error } = await supabase
        .from("balances")
        .update({ raw_balance: next.toString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) console.error(`[webhook] native balance update failed for ${userAddress}:`, error.message);
    } else {
      const { error } = await supabase
        .from("balances")
        .insert({
          user_address: dbAddress,
          chain_id: chainId,
          contract_address: null,
          symbol: nativeSymbol,
          token_name: nativeName,
          decimals: nativeDecimals,
          raw_balance: next.toString(),
        });
      if (error) console.error(`[webhook] native balance insert failed for ${userAddress}:`, error.message);
    }
  }

  async function upsertNativeTx(
    hash: string,
    from: string,
    to: string,
    value: string,
    direction: "in" | "out",
    userAddress: string
  ) {
    const key = nativeKey(hash, userAddress, direction);
    if (writtenNativeTxs.has(key)) return;
    writtenNativeTxs.add(key);

    const { error } = await supabase.rpc("upsert_transaction", {
      p_tx_hash: hash,
      p_chain_id: chainId,
      p_user_address: dbAddressMap.get(userAddress) ?? userAddress,
      p_from_address: from,
      p_to_address: to,
      p_value_raw: value,
      p_contract_address: null,
      p_symbol: nativeSymbol,
      p_token_name: nativeName,
      p_decimals: nativeDecimals,
      p_direction: direction,
      p_block_number: payload.block.number,
      p_block_timestamp: payload.block.timestamp,
      p_status: "SUCCESS",
    });
    if (error) {
      console.error(
        `[webhook] upsert_transaction (native ${direction}) failed for ${userAddress}:`,
        error.message
      );
    }
  }

  // ── Normal transactions (txs) — catches direct EOA→EOA ETH sends ──────────
  for (const tx of payload.txs) {
    // receiptStatus can be "1" or "0x1" depending on the Moralis stream version
    if (parseInt(tx.receiptStatus, 16) !== 1) continue;
    const value = tx.value ?? "0";
    if (value === "0" || value === "") continue;

    const from = tx.fromAddress.toLowerCase();
    const to = tx.toAddress?.toLowerCase() ?? "";
    if (!to) continue;

    if (monitoredAddresses.has(from)) {
      await upsertNativeTx(tx.hash, from, to, value, "out", from);
      if (!exactBalanceUpdated.has(from)) {
        const gasCost = (
          BigInt(tx.receiptGasUsed ?? "0") * BigInt(tx.gasPrice ?? "0")
        ).toString();
        const total = (BigInt(value) + BigInt(gasCost)).toString();
        await adjustNativeBalance(from, `-${total}`);
      }
    }

    if (monitoredAddresses.has(to)) {
      await upsertNativeTx(tx.hash, from, to, value, "in", to);
      if (!exactBalanceUpdated.has(to)) {
        await adjustNativeBalance(to, value);
      }
    }
  }

  // ── Internal transactions (txsInternal) ───────────────────────────────────
  for (const tx of payload.txsInternal) {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    const value = tx.value ?? "0";
    if (value === "0" || value === "") continue;

    if (monitoredAddresses.has(from)) {
      await upsertNativeTx(tx.transactionHash, from, to, value, "out", from);
      if (!exactBalanceUpdated.has(from)) {
        await adjustNativeBalance(from, `-${value}`);
      }
    }

    if (monitoredAddresses.has(to)) {
      await upsertNativeTx(tx.transactionHash, from, to, value, "in", to);
      if (!exactBalanceUpdated.has(to)) {
        await adjustNativeBalance(to, value);
      }
    }
  }

  // ── ERC20 transfers ───────────────────────────────────────────────────────
  for (const transfer of payload.erc20Transfers) {
    if (transfer.possibleSpam) continue;

    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    const dbFrom = dbAddressMap.get(from) ?? from;
    const dbTo = dbAddressMap.get(to) ?? to;
    const contract = transfer.contract.toLowerCase();
    const decimals = parseInt(transfer.tokenDecimals, 10);

    if (monitoredAddresses.has(from)) {
      const { error: balErr } = await supabase.rpc("adjust_balance", {
        p_user_address: dbFrom,
        p_chain_id: chainId,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_delta: `-${transfer.value}`,
      });
      if (balErr) {
        console.error(
          `[webhook] adjust_balance (erc20 out) failed for ${dbFrom}:`,
          balErr.message
        );
      }
      const { error: txErr } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: transfer.transactionHash,
        p_chain_id: chainId,
        p_user_address: dbFrom,
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
          `[webhook] upsert_transaction (erc20 out) failed for ${dbFrom}:`,
          txErr.message
        );
      }
    }

    if (monitoredAddresses.has(to)) {
      const { error: balErr } = await supabase.rpc("adjust_balance", {
        p_user_address: dbTo,
        p_chain_id: chainId,
        p_contract_address: contract,
        p_symbol: transfer.tokenSymbol,
        p_token_name: transfer.tokenName,
        p_decimals: decimals,
        p_delta: transfer.value,
      });
      if (balErr) {
        console.error(
          `[webhook] adjust_balance (erc20 in) failed for ${dbTo}:`,
          balErr.message
        );
      }

      const { error: txErr } = await supabase.rpc("upsert_transaction", {
        p_tx_hash: transfer.transactionHash,
        p_chain_id: chainId,
        p_user_address: dbTo,
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
          `[webhook] upsert_transaction (erc20 in) failed for ${dbTo}:`,
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
