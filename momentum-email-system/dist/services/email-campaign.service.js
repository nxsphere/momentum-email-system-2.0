"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailCampaignService = void 0;
const supabase_1 = require("../config/supabase");
class EmailCampaignService {
    // ==================== CONTACTS ====================
    async getContacts(limit = 100, offset = 0) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .select("*")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return data;
    }
    async getContactById(id) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .select("*")
            .eq("id", id)
            .single();
        if (error)
            throw error;
        return data;
    }
    async getContactByEmail(email) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .select("*")
            .eq("email", email)
            .single();
        if (error)
            throw error;
        return data;
    }
    async createContact(contact) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .insert(contact)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateContact(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateContactStatus(id, status) {
        return this.updateContact(id, { status });
    }
    async deleteContact(id) {
        const { error } = await supabase_1.supabase.from("contacts").delete().eq("id", id);
        if (error)
            throw error;
    }
    async getActiveContacts() {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .select("*")
            .eq("status", "active")
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        return data;
    }
    // ==================== EMAIL TEMPLATES ====================
    async getEmailTemplates() {
        const { data, error } = await supabase_1.supabase
            .from("email_templates")
            .select("*")
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async getEmailTemplateById(id) {
        const { data, error } = await supabase_1.supabase
            .from("email_templates")
            .select("*")
            .eq("id", id)
            .single();
        if (error)
            throw error;
        return data;
    }
    async createEmailTemplate(template) {
        const { data, error } = await supabase_1.supabase
            .from("email_templates")
            .insert(template)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateEmailTemplate(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from("email_templates")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteEmailTemplate(id) {
        const { error } = await supabase_1.supabase
            .from("email_templates")
            .delete()
            .eq("id", id);
        if (error)
            throw error;
    }
    // ==================== EMAIL CAMPAIGNS ====================
    async getEmailCampaigns() {
        const { data, error } = await supabase_1.supabase
            .from("email_campaigns")
            .select(`
        *,
        email_template:email_templates(*)
      `)
            .order("created_at", { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async getEmailCampaignById(id) {
        const { data, error } = await supabase_1.supabase
            .from("email_campaigns")
            .select(`
        *,
        email_template:email_templates(*)
      `)
            .eq("id", id)
            .single();
        if (error)
            throw error;
        return data;
    }
    async createEmailCampaign(campaign) {
        const { data, error } = await supabase_1.supabase
            .from("email_campaigns")
            .insert(campaign)
            .select(`
        *,
        email_template:email_templates(*)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateEmailCampaign(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from("email_campaigns")
            .update(updates)
            .eq("id", id)
            .select(`
        *,
        email_template:email_templates(*)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateCampaignStatus(id, status) {
        return this.updateEmailCampaign(id, { status });
    }
    async updateCampaignSentCount(id, sentCount) {
        return this.updateEmailCampaign(id, { sent_count: sentCount });
    }
    async deleteEmailCampaign(id) {
        const { error } = await supabase_1.supabase
            .from("email_campaigns")
            .delete()
            .eq("id", id);
        if (error)
            throw error;
    }
    async getScheduledCampaigns() {
        const { data, error } = await supabase_1.supabase
            .from("email_campaigns")
            .select(`
        *,
        email_template:email_templates(*)
      `)
            .eq("status", "scheduled")
            .not("scheduled_at", "is", null)
            .lte("scheduled_at", new Date().toISOString())
            .order("scheduled_at", { ascending: true });
        if (error)
            throw error;
        return data;
    }
    // ==================== EMAIL LOGS ====================
    async getEmailLogs(campaignId, contactId, limit = 100, offset = 0) {
        let query = supabase_1.supabase
            .from("email_logs")
            .select(`
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `)
            .order("sent_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (campaignId) {
            query = query.eq("campaign_id", campaignId);
        }
        if (contactId) {
            query = query.eq("contact_id", contactId);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
    async getEmailLogById(id) {
        const { data, error } = await supabase_1.supabase
            .from("email_logs")
            .select(`
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `)
            .eq("id", id)
            .single();
        if (error)
            throw error;
        return data;
    }
    async createEmailLog(log) {
        const { data, error } = await supabase_1.supabase
            .from("email_logs")
            .insert(log)
            .select(`
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateEmailLog(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from("email_logs")
            .update(updates)
            .eq("id", id)
            .select(`
        *,
        email_campaign:email_campaigns(name),
        contact:contacts(email, first_name, last_name)
      `)
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateEmailLogStatus(id, status, timestamp) {
        const updates = { status };
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
    async markEmailAsBounced(id, _bounceReason) {
        return this.updateEmailLog(id, {
            status: "bounced",
            // bounce_reason: bounceReason, // Note: This field may not exist in the current schema
        });
    }
    // ==================== CAMPAIGN STATISTICS ====================
    async getCampaignStats(campaignId) {
        const { data, error } = await supabase_1.supabase.rpc("get_campaign_stats", {
            campaign_uuid: campaignId,
        });
        if (error)
            throw error;
        return data[0];
    }
    async getCampaignStatsByStatus(campaignId) {
        const { data, error } = await supabase_1.supabase
            .from("email_logs")
            .select("status")
            .eq("campaign_id", campaignId);
        if (error)
            throw error;
        const stats = data.reduce((acc, log) => {
            acc[log.status] = (acc[log.status] || 0) + 1;
            return acc;
        }, {});
        return stats;
    }
    // ==================== UTILITY METHODS ====================
    async searchContacts(query, limit = 50) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .select("*")
            .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
            .limit(limit);
        if (error)
            throw error;
        return data;
    }
    async getContactsCount() {
        const { count, error } = await supabase_1.supabase
            .from("contacts")
            .select("*", { count: "exact", head: true });
        if (error)
            throw error;
        return count || 0;
    }
    async getActiveContactsCount() {
        const { count, error } = await supabase_1.supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");
        if (error)
            throw error;
        return count || 0;
    }
    async getCampaignsCount() {
        const { count, error } = await supabase_1.supabase
            .from("email_campaigns")
            .select("*", { count: "exact", head: true });
        if (error)
            throw error;
        return count || 0;
    }
    async bulkCreateContacts(contacts) {
        const { data, error } = await supabase_1.supabase
            .from("contacts")
            .insert(contacts)
            .select();
        if (error)
            throw error;
        return data;
    }
    async bulkCreateEmailLogs(logs) {
        const { data, error } = await supabase_1.supabase
            .from("email_logs")
            .insert(logs)
            .select();
        if (error)
            throw error;
        return data;
    }
}
exports.EmailCampaignService = EmailCampaignService;
//# sourceMappingURL=email-campaign.service.js.map