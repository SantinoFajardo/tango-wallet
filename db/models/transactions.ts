import {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  TxStatus,
} from "../db.interfaces";
import { supabase } from "../supabase";

interface TransactionWithRelations extends Transaction {
  token: { name: string; symbol: string; image_url: string; decimals: number };
  chain: { name: string; symbol: string; explorer_url?: string };
}

class Transactions {
  private readonly table = "transactions";

  public async getById(id: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getByHash(txHash: string): Promise<Transaction | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  public async getUserTransactions(
    userId: string,
    limit = 50
  ): Promise<TransactionWithRelations[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select(
        `*, token:tokens(name, symbol, image_url, decimals), chain:chains(name, symbol, explorer_url)`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as TransactionWithRelations[]) ?? [];
  }

  public async getUserTransactionsByStatus(
    userId: string,
    status: TxStatus
  ): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  public async getPendingTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("status", TxStatus.PENDING)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  public async create(payload: CreateTransaction): Promise<Transaction> {
    const { data, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async update(
    id: string,
    payload: UpdateTransaction
  ): Promise<Transaction> {
    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async updateStatus(id: string, status: TxStatus): Promise<Transaction> {
    return this.update(id, { status });
  }

  public async updateByHash(
    txHash: string,
    payload: UpdateTransaction
  ): Promise<Transaction> {
    const { data, error } = await supabase
      .from(this.table)
      .update(payload)
      .eq("tx_hash", txHash)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Idempotent insert — silently ignores duplicate tx_hash entries
  public async upsertByHash(payload: CreateTransaction): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .upsert(payload, { onConflict: "tx_hash" });

    if (error) throw error;
  }

  public async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);
    if (error) throw error;
  }
}

export const transactions = new Transactions();
