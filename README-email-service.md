# Mailtrap Email Service Integration

A comprehensive TypeScript module for Mailtrap.io transactional email API integration with provider-agnostic architecture, rate limiting, error handling, and webhook support.

## Features

- 🚀 **Provider-agnostic interface** - Easy to swap email providers
- 📧 **Mailtrap.io integration** - Full API support with TypeScript types
- ⚡ **Rate limiting** - Built-in 200 emails/hour rate limiting
- 🔄 **Retry logic** - Automatic retry with exponential backoff
- 📝 **Template support** - Variable substitution in email templates
- 🔒 **Webhook signature verification** - Secure webhook handling
- 📊 **Statistics and monitoring** - Track email delivery metrics
- 🛡️ **Error handling** - Comprehensive error handling with types
- 🏗️ **Fluent interface** - Builder pattern for email construction

## Installation

```bash
npm install
npm install --save-dev @types/node
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Mailtrap Configuration
MAILTRAP_API_KEY=your_mailtrap_api_key_here
MAILTRAP_INBOX_ID=your_mailtrap_inbox_id_here
MAILTRAP_TEST_MODE=true
MAILTRAP_WEBHOOK_SECRET=your_webhook_secret_here

# Email Service Configuration
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=Your Company Name
EMAIL_LOG_LEVEL=debug
ENABLE_RATE_LIMIT=true
ENABLE_RETRIES=true

# Email API Configuration
EMAIL_TIMEOUT=30000
EMAIL_RETRIES=3
EMAIL_RETRY_DELAY=1000
EMAIL_RATE_LIMIT_MAX=200
EMAIL_RATE_LIMIT_WINDOW=3600000
```

## Quick Start

```typescript
import { EmailService } from "./src/services/email.service";
import { MailtrapProvider } from "./src/providers/mailtrap.provider";

// Create Mailtrap provider
const provider = new MailtrapProvider({
  apiKey: process.env.MAILTRAP_API_KEY!,
  testMode: true,
});

// Create email service
const emailService = new EmailService({
  provider,
  defaultFrom: {
    email: "noreply@yourdomain.com",
    name: "Your Company",
  },
  enableRateLimit: true,
  enableRetries: true,
  logLevel: "debug",
});

// Send an email
const result = await emailService.sendEmail({
  from: { email: "sender@example.com", name: "Sender" },
  to: [{ email: "recipient@example.com", name: "Recipient" }],
  subject: "Test Email",
  html: "<h1>Hello World!</h1>",
  text: "Hello World!",
});

console.log("Email sent:", result);
```

## API Reference

### EmailService

#### Core Methods

```typescript
// Send single email
async sendEmail(message: EmailMessage, options?: SendEmailOptions): Promise<EmailSendResult>

// Send bulk emails
async sendBulkEmails(messages: EmailMessage[], options?: SendEmailOptions): Promise<EmailSendResult[]>

// Send templated email
async sendTemplatedEmail(template: EmailTemplate, recipients: EmailAddress[], from: EmailAddress, options?: SendEmailOptions): Promise<EmailSendResult[]>

// Get email status
async getEmailStatus(messageId: string): Promise<EmailStatus>

// Process webhook
async processWebhook(payload: any, signature?: string): Promise<WebhookEvent>
```

#### Utility Methods

```typescript
// Check rate limits
async checkRateLimit(): Promise<RateLimitInfo>

// Get service statistics
async getStats(): Promise<EmailServiceStats>

// Health check
async healthCheck(): Promise<boolean>

// Create message builder
createMessage(): EmailMessageBuilder
```

### Email Message Builder

```typescript
const email = emailService
  .createMessage()
  .from({ email: "sender@example.com", name: "Sender" })
  .to({ email: "recipient@example.com", name: "Recipient" })
  .subject("Test Email")
  .html("<h1>Hello!</h1>")
  .text("Hello!")
  .header("X-Custom-Header", "value")
  .metadata("campaign", "test")
  .tag("newsletter")
  .build();
```

### Template Usage

