import { WebhookProcessorService } from '../../src/services/webhook-processor.service';
import { DatabaseSetup } from '../setup/database.setup';
import { TEST_CONFIG } from '../setup/test.config';

describe('End-to-End Email Campaign Flow Tests', () => {
  let testClient: any;
  let webhookProcessor: WebhookProcessorService;

  beforeAll(async () => {
    await DatabaseSetup.setupTestDatabase();
    testClient = DatabaseSetup.getTestClient();
    webhookProcessor = new WebhookProcessorService(
      TEST_CONFIG.database.supabaseUrl,
      TEST_CONFIG.database.supabaseServiceRoleKey,
      testClient // Pass mock client
    );
  });

  afterAll(async () => {
    await DatabaseSetup.cleanupTestDatabase();
  });

  beforeEach(async () => {
    await DatabaseSetup.cleanupTestDatabase();
    await DatabaseSetup.setupTestDatabase();
  });

  describe('Complete Campaign Lifecycle', () => {
    it('should handle full campaign from creation to completion', async () => {
      // Create test data
      const contacts = await Promise.all([
        DatabaseSetup.createTestContact({ email: 'user1@example.com' }),
        DatabaseSetup.createTestContact({ email: 'user2@example.com' }),
        DatabaseSetup.createTestContact({ email: 'user3@example.com' })
      ]);

      const template = await DatabaseSetup.createTestTemplate({
        name: 'E2E Test Template',
        subject: 'E2E Test Subject',
        html_content: '<h1>Hello {{first_name}}</h1>'
      });

      const campaign = await DatabaseSetup.createTestCampaign(template.id, {
        name: 'E2E Test Campaign',
        subject: 'E2E Test Campaign Email' // Changed from subject_line to subject
      });

      // Start campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect(startResult).toBeDefined();
      expect(Array.isArray(startResult)).toBe(true);
      expect(startResult[0]).toHaveProperty('success');
      expect((startResult[0] as any).emails_queued).toBe(contacts.length);

      // Process email queue
      const processResult = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 10
      });

      expect(processResult).toBeDefined();
      expect(Array.isArray(processResult)).toBe(true);
      expect((processResult[0] as any).processed_count).toBeGreaterThan(0);

      // Verify campaign completion
      const { data: updatedCampaign } = await testClient
        .from('email_campaigns')
        .select('*')
        .eq('id', campaign.id)
        .single();

      expect(updatedCampaign).toBeTruthy();
    });
  });

  describe('Scheduled Campaign Processing', () => {
    it('should handle scheduled campaigns correctly', async () => {
      const contacts = await Promise.all([
        DatabaseSetup.createTestContact({ email: 'scheduled1@example.com' }),
        DatabaseSetup.createTestContact({ email: 'scheduled2@example.com' })
      ]);

      const template = await DatabaseSetup.createTestTemplate({
        name: 'Scheduled Template',
        subject: 'Scheduled Email',
        html_content: '<p>This is a scheduled email</p>'
      });

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const campaign = await DatabaseSetup.createTestCampaign(template.id, {
        name: 'Scheduled Campaign',
        subject: 'Scheduled Campaign Test', // Changed from subject_line
        scheduled_at: futureDate.toISOString()
      });

      // Start scheduled campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect(startResult).toBeDefined();
      expect(Array.isArray(startResult)).toBe(true);
      expect((startResult[0] as any).success).toBe(true);

      // Verify emails were queued with future send time
      const { data: queuedEmails } = await testClient
        .from('email_queue')
        .select('*')
        .eq('campaign_id', campaign.id);

      expect(queuedEmails).toHaveLength(contacts.length);
      expect(new Date(queuedEmails[0].scheduled_at) > new Date()).toBe(true); // Fixed check

      // Try to process queue (should not process future emails)
      const processResult = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 10
      });

      expect((processResult[0] as any).processed_count).toBe(0); // Should not process future emails
    });
  });

  describe('Campaign with Segmentation', () => {
    it('should process segmented campaigns correctly', async () => {
      // Create contacts with different engagement levels
      const highEngagementContacts = await Promise.all([
        DatabaseSetup.createTestContact({
          email: 'high1@example.com',
          metadata: { engagement_score: 95 }
        }),
        DatabaseSetup.createTestContact({
          email: 'high2@example.com',
          metadata: { engagement_score: 87 }
        })
      ]);

      const lowEngagementContacts = await Promise.all([
        DatabaseSetup.createTestContact({
          email: 'low1@example.com',
          metadata: { engagement_score: 15 }
        }),
        DatabaseSetup.createTestContact({
          email: 'low2@example.com',
          metadata: { engagement_score: 22 }
        })
      ]);

      const template = await DatabaseSetup.createTestTemplate({
        name: 'Segmented Template',
        subject: 'Special Offer',
        html_content: '<p>Special offer for engaged users!</p>'
      });

      const campaign = await DatabaseSetup.createTestCampaign(template.id, {
        name: 'Segmented Campaign',
        subject: 'Special Offer Campaign', // Changed from subject_line
        segment_criteria: { engagement_score: { gte: 50 } }
      });

      // Start campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect((startResult[0] as any).success).toBe(true);
      expect((startResult[0] as any).emails_queued).toBe(highEngagementContacts.length); // Only high-engagement contacts

      // Verify segmentation worked
      const { data: queuedEmails } = await testClient
        .from('email_queue')
        .select('*')
        .eq('campaign_id', campaign.id);

      expect(queuedEmails).toHaveLength(highEngagementContacts.length);
    });
  });

  describe('Webhook Integration and Tracking', () => {
    it('should process webhook events and update campaign tracking', async () => {
      // Create test data
      const contact = await DatabaseSetup.createTestContact({
        email: 'webhook-test@example.com'
      });

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(campaign.id, contact.id, {
        mailtrap_message_id: 'msg-webhook-test-123',
        status: 'sent'
      });

      // Test delivery webhook
      const deliveryWebhook = {
        message_id: 'msg-webhook-test-123',
        inbox_id: 123456,
        email: contact.email,
        event: 'delivery',
        timestamp: Date.now()
      };

      const deliveryResult = await webhookProcessor.processWebhook(deliveryWebhook); // Fixed method name

      expect(deliveryResult.success).toBe(true);
      expect(deliveryResult.actions_performed).toContain('email_log_updated');

      // Test open webhook
      const openWebhook = {
        message_id: 'msg-webhook-test-123',
        inbox_id: 123456,
        email: contact.email,
        event: 'open',
        timestamp: Date.now(),
        ip: '192.168.1.1',
        user_agent: 'Test Browser'
      };

      const openResult = await webhookProcessor.processWebhook(openWebhook); // Fixed method name

      expect(openResult.success).toBe(true);
      expect(openResult.actions_performed).toContain('tracking_detail_created');

      // Test click webhook
      const clickWebhook = {
        message_id: 'msg-webhook-test-123',
        inbox_id: 123456,
        email: contact.email,
        event: 'click',
        timestamp: Date.now(),
        url: 'https://example.com/product'
      };

      const clickResult = await webhookProcessor.processWebhook(clickWebhook); // Fixed method name

      expect(clickResult.success).toBe(true);
      expect(clickResult.actions_performed).toContain('tracking_detail_created');

      // Verify campaign stats updated
      const statsResult = await DatabaseSetup.executeFunction('get_enhanced_campaign_stats', {
        campaign_id: campaign.id
      });

      expect((statsResult[0] as any).delivery_rate).toBe(100);
      expect((statsResult[0] as any).open_rate).toBe(100);
    });

    it('should handle bounce processing and contact updates', async () => {
      const contact = await DatabaseSetup.createTestContact({
        email: 'bounce-test@example.com',
        status: 'active'
      });

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      const emailLog = await DatabaseSetup.createTestEmailLog(campaign.id, contact.id, {
        mailtrap_message_id: 'msg-bounce-test-123',
        status: 'sent'
      });

      // Test bounce webhook
      const bounceWebhook = {
        message_id: 'msg-bounce-test-123',
        inbox_id: 123456,
        email: contact.email,
        event: 'bounce',
        timestamp: Date.now(),
        bounce_type: 'hard' as const, // Fixed type
        bounce_reason: 'Invalid email address'
      };

      const bounceResult = await webhookProcessor.processWebhook(bounceWebhook); // Fixed method name

      expect(bounceResult.success).toBe(true);
      expect(bounceResult.actions_performed).toContain('contact_status_updated');

      // Verify contact was updated
      const { data: updatedContact } = await testClient
        .from('contacts')
        .select('*')
        .eq('id', contact.id)
        .single();

      expect(updatedContact.status).toBe('bounced');
    });
  });

  describe('Real-time Monitoring Integration', () => {
    it('should handle real-time campaign monitoring', async () => {
      // Create campaign with multiple contacts
      const contacts = await Promise.all([
        DatabaseSetup.createTestContact({ email: 'monitor1@example.com' }),
        DatabaseSetup.createTestContact({ email: 'monitor2@example.com' }),
        DatabaseSetup.createTestContact({ email: 'monitor3@example.com' })
      ]);

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      // Start campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect((startResult[0] as any).success).toBe(true);
      expect((startResult[0] as any).emails_queued).toBe(contacts.length);

      // Simulate real-time processing monitoring
      let totalProcessed = 0;
      let processingRounds = 0;

      while (totalProcessed < contacts.length && processingRounds < 5) {
        const processResult = await DatabaseSetup.executeFunction('process_email_queue', {
          batch_size: 1
        });

        totalProcessed += (processResult[0] as any).processed_count;
        processingRounds++;

        if ((processResult[0] as any).processed_count === 0) break;

        // Small delay to simulate real-time monitoring
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(totalProcessed).toBeGreaterThan(0);
      expect(processingRounds).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle campaign errors gracefully', async () => {
      // Test with invalid template ID
      const result = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: 'invalid-campaign-id'
      });

      expect((result[0] as any).success).toBe(true);
      expect((result[0] as any).emails_queued).toBe(0);
    });

    it('should handle email processing failures', async () => {
      // Create campaign with invalid email data
      const contact = await DatabaseSetup.createTestContact({
        email: 'invalid-email-format'
      });

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      // Start campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect((startResult[0] as any).success).toBe(true);
      expect((startResult[0] as any).emails_queued).toBe(1); // Fixed: single contact

      // Process queue - should handle failures gracefully
      const processResult = await DatabaseSetup.executeFunction('process_email_queue', {
        batch_size: 10
      });

      expect((processResult[0] as any).failed_count).toBeGreaterThan(0);
    });
  });

  describe('Performance and Cleanup', () => {
    it('should handle high-volume campaign processing', async () => {
      // Create campaign with many contacts
      const contacts = [];
      for (let i = 0; i < 50; i++) {
        contacts.push(await DatabaseSetup.createTestContact({
          email: `bulk${i}@example.com`
        }));
      }

      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      // Start campaign
      const startResult = await DatabaseSetup.executeFunction('start_campaign', {
        campaign_id: campaign.id
      });

      expect((startResult[0] as any).success).toBe(true);
      expect((startResult[0] as any).emails_queued).toBe(contacts.length);

      // Process in batches
      let totalProcessed = 0;
      while (totalProcessed < contacts.length) {
        const processResult = await DatabaseSetup.executeFunction('process_email_queue', {
          batch_size: 10
        });

        totalProcessed += (processResult[0] as any).processed_count;

        if ((processResult[0] as any).processed_count === 0) break;
      }

      expect(totalProcessed).toBeGreaterThan(0);
    });

    it('should clean up old campaign data', async () => {
      // Create old campaign data
      const template = await DatabaseSetup.createTestTemplate();
      const campaign = await DatabaseSetup.createTestCampaign(template.id);

      // Cleanup old data
      const cleanupResult = await DatabaseSetup.executeFunction('cleanup_old_data', {
        days_to_keep: 30
      });

      expect((cleanupResult[0] as any).logs_deleted).toBeGreaterThan(0);
    });
  });
});
