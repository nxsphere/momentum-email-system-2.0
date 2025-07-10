import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { UUID } from "../types/email-provider";
import {
    CampaignStats,
    CampaignStatus,
    EmailLog,
    RealTimeStats
} from "../types/email-system";

export interface CampaignMonitoringCallbacks {
  onCampaignStatusChange?: (campaignId: UUID, oldStatus: CampaignStatus, newStatus: CampaignStatus) => void;
  onEmailSent?: (campaignId: UUID, emailLog: EmailLog) => void;
  onEmailDelivered?: (campaignId: UUID, emailLog: EmailLog) => void;
  onEmailOpened?: (campaignId: UUID, emailLog: EmailLog) => void;
  onEmailClicked?: (campaignId: UUID, emailLog: EmailLog) => void;
  onEmailBounced?: (campaignId: UUID, emailLog: EmailLog) => void;
  onCampaignProgress?: (campaignId: UUID, stats: RealTimeStats) => void;
  onCampaignCompleted?: (campaignId: UUID, finalStats: CampaignStats) => void;
  onError?: (error: Error) => void;
}

export class RealtimeCampaignMonitorService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private monitoredCampaigns: Set<UUID> = new Set();
  private campaignStats: Map<UUID, RealTimeStats> = new Map();
  private updateIntervals: Map<UUID, NodeJS.Timeout> = new Map();
  private callbacks: CampaignMonitoringCallbacks = {};

  constructor(callbacks?: CampaignMonitoringCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Start monitoring a specific campaign
   */
  async startCampaignMonitoring(campaignId: UUID): Promise<void> {
    if (this.monitoredCampaigns.has(campaignId)) {
      console.log(`Already monitoring campaign ${campaignId}`);
      return;
    }

    try {
      // Add to monitored campaigns
      this.monitoredCampaigns.add(campaignId);

      // Initialize campaign stats
      await this.initializeCampaignStats(campaignId);

      // Subscribe to campaign updates
      await this.subscribeToCampaignUpdates(campaignId);

      // Subscribe to email log updates for this campaign
      await this.subscribeToEmailLogUpdates(campaignId);

      // Subscribe to email queue updates for this campaign
      await this.subscribeToEmailQueueUpdates(campaignId);

      // Start periodic stats updates
      this.startPeriodicStatsUpdate(campaignId);

      console.log(`✅ Started monitoring campaign ${campaignId}`);
    } catch (error) {
      console.error(`❌ Failed to start monitoring campaign ${campaignId}:`, error);
      this.monitoredCampaigns.delete(campaignId);
      throw error;
    }
  }

  /**
   * Stop monitoring a specific campaign
   */
  async stopCampaignMonitoring(campaignId: UUID): Promise<void> {
    if (!this.monitoredCampaigns.has(campaignId)) {
      return;
    }

    // Remove from monitored campaigns
    this.monitoredCampaigns.delete(campaignId);

    // Clear periodic updates
    const interval = this.updateIntervals.get(campaignId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(campaignId);
    }

    // Remove stats
    this.campaignStats.delete(campaignId);

    // Unsubscribe from channels
    const campaignChannelKey = `campaign-${campaignId}`;
    const emailLogChannelKey = `email-logs-${campaignId}`;
    const emailQueueChannelKey = `email-queue-${campaignId}`;

    for (const channelKey of [campaignChannelKey, emailLogChannelKey, emailQueueChannelKey]) {
      const channel = this.channels.get(channelKey);
      if (channel) {
        await supabase.removeChannel(channel);
        this.channels.delete(channelKey);
      }
    }

    console.log(`✅ Stopped monitoring campaign ${campaignId}`);
  }

  /**
   * Stop monitoring all campaigns
   */
  async stopAllMonitoring(): Promise<void> {
    const campaignIds = Array.from(this.monitoredCampaigns);

    for (const campaignId of campaignIds) {
      await this.stopCampaignMonitoring(campaignId);
    }

    console.log('✅ Stopped monitoring all campaigns');
  }

  /**
   * Get current real-time stats for a campaign
   */
  getCampaignStats(campaignId: UUID): RealTimeStats | null {
    return this.campaignStats.get(campaignId) || null;
  }

  /**
   * Get all monitored campaigns
   */
  getMonitoredCampaigns(): UUID[] {
    return Array.from(this.monitoredCampaigns);
  }

  /**
   * Update monitoring callbacks
   */
  updateCallbacks(callbacks: Partial<CampaignMonitoringCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Force refresh stats for a campaign
   */
  async refreshCampaignStats(campaignId: UUID): Promise<RealTimeStats | null> {
    if (!this.monitoredCampaigns.has(campaignId)) {
      return null;
    }

    try {
      const stats = await this.calculateRealTimeStats(campaignId);
      this.campaignStats.set(campaignId, stats);

      // Trigger progress callback
      if (this.callbacks.onCampaignProgress) {
        this.callbacks.onCampaignProgress(campaignId, stats);
      }

      return stats;
    } catch (error) {
      console.error(`Failed to refresh stats for campaign ${campaignId}:`, error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
      return null;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async initializeCampaignStats(campaignId: UUID): Promise<void> {
    const stats = await this.calculateRealTimeStats(campaignId);
    this.campaignStats.set(campaignId, stats);
  }

  private async subscribeToCampaignUpdates(campaignId: UUID): Promise<void> {
    const channelKey = `campaign-${campaignId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_campaigns',
          filter: `id=eq.${campaignId}`
        },
        async (payload) => {
          console.log(`📊 Campaign ${campaignId} updated:`, payload);
          await this.handleCampaignUpdate(campaignId, payload);
        }
      );

    await channel.subscribe();
    this.channels.set(channelKey, channel);
  }

  private async subscribeToEmailLogUpdates(campaignId: UUID): Promise<void> {
    const channelKey = `email-logs-${campaignId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
          filter: `campaign_id=eq.${campaignId}`
        },
        async (payload) => {
          console.log(`📧 Email log updated for campaign ${campaignId}:`, payload);
          await this.handleEmailLogUpdate(campaignId, payload);
        }
      );

    await channel.subscribe();
    this.channels.set(channelKey, channel);
  }

  private async subscribeToEmailQueueUpdates(campaignId: UUID): Promise<void> {
    const channelKey = `email-queue-${campaignId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_queue',
          filter: `campaign_id=eq.${campaignId}`
        },
        async (payload) => {
          console.log(`📬 Email queue updated for campaign ${campaignId}:`, payload);
          await this.handleEmailQueueUpdate(campaignId, payload);
        }
      );

    await channel.subscribe();
    this.channels.set(channelKey, channel);
  }

  private startPeriodicStatsUpdate(campaignId: UUID): void {
    // Update stats every 30 seconds
    const interval = setInterval(async () => {
      if (this.monitoredCampaigns.has(campaignId)) {
        await this.refreshCampaignStats(campaignId);
      } else {
        clearInterval(interval);
        this.updateIntervals.delete(campaignId);
      }
    }, 30000);

    this.updateIntervals.set(campaignId, interval);
  }

  private async handleCampaignUpdate(campaignId: UUID, payload: any): Promise<void> {
    try {
      const newRecord = payload.new;
      const oldRecord = payload.old;

      // Check for status changes
      if (oldRecord?.status !== newRecord?.status) {
        console.log(`📊 Campaign ${campaignId} status changed: ${oldRecord?.status} → ${newRecord?.status}`);

        if (this.callbacks.onCampaignStatusChange) {
          this.callbacks.onCampaignStatusChange(campaignId, oldRecord?.status, newRecord?.status);
        }

        // Check if campaign completed
        if (newRecord?.status === 'completed') {
          await this.handleCampaignCompletion(campaignId);
        }
      }

      // Refresh stats after campaign update
      await this.refreshCampaignStats(campaignId);

    } catch (error) {
      console.error(`Error handling campaign update for ${campaignId}:`, error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }

  private async handleEmailLogUpdate(campaignId: UUID, payload: any): Promise<void> {
    try {
      const emailLog = payload.new as EmailLog;

      // Trigger appropriate callbacks based on email status
      switch (emailLog.status) {
        case 'sent':
          if (this.callbacks.onEmailSent) {
            this.callbacks.onEmailSent(campaignId, emailLog);
          }
          break;
        case 'delivered':
          if (this.callbacks.onEmailDelivered) {
            this.callbacks.onEmailDelivered(campaignId, emailLog);
          }
          break;
        case 'opened':
          if (this.callbacks.onEmailOpened) {
            this.callbacks.onEmailOpened(campaignId, emailLog);
          }
          break;
        case 'clicked':
          if (this.callbacks.onEmailClicked) {
            this.callbacks.onEmailClicked(campaignId, emailLog);
          }
          break;
        case 'bounced':
          if (this.callbacks.onEmailBounced) {
            this.callbacks.onEmailBounced(campaignId, emailLog);
          }
          break;
      }

      // Refresh stats after email log update
      await this.refreshCampaignStats(campaignId);

    } catch (error) {
      console.error(`Error handling email log update for ${campaignId}:`, error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }

  private async handleEmailQueueUpdate(campaignId: UUID, payload: any): Promise<void> {
    try {
      // Refresh stats when queue items are processed
      await this.refreshCampaignStats(campaignId);
    } catch (error) {
      console.error(`Error handling email queue update for ${campaignId}:`, error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }

  private async handleCampaignCompletion(campaignId: UUID): Promise<void> {
    try {
      // Calculate final comprehensive stats
      const { data: finalStats, error } = await supabase
        .rpc('get_enhanced_campaign_stats', { p_campaign_id: campaignId });

      if (error) throw error;

      if (finalStats && finalStats.length > 0 && this.callbacks.onCampaignCompleted) {
        this.callbacks.onCampaignCompleted(campaignId, finalStats[0]);
      }

      // Stop monitoring this campaign after a delay to capture final updates
      setTimeout(() => {
        this.stopCampaignMonitoring(campaignId);
      }, 60000); // Stop monitoring after 1 minute

    } catch (error) {
      console.error(`Error handling campaign completion for ${campaignId}:`, error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error as Error);
      }
    }
  }

  private async calculateRealTimeStats(campaignId: UUID): Promise<RealTimeStats> {
    try {
      // Get campaign info
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Get email counts from logs
      const { data: emailCounts, error: countsError } = await supabase
        .from('email_logs')
        .select('status')
        .eq('campaign_id', campaignId);

      if (countsError) throw countsError;

      // Get queue status
      const { data: queueCounts, error: queueError } = await supabase
        .from('email_queue')
        .select('status')
        .eq('campaign_id', campaignId);

      if (queueError) throw queueError;

      // Calculate counts
      const emailsSent = emailCounts?.filter(log => log.status === 'sent').length || 0;
      const emailsPending = queueCounts?.filter(q => q.status === 'pending').length || 0;
      const emailsFailed = queueCounts?.filter(q => q.status === 'failed').length || 0;

      // Calculate send rate (emails per minute) for the last 10 minutes
      const tenMinutesAgo = new Date();
      tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

      const { data: recentSends, error: recentSendsError } = await supabase
        .from('email_logs')
        .select('sent_at')
        .eq('campaign_id', campaignId)
        .eq('status', 'sent')
        .gte('sent_at', tenMinutesAgo.toISOString());

      if (recentSendsError) throw recentSendsError;

      const sendRatePerMinute = (recentSends?.length || 0) / 10;

      // Get last email sent time
      const { data: lastEmail, error: lastEmailError } = await supabase
        .from('email_logs')
        .select('sent_at')
        .eq('campaign_id', campaignId)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate estimated completion
      let estimatedCompletion: string | undefined;
      if (campaign.status === 'running' && sendRatePerMinute > 0) {
        const remaining = campaign.total_recipients - emailsSent;
        if (remaining > 0) {
          const minutesToComplete = remaining / sendRatePerMinute;
          const completionTime = new Date();
          completionTime.setMinutes(completionTime.getMinutes() + minutesToComplete);
          estimatedCompletion = completionTime.toISOString();
        }
      }

      return {
        campaign_id: campaignId,
        current_status: campaign.status,
        emails_sent: emailsSent,
        emails_pending: emailsPending,
        emails_failed: emailsFailed,
        send_rate_per_minute: sendRatePerMinute,
        last_email_sent_at: lastEmailError ? undefined : lastEmail?.sent_at,
        estimated_completion: estimatedCompletion
      };

    } catch (error) {
      console.error(`Error calculating real-time stats for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Get monitoring summary for all campaigns
   */
  getMonitoringSummary(): Array<{ campaignId: UUID; stats: RealTimeStats }> {
    return Array.from(this.campaignStats.entries()).map(([campaignId, stats]) => ({
      campaignId,
      stats
    }));
  }

  /**
   * Export monitoring data for analytics
   */
  exportMonitoringData(): {
    monitoredCampaigns: UUID[];
    totalCampaigns: number;
    campaignStats: Array<{ campaignId: UUID; stats: RealTimeStats }>;
    timestamp: string;
  } {
    return {
      monitoredCampaigns: Array.from(this.monitoredCampaigns),
      totalCampaigns: this.monitoredCampaigns.size,
      campaignStats: this.getMonitoringSummary(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start monitoring multiple campaigns at once
   */
  async startBulkMonitoring(campaignIds: UUID[]): Promise<{ success: UUID[]; failed: Array<{ campaignId: UUID; error: string }> }> {
    const results = {
      success: [] as UUID[],
      failed: [] as Array<{ campaignId: UUID; error: string }>
    };

    for (const campaignId of campaignIds) {
      try {
        await this.startCampaignMonitoring(campaignId);
        results.success.push(campaignId);
      } catch (error) {
        results.failed.push({
          campaignId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }
}
