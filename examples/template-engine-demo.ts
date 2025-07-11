import { createTemplateContext, createTemplateEngine } from '../src/config/template-engine.config';
import { EmailTemplate } from '../src/types/email-system';

// Example 1: Basic Template Usage
export async function basicTemplateExample() {
  console.log('=== Basic Template Example ===');
  
  const templateEngine = createTemplateEngine();
  
  // Create a simple template
  const template: EmailTemplate = {
    id: 'welcome-template',
    name: 'Welcome Email',
    subject: 'Welcome to {{company_name}}, {{contact.first_name}}!',
    html_content: `
      <html>
        <head><title>Welcome</title></head>
        <body>
          <h1>Welcome {{contact.first_name}}!</h1>
          <p>Thank you for joining {{company_name}}. We're excited to have you!</p>
          <p>Your account email: {{contact.email}}</p>
          <p>Member since: {{formatDate variables.signup_date "long"}}</p>
        </body>
      </html>
    `,
    text_content: `
      Welcome {{contact.first_name}}!
      
      Thank you for joining {{company_name}}. We're excited to have you!
      
      Your account email: {{contact.email}}
      Member since: {{formatDate variables.signup_date "long"}}
    `,
    variables: {
      signup_date: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate template
  const validation = await templateEngine.validateTemplate(template);
  console.log('Template validation:', validation.valid ? 'PASSED' : 'FAILED');
  
  if (!validation.valid) {
    console.log('Validation errors:', validation.errors);
    return;
  }

  // Create context for rendering
  const context = createTemplateContext(
    {
      id: 'user-123',
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
    },
    {
      signup_date: new Date('2024-01-15').toISOString(),
    }
  );

  // Render template
  const previewData = {
    ...context.variables,
    first_name: context.contact.first_name,
    last_name: context.contact.last_name,
    email: context.contact.email,
  };
  const result = await templateEngine.renderPreview(template, previewData);
  
  console.log('Subject:', result.subject);
  console.log('HTML length:', result.html.length);
  console.log('Text length:', result.text.length);
  console.log('Tracking enabled:', result.tracking.click_tracking_enabled);
}

// Example 2: E-commerce Order Confirmation
export async function ecommerceOrderExample() {
  console.log('\n=== E-commerce Order Example ===');
  
  const templateEngine = createTemplateEngine();
  
  const orderTemplate: EmailTemplate = {
    id: 'order-confirmation',
    name: 'Order Confirmation',
    subject: 'Order #{{variables.order_number}} confirmed - {{company_name}}',
    html_content: `
      <html>
        <head><title>Order Confirmation</title></head>
        <body>
          <h1>Order Confirmation</h1>
          <p>Hi \{\{capitalize contact.first_name\}\},</p>
          <p>Thanks for your order! Your order #\{\{variables.order_number\}\} has been confirmed.</p>
          
          <h2>Order Details</h2>
          <ul>
            \{\{#each variables.items\}\}
            <li>\{\{name\}\} - Qty: \{\{quantity\}\} - $\{\{price\}\}</li>
            \{\{/each\}\}
          </ul>
          
          <p><strong>Total: $\{\{variables.total\}\}</strong></p>
          
          \{\{#if (gt variables.total 100)\}\}
          <p style="color: green;">🎉 You qualified for free shipping!</p>
          \{\{/if\}\}
          
          <p>Expected delivery: \{\{formatDate variables.delivery_date "long"\}\}</p>
          
          <p>Track your order: <a href="\{\{variables.tracking_url\}\}">\{\{variables.tracking_url\}\}</a></p>
        </body>
      </html>
    `,
    text_content: `
      Order Confirmation
      
      Hi \{\{capitalize contact.first_name\}\},
      
      Thanks for your order! Your order #\{\{variables.order_number\}\} has been confirmed.
      
      Order Details:
      \{\{#each variables.items\}\}
      - \{\{name\}\} - Qty: \{\{quantity\}\} - $\{\{price\}\}
      \{\{/each\}\}
      
      Total: $\{\{variables.total\}\}
      
      \{\{#if (gt variables.total 100)\}\}
      🎉 You qualified for free shipping!
      \{\{/if\}\}
      
      Expected delivery: \{\{formatDate variables.delivery_date "long"\}\}
      
      Track your order: \{\{variables.tracking_url\}\}
    `,
    variables: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const orderContext = createTemplateContext(
    {
      id: 'customer-456',
      email: 'alice@example.com',
      first_name: 'alice',
      last_name: 'smith',
    },
    {
      order_number: 'ORD-2024-001',
      total: 149.99,
      items: [
        { name: 'Wireless Headphones', quantity: 1, price: 99.99 },
        { name: 'Phone Case', quantity: 2, price: 25.00 },
      ],
      delivery_date: new Date('2024-02-15').toISOString(),
      tracking_url: 'https://track.example.com/ORD-2024-001',
    }
  );

  const previewData = {
    ...orderContext.variables,
    first_name: orderContext.contact.first_name,
    last_name: orderContext.contact.last_name,
    email: orderContext.contact.email,
  };
  const result = await templateEngine.renderPreview(orderTemplate, previewData);
  
  console.log('Subject:', result.subject);
  console.log('Contains free shipping message:', result.html.includes('free shipping'));
  console.log('Items count:', orderContext.variables.items.length);
}

// Example 3: Newsletter with Personalization
export async function newsletterExample() {
  console.log('\n=== Newsletter Example ===');
  
  const templateEngine = createTemplateEngine();
  
  const newsletterTemplate: EmailTemplate = {
    id: 'newsletter-template',
    name: 'Monthly Newsletter',
    subject: 'Monthly Update - {{formatDate system.current_date "short"}}',
    html_content: `
      <html>
        <head><title>Newsletter</title></head>
        <body>
          <h1>Monthly Newsletter</h1>
          
          {{#if contact.first_name}}
          <p>Hello {{contact.first_name}},</p>
          {{else}}
          <p>Hello there,</p>
          {{/if}}
          
          <h2>This Month's Highlights</h2>
          {{#each variables.articles}}
          <div style="margin-bottom: 20px;">
            <h3><a href="{{url}}">{{title}}</a></h3>
            <p>{{summary}}</p>
            <small>Published: {{formatDate date "short"}}</small>
          </div>
          {{/each}}
          
          {{#if variables.is_premium}}
          <h2>Premium Content</h2>
          <p>As a premium member, you have access to:</p>
          <ul>
            <li>Advanced tutorials</li>
            <li>Priority support</li>
            <li>Early access to new features</li>
          </ul>
          {{else}}
          <h2>Upgrade to Premium</h2>
          <p><a href="{{variables.upgrade_url}}">Upgrade now</a> to access premium content!</p>
          {{/if}}
        </body>
      </html>
    `,
    text_content: `
      Monthly Newsletter
      
      {{#if contact.first_name}}
      Hello {{contact.first_name}},
      {{else}}
      Hello there,
      {{/if}}
      
      This Month's Highlights:
      {{#each variables.articles}}
      
      {{title}}
      {{summary}}
      Read more: {{url}}
      Published: {{formatDate date "short"}}
      {{/each}}
      
      {{#if variables.is_premium}}
      Premium Content:
      As a premium member, you have access to:
      - Advanced tutorials
      - Priority support  
      - Early access to new features
      {{else}}
      Upgrade to Premium:
      Upgrade now to access premium content!
      {{variables.upgrade_url}}
      {{/if}}
    `,
    variables: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const newsletterContext = createTemplateContext(
    {
      id: 'subscriber-789',
      email: 'subscriber@example.com',
      first_name: 'Sarah',
    },
    {
      is_premium: true,
      articles: [
        {
          title: 'Getting Started with Email Templates',
          summary: 'Learn how to create effective email templates.',
          url: 'https://blog.example.com/email-templates',
          date: new Date('2024-01-20').toISOString(),
        },
        {
          title: 'Email Marketing Best Practices',
          summary: 'Tips for improving your email marketing campaigns.',
          url: 'https://blog.example.com/email-best-practices',
          date: new Date('2024-01-25').toISOString(),
        },
      ],
      upgrade_url: 'https://example.com/upgrade',
    }
  );

  const previewData = {
    ...newsletterContext.variables,
    first_name: newsletterContext.contact.first_name,
    last_name: newsletterContext.contact.last_name,
    email: newsletterContext.contact.email,
  };
  const result = await templateEngine.renderPreview(
    newsletterTemplate,
    previewData
  );
  
  console.log('Subject:', result.subject);
  console.log('Contains premium content:', result.html.includes('Premium Content'));
  console.log('Articles count:', newsletterContext.variables.articles.length);
}

// Example 4: Template Preview and Validation
export async function templatePreviewExample() {
  console.log('\n=== Template Preview Example ===');
  
  const templateEngine = createTemplateEngine();
  
  // Template with various variable types
  const previewTemplate: EmailTemplate = {
    id: 'preview-template',
    name: 'Preview Template',
    subject: 'Hello {{contact.first_name}}! Your {{variables.item_type}} is ready',
    html_content: `
      <html>
        <body>
          <h1>{{variables.title}}</h1>
          <p>Hello {{contact.first_name}},</p>
          
          <p>Your {{variables.item_type}} is ready for pickup!</p>
          
          <h2>Details:</h2>
          <ul>
            <li>Item: {{variables.item_name}}</li>
            <li>Quantity: {{variables.quantity}}</li>
            <li>Price: $\{\{variables.price\}\}</li>
            <li>Ready date: {{formatDate variables.ready_date "long"}}</li>
          </ul>
          
          {{#if variables.special_instructions}}
          <p><strong>Special Instructions:</strong> {{variables.special_instructions}}</p>
          {{/if}}
          
          <p>Please bring your ID and order confirmation.</p>
        </body>
      </html>
    `,
    text_content: `
      {{variables.title}}
      
      Hello {{contact.first_name}},
      
      Your {{variables.item_type}} is ready for pickup!
      
      Details:
      - Item: {{variables.item_name}}
      - Quantity: {{variables.quantity}}
      - Price: $\{\{variables.price\}\}
      - Ready date: {{formatDate variables.ready_date "long"}}
      
      {{#if variables.special_instructions}}
      Special Instructions: {{variables.special_instructions}}
      {{/if}}
      
      Please bring your ID and order confirmation.
    `,
    variables: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // First, validate the template
  const validation = await templateEngine.validateTemplate(previewTemplate);
  console.log('Template validation:', validation.valid ? 'PASSED' : 'FAILED');
  
  if (validation.valid) {
    console.log('Detected variables:', validation.variables.map(v => `${v.name} (${v.type})`));
    
    // Generate preview with sample data
    const preview = await templateEngine.renderPreview(previewTemplate, {
      title: 'Order Ready for Pickup',
      item_type: 'custom print',
      item_name: 'Business Cards - Premium',
      quantity: 500,
      price: 75.00,
      ready_date: new Date('2024-02-10').toISOString(),
      special_instructions: 'Please call upon arrival',
    });
    
    console.log('Preview subject:', preview.subject);
    console.log('Preview contains special instructions:', preview.html.includes('special instructions'));
  }
}

// Example 5: Advanced Template Features
export async function advancedTemplateExample() {
  console.log('\n=== Advanced Template Example ===');
  
  const templateEngine = createTemplateEngine();
  
  const advancedTemplate: EmailTemplate = {
    id: 'advanced-template',
    name: 'Advanced Features Demo',
    subject: 'Advanced Features Demo - {{formatDate system.current_date "short"}}',
    html_content: `
      <html>
        <head><title>Advanced Demo</title></head>
        <body>
          <h1>Advanced Template Features</h1>
          
          <!-- Conditional content -->
          {{#if contact.first_name}}
          <p>Hello {{capitalize contact.first_name}},</p>
          {{else}}
          <p>Hello there,</p>
          {{/if}}
          
          <!-- Loop through arrays -->
          {{#if variables.products}}
          <h2>Your Products</h2>
          {{#each variables.products}}
          <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
            <h3>\{\{name\}\} - $\{\{price\}\}</h3>
            <p>{{description}}</p>
            {{#if (gt stock 0)}}
            <p style="color: green;">In Stock ({{stock}} available)</p>
            {{else}}
            <p style="color: red;">Out of Stock</p>
            {{/if}}
          </div>
          {{/each}}
          {{/if}}
          
          <!-- Comparison helpers -->
          {{#if (gt variables.loyalty_points 1000)}}
          <div style="background: gold; padding: 10px;">
            <h3>🏆 Gold Member Benefits</h3>
            <p>You have {{variables.loyalty_points}} points!</p>
          </div>
          {{else if (gt variables.loyalty_points 500)}}
          <div style="background: silver; padding: 10px;">
            <h3>🥈 Silver Member Benefits</h3>
            <p>You have {{variables.loyalty_points}} points!</p>
          </div>
          {{else}}
          <div style="background: bronze; padding: 10px;">
            <h3>🥉 Bronze Member</h3>
            <p>You have {{variables.loyalty_points}} points!</p>
          </div>
          {{/if}}
          
          <!-- URL encoding -->
          <p>Share this link: <a href="{{variables.base_url}}?ref={{urlEncode contact.email}}">Click here</a></p>
          
          <!-- Default values -->
          <p>Support phone: {{default variables.support_phone "1-800-SUPPORT"}}</p>
          
          <!-- Date formatting -->
          <p>Current date: {{formatDate system.current_date "long"}}</p>
          <p>Current year: {{system.current_year}}</p>
        </body>
      </html>
    `,
    text_content: `
      Advanced Template Features
      
      {{#if contact.first_name}}
      Hello {{capitalize contact.first_name}},
      {{else}}
      Hello there,
      {{/if}}
      
      {{#if variables.products}}
      Your Products:
      {{#each variables.products}}
      
      \{\{name\}\} - $\{\{price\}\}
      {{description}}
      {{#if (gt stock 0)}}
      In Stock ({{stock}} available)
      {{else}}
      Out of Stock
      {{/if}}
      {{/each}}
      {{/if}}
      
      {{#if (gt variables.loyalty_points 1000)}}
      🏆 Gold Member Benefits
      You have {{variables.loyalty_points}} points!
      {{else if (gt variables.loyalty_points 500)}}
      🥈 Silver Member Benefits
      You have {{variables.loyalty_points}} points!
      {{else}}
      🥉 Bronze Member
      You have {{variables.loyalty_points}} points!
      {{/if}}
      
      Share this link: {{variables.base_url}}?ref={{urlEncode contact.email}}
      
      Support phone: {{default variables.support_phone "1-800-SUPPORT"}}
      
      Current date: {{formatDate system.current_date "long"}}
      Current year: {{system.current_year}}
    `,
    variables: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const advancedContext = createTemplateContext(
    {
      id: 'advanced-user',
      email: 'advanced@example.com',
      first_name: 'alexandra',
      last_name: 'advanced',
    },
    {
      loyalty_points: 1250,
      products: [
        { name: 'Premium Widget', price: 99.99, description: 'High-quality widget', stock: 5 },
        { name: 'Standard Widget', price: 49.99, description: 'Basic widget', stock: 0 },
        { name: 'Mini Widget', price: 19.99, description: 'Compact widget', stock: 15 },
      ],
      base_url: 'https://example.com/share',
      support_phone: null, // Will use default
    }
  );

  const result = await templateEngine.renderPreview(advancedTemplate, advancedContext.variables);
  
  console.log('Subject:', result.subject);
  console.log('Contains Gold Member:', result.html.includes('Gold Member'));
  console.log('Contains default support phone:', result.html.includes('1-800-SUPPORT'));
  console.log('Products in stock:', advancedContext.variables.products.filter((p: any) => p.stock > 0).length);
}

// Example 6: Template Engine Statistics
export async function templateStatsExample() {
  console.log('\n=== Template Statistics Example ===');
  
  const templateEngine = createTemplateEngine();
  
  // Create a few templates and render them
  const templates: EmailTemplate[] = [
    {
      id: 'stats-template-1',
      name: 'Stats Template 1',
      subject: 'Test 1',
      html_content: '<p>Hello {{contact.first_name}}!</p>',
      text_content: 'Hello {{contact.first_name}}!',
      variables: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'stats-template-2',
      name: 'Stats Template 2',
      subject: 'Test 2',
      html_content: '<p>Goodbye {{contact.first_name}}!</p>',
      text_content: 'Goodbye {{contact.first_name}}!',
      variables: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const context = createTemplateContext({
    id: 'stats-user',
    email: 'stats@example.com',
    first_name: 'Stats',
  });

  // Render templates multiple times
  for (const template of templates) {
    for (let i = 0; i < 3; i++) {
      try {
        const previewData = {
          ...context.variables,
          first_name: context.contact.first_name,
          last_name: context.contact.last_name,
          email: context.contact.email,
        };
        await templateEngine.renderPreview(template, previewData);
      } catch (error) {
        console.log(`Error rendering ${template.id}:`, error);
      }
    }
  }

  // Get statistics
  const stats = await templateEngine.getStats();
  console.log('Template Engine Statistics:');
  console.log('- Total renders:', stats.rendering.total_renders);
  console.log('- Successful renders:', stats.rendering.successful_renders);
  console.log('- Failed renders:', stats.rendering.failed_renders);
  console.log('- Average render time:', stats.rendering.average_render_time.toFixed(2), 'ms');
  console.log('- Templates cached:', stats.templates.cached);
  console.log('- Valid templates:', stats.templates.valid);
  console.log('- Invalid templates:', stats.templates.invalid);
}

// Run all examples
export async function runAllExamples() {
  console.log('🚀 Running Template Engine Examples...\n');
  
  try {
    await basicTemplateExample();
    await ecommerceOrderExample();
    await newsletterExample();
    await templatePreviewExample();
    await advancedTemplateExample();
    await templateStatsExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
} 