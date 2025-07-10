import { EmailAddress, EmailMessage, EmailSendResult, EmailServiceOptions, EmailServiceStats, EmailStatus, EmailTemplate, RateLimitInfo, SendEmailOptions, WebhookEvent } from "../types/email-provider";
export declare class EmailService {
    private provider;
    private options;
    private stats;
    constructor(options: EmailServiceOptions);
    /**
     * Send an email message with retry logic
     */
    sendEmail(message: EmailMessage, options?: SendEmailOptions): Promise<EmailSendResult>;
    /**
     * Send email once without retry
     */
    private sendEmailOnce;
    /**
     * Send email with exponential backoff retry logic
     */
    private sendEmailWithRetry;
    /**
     * Get email status by message ID
     */
    getEmailStatus(messageId: string): Promise<EmailStatus>;
    /**
     * Process webhook payload with mandatory signature verification
     */
    processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
    /**
     * Check current rate limit status
     */
    checkRateLimit(): Promise<RateLimitInfo>;
    /**
     * Validate email template
     */
    validateTemplate(template: EmailTemplate): Promise<boolean>;
    /**
     * Render email template
     */
    renderTemplate(template: EmailTemplate): Promise<{
        subject: string;
        html: string;
        text: string;
    }>;
    /**
     * Get service statistics
     */
    getStats(): Promise<EmailServiceStats>;
    /**
     * Get provider-specific stats
     */
    getProviderStats(): Promise<any>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Send bulk emails
     */
    sendBulkEmails(messages: EmailMessage[], options?: SendEmailOptions): Promise<EmailSendResult[]>;
    /**
     * Send templated email
     */
    sendTemplatedEmail(template: EmailTemplate, recipients: EmailAddress[], from: EmailAddress, options?: SendEmailOptions): Promise<EmailSendResult[]>;
    /**
     * Create email message builder
     */
    createMessage(): EmailMessageBuilder;
    private validateMessage;
    private updateStats;
    private updateStatsFromWebhook;
    private delay;
}
/**
 * Email message builder for fluent interface
 */
export declare class EmailMessageBuilder {
    private message;
    constructor(defaultFrom?: EmailAddress);
    from(address: EmailAddress): this;
    to(addresses: EmailAddress | EmailAddress[]): this;
    cc(addresses: EmailAddress | EmailAddress[]): this;
    bcc(addresses: EmailAddress | EmailAddress[]): this;
    subject(subject: string): this;
    html(html: string): this;
    text(text: string): this;
    template(template: EmailTemplate): this;
    header(key: string, value: string): this;
    metadata(key: string, value: any): this;
    tag(tag: string): this;
    build(): EmailMessage;
}
