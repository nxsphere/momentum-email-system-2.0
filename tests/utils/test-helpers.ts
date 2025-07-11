import { DatabaseSetup } from '../setup/database.setup';

export class TestHelpers {
  /**
   * Wait for a condition to become true
   */
  static async waitFor(
    condition: () => Promise<boolean> | boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await this.delay(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Delay execution for specified milliseconds
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random string
   */
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email address
   */
  static randomEmail(domain: string = 'test.com'): string {
    return `${this.randomString(8)}-${Date.now()}@${domain}`;
  }

  /**
   * Generate random UUID (for testing purposes)
   */
  static randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Assert that a value is within a range
   */
  static assertInRange(value: number, min: number, max: number, message?: string): void {
    if (value < min || value > max) {
      throw new Error(message || `Value ${value} is not between ${min} and ${max}`);
    }
  }

  /**
   * Assert that a date is recent (within specified seconds)
   */
  static assertDateIsRecent(date: string | Date, withinSeconds: number = 60): void {
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffSeconds = Math.abs(now.getTime() - targetDate.getTime()) / 1000;

    if (diffSeconds > withinSeconds) {
      throw new Error(`Date ${targetDate.toISOString()} is not within ${withinSeconds} seconds of now`);
    }
  }

  /**
   * Wait for database records to meet condition
   */
  static async waitForDatabaseCondition(
    tableName: string,
    condition: Record<string, any>,
    expectedCount: number,
    timeout: number = 5000
  ): Promise<any[]> {
    const testClient = DatabaseSetup.getTestClient();

    return this.waitFor(async () => {
      const { data, error } = await testClient
        .from(tableName)
        .select('*')
        .match(condition);

      if (error) throw error;
      return data && data.length === expectedCount;
    }, timeout).then(async () => {
      const { data } = await testClient
        .from(tableName)
        .select('*')
        .match(condition);
      return data || [];
    });
  }

  /**
   * Poll for email queue processing completion
   */
  static async waitForQueueProcessing(
    campaignId: string,
    expectedProcessedCount: number,
    timeout: number = 10000
  ): Promise<void> {
    const testClient = DatabaseSetup.getTestClient();

    await this.waitFor(async () => {
      const { data, error } = await testClient
        .from('email_queue')
        .select('*')
        .eq('campaign_id', campaignId)
        .neq('status', 'pending');

      if (error) throw error;
      return data && data.length >= expectedProcessedCount;
    }, timeout);
  }

  /**
   * Wait for webhook processing
   */
  static async waitForWebhookProcessing(
    messageId: string,
    timeout: number = 5000
  ): Promise<any> {
    const testClient = DatabaseSetup.getTestClient();

    await this.waitFor(async () => {
      const { data, error } = await testClient
        .from('webhook_events')
        .select('*')
        .eq('message_id', messageId)
        .eq('processed_successfully', true)
        .single();

      return !error && data;
    }, timeout);

    const { data } = await testClient
      .from('webhook_events')
      .select('*')
      .eq('message_id', messageId)
      .eq('processed_successfully', true)
      .single();

    return data;
  }

  /**
   * Clean up test data by pattern
   */
  static async cleanupTestDataByPattern(
    tableName: string,
    field: string,
    pattern: string
  ): Promise<void> {
    const testClient = DatabaseSetup.getTestClient();

    await testClient
      .from(tableName)
      .delete()
      .like(field, pattern);
  }

  /**
   * Create test performance metrics
   */
  static createPerformanceTracker() {
    const metrics: { [key: string]: number[] } = {};

    return {
      start: (operation: string) => {
        if (!metrics[operation]) metrics[operation] = [];
        return Date.now();
      },

      end: (operation: string, startTime: number) => {
        const duration = Date.now() - startTime;
        metrics[operation].push(duration);
        return duration;
      },

      getMetrics: () => {
        const summary: { [key: string]: any } = {};

        Object.keys(metrics).forEach(operation => {
          const times = metrics[operation];
          const avg = times.reduce((a, b) => a + b, 0) / times.length;
          const min = Math.min(...times);
          const max = Math.max(...times);

          summary[operation] = {
            count: times.length,
            average: Math.round(avg),
            min,
            max,
            total: times.reduce((a, b) => a + b, 0)
          };
        });

        return summary;
      },

      reset: () => {
        Object.keys(metrics).forEach(key => {
          metrics[key] = [];
        });
      }
    };
  }

  /**
   * Mock webhook signature generation
   */
  static generateWebhookSignature(payload: any, secret: string = 'test-secret'): string {
    // Simple mock signature for testing
    const payloadString = JSON.stringify(payload);
    return `sha256=${Buffer.from(payloadString + secret).toString('base64')}`;
  }

  /**
   * Create mock HTTP request/response objects
   */
  static createMockRequest(data: any = {}, headers: any = {}): any {
    return {
      body: data,
      headers: {
        'content-type': 'application/json',
        ...headers
      },
      method: 'POST',
      url: '/webhook'
    };
  }

  static createMockResponse(): any {
    const response = {
      statusCode: 200,
      headers: {},
      body: '',
      status: function(code: number) {
        this.statusCode = code;
        return this;
      },
      json: function(data: any) {
        this.body = JSON.stringify(data);
        return this;
      },
      send: function(data: any) {
        this.body = data;
        return this;
      },
      header: function(name: string, value: string) {
        this.headers[name] = value;
        return this;
      }
    };

    return response;
  }

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Create test email content with tracking
   */
  static createEmailWithTracking(campaignId: string, messageId: string): string {
    return `
      <html>
        <body>
          <h1>Test Email</h1>
          <p>This is a test email for campaign ${campaignId}</p>
          <a href="https://example.com/track-click?id=${messageId}&url=https://example.com/product">Click here</a>
          <img src="https://example.com/track-open?id=${messageId}" width="1" height="1" />
        </body>
      </html>
    `;
  }

  /**
   * Simulate email client behavior
   */
  static simulateEmailOpen(messageId: string): any {
    return {
      event: 'open',
      message_id: messageId,
      timestamp: new Date().toISOString(),
      ip: this.generateRandomIP(),
      user_agent: this.generateRandomUserAgent()
    };
  }

  static simulateEmailClick(messageId: string, url: string): any {
    return {
      event: 'click',
      message_id: messageId,
      timestamp: new Date().toISOString(),
      url: url,
      ip: this.generateRandomIP(),
      user_agent: this.generateRandomUserAgent()
    };
  }

  private static generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  private static generateRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
      'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Database assertion helpers
   */
  static async assertDatabaseHasRecord(
    tableName: string,
    condition: Record<string, any>,
    message?: string
  ): Promise<any> {
    const testClient = DatabaseSetup.getTestClient();
    const { data, error } = await testClient
      .from(tableName)
      .select('*')
      .match(condition)
      .single();

    if (error) {
      throw new Error(message || `Expected record not found in ${tableName}: ${JSON.stringify(condition)}`);
    }

    return data;
  }

  static async assertDatabaseHasNoRecord(
    tableName: string,
    condition: Record<string, any>,
    message?: string
  ): Promise<void> {
    const testClient = DatabaseSetup.getTestClient();
    const { data, error } = await testClient
      .from(tableName)
      .select('*')
      .match(condition);

    if (!error && data && data.length > 0) {
      throw new Error(message || `Unexpected record found in ${tableName}: ${JSON.stringify(condition)}`);
    }
  }

  static async assertDatabaseRecordCount(
    tableName: string,
    condition: Record<string, any>,
    expectedCount: number,
    message?: string
  ): Promise<any[]> {
    const testClient = DatabaseSetup.getTestClient();
    const { data, error } = await testClient
      .from(tableName)
      .select('*')
      .match(condition);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!data || data.length !== expectedCount) {
      throw new Error(
        message ||
        `Expected ${expectedCount} records in ${tableName}, found ${data?.length || 0}`
      );
    }

    return data;
  }

  /**
   * Campaign flow helpers
   */
  static async createAndStartCampaign(
    templateId: string,
    contactListId: string,
    overrides: any = {}
  ): Promise<{ campaign: any; queueCount: number }> {
    const testClient = DatabaseSetup.getTestClient();

    // Create campaign
    const campaign = await DatabaseSetup.createTestCampaign(templateId, {
      contact_list_id: contactListId,
      status: 'draft',
      ...overrides
    });

    // Start campaign
    await DatabaseSetup.executeFunction('start_campaign', {
      p_campaign_id: campaign.id
    });

    // Wait for queue to be populated
    await this.delay(100);

    // Get queue count
    const { data: queueData } = await testClient
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    return {
      campaign,
      queueCount: queueData?.length || 0
    };
  }

  /**
   * Batch processing helpers
   */
  static async processBatchesUntilComplete(
    batchSize: number = 10,
    maxBatches: number = 100
  ): Promise<{ totalProcessed: number; batchCount: number }> {
    let totalProcessed = 0;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      const result = await DatabaseSetup.executeFunction('process_email_queue', {
        p_batch_size: batchSize
      });

      const processed = result[0]?.processed_count || 0;
      totalProcessed += processed;
      batchCount++;

      if (processed === 0) {
        break; // No more emails to process
      }

      // Small delay between batches
      await this.delay(10);
    }

    return { totalProcessed, batchCount };
  }

  /**
   * Test environment helpers
   */
  static getTestConfig() {
    return {
      isTestEnvironment: process.env.NODE_ENV === 'test',
      supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      testTimeout: 30000,
      batchSize: 10,
      maxRetries: 3
    };
  }

  static skipIfNotTestEnvironment(): void {
    if (process.env.NODE_ENV !== 'test') {
      // This would typically use a test framework's skip function
      console.warn('Skipping test: not in test environment');
    }
  }
}

export default TestHelpers;
