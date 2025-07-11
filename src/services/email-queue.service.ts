import { supabase } from "../config/supabase";
import {
  CampaignLog,
  CampaignStats,
  CleanupResult,
  CreateEmailQueue,
  EmailQueue,
  HandleBounceResult,
  LogLevel,
  ProcessQueueResult,
  RateLimit,
  StartCampaignResult,
  UpdateEmailStatusResult,
} from "../types/email-system";

export class EmailQueueService {
  // ==================== QUEUE MANAGEMENT ====================

  async getEmailQueue(limit = 100, offset = 0) {
    const { data, error } = await supabase
      .from("email_queue")
      .select("*")
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data as EmailQueue[];
  }

  async getQueueForCampaign(campaignId: string) {
    const { data, error } = await supabase
      .from("email_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("status")
      .order("scheduled_at");

    if (error) throw error;
    return data as EmailQueue[];
  }

  async addToQueue(queueItem: CreateEmailQueue) {
    const { data, error } = await supabase
      .from("email_queue")
      .insert(queueItem)
      .select()
      .single();

    if (error) throw error;
    return data as EmailQueue;
  }

  async updateQueueStatus(
    queueId: string,
    status: string,
    errorMessage?: string
  ) {
    const { data, error } = await supabase
      .from("email_queue")
      .update({
        status,
        error_message: errorMessage,
        processed_at:
          status === "sent" || status === "failed"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", queueId)
      .select()
      .single();

    if (error) throw error;
    return data as EmailQueue;
  }

  async processEmailQueue(batchSize = 50): Promise<ProcessQueueResult> {
    const { data, error } = await supabase.rpc("process_email_queue", {
      p_batch_size: batchSize,
    });

    if (error) throw error;
    return data[0] as ProcessQueueResult;
  }

  // ==================== CAMPAIGN OPERATIONS ====================

  async startCampaign(campaignId: string): Promise<StartCampaignResult> {
    const { data, error } = await supabase.rpc("start_campaign", {
      p_campaign_id: campaignId,
    });

    if (error) throw error;
    return data[0] as StartCampaignResult;
  }

  async updateEmailStatus(
    messageId: string,
    status: string,
    trackingData: Record<string, any> = {}
  ): Promise<UpdateEmailStatusResult> {
    const { data, error } = await supabase.rpc("update_email_status", {
      p_message_id: messageId,
      p_status: status,
      p_tracking_data: trackingData,
    });

    if (error) throw error;
    return data[0] as UpdateEmailStatusResult;
  }

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const { data, error } = await supabase.rpc("get_enhanced_campaign_stats", {
      p_campaign_id: campaignId,
    });

    if (error) throw error;
    return data[0] as CampaignStats;
  }

  async handleBounce(
    email: string,
    reason: string
  ): Promise<HandleBounceResult> {
    const { data, error } = await supabase.rpc("handle_bounce", {
      p_email: email,
      p_reason: reason,
    });

    if (error) throw error;
    return data[0] as HandleBounceResult;
  }

  // ==================== LOGGING ====================

  async getCampaignLogs(campaignId?: string, level?: LogLevel, limit = 100) {
    let query = supabase
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

    if (error) throw error;
    return data as CampaignLog[];
  }

  async logCampaignEvent(
    campaignId: string | null,
    level: LogLevel,
    message: string,
    metadata: Record<string, any> = {}
  ) {
    const { data, error } = await supabase.rpc("log_campaign_event", {
      p_campaign_id: campaignId,
      p_level: level,
      p_message: message,
      p_metadata: metadata,
    });

    if (error) throw error;
    return data;
  }

  // ==================== RATE LIMITING ====================

  async checkRateLimit(
    limitKey: string,
    maxCount = 200,
    windowMinutes = 60
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_limit_key: limitKey,
      p_max_count: maxCount,
      p_window_minutes: windowMinutes,
    });

    if (error) throw error;
    return data as boolean;
  }

  async getRateLimits() {
    const { data, error } = await supabase
      .from("rate_limits")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data as RateLimit[];
  }

  // ==================== CLEANUP & MAINTENANCE ====================

  async cleanupOldData(daysOld = 90): Promise<CleanupResult> {
    const { data, error } = await supabase.rpc("cleanup_old_data", {
      p_days_old: daysOld,
    });

    if (error) throw error;
    return data[0] as CleanupResult;
  }

  async getSystemStats() {
    const [
      totalContacts,
      activeContacts,
      totalCampaigns,
      runningCampaigns,
      queuePending,
      queueFailed,
      rateLimits,
    ] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("email_campaigns")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("email_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("status", "running"),
      supabase
        .from("email_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("email_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
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

  async bulkUpdateQueueStatus(
    queueIds: string[],
    status: string,
    errorMessage?: string
  ) {
    const { data, error } = await supabase
      .from("email_queue")
      .update({
        status,
        error_message: errorMessage,
        processed_at:
          status === "sent" || status === "failed"
            ? new Date().toISOString()
            : null,
      })
      .in("id", queueIds)
      .select();

    if (error) throw error;
    return data as EmailQueue[];
  }

  async retryFailedEmails(campaignId: string, maxAttempts = 3) {
    const { data, error } = await supabase
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

    if (error) throw error;
    return data as EmailQueue[];
  }

  async cancelCampaignQueue(campaignId: string) {
    const { data, error } = await supabase
      .from("email_queue")
      .update({
        status: "cancelled",
        processed_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .select();

    if (error) throw error;
    return data as EmailQueue[];
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

  async handleMailtrapWebhook(webhookData: any) {
    const { message_id, event, email, reason } = webhookData;

    try {
      switch (event) {
        case "delivery":
          return await this.updateEmailStatus(
            message_id,
            "delivered",
            webhookData
          );

        case "open":
          return await this.updateEmailStatus(
            message_id,
            "opened",
            webhookData
          );

        case "click":
          return await this.updateEmailStatus(
            message_id,
            "clicked",
            webhookData
          );

        case "bounce":
          await this.updateEmailStatus(message_id, "bounced", webhookData);
          return await this.handleBounce(email, reason);

        case "spam":
          return await this.updateEmailStatus(message_id, "failed", {
            ...webhookData,
            reason: "marked as spam",
          });

        default:
          await this.logCampaignEvent(
            null,
            "warning",
            `Unknown webhook event: ${event}`,
            webhookData
          );
          return { success: false, message: `Unknown event: ${event}` };
      }
    } catch (error) {
      await this.logCampaignEvent(
        null,
        "error",
        `Webhook processing failed: ${error}`,
        webhookData
      );
      throw error;
    }
  }
}
