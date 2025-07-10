import "dotenv/config";
import { EmailCampaignService } from "../src/services/email-campaign.service";
import { EmailQueueService } from "../src/services/email-queue.service";
import { RealtimeMonitorService } from "../src/services/realtime-monitor.service";

console.log("🔄 Starting Momentum Email System Real-time Monitoring Demo...");

const realtimeMonitor = new RealtimeMonitorService();
const emailService = new EmailCampaignService();
const queueService = new EmailQueueService();

async function demoRealtimeMonitoring() {
  console.log("\n=== 🚀 Real-time Monitoring Demo ===\n");

  try {
    // Set up event listeners
    console.log("📡 Setting up real-time event listeners...");

    // Campaign stats monitoring
    const unsubscribeCampaignStats = realtimeMonitor.subscribeToCampaignStats((stats) => {
      console.log(`\n📈 [REAL-TIME] Campaign Update: ${stats.campaignName || stats.campaignId}`);
      console.table({
        'Total Sent': stats.totalSent,
        'Delivered': stats.delivered,
        'Opened': stats.opened,
        'Clicked': stats.clicked,
        'Bounced': stats.bounced,
        'Failed': stats.failed,
        'Delivery Rate': stats.deliveryRate.toFixed(1) + '%',
        'Open Rate': stats.openRate.toFixed(1) + '%',
        'Click Rate': stats.clickRate.toFixed(1) + '%',
        'Status': stats.status,
        'Last Update': stats.lastUpdate.toLocaleTimeString()
      });

      if (stats.queueStatus) {
        console.log(`📦 Queue Status: Pending: ${stats.queueStatus.pending}, Processing: ${stats.queueStatus.processing}, Completed: ${stats.queueStatus.completed}`);
      }
    });

    // Queue monitoring
    const unsubscribeQueueUpdates = realtimeMonitor.subscribeToQueueUpdates((update) => {
      console.log(`\n⚡ [REAL-TIME] Queue Update for campaign ${update.campaignId}:`);
      console.log(`   Status: ${update.status}`);
      console.log(`   Total in Queue: ${update.totalInQueue}`);
      console.log(`   Processed: ${update.processed}`);
      if (update.scheduledFor) {
        console.log(`   Scheduled For: ${update.scheduledFor.toLocaleString()}`);
      }
    });

    // Template monitoring
    const unsubscribeTemplateUpdates = realtimeMonitor.subscribeToTemplateUpdates((update) => {
      console.log(`\n📝 [REAL-TIME] Template Update: ${update.templateName}`);
      console.log(`   Template ID: ${update.templateId}`);
      console.log(`   Last Modified: ${update.lastModified.toLocaleString()}`);
      if (update.updatedBy) {
        console.log(`   Updated By: ${update.updatedBy}`);
      }
    });

    // Start global monitoring
    console.log("🌐 Starting global real-time monitoring...");
    await realtimeMonitor.startGlobalMonitoring();

    // Get existing campaigns to monitor
    console.log("\n📊 Checking for existing campaigns...");
    const campaigns = await emailService.getEmailCampaigns();
    console.log(`Found ${campaigns.length} campaigns`);

    // Monitor existing campaigns
    if (campaigns.length > 0) {
      console.log("\n🔄 Starting monitoring for existing campaigns...");
      for (const campaign of campaigns.slice(0, 3)) { // Monitor first 3 campaigns
        await realtimeMonitor.startCampaignMonitoring(campaign.id);
        console.log(`✅ Monitoring campaign: ${campaign.name} (${campaign.id})`);

        // Show current real-time stats
        const stats = realtimeMonitor.getCampaignStats(campaign.id);
        if (stats) {
          console.log(`   Current Stats - Sent: ${stats.totalSent}, Delivered: ${stats.delivered}, Rate: ${stats.deliveryRate.toFixed(1)}%`);
        }
      }
    }

    // Create a test campaign for demonstration
    console.log("\n🧪 Creating test campaign for real-time demonstration...");
    const templates = await emailService.getEmailTemplates();

    if (templates.length > 0) {
      const template = templates[0];
      const testCampaign = await emailService.createEmailCampaign({
        template_id: template.id,
        name: `Real-time Demo Campaign - ${new Date().toLocaleTimeString()}`,
        status: "draft",
      });

      console.log(`✅ Created test campaign: ${testCampaign.name}`);

      // Start monitoring the new campaign
      await realtimeMonitor.startCampaignMonitoring(testCampaign.id);
      console.log("🔄 Started real-time monitoring for test campaign");

      // Start the campaign to generate events
      console.log("🚀 Starting campaign to generate real-time events...");
      const startResult = await queueService.startCampaign(testCampaign.id);

      if (startResult.success) {
        console.log("✅ Campaign started successfully");

        // Process some emails to generate real-time updates
        console.log("⚡ Processing emails to trigger real-time events...");
        await queueService.processEmailQueue(5);

        // Wait a bit for real-time events to propagate
        console.log("⏳ Waiting for real-time events (10 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Show final stats
        console.log("\n📊 Final campaign stats:");
        const finalStats = realtimeMonitor.getCampaignStats(testCampaign.id);
        if (finalStats) {
          console.table({
            'Campaign': finalStats.campaignName,
            'Status': finalStats.status,
            'Total Sent': finalStats.totalSent,
            'Delivered': finalStats.delivered,
            'Delivery Rate': finalStats.deliveryRate.toFixed(1) + '%',
            'Last Update': finalStats.lastUpdate.toLocaleString()
          });
        }

        // Stop monitoring this specific campaign
        await realtimeMonitor.stopCampaignMonitoring(testCampaign.id);
        console.log("🛑 Stopped monitoring test campaign");
      }
    }

    // Show all current stats
    console.log("\n📈 All current real-time campaign stats:");
    const allStats = realtimeMonitor.getAllCampaignStats();
    if (allStats.length > 0) {
      allStats.forEach((stats, index) => {
        console.log(`\n${index + 1}. ${stats.campaignName || stats.campaignId}:`);
        console.log(`   Status: ${stats.status}`);
        console.log(`   Sent: ${stats.totalSent}, Delivered: ${stats.delivered}`);
        console.log(`   Delivery Rate: ${stats.deliveryRate.toFixed(1)}%`);
        console.log(`   Open Rate: ${stats.openRate.toFixed(1)}%`);
        console.log(`   Last Update: ${stats.lastUpdate.toLocaleString()}`);
      });
    } else {
      console.log("   No campaigns currently being monitored");
    }

    // Keep monitoring for a while
    console.log("\n⏰ Keeping real-time monitoring active for 2 minutes...");
    console.log("💡 You can now:");
    console.log("   1. Run email campaigns in another terminal");
    console.log("   2. Update email templates");
    console.log("   3. Process email queues");
    console.log("   4. Update campaign statuses");
    console.log("   → All changes will appear here in real-time!");

    // Set up graceful shutdown
    let isShuttingDown = false;
    const gracefulShutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log('\n🛑 Gracefully shutting down real-time monitoring...');
      unsubscribeCampaignStats();
      unsubscribeQueueUpdates();
      unsubscribeTemplateUpdates();
      await realtimeMonitor.stopAllMonitoring();
      console.log('✅ Real-time monitoring stopped successfully');
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    // Keep running for 2 minutes, then auto-shutdown
    setTimeout(async () => {
      console.log('\n⏰ Demo time limit reached (2 minutes)');
      await gracefulShutdown();
    }, 120000); // 2 minutes

    // Keep the process alive
    await new Promise(() => {}); // Wait indefinitely

  } catch (error) {
    console.error("\n❌ Error in real-time monitoring demo:", error);
    process.exit(1);
  }
}

// Advanced feature demonstration
async function demoAdvancedFeatures() {
  console.log("\n=== 🔬 Advanced Features Demo ===\n");

  try {
    // Start monitoring
    await realtimeMonitor.startGlobalMonitoring();

    // Monitor template changes
    console.log("📝 Monitoring template changes...");
    const templates = await emailService.getEmailTemplates();
    if (templates.length > 0) {
      const template = templates[0];

      // Update template to trigger real-time event
      await emailService.updateEmailTemplate(template.id, {
        name: template.name + ` (Updated at ${new Date().toLocaleTimeString()})`,
        subject: template.subject + " [UPDATED]"
      });

      console.log("✅ Updated template to demonstrate real-time template monitoring");
    }

    // Monitor multiple campaigns simultaneously
    console.log("\n🔄 Testing simultaneous campaign monitoring...");
    const campaigns = await emailService.getEmailCampaigns();
    const monitoringPromises = campaigns.slice(0, 2).map(async (campaign) => {
      await realtimeMonitor.startCampaignMonitoring(campaign.id);
      console.log(`✅ Started monitoring: ${campaign.name}`);
    });

    await Promise.all(monitoringPromises);

    // Simulate webhook events
    console.log("\n🎣 Simulating webhook events for real-time updates...");
    // You can add webhook simulation here if needed

    console.log("\n✨ Advanced features demonstration complete!");

  } catch (error) {
    console.error("❌ Error in advanced features demo:", error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'basic';

  switch (mode) {
    case 'advanced':
      await demoAdvancedFeatures();
      break;
    case 'basic':
    default:
      await demoRealtimeMonitoring();
      break;
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

console.log("🎯 Starting demo in 3 seconds...");
setTimeout(() => {
  main().catch(console.error);
}, 3000);
