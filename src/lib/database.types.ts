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
export type OfferAudience = 'new_users' | 'account_holders' | 'everyone'
export type ContactCategory = 'feedback' | 'complaint' | 'question' | 'partnership'
export type ContactStatus = 'open' | 'replied' | 'closed'
export type SurveyQuestionType = 'text' | 'rating' | 'multiple_choice'
export type BugReportStatus = 'open' | 'triaged' | 'resolved' | 'wontfix'

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
          demo_mode: boolean
          report_model: string | null
          last_seen_at: string | null
          acquisition: Json | null
          admin_dashboard_layout: Json | null
          admin_seen: Json | null
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
          demo_mode?: boolean
          report_model?: string | null
          last_seen_at?: string | null
          acquisition?: Json | null
          admin_dashboard_layout?: Json | null
          admin_seen?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string | null
          display_name?: string | null
          default_country?: string | null
          default_region?: string | null
          marketing_opt_in?: boolean
          demo_mode?: boolean
          report_model?: string | null
          last_seen_at?: string | null
          acquisition?: Json | null
          admin_dashboard_layout?: Json | null
          admin_seen?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      page_events: {
        Row: {
          id: number
          occurred_at: string
          session_id: string
          visitor_id: string | null
          user_id: string | null
          path: string
          referrer: string | null
          utm: Json | null
          is_new_session: boolean
        }
        Insert: {
          id?: number
          occurred_at?: string
          session_id: string
          visitor_id?: string | null
          user_id?: string | null
          path: string
          referrer?: string | null
          utm?: Json | null
          is_new_session?: boolean
        }
        Update: {
          session_id?: string
          visitor_id?: string | null
          user_id?: string | null
          path?: string
          referrer?: string | null
          utm?: Json | null
          is_new_session?: boolean
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
          answer_edit_log: Json
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
          answer_edit_log?: Json
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
          answer_edit_log?: Json
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
          teaser_completed_at: string | null
          model_version: string | null
          cost_usd: number | null
          is_promo: boolean
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
          teaser_completed_at?: string | null
          model_version?: string | null
          cost_usd?: number | null
          is_promo?: boolean
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
          teaser_completed_at?: string | null
          model_version?: string | null
          cost_usd?: number | null
          is_promo?: boolean
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
      report_feedback: {
        Row: {
          id: string
          report_id: string
          user_id: string
          rating: number
          comment: string | null
          allow_public: boolean
          featured: boolean
          hidden: boolean
          admin_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          user_id: string
          rating: number
          comment?: string | null
          allow_public?: boolean
          featured?: boolean
          hidden?: boolean
          admin_public?: boolean
          created_at?: string
        }
        Update: {
          rating?: number
          comment?: string | null
          allow_public?: boolean
          featured?: boolean
          hidden?: boolean
          admin_public?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'report_feedback_report_id_fkey'
            columns: ['report_id']
            isOneToOne: true
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'report_feedback_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      feedback_replies: {
        Row: {
          id: string
          feedback_id: string
          body: string
          is_public: boolean
          created_at: string
          created_by: string
          emailed_at: string | null
        }
        Insert: {
          id?: string
          feedback_id: string
          body: string
          is_public?: boolean
          created_at?: string
          created_by: string
          emailed_at?: string | null
        }
        Update: {
          body?: string
          is_public?: boolean
          emailed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_replies_feedback_id_fkey'
            columns: ['feedback_id']
            isOneToOne: false
            referencedRelation: 'report_feedback'
            referencedColumns: ['id']
          }
        ]
      }
      error_log: {
        Row: {
          id: string
          occurred_at: string
          source: string
          message: string
          detail: Json | null
          path: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          occurred_at?: string
          source: string
          message: string
          detail?: Json | null
          path?: string | null
          user_id?: string | null
        }
        Update: {
          source?: string
          message?: string
          detail?: Json | null
          path?: string | null
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          id: string
          slug: string
          name: string
          target_url: string
          match_domains: string[]
          match_terms: string[]
          active: boolean
          notes: string | null
          category: string | null
          countries: string[] | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          target_url: string
          match_domains?: string[]
          match_terms?: string[]
          active?: boolean
          notes?: string | null
          category?: string | null
          countries?: string[] | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          name?: string
          target_url?: string
          match_domains?: string[]
          match_terms?: string[]
          active?: boolean
          notes?: string | null
          category?: string | null
          countries?: string[] | null
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          id: number
          link_id: string
          occurred_at: string
          context: string | null
          user_id: string | null
          referrer_path: string | null
        }
        Insert: {
          id?: number
          link_id: string
          occurred_at?: string
          context?: string | null
          user_id?: string | null
          referrer_path?: string | null
        }
        Update: {
          context?: string | null
          user_id?: string | null
          referrer_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'affiliate_clicks_link_id_fkey'
            columns: ['link_id']
            isOneToOne: false
            referencedRelation: 'affiliate_links'
            referencedColumns: ['id']
          }
        ]
      }
      offers: {
        Row: {
          id: string
          code: string
          description: string
          percent_off: number | null
          amount_off_cents: number | null
          audience: OfferAudience
          show_on_homepage: boolean
          show_in_account: boolean
          starts_at: string
          ends_at: string | null
          max_redemptions: number | null
          redemption_count: number
          active: boolean
          stripe_promotion_code_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          description: string
          percent_off?: number | null
          amount_off_cents?: number | null
          audience?: OfferAudience
          show_on_homepage?: boolean
          show_in_account?: boolean
          starts_at?: string
          ends_at?: string | null
          max_redemptions?: number | null
          redemption_count?: number
          active?: boolean
          stripe_promotion_code_id?: string | null
          created_at?: string
        }
        Update: {
          code?: string
          description?: string
          percent_off?: number | null
          amount_off_cents?: number | null
          audience?: OfferAudience
          show_on_homepage?: boolean
          show_in_account?: boolean
          starts_at?: string
          ends_at?: string | null
          max_redemptions?: number | null
          redemption_count?: number
          active?: boolean
          stripe_promotion_code_id?: string | null
        }
        Relationships: []
      }
      sample_reports: {
        Row: {
          id: string
          title: string
          archetype: string
          restatement: string
          sections: Json
          headline_score: number
          source_report_id: string | null
          active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          archetype: string
          restatement: string
          sections: Json
          headline_score: number
          source_report_id?: string | null
          active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          archetype?: string
          restatement?: string
          sections?: Json
          headline_score?: number
          source_report_id?: string | null
          active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          id: string
          category: ContactCategory
          name: string
          email: string
          message: string
          user_id: string | null
          status: ContactStatus
          created_at: string
        }
        Insert: {
          id?: string
          category: ContactCategory
          name: string
          email: string
          message: string
          user_id?: string | null
          status?: ContactStatus
          created_at?: string
        }
        Update: {
          category?: ContactCategory
          name?: string
          email?: string
          message?: string
          status?: ContactStatus
        }
        Relationships: []
      }
      contact_replies: {
        Row: {
          id: string
          submission_id: string
          body: string
          created_by: string
          emailed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          body: string
          created_by: string
          emailed_at?: string | null
          created_at?: string
        }
        Update: {
          body?: string
          emailed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'contact_replies_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'contact_submissions'
            referencedColumns: ['id']
          }
        ]
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          id: string
          prompt: string
          qtype: SurveyQuestionType
          options: Json | null
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          prompt: string
          qtype: SurveyQuestionType
          options?: Json | null
          sort_order?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          prompt?: string
          qtype?: SurveyQuestionType
          options?: Json | null
          sort_order?: number
          active?: boolean
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          id: string
          question_id: string
          user_id: string
          report_id: string | null
          answer: string
          created_at: string
        }
        Insert: {
          id?: string
          question_id: string
          user_id: string
          report_id?: string | null
          answer: string
          created_at?: string
        }
        Update: {
          answer?: string
        }
        Relationships: [
          {
            foreignKeyName: 'survey_responses_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'survey_questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'survey_responses_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'reports'
            referencedColumns: ['id']
          }
        ]
      }
      bug_reports: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          idea_id: string | null
          report_id: string | null
          report_tab: string | null
          description: string
          screenshot_path: string | null
          browser_info: string | null
          page_url: string | null
          status: BugReportStatus
          admin_notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          idea_id?: string | null
          report_id?: string | null
          report_tab?: string | null
          description: string
          screenshot_path?: string | null
          browser_info?: string | null
          page_url?: string | null
          status?: BugReportStatus
          admin_notes?: string | null
        }
        Update: {
          report_tab?: string | null
          description?: string
          screenshot_path?: string | null
          browser_info?: string | null
          page_url?: string | null
          status?: BugReportStatus
          admin_notes?: string | null
        }
        Relationships: []
      }
      promo_identity: {
        Row: {
          id: string
          user_id: string
          normalized_email: string
          ip_hash: string | null
          ab_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          normalized_email: string
          ip_hash?: string | null
          ab_id?: string | null
          created_at?: string
        }
        Update: {
          normalized_email?: string
          ip_hash?: string | null
          ab_id?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      analytics_sessions_per_day: {
        Args: { from_ts: string; to_ts: string }
        Returns: { day: string; count: number }[]
      }
      analytics_pageviews_per_day: {
        Args: { from_ts: string; to_ts: string }
        Returns: { day: string; count: number }[]
      }
      analytics_unique_visitors_per_day: {
        Args: { from_ts: string; to_ts: string }
        Returns: { day: string; count: number }[]
      }
      analytics_returning_visitors_per_day: {
        Args: { from_ts: string; to_ts: string }
        Returns: { day: string; count: number }[]
      }
      analytics_top_referrers: {
        Args: { from_ts: string; to_ts: string; max_rows?: number }
        Returns: { referrer_host: string; count: number }[]
      }
      analytics_top_utm_campaigns: {
        Args: { from_ts: string; to_ts: string; max_rows?: number }
        Returns: { source: string; campaign: string; count: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
