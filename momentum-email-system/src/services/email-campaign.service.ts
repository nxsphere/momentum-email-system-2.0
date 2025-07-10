import { supabase } from "../config/supabase";
import {
    CampaignStats,
    CampaignStatus,
    Contact,
    ContactStatus,
    CreateContact,
    CreateEmailCampaign,
    CreateEmailLog,
    CreateEmailTemplate,
    EmailCampaign,
    EmailLog,
    EmailLogStatus,
    EmailTemplate,
} from "../types/email-system";

export class EmailCampaignService {
  // ==================== CONTACTS ====================

  async getContacts(limit = 100, offset = 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data as Contact[];
  }

  async getContactById(id: string) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Contact;
  }

  async getContactByEmail(email: string) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("email", email)
      .single();

    if (error) throw error;
    return data as Contact;
  }

  async createContact(contact: CreateContact) {
    const { data, error } = await supabase
      .from("contacts")
      .insert(contact)
      .select()
      .single();

    if (error) throw error;
    return data as Contact;
  }

  async updateContact(id: string, updates: Partial<CreateContact>) {
    const { data, error } = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Contact;
  }

  async updateContactStatus(id: string, status: ContactStatus) {
    return this.updateContact(id, { status });
  }

  async deleteContact(id: string) {
    const { error } = await supabase.from("contacts").delete().eq("id", id);

    if (error) throw error;
  }

  async getActiveContacts() {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Contact[];
  }

  // ==================== EMAIL TEMPLATES ====================

  async getEmailTemplates() {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as EmailTemplate[];
  }

  async getEmailTemplateById(id: string) {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  async createEmailTemplate(template: CreateEmailTemplate) {
    const { data, error } = await supabase
      .from("email_templates")
      .insert(template)
      .select()
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  async updateEmailTemplate(id: string, updates: Partial<CreateEmailTemplate>) {
    const { data, error } = await supabase
      .from("email_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as EmailTemplate;
  }

  async deleteEmailTemplate(id: string) {
    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // ==================== EMAIL CAMPAIGNS ====================

  async getEmailCampaigns() {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select(
        `
        *,
        email_template:email_templates(*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as EmailCampaign[];
  }

  async getEmailCampaignById(id: string) {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select(
        `
        *,
        email_template:email_templates(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async createEmailCampaign(campaign: CreateEmailCampaign) {
    const { data, error } = await supabase
      .from("email_campaigns")
      .insert(campaign)
      .select(
        `
        *,
        email_template:email_templates(*)
      `
      )
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async updateEmailCampaign(id: string, updates: Partial<CreateEmailCampaign>) {
    const { data, error } = await supabase
      .from("email_campaigns")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        email_template:email_templates(*)
      `
      )
      .single();

    if (error) throw error;
    return data as EmailCampaign;
  }

  async updateCampaignStatus(id: string, status: CampaignStatus) {
    return this.updateEmailCampaign(id, { status });
  }

  async updateCampaignSentCount(id: string, sentCount: number) {
    return this.updateEmailCampaign(id, { sent_count: sentCount });
  }

  async deleteEmailCampaign(id: string) {
    const { error } = await supabase
      .from("email_campaigns")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  async getScheduledCampaigns() {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select(
        `
        *,
        email_template:email_templates(*)
      `
      )
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) throw error;
    return data as EmailCampaign[];
  }

  // ==================== EMAIL LOGS ====================

  async getEmailLogs(
    campaignId?: string,
    contactId?: string,
    limit = 100,
    offset = 0
  ) {
    let query = supabase
      .from("email_logs")
      .select(
        `
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `
      )
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as EmailLog[];
  }

  async getEmailLogById(id: string) {
    const { data, error } = await supabase
      .from("email_logs")
      .select(
        `
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as EmailLog;
  }

  async createEmailLog(log: CreateEmailLog) {
    const { data, error } = await supabase
      .from("email_logs")
      .insert(log)
      .select(
        `
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `
      )
      .single();

    if (error) throw error;
    return data as EmailLog;
  }

  async updateEmailLog(id: string, updates: Partial<CreateEmailLog>) {
    const { data, error } = await supabase
      .from("email_logs")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `
      )
      .single();

    if (error) throw error;
    return data as EmailLog;
  }

  async updateEmailLogStatus(
    id: string,
    status: EmailLogStatus,
    timestamp?: string
  ) {
    const updates: any = { status };

    switch (status) {
      case "delivered":
        updates.delivered_at = timestamp || new Date().toISOString();
        break;
      case "opened":
        updates.opened_at = timestamp || new Date().toISOString();
        break;
      case "clicked":
        updates.clicked_at = timestamp || new Date().toISOString();
        break;
    }

    return this.updateEmailLog(id, updates);
  }

  async markEmailAsBounced(id: string, _bounceReason: string) {
    return this.updateEmailLog(id, {
      status: "bounced",
      // bounce_reason: bounceReason, // Note: This field may not exist in the current schema
    });
  }

  // ==================== CAMPAIGN STATISTICS ====================

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const { data, error } = await supabase.rpc("get_campaign_stats", {
      campaign_uuid: campaignId,
    });

    if (error) throw error;
    return data[0] as CampaignStats;
  }

  async getCampaignStatsByStatus(campaignId: string) {
    const { data, error } = await supabase
      .from("email_logs")
      .select("status")
      .eq("campaign_id", campaignId);

    if (error) throw error;

    const stats = data.reduce(
      (acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return stats;
  }

  // ==================== UTILITY METHODS ====================

  async searchContacts(query: string, limit = 50) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .or(
        `email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      )
      .limit(limit);

    if (error) throw error;
    return data as Contact[];
  }

  async getContactsCount() {
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  }

  async getActiveContactsCount() {
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (error) throw error;
    return count || 0;
  }

  async getCampaignsCount() {
    const { count, error } = await supabase
      .from("email_campaigns")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  }

  async bulkCreateContacts(contacts: CreateContact[]) {
    const { data, error } = await supabase
      .from("contacts")
      .insert(contacts)
      .select();

    if (error) throw error;
    return data as Contact[];
  }

  async bulkCreateEmailLogs(logs: CreateEmailLog[]) {
    const { data, error } = await supabase
      .from("email_logs")
      .insert(logs)
      .select();

    if (error) throw error;
    return data as EmailLog[];
  }
}
