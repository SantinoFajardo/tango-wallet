import { Price, CreatePrice, UpdatePrice } from "../db.interfaces";
import { supabase } from "../supabase";

class Prices {
  private readonly table = "prices";

  public async getById(id: string): Promise<Price | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getLatestByTokenId(tokenId: string): Promise<Price | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("token_id", tokenId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getHistoryByTokenId(
    tokenId: string,
    limit = 100
  ): Promise<Price[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("token_id", tokenId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  public async getLatestForTokens(tokenIds: string[]): Promise<Price[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .in("token_id", tokenIds)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Keep only the latest price per token
    const seen = new Set<string>();
    return (data ?? []).filter((p) => {
      if (seen.has(p.token_id)) return false;
      seen.add(p.token_id);
      return true;
    });
  }

  public async create(payload: CreatePrice): Promise<Price> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(id: string, payload: UpdatePrice): Promise<Price> {
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

export const prices = new Prices();
