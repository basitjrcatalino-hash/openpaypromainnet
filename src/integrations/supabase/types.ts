export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      nft_collections: {
        Row: {
          banner_url: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          floor_price: number
          id: string
          is_featured: boolean
          logo_url: string | null
          name: string
          slug: string
          total_volume: number
          twitter: string | null
          website: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          floor_price?: number
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          name: string
          slug: string
          total_volume?: number
          twitter?: string | null
          website?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          floor_price?: number
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          total_volume?: number
          twitter?: string | null
          website?: string | null
        }
        Relationships: []
      }
      nft_transactions: {
        Row: {
          created_at: string
          from_wallet_id: string | null
          id: string
          nft_id: string
          price: number
          to_wallet_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          from_wallet_id?: string | null
          id?: string
          nft_id: string
          price?: number
          to_wallet_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          from_wallet_id?: string | null
          id?: string
          nft_id?: string
          price?: number
          to_wallet_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "nft_transactions_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nft_transactions_nft_id_fkey"
            columns: ["nft_id"]
            isOneToOne: false
            referencedRelation: "nfts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nft_transactions_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      nfts: {
        Row: {
          collection_id: string | null
          creator_id: string | null
          description: string | null
          id: string
          listed: boolean
          media_type: string
          media_url: string
          minted_at: string
          name: string
          owner_wallet_id: string | null
          price: number
          royalty_bps: number
        }
        Insert: {
          collection_id?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          listed?: boolean
          media_type?: string
          media_url: string
          minted_at?: string
          name: string
          owner_wallet_id?: string | null
          price?: number
          royalty_bps?: number
        }
        Update: {
          collection_id?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          listed?: boolean
          media_type?: string
          media_url?: string
          minted_at?: string
          name?: string
          owner_wallet_id?: string | null
          price?: number
          royalty_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nft_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfts_owner_wallet_id_fkey"
            columns: ["owner_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      pi_payments: {
        Row: {
          approved_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          memo: string | null
          metadata: Json
          ousd_credited: number
          payment_id: string
          pi_amount: number
          status: string
          txid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          metadata?: Json
          ousd_credited?: number
          payment_id: string
          pi_amount: number
          status?: string
          txid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          metadata?: Json
          ousd_credited?: number
          payment_id?: string
          pi_amount?: number
          status?: string
          txid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      token_holdings: {
        Row: {
          balance: number
          id: string
          token_id: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          balance?: number
          id?: string
          token_id: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          balance?: number
          id?: string
          token_id?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_holdings_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          auto_liquidity: boolean
          burnable: boolean
          change_24h: number
          contract_address: string | null
          created_at: string
          creator_id: string | null
          decimals: number
          description: string | null
          id: string
          is_featured: boolean
          logo_url: string | null
          market_cap: number
          mintable: boolean
          name: string
          pausable: boolean
          price_usd: number
          symbol: string
          tax_bps: number
          telegram: string | null
          total_supply: number
          twitter: string | null
          volume_24h: number
          website: string | null
        }
        Insert: {
          auto_liquidity?: boolean
          burnable?: boolean
          change_24h?: number
          contract_address?: string | null
          created_at?: string
          creator_id?: string | null
          decimals?: number
          description?: string | null
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          market_cap?: number
          mintable?: boolean
          name: string
          pausable?: boolean
          price_usd?: number
          symbol: string
          tax_bps?: number
          telegram?: string | null
          total_supply?: number
          twitter?: string | null
          volume_24h?: number
          website?: string | null
        }
        Update: {
          auto_liquidity?: boolean
          burnable?: boolean
          change_24h?: number
          contract_address?: string | null
          created_at?: string
          creator_id?: string | null
          decimals?: number
          description?: string | null
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          market_cap?: number
          mintable?: boolean
          name?: string
          pausable?: boolean
          price_usd?: number
          symbol?: string
          tax_bps?: number
          telegram?: string | null
          total_supply?: number
          twitter?: string | null
          volume_24h?: number
          website?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          id: string
          memo: string | null
          status: Database["public"]["Enums"]["tx_status"]
          token_id: string | null
          token_symbol: string | null
          tx_hash: string | null
          type: Database["public"]["Enums"]["tx_type"]
          usd_value: number
          wallet_id: string
        }
        Insert: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          token_id?: string | null
          token_symbol?: string | null
          tx_hash?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          usd_value?: number
          wallet_id: string
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          id?: string
          memo?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          token_id?: string | null
          token_symbol?: string | null
          tx_hash?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          usd_value?: number
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          currency: string
          language: string
          notifications: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          currency?: string
          language?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          currency?: string
          language?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          ousd_balance: number
          pi_balance: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          ousd_balance?: number
          pi_balance?: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          ousd_balance?: number
          pi_balance?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      tx_status: "pending" | "confirmed" | "failed"
      tx_type: "send" | "receive" | "swap" | "mint" | "buy" | "sell" | "reward"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tx_status: ["pending", "confirmed", "failed"],
      tx_type: ["send", "receive", "swap", "mint", "buy", "sell", "reward"],
    },
  },
} as const
