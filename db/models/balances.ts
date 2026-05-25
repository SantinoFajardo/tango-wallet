import {
  Balance,
  Token,
  CreateBalance,
  UpdateBalance,
} from "../db.interfaces";
import { supabase } from "../supabase";

interface BalanceWithToken extends Balance {
  token: Partial<Token>;
}

class Balances {
  private readonly table = "balances";

  public async getUserBalances(userId: string): Promise<BalanceWithToken[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*, token:tokens(*)")
      .eq("user_id", userId);

    if (error) throw error;
    return (data as BalanceWithToken[]) ?? [];
  }

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
