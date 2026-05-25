import { Token, CreateToken, UpdateToken } from "../db.interfaces";
import { supabase } from "../supabase";

class Tokens {
  private readonly table = "tokens";

  public async getAll(): Promise<Token[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async getById(id: string): Promise<Token | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getByChain(chainId: string): Promise<Token[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("chain_id", chainId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async getByContractAddress(
    chainId: string,
    contractAddress: string
  ): Promise<Token | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("chain_id", chainId)
      .eq("contract_address", contractAddress)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getNativeByChain(chainId: string): Promise<Token | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("chain_id", chainId)
      .eq("token_type", "NATIVE")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Returns a Map keyed by lowercase contract_address for O(1) lookups
  public async getByContracts(
    chainId: string,
    contractAddresses: string[]
  ): Promise<Map<string, Token>> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("chain_id", chainId)
      .in("contract_address", contractAddresses);

    if (error) throw error;

    const map = new Map<string, Token>();
    for (const token of data ?? []) {
      if (token.contract_address) {
        map.set(token.contract_address.toLowerCase(), token);
      }
    }
    return map;
  }

  public async getStablecoins(): Promise<Token[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("is_stable", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async getVerified(): Promise<Token[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("verified", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async create(payload: CreateToken): Promise<Token> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(id: string, payload: UpdateToken): Promise<Token> {
    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq("id", id)
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

export const tokens = new Tokens();
