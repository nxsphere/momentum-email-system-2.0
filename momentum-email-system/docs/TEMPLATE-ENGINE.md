# Template Engine Documentation

The Momentum Email System Template Engine is a powerful, production-ready solution for creating and managing dynamic email templates with Handlebars integration, Supabase storage, and comprehensive tracking capabilities.

## 🎯 Overview

The template engine provides:
- **Dynamic templating** with Handlebars syntax
- **Variable substitution** with type inference
- **Template validation** for syntax and security
- **Persistent storage** via Supabase
- **Tracking integration** for analytics
- **Caching system** for performance
- **Custom helpers** for advanced formatting

## 🏗️ Architecture

### Core Components

```typescript
// Template Engine - Main orchestrator
HandlebarsTemplateEngine
├── SupabaseTemplateStorage    // Database operations
├── TrackingUrlService         // URL tracking generation
├── MemoryTemplateCache        // Performance caching
└── Handlebars                 // Template compilation
```

### Type System

```typescript
// Core template structure
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

// Template context for rendering
interface TemplateContext {
  contact: ContactInfo;
  variables: Record<string, any>;
  campaign?: CampaignInfo;
  system: SystemVariables;
}

// Render result
interface RenderResult {
  subject: string;
  html: string;
  text: string;
  tracking: TrackingInfo;
  metadata: RenderMetadata;
}
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createTemplateEngine, createTemplateContext } from "./src/config/template-engine.config";

// Initialize template engine
const templateEngine = createTemplateEngine();

// Create a template
const template = {
  id: "welcome-email",
  name: "Welcome Email",
  subject: "Welcome {{contact.first_name}}!",
  html_content: `
    <html>
      <body>
        <h1>Welcome {{contact.first_name}}!</h1>
        <p>Thanks for joining {{company_name}}!</p>
        {{#if variables.is_premium}}
          <p>🎉 You're a premium member!</p>
        {{/if}}
      </body>
    </html>
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

### Advanced Usage

```typescript
// Load template from database
const template = await templateEngine.loadTemplate("welcome-email");

// Validate template before use
const validation = await templateEngine.validateTemplate(template);
if (!validation.valid) {
  console.error("Template validation failed:", validation.errors);
  return;
}

// Compile template for performance
const compiled = await templateEngine.compileTemplate(template);

// Render with full context
const result = await templateEngine.renderTemplate("welcome-email", context);
```

## 🎨 Handlebars Features

### Built-in Helpers

The template engine includes comprehensive Handlebars helpers:

#### Text Formatting
```handlebars
{{capitalize contact.first_name}}     <!-- "john" → "John" -->
{{upper contact.last_name}}           <!-- "doe" → "DOE" -->
{{lower contact.email}}               <!-- "JOHN@EXAMPLE.COM" → "john@example.com" -->
```

#### Conditionals
```handlebars
{{#if (eq contact.type "premium")}}
  <p>Premium member benefits!</p>
{{/if}}

{{#if (gt variables.score 80)}}
  <p>High score achieved!</p>
{{/if}}

{{#if (and variables.is_active variables.is_verified)}}
  <p>Account fully activated!</p>
{{/if}}
```

#### Date Formatting
```handlebars
{{formatDate variables.signup_date "short"}}     <!-- "1/15/2023" -->
{{formatDate variables.event_date "long"}}       <!-- "January 15, 2023" -->
{{formatDate variables.created_at "iso"}}        <!-- "2023-01-15T10:30:00Z" -->
```

#### Default Values
```handlebars
{{default contact.middle_name "N/A"}}
{{default variables.phone "Not provided"}}
{{default contact.company "Individual"}}
```

#### URL Encoding
```handlebars
<a href="https://example.com/search?q={{urlEncode variables.search_term}}">Search</a>
```

### Custom Variables

Templates support various variable types:

```handlebars
<!-- Contact variables -->
{{contact.first_name}}
{{contact.last_name}}
{{contact.email}}
{{contact.full_name}}

<!-- Campaign variables -->
{{campaign.name}}
{{campaign.id}}

<!-- System variables -->
{{company_name}}
{{company_address}}
{{current_date}}
{{current_year}}
{{unsubscribe_url}}
{{tracking_pixel_url}}

<!-- Custom variables -->
{{variables.order_number}}
{{variables.product_name}}
{{variables.discount_amount}}
```

## 🔍 Template Validation

### Syntax Validation

```typescript
const validation = await templateEngine.validateTemplate(template);

if (!validation.valid) {
  validation.errors.forEach(error => {
    console.log(`${error.type}: ${error.message}`);
    if (error.context) {
      console.log(`Context: ${error.context}`);
    }
  });
}
```

### Security Validation

The engine automatically checks for:
- **Script tags** - Prevents XSS attacks
- **Dangerous helpers** - Blocks unsafe operations
- **Malicious content** - Scans for security issues

```typescript
// Example security error
{
  type: "security",
  message: "Script tags are not allowed in templates",
  context: "html_content"
}
```

### Required Fields Validation

```typescript
// Validates required template fields
const errors = validation.errors.filter(e => e.type === "required");
// Examples:
// - "Template name is required"
// - "Template subject is required"
// - "HTML or text content is required"
```

## 📊 Variable Management

### Variable Extraction

```typescript
// Extract variables from template content
const variables = templateEngine.extractVariables(template.html_content);

variables.forEach(variable => {
  console.log(`${variable.name} (${variable.type})`);
  console.log(`Required: ${variable.required}`);
});
```

### Variable Type Inference

The engine automatically infers variable types:

```typescript
// Email variables
"user_email" → type: "email"
"contact_email" → type: "email"

// URL variables
"profile_url" → type: "url"
"website_link" → type: "url"

// Date variables
"signup_date" → type: "date"
"created_time" → type: "date"

// Number variables
"user_age" → type: "number"
"item_count" → type: "number"

// Boolean variables
"is_active" → type: "boolean"
"has_premium" → type: "boolean"
```

### Sample Context Generation

```typescript
// Generate sample data for testing
const variables = templateEngine.extractVariables(template.html_content);
const sampleContext = templateEngine.generateSampleContext(variables);

console.log("Sample context:", sampleContext);
// Output:
// {
//   contact: { first_name: "John", last_name: "Doe", email: "john.doe@example.com" },
//   variables: { user_age: 42, is_premium: true, signup_date: "2023-01-15T10:30:00Z" },
//   system: { company_name: "Sample Company", current_date: "1/15/2023" }
// }
```

## 🔗 Tracking Integration

### Automatic Tracking

Templates automatically include tracking elements:

```html
<!-- Pixel tracking (automatically added) -->
<img src="https://track.example.com/pixel.gif?id=template_id&contact=contact_id" 
     width="1" height="1" style="display:none;">

<!-- Click tracking (automatically wraps links) -->
<a href="https://track.example.com/click?url=https%3A%2F%2Fexample.com&id=template_id">
  Original Link
</a>

<!-- Unsubscribe link (automatically added) -->
<p>
  <a href="https://track.example.com/unsubscribe?contact=contact_id&campaign=campaign_id">
    Unsubscribe
  </a>
</p>
```

### Tracking Configuration

```typescript
const trackingConfig = {
  baseUrl: "https://track.yourdomain.com",
  pixel_enabled: true,
  click_tracking_enabled: true,
  open_tracking_enabled: true,
  utm_params: {
    source: "email",
    medium: "email_campaign",
    campaign: "{{campaign.name}}",
  },
};
```

## 💾 Storage Integration

### Supabase Storage

Templates are stored in Supabase with full CRUD operations:

```typescript
// Create template
const template = await storage.createTemplate({
  id: "new-template",
  name: "New Template",
  subject: "Subject",
  html_content: "<h1>Content</h1>",
  variables: {},
});

// Read template
const template = await storage.getTemplate("template-id");

// Update template
await storage.updateTemplate("template-id", {
  subject: "Updated Subject",
  html_content: "<h1>Updated Content</h1>",
});

// Delete template
await storage.deleteTemplate("template-id");

// List templates
const templates = await storage.listTemplates();
```

### Template Versioning

```typescript
// Get template with version history
const template = await storage.getTemplateWithHistory("template-id");

// Create new version
await storage.createTemplateVersion("template-id", {
  subject: "New version subject",
  html_content: "<h1>New version</h1>",
  version_notes: "Updated for winter campaign",
});
```

## ⚡ Performance & Caching

### Template Caching

```typescript
// Templates are automatically cached after compilation
const template = await templateEngine.loadTemplate("template-id"); // Database hit
const template2 = await templateEngine.loadTemplate("template-id"); // Cache hit

// Cache statistics
const stats = await templateEngine.getStats();
console.log("Cached templates:", stats.templates.cached);
console.log("Cache hit rate:", stats.cache.hit_rate);
```

### Cache Management

```typescript
// Clear entire cache
templateEngine.clearCache();

// Clear specific template
templateEngine.invalidateTemplate("template-id");

// Configure cache size
const templateEngine = createTemplateEngine({
  cache: {
    maxSize: 500, // Maximum cached templates
    ttl: 3600000, // 1 hour TTL
  },
});
```

## 📈 Statistics & Monitoring

### Render Statistics

```typescript
const stats = await templateEngine.getStats();

console.log("Rendering Stats:");
console.log("- Total renders:", stats.rendering.total_renders);
console.log("- Successful renders:", stats.rendering.successful_renders);
console.log("- Failed renders:", stats.rendering.failed_renders);
console.log("- Average render time:", stats.rendering.average_render_time, "ms");

console.log("Template Stats:");
console.log("- Templates cached:", stats.templates.cached);
console.log("- Valid templates:", stats.templates.valid);
console.log("- Invalid templates:", stats.templates.invalid);

console.log("Performance:");
console.log("- Cache hit rate:", stats.cache.hit_rate);
console.log("- Memory usage:", stats.memory.usage_mb, "MB");
```

### Error Tracking

```typescript
// Track rendering errors
try {
  await templateEngine.renderTemplate("template-id", context);
} catch (error) {
  console.error("Render error:", error.message);
  
  // Error details
  if (error.type === "validation") {
    console.log("Validation errors:", error.details);
  } else if (error.type === "missing_variables") {
    console.log("Missing variables:", error.variables);
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Template Engine Configuration
TEMPLATE_TRACKING_BASE_URL=https://track.yourdomain.com
TEMPLATE_COMPANY_NAME=Your Company
TEMPLATE_COMPANY_ADDRESS=123 Main St, City, State 12345
TEMPLATE_CACHE_SIZE=100
TEMPLATE_CACHE_TTL=3600000

# Security Configuration
TEMPLATE_ALLOW_SCRIPT_TAGS=false
TEMPLATE_BLOCKED_HELPERS=eval,exec,require
```

### Programmatic Configuration

```typescript
const templateEngine = createTemplateEngine({
  storage: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
  },
  tracking: {
    baseUrl: "https://track.yourdomain.com",
    enablePixelTracking: true,
    enableClickTracking: true,
    utmParams: {
      source: "email",
      medium: "template_engine",
    },
  },
  cache: {
    maxSize: 100,
    ttl: 3600000, // 1 hour
  },
  security: {
    allowScriptTags: false,
    blockedHelpers: ["eval", "exec", "require"],
  },
  textGeneration: {
    wordwrap: 80,
    preserveLineBreaks: true,
  },
});
```

## 🧪 Testing

### Unit Testing

```typescript
import { describe, it, expect } from "vitest";
import { createTemplateEngine } from "./src/config/template-engine.config";

describe("Template Engine", () => {
  const templateEngine = createTemplateEngine();

  it("should render template with variables", async () => {
    const template = {
      id: "test",
      name: "Test",
      subject: "Hello {{contact.first_name}}!",
      html_content: "<p>Hello {{contact.first_name}}!</p>",
      text_content: "Hello {{contact.first_name}}!",
      variables: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await templateEngine.renderPreview(template, {
      first_name: "John",
    });

    expect(result.subject).toBe("Hello John!");
    expect(result.html).toContain("Hello John!");
  });
});
```

### Integration Testing

```typescript
// Test with real Supabase connection
describe("Template Storage Integration", () => {
  it("should save and load templates", async () => {
    const template = await templateEngine.loadTemplate("test-template");
    expect(template.id).toBe("test-template");
  });
});
```

## 🚨 Error Handling

### Common Errors

```typescript
// Template not found
try {
  await templateEngine.loadTemplate("nonexistent");
} catch (error) {
  // TemplateNotFoundError
  console.log(error.message); // "Template 'nonexistent' not found"
}

// Validation errors
try {
  await templateEngine.validateTemplate(invalidTemplate);
} catch (error) {
  // TemplateValidationError
  console.log(error.errors); // Array of validation errors
}

// Rendering errors
try {
  await templateEngine.renderTemplate("template-id", invalidContext);
} catch (error) {
  // TemplateRenderError
  console.log(error.missingVariables); // Array of missing variables
}
```

### Error Recovery

```typescript
// Graceful error handling
async function safeRenderTemplate(templateId: string, context: TemplateContext) {
  try {
    return await templateEngine.renderTemplate(templateId, context);
  } catch (error) {
    if (error.type === "missing_variables") {
      // Use default values for missing variables
      const defaultContext = { ...context };
      error.missingVariables.forEach(variable => {
        defaultContext.variables[variable] = "N/A";
      });
      return await templateEngine.renderTemplate(templateId, defaultContext);
    }
    throw error;
  }
}
```

## 📖 Best Practices

### Template Design

1. **Keep templates simple** - Avoid complex logic in templates
2. **Use semantic variable names** - `user_first_name` vs `ufn`
3. **Provide fallbacks** - Use `{{default}}` helper for optional variables
4. **Test thoroughly** - Validate templates before production use

### Performance Optimization

1. **Enable caching** - Use template caching for frequently used templates
2. **Minimize variables** - Only include necessary variables in context
3. **Optimize HTML** - Keep HTML clean and minimal
4. **Monitor statistics** - Track render times and cache hit rates

### Security Considerations

1. **Validate input** - Always validate template content
2. **Sanitize variables** - Clean user-provided variables
3. **Restrict helpers** - Block dangerous Handlebars helpers
4. **Review templates** - Manually review templates before deployment

## 🔄 Migration Guide

### From Other Template Engines

```typescript
// Migrating from Mustache
// Mustache: {{name}}
// Handlebars: {{name}} (same syntax)

// Migrating from Liquid
// Liquid: {{ user.name | capitalize }}
// Handlebars: {{capitalize user.name}}

// Migrating from Twig
// Twig: {{ user.name|upper }}
// Handlebars: {{upper user.name}}
```

### Version Upgrades

```typescript
// v1.x to v2.x migration
// Old API
const result = await templateEngine.render(templateId, variables);

// New API
const context = createTemplateContext(contact, variables);
const result = await templateEngine.renderTemplate(templateId, context);
```

## 📚 Examples

### E-commerce Order Confirmation

```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>Order Confirmation</title>
</head>
<body>
  <h1>Order Confirmation</h1>
  <p>Hi {{capitalize contact.first_name}},</p>
  
  <p>Thanks for your order! Your order #{{variables.order_number}} has been confirmed.</p>
  
  <h2>Order Details</h2>
  <ul>
    {{#each variables.items}}
    <li>{{name}} - Qty: {{quantity}} - ${{price}}</li>
    {{/each}}
  </ul>
  
  <p><strong>Total: ${{variables.total}}</strong></p>
  
  {{#if (gt variables.total 100)}}
  <p style="color: green;">🎉 You qualified for free shipping!</p>
  {{/if}}
  
  <p>Expected delivery: {{formatDate variables.delivery_date "long"}}</p>
  
  <p>Track your order: <a href="{{variables.tracking_url}}">{{variables.tracking_url}}</a></p>
</body>
</html>
```

### Newsletter Template

```handlebars
<!DOCTYPE html>
<html>
<head>
  <title>{{variables.newsletter_title}}</title>
</head>
<body>
  <h1>{{variables.newsletter_title}}</h1>
  <p>{{formatDate current_date "long"}}</p>
  
  <p>Hi {{contact.first_name}},</p>
  
  <p>Here's what's new this {{variables.period}}:</p>
  
  {{#each variables.articles}}
  <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd;">
    <h3>{{title}}</h3>
    <p>{{excerpt}}</p>
    <a href="{{url}}">Read more</a>
  </div>
  {{/each}}
  
  {{#if variables.is_premium}}
  <div style="background: #f0f8ff; padding: 15px; margin: 20px 0;">
    <h3>Premium Content</h3>
    <p>{{variables.premium_content}}</p>
  </div>
  {{/if}}
  
  <p>Best regards,<br>The {{company_name}} Team</p>
</body>
</html>
```

---

For more examples and advanced usage, see the [demo file](../examples/template-engine-demo.ts) and [test suite](../src/test/template-engine.test.ts). 