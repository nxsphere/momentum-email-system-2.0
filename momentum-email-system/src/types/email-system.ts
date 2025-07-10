export type ContactStatus = "active" | "unsubscribed" | "bounced";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled";
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

export interface Contact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status: ContactStatus;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  template_id?: string;
  name: string;
  status: CampaignStatus;
  scheduled_at?: string;
  created_at: string;
  total_recipients: number;
  sent_count: number;
  // Foreign key relations
  email_template?: EmailTemplate;
}

export interface EmailLog {
  id: string;
  campaign_id: string;
  contact_id: string;
  email: string;
  status: EmailLogStatus;
  mailtrap_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounce_reason?: string;
  tracking_data: Record<string, any>;
  // Foreign key relations
  email_campaign?: EmailCampaign;
  contact?: Contact;
}

export interface EmailQueue {
  id: string;
  campaign_id: string;
  contact_id: string;
  email_address: string;
  template_data: Record<string, any>;
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
  id: string;
  campaign_id?: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface RateLimit {
  id: string;
  limit_key: string;
  count: number;
  window_start: string;
  window_duration_minutes: number;
  max_count: number;
  created_at: string;
  updated_at: string;
}

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
}

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

// Input types for creating new records
export interface CreateContact {
  email: string;
  first_name?: string;
  last_name?: string;
  status?: ContactStatus;
  metadata?: Record<string, any>;
}

export interface CreateEmailTemplate {
  name: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  variables?: Record<string, any>;
}

export interface CreateEmailCampaign {
  template_id?: string;
  name: string;
  status?: CampaignStatus;
  scheduled_at?: string;
  total_recipients?: number;
  sent_count?: number;
}

export interface CreateEmailLog {
  campaign_id: string;
  contact_id: string;
  email: string;
  status?: EmailLogStatus;
  mailtrap_message_id?: string;
  tracking_data?: Record<string, any>;
}

export interface CreateEmailQueue {
  campaign_id: string;
  contact_id: string;
  email_address: string;
  template_data?: Record<string, any>;
  status?: EmailQueueStatus;
  priority?: number;
  scheduled_at?: string;
  max_attempts?: number;
}
