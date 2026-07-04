// Regenerate with: npx supabase gen types typescript --project-id mgwjbrywhebptkmbufvp > src/lib/database.types.ts
// (requires: npx supabase login)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type IdeaArchetype =
  | 'physical_product'
  | 'local_service'
  | 'software_app'
  | 'ecommerce_brand'
  | 'content_education'
  | 'marketplace'
  | 'invention'
  | 'other'

export type IdeaStatus = 'draft' | 'questioning' | 'researching' | 'ready'
export type ReportStatus = 'queued' | 'running' | 'complete' | 'failed'
export type PurchaseStatus = 'pending' | 'complete' | 'refunded' | 'failed'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          default_country: string | null
          default_region: string | null
          marketing_opt_in: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          default_country?: string | null
          default_region?: string | null
          marketing_opt_in?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string | null
          display_name?: string | null
          default_country?: string | null
          default_region?: string | null
          marketing_opt_in?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          id: string
          owner_id: string
          raw_text: string
          archetype: IdeaArchetype
          archetype_source: 'classifier' | 'user_override'
          archetype_confidence: number | null
          location_country: string
          location_region: string | null
          restatement: string | null
          status: IdeaStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          raw_text: string
          archetype: IdeaArchetype
          archetype_source?: 'classifier' | 'user_override'
          archetype_confidence?: number | null
          location_country: string
          location_region?: string | null
          restatement?: string | null
          status?: IdeaStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          archetype?: IdeaArchetype
          archetype_source?: 'classifier' | 'user_override'
          archetype_confidence?: number | null
          location_country?: string
          location_region?: string | null
          restatement?: string | null
          status?: IdeaStatus
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ideas_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      answers: {
        Row: {
          id: string
          idea_id: string
          question_key: string
          question_text: string
          answer_text: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          idea_id: string
          question_key: string
          question_text: string
          answer_text: string
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          question_text?: string
          answer_text?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'answers_idea_id_fkey'
            columns: ['idea_id']
            isOneToOne: false
            referencedRelation: 'ideas'
            referencedColumns: ['id']
          }
        ]
      }
      reports: {
        Row: {
          id: string
          idea_id: string
          owner_id: string
          status: ReportStatus
          sections: Json
          preview_sections: Json
          error: string | null
          generation_started_at: string | null
          generation_completed_at: string | null
          model_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          idea_id: string
          owner_id: string
          status?: ReportStatus
          sections?: Json
          preview_sections?: Json
          error?: string | null
          generation_started_at?: string | null
          generation_completed_at?: string | null
          model_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: ReportStatus
          sections?: Json
          preview_sections?: Json
          error?: string | null
          generation_started_at?: string | null
          generation_completed_at?: string | null
          model_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_idea_id_fkey'
            columns: ['idea_id']
            isOneToOne: true
            referencedRelation: 'ideas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          report_id: string
          stripe_session_id: string
          stripe_payment_intent_id: string | null
          amount_cents: number
          currency: string
          status: PurchaseStatus
          completed_at: string | null
          refunded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          report_id: string
          stripe_session_id: string
          stripe_payment_intent_id?: string | null
          amount_cents: number
          currency: string
          status: PurchaseStatus
          completed_at?: string | null
          refunded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_payment_intent_id?: string | null
          status?: PurchaseStatus
          completed_at?: string | null
          refunded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'reports'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
