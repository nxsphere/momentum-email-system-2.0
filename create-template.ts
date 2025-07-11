import { createTemplateEngine } from './src/config/template-engine.config';
import { EmailCampaignService } from './src/services/email-campaign.service';

/**
 * Template Builder - Different approaches to creating email templates
 */

async function createBasicTemplate() {
  console.log('🎨 Creating Basic Email Template...');

  const emailService = new EmailCampaignService();

  const template = await emailService.createEmailTemplate({
    name: "Welcome Email Template",
    subject: "Welcome to Momentum Business Capital, {{contact.first_name}}!",
    html_content: `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h1 style="color: #2563eb; margin-bottom: 20px;">Welcome {{contact.first_name}}!</h1>

            <p>Thank you for your interest in Momentum Business Capital. We're excited to help your business grow!</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1e40af; margin-top: 0;">What We Offer:</h2>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>✅ Fast funding solutions up to $500K</li>
                <li>✅ Competitive rates starting at 8.9%</li>
                <li>✅ Expert business consultation</li>
                <li>✅ Same-day approval process</li>
              </ul>
            </div>

            {{#if variables.is_premium}}
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #92400e; margin: 0 0 10px 0;">🎉 Premium Member Benefits</h3>
                <p style="margin: 0; color: #92400e;">You qualify for our premium rates and priority processing!</p>
              </div>
            {{/if}}

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://momentumbusiness.capital/apply"
                 style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Apply Now
              </a>
            </div>

            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Momentum Team</strong>
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

            <div style="font-size: 12px; color: #6b7280; text-align: center;">
              <p>Momentum Business Capital<br>
              📧 {{default variables.company_email "funding@momentumbusiness.capital"}}<br>
              📞 {{default variables.company_phone "1-800-MOMENTUM"}}</p>

              <p style="margin-top: 15px;">
                <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> |
                <a href="https://momentumbusiness.capital/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text_content: `
Welcome {{contact.first_name}}!

Thank you for your interest in Momentum Business Capital. We're excited to help your business grow!

What We Offer:
✅ Fast funding solutions up to $500K
✅ Competitive rates starting at 8.9%
✅ Expert business consultation
✅ Same-day approval process

{{#if variables.is_premium}}
🎉 Premium Member Benefits
You qualify for our premium rates and priority processing!
{{/if}}

Apply Now: https://momentumbusiness.capital/apply

Best regards,
The Momentum Team

Momentum Business Capital
📧 {{default variables.company_email "funding@momentumbusiness.capital"}}
📞 {{default variables.company_phone "1-800-MOMENTUM"}}

Unsubscribe: {{unsubscribe_url}}
Privacy Policy: https://momentumbusiness.capital/privacy
    `,
    variables: {
      is_premium: false,
      company_email: "funding@momentumbusiness.capital",
      company_phone: "1-800-MOMENTUM"
    }
  });

  console.log('✅ Template created successfully!');
  console.log('📧 Template ID:', template.id);
  console.log('📝 Template Name:', template.name);

  return template;
}

async function createAdvancedTemplate() {
  console.log('🚀 Creating Advanced Email Template with Conditional Logic...');

  const emailService = new EmailCampaignService();

  const template = await emailService.createEmailTemplate({
    name: "Business Funding Proposal",
    subject: "{{#if variables.urgent}}🚨 URGENT: {{/if}}Your {{variables.loan_amount}} Funding Proposal - {{variables.business_name}}",
    html_content: `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Funding Proposal</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 300;">Momentum Business Capital</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Accelerating Your Business Growth</p>
          </div>

          <!-- Main Content -->
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

            {{#if variables.urgent}}
              <div style="background-color: #fef2f2; border: 2px solid #f87171; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                <h2 style="color: #dc2626; margin: 0 0 10px 0; font-size: 18px;">🚨 Time-Sensitive Offer</h2>
                <p style="margin: 0; color: #7f1d1d;">This proposal expires in {{variables.expiry_hours}} hours. Act quickly to secure your funding!</p>
              </div>
            {{/if}}

            <h2 style="color: #374151; margin-top: 0;">Dear {{capitalize contact.first_name}},</h2>

            <p>We've prepared a customized funding proposal for <strong>{{variables.business_name}}</strong> based on your recent inquiry.</p>

            <!-- Funding Details -->
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 25px 0;">
              <h3 style="color: #0369a1; margin: 0 0 15px 0;">💰 Your Funding Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Requested Amount:</td>
                  <td style="padding: 8px 0; text-align: right; color: #059669; font-weight: bold; font-size: 18px;">{{variables.loan_amount}}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold;">Estimated Rate:</td>
                  <td style="padding: 8px 0; text-align: right;">{{variables.interest_rate}}% APR</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold;">Term Length:</td>
                  <td style="padding: 8px 0; text-align: right;">{{variables.term_months}} months</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold;">Approval Status:</td>
                  <td style="padding: 8px 0; text-align: right;">
                    {{#if (eq variables.approval_status "approved")}}
                      <span style="color: #059669; font-weight: bold;">✅ PRE-APPROVED</span>
                    {{else if (eq variables.approval_status "pending")}}
                      <span style="color: #d97706; font-weight: bold;">⏳ UNDER REVIEW</span>
                    {{else}}
                      <span style="color: #dc2626; font-weight: bold;">📋 DOCUMENTATION NEEDED</span>
                    {{/if}}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Industry-Specific Benefits -->
            {{#if variables.industry}}
              <div style="background-color: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #92400e; margin: 0 0 15px 0;">🏢 {{capitalize variables.industry}} Industry Benefits</h3>
                {{#if (eq variables.industry "restaurant")}}
                  <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Equipment financing available</li>
                    <li>Seasonal payment flexibility</li>
                    <li>POS system integration support</li>
                  </ul>
                {{else if (eq variables.industry "retail")}}
                  <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Inventory financing options</li>
                    <li>Holiday season payment deferral</li>
                    <li>E-commerce platform integration</li>
                  </ul>
                {{else if (eq variables.industry "construction")}}
                  <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Project-based funding</li>
                    <li>Equipment lease-to-own</li>
                    <li>Bonding assistance</li>
                  </ul>
                {{else}}
                  <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Flexible payment terms</li>
                    <li>Business growth consultation</li>
                    <li>Industry-specific expertise</li>
                  </ul>
                {{/if}}
              </div>
            {{/if}}

            <!-- Next Steps -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0;">📋 Next Steps</h3>
              <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Review your proposal details above</li>
                <li style="margin-bottom: 8px;">Complete any missing documentation</li>
                <li style="margin-bottom: 8px;">Schedule a call with your dedicated advisor</li>
                <li>Receive funds within 24-48 hours of approval</li>
              </ol>
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              {{#if (eq variables.approval_status "approved")}}
                <a href="https://momentumbusiness.capital/accept-offer?id={{variables.proposal_id}}"
                   style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                  Accept Offer
                </a>
              {{else}}
                <a href="https://momentumbusiness.capital/complete-application?id={{variables.proposal_id}}"
                   style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                  Complete Application
                </a>
              {{/if}}
              <a href="https://momentumbusiness.capital/schedule-call?advisor={{variables.advisor_id}}"
                 style="background-color: #6b7280; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                Schedule Call
              </a>
            </div>

            <!-- Personal Touch -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="font-style: italic; color: #6b7280;">
                "{{contact.first_name}}, I've personally reviewed your application and believe this funding will significantly accelerate {{variables.business_name}}'s growth. I'm here to answer any questions you might have."
              </p>
              <div style="display: flex; align-items: center; margin-top: 15px;">
                <div>
                  <strong>{{default variables.advisor_name "Sarah Johnson"}}</strong><br>
                  <span style="color: #6b7280;">Senior Business Advisor</span><br>
                  <a href="mailto:{{default variables.advisor_email "sarah@momentumbusiness.capital"}}"
                     style="color: #2563eb; text-decoration: none;">{{default variables.advisor_email "sarah@momentumbusiness.capital"}}</a>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; font-size: 12px; color: #6b7280; text-align: center;">
            <p style="margin: 0 0 10px 0;">
              <strong>Momentum Business Capital</strong><br>
              📧 funding@momentumbusiness.capital | 📞 1-800-MOMENTUM<br>
              🌐 <a href="https://momentumbusiness.capital" style="color: #2563eb;">momentumbusiness.capital</a>
            </p>
            <p style="margin: 10px 0 0 0;">
              <a href="{{unsubscribe_url}}" style="color: #6b7280;">Unsubscribe</a> |
              <a href="https://momentumbusiness.capital/privacy" style="color: #6b7280;">Privacy Policy</a> |
              <a href="https://momentumbusiness.capital/terms" style="color: #6b7280;">Terms of Service</a>
            </p>
          </div>
        </body>
      </html>
    `,
    text_content: `
{{#if variables.urgent}}🚨 URGENT: {{/if}}Your {{variables.loan_amount}} Funding Proposal - {{variables.business_name}}

Dear {{capitalize contact.first_name}},

We've prepared a customized funding proposal for {{variables.business_name}} based on your recent inquiry.

💰 YOUR FUNDING DETAILS:
- Requested Amount: {{variables.loan_amount}}
- Estimated Rate: {{variables.interest_rate}}% APR
- Term Length: {{variables.term_months}} months
- Approval Status: {{#if (eq variables.approval_status "approved")}}✅ PRE-APPROVED{{else if (eq variables.approval_status "pending")}}⏳ UNDER REVIEW{{else}}📋 DOCUMENTATION NEEDED{{/if}}

{{#if variables.industry}}
🏢 {{capitalize variables.industry}} Industry Benefits:
{{#if (eq variables.industry "restaurant")}}
- Equipment financing available
- Seasonal payment flexibility
- POS system integration support
{{else if (eq variables.industry "retail")}}
- Inventory financing options
- Holiday season payment deferral
- E-commerce platform integration
{{else if (eq variables.industry "construction")}}
- Project-based funding
- Equipment lease-to-own
- Bonding assistance
{{else}}
- Flexible payment terms
- Business growth consultation
- Industry-specific expertise
{{/if}}
{{/if}}

📋 NEXT STEPS:
1. Review your proposal details above
2. Complete any missing documentation
3. Schedule a call with your dedicated advisor
4. Receive funds within 24-48 hours of approval

{{#if (eq variables.approval_status "approved")}}
Accept Offer: https://momentumbusiness.capital/accept-offer?id={{variables.proposal_id}}
{{else}}
Complete Application: https://momentumbusiness.capital/complete-application?id={{variables.proposal_id}}
{{/if}}
Schedule Call: https://momentumbusiness.capital/schedule-call?advisor={{variables.advisor_id}}

"{{contact.first_name}}, I've personally reviewed your application and believe this funding will significantly accelerate {{variables.business_name}}'s growth. I'm here to answer any questions you might have."

{{default variables.advisor_name "Sarah Johnson"}}
Senior Business Advisor
{{default variables.advisor_email "sarah@momentumbusiness.capital"}}

---
Momentum Business Capital
📧 funding@momentumbusiness.capital | 📞 1-800-MOMENTUM
🌐 momentumbusiness.capital

Unsubscribe: {{unsubscribe_url}}
Privacy Policy: https://momentumbusiness.capital/privacy
Terms of Service: https://momentumbusiness.capital/terms
    `,
    variables: {
      urgent: false,
      loan_amount: "$50,000",
      business_name: "Sample Business",
      interest_rate: "8.9",
      term_months: "24",
      approval_status: "pending",
      industry: "retail",
      proposal_id: "12345",
      advisor_id: "sarah-johnson",
      advisor_name: "Sarah Johnson",
      advisor_email: "sarah@momentumbusiness.capital",
      expiry_hours: "48"
    }
  });

  console.log('✅ Advanced template created successfully!');
  console.log('📧 Template ID:', template.id);
  console.log('📝 Template Name:', template.name);

  return template;
}

async function testTemplateRendering(templateId: string) {
  console.log('🧪 Testing Template Rendering...');

  const templateEngine = createTemplateEngine();

  // Test with sample data
  const sampleContext = {
    contact: {
      id: "123",
      email: "john.doe@example.com",
      first_name: "John",
      last_name: "Doe",
      full_name: "John Doe"
    },
    variables: {
      urgent: true,
      loan_amount: "$75,000",
      business_name: "Doe's Restaurant",
      interest_rate: "7.5",
      term_months: "36",
      approval_status: "approved",
      industry: "restaurant",
      proposal_id: "67890",
      advisor_id: "sarah-johnson",
      advisor_name: "Sarah Johnson",
      advisor_email: "sarah@momentumbusiness.capital",
      expiry_hours: "24",
      is_premium: true,
      company_email: "funding@momentumbusiness.capital",
      company_phone: "1-800-MOMENTUM"
    },
    campaign: {
      id: "campaign-123",
      name: "Q1 Funding Campaign"
    },
    system: {
      company_name: "Momentum Business Capital",
      company_address: "123 Business Ave, Capital City, CC 12345",
      current_date: new Date().toLocaleDateString(),
      current_year: new Date().getFullYear(),
      unsubscribe_url: "https://momentumbusiness.capital/unsubscribe?contact=123",
      tracking_pixel_url: "https://track.momentumbusiness.capital/pixel.gif?contact=123"
    }
  };

  try {
    const result = await templateEngine.renderTemplate(templateId, sampleContext);
    console.log('✅ Template rendered successfully!');
    console.log('📧 Subject:', result.subject);
    console.log('📄 HTML length:', result.html.length);
    console.log('📄 Text length:', result.text.length);
    console.log('🔗 Has tracking:', result.tracking.click_tracking_enabled);

    return result;
  } catch (error) {
    console.error('❌ Template rendering failed:', error);
    throw error;
  }
}

async function createTemplateFromExistingFile(filePath: string) {
  console.log('📁 Creating Template from Existing File...');

  // This is a placeholder - you would read your existing file
  // const fs = require('fs');
  // const htmlContent = fs.readFileSync(filePath, 'utf8');

  const emailService = new EmailCampaignService();

  const template = await emailService.createEmailTemplate({
    name: "Imported Template",
    subject: "Subject from your existing template",
    html_content: "<!-- Your existing HTML content would go here -->",
    text_content: "Your existing text content would go here",
    variables: {
      // Define any variables your template uses
    }
  });

  console.log('✅ Template imported successfully!');
  console.log('📧 Template ID:', template.id);

  return template;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Email Template Creation...\n');

    // Create basic template
    const basicTemplate = await createBasicTemplate();
    console.log();

    // Create advanced template
    const advancedTemplate = await createAdvancedTemplate();
    console.log();

    // Test template rendering
    await testTemplateRendering(advancedTemplate.id);
    console.log();

    console.log('✅ All templates created successfully!');
    console.log('📧 Basic Template ID:', basicTemplate.id);
    console.log('📧 Advanced Template ID:', advancedTemplate.id);

  } catch (error) {
    console.error('❌ Error creating templates:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
    createAdvancedTemplate, createBasicTemplate, createTemplateFromExistingFile, testTemplateRendering
};
