import { supabase } from "../config/supabase";
import {
    AddContactsToListResult,
    BulkContactOperation,
    BulkOperationResult,
    CalculateSegmentResult,
    CampaignStats,
    CampaignValidationResult,
    Contact,
    ContactFilter,
    ContactList,
    ContactListType,
    CreateContactList,
    CreateEmailCampaign,
    CreateSegment,
    DuplicateCampaignResult,
    EmailCampaign,
    PaginationOptions,
    PauseCampaignResult,
    RealTimeStats,
    ResumeCampaignResult,
    Segment,
    SegmentFilter,
    UUID
} from "../types/email-system";

export class CampaignManagementService {

  // ==================== CAMPAIGN MANAGEMENT ====================

  /**
   * Create a new email campaign with validation
   * @param templateId Template ID to use for the campaign
   * @param contactListOrSegmentId Contact list or segment ID for recipients
   * @param scheduledAt When to schedule the campaign (optional)
   * @param campaignData Additional campaign configuration
   */
  async createCampaign(
    templateId: UUID,
    contactListOrSegmentId: UUID,
    scheduledAt?: string,
    campaignData?: Partial<CreateEmailCampaign>
  ): Promise<EmailCampaign> {
    // Validate inputs
    const validation = await this.validateCampaignCreation({
      template_id: templateId,
      contact_list_id: contactListOrSegmentId,
      scheduled_at: scheduledAt,
      ...campaignData
    });

    if (!validation.is_valid) {
      throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
    }

    // Get template to extract subject and verify existence
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Determine if this is a segment or contact list
    const isSegment = await this.isSegmentId(contactListOrSegmentId);
    const recipientCount = await this.getRecipientCount(contactListOrSegmentId, isSegment);

    if (recipientCount === 0) {
      throw new Error('No active recipients found in the specified contact list or segment');
    }

    // Create the campaign
    const campaignToCreate: CreateEmailCampaign = {
      template_id: templateId,
      name: campaignData?.name || `Campaign - ${template.name} - ${new Date().toLocaleDateString()}`,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduled_at: scheduledAt,
      subject: campaignData?.subject || template.subject,
      from_email: campaignData?.from_email || 'funding@momentumbusiness.capital',
      from_name: campaignData?.from_name || 'Momentum Business Capital',
      priority: campaignData?.priority || 0,
      total_recipients: recipientCount,
      sent_count: 0,
      ...(isSegment ? { segment_id: contactListOrSegmentId } : { contact_list_id: contactListOrSegmentId }),
      ...campaignData
    };

    const { data, error } = await supabase
      .from('email_campaigns')
      .insert(campaignToCreate)
      .select(`
        *,
        email_template:email_templates(*),
        segment:segments(*),
        contact_list:contact_lists(*)
      `)
      .single();

    if (error) throw error;

    // Log campaign creation
    await this.logCampaignEvent(data.id, 'info', 'Campaign created successfully', {
      template_id: templateId,
      recipient_count: recipientCount,
      scheduled_at: scheduledAt
    });

    return data as EmailCampaign;
  }

  /**
   * Pause an active campaign
   */
  async pauseCampaign(campaignId: UUID, reason?: string): Promise<PauseCampaignResult> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    if (campaign.status !== 'running') {
      throw new Error(`Campaign cannot be paused. Current status: ${campaign.status}`);
    }

    const pausedAt = new Date().toISOString();

