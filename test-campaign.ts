import "dotenv/config";
import { CampaignManagementService } from "./src/services/campaign-management.service";
import { EmailCampaignService } from "./src/services/email-campaign.service";
import { EmailQueueService } from "./src/services/email-queue.service";

/**
 * Simple Email Campaign Testing Script
 *
 * This script will help you test the email campaign system step by step
 */

async function testEmailCampaign() {
  console.log("🚀 Testing Email Campaign System");
  console.log("=================================\n");

  try {
    // Initialize services
    const campaignManager = new CampaignManagementService();
    const emailService = new EmailCampaignService();
    const queueService = new EmailQueueService();

    // Step 1: Check current system status
    console.log("📊 Step 1: Checking System Status");
    console.log("----------------------------------");

    const contactsCount = await emailService.getContactsCount();
    const templates = await emailService.getEmailTemplates();
    const campaigns = await emailService.getEmailCampaigns();

    console.log(`✅ Contacts: ${contactsCount}`);
    console.log(`✅ Templates: ${templates.length}`);
    console.log(`✅ Existing Campaigns: ${campaigns.length}\n`);

    // Step 2: Create or use existing template
    console.log("📝 Step 2: Setting Up Email Template");
    console.log("------------------------------------");

    let template;
    if (templates.length > 0) {
      template = templates[0];
      console.log(`✅ Using existing template: "${template.name}"`);
    } else {
      // Create a new template
      template = await emailService.createEmailTemplate({
        name: "Test Campaign Template",
        subject: "Welcome to Momentum Business Capital! 🎉",
        html_content: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #2563eb;">Welcome {{first_name}}!</h1>
                <p>Thank you for your interest in Momentum Business Capital.</p>
                <p>We're here to help your business grow with:</p>
                <ul>
                  <li>Fast funding solutions</li>
                  <li>Competitive rates</li>
                  <li>Expert support</li>
                </ul>
                <p>Best regards,<br>The Momentum Team</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666;">
                  Momentum Business Capital<br>
                  funding@momentumbusiness.capital
                </p>
              </div>
            </body>
          </html>
        `,
        text_content: "Welcome {{first_name}}! Thank you for your interest in Momentum Business Capital. We're here to help your business grow with fast funding solutions, competitive rates, and expert support. Best regards, The Momentum Team",
        variables: { first_name: "Valued Customer" }
      });
      console.log(`✅ Created new template: "${template.name}"`);
    }
    console.log();

    // Step 3: Create test contacts if needed
    console.log("👥 Step 3: Setting Up Test Contacts");
    console.log("----------------------------------");

    const testEmails = ["test@example.com", "demo@example.com"];

    for (const email of testEmails) {
      try {
        await emailService.createContact({
          email: email,
          first_name: "Test",
          last_name: "User",
          status: "active"
        });
        console.log(`✅ Created contact: ${email}`);
      } catch (error) {
        // Contact might already exist
        console.log(`ℹ️  Contact may already exist: ${email}`);
      }
    }
    console.log();

    // Step 4: Create a contact list
    console.log("📋 Step 4: Creating Contact List");
    console.log("--------------------------------");

    const contactList = await campaignManager.createContactList({
      name: "Test Campaign List",
      description: "Contact list for testing email campaigns",
      type: "manual"
    });
    console.log(`✅ Created contact list: "${contactList.name}"`);

    // Add contacts to the list
    const addResult = await campaignManager.addContactsToList(contactList.id, testEmails);
    console.log(`✅ Added contacts: ${addResult.added_count} added, ${addResult.skipped_count} skipped\n`);

    // Step 5: Create campaign
    console.log("📧 Step 5: Creating Email Campaign");
    console.log("----------------------------------");

    const campaign = await campaignManager.createCampaign(
      template.id,
      contactList.id,
      undefined, // Send immediately (no scheduling)
      {
        name: `Test Campaign - ${new Date().toLocaleDateString()}`,
        subject: "Welcome to Momentum Business Capital! 🎉",
        priority: 1
      }
    );

    console.log(`✅ Created campaign: "${campaign.name}"`);
    console.log(`   📊 Recipients: ${campaign.total_recipients}`);
    console.log(`   🎯 Status: ${campaign.status}`);
    console.log(`   📧 From: ${campaign.from_email} (${campaign.from_name})\n`);

    // Step 6: Start the campaign
    console.log("🚀 Step 6: Starting Campaign");
    console.log("----------------------------");

    const startResult = await queueService.startCampaign(campaign.id);
    console.log(`✅ Campaign start result: ${startResult.message}`);
    if (startResult.success) {
      console.log(`   📦 Emails queued: ${startResult.queued_emails}`);
    }
    console.log();

    // Step 7: Check queue status
    console.log("📦 Step 7: Checking Email Queue");
    console.log("-------------------------------");

    const queueItems = await queueService.getQueueForCampaign(campaign.id);
    console.log(`📧 Total emails in queue: ${queueItems.length}`);
    console.log(`⏳ Pending: ${queueItems.filter(q => q.status === 'pending').length}`);
    console.log(`✅ Sent: ${queueItems.filter(q => q.status === 'sent').length}`);
    console.log(`❌ Failed: ${queueItems.filter(q => q.status === 'failed').length}\n`);

    // Step 8: Process the email queue
    console.log("⚡ Step 8: Processing Email Queue");
    console.log("--------------------------------");

    const processResult = await queueService.processEmailQueue(5);
    console.log(`✅ Processing completed`);
    console.log(`   📧 Processed: ${processResult.processed_count}`);
    console.log(`   ❌ Failed: ${processResult.failed_count}`);
    console.log(`   ⏳ Remaining: ${processResult.remaining_count}\n`);

    // Step 9: Get campaign statistics
    console.log("📊 Step 9: Campaign Statistics");
    console.log("------------------------------");

    const campaignStats = await campaignManager.getCampaignStatus(campaign.id);
    console.log("📈 Campaign Performance:");
    console.log(`   📧 Total Sent: ${campaignStats.total_sent}`);
    console.log(`   📬 Delivered: ${campaignStats.total_delivered}`);
    console.log(`   👀 Opened: ${campaignStats.total_opened}`);
    console.log(`   🔗 Clicked: ${campaignStats.total_clicked}`);
    console.log(`   📉 Bounced: ${campaignStats.total_bounced}`);
    console.log(`   📊 Delivery Rate: ${campaignStats.delivery_rate?.toFixed(1)}%`);
    console.log(`   👁️  Open Rate: ${campaignStats.open_rate?.toFixed(1)}%`);
    console.log(`   🖱️  Click Rate: ${campaignStats.click_rate?.toFixed(1)}%\n`);

    // Step 10: Summary
    console.log("🎉 Step 10: Test Complete!");
    console.log("==========================");
    console.log("✅ Campaign created successfully");
    console.log("✅ Emails queued and processed");
    console.log("✅ Statistics retrieved");
    console.log("\n💡 Next Steps:");
    console.log("   • Check your email inbox (if using real email addresses)");
    console.log("   • Monitor campaign performance in real-time");
    console.log("   • Try running the full demo: `npm run dev`");
    console.log("   • Explore advanced features in the examples/ folder");

    return {
      campaign,
      stats: campaignStats,
      success: true
    };

  } catch (error) {
    console.error("\n❌ Campaign test failed:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("   • Check your environment variables are set correctly");
    console.log("   • Ensure Supabase connection is working");
    console.log("   • Verify Mailtrap API credentials (if sending real emails)");
    console.log("   • Check the logs for more detailed error information");

    throw error;
  }
}

// Export for use in other scripts
export { testEmailCampaign };

// Run if executed directly
if (require.main === module) {
  testEmailCampaign()
    .then(() => {
      console.log("\n🎊 Test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Test failed:", error);
      process.exit(1);
    });
}
