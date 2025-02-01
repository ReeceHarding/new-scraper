export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_history: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          org_id: string
          resolved_at: string | null
          rule_id: string
          status: string
          triggered_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          org_id: string
          resolved_at?: string | null
          rule_id: string
          status: string
          triggered_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          org_id?: string
          resolved_at?: string | null
          rule_id?: string
          status?: string
          triggered_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          alert_type: string
          condition: Json
          cooldown_minutes: number | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          metadata: Json
          name: string
          notification_channels: Json
          org_id: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          alert_type: string
          condition: Json
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          metadata?: Json
          name: string
          notification_channels: Json
          org_id: string
          severity: string
          threshold: number
          updated_at?: string
        }
        Update: {
          alert_type?: string
          condition?: Json
          cooldown_minutes?: number | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          metadata?: Json
          name?: string
          notification_channels?: Json
          org_id?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          label: string | null
          metadata: Json
          org_id: string | null
          scopes: string[] | null
          token: string | null
          token_hashed: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          org_id?: string | null
          scopes?: string[] | null
          token?: string | null
          token_hashed?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          org_id?: string | null
          scopes?: string[] | null
          token?: string | null
          token_hashed?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          new_state: Json | null
          old_state: Json | null
          org_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_state?: Json | null
          old_state?: Json | null
          org_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          new_state?: Json | null
          old_state?: Json | null
          org_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crawled_pages: {
        Row: {
          campaign_id: string | null
          created_at: string
          html_content: string | null
          http_status: number | null
          id: string
          metadata: Json
          org_id: string | null
          text_content: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json
          org_id?: string | null
          text_content?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          http_status?: number | null
          id?: string
          metadata?: Json
          org_id?: string | null
          text_content?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawled_pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawled_pages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_analytics: {
        Row: {
          bounce_count: number
          click_count: number
          created_at: string
          id: string
          metadata: Json
          open_count: number
          org_id: string
          sent_count: number
          template_id: string
          updated_at: string
        }
        Insert: {
          bounce_count?: number
          click_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          open_count?: number
          org_id: string
          sent_count?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          bounce_count?: number
          click_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          open_count?: number
          org_id?: string
          sent_count?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_analytics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_analytics_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          contact_id: string
          created_at: string
          id: string
          last_error: string | null
          metadata: Json
          scheduled_for: string
          status: string
          template_id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          attempts?: number
          contact_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          scheduled_for: string
          status?: string
          template_id: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempts?: number
          contact_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          scheduled_for?: string
          status?: string
          template_id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "outreach_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          name: string
          org_id: string
          subject: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          org_id: string
          subject: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          org_id?: string
          subject?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking: {
        Row: {
          created_at: string
          email_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          created_at?: string
          email_id: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          created_at?: string
          email_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          inbound_message_id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          inbound_message_id: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          inbound_message_id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_attachments_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          attachments: string[] | null
          body: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          message_type: string | null
          metadata: Json
          org_id: string | null
          outreach_company_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          attachments?: string[] | null
          body?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json
          org_id?: string | null
          outreach_company_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: string[] | null
          body?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json
          org_id?: string | null
          outreach_company_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "outreach_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_outreach_company_id_fkey"
            columns: ["outreach_company_id"]
            isOneToOne: false
            referencedRelation: "outreach_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string | null
          metadata: Json
          org_id: string | null
          payload: Json
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string | null
          metadata?: Json
          org_id?: string | null
          payload?: Json
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string | null
          metadata?: Json
          org_id?: string | null
          payload?: Json
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_doc_chunks: {
        Row: {
          chunk_content: string | null
          chunk_index: number | null
          created_at: string
          doc_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          metadata: Json
          token_length: number | null
          updated_at: string
        }
        Insert: {
          chunk_content?: string | null
          chunk_index?: number | null
          created_at?: string
          doc_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json
          token_length?: number | null
          updated_at?: string
        }
        Update: {
          chunk_content?: string | null
          chunk_index?: number | null
          created_at?: string
          doc_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          metadata?: Json
          token_length?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_doc_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_docs: {
        Row: {
          created_at: string
          description: string | null
          doc_type: string | null
          file_path: string | null
          id: string
          metadata: Json
          org_id: string
          source_url: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doc_type?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json
          org_id: string
          source_url?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doc_type?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          source_url?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_docs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          org_id: string
          profile_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          profile_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          profile_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          logo_url: string | null
          metadata: Json
          name: string
          org_type: string | null
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name: string
          org_type?: string | null
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json
          name?: string
          org_type?: string | null
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outreach_campaigns: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          metadata: Json
          name: string | null
          org_id: string
          start_date: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          org_id: string
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          org_id?: string
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_companies: {
        Row: {
          campaign_id: string
          created_at: string
          domain: string | null
          id: string
          metadata: Json
          org_id: string
          pipeline_stage: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          domain?: string | null
          id?: string
          metadata?: Json
          org_id: string
          pipeline_stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          domain?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          pipeline_stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_companies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          metadata: Json
          name: string | null
          pipeline_stage: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          pipeline_stage?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          pipeline_stage?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "outreach_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_logs: {
        Row: {
          created_at: string
          duration_ms: number
          end_time: string
          error_message: string | null
          id: string
          metadata: Json
          operation_name: string
          operation_type: string
          org_id: string
          resource_usage: Json | null
          start_time: string
          success: boolean
        }
        Insert: {
          created_at?: string
          duration_ms: number
          end_time: string
          error_message?: string | null
          id?: string
          metadata?: Json
          operation_name: string
          operation_type: string
          org_id: string
          resource_usage?: Json | null
          start_time: string
          success: boolean
        }
        Update: {
          created_at?: string
          duration_ms?: number
          end_time?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          operation_name?: string
          operation_type?: string
          org_id?: string
          resource_usage?: Json | null
          start_time?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "performance_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          metadata: Json
          org_id: string
          phone_number: string | null
          role: string
          status: string | null
          time_zone: string | null
          ui_settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          metadata?: Json
          org_id: string
          phone_number?: string | null
          role?: string
          status?: string | null
          time_zone?: string | null
          ui_settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          metadata?: Json
          org_id?: string
          phone_number?: string | null
          role?: string
          status?: string | null
          time_zone?: string | null
          ui_settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          metric_name: string
          metric_value: number
          org_id: string
          tags: Json
          value_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          metric_name: string
          metric_value: number
          org_id: string
          tags?: Json
          value_type: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          metric_name?: string
          metric_value?: number
          org_id?: string
          tags?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          metadata: Json
          org_id: string | null
          reason: string | null
          tags: string[] | null
          unsub_at: string | null
          unsub_source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          reason?: string | null
          tags?: string[] | null
          unsub_at?: string | null
          unsub_source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          reason?: string | null
          tags?: string[] | null
          unsub_at?: string | null
          unsub_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string | null
          id: string
          ip_address: string | null
          org_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type?: string | null
          id?: string
          ip_address?: string | null
          org_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string | null
          id?: string
          ip_address?: string | null
          org_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          embedding_model: string
          id: string
          metadata: Json
          org_id: string
          source_id: string
          source_type: string
          token_count: number | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          embedding_model: string
          id?: string
          metadata?: Json
          org_id: string
          source_id: string
          source_type: string
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string
          id?: string
          metadata?: Json
          org_id?: string
          source_id?: string
          source_type?: string
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      query_cache: {
        Row: {
          id: string
          cache_key: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cache_key: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cache_key?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_embeddings: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          org_id_filter?: string
          source_type_filter?: string
        }
        Returns: {
          id: string
          content: string
          similarity: number
          metadata: Json
          source_type: string
          source_id: string
        }[]
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      upsert_embeddings: {
        Args: {
          embeddings_json: Json
        }
        Returns: {
          content: string
          created_at: string
          embedding: string | null
          embedding_model: string
          id: string
          metadata: Json
          org_id: string
          source_id: string
          source_type: string
          token_count: number | null
          updated_at: string
        }[]
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

