import {
  Balance,
  Token,
  TokenType,
  CreateBalance,
  UpdateBalance,
} from "../db.interfaces";
import { supabase } from "../supabase";
import { getMoralis } from "../moralis";

export interface BalanceWithToken extends Balance {
  token: Partial<Token> & {
    chain?: { chain_number: number; chain_id: string };
  };
}

class Balances {
  private readonly table = "balances";

  public async getUserBalances(
    userId: string,
    refreshBalances = false
  ): Promise<BalanceWithToken[]> {
    const dbBalances = await this.fetchFromDb(userId);

    if (!refreshBalances) return dbBalances;

    const user = await this.fetchUser(userId);
    if (!user?.wallet_address) return dbBalances;

    await this.syncFromChain(userId, user.wallet_address, dbBalances);

    return this.fetchFromDb(userId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchFromDb(userId: string): Promise<BalanceWithToken[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*, token:tokens(*, chain:chains(chain_number, chain_id))")
      .eq("user_id", userId);

    if (error) throw error;
    return (data as BalanceWithToken[]) ?? [];
  }

  private async fetchUser(
    userId: string
  ): Promise<{ wallet_address?: string } | null> {
    const { data, error } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  private async syncFromChain(
    _userId: string,
    walletAddress: string,
    dbBalances: BalanceWithToken[]
  ): Promise<void> {
    const Moralis = await getMoralis();

    // Group DB balances by chain so we make one Moralis call per chain
    const byChain = new Map<number, BalanceWithToken[]>();
    for (const b of dbBalances) {
      const chainNumber = b.token?.chain?.chain_number;
      if (chainNumber == null) continue;
      if (!byChain.has(chainNumber)) byChain.set(chainNumber, []);
      byChain.get(chainNumber)!.push(b);
    }

    const updates: Promise<void>[] = [];

    for (const [chainNumber, chainBalances] of byChain) {
      const chain = `0x${chainNumber.toString(16)}`;

      // Fetch ERC20 and native balances concurrently per chain
      const [erc20Res, nativeRes] = await Promise.all([
        Moralis.EvmApi.token
          .getWalletTokenBalances({ chain, address: walletAddress })
          .catch(() => null),
        Moralis.EvmApi.balance
          .getNativeBalance({ chain, address: walletAddress })
          .catch(() => null),
      ]);

      // Build a lookup map: contract_address (lowercase) → on-chain balance string
      const onChainMap = new Map<string, string>();

      for (const item of erc20Res?.result ?? []) {
        if (!item.token) continue;
        onChainMap.set(item.token.contractAddress.lowercase, item.value);
      }

      const nativeBalance = nativeRes?.result?.balance?.toString() ?? null;

      for (const dbBalance of chainBalances) {
        const token = dbBalance.token;
        let onChainWei: string | null = null;

        if (token.token_type === TokenType.NATIVE) {
          onChainWei = nativeBalance;
        } else if (token.contract_address) {
          onChainWei =
            onChainMap.get(token.contract_address.toLowerCase()) ?? null;
        }

        if (onChainWei === null) continue;
        if (onChainWei === dbBalance.balance_in_wei) continue;

        // Balance differs — update DB
        updates.push(
          this.update(dbBalance.id, { balance_in_wei: onChainWei }).then(
            () => {}
          )
        );
      }
    }

    await Promise.all(updates);
  }

  // ─── Public CRUD ────────────────────────────────────────────────────────────

  public async getUserTokenBalance(
    userId: string,
    tokenId: string
  ): Promise<BalanceWithToken | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*, token:tokens(*)")
      .eq("user_id", userId)
      .eq("token_id", tokenId)
      .maybeSingle();

    if (error) throw error;
    return data as BalanceWithToken | null;
  }

  public async getById(id: string): Promise<Balance | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async create(payload: CreateBalance): Promise<Balance> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(id: string, payload: UpdateBalance): Promise<Balance> {
    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async upsert(payload: CreateBalance): Promise<Balance> {
    const { data, error } = await supabase
      .from(this.table)
      .upsert(payload, { onConflict: "user_id,token_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);
    if (error) throw error;
  }
}

export const balances = new Balances();
