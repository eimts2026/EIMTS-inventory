// Generated from the live Eimts-Inventory schema. Regenerate after schema changes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string;
          after_data: Json | null;
          before_data: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          occurred_at: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          after_data?: Json | null;
          before_data?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          occurred_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
        ];
      };
      assets: {
        Row: {
          category: string;
          condition: string;
          cost: number | null;
          created_at: string;
          created_by: string;
          id: string;
          last_verified_at: string | null;
          location_id: string;
          name: string;
          next_verification_on: string | null;
          purchased_on: string | null;
          retired_at: string | null;
          retirement_note: string | null;
          serial: string | null;
          status: string;
          tag: string;
          updated_at: string;
          version: number;
          warranty_until: string | null;
        };
        Insert: {
          category: string;
          condition: string;
          cost?: number | null;
          created_at?: string;
          created_by: string;
          id?: string;
          last_verified_at?: string | null;
          location_id: string;
          name: string;
          next_verification_on?: string | null;
          purchased_on?: string | null;
          retired_at?: string | null;
          retirement_note?: string | null;
          serial?: string | null;
          status?: string;
          tag: string;
          updated_at?: string;
          version?: number;
          warranty_until?: string | null;
        };
        Update: {
          category?: string;
          condition?: string;
          cost?: number | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          last_verified_at?: string | null;
          location_id?: string;
          name?: string;
          next_verification_on?: string | null;
          purchased_on?: string | null;
          retired_at?: string | null;
          retirement_note?: string | null;
          serial?: string | null;
          status?: string;
          tag?: string;
          updated_at?: string;
          version?: number;
          warranty_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "assets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      handovers: {
        Row: {
          accessories: string;
          asset_id: string;
          close_kind: string | null;
          closed_at: string | null;
          closed_by: string | null;
          due_on: string | null;
          filing_location: string;
          id: string;
          issue_condition: string;
          issued_at: string;
          issued_by: string;
          location_id: string;
          paper_reference: string;
          person_id: string;
          return_condition: string | null;
          return_filing: string | null;
          return_location_id: string | null;
          return_reference: string | null;
          signed_received: boolean;
          signed_received_at: string | null;
          signed_received_by: string | null;
          version: number;
        };
        Insert: {
          accessories?: string;
          asset_id: string;
          close_kind?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          due_on?: string | null;
          filing_location?: string;
          id?: string;
          issue_condition: string;
          issued_at?: string;
          issued_by: string;
          location_id: string;
          paper_reference: string;
          person_id: string;
          return_condition?: string | null;
          return_filing?: string | null;
          return_location_id?: string | null;
          return_reference?: string | null;
          signed_received?: boolean;
          signed_received_at?: string | null;
          signed_received_by?: string | null;
          version?: number;
        };
        Update: {
          accessories?: string;
          asset_id?: string;
          close_kind?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          due_on?: string | null;
          filing_location?: string;
          id?: string;
          issue_condition?: string;
          issued_at?: string;
          issued_by?: string;
          location_id?: string;
          paper_reference?: string;
          person_id?: string;
          return_condition?: string | null;
          return_filing?: string | null;
          return_location_id?: string | null;
          return_reference?: string | null;
          signed_received?: boolean;
          signed_received_at?: string | null;
          signed_received_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "handovers_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "asset_register";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "handovers_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "handovers_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_return_location_id_fkey";
            columns: ["return_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_signed_received_by_fkey";
            columns: ["signed_received_by"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
        ];
      };
      it_members: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          role: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          role: string;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          active: boolean;
          branch_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          branch_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          branch_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "locations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          active: boolean;
          created_at: string;
          department: string;
          employee_id: string;
          id: string;
          location_id: string;
          name: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          department: string;
          employee_id: string;
          id?: string;
          location_id: string;
          name: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          department?: string;
          employee_id?: string;
          id?: string;
          location_id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "people_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          id: boolean;
          organisation: string;
          paper_prefix: string;
          updated_at: string;
          verification_days: number;
          version: number;
        };
        Insert: {
          id?: boolean;
          organisation: string;
          paper_prefix: string;
          updated_at?: string;
          verification_days: number;
          version?: number;
        };
        Update: {
          id?: boolean;
          organisation?: string;
          paper_prefix?: string;
          updated_at?: string;
          verification_days?: number;
          version?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      asset_register: {
        Row: {
          active_handover_id: string | null;
          category: string | null;
          condition: string | null;
          cost: number | null;
          created_at: string | null;
          created_by: string | null;
          due_on: string | null;
          id: string | null;
          last_verified_at: string | null;
          location_id: string | null;
          name: string | null;
          next_verification_on: string | null;
          person_id: string | null;
          purchased_on: string | null;
          retired_at: string | null;
          retirement_note: string | null;
          serial: string | null;
          status: string | null;
          tag: string | null;
          updated_at: string | null;
          version: number | null;
          warranty_until: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "it_members";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "assets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handovers_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      inventory_command: {
        Args: { p_action: string; p_data: Json; p_request_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
