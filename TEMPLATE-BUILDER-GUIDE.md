# 🎨 Email Template Builder Guide

A complete guide to building email templates in the Momentum Email System.

## 🚀 Quick Start

### Method 1: Create Templates Programmatically

```typescript
// Run the template creation script
npm run ts-node create-template.ts

// Or import your existing file
npm run ts-node import-your-template.ts ./your-template.html "Your Template Name" "Subject Line"
```

### Method 2: Use the Email Service Directly

```typescript
import { EmailCampaignService } from './src/services/email-campaign.service';

const emailService = new EmailCampaignService();

const template = await emailService.createEmailTemplate({
  name: "Your Template Name",
  subject: "Hello {{contact.first_name}}!",
  html_content: "<h1>Hello {{contact.first_name}}!</h1>",
  text_content: "Hello {{contact.first_name}}!",
  variables: { /* your variables */ }
});
```

## 📝 Template Structure

### Required Fields

```typescript
interface EmailTemplate {
  name: string;              // Template name for identification
  subject: string;           // Email subject line with variables
  html_content?: string;     // HTML version (optional but recommended)
  text_content?: string;     // Plain text version (optional)
  variables: JsonObject;     // Default variable values
}
```

### Basic Template Example

```html
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1>Welcome {{contact.first_name}}!</h1>
    <p>Thank you for joining {{variables.company_name}}!</p>

    {{#if variables.is_premium}}
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px;">
        <h3>🎉 Premium Member Benefits</h3>
        <p>You qualify for exclusive rates and priority support!</p>
      </div>
    {{/if}}

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{variables.cta_url}}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
        Get Started
      </a>
    </div>
  </body>
</html>
```

## 🔧 Handlebars Variables

### Contact Variables (Always Available)

```handlebars
{{contact.first_name}}     <!-- Contact's first name -->
{{contact.last_name}}      <!-- Contact's last name -->
{{contact.full_name}}      <!-- Full name (first + last) -->
{{contact.email}}          <!-- Contact's email address -->
{{contact.id}}             <!-- Contact's unique ID -->
```

### System Variables (Always Available)

```handlebars
{{system.company_name}}        <!-- Your company name -->
{{system.company_address}}     <!-- Your company address -->
{{system.current_date}}        <!-- Current date -->
{{system.current_year}}        <!-- Current year -->
{{system.unsubscribe_url}}     <!-- Unsubscribe link -->
{{system.tracking_pixel_url}}  <!-- Tracking pixel URL -->
```

### Campaign Variables (When Available)

```handlebars
{{campaign.name}}          <!-- Campaign name -->
{{campaign.id}}            <!-- Campaign ID -->
```

### Custom Variables

```handlebars
{{variables.your_variable}}    <!-- Your custom variables -->
{{variables.amount}}           <!-- Example: "$50,000" -->
{{variables.product_name}}     <!-- Example: "Business Loan" -->
{{variables.company_name}}     <!-- Example: "Doe's Restaurant" -->
```

## 🎯 Advanced Handlebars Features

### Conditional Logic

```handlebars
{{#if variables.is_premium}}
  <p>Premium member content</p>
{{else}}
  <p>Standard member content</p>
{{/if}}

{{#if (eq variables.status "approved")}}
  <p style="color: green;">✅ Approved</p>
{{else if (eq variables.status "pending")}}
  <p style="color: orange;">⏳ Under Review</p>
{{else}}
  <p style="color: red;">❌ Declined</p>
{{/if}}
```

### Loops

```handlebars
{{#each variables.benefits}}
  <li>{{this}}</li>
{{/each}}

{{#each variables.loan_options}}
  <div>
    <h3>{{this.title}}</h3>
    <p>Amount: {{this.amount}}</p>
    <p>Rate: {{this.rate}}</p>
  </div>
{{/each}}
```

### Comparison Helpers

```handlebars
{{#if (gt variables.amount 50000)}}
  <p>High-value loan</p>
{{/if}}

{{#if (and variables.is_active variables.is_verified)}}
  <p>Account fully activated</p>
{{/if}}

{{#if (or variables.is_premium variables.is_vip)}}
  <p>Special member benefits</p>
{{/if}}
```

### Text Formatting

```handlebars
{{capitalize contact.first_name}}     <!-- "john" → "John" -->
{{upper contact.last_name}}           <!-- "doe" → "DOE" -->
{{lower contact.email}}               <!-- "JOHN@EXAMPLE.COM" → "john@example.com" -->
{{default variables.phone "Not provided"}}  <!-- Use default if empty -->
{{urlEncode variables.callback_url}}  <!-- URL encode values -->
```

### Date Formatting

```handlebars
{{formatDate variables.signup_date "short"}}     <!-- "1/15/2023" -->
{{formatDate variables.event_date "long"}}       <!-- "January 15, 2023" -->
{{formatDate variables.created_at "iso"}}        <!-- "2023-01-15T10:30:00Z" -->
```

## 🎨 Styling Best Practices

### Responsive Design

```html
<style>
  @media only screen and (max-width: 600px) {
    .container {
      padding: 10px !important;
    }
    .button {
      width: 100% !important;
      padding: 15px !important;
    }
  }
</style>
```

### Inline Styles (Recommended)

```html
<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #2563eb; margin: 0 0 15px 0;">Important Information</h2>
  <p style="margin: 0; line-height: 1.6;">Your content here</p>
</div>
```

### Color Scheme

```css
/* Primary Colors */
#2563eb    /* Blue - Primary actions */
#059669    /* Green - Success/approved */
#dc2626    /* Red - Error/declined */
#d97706    /* Orange - Warning/pending */

/* Neutral Colors */
#374151    /* Dark gray - Headers */
#6b7280    /* Medium gray - Body text */
#f8f9fa    /* Light gray - Backgrounds */
#e5e7eb    /* Border gray */
```

