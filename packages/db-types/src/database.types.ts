export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
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
  public: {
    Tables: {
      collection: {
        Row: {
          cover_image_path: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          cover_image_path?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          cover_image_path?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collection_recipe: {
        Row: {
          added_at: string;
          collection_id: string;
          owner_id: string;
          position: number;
          recipe_id: string;
        };
        Insert: {
          added_at?: string;
          collection_id: string;
          owner_id?: string;
          position?: number;
          recipe_id: string;
        };
        Update: {
          added_at?: string;
          collection_id?: string;
          owner_id?: string;
          position?: number;
          recipe_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_recipe_collection_id_owner_id_fkey';
            columns: ['collection_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'collection';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'collection_recipe_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      cook_log: {
        Row: {
          cooked_at: string;
          id: string;
          notes: string | null;
          recipe_id: string;
          user_id: string;
        };
        Insert: {
          cooked_at?: string;
          id?: string;
          notes?: string | null;
          recipe_id: string;
          user_id?: string;
        };
        Update: {
          cooked_at?: string;
          id?: string;
          notes?: string | null;
          recipe_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cook_log_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id'];
          },
        ];
      };
      glossary_term: {
        Row: {
          aliases: string[];
          definition: string;
          id: string;
          match_rules: NonNullable<Json>;
          plain_phrasing: string | null;
          slug: string;
          term: string;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          definition: string;
          id?: string;
          match_rules?: NonNullable<Json>;
          plain_phrasing?: string | null;
          slug: string;
          term: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          definition?: string;
          id?: string;
          match_rules?: NonNullable<Json>;
          plain_phrasing?: string | null;
          slug?: string;
          term?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredient: {
        Row: {
          id: string;
          item: string;
          note: string | null;
          optional: boolean;
          owner_id: string;
          position: number;
          prep_note: string | null;
          qty_max: number | null;
          qty_min: number | null;
          raw_text: string;
          recipe_id: string;
          section_id: string;
          section_kind: Database['public']['Enums']['section_kind'];
          unit: string | null;
        };
        Insert: {
          id: string;
          item: string;
          note?: string | null;
          optional?: boolean;
          owner_id?: string;
          position: number;
          prep_note?: string | null;
          qty_max?: number | null;
          qty_min?: number | null;
          raw_text: string;
          recipe_id: string;
          section_id: string;
          section_kind?: Database['public']['Enums']['section_kind'];
          unit?: string | null;
        };
        Update: {
          id?: string;
          item?: string;
          note?: string | null;
          optional?: boolean;
          owner_id?: string;
          position?: number;
          prep_note?: string | null;
          qty_max?: number | null;
          qty_min?: number | null;
          raw_text?: string;
          recipe_id?: string;
          section_id?: string;
          section_kind?: Database['public']['Enums']['section_kind'];
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ingredient_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'ingredient_section_id_recipe_id_section_kind_fkey';
            columns: ['section_id', 'recipe_id', 'section_kind'];
            isOneToOne: false;
            referencedRelation: 'recipe_section';
            referencedColumns: ['id', 'recipe_id', 'kind'];
          },
        ];
      };
      recipe: {
        Row: {
          cook_min: number | null;
          created_at: string;
          description: string | null;
          hero_image_path: string | null;
          id: string;
          owner_id: string;
          prep_min: number | null;
          search: unknown;
          servings: number | null;
          source_attribution: string | null;
          source_type: Database['public']['Enums']['source_type'];
          source_url: string | null;
          title: string;
          total_min: number | null;
          unit_system: Database['public']['Enums']['unit_system'];
          updated_at: string;
          visibility: Database['public']['Enums']['visibility'];
          yield_text: string | null;
        };
        Insert: {
          cook_min?: number | null;
          created_at?: string;
          description?: string | null;
          hero_image_path?: string | null;
          id?: string;
          owner_id?: string;
          prep_min?: number | null;
          search?: unknown;
          servings?: number | null;
          source_attribution?: string | null;
          source_type?: Database['public']['Enums']['source_type'];
          source_url?: string | null;
          title: string;
          total_min?: number | null;
          unit_system?: Database['public']['Enums']['unit_system'];
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
          yield_text?: string | null;
        };
        Update: {
          cook_min?: number | null;
          created_at?: string;
          description?: string | null;
          hero_image_path?: string | null;
          id?: string;
          owner_id?: string;
          prep_min?: number | null;
          search?: unknown;
          servings?: number | null;
          source_attribution?: string | null;
          source_type?: Database['public']['Enums']['source_type'];
          source_url?: string | null;
          title?: string;
          total_min?: number | null;
          unit_system?: Database['public']['Enums']['unit_system'];
          updated_at?: string;
          visibility?: Database['public']['Enums']['visibility'];
          yield_text?: string | null;
        };
        Relationships: [];
      };
      recipe_section: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['section_kind'];
          owner_id: string;
          position: number;
          recipe_id: string;
          title: string | null;
        };
        Insert: {
          id: string;
          kind: Database['public']['Enums']['section_kind'];
          owner_id?: string;
          position: number;
          recipe_id: string;
          title?: string | null;
        };
        Update: {
          id?: string;
          kind?: Database['public']['Enums']['section_kind'];
          owner_id?: string;
          position?: number;
          recipe_id?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_section_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      recipe_tag: {
        Row: {
          owner_id: string;
          recipe_id: string;
          tag_id: string;
        };
        Insert: {
          owner_id?: string;
          recipe_id: string;
          tag_id: string;
        };
        Update: {
          owner_id?: string;
          recipe_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_tag_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'recipe_tag_tag_id_owner_id_fkey';
            columns: ['tag_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'tag';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      source_asset: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['asset_kind'];
          ocr_text: string | null;
          owner_id: string;
          recipe_id: string;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['asset_kind'];
          ocr_text?: string | null;
          owner_id?: string;
          recipe_id: string;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['asset_kind'];
          ocr_text?: string | null;
          owner_id?: string;
          recipe_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'source_asset_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      step: {
        Row: {
          glossary_suppress: string[];
          id: string;
          image_path: string | null;
          owner_id: string;
          position: number;
          recipe_id: string;
          section_id: string;
          section_kind: Database['public']['Enums']['section_kind'];
          text: string;
        };
        Insert: {
          glossary_suppress?: string[];
          id: string;
          image_path?: string | null;
          owner_id?: string;
          position: number;
          recipe_id: string;
          section_id: string;
          section_kind?: Database['public']['Enums']['section_kind'];
          text: string;
        };
        Update: {
          glossary_suppress?: string[];
          id?: string;
          image_path?: string | null;
          owner_id?: string;
          position?: number;
          recipe_id?: string;
          section_id?: string;
          section_kind?: Database['public']['Enums']['section_kind'];
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'step_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'step_section_id_recipe_id_section_kind_fkey';
            columns: ['section_id', 'recipe_id', 'section_kind'];
            isOneToOne: false;
            referencedRelation: 'recipe_section';
            referencedColumns: ['id', 'recipe_id', 'kind'];
          },
        ];
      };
      step_ingredient: {
        Row: {
          amount_fraction: number;
          ingredient_id: string;
          owner_id: string;
          recipe_id: string;
          step_id: string;
        };
        Insert: {
          amount_fraction?: number;
          ingredient_id: string;
          owner_id?: string;
          recipe_id: string;
          step_id: string;
        };
        Update: {
          amount_fraction?: number;
          ingredient_id?: string;
          owner_id?: string;
          recipe_id?: string;
          step_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'step_ingredient_ingredient_id_recipe_id_fkey';
            columns: ['ingredient_id', 'recipe_id'];
            isOneToOne: false;
            referencedRelation: 'ingredient';
            referencedColumns: ['id', 'recipe_id'];
          },
          {
            foreignKeyName: 'step_ingredient_recipe_id_owner_id_fkey';
            columns: ['recipe_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'step_ingredient_step_id_recipe_id_fkey';
            columns: ['step_id', 'recipe_id'];
            isOneToOne: false;
            referencedRelation: 'step';
            referencedColumns: ['id', 'recipe_id'];
          },
        ];
      };
      tag: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['tag_kind'];
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      user_recipe_meta: {
        Row: {
          favourite: boolean;
          notes: string | null;
          rating: number | null;
          recipe_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          favourite?: boolean;
          notes?: string | null;
          rating?: number | null;
          recipe_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          favourite?: boolean;
          notes?: string | null;
          rating?: number | null;
          recipe_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_recipe_meta_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipe';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      recipe_search_vector: {
        Args: { p_description: string; p_recipe_id: string; p_title: string };
        Returns: unknown;
      };
      save_recipe: { Args: { draft: Json }; Returns: string };
    };
    Enums: {
      asset_kind: 'scan' | 'photo';
      section_kind: 'ingredients' | 'steps';
      source_type: 'manual' | 'url' | 'text' | 'scan' | 'ai';
      tag_kind: 'cuisine' | 'course' | 'diet' | 'custom';
      unit_system: 'metric' | 'us' | 'mixed';
      visibility: 'private' | 'unlisted' | 'public';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_kind: ['scan', 'photo'],
      section_kind: ['ingredients', 'steps'],
      source_type: ['manual', 'url', 'text', 'scan', 'ai'],
      tag_kind: ['cuisine', 'course', 'diet', 'custom'],
      unit_system: ['metric', 'us', 'mixed'],
      visibility: ['private', 'unlisted', 'public'],
    },
  },
} as const;
