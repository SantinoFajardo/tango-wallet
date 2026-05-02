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
      balances: {
        Row: {
          id: string;
          user_address: string;
          chain_id: number;
          contract_address: string | null;
          symbol: string;
          token_name: string;
          decimals: number;
          raw_balance: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_address: string;
          chain_id: number;
          contract_address?: string | null;
          symbol?: string;
          token_name?: string;
          decimals?: number;
          raw_balance?: string;
          updated_at?: string;
        };
        Update: {
          symbol?: string;
          token_name?: string;
          decimals?: number;
          raw_balance?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "balances_user_address_fkey";
            columns: ["user_address"];
            referencedRelation: "users";
            referencedColumns: ["address"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          tx_hash: string;
          chain_id: number;
          user_address: string;
          from_address: string;
          to_address: string;
          value_raw: string;
          contract_address: string | null;
          symbol: string;
          token_name: string;
          decimals: number;
          direction: "in" | "out";
          status: "PENDING" | "SUCCESS";
          block_number: string;
          block_timestamp: string;
          gas_used: string | null;
          gas_price: string | null;
          sponsored_gas_wei: string | null;
          sponsored_gas_usd: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tx_hash: string;
          chain_id: number;
          user_address: string;
          from_address: string;
          to_address: string;
          value_raw?: string;
          contract_address?: string | null;
          symbol?: string;
          token_name?: string;
          decimals?: number;
          direction: "in" | "out";
          status?: "PENDING" | "SUCCESS";
          block_number?: string;
          block_timestamp?: string;
          gas_used?: string | null;
          gas_price?: string | null;
          sponsored_gas_wei?: string | null;
          sponsored_gas_usd?: number | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "transactions_user_address_fkey";
            columns: ["user_address"];
            referencedRelation: "users";
            referencedColumns: ["address"];
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
      upsert_balance_exact: {
        Args: {
          p_user_address: string;
          p_chain_id: number;
          p_contract_address: string | null;
          p_symbol: string;
          p_token_name: string;
          p_decimals: number;
          p_raw_balance: string;
        };
        Returns: undefined;
      };
      adjust_balance: {
        Args: {
          p_user_address: string;
          p_chain_id: number;
          p_contract_address: string;
          p_symbol: string;
          p_token_name: string;
          p_decimals: number;
          p_delta: string;
        };
        Returns: undefined;
      };
      upsert_transaction: {
        Args: {
          p_tx_hash: string;
          p_chain_id: number;
          p_user_address: string;
          p_from_address: string;
          p_to_address: string;
          p_value_raw: string;
          p_contract_address: string | null;
          p_symbol: string;
          p_token_name: string;
          p_decimals: number;
          p_direction: "in" | "out";
          p_block_number: string;
          p_block_timestamp: string;
          p_status?: "PENDING" | "SUCCESS";
          p_gas_used?: string | null;
          p_gas_price?: string | null;
          p_sponsored_gas_wei?: string | null;
          p_sponsored_gas_usd?: number | null;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
