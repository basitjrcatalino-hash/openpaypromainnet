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
      account_transfer_events: {
        Row: {
          amount: number
          asset: string
          created_at: string
          from_account: string
          id: string
          to_account: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          asset: string
          created_at?: string
          from_account: string
          id?: string
          to_account: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          from_account?: string
          id?: string
          to_account?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfer_events_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      banxa_topup_orders: {
        Row: {
          banxa_order_id: string | null
          checkout_url: string | null
          created_at: string
          credited: boolean
          external_order_id: string
          fiat_amount: number
          fiat_currency: string
          id: string
          method_key: string
          payment_method_id: string
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          banxa_order_id?: string | null
          checkout_url?: string | null
          created_at?: string
          credited?: boolean
          external_order_id: string
          fiat_amount: number
          fiat_currency?: string
          id?: string
          method_key: string
          payment_method_id: string
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          banxa_order_id?: string | null
          checkout_url?: string | null
          created_at?: string
          credited?: boolean
          external_order_id?: string
          fiat_amount?: number
          fiat_currency?: string
          id?: string
          method_key?: string
          payment_method_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banxa_topup_orders_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_mint_deposits: {
        Row: {
          chain: string
          circle_payment_id: string | null
          created_at: string
          currency: string
          deposit_address: string | null
          expected_amount: number
          id: string
          payment_intent_id: string
          raw_intent: Json | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          chain?: string
          circle_payment_id?: string | null
          created_at?: string
          currency?: string
          deposit_address?: string | null
          expected_amount: number
          id?: string
          payment_intent_id: string
          raw_intent?: Json | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          chain?: string
          circle_payment_id?: string | null
          created_at?: string
          currency?: string
          deposit_address?: string | null
          expected_amount?: number
          id?: string
          payment_intent_id?: string
          raw_intent?: Json | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_mint_deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_transactions: {
        Row: {
          amount: number
          created_at: string
          direction: string
          id: string
          network: string
          provider_tx_id: string | null
          status: string
          token: string
          tx_hash: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          direction: string
          id?: string
          network: string
          provider_tx_id?: string | null
          status?: string
          token?: string
          tx_hash?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          id?: string
          network?: string
          provider_tx_id?: string | null
          status?: string
          token?: string
          tx_hash?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "crypto_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_wallets: {
        Row: {
          address: string
          blockchain: string
          circle_wallet_id: string | null
          created_at: string
          id: string
          provider: string
          status: string
          user_id: string
          wallet_set_id: string | null
        }
        Insert: {
          address: string
          blockchain?: string
          circle_wallet_id?: string | null
          created_at?: string
          id?: string
          provider?: string
          status?: string
          user_id: string
          wallet_set_id?: string | null
        }
        Update: {
          address?: string
          blockchain?: string
          circle_wallet_id?: string | null
          created_at?: string
          id?: string
          provider?: string
          status?: string
          user_id?: string
          wallet_set_id?: string | null
        }
        Relationships: []
      }
      deposit_addresses: {
        Row: {
          address: string
          chain_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          memo_tag: string | null
          token_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          chain_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          memo_tag?: string | null
          token_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          chain_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          memo_tag?: string | null
          token_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_addresses_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "deposit_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_addresses_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "deposit_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          deposit_id: string | null
          detail: Json
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          deposit_id?: string | null
          detail?: Json
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          deposit_id?: string | null
          detail?: Json
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_audit_logs_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_chains: {
        Row: {
          bridge_status: string
          chain_id: number | null
          created_at: string
          explorer_url: string | null
          family: string
          id: string
          is_enabled: boolean
          key: string
          logo_url: string | null
          maintenance_mode: boolean
          name: string
          required_confirmations: number
          rpc_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bridge_status?: string
          chain_id?: number | null
          created_at?: string
          explorer_url?: string | null
          family?: string
          id?: string
          is_enabled?: boolean
          key: string
          logo_url?: string | null
          maintenance_mode?: boolean
          name: string
          required_confirmations?: number
          rpc_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bridge_status?: string
          chain_id?: number | null
          created_at?: string
          explorer_url?: string | null
          family?: string
          id?: string
          is_enabled?: boolean
          key?: string
          logo_url?: string | null
          maintenance_mode?: boolean
          name?: string
          required_confirmations?: number
          rpc_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      deposit_tokens: {
        Row: {
          chain_id: string
          contract_address: string | null
          created_at: string
          credit_symbol: string
          decimals: number
          deposit_enabled: boolean
          deposit_fee_bps: number
          id: string
          logo_url: string | null
          max_deposit: number | null
          min_deposit: number
          name: string
          sort_order: number
          status: string
          symbol: string
          updated_at: string
          usd_rate: number | null
          withdrawal_enabled: boolean
        }
        Insert: {
          chain_id: string
          contract_address?: string | null
          created_at?: string
          credit_symbol?: string
          decimals?: number
          deposit_enabled?: boolean
          deposit_fee_bps?: number
          id?: string
          logo_url?: string | null
          max_deposit?: number | null
          min_deposit?: number
          name: string
          sort_order?: number
          status?: string
          symbol: string
          updated_at?: string
          usd_rate?: number | null
          withdrawal_enabled?: boolean
        }
        Update: {
          chain_id?: string
          contract_address?: string | null
          created_at?: string
          credit_symbol?: string
          decimals?: number
          deposit_enabled?: boolean
          deposit_fee_bps?: number
          id?: string
          logo_url?: string | null
          max_deposit?: number | null
          min_deposit?: number
          name?: string
          sort_order?: number
          status?: string
          symbol?: string
          updated_at?: string
          usd_rate?: number | null
          withdrawal_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "deposit_tokens_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "deposit_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          block_number: number | null
          chain_id: string | null
          chain_key: string
          confirmations: number
          confirmed_at: string | null
          created_at: string
          credited_amount: number
          credited_at: string | null
          detected_at: string
          error: string | null
          fee_amount: number
          from_address: string | null
          id: string
          ledger_entry_id: string | null
          required_confirmations: number
          status: string
          to_address: string
          token_id: string | null
          token_symbol: string
          transaction_id: string | null
          tx_hash: string
          updated_at: string
          usd_value: number
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          block_number?: number | null
          chain_id?: string | null
          chain_key: string
          confirmations?: number
          confirmed_at?: string | null
          created_at?: string
          credited_amount?: number
          credited_at?: string | null
          detected_at?: string
          error?: string | null
          fee_amount?: number
          from_address?: string | null
          id?: string
          ledger_entry_id?: string | null
          required_confirmations?: number
          status?: string
          to_address: string
          token_id?: string | null
          token_symbol: string
          transaction_id?: string | null
          tx_hash: string
          updated_at?: string
          usd_value?: number
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          block_number?: number | null
          chain_id?: string | null
          chain_key?: string
          confirmations?: number
          confirmed_at?: string | null
          created_at?: string
          credited_amount?: number
          credited_at?: string | null
          detected_at?: string
          error?: string | null
          fee_amount?: number
          from_address?: string | null
          id?: string
          ledger_entry_id?: string | null
          required_confirmations?: number
          status?: string
          to_address?: string
          token_id?: string | null
          token_symbol?: string
          transaction_id?: string | null
          tx_hash?: string
          updated_at?: string
          usd_value?: number
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "deposit_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "deposit_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      global_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "ot_comments_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ot_favorites_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ot_price_ticks_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "ot_reports_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_token_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          token_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          token_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          token_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_token_chat_messages_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_trade_cooldown: {
        Row: {
          last_trade_at: string
          user_id: string
        }
        Insert: {
          last_trade_at?: string
          user_id: string
        }
        Update: {
          last_trade_at?: string
          user_id?: string
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
        Relationships: [
          {
            foreignKeyName: "ot_trades_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_trades_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ousd_withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          destination_address: string
          destination_kind: string | null
          display_name: string | null
          fee_bps: number
          fee_ousd: number
          id: string
          net_ousd: number
          note: string | null
          payout_tx_hash: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          treasury_address: string
          treasury_wallet_id: string | null
          updated_at: string
          user_id: string
          username: string | null
          wallet_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          destination_address: string
          destination_kind?: string | null
          display_name?: string | null
          fee_bps?: number
          fee_ousd?: number
          id?: string
          net_ousd: number
          note?: string | null
          payout_tx_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          treasury_address?: string
          treasury_wallet_id?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          wallet_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          destination_address?: string
          destination_kind?: string | null
          display_name?: string | null
          fee_bps?: number
          fee_ousd?: number
          id?: string
          net_ousd?: number
          note?: string | null
          payout_tx_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          treasury_address?: string
          treasury_wallet_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ousd_withdrawals_treasury_wallet_id_fkey"
            columns: ["treasury_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ousd_withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_ads: {
        Row: {
          asset: string
          available_amount: number
          created_at: string
          id: string
          max_order: number
          min_order: number
          pay_time_limit_minutes: number
          payment_methods: string[]
          price_usd: number
          side: Database["public"]["Enums"]["p2p_ad_side"]
          status: Database["public"]["Enums"]["p2p_ad_status"]
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset?: string
          available_amount: number
          created_at?: string
          id?: string
          max_order: number
          min_order?: number
          pay_time_limit_minutes?: number
          payment_methods?: string[]
          price_usd: number
          side?: Database["public"]["Enums"]["p2p_ad_side"]
          status?: Database["public"]["Enums"]["p2p_ad_status"]
          terms?: string | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          available_amount?: number
          created_at?: string
          id?: string
          max_order?: number
          min_order?: number
          pay_time_limit_minutes?: number
          payment_methods?: string[]
          price_usd?: number
          side?: Database["public"]["Enums"]["p2p_ad_side"]
          status?: Database["public"]["Enums"]["p2p_ad_status"]
          terms?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_disputes: {
        Row: {
          created_at: string
          id: string
          moderator_id: string | null
          opened_by: string
          order_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["p2p_dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          moderator_id?: string | null
          opened_by: string
          order_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["p2p_dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          moderator_id?: string | null
          opened_by?: string
          order_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["p2p_dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_merchant_applications: {
        Row: {
          admin_note: string | null
          applicant_note: string | null
          checklist_snapshot: Json
          created_at: string
          id: string
          merchant_name: string | null
          merchant_region: string | null
          requested_tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["p2p_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          applicant_note?: string | null
          checklist_snapshot?: Json
          created_at?: string
          id?: string
          merchant_name?: string | null
          merchant_region?: string | null
          requested_tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["p2p_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          applicant_note?: string | null
          checklist_snapshot?: Json
          created_at?: string
          id?: string
          merchant_name?: string | null
          merchant_region?: string | null
          requested_tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["p2p_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_merchant_milestone_claims: {
        Row: {
          bonus_ousd: number
          claimed_at: string
          completed_orders: number
          milestone_id: string
          user_id: string
        }
        Insert: {
          bonus_ousd: number
          claimed_at?: string
          completed_orders: number
          milestone_id: string
          user_id: string
        }
        Update: {
          bonus_ousd?: number
          claimed_at?: string
          completed_orders?: number
          milestone_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_merchant_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "p2p_merchant_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_merchant_milestones: {
        Row: {
          bonus_ousd: number
          id: string
          is_active: boolean
          label: string
          order_count: number
          sort_order: number
        }
        Insert: {
          bonus_ousd: number
          id: string
          is_active?: boolean
          label: string
          order_count: number
          sort_order?: number
        }
        Update: {
          bonus_ousd?: number
          id?: string
          is_active?: boolean
          label?: string
          order_count?: number
          sort_order?: number
        }
        Relationships: []
      }
      p2p_merchants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          badge_label: string | null
          created_at: string
          featured_until: string | null
          is_featured: boolean
          merchant_name: string | null
          merchant_region: string | null
          notes: string | null
          tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          updated_at: string
          user_id: string
          verified_badge_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          badge_label?: string | null
          created_at?: string
          featured_until?: string | null
          is_featured?: boolean
          merchant_name?: string | null
          merchant_region?: string | null
          notes?: string | null
          tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
          updated_at?: string
          user_id: string
          verified_badge_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          badge_label?: string | null
          created_at?: string
          featured_until?: string | null
          is_featured?: boolean
          merchant_name?: string | null
          merchant_region?: string | null
          notes?: string | null
          tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
          updated_at?: string
          user_id?: string
          verified_badge_at?: string | null
        }
        Relationships: []
      }
      p2p_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          is_system: boolean
          order_id: string
          sender_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_system?: boolean
          order_id: string
          sender_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_system?: boolean
          order_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_orders: {
        Row: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        Insert: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at?: string | null
          created_at?: string
          escrow_status?: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash?: string | null
          expires_at: string
          fiat_currency?: string
          id?: string
          paid_at?: string | null
          payment_account_id?: string | null
          payment_account_snapshot?: Json | null
          payment_method: string
          payment_proof_url?: string | null
          price_usd: number
          ref?: string
          release_tx_hash?: string | null
          released_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at?: string
        }
        Update: {
          ad_id?: string
          amount?: number
          asset?: string
          buyer_id?: string
          cancelled_at?: string | null
          created_at?: string
          escrow_status?: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash?: string | null
          expires_at?: string
          fiat_currency?: string
          id?: string
          paid_at?: string | null
          payment_account_id?: string | null
          payment_account_snapshot?: Json | null
          payment_method?: string
          payment_proof_url?: string | null
          price_usd?: number
          ref?: string
          release_tx_hash?: string | null
          released_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_orders_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "p2p_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_orders_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "p2p_payment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_payment_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string | null
          created_at: string
          extra: Json
          id: string
          is_active: boolean
          method_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name?: string | null
          created_at?: string
          extra?: Json
          id?: string
          is_active?: boolean
          method_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string | null
          created_at?: string
          extra?: Json
          id?: string
          is_active?: boolean
          method_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_payment_accounts_method_code_fkey"
            columns: ["method_code"]
            isOneToOne: false
            referencedRelation: "p2p_payment_methods"
            referencedColumns: ["code"]
          },
        ]
      }
      p2p_payment_methods: {
        Row: {
          code: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          keywords: string
          name: string
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          keywords?: string
          name: string
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          keywords?: string
          name?: string
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      p2p_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          ratee_id: string
          rater_id: string
          score: number
          tags: string[]
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          ratee_id: string
          rater_id: string
          score: number
          tags?: string[]
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          ratee_id?: string
          rater_id?: string
          score?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "p2p_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "p2p_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          invoice_id: string | null
          merchant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          invoice_id?: string | null
          merchant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          invoice_id?: string | null
          merchant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "payment_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "payment_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_invoices: {
        Row: {
          amount_usd: number
          block_number: number | null
          chain_id: string | null
          chain_key: string | null
          confirmations: number
          created_at: string
          customer_email: string | null
          description: string | null
          detected_at: string | null
          error: string | null
          expires_at: string | null
          from_address: string | null
          id: string
          ledger_entry_id: string | null
          merchant_id: string
          metadata: Json
          paid_at: string | null
          pay_to_address: string | null
          public_token: string
          reference: string | null
          required_confirmations: number
          status: string
          token_amount: number | null
          token_id: string | null
          token_symbol: string | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount_usd: number
          block_number?: number | null
          chain_id?: string | null
          chain_key?: string | null
          confirmations?: number
          created_at?: string
          customer_email?: string | null
          description?: string | null
          detected_at?: string | null
          error?: string | null
          expires_at?: string | null
          from_address?: string | null
          id?: string
          ledger_entry_id?: string | null
          merchant_id: string
          metadata?: Json
          paid_at?: string | null
          pay_to_address?: string | null
          public_token: string
          reference?: string | null
          required_confirmations?: number
          status?: string
          token_amount?: number | null
          token_id?: string | null
          token_symbol?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          block_number?: number | null
          chain_id?: string | null
          chain_key?: string | null
          confirmations?: number
          created_at?: string
          customer_email?: string | null
          description?: string | null
          detected_at?: string | null
          error?: string | null
          expires_at?: string | null
          from_address?: string | null
          id?: string
          ledger_entry_id?: string | null
          merchant_id?: string
          metadata?: Json
          paid_at?: string | null
          pay_to_address?: string | null
          public_token?: string
          reference?: string | null
          required_confirmations?: number
          status?: string
          token_amount?: number | null
          token_id?: string | null
          token_symbol?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoices_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "deposit_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "payment_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_invoices_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "deposit_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_merchants: {
        Row: {
          api_key_hash: string | null
          api_key_prefix: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          settlement_symbol: string
          slug: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
          webhook_url: string | null
          website: string | null
        }
        Insert: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          settlement_symbol?: string
          slug: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Update: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          settlement_symbol?: string
          slug?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      payment_webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          event: string
          id: string
          invoice_id: string
          merchant_id: string
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event: string
          id?: string
          invoice_id: string
          merchant_id: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event?: string
          id?: string
          invoice_id?: string
          merchant_id?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "payment_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_deliveries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "payment_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      perp_positions: {
        Row: {
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          margin: number
          margin_asset: string
          market: string
          realized_pnl: number | null
          side: string
          size_usd: number
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          entry_price: number
          exit_price?: number | null
          id?: string
          leverage: number
          margin: number
          margin_asset: string
          market: string
          realized_pnl?: number | null
          side: string
          size_usd: number
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          leverage?: number
          margin?: number
          margin_asset?: string
          market?: string
          realized_pnl?: number | null
          side?: string
          size_usd?: number
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perp_positions_wallet_id_fkey"
            columns: ["wallet_id"]
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
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at: string | null
          kyc_verification_id: string | null
          kyc_verified_at: string | null
          pi_uid: string | null
          pi_username: string | null
          pi_wallet_address: string | null
          twitter_url: string | null
          updated_at: string
          username: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_currency?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at?: string | null
          kyc_verification_id?: string | null
          kyc_verified_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          pi_wallet_address?: string | null
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_currency?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_updated_at?: string | null
          kyc_verification_id?: string | null
          kyc_verified_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          pi_wallet_address?: string | null
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
          is_top_volume: boolean
          is_trending: boolean
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
          is_top_volume?: boolean
          is_trending?: boolean
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
          is_top_volume?: boolean
          is_trending?: boolean
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
      topup_methods: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          method_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label: string
          method_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          method_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      topup_settings: {
        Row: {
          fee_bps: number
          fee_wallet_address: string | null
          id: number
          instructions: string | null
          openpay_payment_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fee_bps?: number
          fee_wallet_address?: string | null
          id?: number
          instructions?: string | null
          openpay_payment_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fee_bps?: number
          fee_wallet_address?: string | null
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
      tx_email_webhook_config: {
        Row: {
          enabled: boolean
          id: number
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          enabled?: boolean
          id?: number
          secret?: string
          updated_at?: string
          url?: string
        }
        Update: {
          enabled?: boolean
          id?: number
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
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
      wallet_account_balances: {
        Row: {
          account: string
          asset: string
          balance: number
          updated_at: string
          wallet_id: string
        }
        Insert: {
          account: string
          asset: string
          balance?: number
          updated_at?: string
          wallet_id: string
        }
        Update: {
          account?: string
          asset?: string
          balance?: number
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_account_balances_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string
          aave_balance: number
          ada_balance: number
          aster_balance: number
          avax_balance: number
          bch_balance: number
          bgb_balance: number
          bnb_balance: number
          btc_balance: number
          cake_balance: number
          cash_balance: number
          created_at: string
          doge_balance: number
          dot_balance: number
          eth_balance: number
          eurc_balance: number
          googlx_balance: number
          gram_balance: number
          gt_balance: number
          hype_balance: number
          id: string
          is_active: boolean
          jup_balance: number
          link_balance: number
          name: string
          near_balance: number
          nflxx_balance: number
          okb_balance: number
          ondo_balance: number
          ousd_balance: number
          paxg_balance: number
          pi_balance: number
          pump_balance: number
          pyusd_balance: number
          recovery_hash: string | null
          rlusd_balance: number
          ron_balance: number
          sol_balance: number
          sui_balance: number
          trx_balance: number
          tslax_balance: number
          uni_balance: number
          usd1_balance: number
          usdc_balance: number
          usdg_balance: number
          usdt_balance: number
          usdy_balance: number
          user_id: string
          wlfi_balance: number
          xaut_balance: number
          xlm_balance: number
          xrp_balance: number
          zec_balance: number
        }
        Insert: {
          address: string
          aave_balance?: number
          ada_balance?: number
          aster_balance?: number
          avax_balance?: number
          bch_balance?: number
          bgb_balance?: number
          bnb_balance?: number
          btc_balance?: number
          cake_balance?: number
          cash_balance?: number
          created_at?: string
          doge_balance?: number
          dot_balance?: number
          eth_balance?: number
          eurc_balance?: number
          googlx_balance?: number
          gram_balance?: number
          gt_balance?: number
          hype_balance?: number
          id?: string
          is_active?: boolean
          jup_balance?: number
          link_balance?: number
          name: string
          near_balance?: number
          nflxx_balance?: number
          okb_balance?: number
          ondo_balance?: number
          ousd_balance?: number
          paxg_balance?: number
          pi_balance?: number
          pump_balance?: number
          pyusd_balance?: number
          recovery_hash?: string | null
          rlusd_balance?: number
          ron_balance?: number
          sol_balance?: number
          sui_balance?: number
          trx_balance?: number
          tslax_balance?: number
          uni_balance?: number
          usd1_balance?: number
          usdc_balance?: number
          usdg_balance?: number
          usdt_balance?: number
          usdy_balance?: number
          user_id: string
          wlfi_balance?: number
          xaut_balance?: number
          xlm_balance?: number
          xrp_balance?: number
          zec_balance?: number
        }
        Update: {
          address?: string
          aave_balance?: number
          ada_balance?: number
          aster_balance?: number
          avax_balance?: number
          bch_balance?: number
          bgb_balance?: number
          bnb_balance?: number
          btc_balance?: number
          cake_balance?: number
          cash_balance?: number
          created_at?: string
          doge_balance?: number
          dot_balance?: number
          eth_balance?: number
          eurc_balance?: number
          googlx_balance?: number
          gram_balance?: number
          gt_balance?: number
          hype_balance?: number
          id?: string
          is_active?: boolean
          jup_balance?: number
          link_balance?: number
          name?: string
          near_balance?: number
          nflxx_balance?: number
          okb_balance?: number
          ondo_balance?: number
          ousd_balance?: number
          paxg_balance?: number
          pi_balance?: number
          pump_balance?: number
          pyusd_balance?: number
          recovery_hash?: string | null
          rlusd_balance?: number
          ron_balance?: number
          sol_balance?: number
          sui_balance?: number
          trx_balance?: number
          tslax_balance?: number
          uni_balance?: number
          usd1_balance?: number
          usdc_balance?: number
          usdg_balance?: number
          usdt_balance?: number
          usdy_balance?: number
          user_id?: string
          wlfi_balance?: number
          xaut_balance?: number
          xlm_balance?: number
          xrp_balance?: number
          zec_balance?: number
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          asset_key: string
          created_at: string
          user_id: string
        }
        Insert: {
          asset_key: string
          created_at?: string
          user_id: string
        }
        Update: {
          asset_key?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_bucket_move: {
        Args: {
          _account: string
          _asset: string
          _delta: number
          _wallet_id: string
        }
        Returns: undefined
      }
      admin_list_p2p_merchant_applications: {
        Args: { _status?: string }
        Returns: {
          admin_note: string | null
          applicant_note: string | null
          checklist_snapshot: Json
          created_at: string
          id: string
          merchant_name: string | null
          merchant_region: string | null
          requested_tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["p2p_application_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "p2p_merchant_applications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_p2p_support: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          username: string
          wallet_address: string
        }[]
      }
      admin_resolve_user_by_username_wallet: {
        Args: { _username: string; _wallet_address: string }
        Returns: string
      }
      admin_review_p2p_merchant: {
        Args: {
          _admin_note?: string
          _application_id: string
          _approve: boolean
          _featured?: boolean
          _featured_days?: number
          _tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          badge_label: string | null
          created_at: string
          featured_until: string | null
          is_featured: boolean
          merchant_name: string | null
          merchant_region: string | null
          notes: string | null
          tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          updated_at: string
          user_id: string
          verified_badge_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "p2p_merchants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_p2p_merchant: {
        Args: {
          _featured?: boolean
          _featured_days?: number
          _note?: string
          _tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          _user_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          badge_label: string | null
          created_at: string
          featured_until: string | null
          is_featured: boolean
          merchant_name: string | null
          merchant_region: string | null
          notes: string | null
          tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          updated_at: string
          user_id: string
          verified_badge_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "p2p_merchants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_p2p_support: {
        Args: { _grant?: boolean; _username: string; _wallet_address: string }
        Returns: Json
      }
      attach_wallet_recovery: {
        Args: { p_recovery_hash: string; p_wallet_id: string }
        Returns: Json
      }
      backfill_ledger_entries: { Args: never; Returns: Json }
      claim_first_admin: { Args: never; Returns: boolean }
      credit_platform_fee_ousd: {
        Args: {
          p_amount: number
          p_counterparty?: string
          p_memo?: string
          p_source_wallet_id?: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      funding_move: {
        Args: { _asset: string; _delta: number; _wallet_id: string }
        Returns: undefined
      }
      get_account_portfolio: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_user_pin: { Args: never; Returns: boolean }
      import_openpay_wallet: {
        Args: { p_address: string; p_name?: string; p_recovery_hash: string }
        Returns: Json
      }
      internal_account_transfer: {
        Args: { _amount: number; _asset: string; _from: string; _to: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      ot_execute_trade: {
        Args: {
          p_pi_amount?: number
          p_side: Database["public"]["Enums"]["ot_trade_side"]
          p_token_amount?: number
          p_token_id: string
          p_wallet_id: string
        }
        Returns: Json
      }
      p2p_apply_merchant: {
        Args: {
          _merchant_name?: string
          _merchant_region?: string
          _note?: string
          _requested_tier?: Database["public"]["Enums"]["p2p_merchant_tier"]
        }
        Returns: {
          admin_note: string | null
          applicant_note: string | null
          checklist_snapshot: Json
          created_at: string
          id: string
          merchant_name: string | null
          merchant_region: string | null
          requested_tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["p2p_application_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_merchant_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_assert_trade_limit: {
        Args: {
          _amount: number
          _asset: string
          _label?: string
          _price_usd: number
        }
        Returns: undefined
      }
      p2p_balance_column: { Args: { _asset: string }; Returns: string }
      p2p_cancel_merchant_application: {
        Args: { _id: string }
        Returns: {
          admin_note: string | null
          applicant_note: string | null
          checklist_snapshot: Json
          created_at: string
          id: string
          merchant_name: string | null
          merchant_region: string | null
          requested_tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["p2p_application_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_merchant_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_cancel_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_claim_merchant_milestones: { Args: never; Returns: Json }
      p2p_close_ad: {
        Args: { _ad_id: string }
        Returns: {
          asset: string
          available_amount: number
          created_at: string
          id: string
          max_order: number
          min_order: number
          pay_time_limit_minutes: number
          payment_methods: string[]
          price_usd: number
          side: Database["public"]["Enums"]["p2p_ad_side"]
          status: Database["public"]["Enums"]["p2p_ad_status"]
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_confirm_received: {
        Args: { _order_id: string }
        Returns: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_create_ad: {
        Args: {
          _asset: string
          _max_order: number
          _min_order: number
          _pay_time_limit_minutes?: number
          _payment_methods: string[]
          _price_usd: number
          _side: Database["public"]["Enums"]["p2p_ad_side"]
          _terms?: string
          _total_amount: number
        }
        Returns: {
          asset: string
          available_amount: number
          created_at: string
          id: string
          max_order: number
          min_order: number
          pay_time_limit_minutes: number
          payment_methods: string[]
          price_usd: number
          side: Database["public"]["Enums"]["p2p_ad_side"]
          status: Database["public"]["Enums"]["p2p_ad_status"]
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_display_names: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      p2p_expire_orders: { Args: never; Returns: number }
      p2p_fetch_merchants: {
        Args: { _ids: string[] }
        Returns: {
          badge_label: string
          featured_until: string
          has_verified_badge: boolean
          is_featured: boolean
          merchant_name: string
          tier: Database["public"]["Enums"]["p2p_merchant_tier"]
          user_id: string
        }[]
      }
      p2p_get_my_merchant: { Args: never; Returns: Json }
      p2p_list_my_ratings: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          asset: string
          comment: string
          created_at: string
          id: string
          order_id: string
          rater_id: string
          score: number
          tags: string[]
        }[]
      }
      p2p_mark_paid: {
        Args: { _order_id: string; _proof_url?: string }
        Returns: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_max_ousd: { Args: never; Returns: number }
      p2p_merchant_can_list: { Args: { _user_id: string }; Returns: boolean }
      p2p_merchant_completed_orders: {
        Args: { _user_id: string }
        Returns: number
      }
      p2p_merchant_has_verified_badge: {
        Args: { _user_id: string }
        Returns: boolean
      }
      p2p_merchant_p2p_ousd: { Args: { _user_id: string }; Returns: number }
      p2p_merchant_program_status: { Args: never; Returns: Json }
      p2p_move_balance: {
        Args: { _asset: string; _delta: number; _user_id: string }
        Returns: undefined
      }
      p2p_my_rating_for_order: {
        Args: { _order_id: string }
        Returns: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          ratee_id: string
          rater_id: string
          score: number
          tags: string[]
        }
        SetofOptions: {
          from: "*"
          to: "p2p_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_open_dispute: {
        Args: { _order_id: string; _reason: string }
        Returns: {
          created_at: string
          id: string
          moderator_id: string | null
          opened_by: string
          order_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["p2p_dispute_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_open_order: {
        Args: { _ad_id: string; _amount: number; _payment_method: string }
        Returns: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_pick_payment_account: {
        Args: { _method_code: string; _seller_id: string }
        Returns: {
          account_name: string
          account_number: string
          bank_name: string | null
          created_at: string
          extra: Json
          id: string
          is_active: boolean
          method_code: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_payment_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_rating_stats: {
        Args: { _ids: string[] }
        Returns: {
          avg_score: number
          id: string
          positive_rate: number
          rating_count: number
        }[]
      }
      p2p_record_tx: {
        Args: {
          _amount: number
          _asset: string
          _counterparty?: string
          _memo: string
          _tx_hash: string
          _type: Database["public"]["Enums"]["tx_type"]
          _usd_value: number
          _user_id: string
        }
        Returns: undefined
      }
      p2p_ref_hex: { Args: { _prefix: string }; Returns: string }
      p2p_refresh_verified_badge: {
        Args: { _user_id: string }
        Returns: boolean
      }
      p2p_reserved_sell_amount: {
        Args: { _asset: string; _wallet_id: string }
        Returns: number
      }
      p2p_resolve_dispute: {
        Args: {
          _order_id: string
          _release_to_buyer: boolean
          _resolution: string
        }
        Returns: {
          ad_id: string
          amount: number
          asset: string
          buyer_id: string
          cancelled_at: string | null
          created_at: string
          escrow_status: Database["public"]["Enums"]["p2p_escrow_status"]
          escrow_tx_hash: string | null
          expires_at: string
          fiat_currency: string
          id: string
          paid_at: string | null
          payment_account_id: string | null
          payment_account_snapshot: Json | null
          payment_method: string
          payment_proof_url: string | null
          price_usd: number
          ref: string
          release_tx_hash: string | null
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["p2p_order_status"]
          total_fiat: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_set_ad_status: {
        Args: {
          _ad_id: string
          _status: Database["public"]["Enums"]["p2p_ad_status"]
        }
        Returns: {
          asset: string
          available_amount: number
          created_at: string
          id: string
          max_order: number
          min_order: number
          pay_time_limit_minutes: number
          payment_methods: string[]
          price_usd: number
          side: Database["public"]["Enums"]["p2p_ad_side"]
          status: Database["public"]["Enums"]["p2p_ad_status"]
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_ads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_submit_rating: {
        Args: {
          _comment?: string
          _order_id: string
          _score: number
          _tags?: string[]
        }
        Returns: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          ratee_id: string
          rater_id: string
          score: number
          tags: string[]
        }
        SetofOptions: {
          from: "*"
          to: "p2p_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_trader_stats: {
        Args: { _ids: string[] }
        Returns: {
          avg_pay_seconds: number
          completed_count: number
          completion_rate: number
          id: string
          last_active_at: string
        }[]
      }
      p2p_wallet_id: { Args: { _user_id: string }; Returns: string }
      perp_close_position: {
        Args: { _exit_price: number; _position_id: string }
        Returns: {
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          margin: number
          margin_asset: string
          market: string
          realized_pnl: number | null
          side: string
          size_usd: number
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "perp_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      perp_open_position: {
        Args: {
          _entry_price: number
          _leverage: number
          _margin: number
          _margin_asset: string
          _market: string
          _side: string
        }
        Returns: {
          closed_at: string | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          leverage: number
          margin: number
          margin_asset: string
          market: string
          realized_pnl: number | null
          side: string
          size_usd: number
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "perp_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      verify_user_pin: { Args: { _pin_hash: string }; Returns: boolean }
      wallet_has_recovery: { Args: { p_wallet_id: string }; Returns: boolean }
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
      p2p_ad_side: "sell" | "buy"
      p2p_ad_status: "active" | "paused" | "closed"
      p2p_application_status: "pending" | "approved" | "rejected" | "cancelled"
      p2p_dispute_status:
        | "open"
        | "resolved_buyer"
        | "resolved_seller"
        | "cancelled"
      p2p_escrow_status: "none" | "locked" | "released" | "refunded" | "frozen"
      p2p_merchant_tier: "none" | "verified" | "super"
      p2p_order_status:
        | "pending_payment"
        | "paid"
        | "completed"
        | "cancelled"
        | "expired"
        | "disputed"
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
      ot_report_status: ["open", "reviewed", "dismissed", "actioned"],
      ot_token_category: [
        "meme",
        "ai",
        "gaming",
        "utility",
        "defi",
        "nft",
        "community",
      ],
      ot_token_status: ["curve", "graduated", "halted"],
      ot_trade_side: ["buy", "sell"],
      p2p_ad_side: ["sell", "buy"],
      p2p_ad_status: ["active", "paused", "closed"],
      p2p_application_status: ["pending", "approved", "rejected", "cancelled"],
      p2p_dispute_status: [
        "open",
        "resolved_buyer",
        "resolved_seller",
        "cancelled",
      ],
      p2p_escrow_status: ["none", "locked", "released", "refunded", "frozen"],
      p2p_merchant_tier: ["none", "verified", "super"],
      p2p_order_status: [
        "pending_payment",
        "paid",
        "completed",
        "cancelled",
        "expired",
        "disputed",
      ],
      tx_status: ["pending", "confirmed", "failed"],
      tx_type: ["send", "receive", "swap", "mint", "buy", "sell", "reward"],
    },
  },
} as const
