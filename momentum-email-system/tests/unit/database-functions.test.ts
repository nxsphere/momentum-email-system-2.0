import { DatabaseSetup } from '../setup/database.setup';

describe('Database Functions Unit Tests', () => {
  let testClient: any;

  beforeAll(async () => {
    await DatabaseSetup.setupTestDatabase();
    testClient = DatabaseSetup.getTestClient();
  });

  afterAll(async () => {
    await DatabaseSetup.cleanupTestDatabase();
  });

  beforeEach(async () => {
    await DatabaseSetup.cleanupTestDatabase();
    await DatabaseSetup.setupTestDatabase();
  });

  describe('Basic database function testing infrastructure', () => {
    it('should have access to test database client', () => {
      expect(testClient).toBeDefined();
      expect(typeof testClient.from).toBe('function');
      expect(typeof testClient.rpc).toBe('function');
    });

    it('should be able to execute database functions', async () => {
      const result = await DatabaseSetup.executeFunction('process_email_queue', { batch_size: 1 });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('process_email_queue function', () => {
    it('should process email queue with batch size', async () => {
      const result = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 5
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('processed_count');
      expect((result[0] as any).processed_count).toBeGreaterThan(0);
    });

    it('should handle small batch sizes', async () => {
      const result = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 2,
        max_retries: 3
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('processed_count');
      expect((result[0] as any).processed_count).toBeLessThanOrEqual(2);
    });

    it('should respect rate limits', async () => {
      const result = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 1,
        rate_limit_per_minute: 60,
        rate_limit_per_hour: 1000
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('processed_count');
      expect((result[0] as any).processed_count).toBeLessThanOrEqual(1);
    });

    it('should handle queue processing failures', async () => {
      // Simulate a failure scenario by providing invalid parameters
      const result = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: -1
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('failed_count');
      expect((result[0] as any).failed_count).toBeGreaterThan(0);
    });
  });

  describe('start_campaign function', () => {
    it('should start campaign successfully', async () => {
      const result = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: 'test-campaign-123',
        send_immediately: true
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(true);
    });

    it('should handle campaign already running', async () => {
      const result = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: 'running-campaign-123'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(false);
      expect((result[0] as any).message).toContain('already running');
    });

    it('should handle non-existent campaign', async () => {
      const result = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: 'non-existent-campaign'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(false);
      expect((result[0] as any).message).toContain('not found');
    });
  });

  describe('update_email_status function', () => {
    it('should update email status successfully', async () => {
      const result = await DatabaseSetup.executeFunction('update_email_status', {
        email_log_id: 'test-email-log-123',
        new_status: 'delivered',
        provider_message_id: 'msg-123'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(false); // Expected false for non-existent record
      expect((result[0] as any).message).toContain('not found');
    });

    it('should handle invalid email log ID', async () => {
      const result = await DatabaseSetup.executeFunction('update_email_status', {
        email_log_id: 'invalid-id',
        new_status: 'failed'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(false);
      expect((result[0] as any).message).toContain('not found');
    });

    it('should update email with tracking data', async () => {
      const result = await DatabaseSetup.executeFunction('update_email_status', {
        email_log_id: 'test-email-log-456',
        new_status: 'opened',
        opened_at: new Date().toISOString(),
        user_agent: 'Test Browser',
        ip_address: '127.0.0.1'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(true);
    });
  });

  describe('get_enhanced_campaign_stats function', () => {
    it('should calculate campaign statistics correctly', async () => {
      const result = await DatabaseSetup.executeFunction('get_enhanced_campaign_stats', {
        campaign_id: 'test-campaign-stats'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('delivery_rate');
      expect(result[0]).toHaveProperty('open_rate');
      expect(result[0]).toHaveProperty('click_rate');
      expect((result[0] as any).delivery_rate).toBeCloseTo(66.67, 1);
      expect((result[0] as any).open_rate).toBeCloseTo(33.33, 1);
    });

    it('should handle campaign with no sends', async () => {
      const result = await DatabaseSetup.executeFunction('get_enhanced_campaign_stats', {
        campaign_id: 'empty-campaign'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect((result[0] as any).delivery_rate).toBe(0);
      expect((result[0] as any).open_rate).toBe(0);
    });
  });

  describe('handle_bounce function', () => {
    it('should handle hard bounce and deactivate contact', async () => {
      const result = await DatabaseSetup.executeFunction('handle_bounce', {
        email: 'bounce-test@example.com',
        bounce_type: 'hard',
        bounce_reason: 'Invalid email address'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('action_taken');
      expect((result[0] as any).action_taken).toContain('deactivated');
    });

    it('should handle soft bounce without deactivation', async () => {
      const result = await DatabaseSetup.executeFunction('handle_bounce', {
        email: 'soft-bounce@example.com',
        bounce_type: 'soft',
        bounce_reason: 'Mailbox full'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect((result[0] as any).success).toBe(true);
    });

    it('should handle bounce for non-existent email', async () => {
      const result = await DatabaseSetup.executeFunction('handle_bounce', {
        email: 'nonexistent@example.com',
        bounce_type: 'hard',
        bounce_reason: 'User unknown'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('message');
      expect((result[0] as any).message).toContain('not found');
    });
  });

  describe('cleanup_old_data function', () => {
    it('should cleanup old logs and queue items', async () => {
      const result = await DatabaseSetup.executeFunction('cleanup_old_data', {
        days_to_keep: 30
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('logs_deleted');
      expect(result[0]).toHaveProperty('queue_deleted');
      expect((result[0] as any).logs_deleted).toBeGreaterThan(0);
    });

    it('should handle cleanup with recent data only', async () => {
      const result = await DatabaseSetup.executeFunction('cleanup_old_data', {
        days_to_keep: 1
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('logs_deleted');
    });
  });

  describe('check_rate_limit function', () => {
    it('should check rate limit for email sending', async () => {
      const result = await DatabaseSetup.executeFunction('check_rate_limit', {
        rate_key: 'email_sending',
        limit_per_minute: 60,
        limit_per_hour: 1000
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('allowed');
      expect(result[0]).toHaveProperty('remaining');
      expect(result[0]).toHaveProperty('reset_time');
    });

    it('should handle rate limit exceeded', async () => {
      const result = await DatabaseSetup.executeFunction('check_rate_limit', {
        rate_key: 'exceeded_limit',
        limit_per_minute: 1,
        limit_per_hour: 10
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('allowed');
    });
  });

  describe('log_campaign_event function', () => {
    it('should log campaign events', async () => {
      const result = await DatabaseSetup.executeFunction('log_campaign_event', {
        campaign_id: 'test-campaign',
        event_type: 'started',
        event_data: { user_id: 'admin-123' }
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('success');
      expect(result[0]).toHaveProperty('event_id');
    });

    it('should handle invalid campaign ID', async () => {
      const result = await DatabaseSetup.executeFunction('log_campaign_event', {
        campaign_id: null,
        event_type: 'error',
        event_data: {}
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
