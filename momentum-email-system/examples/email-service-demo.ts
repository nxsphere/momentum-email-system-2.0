import { validateEmailConfig } from "../src/config/email.config";
import { MailtrapProvider } from "../src/providers/mailtrap.provider";
import { EmailService } from "../src/services/email.service";
import { EmailMessage, EmailTemplate } from "../src/types/email-provider";

// Example usage of the Mailtrap Email Service
async function demonstrateEmailService() {
  console.log("🚀 Email Service Demo - Mailtrap Integration");

  // Validate configuration
  const configValidation = validateEmailConfig();
  if (!configValidation.valid) {
    console.error("❌ Configuration errors:", configValidation.errors);
    return;
  }

  // Create Mailtrap provider
  const mailtrapProvider = new MailtrapProvider(
    {
      apiKey: process.env.MAILTRAP_API_KEY!,
      inboxId: process.env.MAILTRAP_INBOX_ID,
      testMode: process.env.MAILTRAP_TEST_MODE === "true",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        maxRequests: 200,
        windowMs: 60 * 60 * 1000, // 1 hour
      },
    },
    process.env.MAILTRAP_WEBHOOK_SECRET
  );

  // Create email service
  const emailService = new EmailService({
    provider: mailtrapProvider,
    defaultFrom: {
      email: process.env.DEFAULT_FROM_EMAIL || "noreply@example.com",
      name: process.env.DEFAULT_FROM_NAME || "Email Service Demo",
    },
    enableRateLimit: true,
    enableRetries: true,
    webhookSecret: process.env.MAILTRAP_WEBHOOK_SECRET,
    logLevel: "debug",
  });

  try {
    // Example 1: Send a simple email
    console.log("\n📧 Example 1: Sending Simple Email");
    const simpleEmail: EmailMessage = {
      from: { email: "demo@example.com", name: "Demo Sender" },
      to: [{ email: "recipient@example.com", name: "Test Recipient" }],
      subject: "Test Email from Mailtrap Integration",
      text: "This is a test email sent using the Mailtrap email service.",
      html: "<h1>Test Email</h1><p>This is a test email sent using the <strong>Mailtrap email service</strong>.</p>",
      metadata: {
        campaign: "test-campaign",
        user_id: "12345",
      },
    };

    const result1 = await emailService.sendEmail(simpleEmail);
    console.log("✅ Simple email result:", result1);

    // Example 2: Send email with template
    console.log("\n📝 Example 2: Sending Templated Email");
    const emailTemplate: EmailTemplate = {
      id: "welcome-template",
      variables: {
        name: "John Doe",
        company: "Test Company",
        activation_url: "https://example.com/activate?token=abc123",
      },
    };

    const templatedEmail: EmailMessage = {
      from: { email: "welcome@example.com", name: "Welcome Team" },
      to: [{ email: "newuser@example.com", name: "New User" }],
      subject: "Welcome to {{company}}!",
      template: emailTemplate,
      metadata: {
        template_id: "welcome-template",
        user_type: "new_user",
      },
    };

    const result2 = await emailService.sendEmail(templatedEmail);
    console.log("✅ Templated email result:", result2);

    // Example 3: Send bulk emails
    console.log("\n📮 Example 3: Sending Bulk Emails");
    const recipients = [
      { email: "user1@example.com", name: "User One" },
      { email: "user2@example.com", name: "User Two" },
      { email: "user3@example.com", name: "User Three" },
    ];

    const bulkEmails: EmailMessage[] = recipients.map((recipient) => ({
      from: { email: "newsletter@example.com", name: "Newsletter" },
      to: [recipient],
      subject: `Hello ${recipient.name}!`,
      html: `<h2>Hello ${recipient.name}!</h2><p>This is a personalized email for you.</p>`,
      text: `Hello ${recipient.name}! This is a personalized email for you.`,
      tags: ["newsletter", "bulk"],
    }));

    const bulkResults = await emailService.sendBulkEmails(bulkEmails);
    console.log("✅ Bulk emails results:", bulkResults);

    // Example 4: Using email builder
    console.log("\n🏗️ Example 4: Using Email Builder");
    const builderEmail = emailService
      .createMessage()
      .from({ email: "builder@example.com", name: "Builder Demo" })
      .to({ email: "recipient@example.com", name: "Builder Recipient" })
      .subject("Email Built with Fluent Interface")
      .html(
        "<h1>Fluent Interface</h1><p>This email was built using the fluent interface pattern.</p>"
      )
      .text("This email was built using the fluent interface pattern.")
      .header("X-Custom-Header", "custom-value")
      .metadata("source", "builder-demo")
      .tag("demo")
      .tag("builder")
      .build();

    const result4 = await emailService.sendEmail(builderEmail);
    console.log("✅ Builder email result:", result4);

    // Example 5: Send templated email to multiple recipients
    console.log("\n📧 Example 5: Templated Email to Multiple Recipients");
    const welcomeTemplate: EmailTemplate = {
      id: "welcome-bulk",
      variables: {
        company: "Momentum Business Capital",
        support_email: "support@momentumbc.com",
      },
    };

    const newUsers = [
      { email: "alice@example.com", name: "Alice Johnson" },
      { email: "bob@example.com", name: "Bob Smith" },
    ];

    const templateResults = await emailService.sendTemplatedEmail(
      welcomeTemplate,
      newUsers,
      { email: "onboarding@momentumbc.com", name: "Onboarding Team" },
      {
        metadata: { campaign: "user-onboarding" },
        trackOpens: true,
        trackClicks: true,
      }
    );
    console.log("✅ Templated bulk email results:", templateResults);

    // Example 6: Check service stats
    console.log("\n📊 Example 6: Service Statistics");
    const stats = await emailService.getStats();
    console.log("📈 Service stats:", stats);

    // Example 7: Check rate limits
    console.log("\n🚦 Example 7: Rate Limit Status");
    const rateLimit = await emailService.checkRateLimit();
    console.log("⏰ Rate limit info:", rateLimit);

    // Example 8: Health check
    console.log("\n🏥 Example 8: Health Check");
    const isHealthy = await emailService.healthCheck();
    console.log("💚 Service health:", isHealthy ? "Healthy" : "Unhealthy");

    // Example 9: Process webhook (simulation)
    console.log("\n🪝 Example 9: Webhook Processing");
    const mockWebhookPayload = {
      message_id: "test-message-123",
      inbox_id: 12345,
      email: "recipient@example.com",
      event: "delivered",
      timestamp: Math.floor(Date.now() / 1000),
      response: "Email delivered successfully",
    };

    const webhookEvent = await emailService.processWebhook(mockWebhookPayload);
    console.log("🎯 Webhook event:", webhookEvent);

    console.log("\n🎉 All examples completed successfully!");
  } catch (error) {
    console.error("❌ Demo failed:", error);
  }
}

