export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      content_analysis: {
        Row: {
          id: string
          url: string
          content_hash: string
          summary: string
          topics: string[]
          sentiment_score: number
          sentiment_label: string
          readability_score: number
          readability_level: string
          classification_category: string
          classification_confidence: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_analysis']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['content_analysis']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      content_entities: {
        Row: {
          id: string
          analysis_id: string
          name: string
          entity_type: string
          mentions: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_entities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['content_entities']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "content_entities_analysis_id_fkey"
            columns: ["analysis_id"]
            referencedRelation: "content_analysis"
            referencedColumns: ["id"]
          }
        ]
      }
      content_keywords: {
        Row: {
          id: string
          analysis_id: string
          keyword: string
          relevance_score: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_keywords']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['content_keywords']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "content_keywords_analysis_id_fkey"
            columns: ["analysis_id"]
            referencedRelation: "content_analysis"
            referencedColumns: ["id"]
          }
        ]
      }
      content_analysis_cache: {
        Row: {
          id: string
          content_hash: string
          analysis_id: string
          last_validated_at: string
          is_valid: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_analysis_cache']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['content_analysis_cache']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "content_analysis_cache_analysis_id_fkey"
            columns: ["analysis_id"]
            referencedRelation: "content_analysis"
            referencedColumns: ["id"]
          }
        ]
      }
      search_queries: {
        Row: {
          id: string
          query: string
          target_industry: string | null
          service_offering: string | null
          location: string | null
          max_results: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['search_queries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['search_queries']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      search_results: {
        Row: {
          id: string
          query_id: string
          url: string
          title: string | null
          snippet: string | null
          rank: number | null
          relevance_score: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['search_results']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['search_results']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "search_results_query_id_fkey"
            columns: ["query_id"]
            referencedRelation: "search_queries"
            referencedColumns: ["id"]
          }
        ]
      }
      search_analytics: {
        Row: {
          id: string
          query_id: string
          total_results: number
          execution_time_ms: number
          success: boolean
          error_message: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['search_analytics']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['search_analytics']['Row'], 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "search_analytics_query_id_fkey"
            columns: ["query_id"]
            referencedRelation: "search_queries"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 