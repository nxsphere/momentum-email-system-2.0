import { JsonObject, UUID } from './email-provider';

// Re-export UUID for use in other modules
export { UUID } from './email-provider';

// Type alias for testing
export type TestUUID = string;

// Helper function to convert string to UUID for tests
export const createTestUUID = (value: string): UUID => value as UUID;

export type ContactStatus = "active" | "unsubscribed" | "bounced";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled"
  | "paused";
export type EmailLogStatus =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed";
export type EmailQueueStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";
export type LogLevel = "debug" | "info" | "warning" | "error";

// New types for contact lists and segments
export type SegmentType = "static" | "dynamic";
export type ContactListType = "manual" | "imported" | "generated" | "static";

export interface Contact {
  id: UUID;
  email: string;
  first_name?: string;
  last_name?: string;
  status: ContactStatus;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: UUID;
  name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables: JsonObject;
  created_at: string;
  updated_at: string;
}

// Enhanced Email Campaign interface
export interface EmailCampaign {
  id: UUID;
  template_id?: UUID;
  name: string;
  status: CampaignStatus;
  scheduled_at?: string;
  created_at: string;
  total_recipients: number;
  sent_count: number;
  // New enhanced fields
  segment_id?: UUID;
  contact_list_id?: UUID;
  from_email: string;
  from_name: string;
  subject?: string;
  priority: number;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  paused_reason?: string;
  // Foreign key relations
  email_template?: EmailTemplate;
  segment?: Segment;
  contact_list?: ContactList;
}

// Contact List interfaces
export interface ContactList {
  id: UUID;
  name: string;
  description?: string;
  type: ContactListType;
  total_contacts: number;
  active_contacts: number;
  created_by?: UUID;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface ContactListMembership {
  id: UUID;
  contact_id: UUID;
  list_id: UUID;
  added_at: string;
  added_by?: UUID;
  // Foreign key relations
  contact?: Contact;
  contact_list?: ContactList;
}

// Segment interfaces
export interface Segment {
  id: UUID;
  name: string;
  description?: string;
  type: SegmentType;
  filter_criteria: JsonObject;
  contact_list_id?: UUID;
  total_contacts: number;
  active_contacts: number;
  last_calculated_at?: string;
  created_by?: UUID;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
  // Foreign key relations
  contact_list?: ContactList;
}

export interface ContactSegment {
  id: UUID;
  contact_id: UUID;
  segment_id: UUID;
  added_at: string;
  calculated_at: string;
  // Foreign key relations
  contact?: Contact;
  segment?: Segment;
}

export interface EmailLog {
  id: UUID;
  campaign_id: UUID;
  contact_id: UUID;
  email: string;
  status: EmailLogStatus;
  mailtrap_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounce_reason?: string;
  tracking_data: JsonObject;
  // Foreign key relations
  email_campaign?: EmailCampaign;
  contact?: Contact;
}

export interface EmailQueue {
  id: UUID;
  campaign_id: UUID;
  contact_id: UUID;
  email_address: string;
  template_data: JsonObject;
  status: EmailQueueStatus;
  priority: number;
  scheduled_at: string;
  processed_at?: string;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  created_at: string;
}

export interface CampaignLog {
  id: UUID;
  campaign_id?: UUID;
  level: LogLevel;
  message: string;
  metadata: JsonObject;
  created_at: string;
}

export interface RateLimit {
  id: UUID;
  limit_key: string;
  count: number;
  window_start: string;
  window_duration_minutes: number;
  max_count: number;
  created_at: string;
  updated_at: string;
}

// Enhanced Campaign Stats interface
export interface CampaignStats {
  campaign_name: string;
  campaign_status: CampaignStatus;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_failed: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  queue_pending: number;
  queue_failed: number;
  last_activity?: string;
  // Real-time stats
  progress_percentage: number;
  estimated_completion?: string;
  current_send_rate?: number;
}

// Enhanced Result interfaces
export interface ProcessQueueResult {
  processed_count: number;
  failed_count: number;
  remaining_count: number;
}

export interface StartCampaignResult {
  success: boolean;
  message: string;
  queued_emails: number;
}

export interface UpdateEmailStatusResult {
  success: boolean;
  message: string;
}

export interface HandleBounceResult {
  success: boolean;
  message: string;
  action_taken: string;
}

export interface CleanupResult {
  logs_deleted: number;
  queue_deleted: number;
}

// Contact List Management Results
export interface AddContactsToListResult {
  added_count: number;
  skipped_count: number;
  not_found_count: number;
}

export interface CalculateSegmentResult {
  segment_id: UUID;
  contacts_added: number;
  calculation_time: number;
}

// Campaign Management Results
export interface CampaignValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PauseCampaignResult {
  success: boolean;
  message: string;
  paused_at: string;
  emails_paused: number;
}

export interface ResumeCampaignResult {
  success: boolean;
  message: string;
  resumed_at: string;
  emails_resumed: number;
}

export interface DuplicateCampaignResult {
  success: boolean;
  message: string;
  new_campaign_id: UUID;
  original_campaign_id: UUID;
}

// Input types for creating new records
export interface CreateContact {
  email: string;
  first_name?: string;
  last_name?: string;
  status?: ContactStatus;
  metadata?: JsonObject;
}

export interface CreateEmailTemplate {
  name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables?: JsonObject;
}

// Enhanced Create Campaign interface
export interface CreateEmailCampaign {
  template_id?: UUID;
  name: string;
  status?: CampaignStatus;
  scheduled_at?: string;
  total_recipients?: number;
  sent_count?: number;
  // Enhanced fields
  segment_id?: UUID;
  contact_list_id?: UUID;
  from_email?: string;
  from_name?: string;
  subject?: string;
  priority?: number;
}

export interface CreateEmailLog {
  campaign_id: UUID;
  contact_id: UUID;
  email: string;
  status?: EmailLogStatus;
  mailtrap_message_id?: string;
  tracking_data?: JsonObject;
}

export interface CreateEmailQueue {
  campaign_id: UUID;
  contact_id: UUID;
  email_address: string;
  template_data?: JsonObject;
  status?: EmailQueueStatus;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}

// Contact List Management types
export interface CreateContactList {
  name: string;
  description?: string;
  type?: ContactListType;
  created_by?: UUID;
  metadata?: JsonObject;
}

export interface CreateSegment {
  name: string;
  description?: string;
  type?: SegmentType;
  filter_criteria?: JsonObject;
  contact_list_id?: UUID;
  created_by?: UUID;
  metadata?: JsonObject;
}

// Filter interfaces for advanced querying
export interface ContactFilter {
  status?: ContactStatus[];
  created_after?: string;
  created_before?: string;
  has_metadata?: string[];
  metadata_filters?: JsonObject;
  in_lists?: UUID[];
  in_segments?: UUID[];
  email_contains?: string;
  name_contains?: string;
}

export interface CampaignFilter {
  status?: CampaignStatus[];
  created_after?: string;
  created_before?: string;
  template_ids?: UUID[];
  segment_ids?: UUID[];
  contact_list_ids?: UUID[];
  priority_min?: number;
  priority_max?: number;
}

export interface SegmentFilter {
  type?: SegmentType[];
  contact_list_ids?: UUID[];
  has_criteria?: string[];
  calculated_after?: string;
  min_contacts?: number;
  max_contacts?: number;
}

// Pagination interface
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  order_by?: string;
  order_direction?: 'asc' | 'desc';
}

