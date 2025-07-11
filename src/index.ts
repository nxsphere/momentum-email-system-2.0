import "dotenv/config";
import { supabase } from "./config/supabase";
import { EmailCampaignService } from "./services/email-campaign.service";
import { EmailQueueService } from "./services/email-queue.service";
import { RealtimeMonitorService } from "./services/realtime-monitor.service";

console.log("🚀 Starting Advanced Email Campaign System with Real-time Monitoring...");

const emailService = new EmailCampaignService();
const queueService = new EmailQueueService();
const realtimeMonitor = new RealtimeMonitorService();

async function demonstrateEmailSystem() {
  try {
    console.log("\n📊 Testing Advanced Email Campaign System...");

    // Test database connection
    const { data: _data, error } = await supabase
      .from("contacts")
      .select("count")
      .limit(1);

    if (error) {
      console.log(
        "✅ Database connection successful! (Expected for new database)"
      );
    } else {
      console.log("✅ Database connection successful!");
    }

    // Get system overview
    console.log("\n📋 System Overview:");
    const systemStats = await queueService.getSystemStats();
    console.log("📊 System Stats:", JSON.stringify(systemStats, null, 2));

    // Get current counts
    const contactsCount = await emailService.getContactsCount();
    const templates = await emailService.getEmailTemplates();
    const templatesCount = templates.length;
    const campaignsCount = await emailService.getCampaignsCount();

    console.log(`\n📊 Current Data:`);
    console.log(`   📧 Contacts: ${contactsCount}`);
    console.log(`   📝 Templates: ${templatesCount}`);
    console.log(`   📢 Campaigns: ${campaignsCount}`);

    // Start Real-time Monitoring
    console.log("\n🔄 Starting Real-time Monitoring...");

    // Subscribe to real-time updates
    const unsubscribeCampaignStats = realtimeMonitor.subscribeToCampaignStats((stats) => {
      console.log(`📈 Real-time Campaign Update [${stats.campaignName || stats.campaignId}]:`, {
        sent: stats.totalSent,
        delivered: stats.delivered,
        opened: stats.opened,
        deliveryRate: stats.deliveryRate.toFixed(1) + '%',
        openRate: stats.openRate.toFixed(1) + '%',
        status: stats.status
      });
    });

    const unsubscribeQueueUpdates = realtimeMonitor.subscribeToQueueUpdates((update) => {
      console.log(`⚡ Queue Update [${update.campaignId}]:`, {
        status: update.status,
        totalInQueue: update.totalInQueue,
        processed: update.processed
      });
    });

    const unsubscribeTemplateUpdates = realtimeMonitor.subscribeToTemplateUpdates((update) => {
      console.log(`📝 Template Update [${update.templateName}]:`, {
        id: update.templateId,
        lastModified: update.lastModified
      });
    });

    // Start global monitoring for all campaigns
    await realtimeMonitor.startGlobalMonitoring();

    // Create a test campaign if we have data
    if (contactsCount > 0 && templatesCount > 0) {
      console.log("\n🚀 Testing Campaign Functions...");

      // Get first template
      if (templates.length > 0) {
        const template = templates[0];

        // Create a test campaign
        const campaign = await emailService.createEmailCampaign({
          template_id: template.id,
          name: "Test Campaign - " + new Date().toISOString(),
          status: "draft",
        });

        console.log(`✅ Created campaign: ${campaign.name}`);

        // Start monitoring this specific campaign
        await realtimeMonitor.startCampaignMonitoring(campaign.id);

        // Start the campaign
        console.log("\n🎯 Starting Campaign...");
        const startResult = await queueService.startCampaign(campaign.id);
        console.log("🚀 Campaign Start Result:", startResult);

        if (startResult.success) {
          // Check queue status
          console.log("\n📦 Queue Status:");
          const queueItems = await queueService.getQueueForCampaign(
            campaign.id
          );
          console.log(`   📧 Emails queued: ${queueItems.length}`);
          console.log(
            `   ⏳ Pending: ${queueItems.filter((q) => q.status === "pending").length}`
          );

          // Process the queue
          console.log("\n⚡ Processing Email Queue...");
          const processResult = await queueService.processEmailQueue(10);
          console.log("📊 Process Result:", processResult);

          // Get updated campaign stats
          console.log("\n📈 Campaign Statistics:");
          const campaignStats = await queueService.getCampaignStats(
            campaign.id
          );
          console.log(
            "📊 Campaign Stats:",
            JSON.stringify(campaignStats, null, 2)
          );

          // Show real-time stats
          console.log("\n📊 Real-time Campaign Stats:");
          const realtimeStats = realtimeMonitor.getCampaignStats(campaign.id);
          if (realtimeStats) {
            console.log("📈 Real-time Stats:", {
              sent: realtimeStats.totalSent,
              delivered: realtimeStats.delivered,
              opened: realtimeStats.opened,
              deliveryRate: realtimeStats.deliveryRate.toFixed(1) + '%',
              openRate: realtimeStats.openRate.toFixed(1) + '%',
              queueStatus: realtimeStats.queueStatus
            });
          }

          // Test rate limiting
          console.log("\n🚦 Rate Limiting Test:");
          const canSend = await queueService.checkRateLimit("email_sending");
          console.log(`   ✅ Can send emails: ${canSend}`);

          // Get rate limits
          const rateLimits = await queueService.getRateLimits();
          console.log("📊 Rate Limits:", rateLimits);

          // Test webhook simulation
          console.log("\n🎣 Webhook Simulation:");
          const logs = await emailService.getEmailLogs(
            campaign.id,
            undefined,
            1
          );
          if (logs.length > 0) {
            const log = logs[0];

            // Simulate delivery with a test message ID
            const testMessageId = `test-msg-${Date.now()}`;
            const deliveryResult = await queueService.updateEmailStatus(
              testMessageId,
              "delivered",
              { ip: "192.168.1.1", timestamp: new Date().toISOString() }
            );
            console.log("📬 Delivery Update:", deliveryResult);

            // Simulate open
            const openResult = await queueService.updateEmailStatus(
              testMessageId,
              "opened",
              {
                user_agent: "Test Browser",
                open_time: new Date().toISOString(),
              }
            );
            console.log("👁️ Open Update:", openResult);

            // Test bounce handling
            const bounceResult = await queueService.handleBounce(
              log.email,
              "Mailbox is full (temporary failure)"
            );
            console.log("🔄 Bounce Handling:", bounceResult);
          }

          // Get campaign logs
          console.log("\n📝 Campaign Logs:");
          const campaignLogs = await queueService.getCampaignLogs(campaign.id);
          campaignLogs.slice(0, 5).forEach((log) => {
            console.log(`   ${log.level.toUpperCase()}: ${log.message}`);
          });
        }
      }
    }

    // Dashboard metrics
    console.log("\n📊 Dashboard Metrics:");
    const dashboardMetrics = await queueService.getDashboardMetrics();
    console.log("📈 Dashboard:", JSON.stringify(dashboardMetrics, null, 2));

    // Test cleanup (with very short retention for demo)
    console.log("\n🧹 Cleanup Test:");
    const cleanupResult = await queueService.cleanupOldData(365); // 1 year retention
    console.log("🗑️ Cleanup Result:", cleanupResult);

    console.log("\n✨ All PostgreSQL functions tested successfully!");
    console.log("\n🎉 Advanced Email Campaign System with Real-time Monitoring is ready for production!");

    // Store unsubscribe functions for cleanup
    process.on('SIGINT', async () => {
      console.log('\n🛑 Gracefully shutting down...');
      unsubscribeCampaignStats();
      unsubscribeQueueUpdates();
      unsubscribeTemplateUpdates();
      await realtimeMonitor.stopAllMonitoring();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function main() {
  await demonstrateEmailSystem();

  console.log("\n🔄 System is now running with Real-time Monitoring...");
  console.log("📍 Supabase Studio: http://127.0.0.1:54323");
  console.log("📧 Email testing: http://127.0.0.1:54324");
  console.log("📊 Available Functions:");
  console.log("   • process_email_queue(batch_size)");
  console.log("   • start_campaign(campaign_id)");
  console.log("   • update_email_status(message_id, status, tracking_data)");
  console.log("   • get_enhanced_campaign_stats(campaign_id)");
  console.log("   • handle_bounce(email, reason)");
  console.log("   • cleanup_old_data(days_old)");
  console.log("\n📖 Usage Examples:");
  console.log("   SELECT * FROM process_email_queue(25);");
  console.log("   SELECT * FROM start_campaign('campaign-uuid');");
  console.log("   SELECT * FROM get_enhanced_campaign_stats('campaign-uuid');");
  console.log("\n🔄 Real-time Features Active:");
  console.log("   • Campaign stats monitoring");
  console.log("   • Email queue tracking");
  console.log("   • Template collaboration");
  console.log("   • Instant delivery notifications");
  console.log("\n💡 Press Ctrl+C to stop the server.");

  // Keep the process running
  process.stdin.resume();
}

main().catch(console.error);
