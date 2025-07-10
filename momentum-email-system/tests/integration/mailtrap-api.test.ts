import nock from 'nock';
import { createEmailConfig } from '../../src/config/email.config';
import { MailtrapProvider } from '../../src/providers/mailtrap.provider';
import { EmailService } from '../../src/services/email.service';
import { EmailAddress, EmailMessage } from '../../src/types/email-provider';

describe('Mailtrap API Integration Tests', () => {
  let mailtrapProvider: MailtrapProvider;
  let emailService: EmailService;
  const MAILTRAP_BASE_URL = 'https://send.api.mailtrap.io';

  beforeAll(() => {
    // Setup email configuration for testing
    const config = createEmailConfig();
    mailtrapProvider = config.service.provider as MailtrapProvider;
    emailService = new EmailService(config.service);
  });

  beforeEach(() => {
    // Clean up any existing nock interceptors
    nock.cleanAll();
  });

  afterEach(() => {
    // Verify all expected API calls were made
    if (!nock.isDone()) {
      console.warn('Not all expected HTTP requests were made');
    }
    nock.cleanAll();
  });

  describe('Email Sending', () => {
    it('should send email successfully through Mailtrap API', async () => {
      const mockResponse = {
        message_id: 'msg-12345',
        message_uuid: 'msg-12345',
        message_ids: ['msg-12345'],
        success: true
      };

      // Mock successful API response
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(200, mockResponse);

      const emailMessage: EmailMessage = {
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: [{ email: 'recipient@example.com', name: 'Test Recipient' }],
        subject: 'Test Email',
        html: '<p>This is a test email</p>',
        text: 'This is a test email',
        headers: {},
        metadata: {}
      };

      const result = await mailtrapProvider.sendEmail(emailMessage);

      expect(result).toMatchObject({
        messageId: 'msg-12345',
        status: 'sent',
        message: expect.any(String)
      });
    });

    it('should handle Mailtrap API rate limiting', async () => {
      // Mock rate limit response
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(429, {
          error: 'Rate limit exceeded',
          message: 'Too many requests'
        }, {
          'X-RateLimit-Limit': '200',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600)
        });

      const emailMessage: EmailMessage = {
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: [{ email: 'recipient@example.com', name: 'Test Recipient' }],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        headers: {},
        metadata: {}
      };

      await expect(mailtrapProvider.sendEmail(emailMessage)).rejects.toThrow(/rate limit/i);
    });

    it('should handle Mailtrap API authentication errors', async () => {
      // Mock authentication error
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(401, {
          error: 'Unauthorized',
          message: 'Invalid API key'
        });

      const emailMessage: EmailMessage = {
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: [{ email: 'recipient@example.com', name: 'Test Recipient' }],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        headers: {},
        metadata: {}
      };

      await expect(mailtrapProvider.sendEmail(emailMessage)).rejects.toThrow(/unauthorized|authentication/i);
    });

    it('should handle malformed email addresses', async () => {
      // Mock validation error
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(400, {
          error: 'Bad Request',
          message: 'Invalid email address format'
        });

      const emailMessage: EmailMessage = {
        from: { email: 'invalid-email', name: 'Test Sender' },
        to: [{ email: 'also-invalid', name: 'Test Recipient' }],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        headers: {},
        metadata: {}
      };

      await expect(mailtrapProvider.sendEmail(emailMessage)).rejects.toThrow(/invalid|bad request/i);
    });

    it('should handle Mailtrap server errors', async () => {
      // Mock server error
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(500, {
          error: 'Internal Server Error',
          message: 'Something went wrong'
        });

      const emailMessage: EmailMessage = {
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: [{ email: 'recipient@example.com', name: 'Test Recipient' }],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        headers: {},
        metadata: {}
      };

      await expect(mailtrapProvider.sendEmail(emailMessage)).rejects.toThrow(/server error/i);
    });

    it('should send bulk emails with proper batching', async () => {
      // Mock multiple successful responses
      for (let i = 1; i <= 3; i++) {
        nock(MAILTRAP_BASE_URL)
          .post('/api/send')
          .reply(200, {
            message_id: `msg-${i}`,
            message_uuid: `msg-${i}`,
            message_ids: [`msg-${i}`],
            success: true
          });
      }

      const emailMessages: EmailMessage[] = [
        {
          from: { email: 'test@example.com', name: 'Test Sender' },
          to: [{ email: 'recipient1@example.com', name: 'Recipient 1' }],
          subject: 'Test Email 1',
          html: '<p>Test content 1</p>',
          text: 'Test content 1',
          headers: {},
          metadata: {}
        },
        {
          from: { email: 'test@example.com', name: 'Test Sender' },
          to: [{ email: 'recipient2@example.com', name: 'Recipient 2' }],
          subject: 'Test Email 2',
          html: '<p>Test content 2</p>',
          text: 'Test content 2',
          headers: {},
          metadata: {}
        },
        {
          from: { email: 'test@example.com', name: 'Test Sender' },
          to: [{ email: 'recipient3@example.com', name: 'Recipient 3' }],
          subject: 'Test Email 3',
          html: '<p>Test content 3</p>',
          text: 'Test content 3',
          headers: {},
          metadata: {}
        }
      ];

      const results = await emailService.sendBulkEmails(emailMessages);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('sent');
        expect(result.messageId).toMatch(/^msg-\d+$/);
      });
    });
  });

  describe('Email Status Tracking', () => {
    it('should retrieve email status from Mailtrap API', async () => {
      const messageId = 'msg-12345';
      const mockStatus = {
        message_id: messageId,
        status: 'delivered',
        events: [
          {
            type: 'sent',
            timestamp: '2024-01-20T10:00:00Z'
          },
          {
            type: 'delivered',
            timestamp: '2024-01-20T10:01:00Z'
          }
        ]
      };

      nock(MAILTRAP_BASE_URL)
        .get(`/api/messages/${messageId}`)
        .reply(200, mockStatus);

      const status = await mailtrapProvider.getEmailStatus(messageId);

      expect(status).toMatchObject({
        messageId,
        status: 'delivered',
        events: expect.arrayContaining([
          expect.objectContaining({ type: 'sent' }),
          expect.objectContaining({ type: 'delivered' })
        ])
      });
    });

    it('should handle non-existent message ID', async () => {
      const messageId = 'non-existent-msg';

      nock(MAILTRAP_BASE_URL)
        .get(`/api/messages/${messageId}`)
        .reply(404, {
          error: 'Not Found',
          message: 'Message not found'
        });

      await expect(mailtrapProvider.getEmailStatus(messageId)).rejects.toThrow(/not found/i);
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit status', async () => {
      const mockRateLimit = {
        limit: 200,
        remaining: 150,
        reset: Math.floor(Date.now() / 1000) + 3600
      };

      nock(MAILTRAP_BASE_URL)
        .get('/api/rate-limit')
        .reply(200, mockRateLimit);

      const rateLimitInfo = await mailtrapProvider.checkRateLimit();

      expect(rateLimitInfo).toMatchObject({
        limit: 200,
        remaining: 150,
        resetTime: expect.any(Date)
      });
    });

    it('should handle rate limit API errors', async () => {
      nock(MAILTRAP_BASE_URL)
        .get('/api/rate-limit')
        .reply(500, {
          error: 'Internal Server Error'
        });

      // Should provide fallback values when API is unavailable
      const rateLimitInfo = await mailtrapProvider.checkRateLimit();

      expect(rateLimitInfo).toMatchObject({
        limit: expect.any(Number),
        remaining: expect.any(Number),
        resetTime: expect.any(Date)
      });
    });
  });

  describe('Template Validation', () => {
    it('should validate email templates through Mailtrap API', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        subject: 'Hello {{name}}!',
        html_content: '<p>Hello {{name}}!</p>',
        text_content: 'Hello {{name}}!',
        variables: { name: 'string' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      nock(MAILTRAP_BASE_URL)
        .post('/api/templates/validate')
        .reply(200, {
          valid: true,
          errors: []
        });

      const isValid = await mailtrapProvider.validateTemplate(template);

      expect(isValid).toBe(true);
    });

    it('should detect invalid template syntax', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        subject: 'Hello {{name}!', // Missing closing brace
        html_content: '<p>Hello {{name}}!</p>',
        text_content: 'Hello {{name}}!',
        variables: { name: 'string' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      nock(MAILTRAP_BASE_URL)
        .post('/api/templates/validate')
        .reply(400, {
          valid: false,
          errors: ['Invalid template syntax in subject line']
        });

      const isValid = await mailtrapProvider.validateTemplate(template);

      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Processing', () => {
    it('should process delivery webhook correctly', async () => {
      const webhookPayload = {
        event: 'delivery',
        message_id: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: '2024-01-20T10:01:00Z',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...'
      };

      const webhookSignature = 'valid-signature';

      const event = await mailtrapProvider.processWebhook(webhookPayload, webhookSignature);

      expect(event).toMatchObject({
        type: 'delivery',
        messageId: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0...'
        })
      });
    });

    it('should process open webhook correctly', async () => {
      const webhookPayload = {
        event: 'open',
        message_id: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: '2024-01-20T10:05:00Z',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...'
      };

      const webhookSignature = 'valid-signature';

      const event = await mailtrapProvider.processWebhook(webhookPayload, webhookSignature);

      expect(event).toMatchObject({
        type: 'open',
        messageId: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0...'
        })
      });
    });

    it('should process click webhook correctly', async () => {
      const webhookPayload = {
        event: 'click',
        message_id: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: '2024-01-20T10:10:00Z',
        url: 'https://example.com/clicked-link',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0...'
      };

      const webhookSignature = 'valid-signature';

      const event = await mailtrapProvider.processWebhook(webhookPayload, webhookSignature);

      expect(event).toMatchObject({
        type: 'click',
        messageId: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          url: 'https://example.com/clicked-link',
          ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0...'
        })
      });
    });

    it('should process bounce webhook correctly', async () => {
      const webhookPayload = {
        event: 'bounce',
        message_id: 'msg-12345',
        email: 'bounced@example.com',
        timestamp: '2024-01-20T10:02:00Z',
        bounce_type: 'hard',
        bounce_reason: 'mailbox_full'
      };

      const webhookSignature = 'valid-signature';

      const event = await mailtrapProvider.processWebhook(webhookPayload, webhookSignature);

      expect(event).toMatchObject({
        type: 'bounce',
        messageId: 'msg-12345',
        email: 'bounced@example.com',
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          bounce_type: 'hard',
          bounce_reason: 'mailbox_full'
        })
      });
    });

    it('should verify webhook signatures', async () => {
      const webhookPayload = {
        event: 'delivery',
        message_id: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: '2024-01-20T10:01:00Z'
      };

      const validSignature = 'valid-signature';
      const invalidSignature = 'invalid-signature';

      // Mock signature verification
      const isValidSig = mailtrapProvider.verifyWebhookSignature(webhookPayload, validSignature);
      const isInvalidSig = mailtrapProvider.verifyWebhookSignature(webhookPayload, invalidSignature);

      expect(isValidSig).toBe(true);
      expect(isInvalidSig).toBe(false);
    });

    it('should reject webhooks with invalid signatures', async () => {
      const webhookPayload = {
        event: 'delivery',
        message_id: 'msg-12345',
        email: 'recipient@example.com',
        timestamp: '2024-01-20T10:01:00Z'
      };

      const invalidSignature = 'invalid-signature';

      await expect(
        mailtrapProvider.processWebhook(webhookPayload, invalidSignature)
      ).rejects.toThrow(/invalid.*signature/i);
    });
  });

  describe('Provider Statistics', () => {
    it('should retrieve provider statistics', async () => {
      const mockStats = {
        emails_sent: 1250,
        emails_delivered: 1200,
        emails_bounced: 25,
        emails_opened: 800,
        emails_clicked: 200,
        delivery_rate: 96.0,
        open_rate: 64.0,
        click_rate: 16.0
      };

      nock(MAILTRAP_BASE_URL)
        .get('/api/stats')
        .reply(200, mockStats);

      const stats = await mailtrapProvider.getProviderStats?.();

      expect(stats).toMatchObject({
        emails_sent: 1250,
        emails_delivered: 1200,
        emails_bounced: 25,
        emails_opened: 800,
        emails_clicked: 200,
        delivery_rate: 96.0,
        open_rate: 64.0,
        click_rate: 16.0
      });
    });
  });

  describe('Health Checks', () => {
    it('should perform health check successfully', async () => {
      nock(MAILTRAP_BASE_URL)
        .get('/api/health')
        .reply(200, {
          status: 'healthy',
          timestamp: new Date().toISOString()
        });

      const isHealthy = await mailtrapProvider.healthCheck?.();

      expect(isHealthy).toBe(true);
    });

    it('should handle unhealthy service', async () => {
      nock(MAILTRAP_BASE_URL)
        .get('/api/health')
        .reply(503, {
          status: 'unhealthy',
          message: 'Service temporarily unavailable'
        });

      const isHealthy = await mailtrapProvider.healthCheck?.();

      expect(isHealthy).toBe(false);
    });

    it('should handle network errors in health check', async () => {
      nock(MAILTRAP_BASE_URL)
        .get('/api/health')
        .replyWithError('ECONNREFUSED');

      const isHealthy = await mailtrapProvider.healthCheck?.();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Email Service Integration', () => {
    it('should integrate with EmailService for retry logic', async () => {
      let attemptCount = 0;

      // Mock first attempt failing, second succeeding
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .times(2)
        .reply(function() {
          attemptCount++;
          if (attemptCount === 1) {
            return [500, { error: 'Temporary server error' }];
          } else {
            return [200, { message_ids: ['msg-retry-success'], success: true }];
          }
        });

      const emailMessage: EmailMessage = {
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: [{ email: 'recipient@example.com', name: 'Test Recipient' }],
        subject: 'Test Email with Retry',
        html: '<p>Test content</p>',
        text: 'Test content',
        headers: {},
        metadata: {}
      };

      const result = await emailService.sendEmail(emailMessage);

      expect(result.status).toBe('sent');
      expect(result.messageId).toBe('msg-retry-success');
      expect(attemptCount).toBe(2); // Should have retried once
    });

    it('should integrate with EmailService for templated emails', async () => {
      nock(MAILTRAP_BASE_URL)
        .post('/api/send')
        .reply(200, {
          message_ids: ['msg-template-test'],
          success: true
        });

      const template = {
        id: 'welcome-template',
        name: 'Welcome Email',
        subject: 'Welcome {{name}}!',
        html_content: '<h1>Welcome {{name}}!</h1><p>Thank you for joining us.</p>',
        text_content: 'Welcome {{name}}! Thank you for joining us.',
        variables: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const recipients: EmailAddress[] = [
        { email: 'newuser@example.com', name: 'New User' }
      ];

      const from: EmailAddress = { email: 'welcome@example.com', name: 'Welcome Team' };

      const results = await emailService.sendTemplatedEmail(template, recipients, from);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('sent');
      expect(results[0].messageId).toBe('msg-template-test');
    });
  });
});
