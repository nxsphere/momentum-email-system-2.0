"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailQueueService = void 0;
const supabase_1 = require("../config/supabase");
class EmailQueueService {
    // ==================== QUEUE MANAGEMENT ====================
    async getEmailQueue(limit = 100, offset = 0) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .select("*")
            .order("priority", { ascending: false })
            .order("scheduled_at", { ascending: true })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return data;
    }
    async getQueueForCampaign(campaignId) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .select("*")
            .eq("campaign_id", campaignId)
            .order("status")
            .order("scheduled_at");
        if (error)
            throw error;
        return data;
    }
    async addToQueue(queueItem) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .insert(queueItem)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateQueueStatus(queueId, status, errorMessage) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .update({
            status,
            error_message: errorMessage,
            processed_at: status === "sent" || status === "failed"
                ? new Date().toISOString()
                : null,
        })
            .eq("id", queueId)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async processEmailQueue(batchSize = 50) {
        const { data, error } = await supabase_1.supabase.rpc("process_email_queue", {
            p_batch_size: batchSize,
        });
        if (error)
            throw error;
        return data[0];
    }
    // ==================== CAMPAIGN OPERATIONS ====================
    async startCampaign(campaignId) {
        const { data, error } = await supabase_1.supabase.rpc("start_campaign", {
            p_campaign_id: campaignId,
        });
        if (error)
            throw error;
        return data[0];
    }
    async updateEmailStatus(messageId, status, trackingData = {}) {
        const { data, error } = await supabase_1.supabase.rpc("update_email_status", {
            p_message_id: messageId,
            p_status: status,
            p_tracking_data: trackingData,
        });
        if (error)
            throw error;
        return data[0];
    }
    async getCampaignStats(campaignId) {
        const { data, error } = await supabase_1.supabase.rpc("get_enhanced_campaign_stats", {
            p_campaign_id: campaignId,
        });
        if (error)
            throw error;
        return data[0];
    }
    async handleBounce(email, reason) {
        const { data, error } = await supabase_1.supabase.rpc("handle_bounce", {
            p_email: email,
            p_reason: reason,
        });
        if (error)
            throw error;
        return data[0];
    }
    // ==================== LOGGING ====================
    async getCampaignLogs(campaignId, level, limit = 100) {
        let query = supabase_1.supabase
            .from("campaign_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);
        if (campaignId) {
            query = query.eq("campaign_id", campaignId);
        }
        if (level) {
            query = query.eq("level", level);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
    async logCampaignEvent(campaignId, level, message, metadata = {}) {
        const { data, error } = await supabase_1.supabase.rpc("log_campaign_event", {
            p_campaign_id: campaignId,
            p_level: level,
            p_message: message,
            p_metadata: metadata,
        });
        if (error)
            throw error;
        return data;
    }
    // ==================== RATE LIMITING ====================
    async checkRateLimit(limitKey, maxCount = 200, windowMinutes = 60) {
        const { data, error } = await supabase_1.supabase.rpc("check_rate_limit", {
            p_limit_key: limitKey,
            p_max_count: maxCount,
            p_window_minutes: windowMinutes,
        });
        if (error)
            throw error;
        return data;
    }
    async getRateLimits() {
        const { data, error } = await supabase_1.supabase
            .from("rate_limits")
            .select("*")
            .order("updated_at", { ascending: false });
        if (error)
            throw error;
        return data;
    }
    // ==================== CLEANUP & MAINTENANCE ====================
    async cleanupOldData(daysOld = 90) {
        const { data, error } = await supabase_1.supabase.rpc("cleanup_old_data", {
            p_days_old: daysOld,
        });
        if (error)
            throw error;
        return data[0];
    }
    async getSystemStats() {
        const [totalContacts, activeContacts, totalCampaigns, runningCampaigns, queuePending, queueFailed, rateLimits,] = await Promise.all([
            supabase_1.supabase.from("contacts").select("*", { count: "exact", head: true }),
            supabase_1.supabase
                .from("contacts")
                .select("*", { count: "exact", head: true })
                .eq("status", "active"),
            supabase_1.supabase
                .from("email_campaigns")
                .select("*", { count: "exact", head: true }),
            supabase_1.supabase
                .from("email_campaigns")
                .select("*", { count: "exact", head: true })
                .eq("status", "running"),
            supabase_1.supabase
                .from("email_queue")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending"),
            supabase_1.supabase
                .from("email_queue")
                .select("*", { count: "exact", head: true })
                .eq("status", "failed"),
            supabase_1.supabase
                .from("rate_limits")
                .select("*")
                .eq("limit_key", "email_sending")
                .single(),
        ]);
        return {
            contacts: {
                total: totalContacts.count || 0,
                active: activeContacts.count || 0,
            },
            campaigns: {
                total: totalCampaigns.count || 0,
                running: runningCampaigns.count || 0,
            },
            queue: {
                pending: queuePending.count || 0,
                failed: queueFailed.count || 0,
            },
            rateLimits: rateLimits.data || null,
        };
    }
    // ==================== BULK OPERATIONS ====================
    async bulkUpdateQueueStatus(queueIds, status, errorMessage) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .update({
            status,
            error_message: errorMessage,
            processed_at: status === "sent" || status === "failed"
                ? new Date().toISOString()
                : null,
        })
            .in("id", queueIds)
            .select();
        if (error)
            throw error;
        return data;
    }
    async retryFailedEmails(campaignId, maxAttempts = 3) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .update({
            status: "pending",
            attempts: 0,
            error_message: null,
            processed_at: null,
        })
            .eq("campaign_id", campaignId)
            .eq("status", "failed")
            .lt("attempts", maxAttempts)
            .select();
        if (error)
            throw error;
        return data;
    }
    async cancelCampaignQueue(campaignId) {
        const { data, error } = await supabase_1.supabase
            .from("email_queue")
            .update({
            status: "cancelled",
            processed_at: new Date().toISOString(),
        })
            .eq("campaign_id", campaignId)
            .eq("status", "pending")
            .select();
        if (error)
            throw error;
        return data;
    }
    // ==================== DASHBOARD METRICS ====================
    async getDashboardMetrics() {
        const systemStats = await this.getSystemStats();
        // Get recent activity
        const recentLogs = await this.getCampaignLogs(undefined, undefined, 10);
        // Get rate limit status
        const canSendEmails = await this.checkRateLimit("email_sending");
        return {
            ...systemStats,
            recentActivity: recentLogs,
            canSendEmails,
            lastUpdated: new Date().toISOString(),
        };
    }
    // ==================== WEBHOOK HANDLERS ====================
    async handleMailtrapWebhook(webhookData) {
        const { message_id, event, email, reason } = webhookData;
        try {
            switch (event) {
                case "delivery":
                    return await this.updateEmailStatus(message_id, "delivered", webhookData);
                case "open":
                    return await this.updateEmailStatus(message_id, "opened", webhookData);
                case "click":
                    return await this.updateEmailStatus(message_id, "clicked", webhookData);
                case "bounce":
                    await this.updateEmailStatus(message_id, "bounced", webhookData);
                    return await this.handleBounce(email, reason);
                case "spam":
                    return await this.updateEmailStatus(message_id, "failed", {
                        ...webhookData,
                        reason: "marked as spam",
                    });
                default:
                    await this.logCampaignEvent(null, "warning", `Unknown webhook event: ${event}`, webhookData);
                    return { success: false, message: `Unknown event: ${event}` };
            }
        }
        catch (error) {
            await this.logCampaignEvent(null, "error", `Webhook processing failed: ${error}`, webhookData);
            throw error;
        }
    }
}
exports.EmailQueueService = EmailQueueService;
//# sourceMappingURL=email-queue.service.js.map