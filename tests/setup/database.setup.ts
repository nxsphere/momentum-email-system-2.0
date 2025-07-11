import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseSetup {
  private static testSupabase: SupabaseClient;
  private static isSetup = false;
  private static mockData: Map<string, any[]> = new Map();

  static async setupTestDatabase(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    // Initialize mock data storage
    this.mockData.set('contacts', []);
    this.mockData.set('email_templates', []);
    this.mockData.set('email_campaigns', []);
    this.mockData.set('contact_lists', []);
    this.mockData.set('email_logs', []);
    this.mockData.set('email_queue', []);
    this.mockData.set('webhook_events', []);
    this.mockData.set('email_tracking_details', []);

    // Create a mock Supabase client for testing
    this.testSupabase = this.createMockSupabaseClient();

    this.isSetup = true;
  }

  static async cleanupTestDatabase(): Promise<void> {
    if (!this.mockData) {
      return;
    }

    try {
      // Clear all mock data
      for (const [table, data] of this.mockData.entries()) {
        data.length = 0; // Clear array
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  static getTestClient(): SupabaseClient {
    return this.testSupabase;
  }

  private static createMockSupabaseClient(): any {
    const mockClient = {
      _isMockClient: true, // Add marker for detection
      from: (tableName: string) => ({
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            single: () => {
              const data = this.mockData.get(tableName) || [];
              const record = data.find((item: any) => item[column] === value);
              return { data: record || null, error: null };
            },
            limit: (count: number) => ({
              data: (this.mockData.get(tableName) || []).slice(0, count),
              error: null
            }),
            eq: (column2: string, value2: any) => ({
              data: (this.mockData.get(tableName) || []).filter((item: any) =>
                item[column] === value && item[column2] === value2
              ),
              error: null
            })
          }),
          neq: (column: string, value: any) => ({
            data: (this.mockData.get(tableName) || []).filter((item: any) => item[column] !== value),
            error: null
          }),
          gte: (column: string, value: any) => ({
            data: this.mockData.get(tableName) || [],
            error: null
          }),
          lte: (column: string, value: any) => ({
            data: this.mockData.get(tableName) || [],
            error: null
          }),
          ilike: (column: string, pattern: string) => ({
            data: (this.mockData.get(tableName) || []).filter((item: any) =>
              item[column] && item[column].toLowerCase().includes(pattern.replace('%', '').toLowerCase())
            ),
            error: null
          }),
          order: (column: string, options?: { ascending: boolean }) => ({
            limit: (count: number) => ({
              data: (this.mockData.get(tableName) || []).slice(0, count),
              error: null
            }),
            range: (start: number, end: number) => ({
              data: (this.mockData.get(tableName) || []).slice(start, end + 1),
              error: null
            }),
            data: this.mockData.get(tableName) || [],
            error: null
          }),
          data: this.mockData.get(tableName) || [],
          error: null
        }),
        insert: (record: any) => ({
          select: (columns?: string) => ({
            single: () => {
              const data = this.mockData.get(tableName) || [];
              const newRecord = {
                id: record.id || uuidv4(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                received_at: new Date().toISOString(),
                ...record
              };
              data.push(newRecord);
              this.mockData.set(tableName, data);
              return { data: newRecord, error: null };
            }
          }),
          // Handle direct insert without select().single()
          data: (() => {
            const data = this.mockData.get(tableName) || [];
            const newRecord = {
              id: record.id || uuidv4(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              received_at: new Date().toISOString(),
              ...record
            };
            data.push(newRecord);
            this.mockData.set(tableName, data);
            return newRecord;
          })(),
          error: null
        }),
        update: (updates: any) => ({
          eq: (column: string, value: any) => {
            const data = this.mockData.get(tableName) || [];
            const recordIndex = data.findIndex((item: any) => item[column] === value);
            if (recordIndex >= 0) {
              data[recordIndex] = { ...data[recordIndex], ...updates, updated_at: new Date().toISOString() };
              this.mockData.set(tableName, data);
              return { data: data[recordIndex], error: null };
            }
            // Return error when record doesn't exist for update
            return { data: null, error: { message: `No records found to update for ${column}=${value}` } };
          }
        }),
        delete: () => ({
          eq: (column: string, value: any) => {
            const data = this.mockData.get(tableName) || [];
            const filteredData = data.filter((item: any) => item[column] !== value);
            this.mockData.set(tableName, filteredData);
            return { data: null, error: null };
          },
          ilike: (column: string, pattern: string) => {
            const data = this.mockData.get(tableName) || [];
            const filteredData = data.filter((item: any) =>
              !item[column] || !item[column].toLowerCase().includes(pattern.replace('%', '').toLowerCase())
            );
            this.mockData.set(tableName, filteredData);
            return { data: null, error: null };
          },
          neq: (column: string, value: any) => {
            const data = this.mockData.get(tableName) || [];
            const filteredData = data.filter((item: any) => item[column] === value);
            this.mockData.set(tableName, filteredData);
            return { data: null, error: null };
          },
          gte: (column: string, value: any) => {
            this.mockData.set(tableName, []);
            return { data: null, error: null };
          }
        })
      }),
      rpc: (functionName: string, params: any = {}) => {
        // Debug logging to see what parameters are being passed
        console.log(`Mock RPC called: ${functionName}`, params);

        // Mock database function responses
        switch (functionName) {
          case 'process_email_queue':
            // Handle failure scenario for invalid batch size
            if (params.batch_size && params.batch_size < 0) {
              return { data: [{ processed_count: 0, failed_count: 1, remaining_count: 0 }], error: null };
            }
            return { data: [{ processed_count: params.batch_size || 10, failed_count: 0, remaining_count: 0 }], error: null };

          case 'start_campaign':
            // Handle different campaign scenarios - check both parameter patterns
            const campaignId = params.campaign_id || params.p_campaign_id;
            if (campaignId === 'running-campaign-123') {
              return { data: [{ success: false, message: 'Campaign already running', emails_queued: 0 }], error: null };
            }
            if (campaignId === 'non-existent-campaign') {
              return { data: [{ success: false, message: 'Campaign not found', emails_queued: 0 }], error: null };
            }
            return { data: [{ success: true, emails_queued: 5 }], error: null };

          case 'update_email_status':
            // Handle different email status scenarios
            const emailLogId = params.email_log_id || params.p_email_log_id;
            if (emailLogId === 'test-email-log-456') {
              return { data: [{ success: true, message: 'Email status updated' }], error: null };
            }
            return { data: [{ success: false, message: 'Email log not found' }], error: null };

          case 'handle_bounce':
            // Handle different bounce scenarios
            const email = params.email || params.p_email;
            const bounceType = params.bounce_type || params.p_bounce_type;
            if (email === 'nonexistent@example.com') {
              return { data: [{ success: false, message: 'Email not found', action_taken: 'none' }], error: null };
            }
            if (bounceType === 'hard') {
              return { data: [{ success: true, message: 'Hard bounce handled', action_taken: 'contact deactivated' }], error: null };
            }
            return { data: [{ success: true, message: 'Bounce handled', action_taken: 'contact_updated' }], error: null };

          case 'cleanup_old_data':
            return { data: [{ logs_deleted: 10, queue_deleted: 5 }], error: null };

          case 'check_rate_limit':
            return { data: [{ allowed: true, remaining: 100, reset_time: new Date() }], error: null };

          case 'check_webhook_duplicate':
            return {
              data: [{
                is_duplicate: false,
                existing_event_id: null,
                duplicate_count: 0
              }],
              error: null
            };

          case 'log_campaign_event':
            return { data: [{ success: true, event_id: uuidv4() }], error: null };

          case 'get_enhanced_campaign_stats':
            // Handle different campaign stats scenarios
            const statsCampaignId = params.campaign_id || params.p_campaign_id;
            if (statsCampaignId === 'empty-campaign') {
              return { data: [{
                campaign_name: 'Empty Campaign',
                campaign_status: 'completed',
                total_sent: 0,
                total_delivered: 0,
                total_opened: 0,
                total_clicked: 0,
                total_bounced: 0,
                total_failed: 0,
                delivery_rate: 0,
                open_rate: 0,
                click_rate: 0,
                bounce_rate: 0,
                queue_pending: 0,
                queue_failed: 0,
                progress_percentage: 100.0
              }], error: null };
            }
            return { data: [{
              campaign_name: 'Test Campaign',
              campaign_status: 'completed',
              total_sent: 3,
              total_delivered: 2,
              total_opened: 1,
              total_clicked: 0,
              total_bounced: 1,
              total_failed: 0,
              delivery_rate: 66.67,
              open_rate: 33.33,
              click_rate: 0,
              bounce_rate: 33.33,
              queue_pending: 0,
              queue_failed: 0,
              progress_percentage: 100.0
            }], error: null };

          default:
            return { data: null, error: null };
        }
      }
    };
    return mockClient;
  }

  static async createTestContact(overrides: any = {}) {
    const contact = {
      id: uuidv4(),
      email: overrides.email || `test-${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      status: 'active',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };

    const contacts = this.mockData.get('contacts') || [];
    contacts.push(contact);
    this.mockData.set('contacts', contacts);

    return contact;
  }

  static async createTestTemplate(overrides: any = {}) {
    const template = {
      id: uuidv4(),
      name: `Test Template ${Date.now()}`,
      subject: 'Test Subject: {{contact.first_name}}',
      html_content: '<p>Hello {{contact.first_name}}!</p>',
      text_content: 'Hello {{contact.first_name}}!',
      variables: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };

    const templates = this.mockData.get('email_templates') || [];
    templates.push(template);
    this.mockData.set('email_templates', templates);

    return template;
  }

  static async createTestCampaign(templateId: string, overrides: any = {}) {
    const campaign = {
      id: uuidv4(),
      name: `Test Campaign ${Date.now()}`,
      template_id: templateId,
      status: 'draft',
      total_recipients: 0,
      sent_count: 0,
      from_email: 'test@example.com',
      from_name: 'Test System',
      priority: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };

    const campaigns = this.mockData.get('email_campaigns') || [];
    campaigns.push(campaign);
    this.mockData.set('email_campaigns', campaigns);

    return campaign;
  }

  static async createTestContactList(overrides: any = {}) {
    const contactList = {
      id: uuidv4(),
      name: `Test List ${Date.now()}`,
      description: 'Test contact list',
      type: 'manual',
      total_contacts: 0,
      active_contacts: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };

    const lists = this.mockData.get('contact_lists') || [];
    lists.push(contactList);
    this.mockData.set('contact_lists', lists);

    return contactList;
  }

  static async addContactToList(contactId: string, listId: string) {
    const membership = {
      id: uuidv4(),
      contact_id: contactId,
      list_id: listId,
      added_at: new Date().toISOString()
    };

    const memberships = this.mockData.get('contact_list_members') || [];
    memberships.push(membership);
    this.mockData.set('contact_list_members', memberships);

    return membership;
  }

  static async createTestEmailQueue(campaignId: string, contactId: string, overrides: any = {}) {
    const queueItem = {
      id: uuidv4(),
      campaign_id: campaignId,
      contact_id: contactId,
      email_address: overrides.email_address || `test-${Date.now()}@example.com`,
      status: 'pending',
      priority: 0,
      scheduled_at: new Date().toISOString(),
      attempts: 0,
      max_attempts: 3,
      template_data: {},
      created_at: new Date().toISOString(),
      ...overrides
    };

    const queue = this.mockData.get('email_queue') || [];
    queue.push(queueItem);
    this.mockData.set('email_queue', queue);

    return queueItem;
  }

  static async createTestWebhookEvent(overrides: any = {}) {
    const webhookEvent = {
      id: uuidv4(),
      provider: 'mailtrap',
      event_type: 'delivery',
      email: `test-${Date.now()}@example.com`,
      message_id: `msg-${Date.now()}`,
      payload: {},
      processed_successfully: false,
      duplicate_count: 0,
      received_at: new Date().toISOString(),
      ...overrides
    };

    const events = this.mockData.get('webhook_events') || [];
    events.push(webhookEvent);
    this.mockData.set('webhook_events', events);

    return webhookEvent;
  }

  static async createTestEmailLog(campaignId: string, contactId: string, overrides: any = {}) {
    const emailLog = {
      id: uuidv4(),
      campaign_id: campaignId,
      contact_id: contactId,
      email: overrides.email || `test-${Date.now()}@example.com`,
      status: 'sent',
      tracking_data: {},
      created_at: new Date().toISOString(),
      ...overrides
    };

    const logs = this.mockData.get('email_logs') || [];
    logs.push(emailLog);
    this.mockData.set('email_logs', logs);

    return emailLog;
  }

  static async executeFunction(functionName: string, params: any = {}) {
    // Mock database function responses based on function name
    switch (functionName) {
      case 'process_email_queue':
        return [{ processed_count: params.batch_size || 10, failed_count: 0, remaining_count: 0 }];
      case 'start_campaign':
        return [{ success: true, emails_queued: 5 }];
      case 'update_email_status':
        return [{ success: true, message: 'Email status updated' }];
      case 'handle_bounce':
        return [{ success: true, message: 'Bounce handled', action_taken: 'contact_updated' }];
      case 'cleanup_old_data':
        return [{ logs_deleted: 10, queue_deleted: 5 }];
      case 'check_rate_limit':
        return [{ allowed: true, remaining: 100, reset_time: new Date() }];
      case 'log_campaign_event':
        return [{ success: true, event_id: uuidv4() }];
      case 'get_enhanced_campaign_stats':
        return [{
          campaign_name: 'Test Campaign',
          campaign_status: 'completed',
          total_sent: 100,
          total_delivered: 95,
          total_opened: 50,
          total_clicked: 20,
          total_bounced: 5,
          total_failed: 0,
          delivery_rate: 95.0,
          open_rate: 52.6,
          click_rate: 21.1,
          bounce_rate: 5.0,
          queue_pending: 0,
          queue_failed: 0,
          progress_percentage: 100.0
        }];
      default:
        return [{ success: true, message: 'Mock function executed' }];
    }
  }
}
