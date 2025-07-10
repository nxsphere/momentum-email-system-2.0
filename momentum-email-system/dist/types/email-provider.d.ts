/// <reference types="node" />
/// <reference types="node" />
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {
}
export type UUID = string & {
    readonly brand: unique symbol;
};
export declare const UUID: {
    /**
     * Validates if a string is a valid UUID format
     */
    isValid(value: string): value is UUID;
    /**
     * Creates a UUID type from a validated string
     */
    from(value: string): UUID;
    /**
     * Creates a UUID type from any string (for testing)
     */
    fromString(value: string): UUID;
    /**
     * Generates a new UUID (requires external uuid library)
     */
    generate(): UUID;
};
export interface ProviderApiResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: JsonValue;
}
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
    variables: JsonObject;
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
    metadata?: JsonObject;
}
export interface EmailSendResult {
    messageId: string;
    status: "sent" | "queued" | "failed";
    message?: string;
    providerResponse?: ProviderApiResponse;
}
export interface EmailStatus {
    messageId: string;
    status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed" | "spam";
    timestamp: Date;
    events: EmailEvent[];
    metadata?: JsonObject;
}
export interface EmailEvent {
    type: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed" | "spam";
    timestamp: Date;
    data?: JsonObject;
}
export interface WebhookEvent {
    messageId: string;
    event: string;
    email: string;
    timestamp: Date;
    data: JsonObject;
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
    providerResponse?: ProviderApiResponse;
}
export interface EmailProvider {
    name: string;
    sendEmail(message: EmailMessage): Promise<EmailSendResult>;
    getEmailStatus(messageId: string): Promise<EmailStatus>;
    processWebhook(payload: JsonValue, signature?: string): Promise<WebhookEvent>;
    verifyWebhookSignature(payload: JsonValue, signature: string): boolean;
    checkRateLimit(): Promise<RateLimitInfo>;
    validateTemplate(template: EmailTemplate): Promise<boolean>;
    renderTemplate(template: EmailTemplate): Promise<{
        subject: string;
        html: string;
        text: string;
    }>;
    getProviderStats?(): Promise<ProviderApiResponse>;
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
    metadata?: JsonObject;
}
export interface EmailServiceStats {
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalFailed: number;
    rateLimit: RateLimitInfo;
    lastActivity: Date;
}
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
    custom_variables?: JsonObject;
}
export interface MailtrapErrorResponse {
    error: string;
    message: string;
    status: number;
}
export interface MailtrapProviderStats {
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalFailed: number;
    rateLimit: RateLimitInfo;
    apiEndpoint: string;
    healthStatus: boolean;
    lastActivity: Date;
}
