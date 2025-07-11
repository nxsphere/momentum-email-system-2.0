# Momentum Email System

A comprehensive TypeScript email system featuring template engine, provider-agnostic email service, and Supabase integration for enterprise-grade email campaigns.

## 🚀 Features

### Email Template Engine
- 🎨 **Handlebars Templates** - Dynamic variable substitution with custom helpers
- 💾 **Supabase Integration** - Persistent template storage and management
- 🔍 **Template Validation** - Syntax checking and security validation
- 📊 **Tracking & Analytics** - Pixel tracking, click tracking, and unsubscribe links
- 🎯 **Personalization** - Advanced helpers for formatting and conditionals
- ⚡ **Caching System** - Compiled template caching for performance
- 📈 **Statistics** - Render performance and usage tracking

### Email Service
- 🔌 **Provider-Agnostic** - Easy to swap email providers (Mailtrap, SendGrid, etc.)
- 📧 **Mailtrap Integration** - Full API support with TypeScript types
- ⚡ **Rate Limiting** - Built-in 200 emails/hour rate limiting
- 🔄 **Retry Logic** - Automatic retry with exponential backoff
- 🔒 **Webhook Security** - Signature verification for webhooks
- 📊 **Monitoring** - Email delivery statistics and health checks

## 📦 Installation

```bash
npm install
```

## 🔧 Environment Configuration

Create a `.env` file with the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Mailtrap Configuration
MAILTRAP_API_KEY=your_mailtrap_api_key
MAILTRAP_WEBHOOK_SECRET=your_webhook_secret
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=Your Company Name

# Template Engine Configuration
TEMPLATE_TRACKING_BASE_URL=https://track.yourdomain.com
TEMPLATE_COMPANY_NAME=Your Company
TEMPLATE_COMPANY_ADDRESS=123 Main St, City, State 12345

# Optional Configuration
MAILTRAP_TEST_MODE=true
EMAIL_LOG_LEVEL=debug
ENABLE_RATE_LIMIT=true
ENABLE_RETRIES=true
```

## 🏗️ Architecture

```
momentum-email-system/
├── src/
│   ├── types/                    # TypeScript type definitions
│   │   ├── email-system.ts       # Core email system types
│   │   ├── template-engine.ts    # Template engine types
│   │   └── email-provider.ts     # Email provider interfaces
│   ├── services/                 # Core business logic
│   │   ├── template-engine.service.ts      # Template engine
│   │   ├── template-storage.service.ts     # Supabase storage
│   │   ├── tracking-url.service.ts         # URL tracking
│   │   └── email.service.ts                # Email service
│   ├── providers/                # Email provider implementations
│   │   └── mailtrap.provider.ts  # Mailtrap integration
│   ├── config/                   # Configuration management
│   │   ├── supabase.ts           # Supabase client
│   │   ├── template-engine.config.ts # Template engine config
│   │   └── email.config.ts       # Email service config
│   ├── test/                     # Test suites
│   │   └── template-engine.test.ts # Template engine tests
│   └── index.ts                  # Main entry point
├── examples/                     # Usage examples
│   ├── template-engine-demo.ts   # Template engine demo
│   └── email-service-demo.ts     # Email service demo
└── docs/                         # Documentation
    ├── README-email-service.md   # Email service docs
    └── MAILTRAP-INTEGRATION-SUMMARY.md
```

## 🎯 Quick Start

### Template Engine Usage

```typescript
import { createTemplateEngine, createTemplateContext } from "./src/config/template-engine.config";

// Create template engine
const templateEngine = createTemplateEngine();

