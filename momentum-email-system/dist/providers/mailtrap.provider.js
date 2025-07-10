"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailtrapProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
class MailtrapProvider {
    constructor(config, webhookSecret) {
        this.name = "Mailtrap";
        this.config = {
            apiUrl: "https://send.api.mailtrap.io/api/send",
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            rateLimit: {
                maxRequests: 200,
                windowMs: 60 * 60 * 1000, // 1 hour
            },
            ...config,
        };
        this.rateLimitState = {
            count: 0,
            windowStart: new Date(),
            windowMs: this.config.rateLimit?.windowMs || 60 * 60 * 1000,
            limit: this.config.rateLimit?.maxRequests || 200,
            mutex: false, // Initialize mutex
        };
        this.webhookSecret = webhookSecret;
    }
    async sendEmail(message) {
        try {
            // Check and increment rate limit atomically
            const rateLimitResult = await this.checkAndIncrementRateLimit();
            if (!rateLimitResult.allowed) {
                throw this.createError(`Rate limit exceeded. ${rateLimitResult.remaining} requests remaining. Reset at: ${rateLimitResult.resetTime.toISOString()}`, "RATE_LIMIT_EXCEEDED", 429, true // Make it retryable with backoff
                );
            }
            // Prepare the email payload
            const payload = this.prepareEmailPayload(message);
            // Send with retry logic
            const response = await this.sendWithRetry(payload);
            return {
                messageId: response.message_id || response.message_uuid,
                status: "sent",
                message: "Email sent successfully",
                providerResponse: {
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    data: response,
                },
            };
        }
        catch (error) {
            // If email sending failed, decrement the rate limit counter
            this.decrementRateLimit();
            const emailError = error;
            return {
                messageId: "",
                status: "failed",
                message: emailError.message,
                providerResponse: emailError.providerResponse,
            };
        }
    }
    async getEmailStatus(messageId) {
        try {
            // Note: Mailtrap doesn't have a direct status API, so we'll return a basic status
            // In a real implementation, you'd need to track status via webhooks
            return {
                messageId,
                status: "sent",
                timestamp: new Date(),
                events: [
                    {
                        type: "sent",
                        timestamp: new Date(),
                        data: { provider: "Mailtrap" },
                    },
                ],
            };
        }
        catch (error) {
            throw this.createError(`Failed to get email status: ${error}`, "STATUS_FETCH_ERROR", 500, true);
        }
    }
    async processWebhook(payload, signature) {
        try {
            // Verify webhook signature if provided
            if (signature && this.webhookSecret) {
                if (!this.verifyWebhookSignature(payload, signature)) {
                    throw this.createError("Invalid webhook signature", "INVALID_SIGNATURE", 401, false);
                }
            }
            const mailtrapPayload = payload;
            return {
                messageId: mailtrapPayload.message_id,
                event: mailtrapPayload.event,
                email: mailtrapPayload.email,
                timestamp: new Date(mailtrapPayload.timestamp * 1000),
                data: {
                    inboxId: mailtrapPayload.inbox_id,
                    response: mailtrapPayload.response || '',
                    category: mailtrapPayload.category || '',
                    customVariables: mailtrapPayload.custom_variables || {},
                },
                signature,
            };
        }
        catch (error) {
            throw this.createError(`Failed to process webhook: ${error}`, "WEBHOOK_PROCESSING_ERROR", 500, true);
        }
    }
    verifyWebhookSignature(payload, signature) {
        if (!this.webhookSecret) {
            return false;
        }
        try {
            const body = typeof payload === "string" ? payload : JSON.stringify(payload);
            const expectedSignature = crypto_1.default
                .createHmac("sha256", this.webhookSecret)
                .update(body)
                .digest("hex");
            // Support both 'sha256=' prefix and raw hex
            const cleanSignature = signature.startsWith("sha256=")
                ? signature.slice(7)
                : signature;
            return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(cleanSignature, "hex"));
        }
        catch (error) {
            console.error("Webhook signature verification error:", error);
            return false;
        }
    }
    async checkRateLimit() {
        // Wait for mutex to be free
        while (this.rateLimitState.mutex) {
            await this.delay(1);
        }
        const now = new Date();
        // Reset window if expired
        if (now.getTime() - this.rateLimitState.windowStart.getTime() >=
            this.rateLimitState.windowMs) {
            this.rateLimitState.count = 0;
            this.rateLimitState.windowStart = now;
        }
        const remaining = Math.max(0, this.rateLimitState.limit - this.rateLimitState.count);
        const resetTime = new Date(this.rateLimitState.windowStart.getTime() + this.rateLimitState.windowMs);
        return {
            remaining,
            resetTime,
            limit: this.rateLimitState.limit,
        };
    }
    /**
     * Atomically check and increment rate limit
     * Returns whether the request is allowed
     */
    async checkAndIncrementRateLimit() {
        // Acquire mutex
        while (this.rateLimitState.mutex) {
            await this.delay(1);
        }
        this.rateLimitState.mutex = true;
        try {
            const now = new Date();
            // Reset window if expired
            if (now.getTime() - this.rateLimitState.windowStart.getTime() >=
                this.rateLimitState.windowMs) {
                this.rateLimitState.count = 0;
                this.rateLimitState.windowStart = now;
            }
            const remaining = Math.max(0, this.rateLimitState.limit - this.rateLimitState.count);
            const resetTime = new Date(this.rateLimitState.windowStart.getTime() + this.rateLimitState.windowMs);
            if (remaining > 0) {
                // Increment counter atomically
                this.rateLimitState.count++;
                return {
                    allowed: true,
                    remaining: remaining - 1,
                    resetTime,
                };
            }
            else {
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime,
                };
            }
        }
        finally {
            // Release mutex
            this.rateLimitState.mutex = false;
        }
    }
    /**
     * Decrement rate limit counter when email sending fails
     */
    async decrementRateLimit() {
        // Acquire mutex
        while (this.rateLimitState.mutex) {
            await this.delay(1);
        }
        this.rateLimitState.mutex = true;
        try {
            if (this.rateLimitState.count > 0) {
                this.rateLimitState.count--;
            }
        }
        finally {
            // Release mutex
            this.rateLimitState.mutex = false;
        }
    }
    async validateTemplate(template) {
        try {
            // Basic template validation
            if (!template.id || typeof template.variables !== "object") {
                return false;
            }
            // In a real implementation, you might call Mailtrap's template validation API
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async renderTemplate(template) {
        try {
            // Basic template rendering - in a real implementation, you'd use a proper template engine
            const { variables } = template;
            // For now, return placeholder content
            // In production, you'd integrate with Mailtrap's template system or use a template engine
            return {
                subject: this.interpolateVariables("Email Subject", variables),
                html: this.interpolateVariables("<h1>Email Content</h1>", variables),
                text: this.interpolateVariables("Email Content", variables),
            };
        }
        catch (error) {
            throw this.createError(`Failed to render template: ${error}`, "TEMPLATE_RENDER_ERROR", 500, true);
        }
    }
    async getProviderStats() {
        try {
            // Note: Mailtrap doesn't provide comprehensive stats API
            // This would need to be tracked internally or via webhooks
            const stats = {
                totalSent: this.rateLimitState.count,
                totalDelivered: 0,
                totalBounced: 0,
                totalFailed: 0,
                rateLimit: await this.checkRateLimit(),
                provider: "Mailtrap",
                apiEndpoint: this.config.apiUrl || "https://send.api.mailtrap.io/api/send",
                healthStatus: await this.healthCheck(),
                lastActivity: new Date().toISOString(),
            };
            return {
                status: 200,
                statusText: "OK",
                headers: {},
                data: stats,
            };
        }
        catch (error) {
            throw this.createError(`Failed to get provider stats: ${error}`, "STATS_FETCH_ERROR", 500, true);
        }
    }
    async healthCheck() {
        try {
            // Simple health check - attempt to validate API key format
            return Boolean(this.config.apiKey && this.config.apiKey.length > 0);
        }
        catch (error) {
            return false;
        }
    }
    prepareEmailPayload(message) {
        const payload = {
            from: this.formatEmailAddress(message.from),
            to: message.to.map((addr) => this.formatEmailAddress(addr)),
            subject: message.subject,
        };
        if (message.cc && message.cc.length > 0) {
            payload.cc = message.cc.map((addr) => this.formatEmailAddress(addr));
        }
        if (message.bcc && message.bcc.length > 0) {
            payload.bcc = message.bcc.map((addr) => this.formatEmailAddress(addr));
        }
        if (message.text) {
            payload.text = message.text;
        }
        if (message.html) {
            payload.html = message.html;
        }
        if (message.template) {
            payload.template_uuid = message.template.id;
            payload.template_variables = message.template.variables;
        }
        if (message.attachments && message.attachments.length > 0) {
            payload.attachments = message.attachments.map((att) => ({
                filename: att.filename,
                content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
                type: att.contentType,
                disposition: att.disposition || "attachment",
                content_id: att.contentId,
            }));
        }
        if (message.headers) {
            payload.headers = message.headers;
        }
        if (message.tags && message.tags.length > 0) {
            payload.tags = message.tags;
        }
        if (message.metadata) {
            payload.custom_variables = message.metadata;
        }
        return payload;
    }
    formatEmailAddress(address) {
        if (address.name) {
            return {
                email: address.email,
                name: address.name,
            };
        }
        return { email: address.email };
    }
    async sendWithRetry(payload) {
        let lastError = null;
        const maxRetries = this.config.retries || 3;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.makeHttpRequest(payload);
                return response;
            }
            catch (error) {
                lastError = error;
                const emailError = error;
                // Don't retry on non-retryable errors
                if (emailError.retryable === false || attempt === maxRetries) {
                    break;
                }
                // Wait before retry
                if (attempt < maxRetries) {
                    await this.delay((this.config.retryDelay || 1000) * Math.pow(2, attempt));
                }
            }
        }
        throw lastError;
    }
    async makeHttpRequest(payload) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
        try {
            const response = await fetch(this.config.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const responseData = await response.json();
            if (!response.ok) {
                const errorResponse = responseData;
                throw this.createError(errorResponse.message || "Unknown error", errorResponse.error || "API_ERROR", response.status, this.isRetryableStatus(response.status), responseData);
            }
            return responseData;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error && error.code && error.statusCode !== undefined) {
                throw error;
            }
            throw this.createError(`HTTP request failed: ${error}`, "HTTP_ERROR", 500, true);
        }
    }
    createError(message, code, statusCode, retryable, providerResponse) {
        const error = new Error(message);
        error.code = code;
        error.statusCode = statusCode;
        error.retryable = retryable;
        error.providerResponse = providerResponse;
        return error;
    }
    isRetryableStatus(status) {
        // Retry on server errors and rate limiting
        return status >= 500 || status === 429;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    interpolateVariables(text, variables) {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
            result = result.replace(regex, String(value));
        }
        return result;
    }
}
exports.MailtrapProvider = MailtrapProvider;
//# sourceMappingURL=mailtrap.provider.js.map