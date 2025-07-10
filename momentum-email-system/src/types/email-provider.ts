export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  disposition?: "attachment" | "inline";
  contentId?: string;
}

export interface EmailTemplate {
  id: string;
  variables: Record<string, any>;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  template?: EmailTemplate;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  messageId: string;
  status: "sent" | "queued" | "failed";
  message?: string;
  providerResponse?: any;
}

export interface EmailStatus {
  messageId: string;
  status:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "failed"
    | "spam";
  timestamp: Date;
  events: EmailEvent[];
  metadata?: Record<string, any>;
}

export interface EmailEvent {
  type:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "failed"
    | "spam";
  timestamp: Date;
  data?: Record<string, any>;
}

export interface WebhookEvent {
  messageId: string;
  event: string;
  email: string;
  timestamp: Date;
  data: Record<string, any>;
  signature?: string;
}

export interface EmailProviderConfig {
  apiKey: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

export interface EmailProviderError extends Error {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  providerResponse?: any;
}

export interface EmailProvider {
  name: string;

  // Core email methods
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  getEmailStatus(messageId: string): Promise<EmailStatus>;

  // Webhook handling
  processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
  verifyWebhookSignature(payload: any, signature: string): boolean;

  // Rate limiting
  checkRateLimit(): Promise<RateLimitInfo>;

  // Template support
  validateTemplate(template: EmailTemplate): Promise<boolean>;
  renderTemplate(
    template: EmailTemplate
  ): Promise<{ subject: string; html: string; text: string }>;

  // Provider-specific methods
  getProviderStats?(): Promise<any>;
  healthCheck?(): Promise<boolean>;
}

export interface EmailServiceOptions {
  provider: EmailProvider;
  defaultFrom?: EmailAddress;
  enableRateLimit?: boolean;
  enableRetries?: boolean;
  webhookSecret?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface SendEmailOptions {
  priority?: "high" | "normal" | "low";
  scheduleAt?: Date;
  trackOpens?: boolean;
  trackClicks?: boolean;
  allowRetries?: boolean;
  metadata?: Record<string, any>;
}

export interface EmailServiceStats {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalFailed: number;
  rateLimit: RateLimitInfo;
  lastActivity: Date;
}

// Mailtrap-specific types
export interface MailtrapConfig extends EmailProviderConfig {
  inboxId?: string;
  testMode?: boolean;
}

export interface MailtrapSendResponse {
  message_id: string;
  message_uuid: string;
  message_ids: string[];
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
}

export interface MailtrapErrorResponse {
  error: string;
  message: string;
  status: number;
}