## 📧 Email Client Compatibility

### Supported Features

- ✅ Basic HTML tags (h1-h6, p, div, table, etc.)
- ✅ Inline CSS styles
- ✅ Images with alt text
- ✅ Links with tracking
- ✅ Tables for layout
- ✅ Basic media queries

### Avoid These Features

- ❌ JavaScript
- ❌ Forms
- ❌ CSS Grid/Flexbox (limited support)
- ❌ Web fonts (fallback required)
- ❌ CSS animations
- ❌ Background images in Outlook

## 🔗 Automatic Features

### Tracking

Your templates automatically include:

```html
<!-- Pixel tracking (added automatically) -->
<img src="{{tracking_pixel_url}}" width="1" height="1" style="display:none;">

<!-- Click tracking (wraps all links automatically) -->
<a href="https://example.com">Original Link</a>
<!-- Becomes: -->
<a href="https://track.yourdomain.com/click?url=https%3A%2F%2Fexample.com&id=template_id">Original Link</a>
```

### Unsubscribe Links

```html
<!-- Add this to your templates -->
<a href="{{system.unsubscribe_url}}">Unsubscribe</a>

<!-- Or use the import script to add automatically -->
```

## 🧪 Testing Templates

### Preview Template

```typescript
import { createTemplateEngine } from './src/config/template-engine.config';

const templateEngine = createTemplateEngine();

const result = await templateEngine.renderTemplate(templateId, {
  contact: {
    id: "123",
    email: "john@example.com",
    first_name: "John",
    last_name: "Doe",
    full_name: "John Doe"
  },
  variables: {
    company_name: "Test Company",
    amount: "$25,000",
    is_premium: true
  },
  system: {
    company_name: "Momentum Business Capital",
    current_date: new Date().toLocaleDateString(),
    unsubscribe_url: "https://example.com/unsubscribe"
  }
});

console.log('Subject:', result.subject);
console.log('HTML:', result.html);
console.log('Text:', result.text);
```

### Validation

```typescript
// Templates are automatically validated for:
// - Required fields
// - Handlebars syntax
// - Security issues
// - Variable consistency

const validation = await templateEngine.validateTemplate(template);
if (!validation.valid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

## 📱 Mobile Optimization

### Mobile-First Design

```html
<table style="width: 100%; max-width: 600px; margin: 0 auto;">
  <tr>
    <td style="padding: 20px;">
      <h1 style="font-size: 24px; margin: 0 0 20px 0;">Mobile-Friendly Header</h1>
      <p style="font-size: 16px; line-height: 1.5;">Your content here</p>
    </td>
  </tr>
</table>
```

### Responsive Images

```html
<img src="your-image.jpg"
     alt="Description"
     style="width: 100%; max-width: 300px; height: auto; display: block;">
```

### Touch-Friendly Buttons

```html
<a href="{{variables.cta_url}}"
   style="display: inline-block; padding: 15px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; min-width: 200px; text-align: center;">
  Call to Action
</a>
```

## 📊 Performance Tips

### Template Caching

- Templates are automatically cached after first compilation
- Cache invalidation happens when templates are updated
- Use consistent variable names across templates

### Optimization

- Keep HTML under 100KB for best deliverability
- Optimize images and use appropriate formats
- Use external CSS sparingly
- Test with various email clients

## 🔐 Security Features

### Automatic Sanitization

- HTML content is automatically sanitized
- Script tags are blocked
- Dangerous helpers are prevented
- XSS protection is built-in

### Variable Validation

- Template variables are validated
- Required variables are checked
- Type inference helps prevent errors

## 🚀 Production Deployment

### Environment Variables

```bash
# In your .env file
TEMPLATE_TRACKING_BASE_URL=https://track.yourdomain.com
TEMPLATE_COMPANY_NAME=Your Company
TEMPLATE_COMPANY_ADDRESS=123 Main St, City, State 12345
```

### Database Storage

Templates are stored in Supabase:

```sql
-- Templates table structure
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT,
  text_content TEXT,
  variables JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 📈 Analytics Integration

### Template Performance

```typescript
const stats = await templateEngine.getStats();
console.log('Template renders:', stats.rendering.total_renders);
console.log('Cache hit rate:', stats.cache.hit_rate);
```

### Campaign Tracking

```typescript
const campaignStats = await emailService.getCampaignStats(campaignId);
console.log('Open rate:', campaignStats.open_rate);
console.log('Click rate:', campaignStats.click_rate);
```

## 🛠️ Common Issues & Solutions

### Template Not Rendering

```typescript
// Check template validation
const validation = await templateEngine.validateTemplate(template);
if (!validation.valid) {
  console.log('Fix these errors:', validation.errors);
}
```

### Variables Not Showing

```typescript
// Ensure variables are properly passed
const context = {
  contact: { first_name: "John" },
  variables: { company_name: "Your Company" },
  system: { current_date: new Date().toLocaleDateString() }
};
```

### Styling Issues

- Use inline styles for email clients
- Test with Litmus or Email on Acid
- Provide fallback fonts
- Use tables for complex layouts

## 📚 Additional Resources

- [Template Engine Documentation](./docs/TEMPLATE-ENGINE.md)
- [API Reference](./docs/API-REFERENCE.md)
- [Examples](./examples/)
- [Testing Guide](./tests/)

## 🎯 Next Steps

1. **Create your first template** using `create-template.ts`
2. **Import existing templates** using `import-your-template.ts`
3. **Test your templates** with sample data
4. **Create campaigns** using the template
5. **Monitor performance** with analytics

---

**Need help?** Check the documentation or reach out to your development team!
