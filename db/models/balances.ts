import { Balance, Token } from "../db.interfaces";
import { supabase } from "../supabase";

interface UserBalancesResponse extends Balance {
  token: Partial<Token>;
}

class Balances {
  constructor() {}

  public async getUserBalances(
    userId: string
  ): Promise<UserBalancesResponse[]> {
    const { data, error } = await supabase
      .from("balances")
      .select(`*, token:tokens(*)`)
      .eq("user_id", userId);

    if (error) throw error;
    return (data as UserBalancesResponse[]) ?? [];
  }

  public async getUserTokenBalances(
    userId: string,
    tokenId: string
  ): Promise<UserBalancesResponse | null> {
    const { data, error } = await supabase
      .from("balances")
      .select(`*, token:tokens(*)`)
      .eq("user_id", userId)
      .eq("token_id", tokenId)
      .maybeSingle();

    if (error) throw error;
    return data as UserBalancesResponse | null;
  }
}

export const balances = new Balances();
