import {
    Contact,
    ContactList,
    EmailCampaign,
    EmailQueue,
    EmailTemplate,
    MailtrapWebhookPayload,
    Segment,
    WebhookEvent
} from '../../src/types/email-system';

export class TestDataFactory {
  private static counter = 0;

  private static getUniqueId(): string {
    this.counter++;
    return `${Date.now()}-${this.counter}`;
  }

  /**
   * Generate test contact data
   */
  static createContactData(overrides: Partial<Contact> = {}): Omit<Contact, 'id' | 'created_at' | 'updated_at'> {
    const uniqueId = this.getUniqueId();

    return {
      email: `test-contact-${uniqueId}@example.com`,
      first_name: 'Test',
      last_name: 'Contact',
      status: 'active',
      phone: '+1234567890',
      company: 'Test Company',
      metadata: {
        source: 'test',
        engagement_score: Math.floor(Math.random() * 100),
        last_activity: new Date().toISOString()
      },
      tags: ['test', 'automated'],
      ...overrides
    };
  }

  /**
   * Generate test email template data
   */
  static createTemplateData(overrides: Partial<EmailTemplate> = {}): Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'> {
    const uniqueId = this.getUniqueId();

    return {
      name: `Test Template ${uniqueId}`,
      subject: 'Test Subject: {{contact.first_name}}',
      html_content: `
        <html>
          <body>
            <h1>Hello {{contact.first_name}}!</h1>
            <p>This is a test email template created at ${new Date().toISOString()}</p>
            <p>Your company: {{contact.company}}</p>
            <a href="https://example.com/unsubscribe">Unsubscribe</a>
          </body>
        </html>
      `,
      text_content: `Hello {{contact.first_name}}! This is a test email. Company: {{contact.company}}`,
      variables: {
        'contact.first_name': 'string',
        'contact.company': 'string'
      },
      ...overrides
    };
  }

  /**
   * Generate test campaign data
   */
  static createCampaignData(
    templateId: string,
    overrides: Partial<EmailCampaign> = {}
  ): Omit<EmailCampaign, 'id' | 'created_at' | 'updated_at'> {
    const uniqueId = this.getUniqueId();

    return {
      name: `Test Campaign ${uniqueId}`,
      template_id: templateId,
      subject_line: `Test Campaign Email ${uniqueId}`,
      status: 'draft',
      scheduled_at: null,
      contact_list_id: null,
      segment_id: null,
      metadata: {
        created_by: 'test-user',
        campaign_type: 'promotional',
        test_campaign: true
      },
      ...overrides
    };
  }

  /**
   * Generate test contact list data
   */
  static createContactListData(overrides: Partial<ContactList> = {}): Omit<ContactList, 'id' | 'created_at' | 'updated_at'> {
    const uniqueId = this.getUniqueId();

    return {
      name: `Test Contact List ${uniqueId}`,
      description: `Test contact list for automated testing - ${uniqueId}`,
      type: 'static',
      metadata: {
        source: 'test',
        purpose: 'automated_testing'
      },
      ...overrides
    };
  }

  /**
   * Generate test segment data
   */
  static createSegmentData(overrides: Partial<Segment> = {}): Omit<Segment, 'id' | 'created_at' | 'updated_at'> {
    const uniqueId = this.getUniqueId();

    return {
      name: `Test Segment ${uniqueId}`,
      description: `Dynamic segment for testing - ${uniqueId}`,
      type: 'dynamic',
      filters: {
        conditions: [
          {
            field: 'status',
            operator: 'eq',
            value: 'active'
          },
          {
            field: 'metadata->engagement_score',
            operator: 'gte',
            value: 50
          }
        ],
        logic: 'AND'
      },
      metadata: {
        test_segment: true
      },
      ...overrides
    };
  }

  /**
   * Generate test email queue data
   */
  static createEmailQueueData(
    campaignId: string,
    contactId: string,
    overrides: Partial<EmailQueue> = {}
  ): Omit<EmailQueue, 'id' | 'created_at'> {
    const uniqueId = this.getUniqueId();

    return {
      campaign_id: campaignId,
      contact_id: contactId,
      email_address: `test-queue-${uniqueId}@example.com`,
      template_data: {
        contact: {
          first_name: 'Test',
          last_name: 'Contact',
          company: 'Test Company'
        },
        campaign: {
          name: 'Test Campaign'
        }
      },
      status: 'pending',
      priority: 0,
      scheduled_at: new Date().toISOString(),
      processed_at: null,
      attempts: 0,
      max_attempts: 3,
      error_message: null,
      ...overrides
    };
  }

  /**
   * Generate test webhook event data
   */
  static createWebhookEventData(overrides: Partial<WebhookEvent> = {}): Omit<WebhookEvent, 'id' | 'received_at'> {
    const uniqueId = this.getUniqueId();

    return {
      provider: 'mailtrap',
      event_type: 'delivery',
      email: `test-webhook-${uniqueId}@example.com`,
      message_id: `msg-${uniqueId}`,
      payload: {
        event: 'delivery',
        timestamp: new Date().toISOString(),
        email: `test-webhook-${uniqueId}@example.com`
      },
      processed_successfully: false,
      error_message: null,
      processing_attempts: 0,
      ...overrides
    };
  }

  /**
   * Generate Mailtrap webhook payload
   */
  static createMailtrapWebhookPayload(
    eventType: 'delivery' | 'open' | 'click' | 'bounce' | 'spam' | 'unsubscribe',
    overrides: Partial<MailtrapWebhookPayload> = {}
  ): MailtrapWebhookPayload {
    const uniqueId = this.getUniqueId();
    const basePayload = {
      event: eventType,
      message_id: `msg-${uniqueId}`,
      email: `test-${uniqueId}@example.com`,
      timestamp: new Date().toISOString(),
      ...overrides
    };

    switch (eventType) {
      case 'delivery':
        return {
          ...basePayload,
          response: '250 2.0.0 OK',
          server: 'smtp.example.com',
          ip: this.generateRandomIP(),
          user_agent: this.generateRandomUserAgent(),
          ...overrides
        } as MailtrapWebhookPayload;

      case 'open':
        return {
          ...basePayload,
          ip: this.generateRandomIP(),
          user_agent: this.generateRandomUserAgent(),
          location: {
            country: 'US',
            region: 'CA',
            city: 'San Francisco'
          },
          ...overrides
        } as MailtrapWebhookPayload;

      case 'click':
        return {
          ...basePayload,
          url: `https://example.com/product/${uniqueId}`,
          ip: this.generateRandomIP(),
          user_agent: this.generateRandomUserAgent(),
          location: {
            country: 'US',
            region: 'NY',
            city: 'New York'
          },
          ...overrides
        } as MailtrapWebhookPayload;

      case 'bounce':
        return {
          ...basePayload,
          bounce_type: 'hard',
          bounce_reason: 'mailbox_does_not_exist',
          bounce_code: '550',
          description: 'The email account does not exist.',
          ...overrides
        } as MailtrapWebhookPayload;

      case 'spam':
        return {
          ...basePayload,
          feedback_type: 'abuse',
          user_agent: 'Yahoo! - 9.0.1',
          ...overrides
        } as MailtrapWebhookPayload;

      case 'unsubscribe':
        return {
          ...basePayload,
          unsubscribe_type: 'link',
          ip: this.generateRandomIP(),
          user_agent: this.generateRandomUserAgent(),
          ...overrides
        } as MailtrapWebhookPayload;

      default:
        return basePayload as MailtrapWebhookPayload;
    }
  }

  /**
   * Generate bulk test data
   */
  static createBulkContactsData(count: number, overrides: Partial<Contact> = []): Array<Omit<Contact, 'id' | 'created_at' | 'updated_at'>> {
    return Array.from({ length: count }, (_, index) =>
      this.createContactData({
        email: `bulk-contact-${index}-${this.getUniqueId()}@example.com`,
        first_name: `Contact${index}`,
        metadata: {
          bulk_index: index,
          ...overrides.metadata
        },
        ...overrides
      })
    );
  }

  static createBulkEmailQueueData(
    campaignId: string,
    contacts: Array<{ id: string; email: string }>,
    overrides: Partial<EmailQueue> = {}
  ): Array<Omit<EmailQueue, 'id' | 'created_at'>> {
    return contacts.map((contact, index) =>
      this.createEmailQueueData(campaignId, contact.id, {
        email_address: contact.email,
        priority: index % 5, // Vary priority
        ...overrides
      })
    );
  }

  /**
   * Utility methods
   */
  private static generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  private static generateRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Generate realistic test scenarios
   */
  static createRealisticCampaignScenario() {
    const uniqueId = this.getUniqueId();

    return {
      template: this.createTemplateData({
        name: `Welcome Series Template ${uniqueId}`,
        subject: 'Welcome to our platform, {{contact.first_name}}!',
        html_content: `
          <html>
            <body style="font-family: Arial, sans-serif;">
              <h1>Welcome {{contact.first_name}}!</h1>
              <p>Thank you for joining our platform. We're excited to have you!</p>
              <div style="margin: 20px 0;">
                <a href="https://example.com/get-started" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a>
              </div>
              <p>If you have any questions, feel free to reply to this email.</p>
              <hr>
              <small><a href="https://example.com/unsubscribe">Unsubscribe</a></small>
            </body>
          </html>
        `
      }),
      contacts: this.createBulkContactsData(25, {
        metadata: {
          source: 'website_signup',
          engagement_score: Math.floor(Math.random() * 50) + 50, // High engagement
          signup_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Last week
        }
      }),
      contactList: this.createContactListData({
        name: `New User Welcome List ${uniqueId}`,
        description: 'Contacts who recently signed up for welcome series'
      }),
      campaign: {
        name: `Welcome Campaign ${uniqueId}`,
        subject_line: 'Welcome to our platform!',
        metadata: {
          campaign_type: 'welcome_series',
          expected_open_rate: 45,
          expected_click_rate: 15
        }
      }
    };
  }

  static createHighVolumeTestScenario(contactCount: number = 1000) {
    const uniqueId = this.getUniqueId();

    return {
      template: this.createTemplateData({
        name: `High Volume Template ${uniqueId}`,
        subject: 'Important Update - {{contact.first_name}}'
      }),
      contacts: this.createBulkContactsData(contactCount, {
        metadata: {
          source: 'bulk_import',
          test_scenario: 'high_volume'
        }
      }),
      contactList: this.createContactListData({
        name: `High Volume List ${uniqueId}`,
        description: `Large contact list for performance testing - ${contactCount} contacts`
      }),
      campaign: {
        name: `High Volume Campaign ${uniqueId}`,
        subject_line: 'Performance Test Campaign',
        metadata: {
          campaign_type: 'performance_test',
          contact_count: contactCount
        }
      }
    };
  }

  static createSegmentedCampaignScenario() {
    const uniqueId = this.getUniqueId();

    // Create contacts with varying engagement scores
    const highEngagementContacts = this.createBulkContactsData(15, {
      metadata: { engagement_score: Math.floor(Math.random() * 20) + 80 } // 80-100
    });

    const mediumEngagementContacts = this.createBulkContactsData(20, {
      metadata: { engagement_score: Math.floor(Math.random() * 30) + 50 } // 50-80
    });

    const lowEngagementContacts = this.createBulkContactsData(10, {
      metadata: { engagement_score: Math.floor(Math.random() * 30) + 20 } // 20-50
    });

    return {
      template: this.createTemplateData({
        name: `Segmented Template ${uniqueId}`,
        subject: 'Personalized offer for {{contact.first_name}}'
      }),
      contacts: {
        high: highEngagementContacts,
        medium: mediumEngagementContacts,
        low: lowEngagementContacts,
        all: [...highEngagementContacts, ...mediumEngagementContacts, ...lowEngagementContacts]
      },
      segments: {
        high: this.createSegmentData({
          name: `High Engagement ${uniqueId}`,
          filters: {
            conditions: [
              { field: 'metadata->engagement_score', operator: 'gte', value: 80 }
            ]
          }
        }),
        medium: this.createSegmentData({
          name: `Medium Engagement ${uniqueId}`,
          filters: {
            conditions: [
              { field: 'metadata->engagement_score', operator: 'gte', value: 50 },
              { field: 'metadata->engagement_score', operator: 'lt', value: 80 }
            ]
          }
        }),
        low: this.createSegmentData({
          name: `Low Engagement ${uniqueId}`,
          filters: {
            conditions: [
              { field: 'metadata->engagement_score', operator: 'lt', value: 50 }
            ]
          }
        })
      }
    };
  }

  /**
   * Reset counter for consistent test runs
   */
  static resetCounter(): void {
    this.counter = 0;
  }
}

export default TestDataFactory;
