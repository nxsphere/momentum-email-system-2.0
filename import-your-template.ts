import { readFileSync } from 'fs';
import { createTemplateEngine } from './src/config/template-engine.config';
import { EmailCampaignService } from './src/services/email-campaign.service';

/**
 * Import Your Existing Template File
 * This script helps you convert your existing HTML/text files into email templates
 */

async function importTemplateFromFile(
  filePath: string,
  templateName: string,
  subject: string,
  textFilePath?: string
) {
  console.log(`📁 Importing template from: ${filePath}`);

  try {
    // Read your existing HTML file
    const htmlContent = readFileSync(filePath, 'utf8');

    // Read text file if provided
    let textContent: string | undefined;
    if (textFilePath) {
      textContent = readFileSync(textFilePath, 'utf8');
    }

    // Create email service
    const emailService = new EmailCampaignService();

    // Process the HTML to add Handlebars variables
    const processedHtml = processHtmlForHandlebars(htmlContent);
    const processedText = textContent ? processTextForHandlebars(textContent) : generateTextFromHtml(processedHtml);

    // Create the template
    const template = await emailService.createEmailTemplate({
      name: templateName,
      subject: subject,
      html_content: processedHtml,
      text_content: processedText,
      variables: extractVariablesFromContent(processedHtml, processedText)
    });

    console.log('✅ Template imported successfully!');
    console.log('📧 Template ID:', template.id);
    console.log('📧 Template Name:', template.name);

    // Test the template
    await testImportedTemplate(template.id);

    return template;

  } catch (error) {
    console.error('❌ Failed to import template:', error);
    throw error;
  }
}

