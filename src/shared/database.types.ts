export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// NOT NULL timestamp columns (live DB verified):
//   profiles.created_at / updated_at
//   tenant_settings.created_at / updated_at
//   feature_flags.updated_at
//   estimate_assemblies.created_at / updated_at
//   project_wishlist_items.created_at
//   recent_project_views.viewed_at
//   material_price_history.recorded_at
// All other created_at / updated_at are nullable in the live DB (DEFAULT now(), no NOT NULL).

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string;
          role?: string;
          phone?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          name?: string;
          role?: string;
          phone?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      tenant_settings: {
        Row: {
          id: number;
          tenant_key: string;
          brand_name: string;
          brand_website: string | null;
          support_email: string | null;
          legal_name: string | null;
          logo_url: string | null;
          primary_color: string | null;
          app_url: string | null;
          sms_enabled: boolean;
          sms_invites_enabled: boolean;
          sms_require_approval: boolean;
          sms_quiet_hours_start: number;
          sms_quiet_hours_end: number;
          sms_quiet_hours_days: Json;
          timezone: string;
          hero_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_key: string;
          brand_name: string;
          brand_website?: string | null;
          support_email?: string | null;
          legal_name?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          app_url?: string | null;
          sms_enabled?: boolean;
          sms_invites_enabled?: boolean;
          sms_require_approval?: boolean;
          sms_quiet_hours_start?: number;
          sms_quiet_hours_end?: number;
          sms_quiet_hours_days?: Json;
          timezone?: string;
          hero_image_url?: string | null;
        };
        Update: {
          tenant_key?: string;
          brand_name?: string;
          brand_website?: string | null;
          support_email?: string | null;
          legal_name?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          app_url?: string | null;
          sms_enabled?: boolean;
          sms_invites_enabled?: boolean;
          sms_require_approval?: boolean;
          sms_quiet_hours_start?: number;
          sms_quiet_hours_end?: number;
          sms_quiet_hours_days?: Json;
          timezone?: string;
          hero_image_url?: string | null;
        };
        Relationships: never[];
      };
      feature_flags: {
        Row: {
          id: number;
          tenant_key: string;
          flag_key: string;
          enabled: boolean;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          tenant_key: string;
          flag_key: string;
          enabled?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          tenant_key?: string;
          flag_key?: string;
          enabled?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      projects: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          status: string;
          client_id: string | null;
          start_date: string | null;
          end_date: string | null;
          address: string | null;
          city: string | null;
          code: string | null;
          phase: string | null;
          current_focus_text: string | null;
          current_focus_photo_id: number | null;
          thumbnail_url: string | null;
          hero_focal_x: number | null;
          hero_focal_y: number | null;
          hero_zoom: number | null;
          total_budget: number | null;
          budget_used: number | null;
          budget_visible_to_client: boolean | null;
          color_tag_id: number | null;
          region: string | null;
          created_at: string | null;
        };
        Insert: {
          name: string;
          description?: string | null;
          status: string;
          client_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          address?: string | null;
          city?: string | null;
          code?: string | null;
          phase?: string | null;
          current_focus_text?: string | null;
          current_focus_photo_id?: number | null;
          thumbnail_url?: string | null;
          hero_focal_x?: number | null;
          hero_focal_y?: number | null;
          hero_zoom?: number | null;
          total_budget?: number | null;
          budget_used?: number | null;
          budget_visible_to_client?: boolean | null;
          color_tag_id?: number | null;
          region?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: string;
          client_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          address?: string | null;
          city?: string | null;
          code?: string | null;
          phase?: string | null;
          current_focus_text?: string | null;
          current_focus_photo_id?: number | null;
          thumbnail_url?: string | null;
          hero_focal_x?: number | null;
          hero_focal_y?: number | null;
          hero_zoom?: number | null;
          total_budget?: number | null;
          budget_used?: number | null;
          budget_visible_to_client?: boolean | null;
          color_tag_id?: number | null;
          region?: string | null;
        };
        Relationships: never[];
      };
      milestones: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          date: string | null;
          start_date: string | null;
          end_date: string | null;
          completed: boolean | null;
          completed_by: string | null;
          order: number | null;
          color_hex: string | null;
          paint_color_ids: number[] | null;
        };
        Insert: {
          project_id: number;
          title: string;
          date?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          completed?: boolean | null;
          completed_by?: string | null;
          order?: number | null;
          color_hex?: string | null;
          paint_color_ids?: number[] | null;
        };
        Update: {
          project_id?: number;
          title?: string;
          date?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          completed?: boolean | null;
          completed_by?: string | null;
          order?: number | null;
          color_hex?: string | null;
          paint_color_ids?: number[] | null;
        };
        Relationships: never[];
      };
      sub_milestones: {
        Row: {
          id: number;
          milestone_id: number;
          title: string;
          completed: boolean | null;
          order: number | null;
        };
        Insert: {
          milestone_id: number;
          title: string;
          completed?: boolean | null;
          order?: number | null;
        };
        Update: {
          milestone_id?: number;
          title?: string;
          completed?: boolean | null;
          order?: number | null;
        };
        Relationships: never[];
      };
      sections: {
        Row: {
          id: number;
          milestone_id: number;
          project_id: number;
          title: string;
          start_date: string | null;
          end_date: string | null;
          completed: boolean | null;
          order: number | null;
        };
        Insert: {
          milestone_id: number;
          project_id: number;
          title: string;
          start_date?: string | null;
          end_date?: string | null;
          completed?: boolean | null;
          order?: number | null;
        };
        Update: {
          milestone_id?: number;
          project_id?: number;
          title?: string;
          start_date?: string | null;
          end_date?: string | null;
          completed?: boolean | null;
          order?: number | null;
        };
        Relationships: never[];
      };
      tasks: {
        Row: {
          id: number;
          project_id: number;
          milestone_id: number | null;
          section_id: number | null;
          title: string;
          description: string | null;
          status: string | null;
          assigned_to: string | null;
          start_date: string | null;
          due_date: string | null;
          order: number | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          milestone_id?: number | null;
          section_id?: number | null;
          title: string;
          description?: string | null;
          status?: string | null;
          assigned_to?: string | null;
          start_date?: string | null;
          due_date?: string | null;
          order?: number | null;
        };
        Update: {
          project_id?: number;
          milestone_id?: number | null;
          section_id?: number | null;
          title?: string;
          description?: string | null;
          status?: string | null;
          assigned_to?: string | null;
          start_date?: string | null;
          due_date?: string | null;
          order?: number | null;
        };
        Relationships: never[];
      };
      photos: {
        Row: {
          id: number;
          project_id: number;
          url: string;
          caption: string | null;
          tags: string[] | null;
          is_showcase: boolean | null;
          is_before_after: boolean | null;
          planning_board_id: number | null;
          inspiration: boolean | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          url: string;
          caption?: string | null;
          tags?: string[] | null;
          is_showcase?: boolean | null;
          is_before_after?: boolean | null;
          planning_board_id?: number | null;
          inspiration?: boolean | null;
        };
        Update: {
          project_id?: number;
          url?: string;
          caption?: string | null;
          tags?: string[] | null;
          is_showcase?: boolean | null;
          is_before_after?: boolean | null;
          planning_board_id?: number | null;
          inspiration?: boolean | null;
        };
        Relationships: never[];
      };
      documents: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          url: string;
          type: string;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          title: string;
          url: string;
          type: string;
        };
        Update: {
          project_id?: number;
          title?: string;
          url?: string;
          type?: string;
        };
        Relationships: never[];
      };
      messages: {
        Row: {
          id: number;
          project_id: number;
          sender_id: string;
          content: string;
          image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          sender_id: string;
          content: string;
          image_url?: string | null;
        };
        Update: {
          project_id?: number;
          sender_id?: string;
          content?: string;
          image_url?: string | null;
        };
        Relationships: never[];
      };
      checklist_items: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          completed: boolean | null;
          created_by: string | null;
          notes: string | null;
          price_estimate: number | null;
          priority: string | null;
          group: string | null;
          status: string | null;
          color: string | null;
          requires_client: boolean | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          title: string;
          completed?: boolean | null;
          created_by?: string | null;
          notes?: string | null;
          price_estimate?: number | null;
          priority?: string | null;
          group?: string | null;
          status?: string | null;
          color?: string | null;
          requires_client?: boolean | null;
        };
        Update: {
          project_id?: number;
          title?: string;
          completed?: boolean | null;
          created_by?: string | null;
          notes?: string | null;
          price_estimate?: number | null;
          priority?: string | null;
          group?: string | null;
          status?: string | null;
          color?: string | null;
          requires_client?: boolean | null;
        };
        Relationships: never[];
      };
      calendar_events: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          description: string | null;
          date: string;
          end_date: string | null;
          type: string | null;
          image_url: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          title: string;
          description?: string | null;
          date: string;
          end_date?: string | null;
          type?: string | null;
          image_url?: string | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          title?: string;
          description?: string | null;
          date?: string;
          end_date?: string | null;
          type?: string | null;
          image_url?: string | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      activity_log: {
        Row: {
          id: number;
          project_id: number;
          user_id: string | null;
          type: string;
          title: string;
          description: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          user_id?: string | null;
          type: string;
          title: string;
          description?: string | null;
        };
        Update: {
          project_id?: number;
          user_id?: string | null;
          type?: string;
          title?: string;
          description?: string | null;
        };
        Relationships: never[];
      };
      activity_views: {
        Row: {
          id: number;
          activity_id: number;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          activity_id: number;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          activity_id?: number;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: never[];
      };
      decisions: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          decision: string;
          context: string | null;
          decided_on: string;
          decided_by: string | null;
          category: string | null;
          related_milestone_id: number | null;
          attachment_photo_id: number | null;
          archived: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          title: string;
          decision: string;
          context?: string | null;
          decided_on: string;
          decided_by?: string | null;
          category?: string | null;
          related_milestone_id?: number | null;
          attachment_photo_id?: number | null;
          archived?: boolean | null;
        };
        Update: {
          project_id?: number;
          title?: string;
          decision?: string;
          context?: string | null;
          decided_on?: string;
          decided_by?: string | null;
          category?: string | null;
          related_milestone_id?: number | null;
          attachment_photo_id?: number | null;
          archived?: boolean | null;
        };
        Relationships: never[];
      };
      change_orders: {
        Row: {
          id: number;
          project_id: number;
          number: number;
          title: string;
          description: string | null;
          amount: string;
          status: string;
          sent_on: string | null;
          decided_on: string | null;
          decided_by: string | null;
          notes: string | null;
          attachment_document_id: number | null;
          archived: boolean | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          number: number;
          title: string;
          description?: string | null;
          amount: string;
          status: string;
          sent_on?: string | null;
          decided_on?: string | null;
          decided_by?: string | null;
          notes?: string | null;
          attachment_document_id?: number | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          number?: number;
          title?: string;
          description?: string | null;
          amount?: string;
          status?: string;
          sent_on?: string | null;
          decided_on?: string | null;
          decided_by?: string | null;
          notes?: string | null;
          attachment_document_id?: number | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      site_visits: {
        Row: {
          id: number;
          project_id: number;
          visited_on: string;
          visit_type: string;
          attendees: string | null;
          summary: string;
          follow_ups: string | null;
          weather: string | null;
          archived: boolean | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          visited_on: string;
          visit_type: string;
          attendees?: string | null;
          summary: string;
          follow_ups?: string | null;
          weather?: string | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          visited_on?: string;
          visit_type?: string;
          attendees?: string | null;
          summary?: string;
          follow_ups?: string | null;
          weather?: string | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      selections: {
        Row: {
          id: number;
          project_id: number;
          room: string | null;
          category: string | null;
          item: string;
          product: string | null;
          vendor: string | null;
          sku: string | null;
          quantity: string | null;
          status: string;
          lead_time_days: number | null;
          ordered_on: string | null;
          expected_on: string | null;
          installed_on: string | null;
          notes: string | null;
          attachment_photo_id: number | null;
          related_decision_id: number | null;
          archived: boolean | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          room?: string | null;
          category?: string | null;
          item: string;
          product?: string | null;
          vendor?: string | null;
          sku?: string | null;
          quantity?: string | null;
          status: string;
          lead_time_days?: number | null;
          ordered_on?: string | null;
          expected_on?: string | null;
          installed_on?: string | null;
          notes?: string | null;
          attachment_photo_id?: number | null;
          related_decision_id?: number | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          room?: string | null;
          category?: string | null;
          item?: string;
          product?: string | null;
          vendor?: string | null;
          sku?: string | null;
          quantity?: string | null;
          status?: string;
          lead_time_days?: number | null;
          ordered_on?: string | null;
          expected_on?: string | null;
          installed_on?: string | null;
          notes?: string | null;
          attachment_photo_id?: number | null;
          related_decision_id?: number | null;
          archived?: boolean | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      planning_boards: {
        Row: {
          id: number;
          project_id: number;
          name: string;
          mode: string;
          canvas_data: Json | null;
          linked_milestone_id: number | null;
          linked_checklist_item_id: number | null;
          linked_calendar_event_id: number | null;
          linked_user_ids: string[] | null;
          linked_project_ids: number[] | null;
          color_tag_id: number | null;
          updated_at: string | null;
          updated_by: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          name: string;
          mode: string;
          canvas_data?: Json | null;
          linked_milestone_id?: number | null;
          linked_checklist_item_id?: number | null;
          linked_calendar_event_id?: number | null;
          linked_user_ids?: string[] | null;
          linked_project_ids?: number[] | null;
          color_tag_id?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          project_id?: number;
          name?: string;
          mode?: string;
          canvas_data?: Json | null;
          linked_milestone_id?: number | null;
          linked_checklist_item_id?: number | null;
          linked_calendar_event_id?: number | null;
          linked_user_ids?: string[] | null;
          linked_project_ids?: number[] | null;
          color_tag_id?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: never[];
      };
      canvas_elements: {
        Row: {
          id: number;
          board_id: number;
          type: string;
          x: number;
          y: number;
          width: number;
          height: number;
          z_index: number;
          parent_column_id: number | null;
          content: Json | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
          is_mockup: boolean | null;
        };
        Insert: {
          board_id: number;
          type: string;
          x: number;
          y: number;
          width: number;
          height: number;
          z_index: number;
          parent_column_id?: number | null;
          content?: Json | null;
          created_by?: string | null;
          is_mockup?: boolean | null;
        };
        Update: {
          board_id?: number;
          type?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          parent_column_id?: number | null;
          content?: Json | null;
          created_by?: string | null;
          is_mockup?: boolean | null;
        };
        Relationships: never[];
      };
      board_items: {
        Row: {
          id: number;
          project_id: number;
          type: string;
          title: string | null;
          content: string | null;
          image_url: string | null;
          link_url: string | null;
          color: string | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          type: string;
          title?: string | null;
          content?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          color?: string | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          type?: string;
          title?: string | null;
          content?: string | null;
          image_url?: string | null;
          link_url?: string | null;
          color?: string | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      board_snapshots: {
        Row: {
          id: number;
          board_id: number;
          name: string;
          canvas_data: Json;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          board_id: number;
          name: string;
          canvas_data: Json;
          created_by?: string | null;
        };
        Update: {
          board_id?: number;
          name?: string;
          canvas_data?: Json;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      board_templates: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          canvas_data: Json;
          source_board_id: number | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          name: string;
          description?: string | null;
          canvas_data: Json;
          source_board_id?: number | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          canvas_data?: Json;
          source_board_id?: number | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      recent_project_views: {
        Row: {
          id: number;
          user_id: string;
          project_id: number;
          last_board_id: number | null;
          viewed_at: string;
        };
        Insert: {
          user_id: string;
          project_id: number;
          last_board_id?: number | null;
          viewed_at: string;
        };
        Update: {
          user_id?: string;
          project_id?: number;
          last_board_id?: number | null;
          viewed_at?: string;
        };
        Relationships: never[];
      };
      board_presentation_tokens: {
        Row: {
          id: number;
          board_id: number;
          token: string;
          created_by: string | null;
          created_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          board_id: number;
          token: string;
          created_by?: string | null;
          expires_at?: string | null;
        };
        Update: {
          board_id?: number;
          token?: string;
          created_by?: string | null;
          expires_at?: string | null;
        };
        Relationships: never[];
      };
      paint_colors: {
        Row: {
          id: number;
          brand: string;
          name: string;
          code: string;
          hex: string;
          color_family: string;
          collection: string | null;
          lrv: number | null;
          is_popular: boolean | null;
        };
        Insert: {
          brand: string;
          name: string;
          code: string;
          hex: string;
          color_family: string;
          collection?: string | null;
          lrv?: number | null;
          is_popular?: boolean | null;
        };
        Update: {
          brand?: string;
          name?: string;
          code?: string;
          hex?: string;
          color_family?: string;
          collection?: string | null;
          lrv?: number | null;
          is_popular?: boolean | null;
        };
        Relationships: never[];
      };
      cost_categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          default_unit_type: string;
          sort_order: number | null;
        };
        Insert: {
          name: string;
          description?: string | null;
          default_unit_type: string;
          sort_order?: number | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          default_unit_type?: string;
          sort_order?: number | null;
        };
        Relationships: never[];
      };
      market_rates: {
        Row: {
          id: number;
          category_id: number;
          unit_type: string;
          low_rate: string;
          high_rate: string;
          typical_rate: string;
          effective_date: string;
          is_active: boolean | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          category_id: number;
          unit_type: string;
          low_rate: string;
          high_rate: string;
          typical_rate: string;
          effective_date: string;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Update: {
          category_id?: number;
          unit_type?: string;
          low_rate?: string;
          high_rate?: string;
          typical_rate?: string;
          effective_date?: string;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Relationships: never[];
      };
      crew_rates: {
        Row: {
          id: number;
          user_id: string | null;
          name: string;
          role: string | null;
          pay_rate: string;
          billable_rate: string;
          is_active: boolean | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          user_id?: string | null;
          name: string;
          role?: string | null;
          pay_rate: string;
          billable_rate: string;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Update: {
          user_id?: string | null;
          name?: string;
          role?: string | null;
          pay_rate?: string;
          billable_rate?: string;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Relationships: never[];
      };
      subcontractors: {
        Row: {
          id: number;
          business_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          category_id: number | null;
          trade: string | null;
          hourly_rate: string | null;
          daily_rate: string | null;
          unit_rate: string | null;
          unit_type: string | null;
          is_preferred: boolean | null;
          is_active: boolean | null;
          address: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          business_name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          category_id?: number | null;
          trade?: string | null;
          hourly_rate?: string | null;
          daily_rate?: string | null;
          unit_rate?: string | null;
          unit_type?: string | null;
          is_preferred?: boolean | null;
          is_active?: boolean | null;
          address?: string | null;
          notes?: string | null;
        };
        Update: {
          business_name?: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          category_id?: number | null;
          trade?: string | null;
          hourly_rate?: string | null;
          daily_rate?: string | null;
          unit_rate?: string | null;
          unit_type?: string | null;
          is_preferred?: boolean | null;
          is_active?: boolean | null;
          address?: string | null;
          notes?: string | null;
        };
        Relationships: never[];
      };
      suppliers: {
        Row: {
          id: number;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          website: string | null;
          is_preferred: boolean | null;
          is_active: boolean | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          is_preferred?: boolean | null;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          is_preferred?: boolean | null;
          is_active?: boolean | null;
          notes?: string | null;
        };
        Relationships: never[];
      };
      project_estimates: {
        Row: {
          id: number;
          project_id: number;
          name: string;
          status: string;
          approved_at: string | null;
          approved_by: string | null;
          sent_at: string | null;
          revised_from_id: number | null;
          markup_enabled: boolean | null;
          markup_percent: string;
          budget: string | null;
          contingency_percent: string | null;
          management_fee_enabled: boolean | null;
          management_fee_percent: string;
          created_by: string | null;
          created_at: string | null;
          last_audited_at: string | null;
          last_client_reviewed_at: string | null;
        };
        Insert: {
          project_id: number;
          name: string;
          status: string;
          approved_at?: string | null;
          approved_by?: string | null;
          sent_at?: string | null;
          revised_from_id?: number | null;
          markup_enabled?: boolean | null;
          markup_percent: string;
          budget?: string | null;
          contingency_percent?: string | null;
          management_fee_enabled?: boolean | null;
          management_fee_percent: string;
          created_by?: string | null;
          last_audited_at?: string | null;
          last_client_reviewed_at?: string | null;
        };
        Update: {
          project_id?: number;
          name?: string;
          status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          sent_at?: string | null;
          revised_from_id?: number | null;
          markup_enabled?: boolean | null;
          markup_percent?: string;
          budget?: string | null;
          contingency_percent?: string | null;
          management_fee_enabled?: boolean | null;
          management_fee_percent?: string;
          created_by?: string | null;
          last_audited_at?: string | null;
          last_client_reviewed_at?: string | null;
        };
        Relationships: never[];
      };
      estimate_items: {
        Row: {
          id: number;
          estimate_id: number;
          category_id: number | null;
          custom_category: string | null;
          room: string | null;
          product_url: string | null;
          unit_type: string;
          quantity: string;
          unit_cost: string;
          material_cost: string;
          labor_cost: string;
          is_custom_rate: boolean | null;
          market_rate_id: number | null;
          notes: string | null;
          crew_rate_id: number | null;
          subcontractor_id: number | null;
          assembly_id: number | null;
          material_from_assembly: boolean | null;
          ai_suggested: boolean | null;
          created_at: string | null;
        };
        Insert: {
          estimate_id: number;
          category_id?: number | null;
          custom_category?: string | null;
          room?: string | null;
          product_url?: string | null;
          unit_type: string;
          quantity: string;
          unit_cost: string;
          material_cost: string;
          labor_cost: string;
          is_custom_rate?: boolean | null;
          market_rate_id?: number | null;
          notes?: string | null;
          crew_rate_id?: number | null;
          subcontractor_id?: number | null;
          assembly_id?: number | null;
          material_from_assembly?: boolean | null;
          ai_suggested?: boolean | null;
        };
        Update: {
          estimate_id?: number;
          category_id?: number | null;
          custom_category?: string | null;
          room?: string | null;
          product_url?: string | null;
          unit_type?: string;
          quantity?: string;
          unit_cost?: string;
          material_cost?: string;
          labor_cost?: string;
          is_custom_rate?: boolean | null;
          market_rate_id?: number | null;
          notes?: string | null;
          crew_rate_id?: number | null;
          subcontractor_id?: number | null;
          assembly_id?: number | null;
          material_from_assembly?: boolean | null;
          ai_suggested?: boolean | null;
        };
        Relationships: never[];
      };
      estimate_warnings: {
        Row: {
          id: number;
          estimate_item_id: number | null;
          estimate_id: number | null;
          warning_type: string;
          message: string;
          percent_diff: string | null;
          ignored: boolean | null;
          ignored_by: string | null;
          ignored_at: string | null;
          source: string;
        };
        Insert: {
          estimate_item_id?: number | null;
          estimate_id?: number | null;
          warning_type: string;
          message: string;
          percent_diff?: string | null;
          ignored?: boolean | null;
          ignored_by?: string | null;
          ignored_at?: string | null;
          source?: string;
        };
        Update: {
          estimate_item_id?: number | null;
          estimate_id?: number | null;
          warning_type?: string;
          message?: string;
          percent_diff?: string | null;
          ignored?: boolean | null;
          ignored_by?: string | null;
          ignored_at?: string | null;
          source?: string;
        };
        Relationships: never[];
      };
      receipts: {
        Row: {
          id: number;
          project_id: number;
          estimate_item_id: number | null;
          vendor: string;
          description: string | null;
          date: string;
          amount: string;
          file_url: string | null;
          line_items: Json | null;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          estimate_item_id?: number | null;
          vendor: string;
          description?: string | null;
          date: string;
          amount: string;
          file_url?: string | null;
          line_items?: Json | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          estimate_item_id?: number | null;
          vendor?: string;
          description?: string | null;
          date?: string;
          amount?: string;
          file_url?: string | null;
          line_items?: Json | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      supplier_prices: {
        Row: {
          id: number;
          supplier_id: number;
          product_name: string;
          category_id: number | null;
          unit_price: string;
          unit_type: string;
          product_code: string | null;
          product_url: string | null;
          source_receipt_id: number | null;
          notes: string | null;
          last_updated: string | null;
          created_by: string | null;
          created_at: string | null;
          coverage_value: number | null;
          coverage_unit: string | null;
          waste_pct: number | null;
          quality_tier: string | null;
        };
        Insert: {
          supplier_id: number;
          product_name: string;
          category_id?: number | null;
          unit_price: string;
          unit_type: string;
          product_code?: string | null;
          product_url?: string | null;
          source_receipt_id?: number | null;
          notes?: string | null;
          last_updated?: string | null;
          created_by?: string | null;
          coverage_value?: number | null;
          coverage_unit?: string | null;
          waste_pct?: number | null;
          quality_tier?: string | null;
        };
        Update: {
          supplier_id?: number;
          product_name?: string;
          category_id?: number | null;
          unit_price?: string;
          unit_type?: string;
          product_code?: string | null;
          product_url?: string | null;
          source_receipt_id?: number | null;
          notes?: string | null;
          last_updated?: string | null;
          created_by?: string | null;
          coverage_value?: number | null;
          coverage_unit?: string | null;
          waste_pct?: number | null;
          quality_tier?: string | null;
        };
        Relationships: never[];
      };
      regional_modifiers: {
        Row: {
          id: number;
          region: string;
          modifier_type: string;
          name: string;
          value: string | null;
          unit: string | null;
          applies_to: string | null;
          description: string | null;
          source_url: string | null;
          last_verified: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          region: string;
          modifier_type: string;
          name: string;
          value?: string | null;
          unit?: string | null;
          applies_to?: string | null;
          description?: string | null;
          source_url?: string | null;
          last_verified?: string | null;
          is_active?: boolean | null;
        };
        Update: {
          region?: string;
          modifier_type?: string;
          name?: string;
          value?: string | null;
          unit?: string | null;
          applies_to?: string | null;
          description?: string | null;
          source_url?: string | null;
          last_verified?: string | null;
          is_active?: boolean | null;
        };
        Relationships: never[];
      };
      time_entries: {
        Row: {
          id: number;
          project_id: number;
          user_id: string;
          task_id: number | null;
          date: string;
          hours: string;
          start_time: string | null;
          end_time: string | null;
          description: string | null;
          milestone_id: number | null;
          calendar_event_id: number | null;
          status: string;
          pay_period_start: string | null;
          pay_period_end: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string | null;
        };
        Insert: {
          project_id: number;
          user_id: string;
          task_id?: number | null;
          date: string;
          hours: string;
          start_time?: string | null;
          end_time?: string | null;
          description?: string | null;
          milestone_id?: number | null;
          calendar_event_id?: number | null;
          status: string;
          pay_period_start?: string | null;
          pay_period_end?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: {
          project_id?: number;
          user_id?: string;
          task_id?: number | null;
          date?: string;
          hours?: string;
          start_time?: string | null;
          end_time?: string | null;
          description?: string | null;
          milestone_id?: number | null;
          calendar_event_id?: number | null;
          status?: string;
          pay_period_start?: string | null;
          pay_period_end?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Relationships: never[];
      };
      queued_sms: {
        Row: {
          id: number;
          to_phone: string;
          body: string;
          created_at: string | null;
          scheduled_for: string | null;
          sent: boolean | null;
          sent_at: string | null;
          error: string | null;
        };
        Insert: {
          to_phone: string;
          body: string;
          scheduled_for?: string | null;
          sent?: boolean | null;
          sent_at?: string | null;
          error?: string | null;
        };
        Update: {
          to_phone?: string;
          body?: string;
          scheduled_for?: string | null;
          sent?: boolean | null;
          sent_at?: string | null;
          error?: string | null;
        };
        Relationships: never[];
      };
      social_posts: {
        Row: {
          id: number;
          project_id: number;
          title: string;
          copy: string;
          platform: string;
          tone: string | null;
          photo_url: string | null;
          photo_id: number | null;
          status: string;
          source: string | null;
          seen_at: string | null;
          posted_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          title: string;
          copy: string;
          platform: string;
          tone?: string | null;
          photo_url?: string | null;
          photo_id?: number | null;
          status: string;
          source?: string | null;
          seen_at?: string | null;
          posted_at?: string | null;
        };
        Update: {
          project_id?: number;
          title?: string;
          copy?: string;
          platform?: string;
          tone?: string | null;
          photo_url?: string | null;
          photo_id?: number | null;
          status?: string;
          source?: string | null;
          seen_at?: string | null;
          posted_at?: string | null;
        };
        Relationships: never[];
      };
      cinematic_reviews: {
        Row: {
          id: number;
          project_id: number;
          board_id: number | null;
          room_name: string;
          format: string;
          status: string;
          video_url: string | null;
          thumbnail_url: string | null;
          duration_sec: number | null;
          error_message: string | null;
          created_at: string | null;
          created_by: string | null;
        };
        Insert: {
          project_id: number;
          board_id?: number | null;
          room_name: string;
          format: string;
          status: string;
          video_url?: string | null;
          thumbnail_url?: string | null;
          duration_sec?: number | null;
          error_message?: string | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          board_id?: number | null;
          room_name?: string;
          format?: string;
          status?: string;
          video_url?: string | null;
          thumbnail_url?: string | null;
          duration_sec?: number | null;
          error_message?: string | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      room_renders: {
        Row: {
          id: number;
          project_id: number;
          board_id: number | null;
          room_name: string;
          mode: string;
          image_url: string | null;
          thumbnail_url: string | null;
          prompt: string;
          status: string;
          error_message: string | null;
          cost_estimate_cents: number | null;
          created_at: string | null;
          created_by: string | null;
        };
        Insert: {
          project_id: number;
          board_id?: number | null;
          room_name: string;
          mode: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          prompt: string;
          status: string;
          error_message?: string | null;
          cost_estimate_cents?: number | null;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          board_id?: number | null;
          room_name?: string;
          mode?: string;
          image_url?: string | null;
          thumbnail_url?: string | null;
          prompt?: string;
          status?: string;
          error_message?: string | null;
          cost_estimate_cents?: number | null;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      table_redesign_plans: {
        Row: {
          id: number;
          project_id: number;
          piece_type: string;
          piece_name: string;
          before_image_url: string | null;
          inspiration_image_url: string | null;
          concept_image_url: string | null;
          table_shape: string;
          length_inches: number | null;
          width_inches: number | null;
          height_inches: number | null;
          thickness_inches: number | null;
          weight_class: string;
          existing_material: string | null;
          redesign_scope: string;
          proposed_base_type: string | null;
          style_direction: string | null;
          finish_direction: string | null;
          notes: string | null;
          concept_title: string | null;
          concept_description: string | null;
          base_size_min_inches: number | null;
          base_size_max_inches: number | null;
          base_size_notes: string | null;
          build_notes: string | null;
          tag: string | null;
          intended_use: string | null;
          priority_constraint: string | null;
          approval_status: string;
          status: string;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          project_id: number;
          piece_type: string;
          piece_name: string;
          before_image_url?: string | null;
          inspiration_image_url?: string | null;
          concept_image_url?: string | null;
          table_shape: string;
          length_inches?: number | null;
          width_inches?: number | null;
          height_inches?: number | null;
          thickness_inches?: number | null;
          weight_class: string;
          existing_material?: string | null;
          redesign_scope: string;
          proposed_base_type?: string | null;
          style_direction?: string | null;
          finish_direction?: string | null;
          notes?: string | null;
          concept_title?: string | null;
          concept_description?: string | null;
          base_size_min_inches?: number | null;
          base_size_max_inches?: number | null;
          base_size_notes?: string | null;
          build_notes?: string | null;
          tag?: string | null;
          intended_use?: string | null;
          priority_constraint?: string | null;
          approval_status: string;
          status: string;
          created_by?: string | null;
        };
        Update: {
          project_id?: number;
          piece_type?: string;
          piece_name?: string;
          before_image_url?: string | null;
          inspiration_image_url?: string | null;
          concept_image_url?: string | null;
          table_shape?: string;
          length_inches?: number | null;
          width_inches?: number | null;
          height_inches?: number | null;
          thickness_inches?: number | null;
          weight_class?: string;
          existing_material?: string | null;
          redesign_scope?: string;
          proposed_base_type?: string | null;
          style_direction?: string | null;
          finish_direction?: string | null;
          notes?: string | null;
          concept_title?: string | null;
          concept_description?: string | null;
          base_size_min_inches?: number | null;
          base_size_max_inches?: number | null;
          base_size_notes?: string | null;
          build_notes?: string | null;
          tag?: string | null;
          intended_use?: string | null;
          priority_constraint?: string | null;
          approval_status?: string;
          status?: string;
          created_by?: string | null;
        };
        Relationships: never[];
      };
      table_redesign_materials: {
        Row: {
          id: number;
          plan_id: number;
          component: string;
          material: string | null;
          finish: string | null;
          dimensions: string | null;
          quantity: number | null;
          notes: string | null;
          supplier: string | null;
          web_link: string | null;
          created_at: string | null;
        };
        Insert: {
          plan_id: number;
          component: string;
          material?: string | null;
          finish?: string | null;
          dimensions?: string | null;
          quantity?: number | null;
          notes?: string | null;
          supplier?: string | null;
          web_link?: string | null;
        };
        Update: {
          plan_id?: number;
          component?: string;
          material?: string | null;
          finish?: string | null;
          dimensions?: string | null;
          quantity?: number | null;
          notes?: string | null;
          supplier?: string | null;
          web_link?: string | null;
        };
        Relationships: never[];
      };
      client_invites: {
        Row: {
          id: number;
          token: string;
          project_id: number | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          role: string;
          user_id: string | null;
          created_by: string;
          expires_at: string;
          accepted_at: string | null;
          status: string;
          created_at: string | null;
        };
        Insert: {
          token: string;
          project_id?: number | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          role: string;
          user_id?: string | null;
          created_by: string;
          expires_at: string;
          accepted_at?: string | null;
          status: string;
        };
        Update: {
          token?: string;
          project_id?: number | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          role?: string;
          user_id?: string | null;
          created_by?: string;
          expires_at?: string;
          accepted_at?: string | null;
          status?: string;
        };
        Relationships: never[];
      };
      project_wishlist_items: {
        Row: {
          id: number;
          project_id: number;
          user_id: string;
          name: string;
          note: string | null;
          image_url: string | null;
          source_url: string | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          project_id: number;
          user_id: string;
          name: string;
          note?: string | null;
          image_url?: string | null;
          source_url?: string | null;
          category?: string | null;
        };
        Update: {
          project_id?: number;
          user_id?: string;
          name?: string;
          note?: string | null;
          image_url?: string | null;
          source_url?: string | null;
          category?: string | null;
        };
        Relationships: never[];
      };
      material_price_history: {
        Row: {
          id: number;
          material_id: number;
          unit_price: string;
          recorded_at: string;
          notes: string | null;
        };
        Insert: {
          material_id: number;
          unit_price: string;
          recorded_at: string;
          notes?: string | null;
        };
        Update: {
          material_id?: number;
          unit_price?: string;
          recorded_at?: string;
          notes?: string | null;
        };
        Relationships: never[];
      };
      estimate_assemblies: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          category_id: number | null;
          quality_tier: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          category_id?: number | null;
          quality_tier?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          category_id?: number | null;
          quality_tier?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Relationships: never[];
      };
      assembly_materials: {
        Row: {
          id: number;
          assembly_id: number;
          material_id: number | null;
          material_name: string;
          unit_type: string;
          qty_per_sqft: number;
          unit_cost: number;
          waste_pct: number;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          assembly_id: number;
          material_id?: number | null;
          material_name: string;
          unit_type: string;
          qty_per_sqft: number;
          unit_cost: number;
          waste_pct: number;
          notes?: string | null;
          sort_order: number;
        };
        Update: {
          assembly_id?: number;
          material_id?: number | null;
          material_name?: string;
          unit_type?: string;
          qty_per_sqft?: number;
          unit_cost?: number;
          waste_pct?: number;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: never[];
      };
      watcher_alerts: {
        Row: {
          id: string;
          project_id: number;
          category: string;
          title: string;
          description: string | null;
          suggested_action: string | null;
          source_type: string;
          source_id: string;
          status: string;
          priority: string;
          created_at: string;
        };
        Insert: {
          project_id: number;
          category: string;
          title: string;
          description?: string | null;
          suggested_action?: string | null;
          source_type: string;
          source_id: string;
          status?: string;
          priority?: string;
        };
        Update: {
          project_id?: number;
          category?: string;
          title?: string;
          description?: string | null;
          suggested_action?: string | null;
          source_type?: string;
          source_id?: string;
          status?: string;
          priority?: string;
        };
        Relationships: never[];
      };
    };
    Views: {};
    Functions: {
      get_invite_by_token: {
        Args: { p_token: string };
        Returns: {
          first_name: string;
          last_name: string;
          email: string;
          role: string;
          status: string;
          project_id: number | null;
        } | null;
      };
      get_public_presentation: {
        Args: { p_token: string };
        Returns: {
          project: {
            id: number;
            name: string;
            description: string | null;
            address: string | null;
            city: string | null;
            phase: string | null;
            start_date: string | null;
            end_date: string | null;
            thumbnail_url: string | null;
            hero_focal_x: number | null;
            hero_focal_y: number | null;
            hero_zoom: number | null;
          };
          milestones: {
            id: number;
            title: string;
            date: string | null;
            completed: boolean | null;
            order: number | null;
          }[];
          photos: {
            id: number;
            url: string;
            caption: string | null;
          }[];
          selections: {
            id: number;
            name: string;
            supplier_name: string | null;
            category: string | null;
            notes: string | null;
          }[];
        } | null;
      };
    };
    Enums: {};
  };
}

// Convenience row-type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type TenantSettings = Database["public"]["Tables"]["tenant_settings"]["Row"];
export type FeatureFlag = Database["public"]["Tables"]["feature_flags"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type SubMilestone = Database["public"]["Tables"]["sub_milestones"]["Row"];
export type Section = Database["public"]["Tables"]["sections"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Photo = Database["public"]["Tables"]["photos"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type ChecklistItem = Database["public"]["Tables"]["checklist_items"]["Row"];
export type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_log"]["Row"];
export type ActivityView = Database["public"]["Tables"]["activity_views"]["Row"];
export type Decision = Database["public"]["Tables"]["decisions"]["Row"];
export type ChangeOrder = Database["public"]["Tables"]["change_orders"]["Row"];
export type SiteVisit = Database["public"]["Tables"]["site_visits"]["Row"];
export type Selection = Database["public"]["Tables"]["selections"]["Row"];
export type PlanningBoard = Database["public"]["Tables"]["planning_boards"]["Row"];
export type CanvasElement = Database["public"]["Tables"]["canvas_elements"]["Row"];
export type BoardItem = Database["public"]["Tables"]["board_items"]["Row"];
export type BoardSnapshot = Database["public"]["Tables"]["board_snapshots"]["Row"];
export type BoardTemplate = Database["public"]["Tables"]["board_templates"]["Row"];
export type RecentProjectView = Database["public"]["Tables"]["recent_project_views"]["Row"];
export type BoardPresentationToken = Database["public"]["Tables"]["board_presentation_tokens"]["Row"];
export type PaintColor = Database["public"]["Tables"]["paint_colors"]["Row"];
export type CostCategory = Database["public"]["Tables"]["cost_categories"]["Row"];
export type MarketRate = Database["public"]["Tables"]["market_rates"]["Row"];
export type CrewRate = Database["public"]["Tables"]["crew_rates"]["Row"];
export type Subcontractor = Database["public"]["Tables"]["subcontractors"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type ProjectEstimate = Database["public"]["Tables"]["project_estimates"]["Row"];
export type EstimateItem = Database["public"]["Tables"]["estimate_items"]["Row"];
export type EstimateWarning = Database["public"]["Tables"]["estimate_warnings"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type SupplierPrice = Database["public"]["Tables"]["supplier_prices"]["Row"];
export type RegionalModifier = Database["public"]["Tables"]["regional_modifiers"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type QueuedSms = Database["public"]["Tables"]["queued_sms"]["Row"];
export type SocialPost = Database["public"]["Tables"]["social_posts"]["Row"];
export type CinematicReview = Database["public"]["Tables"]["cinematic_reviews"]["Row"];
export type RoomRender = Database["public"]["Tables"]["room_renders"]["Row"];
export type TableRedesignPlan = Database["public"]["Tables"]["table_redesign_plans"]["Row"];
export type TableRedesignMaterial = Database["public"]["Tables"]["table_redesign_materials"]["Row"];
export type ClientInvite = Database["public"]["Tables"]["client_invites"]["Row"];
export type WishlistItem = Database["public"]["Tables"]["project_wishlist_items"]["Row"];
export type MaterialPriceHistory = Database["public"]["Tables"]["material_price_history"]["Row"];
export type EstimateAssembly = Database["public"]["Tables"]["estimate_assemblies"]["Row"];
export type AssemblyMaterial = Database["public"]["Tables"]["assembly_materials"]["Row"];
export type WatcherAlert = Database["public"]["Tables"]["watcher_alerts"]["Row"];