// Real-time monitoring interfaces
export interface CampaignMonitoringEvent {
  campaign_id: UUID;
  event_type: 'started' | 'paused' | 'resumed' | 'completed' | 'failed' | 'progress';
  timestamp: string;
  data: JsonObject;
}

export interface RealTimeStats {
  campaign_id: UUID;
  current_status: CampaignStatus;
  emails_sent: number;
  emails_pending: number;
  emails_failed: number;
  send_rate_per_minute: number;
  last_email_sent_at?: string;
  estimated_completion?: string;
}

// Validation interfaces
export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  value?: any;
}

export interface CampaignValidationRules {
  template_required: boolean;
  recipients_required: boolean;
  scheduled_date_future: boolean;
  valid_email_addresses: boolean;
  max_recipients?: number;
  min_subject_length?: number;
  max_subject_length?: number;
}

// Bulk operation interfaces
export interface BulkContactOperation {
  operation: 'add_to_list' | 'remove_from_list' | 'add_to_segment' | 'update_status';
  contact_ids: UUID[];
  target_id?: UUID; // List or segment ID
  new_status?: ContactStatus;
}

export interface BulkOperationResult {
  success_count: number;
  error_count: number;
  errors: Array<{ contact_id: UUID; error: string }>;
}

// Webhook-related types
export interface WebhookEvent {
  id: UUID;
  provider: string;
  event_type: string;
  message_id?: string;
  email?: string;
  payload: JsonObject;
  signature?: string;
  processed_successfully: boolean;
  duplicate_count: number;
  received_at: string;
  processed_at?: string;
  error_message?: string;
}

export interface MailtrapWebhookPayload {
  message_id: string;
  inbox_id: number;
  email: string;
  event: string;
  timestamp: number;
  response?: string;
  category?: string;
  custom_variables?: Record<string, any>;
  user_agent?: string;
  ip?: string;
  location?: string;
  bounce_type?: 'hard' | 'soft';
  bounce_reason?: string;
  bounce_code?: string;
  url?: string; // For click events
  unsubscribe_type?: 'automatic' | 'manual';
}

export interface WebhookProcessingResult {
  success: boolean;
  event_id?: string;
  message: string;
  actions_performed?: string[];
  duplicate_detected?: boolean;
  error?: string;
}

export interface ContactStatusUpdate {
  contact_id: UUID;
  old_status: ContactStatus;
  new_status: ContactStatus;
  reason: string;
  updated_at: string;
}

export interface AutomatedAction {
  action_type: 'update_contact_status' | 'add_to_segment' | 'remove_from_list' | 'trigger_campaign';
  target_id: UUID;
  metadata: JsonObject;
  triggered_by: string;
  triggered_at: string;
}
