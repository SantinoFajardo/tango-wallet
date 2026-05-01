export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          address: string;
          login_method: string;
          created_at: string;
          updated_at: string;
          total_sponsored_gas_wei: string;
          total_sponsored_gas_usd: number;
          tx_count: number;
        };
        Insert: {
          address: string;
          login_method?: string;
          created_at?: string;
          updated_at?: string;
          total_sponsored_gas_wei?: string;
          total_sponsored_gas_usd?: number;
          tx_count?: number;
        };
        Update: {
          login_method?: string;
          updated_at?: string;
          total_sponsored_gas_wei?: string;
          total_sponsored_gas_usd?: number;
          tx_count?: number;
        };
        Relationships: [];
      };
      sponsored_transactions: {
        Row: {
          id: string;
          user_address: string;
          tx_hash: string;
          chain_id: number;
          gas_used: string;
          gas_price: string;
          sponsored_gas_wei: string;
          sponsored_gas_usd: number;
          token_symbol: string;
          receiver_address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_address: string;
          tx_hash: string;
          chain_id: number;
          gas_used?: string;
          gas_price?: string;
          sponsored_gas_wei?: string;
          sponsored_gas_usd?: number;
          token_symbol?: string;
          receiver_address?: string;
          created_at?: string;
        };
        Update: {
          sponsored_gas_usd?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sponsored_transactions_user_address_fkey";
            columns: ["user_address"];
            referencedRelation: "users";
            referencedColumns: ["address"];
          },
        ];
      };
    };
      chains: {
        Row: {
          id: string;
          name: string;
          chain_id: number;
          image_url: string;
          explorer_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          chain_id: number;
          image_url?: string;
          explorer_url?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          image_url?: string;
          explorer_url?: string;
        };
        Relationships: [];
      };
      tokens: {
        Row: {
          id: string;
          name: string;
          symbol: string;
          chain_id: number;
          contract_address: string | null;
          image_url: string;
          decimals: number;
          is_native: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          symbol: string;
          chain_id: number;
          contract_address?: string | null;
          image_url?: string;
          decimals?: number;
          is_native?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          symbol?: string;
          image_url?: string;
          decimals?: number;
          is_native?: boolean;
          contract_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tokens_chain_id_fkey";
            columns: ["chain_id"];
            referencedRelation: "chains";
            referencedColumns: ["chain_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_user: {
        Args: { p_address: string; p_login_method: string };
        Returns: undefined;
      };
      increment_user_gas: {
        Args: { p_address: string; p_gas_wei: string; p_gas_usd: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
