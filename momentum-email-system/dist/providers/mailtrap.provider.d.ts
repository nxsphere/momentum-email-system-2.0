import { EmailMessage, EmailProvider, EmailSendResult, EmailStatus, EmailTemplate, MailtrapConfig, RateLimitInfo, WebhookEvent } from "../types/email-provider";
export declare class MailtrapProvider implements EmailProvider {
    name: string;
    private config;
    private rateLimitState;
    private webhookSecret?;
    constructor(config: MailtrapConfig, webhookSecret?: string);
    sendEmail(message: EmailMessage): Promise<EmailSendResult>;
    getEmailStatus(messageId: string): Promise<EmailStatus>;
    processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
    verifyWebhookSignature(payload: any, signature: string): boolean;
    checkRateLimit(): Promise<RateLimitInfo>;
    /**
     * Atomically check and increment rate limit
     * Returns whether the request is allowed
     */
    private checkAndIncrementRateLimit;
    /**
     * Decrement rate limit counter when email sending fails
     */
    private decrementRateLimit;
    validateTemplate(template: EmailTemplate): Promise<boolean>;
    renderTemplate(template: EmailTemplate): Promise<{
        subject: string;
        html: string;
        text: string;
    }>;
    getProviderStats(): Promise<any>;
    healthCheck(): Promise<boolean>;
    private prepareEmailPayload;
    private formatEmailAddress;
    private sendWithRetry;
    private makeHttpRequest;
    private createError;
    private isRetryableStatus;
    private delay;
    private interpolateVariables;
}