// Create a template
const template = {
  id: "welcome-email",
  name: "Welcome Email",
  subject: "Welcome {{contact.first_name}}!",
  html_content: `
    <h1>Welcome {{contact.first_name}}!</h1>
    <p>Thanks for joining {{company_name}}!</p>
    {{#if variables.is_premium}}
    <p>🎉 You're a premium member!</p>
    {{/if}}
  `,
  text_content: "Welcome {{contact.first_name}}! Thanks for joining {{company_name}}!",
  variables: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Create context
const context = createTemplateContext(
  { id: "user-123", email: "john@example.com", first_name: "John" },
  { is_premium: true }
);

// Render template
const result = await templateEngine.renderPreview(template, {
  first_name: context.contact.first_name,
  is_premium: context.variables.is_premium,
});

console.log("Subject:", result.subject);
console.log("HTML:", result.html);
```

### Email Service Usage

```typescript
import { EmailService } from "./src/services/email.service";
import { MailtrapProvider } from "./src/providers/mailtrap.provider";

// Create email service
const provider = new MailtrapProvider({
  apiKey: process.env.MAILTRAP_API_KEY!,
  testMode: true,
});

const emailService = new EmailService({
  provider,
  defaultFrom: {
    email: "noreply@yourdomain.com",
    name: "Your Company",
  },
});

// Send email
const result = await emailService.sendEmail({
  from: { email: "sender@example.com", name: "Sender" },
  to: [{ email: "recipient@example.com", name: "Recipient" }],
  subject: "Test Email",
  html: "<h1>Hello World!</h1>",
  text: "Hello World!",
});
```

## 🎨 Template Engine Features

### Handlebars Helpers

The template engine includes powerful custom helpers:

```handlebars
{{!-- Text formatting --}}
{{capitalize contact.first_name}}
{{upper contact.last_name}}
{{lower contact.email}}

{{!-- Conditionals --}}
{{#if (gt variables.score 80)}}High score!{{/if}}
{{#if (eq contact.type "premium")}}Premium member{{/if}}

{{!-- Date formatting --}}
{{formatDate variables.signup_date "long"}}
{{formatDate variables.event_date "short"}}

{{!-- Default values --}}
{{default contact.middle_name "N/A"}}
{{default variables.phone "Not provided"}}
```

### Template Validation

```typescript
// Validate template syntax and security
const validation = await templateEngine.validateTemplate(template);

if (!validation.valid) {
  console.log("Validation errors:", validation.errors);
  validation.errors.forEach(error => {
    console.log(`${error.type}: ${error.message}`);
  });
}
```

### Variable Extraction

```typescript
// Extract variables from template content
const variables = templateEngine.extractVariables(template.html_content);
console.log("Required variables:", variables.map(v => v.name));
```

## 📊 Tracking & Analytics

### Email Tracking

Templates automatically include:
- **Pixel tracking** for open rates
- **Click tracking** for link engagement
- **Unsubscribe links** for compliance

### Statistics

```typescript
// Get template engine statistics
const stats = await templateEngine.getStats();
console.log("Total renders:", stats.rendering.total_renders);
console.log("Success rate:", stats.rendering.successful_renders / stats.rendering.total_renders);
console.log("Average render time:", stats.rendering.average_render_time);

// Get email service statistics
const emailStats = await emailService.getStats();
console.log("Emails sent:", emailStats.totalSent);
console.log("Delivery rate:", emailStats.deliveryRate);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript compilation check
npx tsc --noEmit

# Run demo examples
npx ts-node examples/template-engine-demo.ts
npx ts-node examples/email-service-demo.ts
```

### Test Coverage

- ✅ **24 template engine tests** - All core functionality
- ✅ **Template validation** - Syntax and security checks
- ✅ **Variable extraction** - Type inference and validation
- ✅ **Template rendering** - With and without variables
- ✅ **Handlebars helpers** - Custom helper functions
- ✅ **Tracking elements** - Pixel and click tracking
- ✅ **Caching system** - Template compilation caching
- ✅ **Statistics tracking** - Performance monitoring

## 🔐 Security Features

### Template Security
- **Script tag blocking** - Prevents XSS attacks
- **Helper validation** - Blocks dangerous helpers
- **Input sanitization** - Cleans user input
- **Signature verification** - Webhook security

### Email Security
- **HMAC-SHA256** webhook signature verification
- **Rate limiting** to prevent abuse
- **Input validation** for all email fields
- **Secure header handling**

## 📚 API Reference

### Template Engine

```typescript
interface TemplateEngine {
  // Template management
  loadTemplate(templateId: string): Promise<CompiledTemplate>;
  validateTemplate(template: EmailTemplate): Promise<TemplateValidationResult>;
  compileTemplate(template: EmailTemplate): Promise<CompiledTemplate>;
  
  // Rendering
  renderTemplate(templateId: string, context: TemplateContext): Promise<RenderResult>;
  renderPreview(template: EmailTemplate, sampleData?: Record<string, any>): Promise<RenderResult>;
  
  // Utilities
  extractVariables(templateContent: string): TemplateVariable[];
  generateSampleContext(variables: TemplateVariable[]): TemplateContext;
  getStats(): Promise<TemplateEngineStats>;
  clearCache(): void;
}
```

### Email Service

```typescript
interface EmailService {
  // Email sending
  sendEmail(message: EmailMessage, options?: SendEmailOptions): Promise<EmailSendResult>;
  sendBulkEmails(messages: EmailMessage[], options?: SendEmailOptions): Promise<EmailSendResult[]>;
  
  // Status and monitoring
  getEmailStatus(messageId: string): Promise<EmailStatus>;
  getStats(): Promise<EmailServiceStats>;
  healthCheck(): Promise<boolean>;
  
  // Webhooks
  processWebhook(payload: any, signature?: string): Promise<WebhookEvent>;
  
  // Utilities
  createMessage(): EmailMessageBuilder;
  checkRateLimit(): Promise<RateLimitInfo>;
}
```

## 🔄 Integration Examples

### Campaign Processing

```typescript
import { createTemplateEngine } from "./src/config/template-engine.config";
import { EmailService } from "./src/services/email.service";

async function processCampaign(campaignId: string) {
  const templateEngine = createTemplateEngine();
  const emailService = new EmailService(/* config */);
  
  // Load campaign template
  const template = await templateEngine.loadTemplate(`campaign-${campaignId}`);
  
  // Get recipient list
  const recipients = await getCampaignRecipients(campaignId);
  
  // Process each recipient
  for (const recipient of recipients) {
    const context = createTemplateContext(recipient, {
      campaign_id: campaignId,
      unsubscribe_token: recipient.unsubscribe_token,
    });
    
    // Render personalized email
    const rendered = await templateEngine.renderTemplate(template.id, context);
    
    // Send email
    const result = await emailService.sendEmail({
      from: { email: "campaigns@yourdomain.com", name: "Your Company" },
      to: [{ email: recipient.email, name: recipient.name }],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      metadata: { campaign_id: campaignId, recipient_id: recipient.id },
    });
    
    // Log result
    console.log(`Email sent to ${recipient.email}:`, result.messageId);
  }
}
```

### Webhook Handler

```typescript
import express from "express";

const app = express();

app.post("/webhook/email", async (req, res) => {
  try {
    const signature = req.headers["x-mailtrap-signature"];
    const webhookEvent = await emailService.processWebhook(req.body, signature);
    
    // Update database with delivery status
    await updateEmailStatus(webhookEvent.messageId, webhookEvent.event, webhookEvent.data);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## 📈 Performance

### Template Engine Performance
- **Compiled template caching** - Reduces render time by 90%
- **Variable extraction optimization** - Efficient regex parsing
- **Memory-efficient** - Configurable cache size limits
- **Async operations** - Non-blocking template operations

### Email Service Performance
- **Rate limiting** - Respects provider limits
- **Bulk sending** - Efficient batch processing
- **Connection pooling** - Reuses HTTP connections
- **Retry logic** - Exponential backoff for resilience

## 🛠️ Development

### Project Structure
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

### Database Setup

The system uses Supabase for template storage. Required tables:

```sql
-- Email templates table
CREATE TABLE email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  variables JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email contacts table
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📖 Documentation

- [Email Service Documentation](./README-email-service.md)
- [Mailtrap Integration Summary](./MAILTRAP-INTEGRATION-SUMMARY.md)
- [Template Engine Examples](./examples/template-engine-demo.ts)
- [Email Service Examples](./examples/email-service-demo.ts)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For questions or issues:
1. Check the documentation
2. Review the example files
3. Run the demo scripts
4. Check the test suite for usage patterns

---

Built with ❤️ for enterprise email campaigns 