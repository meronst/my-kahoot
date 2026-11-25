
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "answers": {
                  Row: {
                    "answered_at": string,"id": string,"is_correct": boolean,"option_idx": number,"player_id": string,"points": number,"question_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"id"?: string,"is_correct": boolean,"option_idx": number,"player_id": string,"points"?: number,"question_id": string,"session_id": string
                  }
                  Update: {
                    "answered_at"?: string,"id"?: string,"is_correct"?: boolean,"option_idx"?: number,"player_id"?: string,"points"?: number,"question_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "id": string,"joined_at": string,"nickname": string,"phone": string | null,"phone_consent_at": string | null,"score": number,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"nickname": string,"phone"?: string | null,"phone_consent_at"?: string | null,"score"?: number,"session_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"nickname"?: string,"phone"?: string | null,"phone_consent_at"?: string | null,"score"?: number,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "explanation": string | null,"id": string,"image_path": string | null,"options": NonNullable<Json>,"position": number,"round_id": string,"text": string,"time_limit_sec": number | null,"type": Database["public"]['Enums']["question_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "explanation"?: string | null,"id"?: string,"image_path"?: string | null,"options": NonNullable<Json>,"position": number,"round_id": string,"text": string,"time_limit_sec"?: number | null,"type": Database["public"]['Enums']["question_type"]
                  }
                  Update: {
                    "explanation"?: string | null,"id"?: string,"image_path"?: string | null,"options"?: NonNullable<Json>,"position"?: number,"round_id"?: string,"text"?: string,"time_limit_sec"?: number | null,"type"?: Database["public"]['Enums']["question_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "collect_phone": boolean,"created_at": string,"id": string,"owner_id": string,"scoring_mode": Database["public"]['Enums']["scoring_mode"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collect_phone"?: boolean,"created_at"?: string,"id"?: string,"owner_id"?: string,"scoring_mode"?: Database["public"]['Enums']["scoring_mode"],"title": string
                  }
                  Update: {
                    "collect_phone"?: boolean,"created_at"?: string,"id"?: string,"owner_id"?: string,"scoring_mode"?: Database["public"]['Enums']["scoring_mode"],"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rounds": {
                  Row: {
                    "id": string,"position": number,"quiz_id": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position": number,"quiz_id": string,"title"?: string | null
                  }
                  Update: {
                    "id"?: string,"position"?: number,"quiz_id"?: string,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rounds_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "created_at": string,"expires_at": string,"final_payload": Json | null,"id": string,"pin": string,"question_idx": number,"question_payload": Json | null,"question_started_at": string | null,"quiz_id": string,"reveal_payload": Json | null,"round_idx": number,"status": Database["public"]['Enums']["session_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"final_payload"?: Json | null,"id"?: string,"pin": string,"question_idx"?: number,"question_payload"?: Json | null,"question_started_at"?: string | null,"quiz_id": string,"reveal_payload"?: Json | null,"round_idx"?: number,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"final_payload"?: Json | null,"id"?: string,"pin"?: string,"question_idx"?: number,"question_payload"?: Json | null,"question_started_at"?: string | null,"quiz_id"?: string,"reveal_payload"?: Json | null,"round_idx"?: number,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_finish":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"_lock_hosted_session":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"_show_question":
{ Args: { "p_idx": number,"p_round": number,"p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_session":
{ Args: { "p_quiz_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"duplicate_quiz":
{ Args: { "p_quiz_id": string }; Returns: {
              "collect_phone": boolean,
"created_at": string,
"id": string,
"owner_id": string,
"scoring_mode": Database["public"]['Enums']["scoring_mode"],
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "quizzes"
        isOneToOne: true
        isSetofReturn: false
      } },
"finish_session":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"health":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"import_rounds":
{ Args: { "p_quiz_id": string,"p_rounds": Json }; Returns: number
                           },
"is_host":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_player_in":
{ Args: { "sid": string }; Returns: boolean
                           },
"join_session":
{ Args: { "p_nickname": string,"p_pin": string }; Returns: {
              "id": string,
"joined_at": string,
"nickname": string,
"phone": string | null,
"phone_consent_at": string | null,
"score": number,
"session_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "players"
        isOneToOne: true
        isSetofReturn: false
      } },
"move_question":
{ Args: { "p_direction": number,"p_question_id": string }; Returns: undefined
                           },
"move_round":
{ Args: { "p_direction": number,"p_round_id": string }; Returns: undefined
                           },
"next_question":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"owns_quiz_folder":
{ Args: { "p_object_name": string }; Returns: boolean
                           },
"owns_session":
{ Args: { "sid": string }; Returns: boolean
                           },
"quiz_sequence":
{ Args: { "p_quiz_id": string }; Returns: {
              "question_id": string,"question_idx": number,"round_count": number,"round_idx": number,"round_size": number
            }[]
                           },
"resume_session":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"reveal_question":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"score_answer":
{ Args: { "p_correct": boolean,"p_elapsed_ms": number,"p_limit_sec": number,"p_mode": Database["public"]['Enums']["scoring_mode"] }; Returns: number
                           },
"server_time":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"session_preview":
{ Args: { "p_pin": string }; Returns: {
              "collect_phone": boolean,"is_open": boolean,"quiz_title": string,"session_id": string,"status": Database["public"]['Enums']["session_status"]
            }[]
                           },
"start_session":
{ Args: { "p_session_id": string }; Returns: {
              "created_at": string,
"expires_at": string,
"final_payload": Json | null,
"id": string,
"pin": string,
"question_idx": number,
"question_payload": Json | null,
"question_started_at": string | null,
"quiz_id": string,
"reveal_payload": Json | null,
"round_idx": number,
"status": Database["public"]['Enums']["session_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_answer":
{ Args: { "p_option_idx": number,"p_session_id": string }; Returns: Json
                           },
"valid_options":
{ Args: { "opts": Json,"qtype": Database["public"]['Enums']["question_type"] }; Returns: boolean
                           }
          }
          Enums: {
            "question_type": "mc"|"tf","scoring_mode": "speed"|"points"|"results","session_status": "lobby"|"question"|"reveal"|"paused"|"finished"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "question_type": ["mc", "tf"],"scoring_mode": ["speed", "points", "results"],"session_status": ["lobby", "question", "reveal", "paused", "finished"]
          }
        }
} as const
