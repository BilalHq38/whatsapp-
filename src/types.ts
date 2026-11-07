export type UserRole = 'owner' | 'staff' | 'designer' | 'admin';

export type OrderItemStatus =
  | 'New'
  | 'Allotted'
  | 'In progress'
  | 'Submitted'
  | 'Approved'
  | 'Delivered'
  | 'Change requested';

export type WeightUnit = 'gram' | 'tola' | 'masha' | 'ratti';
export type SizeUnit = 'mm' | 'inch' | 'points' | 'number';

export interface SpecValue {
  value: string;
  unit?: string;
}

export type ItemSpecs = Record<string, SpecValue>;

export interface WhatsAppAccount {
  id: string;
  name: string;
  phone_number: string;
  phone_number_id: string;
  business_account_id: string;
  active: boolean;
  app_type: 'whatsapp_business_coexistence' | 'cloud_api_dedicated';
  app_version: string;
  last_keepalive_at: string;
  outbound_messages_month: number;
  free_tier_limit: number;
}

export interface Customer {
  id: string;
  phone: string;
  profile_name: string;
  display_name: string;
  notes: string;
  last_message_at: string;
  created_at: string;
}

export interface MediaFile {
  id: string;
  storage_key: string;
  mime: string;
  size: number;
  sha256: string;
  kind: 'customer' | 'output';
  media_type: 'image' | 'video' | 'audio';
  title: string;
  svg_type?: 'ring' | 'bangle' | 'necklace' | 'earrings' | 'pendant' | 'bracelet' | 'cad_render' | 'video_turntable';
  data_url?: string;
  uploaded_by: string;
  created_at: string;
  duration_sec?: number;
  transcript_preview?: string;
}

export interface WhatsAppMessage {
  id: string;
  account_id: string;
  customer_id: string;
  wa_message_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'audio' | 'video' | 'template';
  text: string;
  media_id?: string;
  reply_to_wa_id?: string;
  timestamp: string;
  order_id?: string;
  item_id?: string;
}

export interface CategoryFieldDefinition {
  id: string;
  category_id: string; // '*' for global fields available to every category
  key: string;
  label_en: string;
  label_ur: string;
  field_type: 'unit_number' | 'text' | 'boolean' | 'select';
  units?: string[];
  options?: string[];
  placeholder?: string;
}

export interface Category {
  id: string;
  name_en: string;
  name_ur: string;
  usage_count: number;
  active: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  order_number: number;
  item_index: number;
  category_id: string;
  designer_id: string | null;
  status: OrderItemStatus;
  specs: ItemSpecs;
  previous_specs: ItemSpecs;
  ai_suggested_specs: ItemSpecs;
  ai_suggested_category_id?: string;
  note: string;
  change_flag: boolean;
  change_note?: string;
  reference_media_ids: string[];
  output_media_ids: string[];
  similar_order_warning?: {
    matched_order_number: number;
    similarity_score: number;
    summary: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  number: number;
  account_id: string;
  customer_id: string;
  source: 'whatsapp' | 'onsite';
  is_draft: boolean;
  mergeable_into_order_id?: string;
  linked_order_id?: string;
  link_type?: 'repeat' | 'revision';
  catalog_book_name?: string;
  catalog_item_number?: string;
  ack_sent: boolean;
  ack_message_text?: string;
  created_by: string;
  created_at: string;
  delivered_at?: string;
  deleted_at?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  specialty?: string;
  active: boolean;
  last_login: string;
}

export interface StatusHistoryEntry {
  id: string;
  item_id: string;
  order_number: number;
  from_status: OrderItemStatus | 'Draft';
  to_status: OrderItemStatus;
  user_id: string;
  user_name: string;
  note?: string;
  at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target: string;
  details: string;
  at: string;
}

export interface AdminAccessLogEntry {
  id: string;
  admin_id: string;
  admin_name: string;
  endpoint: string;
  reason: string;
  at: string;
}

export interface ErrorLogEntry {
  id: string;
  source: 'webhook' | 'media_ffmpeg' | 'whatsapp_send' | 'ai_suggestion' | 'storage';
  message: string;
  context: string;
  resolved: boolean;
  at: string;
}

export interface AIPromptVersion {
  id: string;
  version: number;
  model: string;
  instruction_text: string;
  created_by: string;
  created_at: string;
  active: boolean;
  last_test_accuracy?: number;
}

export interface AICorrection {
  id: string;
  order_number: number;
  item_id: string;
  field_name: string;
  ai_value: string;
  human_value: string;
  corrected_by: string;
  at: string;
}

export interface SystemSettings {
  quiet_period_minutes: number;
  admin_data_access_enabled: boolean;
  followup_text_sets_change_requested: boolean;
  followup_image_creates_draft: boolean;
  auto_urdu_ack_enabled: boolean;
  ack_template_urdu: string;
  closed_window_template: string;
  ai_enabled: boolean;
}