```typescript
// Define template
const template: EmailTemplate = {
  id: "welcome-template",
  variables: {
    name: "John Doe",
    company: "Acme Corp",
    activation_url: "https://example.com/activate?token=abc123",
  },
};

// Send templated email
const result = await emailService.sendEmail({
  from: { email: "welcome@example.com", name: "Welcome Team" },
  to: [{ email: "user@example.com", name: "User" }],
  subject: "Welcome to {{company}}!",
  template: template,
});
```

### Webhook Handling

```typescript
// Express.js webhook endpoint
app.post("/webhook/mailtrap", async (req, res) => {
  try {
    const signature = req.headers["x-mailtrap-signature"];
    const webhookEvent = await emailService.processWebhook(req.body, signature);

    switch (webhookEvent.event) {
      case "delivered":
        console.log("Email delivered:", webhookEvent.messageId);
        break;
      case "opened":
        console.log("Email opened:", webhookEvent.messageId);
        break;
      case "clicked":
        console.log("Email clicked:", webhookEvent.messageId);
        break;
      case "bounced":
        console.log("Email bounced:", webhookEvent.messageId);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## Provider-Agnostic Architecture

The system is designed with a provider-agnostic interface, making it easy to swap email providers:

```typescript
// EmailProvider interface
interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  getEmailStatus(messageId: string): Promise<EmailStatus>;
  processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
  verifyWebhookSignature(payload: any, signature: string): boolean;
  checkRateLimit(): Promise<RateLimitInfo>;
  validateTemplate(template: EmailTemplate): Promise<boolean>;
  renderTemplate(
    template: EmailTemplate
  ): Promise<{ subject: string; html: string; text: string }>;
}

// Easy to implement new providers
class SendGridProvider implements EmailProvider {
  // Implement methods for SendGrid
}

class AmazonSESProvider implements EmailProvider {
  // Implement methods for Amazon SES
}
```

## Rate Limiting

Built-in rate limiting respects email provider limits:

```typescript
// Check current rate limit status
const rateLimit = await emailService.checkRateLimit();
console.log(`Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
console.log(`Resets at: ${rateLimit.resetTime}`);

// Rate limiting is automatically applied during email sending
// Will throw error if rate limit is exceeded
```

## Error Handling

Comprehensive error handling with retryable error detection:

```typescript
try {
  const result = await emailService.sendEmail(message);
  console.log("Success:", result);
} catch (error) {
  if (error.retryable) {
    console.log("Retryable error:", error.message);
    // Automatic retry will be attempted
  } else {
    console.log("Permanent error:", error.message);
    // No retry will be attempted
  }
}
```

## Statistics and Monitoring

Track email delivery metrics:

```typescript
const stats = await emailService.getStats();
console.log("Total sent:", stats.totalSent);
console.log("Total delivered:", stats.totalDelivered);
console.log("Total bounced:", stats.totalBounced);
console.log("Total failed:", stats.totalFailed);
console.log("Rate limit status:", stats.rateLimit);
```

## TypeScript Types

Full TypeScript support with comprehensive type definitions:

```typescript
interface EmailMessage {
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

interface EmailSendResult {
  messageId: string;
  status: "sent" | "queued" | "failed";
  message?: string;
  providerResponse?: any;
}

interface EmailStatus {
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
```

## Examples

See `examples/email-service-demo.ts` for comprehensive usage examples including:

- Simple email sending
- Templated emails
- Bulk email sending
- Email builder usage
- Webhook processing
- Rate limit checking
- Statistics monitoring

## Testing

Run the demo to test the email service:

```bash
# Set up environment variables first
export MAILTRAP_API_KEY=your_key_here
export DEFAULT_FROM_EMAIL=test@example.com

# Run the demo
npx ts-node examples/email-service-demo.ts
```

## Security

- **Webhook signature verification** using HMAC-SHA256
- **Input validation** for email addresses and message content
- **Rate limiting** to prevent abuse
- **Error handling** to prevent information leakage
- **Environment variable** based configuration

## Contributing

1. Follow the provider-agnostic interface when adding new providers
2. Add comprehensive TypeScript types for all new functionality
3. Include error handling with proper retryable/non-retryable classification
4. Add tests for new features
5. Update documentation

## License

MIT License - See LICENSE file for details.
