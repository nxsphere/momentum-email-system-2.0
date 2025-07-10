import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface CampaignStats {
  campaignId: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  lastUpdate: Date;
}

class RealTimeCampaignMonitor {
  private stats = new Map<string, CampaignStats>();
  private subscribers = new Set<(stats: CampaignStats) => void>();

  async startMonitoring(campaignId: string) {
    console.log(`🔄 Starting real-time monitoring for campaign: ${campaignId}`);

    // Listen to email_logs changes for this campaign
    const channel = supabase
      .channel(`campaign-${campaignId}`)
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
      .subscribe();

    // Initialize stats from database
    await this.initializeCampaignStats(campaignId);

    return channel;
  }

  private async initializeCampaignStats(campaignId: string) {
    // Get current campaign stats from database
    const { data: logs } = await supabase
      .from('email_logs')
      .select('status')
      .eq('campaign_id', campaignId);

    const stats: CampaignStats = {
      campaignId,
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
      lastUpdate: new Date()
    };

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

    this.stats.set(campaignId, stats);
    this.notifySubscribers(stats);
  }

  private handleEmailLogUpdate(payload: any) {
    const log = payload.new;
    const campaignId = log.campaign_id;

    let stats = this.stats.get(campaignId);
    if (!stats) return;

    // Update stats based on the change
    if (payload.eventType === 'INSERT') {
      stats.totalSent++;
    }

    // Update status counters
    switch (log.status) {
      case 'delivered': stats.delivered++; break;
      case 'opened': stats.opened++; break;
      case 'clicked': stats.clicked++; break;
      case 'bounced': stats.bounced++; break;
      case 'failed': stats.failed++; break;
    }

    stats.lastUpdate = new Date();
    this.stats.set(campaignId, stats);
    this.notifySubscribers(stats);

    console.log(`📊 Campaign ${campaignId} updated:`, {
      sent: stats.totalSent,
      delivered: stats.delivered,
      deliveryRate: (stats.delivered / stats.totalSent * 100).toFixed(1) + '%'
    });
  }

  private handleQueueUpdate(payload: any) {
    const queueItem = payload.new;
    console.log(`⚡ Queue update for campaign ${queueItem.campaign_id}:`, {
      status: queueItem.status,
      scheduled: queueItem.scheduled_for
    });
  }

  subscribe(callback: (stats: CampaignStats) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(stats: CampaignStats) {
    this.subscribers.forEach(callback => callback(stats));
  }

  getCampaignStats(campaignId: string): CampaignStats | undefined {
    return this.stats.get(campaignId);
  }

  getAllStats(): CampaignStats[] {
    return Array.from(this.stats.values());
  }
}

// Example usage
async function demonstrateRealTimeMonitoring() {
  const monitor = new RealTimeCampaignMonitor();

  // Subscribe to stats updates
  const unsubscribe = monitor.subscribe((stats) => {
    console.log(`📈 Real-time stats for ${stats.campaignId}:`, {
      sent: stats.totalSent,
      delivered: stats.delivered,
      opened: stats.opened,
      deliveryRate: stats.totalSent > 0 ?
        (stats.delivered / stats.totalSent * 100).toFixed(1) + '%' : '0%',
      openRate: stats.delivered > 0 ?
        (stats.opened / stats.delivered * 100).toFixed(1) + '%' : '0%'
    });
  });

  // Start monitoring a campaign (replace with actual campaign ID)
  const campaignId = 'your-campaign-id';
  const channel = await monitor.startMonitoring(campaignId);

  console.log('🎯 Real-time monitoring active. Watching for email events...');
  console.log('💡 Send some emails in your campaign to see real-time updates!');

  // Keep running for demonstration
  setTimeout(() => {
    console.log('🛑 Stopping real-time monitoring...');
    channel.unsubscribe();
    unsubscribe();
  }, 60000); // Stop after 1 minute
}

// Run the demo
if (require.main === module) {
  demonstrateRealTimeMonitoring().catch(console.error);
}

export { CampaignStats, RealTimeCampaignMonitor };
