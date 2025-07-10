// Test Environment Configuration
export const TEST_CONFIG = {
  database: {
    supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  },
  mailtrap: {
    apiKey: 'test-api-key',
    inboxId: 'test-inbox',
    testMode: true,
    webhookSecret: 'test-webhook-secret',
  },
  email: {
    defaultFromEmail: 'test@example.com',
    defaultFromName: 'Test System',
    logLevel: 'error',
    enableRateLimit: false,
    enableRetries: false,
    timeout: 5000,
    retries: 1,
    retryDelay: 100,
    rateLimitMax: 1000,
    rateLimitWindow: 60000,
  }
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = TEST_CONFIG.database.supabaseUrl;
process.env.SUPABASE_ANON_KEY = TEST_CONFIG.database.supabaseAnonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = TEST_CONFIG.database.supabaseServiceRoleKey;
process.env.MAILTRAP_API_KEY = TEST_CONFIG.mailtrap.apiKey;
process.env.MAILTRAP_INBOX_ID = TEST_CONFIG.mailtrap.inboxId;
process.env.MAILTRAP_TEST_MODE = String(TEST_CONFIG.mailtrap.testMode);
process.env.MAILTRAP_WEBHOOK_SECRET = TEST_CONFIG.mailtrap.webhookSecret;
process.env.DEFAULT_FROM_EMAIL = TEST_CONFIG.email.defaultFromEmail;
process.env.DEFAULT_FROM_NAME = TEST_CONFIG.email.defaultFromName;
process.env.EMAIL_LOG_LEVEL = TEST_CONFIG.email.logLevel;
process.env.ENABLE_RATE_LIMIT = String(TEST_CONFIG.email.enableRateLimit);
process.env.ENABLE_RETRIES = String(TEST_CONFIG.email.enableRetries);
process.env.EMAIL_TIMEOUT = String(TEST_CONFIG.email.timeout);
process.env.EMAIL_RETRIES = String(TEST_CONFIG.email.retries);
process.env.EMAIL_RETRY_DELAY = String(TEST_CONFIG.email.retryDelay);
process.env.EMAIL_RATE_LIMIT_MAX = String(TEST_CONFIG.email.rateLimitMax);
process.env.EMAIL_RATE_LIMIT_WINDOW = String(TEST_CONFIG.email.rateLimitWindow);
