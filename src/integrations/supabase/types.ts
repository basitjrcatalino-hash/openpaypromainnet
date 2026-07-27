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
      ledger_api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          label: string
          last_used_at: string | null
          prefix: string
          scopes: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          label: string
          last_used_at?: string | null
          prefix: string
          scopes?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          label?: string
          last_used_at?: string | null
          prefix?: string
          scopes?: string[]
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          asset: string | null
          created_at: string
          from_address: string | null
          id: string
          memo: string | null
          occurred_at: string
          sequence: number
          status: string
          to_address: string | null
          tx_hash: string | null
          tx_id: string | null
          type: string
          usd_value: number
          wallet_id: string | null
        }
        Insert: {
          amount?: number
          asset?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          memo?: string | null
          occurred_at?: string
          sequence?: number
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          tx_id?: string | null
          type: string
          usd_value?: number
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          asset?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          memo?: string | null
          occurred_at?: string
          sequence?: number
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          tx_id?: string | null
          type?: string
          usd_value?: number
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
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
      pi_a2u_transactions: {
        Row: {
          amount: number
          created_at: string
          error: string | null
          id: number
          memo: string | null
          payment_id: string
          status: string
          txid: string | null
          uid: string
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          error?: string | null
          id?: number
          memo?: string | null
          payment_id: string
          status?: string
          txid?: string | null
          uid: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          error?: string | null
          id?: number
          memo?: string | null
          payment_id?: string
          status?: string
          txid?: string | null
          uid?: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
      pi_a2u_wallets: {
        Row: {
          amount: number | null
          created_at: string
          id: number
          payment_id: string | null
          txid: string | null
          uid: string
          username: string | null
          wallet_address: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: number
          payment_id?: string | null
          txid?: string | null
          uid: string
          username?: string | null
          wallet_address: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: number
          payment_id?: string | null
          txid?: string | null
          uid?: string
          username?: string | null
          wallet_address?: string
        }
        Relationships: []
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
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at: string | null
          kyc_verification_id: string | null
          kyc_verified_at: string | null
          pi_uid: string | null
          pi_username: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at?: string | null
          kyc_verification_id?: string | null
          kyc_verified_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at?: string | null
          kyc_verification_id?: string | null
          kyc_verified_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          updated_at?: string
          username?: string | null
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
          banner_url: string | null
          burnable: boolean
          category: Database["public"]["Enums"]["ot_token_category"] | null
          change_24h: number
          contract_address: string | null
          created_at: string
          creator_id: string | null
          curve_reserve_pi: number
          curve_supply_sold: number
          curve_virtual_pi: number
          curve_virtual_tokens: number
          decimals: number
          description: string | null
          discord: string | null
          graduated_at: string | null
          graduation_target_pi: number
          holder_count: number
          id: string
          is_featured: boolean
          is_hidden: boolean
          is_verified: boolean
          launch_fee_pi: number
          logo_url: string | null
          market_cap: number
          mintable: boolean
          name: string
          pausable: boolean
          price_usd: number
          report_count: number
          status: Database["public"]["Enums"]["ot_token_status"]
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
          banner_url?: string | null
          burnable?: boolean
          category?: Database["public"]["Enums"]["ot_token_category"] | null
          change_24h?: number
          contract_address?: string | null
          created_at?: string
          creator_id?: string | null
          curve_reserve_pi?: number
          curve_supply_sold?: number
          curve_virtual_pi?: number
          curve_virtual_tokens?: number
          decimals?: number
          description?: string | null
          discord?: string | null
          graduated_at?: string | null
          graduation_target_pi?: number
          holder_count?: number
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          launch_fee_pi?: number
          logo_url?: string | null
          market_cap?: number
          mintable?: boolean
          name: string
          pausable?: boolean
          price_usd?: number
          report_count?: number
          status?: Database["public"]["Enums"]["ot_token_status"]
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
          banner_url?: string | null
          burnable?: boolean
          category?: Database["public"]["Enums"]["ot_token_category"] | null
          change_24h?: number
          contract_address?: string | null
          created_at?: string
          creator_id?: string | null
          curve_reserve_pi?: number
          curve_supply_sold?: number
          curve_virtual_pi?: number
          curve_virtual_tokens?: number
          decimals?: number
          description?: string | null
          discord?: string | null
          graduated_at?: string | null
          graduation_target_pi?: number
          holder_count?: number
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          is_verified?: boolean
          launch_fee_pi?: number
          logo_url?: string | null
          market_cap?: number
          mintable?: boolean
          name?: string
          pausable?: boolean
          price_usd?: number
          report_count?: number
          status?: Database["public"]["Enums"]["ot_token_status"]
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
      ot_trades: {
        Row: {
          created_at: string
          id: string
          pi_amount: number
          price: number
          side: Database["public"]["Enums"]["ot_trade_side"]
          token_amount: number
          token_id: string
          tx_ref: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pi_amount: number
          price: number
          side: Database["public"]["Enums"]["ot_trade_side"]
          token_amount: number
          token_id: string
          tx_ref?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pi_amount?: number
          price?: number
          side?: Database["public"]["Enums"]["ot_trade_side"]
          token_amount?: number
          token_id?: string
          tx_ref?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: []
      }
      ot_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          token_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          token_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          token_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ot_favorites: {
        Row: {
          created_at: string
          token_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          token_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ot_follows: {
        Row: {
          created_at: string
          creator_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      ot_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["ot_report_status"]
          token_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ot_report_status"]
          token_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["ot_report_status"]
          token_id?: string
        }
        Relationships: []
      }
      ot_notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ot_price_ticks: {
        Row: {
          created_at: string
          id: string
          market_cap: number
          price: number
          token_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_cap?: number
          price: number
          token_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_cap?: number
          price?: number
          token_id?: string
        }
        Relationships: []
      }
      topup_settings: {
        Row: {
          id: number
          instructions: string | null
          openpay_payment_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          instructions?: string | null
          openpay_payment_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          instructions?: string | null
          openpay_payment_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      topup_vouchers: {
        Row: {
          amount_ousd: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
        }
        Insert: {
          amount_ousd: number
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
        }
        Update: {
          amount_ousd?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
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
          biometric_enabled: boolean
          currency: string
          language: string
          notifications: Json
          pin_hash: string | null
          recovery_backed_up: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          biometric_enabled?: boolean
          currency?: string
          language?: string
          notifications?: Json
          pin_hash?: string | null
          recovery_backed_up?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          biometric_enabled?: boolean
          currency?: string
          language?: string
          notifications?: Json
          pin_hash?: string | null
          recovery_backed_up?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      backfill_ledger_entries: { Args: never; Returns: Json }
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_user_pin: { Args: never; Returns: boolean }
      ot_execute_trade: {
        Args: {
          p_token_id: string
          p_wallet_id: string
          p_side: Database["public"]["Enums"]["ot_trade_side"]
          p_pi_amount?: number | null
          p_token_amount?: number | null
        }
        Returns: Json
      }
      verify_user_pin: { Args: { _pin_hash: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      kyc_status:
        | "not_started"
        | "pending"
        | "in_review"
        | "verified"
        | "rejected"
      ot_report_status: "open" | "reviewed" | "dismissed" | "actioned"
      ot_token_category:
        | "meme"
        | "ai"
        | "gaming"
        | "utility"
        | "defi"
        | "nft"
        | "community"
      ot_token_status: "curve" | "graduated" | "halted"
      ot_trade_side: "buy" | "sell"
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
      app_role: ["admin", "moderator", "user"],
      kyc_status: [
        "not_started",
        "pending",
        "in_review",
        "verified",
        "rejected",
      ],
      tx_status: ["pending", "confirmed", "failed"],
      tx_type: ["send", "receive", "swap", "mint", "buy", "sell", "reward"],
    },
  },
} as const