// Webhook endpoint example
export function createWebhookHandler() {
  return async (req: any, res: any) => {
    try {
      const signature =
        req.headers["x-signature"] || req.headers["x-mailtrap-signature"];
      const payload = req.body;

      // Create email service (you'd typically inject this)
      const emailService = new EmailService({
        provider: new MailtrapProvider(
          {
            apiKey: process.env.MAILTRAP_API_KEY!,
          },
          process.env.MAILTRAP_WEBHOOK_SECRET
        ),
        webhookSecret: process.env.MAILTRAP_WEBHOOK_SECRET,
        logLevel: "info",
      });

      const webhookEvent = await emailService.processWebhook(
        payload,
        signature
      );

      // Handle different webhook events
      switch (webhookEvent.event) {
        case "delivered":
          console.log("✅ Email delivered:", webhookEvent.messageId);
          break;
        case "opened":
          console.log("👁️ Email opened:", webhookEvent.messageId);
          break;
        case "clicked":
          console.log("👆 Email clicked:", webhookEvent.messageId);
          break;
        case "bounced":
          console.log("🔄 Email bounced:", webhookEvent.messageId);
          break;
        case "failed":
          console.log("❌ Email failed:", webhookEvent.messageId);
          break;
        default:
          console.log("❓ Unknown event:", webhookEvent.event);
      }

      res.status(200).json({ success: true, event: webhookEvent });
    } catch (error) {
      console.error("❌ Webhook processing failed:", error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  };
}

// Environment variables needed for this demo:
export const REQUIRED_ENV_VARS = {
  MAILTRAP_API_KEY: "Your Mailtrap API key",
  MAILTRAP_WEBHOOK_SECRET: "Webhook secret for signature verification",
  DEFAULT_FROM_EMAIL: "Default sender email address",
  DEFAULT_FROM_NAME: "Default sender name",
  MAILTRAP_INBOX_ID: "Optional: Mailtrap inbox ID for testing",
  MAILTRAP_TEST_MODE: 'Optional: Set to "true" for test mode',
};

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateEmailService().catch(console.error);
}