function processHtmlForHandlebars(htmlContent: string): string {
  let processed = htmlContent;

  // Common replacements for personalization
  const replacements = [
    // Name replacements
    { pattern: /\[Name\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[FIRST_NAME\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[FirstName\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[Full Name\]/g, replacement: '{{contact.full_name}}' },
    { pattern: /\[FULL_NAME\]/g, replacement: '{{contact.full_name}}' },

    // Email replacements
    { pattern: /\[Email\]/g, replacement: '{{contact.email}}' },
    { pattern: /\[EMAIL\]/g, replacement: '{{contact.email}}' },

    // Company replacements
    { pattern: /\[Company\]/g, replacement: '{{variables.company_name}}' },
    { pattern: /\[COMPANY\]/g, replacement: '{{variables.company_name}}' },
    { pattern: /\[Company Name\]/g, replacement: '{{variables.company_name}}' },

    // Date replacements
    { pattern: /\[Date\]/g, replacement: '{{system.current_date}}' },
    { pattern: /\[Today\]/g, replacement: '{{system.current_date}}' },
    { pattern: /\[Current Year\]/g, replacement: '{{system.current_year}}' },

    // Custom variable placeholders
    { pattern: /\[Amount\]/g, replacement: '{{variables.amount}}' },
    { pattern: /\[AMOUNT\]/g, replacement: '{{variables.amount}}' },
    { pattern: /\[Product\]/g, replacement: '{{variables.product_name}}' },
    { pattern: /\[PRODUCT\]/g, replacement: '{{variables.product_name}}' },
  ];

  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    processed = processed.replace(pattern, replacement);
  });

  // Add unsubscribe link if not present
  if (!processed.includes('unsubscribe') && !processed.includes('{{unsubscribe_url}}')) {
    const unsubscribeHtml = `
      <div style="margin-top: 30px; padding: 20px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb;">
        <p>
          <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> |
          <a href="https://momentumbusiness.capital/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
        </p>
      </div>
    `;

    // Try to add before closing body tag
    if (processed.includes('</body>')) {
      processed = processed.replace('</body>', unsubscribeHtml + '</body>');
    } else {
      processed += unsubscribeHtml;
    }
  }

  // Add tracking pixel if not present
  if (!processed.includes('tracking_pixel_url')) {
    const trackingPixel = '<img src="{{tracking_pixel_url}}" width="1" height="1" style="display:none;" alt="">';

    // Try to add before closing body tag
    if (processed.includes('</body>')) {
      processed = processed.replace('</body>', trackingPixel + '</body>');
    } else {
      processed += trackingPixel;
    }
  }

  return processed;
}

function processTextForHandlebars(textContent: string): string {
  let processed = textContent;

  // Common replacements for text version
  const replacements = [
    { pattern: /\[Name\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[FIRST_NAME\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[FirstName\]/g, replacement: '{{contact.first_name}}' },
    { pattern: /\[Full Name\]/g, replacement: '{{contact.full_name}}' },
    { pattern: /\[FULL_NAME\]/g, replacement: '{{contact.full_name}}' },
    { pattern: /\[Email\]/g, replacement: '{{contact.email}}' },
    { pattern: /\[EMAIL\]/g, replacement: '{{contact.email}}' },
    { pattern: /\[Company\]/g, replacement: '{{variables.company_name}}' },
    { pattern: /\[COMPANY\]/g, replacement: '{{variables.company_name}}' },
    { pattern: /\[Date\]/g, replacement: '{{system.current_date}}' },
    { pattern: /\[Today\]/g, replacement: '{{system.current_date}}' },
    { pattern: /\[Amount\]/g, replacement: '{{variables.amount}}' },
    { pattern: /\[Product\]/g, replacement: '{{variables.product_name}}' },
  ];

  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    processed = processed.replace(pattern, replacement);
  });

  // Add unsubscribe link if not present
  if (!processed.includes('unsubscribe') && !processed.includes('{{unsubscribe_url}}')) {
    processed += '\n\n---\nUnsubscribe: {{unsubscribe_url}}\nPrivacy Policy: https://momentumbusiness.capital/privacy';
  }

  return processed;
}

function generateTextFromHtml(htmlContent: string): string {
  // Basic HTML to text conversion
  let text = htmlContent;

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  return text.trim();
}

function extractVariablesFromContent(htmlContent: string, textContent?: string): Record<string, any> {
  const variables: Record<string, any> = {};
  const content = htmlContent + (textContent || '');

  // Extract Handlebars variables
  const variableMatches = content.match(/\{\{variables\.(\w+)\}\}/g);
  if (variableMatches) {
    variableMatches.forEach(match => {
      const varName = match.replace(/\{\{variables\.|\}\}/g, '');

      // Set default values based on variable names
      if (varName.includes('name')) {
        variables[varName] = 'Sample Company';
      } else if (varName.includes('email')) {
        variables[varName] = 'contact@example.com';
      } else if (varName.includes('amount') || varName.includes('price')) {
        variables[varName] = '$10,000';
      } else if (varName.includes('date')) {
        variables[varName] = new Date().toLocaleDateString();
      } else if (varName.includes('phone')) {
        variables[varName] = '1-800-MOMENTUM';
      } else if (varName.includes('product')) {
        variables[varName] = 'Business Loan';
      } else {
        variables[varName] = 'Default Value';
      }
    });
  }

  return variables;
}

async function testImportedTemplate(templateId: string) {
  console.log('🧪 Testing imported template...');

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
      company_name: "Doe's Business",
      amount: "$25,000",
      product_name: "Business Loan",
    },
    campaign: {
      id: "campaign-123",
      name: "Import Test Campaign"
    },
    system: {
      company_name: "Momentum Business Capital",
      current_date: new Date().toLocaleDateString(),
      current_year: new Date().getFullYear(),
      unsubscribe_url: "https://momentumbusiness.capital/unsubscribe?contact=123",
      tracking_pixel_url: "https://track.momentumbusiness.capital/pixel.gif?contact=123"
    }
  };

  try {
    const result = await templateEngine.renderTemplate(templateId, sampleContext);
    console.log('✅ Template test successful!');
    console.log('📧 Subject:', result.subject);
    console.log('📄 HTML length:', result.html.length);
    console.log('📄 Text length:', result.text.length);

    return result;
  } catch (error) {
    console.error('❌ Template test failed:', error);
    throw error;
  }
}

// Example usage functions
async function importFromHTMLFile() {
  // Example: Import from your existing HTML file
  return await importTemplateFromFile(
    './your-template.html',           // Path to your HTML file
    'Your Template Name',             // Template name
    'Your Subject Line with {{contact.first_name}}', // Subject
    './your-template.txt'             // Optional: path to text version
  );
}

async function importFromEmailHTML() {
  // Example: Import from an email HTML export
  return await importTemplateFromFile(
    './email-export.html',
    'Imported Email Template',
    'Imported Email - {{contact.first_name}}'
  );
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: ts-node import-your-template.ts <html-file> <template-name> <subject> [text-file]');
    console.log('Example: ts-node import-your-template.ts ./my-template.html "My Template" "Hello {{contact.first_name}}"');
    process.exit(1);
  }

  const [htmlFile, templateName, subject, textFile] = args;

  try {
    await importTemplateFromFile(htmlFile, templateName, subject, textFile);
    console.log('✅ Template import completed successfully!');
  } catch (error) {
    console.error('❌ Template import failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
    extractVariablesFromContent, importTemplateFromFile,
    processHtmlForHandlebars,
    processTextForHandlebars, testImportedTemplate
};
