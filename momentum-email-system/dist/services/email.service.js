"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailMessageBuilder = exports.EmailService = void 0;
class EmailService {
    constructor(options) {
        this.provider = options.provider;
        this.options = options;
        this.stats = {
            totalSent: 0,
            totalDelivered: 0,
            totalBounced: 0,
            totalFailed: 0,
            lastActivity: new Date(),
        };
    }
    /**
     * Send an email message with retry logic
     */
    async sendEmail(message, options = {}) {
        // Apply default from address if not provided
        if (!message.from && this.options.defaultFrom) {
            message.from = this.options.defaultFrom;
        }
        // Validate message
        this.validateMessage(message);
        // Add metadata if provided
        if (options.metadata) {
            message.metadata = { ...message.metadata, ...options.metadata };
        }
        // Implement retry logic with exponential backoff
        if (this.options.enableRetries && options.allowRetries !== false) {
            return await this.sendEmailWithRetry(message, options);
        }
        else {
            return await this.sendEmailOnce(message, options);
        }
    }
    /**
     * Send email once without retry
     */
    async sendEmailOnce(message, _options = {}) {
        try {
            // Check rate limiting if enabled
            if (this.options.enableRateLimit) {
                const rateLimitInfo = await this.provider.checkRateLimit();
                if (rateLimitInfo.remaining <= 0) {
                    throw new Error(`Rate limit exceeded. Next reset: ${rateLimitInfo.resetTime.toISOString()}`);
                }
            }
            // Send email
            const result = await this.provider.sendEmail(message);
            // Update stats
            this.updateStats(result);
            // Log if debug mode
            if (this.options.logLevel === "debug") {
                console.log("Email sent:", {
                    messageId: result.messageId,
                    status: result.status,
                });
            }
            return result;
        }
        catch (error) {
            this.stats.totalFailed++;
            this.stats.lastActivity = new Date();
            if (this.options.logLevel &&
                ["debug", "info", "warn", "error"].includes(this.options.logLevel)) {
                console.error("Email send failed:", error);
            }
            throw error;
        }
    }
    /**
     * Send email with exponential backoff retry logic
     */
    async sendEmailWithRetry(message, options = {}, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.sendEmailOnce(message, options);
                // If we succeeded after retries, log it
                if (attempt > 0 && this.options.logLevel === "debug") {
                    console.log(`Email sent successfully on attempt ${attempt + 1}`);
                }
                return result;
            }
            catch (error) {
                lastError = error;
                const emailError = error;
                // Don't retry on non-retryable errors
                if (!emailError.retryable || attempt === maxRetries) {
                    break;
                }
                // Calculate delay with exponential backoff + jitter
                const baseDelay = 1000; // 1 second base delay
                const exponentialDelay = baseDelay * Math.pow(2, attempt);
                const jitter = Math.random() * 1000; // Add up to 1 second jitter
                const totalDelay = exponentialDelay + jitter;
                if (this.options.logLevel === "debug") {
                    console.warn(`Email send failed on attempt ${attempt + 1}/${maxRetries + 1}: ${emailError.message}. Retrying in ${Math.round(totalDelay)}ms...`);
                }
                // Wait before retry
                await this.delay(totalDelay);
                // Handle rate limiting specifically
                if (emailError.code === "RATE_LIMIT_EXCEEDED") {
                    // For rate limiting, wait until reset time if available
                    if (emailError.statusCode === 429) {
                        const rateLimitInfo = await this.provider.checkRateLimit();
                        const timeUntilReset = rateLimitInfo.resetTime.getTime() - Date.now();
                        if (timeUntilReset > 0 && timeUntilReset < 300000) { // Max 5 minutes
                            if (this.options.logLevel === "debug") {
                                console.warn(`Waiting ${Math.round(timeUntilReset / 1000)}s for rate limit reset...`);
                            }
                            await this.delay(timeUntilReset + 1000); // Add 1 second buffer
                        }
                    }
                }
            }
        }
        // All retries failed
        this.stats.totalFailed++;
        this.stats.lastActivity = new Date();
        if (lastError) {
            const emailError = lastError;
            return {
                messageId: "",
                status: "failed",
                message: `Failed after ${maxRetries + 1} attempts: ${emailError.message}`,
                providerResponse: emailError.providerResponse,
            };
        }
        return {
            messageId: "",
            status: "failed",
            message: "Unknown error occurred",
            providerResponse: null,
        };
    }
    /**
     * Get email status by message ID
     */
    async getEmailStatus(messageId) {
        try {
            return await this.provider.getEmailStatus(messageId);
        }
        catch (error) {
            if (this.options.logLevel === "debug") {
                console.error("Failed to get email status:", error);
            }
            throw error;
        }
    }
    /**
     * Process webhook payload with mandatory signature verification
     */
    async processWebhook(payload, signature) {
        try {
            // Mandatory signature verification if webhook secret is configured
            if (this.options.webhookSecret) {
                if (!signature) {
                    throw new Error("Webhook signature is required when webhook secret is configured");
                }
                if (!this.provider.verifyWebhookSignature(payload, signature)) {
                    throw new Error("Invalid webhook signature");
                }
            }
            const webhookEvent = await this.provider.processWebhook(payload, signature);
            // Update stats based on webhook event
            this.updateStatsFromWebhook(webhookEvent);
            if (this.options.logLevel === "debug") {
                console.log("Webhook processed:", webhookEvent);
            }
            return webhookEvent;
        }
        catch (error) {
            if (this.options.logLevel &&
                ["debug", "info", "warn", "error"].includes(this.options.logLevel)) {
                console.error("Webhook processing failed:", error);
            }
            throw error;
        }
    }
    /**
     * Check current rate limit status
     */
    async checkRateLimit() {
        return await this.provider.checkRateLimit();
    }
    /**
     * Validate email template
     */
    async validateTemplate(template) {
        try {
            return await this.provider.validateTemplate(template);
        }
        catch (error) {
            if (this.options.logLevel === "debug") {
                console.error("Template validation failed:", error);
            }
            return false;
        }
    }
    /**
     * Render email template
     */
    async renderTemplate(template) {
        try {
            return await this.provider.renderTemplate(template);
        }
        catch (error) {
            if (this.options.logLevel === "debug") {
                console.error("Template rendering failed:", error);
            }
            throw error;
        }
    }
    /**
     * Get service statistics
     */
    async getStats() {
        const rateLimit = await this.checkRateLimit();
        return {
            totalSent: this.stats.totalSent,
            totalDelivered: this.stats.totalDelivered,
            totalBounced: this.stats.totalBounced,
            totalFailed: this.stats.totalFailed,
            rateLimit,
            lastActivity: this.stats.lastActivity,
        };
    }
    /**
     * Get provider-specific stats
     */
    async getProviderStats() {
        try {
            return await this.provider.getProviderStats?.();
        }
        catch (error) {
            if (this.options.logLevel === "debug") {
                console.error("Failed to get provider stats:", error);
            }
            return null;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            return (await this.provider.healthCheck?.()) || true;
        }
        catch (error) {
            if (this.options.logLevel === "debug") {
                console.error("Health check failed:", error);
            }
            return false;
        }
    }
    /**
     * Send bulk emails
     */
    async sendBulkEmails(messages, options = {}) {
        const results = [];
        // Check rate limit before starting
        if (this.options.enableRateLimit) {
            const rateLimitInfo = await this.checkRateLimit();
            if (rateLimitInfo.remaining < messages.length) {
                throw new Error(`Rate limit exceeded. Can send ${rateLimitInfo.remaining} more emails. Next reset: ${rateLimitInfo.resetTime.toISOString()}`);
            }
        }
        // Send emails sequentially to respect rate limits
        for (const message of messages) {
            const result = await this.sendEmail(message, options);
            results.push(result);
            // Small delay between emails to avoid overwhelming the provider
            await this.delay(100);
        }
        return results;
    }
    /**
     * Send templated email
     */
    async sendTemplatedEmail(template, recipients, from, options = {}) {
        // Validate template first
        const isValidTemplate = await this.validateTemplate(template);
        if (!isValidTemplate) {
            throw new Error("Invalid email template");
        }
        // Render template
        const renderedTemplate = await this.renderTemplate(template);
        // Send to each recipient
        const messages = recipients.map((recipient) => ({
            from,
            to: [recipient],
            subject: renderedTemplate.subject,
            html: renderedTemplate.html,
            text: renderedTemplate.text,
            template,
            metadata: options.metadata,
        }));
        return await this.sendBulkEmails(messages, options);
    }
    /**
     * Create email message builder
     */
    createMessage() {
        return new EmailMessageBuilder(this.options.defaultFrom);
    }
    // Private methods
    validateMessage(message) {
        if (!message.from) {
            throw new Error("From address is required");
        }
        if (!message.to || message.to.length === 0) {
            throw new Error("At least one recipient is required");
        }
        if (!message.subject) {
            throw new Error("Subject is required");
        }
        if (!message.html && !message.text && !message.template) {
            throw new Error("Email content (html, text, or template) is required");
        }
        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(message.from.email)) {
            throw new Error("Invalid from email address");
        }
        for (const recipient of message.to) {
            if (!emailRegex.test(recipient.email)) {
                throw new Error(`Invalid recipient email address: ${recipient.email}`);
            }
        }
        if (message.cc) {
            for (const cc of message.cc) {
                if (!emailRegex.test(cc.email)) {
                    throw new Error(`Invalid CC email address: ${cc.email}`);
                }
            }
        }
        if (message.bcc) {
            for (const bcc of message.bcc) {
                if (!emailRegex.test(bcc.email)) {
                    throw new Error(`Invalid BCC email address: ${bcc.email}`);
                }
            }
        }
    }
    updateStats(result) {
        this.stats.lastActivity = new Date();
        if (result.status === "sent" || result.status === "queued") {
            this.stats.totalSent++;
        }
        else if (result.status === "failed") {
            this.stats.totalFailed++;
        }
    }
    updateStatsFromWebhook(webhookEvent) {
        this.stats.lastActivity = new Date();
        switch (webhookEvent.event) {
            case "delivered":
                this.stats.totalDelivered++;
                break;
            case "bounced":
                this.stats.totalBounced++;
                break;
            case "failed":
                this.stats.totalFailed++;
                break;
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.EmailService = EmailService;
/**
 * Email message builder for fluent interface
 */
class EmailMessageBuilder {
    constructor(defaultFrom) {
        this.message = {
            from: defaultFrom,
            to: [],
            cc: [],
            bcc: [],
            headers: {},
            metadata: {},
        };
    }
    from(address) {
        this.message.from = address;
        return this;
    }
    to(addresses) {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];
        this.message.to = [...(this.message.to || []), ...addressArray];
        return this;
    }
    cc(addresses) {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];
        this.message.cc = [...(this.message.cc || []), ...addressArray];
        return this;
    }
    bcc(addresses) {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];
        this.message.bcc = [...(this.message.bcc || []), ...addressArray];
        return this;
    }
    subject(subject) {
        this.message.subject = subject;
        return this;
    }
    html(html) {
        this.message.html = html;
        return this;
    }
    text(text) {
        this.message.text = text;
        return this;
    }
    template(template) {
        this.message.template = template;
        return this;
    }
    header(key, value) {
        this.message.headers = { ...this.message.headers, [key]: value };
        return this;
    }
    metadata(key, value) {
        this.message.metadata = { ...this.message.metadata, [key]: value };
        return this;
    }
    tag(tag) {
        this.message.tags = [...(this.message.tags || []), tag];
        return this;
    }
    build() {
        if (!this.message.from || !this.message.to || !this.message.subject) {
            throw new Error("From, to, and subject are required");
        }
        return this.message;
    }
}
exports.EmailMessageBuilder = EmailMessageBuilder;
//# sourceMappingURL=email.service.js.map