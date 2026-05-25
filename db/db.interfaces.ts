export interface Balance {
  id: string;
  price_id: string;
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
  contract_address?: string; // can be undefined, native tokens
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
  updated_at: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  updated_at: string;
  created_at: string;
}

export interface Price {
  id: string;
  token_id: string;
  price_usd: number;
  updated_at: string;
  created_at: string;
}
