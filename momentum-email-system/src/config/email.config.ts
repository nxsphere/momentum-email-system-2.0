import { MailtrapProvider } from "../providers/mailtrap.provider";
import { EmailService } from "../services/email.service";
import { EmailServiceOptions, MailtrapConfig } from "../types/email-provider";

export interface EmailConfig {
  mailtrap: MailtrapConfig;
  service: EmailServiceOptions;
}

export function createEmailConfig(): EmailConfig {
  // Load environment variables
  const mailtrapApiKey = process.env.MAILTRAP_API_KEY;
  const mailtrapInboxId = process.env.MAILTRAP_INBOX_ID;
  const mailtrapTestMode = process.env.MAILTRAP_TEST_MODE === "true";
  const webhookSecret = process.env.MAILTRAP_WEBHOOK_SECRET;
  const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL;
  const defaultFromName = process.env.DEFAULT_FROM_NAME;
  const logLevel =
    (process.env.EMAIL_LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
    "info";
  const enableRateLimit = process.env.ENABLE_RATE_LIMIT !== "false";
  const enableRetries = process.env.ENABLE_RETRIES !== "false";

  if (!mailtrapApiKey) {
    throw new Error("MAILTRAP_API_KEY environment variable is required");
  }

  const mailtrapConfig: MailtrapConfig = {
    apiKey: mailtrapApiKey,
    inboxId: mailtrapInboxId,
    testMode: mailtrapTestMode,
    timeout: parseInt(process.env.EMAIL_TIMEOUT || "30000"),
    retries: parseInt(process.env.EMAIL_RETRIES || "3"),
    retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || "1000"),
    rateLimit: {
      maxRequests: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || "200"),
      windowMs: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW || "3600000"), // 1 hour
    },
  };

  const serviceOptions: EmailServiceOptions = {
    provider: new MailtrapProvider(mailtrapConfig, webhookSecret),
    defaultFrom: defaultFromEmail
      ? {
          email: defaultFromEmail,
          name: defaultFromName,
        }
      : undefined,
    enableRateLimit,
    enableRetries,
    webhookSecret,
    logLevel,
  };

  return {
    mailtrap: mailtrapConfig,
    service: serviceOptions,
  };
}

export function createEmailService(): EmailService {
  const config = createEmailConfig();
  return new EmailService(config.service);
}

// Environment variable validation
export function validateEmailConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.MAILTRAP_API_KEY) {
    errors.push("MAILTRAP_API_KEY is required");
  }

  if (!process.env.DEFAULT_FROM_EMAIL) {
    errors.push("DEFAULT_FROM_EMAIL is recommended");
  }

  if (
    process.env.DEFAULT_FROM_EMAIL &&
    !isValidEmail(process.env.DEFAULT_FROM_EMAIL)
  ) {
    errors.push("DEFAULT_FROM_EMAIL must be a valid email address");
  }

  if (process.env.EMAIL_TIMEOUT && isNaN(parseInt(process.env.EMAIL_TIMEOUT))) {
    errors.push("EMAIL_TIMEOUT must be a number");
  }

  if (process.env.EMAIL_RETRIES && isNaN(parseInt(process.env.EMAIL_RETRIES))) {
    errors.push("EMAIL_RETRIES must be a number");
  }

  if (
    process.env.EMAIL_RETRY_DELAY &&
    isNaN(parseInt(process.env.EMAIL_RETRY_DELAY))
  ) {
    errors.push("EMAIL_RETRY_DELAY must be a number");
  }

  if (
    process.env.EMAIL_RATE_LIMIT_MAX &&
    isNaN(parseInt(process.env.EMAIL_RATE_LIMIT_MAX))
  ) {
    errors.push("EMAIL_RATE_LIMIT_MAX must be a number");
  }

  if (
    process.env.EMAIL_RATE_LIMIT_WINDOW &&
    isNaN(parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW))
  ) {
    errors.push("EMAIL_RATE_LIMIT_WINDOW must be a number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Helper function to validate email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export default instance
export const emailService = createEmailService();
