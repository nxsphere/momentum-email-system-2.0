import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { CampaignStatus, EmailLogStatus } from "../types/email-system";

export interface RealTimeCampaignStats {
  campaignId: string;
  campaignName?: string;
  status: CampaignStatus;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  lastUpdate: Date;
  queueStatus?: {
    pending: number;
    processing: number;
    completed: number;
  };
}

export interface RealTimeQueueUpdate {
  campaignId: string;
  status: string;
  totalInQueue: number;
  processed: number;
  scheduledFor?: Date;
}

export interface RealTimeTemplateUpdate {
  templateId: string;
  templateName: string;
  updatedBy?: string;
  lastModified: Date;
}

type CampaignStatsCallback = (stats: RealTimeCampaignStats) => void;
type QueueUpdateCallback = (update: RealTimeQueueUpdate) => void;
type TemplateUpdateCallback = (update: RealTimeTemplateUpdate) => void;

export class RealtimeMonitorService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private campaignStats: Map<string, RealTimeCampaignStats> = new Map();

  // Event subscribers
  private campaignSubscribers = new Set<CampaignStatsCallback>();
  private queueSubscribers = new Set<QueueUpdateCallback>();
  private templateSubscribers = new Set<TemplateUpdateCallback>();

  /**
   * Start monitoring a specific campaign for real-time updates
   */
  async startCampaignMonitoring(campaignId: string): Promise<void> {
    console.log(`🔄 Starting real-time monitoring for campaign: ${campaignId}`);

    // Create unique channel for this campaign
    const channelName = `campaign-monitor-${campaignId}`;

    if (this.channels.has(channelName)) {
      console.log(`⚠️ Already monitoring campaign ${campaignId}`);
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_logs',
        filter: `campaign_id=eq.${campaignId}`
      }, (payload) => {
        this.handleEmailLogUpdate(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_queue',
        filter: `campaign_id=eq.${campaignId}`
      }, (payload) => {
        this.handleQueueUpdate(payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'email_campaigns',
        filter: `id=eq.${campaignId}`
      }, (payload) => {
        this.handleCampaignUpdate(payload);
      })
      .subscribe();

    this.channels.set(channelName, channel);

    // Initialize campaign stats from database
    await this.initializeCampaignStats(campaignId);
  }

  /**
   * Start monitoring all active campaigns
   */
  async startGlobalMonitoring(): Promise<void> {
    console.log('🌐 Starting global real-time monitoring...');

    const globalChannel = supabase
      .channel('global-email-monitor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_logs'
      }, (payload) => {
        this.handleEmailLogUpdate(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_queue'
      }, (payload) => {
        this.handleQueueUpdate(payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_campaigns'
      }, (payload) => {
        this.handleCampaignUpdate(payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'email_templates'
      }, (payload) => {
        this.handleTemplateUpdate(payload);
      })
      .subscribe();

    this.channels.set('global', globalChannel);

    // Initialize stats for all active campaigns
    await this.initializeAllActiveCampaigns();
  }

  /**
   * Stop monitoring a specific campaign
   */
  async stopCampaignMonitoring(campaignId: string): Promise<void> {
    const channelName = `campaign-monitor-${campaignId}`;
    const channel = this.channels.get(channelName);

    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
      this.campaignStats.delete(campaignId);
      console.log(`🛑 Stopped monitoring campaign: ${campaignId}`);
    }
  }

  /**
   * Stop all monitoring
   */
  async stopAllMonitoring(): Promise<void> {
    console.log('🛑 Stopping all real-time monitoring...');

    for (const [name, channel] of this.channels) {
      await channel.unsubscribe();
      console.log(`🛑 Unsubscribed from channel: ${name}`);
    }

    this.channels.clear();
    this.campaignStats.clear();
  }

  /**
   * Subscribe to campaign stats updates
   */
  subscribeToCampaignStats(callback: CampaignStatsCallback): () => void {
    this.campaignSubscribers.add(callback);
    return () => this.campaignSubscribers.delete(callback);
  }

  /**
   * Subscribe to queue updates
   */
  subscribeToQueueUpdates(callback: QueueUpdateCallback): () => void {
    this.queueSubscribers.add(callback);
    return () => this.queueSubscribers.delete(callback);
  }

  /**
   * Subscribe to template updates
   */
  subscribeToTemplateUpdates(callback: TemplateUpdateCallback): () => void {
    this.templateSubscribers.add(callback);
    return () => this.templateSubscribers.delete(callback);
  }

  /**
   * Get current stats for a campaign
   */
  getCampaignStats(campaignId: string): RealTimeCampaignStats | undefined {
    return this.campaignStats.get(campaignId);
  }

  /**
   * Get all current campaign stats
   */
  getAllCampaignStats(): RealTimeCampaignStats[] {
    return Array.from(this.campaignStats.values());
  }

  /**
   * Initialize campaign stats from database
   */
  private async initializeCampaignStats(campaignId: string): Promise<void> {
    try {
      // Get campaign details
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('name, status')
        .eq('id', campaignId)
        .single();

      // Get current email logs for this campaign
      const { data: logs } = await supabase
        .from('email_logs')
        .select('status')
        .eq('campaign_id', campaignId);

      // Get queue status
      const { data: queueItems } = await supabase
        .from('email_queue')
        .select('status')
        .eq('campaign_id', campaignId);

      const stats: RealTimeCampaignStats = {
        campaignId,
        campaignName: campaign?.name,
        status: campaign?.status || 'draft',
        totalSent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        lastUpdate: new Date(),
        queueStatus: {
          pending: 0,
          processing: 0,
          completed: 0
        }
      };

      // Calculate stats from logs
      logs?.forEach(log => {
        stats.totalSent++;
        switch (log.status) {
          case 'delivered': stats.delivered++; break;
          case 'opened': stats.opened++; break;
          case 'clicked': stats.clicked++; break;
          case 'bounced': stats.bounced++; break;
          case 'failed': stats.failed++; break;
        }
      });

      // Calculate queue status
      queueItems?.forEach(item => {
        switch (item.status) {
          case 'pending': stats.queueStatus!.pending++; break;
          case 'processing': stats.queueStatus!.processing++; break;
          case 'sent': stats.queueStatus!.completed++; break;
        }
      });

      // Calculate rates
      stats.deliveryRate = stats.totalSent > 0 ? (stats.delivered / stats.totalSent) * 100 : 0;
      stats.openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0;
      stats.clickRate = stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0;

      this.campaignStats.set(campaignId, stats);
      this.notifyCampaignSubscribers(stats);

    } catch (error) {
      console.error(`Error initializing stats for campaign ${campaignId}:`, error);
    }
  }

  /**
   * Initialize stats for all active campaigns
   */
  private async initializeAllActiveCampaigns(): Promise<void> {
    try {
      const { data: campaigns } = await supabase
        .from('email_campaigns')
        .select('id')
        .in('status', ['running', 'scheduled']);

      if (campaigns) {
        for (const campaign of campaigns) {
          await this.initializeCampaignStats(campaign.id);
        }
      }
    } catch (error) {
      console.error('Error initializing all campaign stats:', error);
    }
  }

  /**
   * Handle email log updates from realtime
   */
  private handleEmailLogUpdate(payload: any): void {
    const log = payload.new;
    const campaignId = log.campaign_id;

    let stats = this.campaignStats.get(campaignId);
    if (!stats) {
      // Initialize if we don't have stats yet
      this.initializeCampaignStats(campaignId);
      return;
    }

    // Update stats based on the change
    if (payload.eventType === 'INSERT') {
      stats.totalSent++;
    }

    // Update status counters (handle both INSERT and UPDATE)
    switch (log.status as EmailLogStatus) {
      case 'delivered':
        if (payload.eventType === 'INSERT') stats.delivered++;
        break;
      case 'opened':
        if (payload.eventType === 'INSERT') stats.opened++;
        break;
      case 'clicked':
        if (payload.eventType === 'INSERT') stats.clicked++;
        break;
      case 'bounced':
        if (payload.eventType === 'INSERT') stats.bounced++;
        break;
      case 'failed':
        if (payload.eventType === 'INSERT') stats.failed++;
        break;
    }

    // Recalculate rates
    stats.deliveryRate = stats.totalSent > 0 ? (stats.delivered / stats.totalSent) * 100 : 0;
    stats.openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0;
    stats.clickRate = stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0;
    stats.lastUpdate = new Date();

    this.campaignStats.set(campaignId, stats);
    this.notifyCampaignSubscribers(stats);

    console.log(`📊 Campaign ${campaignId} updated:`, {
      sent: stats.totalSent,
      delivered: stats.delivered,
      deliveryRate: stats.deliveryRate.toFixed(1) + '%'
    });
  }

  /**
   * Handle queue updates from realtime
   */
  private handleQueueUpdate(payload: any): void {
    const queueItem = payload.new;
    const campaignId = queueItem.campaign_id;

    const update: RealTimeQueueUpdate = {
      campaignId,
      status: queueItem.status,
      totalInQueue: 0, // Will be calculated
      processed: 0,    // Will be calculated
      scheduledFor: queueItem.scheduled_for ? new Date(queueItem.scheduled_for) : undefined
    };

    this.notifyQueueSubscribers(update);

    // Update campaign stats if we're tracking this campaign
    const stats = this.campaignStats.get(campaignId);
    if (stats && stats.queueStatus) {
      // Recalculate queue status from database for accuracy
      this.updateQueueStatusForCampaign(campaignId);
    }

    console.log(`⚡ Queue update for campaign ${campaignId}:`, {
      status: queueItem.status,
      scheduled: queueItem.scheduled_for
    });
  }

  /**
   * Handle campaign updates from realtime
   */
  private handleCampaignUpdate(payload: any): void {
    const campaign = payload.new;
    const campaignId = campaign.id;

    const stats = this.campaignStats.get(campaignId);
    if (stats) {
      stats.status = campaign.status;
      stats.campaignName = campaign.name;
      stats.lastUpdate = new Date();

      this.campaignStats.set(campaignId, stats);
      this.notifyCampaignSubscribers(stats);
    }

    console.log(`📢 Campaign ${campaignId} updated:`, {
      status: campaign.status,
      name: campaign.name
    });
  }

  /**
   * Handle template updates from realtime
   */
  private handleTemplateUpdate(payload: any): void {
    const template = payload.new;

    const update: RealTimeTemplateUpdate = {
      templateId: template.id,
      templateName: template.name,
      lastModified: new Date(template.updated_at)
    };

    this.notifyTemplateSubscribers(update);

    console.log(`📝 Template updated:`, {
      id: template.id,
      name: template.name
    });
  }

  /**
   * Update queue status for a specific campaign
   */
  private async updateQueueStatusForCampaign(campaignId: string): Promise<void> {
    try {
      const { data: queueItems } = await supabase
        .from('email_queue')
        .select('status')
        .eq('campaign_id', campaignId);

      const stats = this.campaignStats.get(campaignId);
      if (stats && queueItems) {
        stats.queueStatus = {
          pending: queueItems.filter(item => item.status === 'pending').length,
          processing: queueItems.filter(item => item.status === 'processing').length,
          completed: queueItems.filter(item => item.status === 'sent').length
        };

        this.campaignStats.set(campaignId, stats);
        this.notifyCampaignSubscribers(stats);
      }
    } catch (error) {
      console.error(`Error updating queue status for campaign ${campaignId}:`, error);
    }
  }

  /**
   * Notify campaign subscribers
   */
  private notifyCampaignSubscribers(stats: RealTimeCampaignStats): void {
    this.campaignSubscribers.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in campaign stats callback:', error);
      }
    });
  }

  /**
   * Notify queue subscribers
   */
  private notifyQueueSubscribers(update: RealTimeQueueUpdate): void {
    this.queueSubscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in queue update callback:', error);
      }
    });
  }

  /**
   * Notify template subscribers
   */
  private notifyTemplateSubscribers(update: RealTimeTemplateUpdate): void {
    this.templateSubscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in template update callback:', error);
      }
    });
  }
}
