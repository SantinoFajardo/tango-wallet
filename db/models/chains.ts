import { Chain, CreateChain, UpdateChain } from "../db.interfaces";
import { supabase } from "../supabase";

class Chains {
  private readonly table = "chains";

  public async getAll(): Promise<Chain[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .order("chain_number", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async getById(id: string): Promise<Chain | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getByChainId(chainId: string): Promise<Chain | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("chain_id", chainId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getMainnets(): Promise<Chain[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("is_testnet", false)
      .order("chain_number", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async create(payload: CreateChain): Promise<Chain> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(id: string, payload: UpdateChain): Promise<Chain> {
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

export const chains = new Chains();
