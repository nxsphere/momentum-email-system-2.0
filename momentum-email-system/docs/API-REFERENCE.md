# API Reference

Complete API documentation for the Momentum Email System.

## Table of Contents

- [Template Engine API](#template-engine-api)
- [Email Service API](#email-service-api)
- [Storage API](#storage-api)
- [Tracking API](#tracking-api)
- [Types & Interfaces](#types--interfaces)
- [Configuration](#configuration)
- [Error Types](#error-types)

## Template Engine API

### `HandlebarsTemplateEngine`

The main template engine class that handles template compilation, rendering, and management.

#### Constructor

```typescript
constructor(
  storage: SupabaseTemplateStorage,
  trackingService: TrackingUrlService,
  config?: Partial<TemplateEngineConfig>
)
```

#### Methods

##### `loadTemplate(templateId: string): Promise<CompiledTemplate>`

Loads and compiles a template from storage.

```typescript
const template = await templateEngine.loadTemplate("welcome-email");
```

**Parameters:**
- `templateId` - Unique identifier for the template

**Returns:** Promise that resolves to a compiled template

**Throws:** `TemplateNotFoundError` if template doesn't exist

##### `validateTemplate(template: EmailTemplate): Promise<TemplateValidationResult>`

Validates template syntax, security, and structure.

```typescript
const validation = await templateEngine.validateTemplate(template);
if (!validation.valid) {
  console.log("Errors:", validation.errors);
}
```

**Parameters:**
- `template` - Template object to validate

**Returns:** Validation result with errors and warnings

##### `compileTemplate(template: EmailTemplate): Promise<CompiledTemplate>`

Compiles a template for rendering.

```typescript
const compiled = await templateEngine.compileTemplate(template);
```

**Parameters:**
- `template` - Template to compile

**Returns:** Compiled template with metadata

##### `renderTemplate(templateId: string, context: TemplateContext): Promise<RenderResult>`

Renders a template with the provided context.

```typescript
const result = await templateEngine.renderTemplate("welcome-email", context);
```

**Parameters:**
- `templateId` - Template identifier
- `context` - Rendering context with variables

**Returns:** Rendered email content

##### `renderPreview(template: EmailTemplate, sampleData?: Record<string, any>): Promise<RenderResult>`

Renders a template preview without database dependency.

```typescript
const preview = await templateEngine.renderPreview(template, { name: "John" });
```

**Parameters:**
- `template` - Template to render
- `sampleData` - Optional sample data for variables

**Returns:** Rendered preview

##### `extractVariables(templateContent: string): TemplateVariable[]`

Extracts variables from template content.

```typescript
const variables = templateEngine.extractVariables("Hello {{name}}!");
```

**Parameters:**
- `templateContent` - Template content to analyze

**Returns:** Array of extracted variables with type information

##### `generateSampleContext(variables: TemplateVariable[]): TemplateContext`

Generates sample context for testing.

```typescript
const context = templateEngine.generateSampleContext(variables);
```

**Parameters:**
- `variables` - Variables to generate sample data for

**Returns:** Sample template context

##### `getStats(): Promise<TemplateEngineStats>`

Gets engine statistics and performance metrics.

```typescript
const stats = await templateEngine.getStats();
console.log("Total renders:", stats.rendering.total_renders);
```

**Returns:** Engine statistics

##### `clearCache(): void`

Clears the template cache.

```typescript
templateEngine.clearCache();
```

## Email Service API

### `EmailService`

Provider-agnostic email service for sending emails.

#### Constructor

```typescript
constructor(config: EmailServiceConfig)
```

#### Methods

##### `sendEmail(message: EmailMessage, options?: SendEmailOptions): Promise<EmailSendResult>`

Sends a single email.

```typescript
const result = await emailService.sendEmail({
  from: { email: "sender@example.com", name: "Sender" },
  to: [{ email: "recipient@example.com", name: "Recipient" }],
  subject: "Test Email",
  html: "<h1>Hello!</h1>",
});
```

**Parameters:**
- `message` - Email message object
- `options` - Optional sending options

**Returns:** Send result with message ID and status

##### `sendBulkEmails(messages: EmailMessage[], options?: SendEmailOptions): Promise<EmailSendResult[]>`

Sends multiple emails efficiently.

```typescript
const results = await emailService.sendBulkEmails(messages);
```

**Parameters:**
- `messages` - Array of email messages
- `options` - Optional sending options

**Returns:** Array of send results

##### `getEmailStatus(messageId: string): Promise<EmailStatus>`

Gets the delivery status of an email.

```typescript
const status = await emailService.getEmailStatus(messageId);
```

**Parameters:**
- `messageId` - Email message identifier

**Returns:** Email status information

##### `processWebhook(payload: any, signature?: string): Promise<WebhookEvent>`

Processes webhook events from email provider.

```typescript
const event = await emailService.processWebhook(req.body, signature);
```

**Parameters:**
- `payload` - Webhook payload
- `signature` - Optional signature for verification

**Returns:** Processed webhook event

##### `checkRateLimit(): Promise<RateLimitInfo>`

Checks current rate limit status.

```typescript
const rateLimit = await emailService.checkRateLimit();
console.log(`${rateLimit.remaining}/${rateLimit.limit} remaining`);
```

**Returns:** Rate limit information

##### `getStats(): Promise<EmailServiceStats>`

Gets service statistics.

```typescript
const stats = await emailService.getStats();
```

**Returns:** Service statistics

##### `healthCheck(): Promise<boolean>`

Performs health check on the service.

```typescript
const isHealthy = await emailService.healthCheck();
```

**Returns:** Health status

##### `createMessage(): EmailMessageBuilder`

Creates a fluent message builder.

```typescript
const email = emailService
  .createMessage()
  .from({ email: "sender@example.com", name: "Sender" })
  .to({ email: "recipient@example.com", name: "Recipient" })
  .subject("Test")
  .html("<h1>Hello!</h1>")
  .build();
```

**Returns:** Email message builder

## Storage API

### `SupabaseTemplateStorage`

Supabase-based template storage implementation.

#### Constructor

```typescript
constructor(supabase?: SupabaseClient)
```

#### Methods

##### `createTemplate(template: Omit<EmailTemplate, 'created_at' | 'updated_at'>): Promise<EmailTemplate>`

Creates a new template.

```typescript
const template = await storage.createTemplate({
  id: "new-template",
  name: "New Template",
  subject: "Subject",
  html_content: "<h1>Content</h1>",
  variables: {},
});
```

##### `getTemplate(id: string): Promise<EmailTemplate | null>`

Retrieves a template by ID.

```typescript
const template = await storage.getTemplate("template-id");
```

##### `updateTemplate(id: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate>`

Updates an existing template.

```typescript
const updated = await storage.updateTemplate("template-id", {
  subject: "Updated Subject",
});
```

##### `deleteTemplate(id: string): Promise<void>`

Deletes a template.

```typescript
await storage.deleteTemplate("template-id");
```

##### `listTemplates(): Promise<EmailTemplate[]>`

Lists all templates.

```typescript
const templates = await storage.listTemplates();
```

##### `getTemplateStats(templateId: string): Promise<TemplateStats>`

Gets template usage statistics.

```typescript
const stats = await storage.getTemplateStats("template-id");
```

## Tracking API

### `TrackingUrlService`

Service for generating tracking URLs.

#### Constructor

```typescript
constructor(baseUrl: string, config: TrackingConfig)
```

#### Methods

##### `generatePixelTrackingUrl(templateId: string, contactId: string, campaignId?: string): string`

Generates pixel tracking URL.

```typescript
const pixelUrl = trackingService.generatePixelTrackingUrl(
  "template-id",
  "contact-id",
  "campaign-id"
);
```

##### `generateClickTrackingUrl(originalUrl: string, templateId: string, contactId: string, campaignId?: string): string`

Generates click tracking URL.

```typescript
const trackingUrl = trackingService.generateClickTrackingUrl(
  "https://example.com",
  "template-id",
  "contact-id"
);
```

##### `generateUnsubscribeUrl(contactId: string, campaignId?: string): string`

Generates unsubscribe URL.

```typescript
const unsubscribeUrl = trackingService.generateUnsubscribeUrl(
  "contact-id",
  "campaign-id"
);
```

##### `generateUnsubscribeFooterHtml(contactId: string, campaignId?: string): string`

Generates unsubscribe footer HTML.

```typescript
const footer = trackingService.generateUnsubscribeFooterHtml(
  "contact-id",
  "campaign-id"
);
```

## Types & Interfaces

### Core Types

#### `EmailTemplate`

```typescript
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  variables: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

#### `TemplateContext`

```typescript
interface TemplateContext {
  contact: ContactInfo;
  variables: Record<string, any>;
  campaign?: CampaignInfo;
  system: SystemVariables;
}
```

#### `ContactInfo`

```typescript
interface ContactInfo {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  metadata?: Record<string, any>;
}
```

#### `RenderResult`

```typescript
interface RenderResult {
  subject: string;
  html: string;
  text: string;
  tracking: TrackingInfo;
  metadata: RenderMetadata;
}
```

#### `TemplateVariable`

```typescript
interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "email" | "url";
  required: boolean;
  description?: string;
}
```

#### `TemplateValidationResult`

```typescript
interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
  variables: TemplateVariable[];
}
```

#### `TemplateValidationError`

```typescript
interface TemplateValidationError {
  type: "syntax" | "security" | "required" | "variable";
  message: string;
  context?: string;
  line?: number;
  column?: number;
}
```

### Email Service Types

#### `EmailMessage`

```typescript
interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  tags?: string[];
  template?: EmailTemplate;
}
```

#### `EmailAddress`

```typescript
interface EmailAddress {
  email: string;
  name?: string;
}
```

#### `EmailSendResult`

```typescript
interface EmailSendResult {
  messageId: string;
  status: "sent" | "queued" | "failed";
  provider: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

#### `EmailStatus`

```typescript
interface EmailStatus {
  messageId: string;
  status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
  timestamp: Date;
  events: EmailEvent[];
}
```

### Configuration Types

#### `TemplateEngineConfig`

```typescript
interface TemplateEngineConfig {
  storage: StorageConfig;
  tracking: TrackingConfig;
  cache: CacheConfig;
  security: SecurityConfig;
  textGeneration: TextGenerationConfig;
  validation: ValidationConfig;
}
```

#### `TrackingConfig`

```typescript
interface TrackingConfig {
  pixel_enabled: boolean;
  click_tracking_enabled: boolean;
  open_tracking_enabled: boolean;
  utm_params?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}
```

#### `SecurityConfig`

```typescript
interface SecurityConfig {
  allowScriptTags: boolean;
  blockedHelpers: string[];
  maxTemplateSize: number;
  sanitizeInput: boolean;
}
```

## Configuration

### Factory Functions

#### `createTemplateEngine(config?: Partial<TemplateEngineFactoryConfig>): HandlebarsTemplateEngine`

Creates a configured template engine instance.

```typescript
const templateEngine = createTemplateEngine({
  tracking: {
    baseUrl: "https://track.example.com",
    enablePixelTracking: true,
  },
  cache: {
    maxSize: 200,
  },
});
```

#### `createTemplateContext(contact: ContactInfo, variables?: Record<string, any>, campaign?: CampaignInfo): TemplateContext`

Creates a template context for rendering.

```typescript
const context = createTemplateContext(
  { id: "123", email: "user@example.com", first_name: "John" },
  { is_premium: true },
  { id: "campaign-1", name: "Welcome Campaign" }
);
```

### Environment Configuration

#### Template Engine Environment Variables

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Tracking
TEMPLATE_TRACKING_BASE_URL=https://track.yourdomain.com
TEMPLATE_COMPANY_NAME=Your Company
TEMPLATE_COMPANY_ADDRESS=123 Main St, City, State 12345

# Performance
TEMPLATE_CACHE_SIZE=100
TEMPLATE_CACHE_TTL=3600000

# Security
TEMPLATE_ALLOW_SCRIPT_TAGS=false
TEMPLATE_BLOCKED_HELPERS=eval,exec,require
```

#### Email Service Environment Variables

```bash
# Mailtrap
MAILTRAP_API_KEY=your_api_key
MAILTRAP_WEBHOOK_SECRET=your_webhook_secret
MAILTRAP_TEST_MODE=true

# Defaults
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=Your Company

# Performance
EMAIL_TIMEOUT=30000
EMAIL_RETRIES=3
EMAIL_RETRY_DELAY=1000
EMAIL_RATE_LIMIT_MAX=200
EMAIL_RATE_LIMIT_WINDOW=3600000
```

## Error Types

### Template Engine Errors

#### `TemplateNotFoundError`

```typescript
class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template '${templateId}' not found`);
  }
}
```

#### `TemplateValidationError`

```typescript
class TemplateValidationError extends Error {
  constructor(
    message: string,
    public errors: TemplateValidationError[]
  ) {
    super(message);
  }
}
```

#### `TemplateRenderError`

```typescript
class TemplateRenderError extends Error {
  constructor(
    message: string,
    public templateId: string,
    public missingVariables?: string[]
  ) {
    super(message);
  }
}
```

### Email Service Errors

#### `EmailSendError`

```typescript
class EmailSendError extends Error {
  constructor(
    message: string,
    public retryable: boolean = false,
    public statusCode?: number
  ) {
    super(message);
  }
}
```

#### `RateLimitError`

```typescript
class RateLimitError extends EmailSendError {
  constructor(
    public resetTime: Date,
    public remaining: number
  ) {
    super("Rate limit exceeded", true);
  }
}
```

#### `WebhookVerificationError`

```typescript
class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
```

## Usage Examples

### Complete Email Campaign

```typescript
import { 
  createTemplateEngine, 
  createTemplateContext 
} from "./src/config/template-engine.config";
import { EmailService } from "./src/services/email.service";
import { MailtrapProvider } from "./src/providers/mailtrap.provider";

async function sendCampaignEmail() {
  // Initialize services
  const templateEngine = createTemplateEngine();
  const emailService = new EmailService({
    provider: new MailtrapProvider({
      apiKey: process.env.MAILTRAP_API_KEY!,
      testMode: true,
    }),
    defaultFrom: {
      email: "campaigns@example.com",
      name: "Campaign Team",
    },
  });

  // Load template
  const template = await templateEngine.loadTemplate("welcome-campaign");

  // Create context
  const context = createTemplateContext(
    { id: "user-123", email: "user@example.com", first_name: "John" },
    { is_premium: true, signup_bonus: 50 },
    { id: "campaign-1", name: "Welcome Campaign" }
  );

  // Render template
  const rendered = await templateEngine.renderTemplate(template.id, context);

  // Send email
  const result = await emailService.sendEmail({
    from: { email: "campaigns@example.com", name: "Campaign Team" },
    to: [{ email: context.contact.email, name: context.contact.first_name }],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    metadata: {
      campaign_id: context.campaign?.id,
      template_id: template.id,
    },
  });

  console.log("Email sent:", result.messageId);
}
```

### Error Handling

```typescript
async function safeEmailSend(templateId: string, context: TemplateContext) {
  try {
    // Validate template first
    const template = await templateEngine.loadTemplate(templateId);
    const validation = await templateEngine.validateTemplate(template);
    
    if (!validation.valid) {
      throw new TemplateValidationError("Template validation failed", validation.errors);
    }

    // Render template
    const rendered = await templateEngine.renderTemplate(templateId, context);

    // Send email with retry logic
    const result = await emailService.sendEmail({
      from: { email: "system@example.com", name: "System" },
      to: [{ email: context.contact.email, name: context.contact.first_name }],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return result;
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      console.error("Template not found:", error.message);
      // Use fallback template
      return await safeEmailSend("fallback-template", context);
    } else if (error instanceof TemplateValidationError) {
      console.error("Template validation failed:", error.errors);
      // Log validation errors for review
      await logValidationErrors(templateId, error.errors);
    } else if (error instanceof RateLimitError) {
      console.log("Rate limit hit, retrying after:", error.resetTime);
      // Schedule retry
      await scheduleRetry(templateId, context, error.resetTime);
    } else {
      console.error("Unexpected error:", error);
      throw error;
    }
  }
}
```

---

For more detailed examples, see the [demo files](../examples/) and [test suite](../src/test/). 