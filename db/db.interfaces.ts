export interface Balance {
  id: string;
  price_id: string | null;
  token_id: string;
  user_id: string;
  balance_in_wei: string;
  decimals: number;
  updated_at: string;
  created_at: string;
}

export enum TokenType {
  ERC_20 = "ERC_20",
  NATIVE = "NATIVE",
}

export interface Token {
  id: string;
  chain_id: string;
  name: string;
  symbol: string;
  image_url: string;
  decimals: number;
  token_type: TokenType;
  is_stable: boolean;
  contract_address?: string;
  coingecko_id?: string;
  verified: boolean;
  updated_at: string;
  created_at: string;
}

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  image_url: string;
  chain_id: string;
  chain_number: number;
  rpc_url?: string;
  explorer_url?: string;
  is_testnet: boolean;
  updated_at: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  display_name?: string;
  avatar_url?: string;
  updated_at: string;
  created_at: string;
}

export interface Price {
  id: string;
  token_id: string;
  price_usd: number;
  price_change_24h?: number;
  source?: string;
  updated_at: string;
  created_at: string;
}

export enum TxStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  FAILED = "failed",
}

export interface Transaction {
  id: string;
  user_id: string;
  token_id: string;
  chain_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount_in_wei: string;
  status: TxStatus;
  user_op_hash?: string;
  paymaster?: string;
  gas_used?: string;
  block_number?: number;
  updated_at: string;
  created_at: string;
}

// ─── Utility types ────────────────────────────────────────────────────────────

type OmitAuto<T> = Omit<T, "id" | "created_at" | "updated_at">;

export type CreateBalance = OmitAuto<Balance>;
export type UpdateBalance = Partial<CreateBalance>;

export type CreateToken = OmitAuto<Token>;
export type UpdateToken = Partial<CreateToken>;

export type CreateChain = OmitAuto<Chain>;
export type UpdateChain = Partial<CreateChain>;

export type CreateUser = OmitAuto<User>;
export type UpdateUser = Partial<CreateUser>;

export type CreatePrice = OmitAuto<Price>;
export type UpdatePrice = Partial<CreatePrice>;

export type CreateTransaction = OmitAuto<Transaction>;
export type UpdateTransaction = Partial<CreateTransaction>;
