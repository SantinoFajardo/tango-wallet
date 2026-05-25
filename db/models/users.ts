import { User, CreateUser, UpdateUser } from "../db.interfaces";
import { supabase } from "../supabase";

class Users {
  private readonly table = "users";

  public async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getByWalletAddress(walletAddress: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async create(payload: CreateUser): Promise<User> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(id: string, payload: UpdateUser): Promise<User> {
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

export const users = new Users();
