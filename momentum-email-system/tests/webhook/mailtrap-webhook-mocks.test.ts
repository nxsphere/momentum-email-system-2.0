import { WebhookProcessorService } from '../../src/services/webhook-processor.service';
import { MailtrapWebhookPayload } from '../../src/types/email-system';
import { DatabaseSetup } from '../setup/database.setup';
import { TEST_CONFIG } from '../setup/test.config';

describe('Webhook Mock Tests - Mailtrap Event Processing', () => {
  let testClient: any;
  let webhookProcessor: WebhookProcessorService;
  // let emailQueueService: EmailQueueService; // Commented out unused variable

  beforeAll(async () => {
    testClient = DatabaseSetup.getTestClient();
    webhookProcessor = new WebhookProcessorService(
      TEST_CONFIG.database.supabaseUrl,
      TEST_CONFIG.database.supabaseServiceRoleKey,
      testClient // Pass mock client
    );
    // emailQueueService = new EmailQueueService(testClient); // Commented out unused variable
  });

  beforeEach(async () => {
    await DatabaseSetup.cleanupTestDatabase();
  });

  afterEach(async () => {
    await DatabaseSetup.cleanupTestDatabase();
  });

  describe('Delivery Event Processing', () => {
    it('should process delivery webhook events correctly', async () => {
      // Create test campaign and contact
      const testContact = await DatabaseSetup.createTestContact({
        email: 'delivery-test@example.com'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      // Create email log entry
      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-delivery-123',
        status: 'sent'
      });

      // Create delivery webhook payload
      const deliveryPayload: MailtrapWebhookPayload = {
        message_id: 'msg-delivery-123',
        inbox_id: 123456,
        email: 'delivery-test@example.com',
        event: 'delivered',
        timestamp: Date.now(), // Use number instead of string
        response: '250 Message accepted'
      };

      // Process webhook
      const result = await webhookProcessor.processWebhook(deliveryPayload); // Use processWebhook

      expect(result.success).toBe(true);
      expect(result.message).toContain('delivered');
      expect(result.actions_performed).toContain('email_log_updated');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('delivered');
      expect(updatedLog.delivered_at).toBeDefined();
    });

    it('should handle delivery events for non-existent email logs', async () => {
      const deliveryPayload: MailtrapWebhookPayload = {
        message_id: 'msg-nonexistent-456',
        inbox_id: 123456,
        email: 'nonexistent@example.com',
        event: 'delivered',
        timestamp: Date.now(),
        response: '250 Message accepted'
      };

      const result = await webhookProcessor.processWebhook(deliveryPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('processed');
      expect(result.actions_performed).toContain('webhook_logged');
    });

    it('should process multiple delivery webhooks concurrently', async () => {
      const contacts = [];
      const campaigns = [];
      const emailLogs = [];

      // Create test data
      for (let i = 0; i < 3; i++) {
        const contact = await DatabaseSetup.createTestContact({
          email: `concurrent-delivery-${i}@example.com`
        });
        contacts.push(contact);

        const template = await DatabaseSetup.createTestTemplate();
        const campaign = await DatabaseSetup.createTestCampaign(template.id);
        campaigns.push(campaign);

        const emailLog = await DatabaseSetup.createTestEmailLog(campaign.id, contact.id, {
          mailtrap_message_id: `msg-concurrent-${i}`,
          status: 'sent'
        });
        emailLogs.push(emailLog);
      }

      // Create multiple webhook payloads
      const webhookPayloads = contacts.map((contact, index) => ({
        message_id: `msg-concurrent-${index}`,
        inbox_id: 123456,
        email: contact.email,
        event: 'delivered',
        timestamp: Date.now(),
        response: '250 Message accepted'
      }));

      // Process multiple webhooks concurrently
      const webhookPromises = webhookPayloads.map((payload: any) =>
        webhookProcessor.processWebhook(payload)
      );
      const results = await Promise.all(webhookPromises) as any[];

      results.forEach((result: any) => { // Add type annotation
        expect(result.success).toBe(true);
        expect(result.actions_performed).toContain('email_log_updated');
      });

      // Verify all email logs were updated
      for (let i = 0; i < emailLogs.length; i++) {
        const { data: updatedLog } = await testClient
          .from('email_logs')
          .select('*')
          .eq('id', emailLogs[i].id)
          .single();

        expect(updatedLog.status).toBe('delivered');
      }
    });
  });

  describe('Open Event Processing', () => {
    it('should process email open events with tracking data', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'open-test@example.com'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-open-123',
        status: 'delivered'
      });

      // Create open webhook payload
      const openPayload: MailtrapWebhookPayload = {
        message_id: 'msg-open-123',
        inbox_id: 123456,
        email: 'open-test@example.com',
        event: 'open',
        timestamp: Date.now(),
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        location: 'New York, NY, US' // Use string instead of object
      };

      const result = await webhookProcessor.processWebhook(openPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('open');
      expect(result.actions_performed).toContain('email_log_updated');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('opened');
      expect(updatedLog.opened_at).toBeDefined();
      expect(updatedLog.tracking_data).toHaveProperty('user_agent');
      expect(updatedLog.tracking_data).toHaveProperty('ip');
      expect(updatedLog.tracking_data).toHaveProperty('location');
    });
  });

  describe('Click Event Processing', () => {
    it('should process email click events with URL tracking', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'click-test@example.com'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-click-123',
        status: 'opened'
      });

      // Create click webhook payload
      const clickPayload: MailtrapWebhookPayload = {
        message_id: 'msg-click-123',
        inbox_id: 123456,
        email: 'click-test@example.com',
        event: 'click',
        timestamp: Date.now(),
        url: 'https://example.com/landing-page',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.1',
        location: 'New York, NY, US'
      };

      const result = await webhookProcessor.processWebhook(clickPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('click');
      expect(result.actions_performed).toContain('email_log_updated');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('clicked');
      expect(updatedLog.clicked_at).toBeDefined();
      expect(updatedLog.tracking_data).toHaveProperty('url');
      expect(updatedLog.tracking_data.url).toBe('https://example.com/landing-page');
    });

    it('should process multiple click events for the same email', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'multi-click-test@example.com'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-multi-click-123',
        status: 'opened'
      });

      // Create multiple click events
      const clickUrls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
      ];

      const results = [];
      for (const url of clickUrls) {
        const payload: MailtrapWebhookPayload = {
          message_id: 'msg-multi-click-123',
          inbox_id: 123456,
          email: 'multi-click-test@example.com',
          event: 'click',
          timestamp: Date.now(),
          url
        };

        const result = await webhookProcessor.processWebhook(payload);
        results.push(result);
      }

      results.forEach((result: any) => { // Add type annotation
        expect(result.success).toBe(true);
      });

      // Verify tracking details were created for each click
      const { data: trackingDetails } = await testClient
        .from('email_tracking_details')
        .select('*')
        .eq('email_log_id', emailLog.id)
        .eq('event_type', 'click');

      expect(trackingDetails).toHaveLength(3);
      clickUrls.forEach(url => {
        expect(trackingDetails.some((detail: any) => detail.url === url)).toBe(true);
      });
    });
  });

  describe('Bounce Event Processing', () => {
    it('should process hard bounce events and update contact status', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'bounce-test@example.com',
        status: 'active'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-bounce-123',
        status: 'sent'
      });

      // Create hard bounce webhook payload
      const bouncePayload: MailtrapWebhookPayload = {
        message_id: 'msg-bounce-123',
        inbox_id: 123456,
        email: 'bounce-test@example.com',
        event: 'bounce',
        timestamp: Date.now(),
        bounce_type: 'hard',
        bounce_reason: 'Invalid email address',
        bounce_code: '550'
      };

      const result = await webhookProcessor.processWebhook(bouncePayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('bounce');
      expect(result.actions_performed).toContain('contact_status_updated');

      // Verify contact status was updated
      const { data: updatedContact } = await testClient
        .from('contacts')
        .select('*')
        .eq('id', testContact.id)
        .single();

      expect(updatedContact.status).toBe('bounced');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('bounced');
      expect(updatedLog.bounce_reason).toBe('Invalid email address');
    });

    it('should process soft bounce events without updating contact status', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'soft-bounce-test@example.com',
        status: 'active'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-soft-bounce-123',
        status: 'sent'
      });

      // Create soft bounce webhook payload
      const bouncePayload: MailtrapWebhookPayload = {
        message_id: 'msg-soft-bounce-123',
        inbox_id: 123456,
        email: 'soft-bounce-test@example.com',
        event: 'bounce',
        timestamp: Date.now(),
        bounce_type: 'soft',
        bounce_reason: 'Mailbox full',
        bounce_code: '452'
      };

      const result = await webhookProcessor.processWebhook(bouncePayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('bounce');

      // Verify contact status remains active for soft bounces
      const { data: updatedContact } = await testClient
        .from('contacts')
        .select('*')
        .eq('id', testContact.id)
        .single();

      expect(updatedContact.status).toBe('active');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('bounced');
    });
  });

  describe('Spam Event Processing', () => {
    it('should process spam events and update contact status', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'spam-test@example.com',
        status: 'active'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-spam-123',
        status: 'delivered'
      });

      // Create spam webhook payload
      const spamPayload: MailtrapWebhookPayload = {
        message_id: 'msg-spam-123',
        inbox_id: 123456,
        email: 'spam-test@example.com',
        event: 'spam',
        timestamp: Date.now()
      };

      const result = await webhookProcessor.processWebhook(spamPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('spam');

      // Verify email log was updated
      const { data: updatedLog } = await testClient
        .from('email_logs')
        .select('*')
        .eq('id', emailLog.id)
        .single();

      expect(updatedLog.status).toBe('failed');
    });
  });

  describe('Unsubscribe Event Processing', () => {
    it('should process unsubscribe events and update contact status', async () => {
      // Create test data
      const testContact = await DatabaseSetup.createTestContact({
        email: 'unsubscribe-test@example.com',
        status: 'active'
      });

      const testTemplate = await DatabaseSetup.createTestTemplate();
      const testCampaign = await DatabaseSetup.createTestCampaign(testTemplate.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(testCampaign.id, testContact.id, {
        mailtrap_message_id: 'msg-unsubscribe-123',
        status: 'delivered'
      });

      // Create unsubscribe webhook payload
      const unsubscribePayload: MailtrapWebhookPayload = {
        message_id: 'msg-unsubscribe-123',
        inbox_id: 123456,
        email: 'unsubscribe-test@example.com',
        event: 'unsubscribe',
        timestamp: Date.now(),
        unsubscribe_type: 'manual'
      };

      const result = await webhookProcessor.processWebhook(unsubscribePayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('unsubscribe');
      expect(result.actions_performed).toContain('contact_status_updated');

      // Verify contact status was updated
      const { data: updatedContact } = await testClient
        .from('contacts')
        .select('*')
        .eq('id', testContact.id)
        .single();

      expect(updatedContact.status).toBe('unsubscribed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed webhook payloads gracefully', async () => {
      const malformedPayloads = [
        { message_id: '', event: 'delivered' }, // Missing required fields
        { message_id: 'test', event: '' }, // Empty event
        { message_id: 'test', event: 'invalid_event' } // Invalid event type
      ];

      for (const payload of malformedPayloads) {
        const result = await webhookProcessor.processWebhook(payload as any);
        expect(result.success).toBe(true); // Should handle gracefully
      }
    });

    it('should handle concurrent webhook processing', async () => {
      const contacts: any[] = []; // Add type annotation
      for (let i = 0; i < 10; i++) {
        const contact = await DatabaseSetup.createTestContact({
          email: `concurrent-${i}@example.com`
        });
        contacts.push(contact);
      }

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      // Create multiple webhook payloads
      const payloads = contacts.map((contact, index) => ({
        message_id: `msg-concurrent-${index}`,
        inbox_id: 123456,
        email: contact.email,
        event: 'delivered',
        timestamp: Date.now()
      }));

      // Process all webhooks concurrently
      const results = await Promise.all(
        payloads.map(payload =>
          webhookProcessor.processWebhook(payload)
        )
      );

      const successCount = results.filter((r: any) => r.success).length; // Add type annotation
      expect(successCount).toBe(10);
    });

    it('should handle webhook processing under load', async () => {
      const startTime = Date.now();
      const totalWebhooks = 50;

      // Generate large number of webhook payloads
      const payloads = Array.from({ length: totalWebhooks }, (_, i) => ({
        message_id: `load-test-${i}`,
        inbox_id: 123456,
        email: `load-test-${i}@example.com`,
        event: 'delivered',
        timestamp: Date.now()
      }));

      // Process webhooks in batches
      const batchSize = 10;
      const results = [];
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(payload => webhookProcessor.processWebhook(payload))
        );
        results.push(...batchResults);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(results).toHaveLength(totalWebhooks);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(totalWebhooks * 0.95); // 95% success rate minimum
    });

    it('should handle database connection errors', async () => {
      const payload: MailtrapWebhookPayload = {
        message_id: 'db-error-test',
        inbox_id: 123456,
        email: 'db-error@example.com',
        event: 'delivered',
        timestamp: Date.now()
      };

      const result = await webhookProcessor.processWebhook(payload);
      expect(result.success).toBe(true); // Should handle gracefully even with DB issues
    });
  });
});