    // Update campaign status
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'paused',
        paused_at: pausedAt,
        paused_reason: reason || 'Manual pause',
        updated_at: pausedAt
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    // Pause pending emails in the queue
    const { data: pausedEmails, error: queueError } = await supabase
      .from('email_queue')
      .update({
        status: 'pending', // Keep as pending but will be processed when campaign resumes
        updated_at: pausedAt
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .select('id');

    if (queueError) throw queueError;

    const emailsPaused = pausedEmails?.length || 0;

    // Log the pause event
    await this.logCampaignEvent(campaignId, 'info', 'Campaign paused', {
      reason: reason || 'Manual pause',
      emails_paused: emailsPaused,
      paused_at: pausedAt
    });

    return {
      success: true,
      message: `Campaign paused successfully. ${emailsPaused} emails affected.`,
      paused_at: pausedAt,
      emails_paused: emailsPaused
    };
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: UUID): Promise<ResumeCampaignResult> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    if (campaign.status !== 'paused') {
      throw new Error(`Campaign cannot be resumed. Current status: ${campaign.status}`);
    }

    const resumedAt = new Date().toISOString();

    // Update campaign status
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({
        status: 'running',
        paused_at: null,
        paused_reason: null,
        updated_at: resumedAt
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    // Count emails that will be resumed
    const { data: resumedEmails, error: queueError } = await supabase
      .from('email_queue')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (queueError) throw queueError;

    const emailsResumed = resumedEmails?.length || 0;

    // Log the resume event
    await this.logCampaignEvent(campaignId, 'info', 'Campaign resumed', {
      emails_resumed: emailsResumed,
      resumed_at: resumedAt
    });

    return {
      success: true,
      message: `Campaign resumed successfully. ${emailsResumed} emails will continue processing.`,
      resumed_at: resumedAt,
      emails_resumed: emailsResumed
    };
  }

  /**
   * Get comprehensive campaign status with real-time stats
   */
  async getCampaignStatus(campaignId: UUID): Promise<CampaignStats & RealTimeStats> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Get comprehensive stats using the database function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_enhanced_campaign_stats', { p_campaign_id: campaignId });

    if (statsError) throw statsError;

    if (!stats || stats.length === 0) {
      // Return default stats if no data found
      return this.getDefaultCampaignStats(campaign);
    }

    const baseStats = stats[0];

    // Calculate real-time metrics
    const progressPercentage = campaign.total_recipients > 0
      ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
      : 0;

    // Estimate completion time based on current send rate
    const estimatedCompletion = await this.calculateEstimatedCompletion(campaignId);
    const currentSendRate = await this.calculateCurrentSendRate(campaignId);

    return {
      campaign_name: baseStats.campaign_name,
      campaign_status: baseStats.campaign_status,
      total_sent: baseStats.total_sent || 0,
      total_delivered: baseStats.total_delivered || 0,
      total_opened: baseStats.total_opened || 0,
      total_clicked: baseStats.total_clicked || 0,
      total_bounced: baseStats.total_bounced || 0,
      total_failed: baseStats.total_failed || 0,
      delivery_rate: baseStats.delivery_rate || 0,
      open_rate: baseStats.open_rate || 0,
      click_rate: baseStats.click_rate || 0,
      bounce_rate: baseStats.bounce_rate || 0,
      queue_pending: baseStats.queue_pending || 0,
      queue_failed: baseStats.queue_failed || 0,
      last_activity: baseStats.last_activity,
      // Real-time stats
      progress_percentage: progressPercentage,
      estimated_completion: estimatedCompletion,
      current_send_rate: currentSendRate,
      // RealTimeStats fields
      campaign_id: campaignId,
      current_status: campaign.status,
      emails_sent: campaign.sent_count,
      emails_pending: baseStats.queue_pending || 0,
      emails_failed: baseStats.queue_failed || 0,
      send_rate_per_minute: currentSendRate,
      last_email_sent_at: baseStats.last_activity
    };
  }

  /**
   * Duplicate an existing campaign for reuse
   */
  async duplicateCampaign(campaignId: UUID, newName?: string): Promise<DuplicateCampaignResult> {
    const originalCampaign = await this.getCampaignById(campaignId);

    if (!originalCampaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Create new campaign based on the original
    const duplicatedCampaign: CreateEmailCampaign = {
      template_id: originalCampaign.template_id,
      name: newName || `Copy of ${originalCampaign.name}`,
      status: 'draft', // Always start as draft
      subject: originalCampaign.subject,
      from_email: originalCampaign.from_email,
      from_name: originalCampaign.from_name,
      priority: originalCampaign.priority,
      segment_id: originalCampaign.segment_id,
      contact_list_id: originalCampaign.contact_list_id,
      // Reset counters and dates
      total_recipients: 0, // Will be recalculated when campaign starts
      sent_count: 0
    };

    const { data: newCampaign, error } = await supabase
      .from('email_campaigns')
      .insert(duplicatedCampaign)
      .select(`
        *,
        email_template:email_templates(*),
        segment:segments(*),
        contact_list:contact_lists(*)
      `)
      .single();

    if (error) throw error;

    // Log the duplication
    await this.logCampaignEvent(newCampaign.id, 'info', 'Campaign duplicated', {
      original_campaign_id: campaignId,
      original_campaign_name: originalCampaign.name
    });

    return {
      success: true,
      message: `Campaign duplicated successfully as "${newCampaign.name}"`,
      new_campaign_id: newCampaign.id,
      original_campaign_id: campaignId
    };
  }

  // ==================== CONTACT LIST MANAGEMENT ====================

  /**
   * Create a new contact list
   */
  async createContactList(listData: CreateContactList): Promise<ContactList> {
    const { data, error } = await supabase
      .from('contact_lists')
      .insert(listData)
      .select()
      .single();

    if (error) throw error;
    return data as ContactList;
  }

  /**
   * Get all contact lists with pagination and filtering
   */
  async getContactLists(
    pagination?: PaginationOptions,
    filter?: { type?: ContactListType; name_contains?: string }
  ): Promise<ContactList[]> {
    let query = supabase
      .from('contact_lists')
      .select('*');

    // Apply filters
    if (filter?.type) {
      query = query.eq('type', filter.type);
    }

    if (filter?.name_contains) {
      query = query.ilike('name', `%${filter.name_contains}%`);
    }

    // Apply pagination
    if (pagination) {
      const { limit = 50, offset = 0, order_by = 'created_at', order_direction = 'desc' } = pagination;
      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ContactList[];
  }

  /**
   * Add contacts to a contact list
   */
  async addContactsToList(listId: UUID, contactEmails: string[]): Promise<AddContactsToListResult> {
    const { data, error } = await supabase
      .rpc('add_contacts_to_list', {
        p_list_id: listId,
        p_contact_emails: contactEmails
      });

    if (error) throw error;

    const result = data[0];
    return {
      added_count: result.added_count,
      skipped_count: result.skipped_count,
      not_found_count: result.not_found_count
    };
  }

  /**
   * Remove contacts from a contact list
   */
  async removeContactsFromList(listId: UUID, contactIds: UUID[]): Promise<number> {
    const { data, error } = await supabase
      .from('contact_list_memberships')
      .delete()
      .eq('list_id', listId)
      .in('contact_id', contactIds)
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }

  /**
   * Get contacts in a specific list
   */
  async getContactsInList(
    listId: UUID,
    pagination?: PaginationOptions,
    filter?: ContactFilter
  ): Promise<Contact[]> {
    let query = supabase
      .from('contact_list_memberships')
      .select(`
        contact_id,
        added_at,
        contacts (*)
      `)
      .eq('list_id', listId);

    // Apply filters on the contacts
    if (filter?.status) {
      query = query.in('contacts.status', filter.status);
    }

    if (filter?.email_contains) {
      query = query.ilike('contacts.email', `%${filter.email_contains}%`);
    }

    if (filter?.name_contains) {
      query = query.or(`contacts.first_name.ilike.%${filter.name_contains}%,contacts.last_name.ilike.%${filter.name_contains}%`);
    }

    // Apply pagination
    if (pagination) {
      const { limit = 50, offset = 0, order_by = 'added_at', order_direction = 'desc' } = pagination;
      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data?.map(item => item.contacts).filter(Boolean) as unknown) as Contact[];
  }

  // ==================== SEGMENT MANAGEMENT ====================

  /**
   * Create a new segment
   */
  async createSegment(segmentData: CreateSegment): Promise<Segment> {
    const { data, error } = await supabase
      .from('segments')
      .insert(segmentData)
      .select(`
        *,
        contact_list:contact_lists(*)
      `)
      .single();

    if (error) throw error;

    // If it's a dynamic segment, calculate initial membership
    if (data.type === 'dynamic') {
      await this.calculateSegmentMembership(data.id);
    }

    return data as Segment;
  }

  /**
   * Get all segments with pagination and filtering
   */
  async getSegments(
    pagination?: PaginationOptions,
    filter?: SegmentFilter
  ): Promise<Segment[]> {
    let query = supabase
      .from('segments')
      .select(`
        *,
        contact_list:contact_lists(*)
      `);

    // Apply filters
    if (filter?.type) {
      query = query.in('type', filter.type);
    }

    if (filter?.contact_list_ids) {
      query = query.in('contact_list_id', filter.contact_list_ids);
    }

    if (filter?.min_contacts) {
      query = query.gte('active_contacts', filter.min_contacts);
    }

    if (filter?.max_contacts) {
      query = query.lte('active_contacts', filter.max_contacts);
    }

    // Apply pagination
    if (pagination) {
      const { limit = 50, offset = 0, order_by = 'created_at', order_direction = 'desc' } = pagination;
      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Segment[];
  }

  /**
   * Calculate dynamic segment membership
   */
  async calculateSegmentMembership(segmentId: UUID): Promise<CalculateSegmentResult> {
    const startTime = Date.now();

    const { data, error } = await supabase
      .rpc('calculate_dynamic_segment', { p_segment_id: segmentId });

    if (error) throw error;

    const calculationTime = Date.now() - startTime;
    const contactsAdded = data || 0;

    return {
      segment_id: segmentId,
      contacts_added: contactsAdded,
      calculation_time: calculationTime
    };
  }

  /**
   * Get contacts in a specific segment
   */
  async getContactsInSegment(
    segmentId: UUID,
    pagination?: PaginationOptions,
    filter?: ContactFilter
  ): Promise<Contact[]> {
    let query = supabase
      .from('contact_segments')
      .select(`
        contact_id,
        added_at,
        calculated_at,
        contacts (*)
      `)
      .eq('segment_id', segmentId);

    // Apply filters on the contacts
    if (filter?.status) {
      query = query.in('contacts.status', filter.status);
    }

    if (filter?.email_contains) {
      query = query.ilike('contacts.email', `%${filter.email_contains}%`);
    }

    // Apply pagination
    if (pagination) {
      const { limit = 50, offset = 0, order_by = 'calculated_at', order_direction = 'desc' } = pagination;
      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data?.map(item => item.contacts).filter(Boolean) as unknown) as Contact[];
  }

  // ==================== CAMPAIGN VALIDATION ====================

  /**
   * Validate campaign creation parameters
   */
  async validateCampaignCreation(campaignData: Partial<CreateEmailCampaign>): Promise<CampaignValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Template validation
    if (!campaignData.template_id) {
      errors.push('Template ID is required');
    } else {
      const template = await this.getTemplateById(campaignData.template_id);
      if (!template) {
        errors.push('Specified template does not exist');
      }
    }

    // Recipients validation
    const hasContactList = !!campaignData.contact_list_id;
    const hasSegment = !!campaignData.segment_id;

    if (!hasContactList && !hasSegment) {
      errors.push('Either contact_list_id or segment_id must be provided');
    }

    if (hasContactList && hasSegment) {
      errors.push('Cannot specify both contact_list_id and segment_id');
    }

    // Validate recipient count
    if (hasContactList || hasSegment) {
      const recipientId = campaignData.contact_list_id || campaignData.segment_id!;
      const recipientCount = await this.getRecipientCount(recipientId, hasSegment);

      if (recipientCount === 0) {
        errors.push('No active recipients found in the specified contact list or segment');
      } else if (recipientCount > 10000) {
        warnings.push(`Large recipient count (${recipientCount}). Consider segmenting for better performance.`);
      }
    }

    // Scheduled date validation
    if (campaignData.scheduled_at) {
      const scheduledDate = new Date(campaignData.scheduled_at);
      const now = new Date();

      if (scheduledDate <= now) {
        errors.push('Scheduled date must be in the future');
      }

      // Warn if scheduled too far in advance
      const maxAdvanceMonths = 6;
      const maxAdvanceDate = new Date();
      maxAdvanceDate.setMonth(maxAdvanceDate.getMonth() + maxAdvanceMonths);

      if (scheduledDate > maxAdvanceDate) {
        warnings.push(`Campaign scheduled more than ${maxAdvanceMonths} months in advance`);
      }
    }

    // Subject validation
    if (campaignData.subject) {
      if (campaignData.subject.length < 3) {
        errors.push('Subject must be at least 3 characters long');
      }

      if (campaignData.subject.length > 200) {
        errors.push('Subject must be less than 200 characters');
      }

      // Check for spam trigger words
      const spamWords = ['urgent', 'act now', 'limited time', '!!!', 'free money'];
      const hasSpamWords = spamWords.some(word =>
        campaignData.subject!.toLowerCase().includes(word.toLowerCase())
      );

      if (hasSpamWords) {
        warnings.push('Subject contains words that may trigger spam filters');
      }
    }

    // Email validation
    if (campaignData.from_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(campaignData.from_email)) {
        errors.push('Invalid from_email format');
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Perform bulk operations on contacts
   */
  async performBulkContactOperation(operation: BulkContactOperation): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      success_count: 0,
      error_count: 0,
      errors: []
    };

    for (const contactId of operation.contact_ids) {
      try {
        switch (operation.operation) {
          case 'add_to_list':
            if (!operation.target_id) throw new Error('List ID required for add_to_list operation');
            await supabase
              .from('contact_list_memberships')
              .insert({ contact_id: contactId, list_id: operation.target_id })
              .throwOnError();
            break;

          case 'remove_from_list':
            if (!operation.target_id) throw new Error('List ID required for remove_from_list operation');
            await supabase
              .from('contact_list_memberships')
              .delete()
              .eq('contact_id', contactId)
              .eq('list_id', operation.target_id)
              .throwOnError();
            break;

          case 'add_to_segment':
            if (!operation.target_id) throw new Error('Segment ID required for add_to_segment operation');
            await supabase
              .from('contact_segments')
              .insert({ contact_id: contactId, segment_id: operation.target_id })
              .throwOnError();
            break;

          case 'update_status':
            if (!operation.new_status) throw new Error('New status required for update_status operation');
            await supabase
              .from('contacts')
              .update({ status: operation.new_status, updated_at: new Date().toISOString() })
              .eq('id', contactId)
              .throwOnError();
            break;
        }

        results.success_count++;
      } catch (error) {
        results.error_count++;
        results.errors.push({
          contact_id: contactId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  // ==================== HELPER METHODS ====================

  private async getCampaignById(campaignId: UUID): Promise<EmailCampaign | null> {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select(`
        *,
        email_template:email_templates(*),
        segment:segments(*),
        contact_list:contact_lists(*)
      `)
      .eq('id', campaignId)
      .single();

    if (error) return null;
    return data as EmailCampaign;
  }

  private async getTemplateById(templateId: UUID) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) return null;
    return data;
  }

  private async isSegmentId(id: UUID): Promise<boolean> {
    const { data } = await supabase
      .from('segments')
      .select('id')
      .eq('id', id)
      .single();

    return !!data;
  }

  private async getRecipientCount(id: UUID, isSegment: boolean): Promise<number> {
    if (isSegment) {
      const { data } = await supabase
        .from('segments')
        .select('active_contacts')
        .eq('id', id)
        .single();

      return data?.active_contacts || 0;
    } else {
      const { data } = await supabase
        .from('contact_lists')
        .select('active_contacts')
        .eq('id', id)
        .single();

      return data?.active_contacts || 0;
    }
  }

  private async logCampaignEvent(
    campaignId: UUID,
    level: 'debug' | 'info' | 'warning' | 'error',
    message: string,
    metadata: any = {}
  ): Promise<void> {
    await supabase
      .from('campaign_logs')
      .insert({
        campaign_id: campaignId,
        level,
        message,
        metadata
      });
  }

  private getDefaultCampaignStats(campaign: EmailCampaign): CampaignStats & RealTimeStats {
    return {
      campaign_name: campaign.name,
      campaign_status: campaign.status,
      total_sent: campaign.sent_count,
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
      last_activity: campaign.created_at,
      progress_percentage: 0,
      estimated_completion: undefined,
      current_send_rate: 0,
      // RealTimeStats fields
      campaign_id: campaign.id,
      current_status: campaign.status,
      emails_sent: campaign.sent_count,
      emails_pending: 0,
      emails_failed: 0,
      send_rate_per_minute: 0,
      last_email_sent_at: undefined
    };
  }

  private async calculateEstimatedCompletion(campaignId: UUID): Promise<string | undefined> {
    // Get campaign info
    const campaign = await this.getCampaignById(campaignId);
    if (!campaign || campaign.status !== 'running') {
      return undefined;
    }

    const remaining = campaign.total_recipients - campaign.sent_count;
    if (remaining <= 0) {
      return undefined;
    }

    // Calculate current send rate (emails per minute)
    const sendRate = await this.calculateCurrentSendRate(campaignId);
    if (sendRate <= 0) {
      return undefined;
    }

    // Estimate completion time
    const minutesToComplete = remaining / sendRate;
    const completionTime = new Date();
    completionTime.setMinutes(completionTime.getMinutes() + minutesToComplete);

    return completionTime.toISOString();
  }

  private async calculateCurrentSendRate(campaignId: UUID): Promise<number> {
    // Look at emails sent in the last 10 minutes to calculate rate
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const { data, error } = await supabase
      .from('email_logs')
      .select('sent_at')
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')
      .gte('sent_at', tenMinutesAgo.toISOString());

    if (error || !data) {
      return 0;
    }

    // Calculate emails per minute
    return data.length / 10;
  }
}
