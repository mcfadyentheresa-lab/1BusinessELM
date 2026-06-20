export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["projects"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["milestones"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tasks"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["photos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
      };
      messages: {
        Row: {
          id: number;
          project_id: number;
          sender_id: string;
          content: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["planning_boards"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["planning_boards"]["Insert"]>;
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["canvas_elements"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["canvas_elements"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["paint_colors"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["paint_colors"]["Insert"]>;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["project_estimates"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["project_estimates"]["Insert"]>;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["time_entries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Insert"]>;
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tenant_settings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tenant_settings"]["Insert"]>;
      };
      client_invites: {
        Row: {
          id: number;
          token: string;
          project_id: number;
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["client_invites"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["client_invites"]["Insert"]>;
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
        Insert: Omit<Database["public"]["Tables"]["project_wishlist_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["project_wishlist_items"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Photo = Database["public"]["Tables"]["photos"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type PlanningBoard = Database["public"]["Tables"]["planning_boards"]["Row"];
export type CanvasElement = Database["public"]["Tables"]["canvas_elements"]["Row"];
export type PaintColor = Database["public"]["Tables"]["paint_colors"]["Row"];
export type ProjectEstimate = Database["public"]["Tables"]["project_estimates"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type TenantSettings = Database["public"]["Tables"]["tenant_settings"]["Row"];
export type ClientInvite = Database["public"]["Tables"]["client_invites"]["Row"];
export type WishlistItem = Database["public"]["Tables"]["project_wishlist_items"]["Row"];
