import { CampaignManagementService } from "../src/services/campaign-management.service";
import { EmailCampaignService } from "../src/services/email-campaign.service";
import { RealtimeCampaignMonitorService } from "../src/services/realtime-campaign-monitor.service";

/**
 * Comprehensive Campaign Management System Demo
 *
 * This example demonstrates all the features of the new campaign management system:
 * 1. Creating campaigns with validation
 * 2. Pausing and resuming campaigns
 * 3. Real-time campaign monitoring
 * 4. Duplicating successful campaigns
 * 5. Contact list and segment management
 */

async function demonstrateCampaignManagement() {
  console.log("🚀 Campaign Management System Demo\n");

  // Initialize services
  const campaignManager = new CampaignManagementService();
  const campaignService = new EmailCampaignService();

  // Initialize real-time monitoring with callbacks
  const realtimeMonitor = new RealtimeCampaignMonitorService({
    onCampaignStatusChange: (campaignId, oldStatus, newStatus) => {
      console.log(`📊 Campaign ${campaignId}: ${oldStatus} → ${newStatus}`);
    },
    onEmailSent: (campaignId, emailLog) => {
      console.log(`📧 Email sent for campaign ${campaignId} to ${emailLog.email}`);
    },
    onCampaignProgress: (campaignId, stats) => {
      console.log(`📈 Campaign ${campaignId} progress: ${stats.emails_sent}/${stats.emails_sent + stats.emails_pending} sent`);
    },
    onCampaignCompleted: (campaignId, finalStats) => {
      console.log(`✅ Campaign ${campaignId} completed! Final stats:`, finalStats);
    },
    onError: (error) => {
      console.error("❌ Monitoring error:", error.message);
    }
  });

  try {
    // ==================== 1. CONTACT LIST MANAGEMENT ====================
    console.log("1️⃣ Creating Contact Lists and Segments\n");

    // Create a contact list
    const contactList = await campaignManager.createContactList({
      name: "VIP Customers",
      description: "High-value customers for premium campaigns",
      type: "manual"
    });
    console.log("✅ Created contact list:", contactList.name);

    // Add contacts to the list
    const contactEmails = [
      "john.doe@example.com",
      "jane.smith@example.com",
      "test@example.com"
    ];

    const addResult = await campaignManager.addContactsToList(contactList.id, contactEmails);
    console.log(`✅ Added contacts to list: ${addResult.added_count} added, ${addResult.skipped_count} skipped, ${addResult.not_found_count} not found\n`);

    // Create a dynamic segment
    const segment = await campaignManager.createSegment({
      name: "Recent Signups",
      description: "Contacts who signed up in the last 30 days",
      type: "dynamic",
      filter_criteria: {
        created_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata_filter: { source: "website" }
      }
    });
    console.log("✅ Created dynamic segment:", segment.name);

    // Calculate segment membership
    const segmentResult = await campaignManager.calculateSegmentMembership(segment.id);
    console.log(`✅ Calculated segment: ${segmentResult.contacts_added} contacts added in ${segmentResult.calculation_time}ms\n`);

    // ==================== 2. CREATE TEMPLATE ====================
    console.log("2️⃣ Creating Email Template\n");

    const template = await campaignService.createEmailTemplate({
      name: "Momentum Capital Funding Offer",
      subject: "Get Fast Business Capital with Momentum",
      html_content: `<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Fast Business Capital | Momentum</title>
  <style type=\"text/css\">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #fafbfc; }
    .container { max-width: 600px; margin: 0 auto; }
    * { box-sizing: border-box; }
    table { max-width: 100%; }
    img { max-width: 100%; height: auto; }
    .cta-modern {
      background: rgb(84, 182, 78);
      color: #ffffff !important;
      padding: 16px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      display: inline-block;
      text-align: center;
      transition: all 0.3s ease;
      border: 2px solid rgb(84, 182, 78);
      margin: 0 auto;
    }
    .stat-item {
      text-align: center;
      padding: 20px 15px;
    }
    .stat-number {
      font-size: 32px;
      font-weight: 800;
      color: #1a1a1a;
      line-height: 1;
      margin: 0;
    }
    .stat-label {
      font-size: 12px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 5px 0 0 0;
    }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      h1 {
        font-size: 32px !important;
        line-height: 38px !important;
        margin-bottom: 20px !important;
      }
      .cta-modern {
        display: block !important;
        width: 100% !important;
        max-width: 320px !important;
        margin: 15px auto !important;
        padding: 18px 24px !important;
        font-size: 18px !important;
      }
    }
  </style>
</head>
<body>
  <table width=\"100%\" bgcolor=\"#fafbfc\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" role=\"presentation\">
    <tr>
      <td align=\"center\" class=\"mobile-padding\" style=\"padding: 40px 20px;\">
        <table class=\"container\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#ffffff\" style=\"border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);\">
          <tr>
            <td class=\"mobile-padding\" style=\"padding: 30px 40px 20px 40px; border-bottom: 1px solid #f1f5f9; text-align: center;\">
              <a href=\"https://momentumbusinesscapital.com\" target=\"_blank\">
                <img src=\"https://momentumbusinesscapital.com/assets/logo.png\" alt=\"Momentum Business Capital\" width=\"180\" style=\"margin-bottom: 10px;\" />
              </a>
            </td>
          </tr>
          <tr>
            <td class=\"mobile-padding\" style=\"padding: 40px 40px 30px 40px; text-align: center;\">
              <h1 style=\"font-size: 40px; color: #22223b; margin: 0 0 18px 0; font-weight: 800;\">Get Fast Business Capital</h1>
              <p style=\"font-size: 18px; color: #374151; margin: 0 0 28px 0;\">Unlock funding for your business in as little as 24 hours. Flexible terms. No hidden fees. Trusted by thousands of business owners.</p>
              <a href=\"https://momentumbusinesscapital.com/apply\" class=\"cta-modern\">Apply Now</a>
            </td>
          </tr>
          <tr>
            <td style=\"padding: 0 40px 40px 40px;\">
              <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
                <tr>
                  <td class=\"stat-item\">
                    <div class=\"stat-number\">$500M+</div>
                    <div class=\"stat-label\">Funded</div>
                  </td>
                  <td class=\"stat-item\">
                    <div class=\"stat-number\">24hr</div>
                    <div class=\"stat-label\">Approvals</div>
                  </td>
                  <td class=\"stat-item\">
                    <div class=\"stat-number\">4.9/5</div>
                    <div class=\"stat-label\">Trustpilot</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style=\"padding: 0 40px 40px 40px; text-align: center; color: #6b7280; font-size: 13px;\">
              <p style=\"margin: 0;\">Questions? <a href=\"mailto:support@momentumbusinesscapital.com\" style=\"color: #2563eb; text-decoration: underline;\">Contact our team</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text_content: "Get Fast Business Capital with Momentum. Unlock funding for your business in as little as 24 hours. Apply now at https://momentumbusinesscapital.com/apply",
      variables: { business_name: "Momentum Business Capital" }
    });
    console.log("✅ Created email template:", template.name, "\n");

    // ==================== 3. CREATE CAMPAIGN WITH VALIDATION ====================
    console.log("3️⃣ Creating Campaign with Validation\n");

    // Schedule campaign for 5 minutes from now
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const campaign = await campaignManager.createCampaign(
      template.id,
      contactList.id, // Use contact list as recipient source
      scheduledAt,
      {
        name: "VIP Welcome Campaign",
        subject: "Welcome to Momentum - Your Business Growth Partner 🚀",
        priority: 1,
        from_name: "Momentum Business Capital Team"
      }
    );

    console.log("✅ Created campaign:", campaign.name);
    console.log(`   📅 Scheduled for: ${scheduledAt}`);
    console.log(`   📊 Recipients: ${campaign.total_recipients}`);
    console.log(`   🎯 Status: ${campaign.status}\n`);

    // ==================== 4. START REAL-TIME MONITORING ====================
    console.log("4️⃣ Starting Real-time Monitoring\n");

    await realtimeMonitor.startCampaignMonitoring(campaign.id);
    console.log("✅ Started real-time monitoring for campaign\n");

    // ==================== 5. GET CAMPAIGN STATUS ====================
    console.log("5️⃣ Getting Campaign Status with Real-time Stats\n");

    const campaignStatus = await campaignManager.getCampaignStatus(campaign.id);
    console.log("📊 Campaign Status:");
    console.log(`   Status: ${campaignStatus.campaign_status}`);
    console.log(`   Progress: ${campaignStatus.progress_percentage}%`);
    console.log(`   Emails Sent: ${campaignStatus.emails_sent}`);
    console.log(`   Emails Pending: ${campaignStatus.emails_pending}`);
    console.log(`   Send Rate: ${campaignStatus.send_rate_per_minute} emails/min`);
    if (campaignStatus.estimated_completion) {
      console.log(`   Estimated Completion: ${new Date(campaignStatus.estimated_completion).toLocaleString()}`);
    }
    console.log();

    // ==================== 6. SIMULATE CAMPAIGN RUNNING ====================
    console.log("6️⃣ Simulating Campaign Execution\n");

    // For demo purposes, let's manually start the campaign (normally would be handled by scheduler)
    if (campaign.status === 'scheduled') {
      // Update campaign to running status for demo
      await campaignService.updateCampaignStatus(campaign.id, 'running');
      console.log("✅ Campaign started (simulated)\n");
    }

    // ==================== 7. PAUSE AND RESUME CAMPAIGN ====================
    console.log("7️⃣ Testing Pause and Resume Functionality\n");

    // Pause campaign
    const pauseResult = await campaignManager.pauseCampaign(campaign.id, "Testing pause functionality");
    console.log("⏸️ Pause Result:", pauseResult.message);
    console.log(`   Emails Paused: ${pauseResult.emails_paused}\n`);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Resume campaign
    const resumeResult = await campaignManager.resumeCampaign(campaign.id);
    console.log("▶️ Resume Result:", resumeResult.message);
    console.log(`   Emails Resumed: ${resumeResult.emails_resumed}\n`);

    // ==================== 8. DUPLICATE CAMPAIGN ====================
    console.log("8️⃣ Duplicating Successful Campaign\n");

    const duplicateResult = await campaignManager.duplicateCampaign(
      campaign.id,
      "VIP Welcome Campaign - Copy"
    );

    console.log("📋 Duplicate Result:", duplicateResult.message);
    console.log(`   Original Campaign: ${duplicateResult.original_campaign_id}`);
    console.log(`   New Campaign: ${duplicateResult.new_campaign_id}\n`);

    // ==================== 9. CONTACT LIST FILTERING ====================
    console.log("9️⃣ Advanced Contact List Management\n");

    // Get contacts with filtering
    const contactsInList = await campaignManager.getContactsInList(
      contactList.id,
      { limit: 10, offset: 0 },
      { status: ['active'], email_contains: '@example.com' }
    );

    console.log(`✅ Found ${contactsInList.length} contacts in list matching filters`);

    // Get all contact lists
    const allLists = await campaignManager.getContactLists(
      { limit: 5 },
      { type: 'manual' }
    );
    console.log(`✅ Found ${allLists.length} contact lists\n`);

    // ==================== 10. BULK OPERATIONS ====================
    console.log("🔟 Bulk Contact Operations\n");

    // Get some contact IDs for bulk operations
    const contactIds = contactsInList.slice(0, 2).map(c => c.id);

    if (contactIds.length > 0) {
      const bulkResult = await campaignManager.performBulkContactOperation({
        operation: 'add_to_segment',
        contact_ids: contactIds,
        target_id: segment.id
      });

      console.log(`✅ Bulk operation completed: ${bulkResult.success_count} successful, ${bulkResult.error_count} failed\n`);
    }

    // ==================== 11. MONITORING SUMMARY ====================
    console.log("1️⃣1️⃣ Real-time Monitoring Summary\n");

    const monitoringSummary = realtimeMonitor.getMonitoringSummary();
    console.log("📊 Monitoring Summary:");
    console.log(`   Monitored Campaigns: ${monitoringSummary.length}`);

    for (const { campaignId, stats } of monitoringSummary) {
      console.log(`   Campaign ${campaignId}:`);
      console.log(`     Status: ${stats.current_status}`);
      console.log(`     Emails Sent: ${stats.emails_sent}`);
      console.log(`     Send Rate: ${stats.send_rate_per_minute}/min`);
    }
    console.log();

    // ==================== 12. EXPORT MONITORING DATA ====================
    console.log("1️⃣2️⃣ Exporting Monitoring Data\n");

    const exportData = realtimeMonitor.exportMonitoringData();
    console.log("📊 Export Data:");
    console.log(`   Total Campaigns: ${exportData.totalCampaigns}`);
    console.log(`   Export Time: ${exportData.timestamp}`);
    console.log(`   Data Points: ${exportData.campaignStats.length}\n`);

    // ==================== CLEANUP ====================
    console.log("🧹 Cleaning Up\n");

    // Stop monitoring
    await realtimeMonitor.stopAllMonitoring();
    console.log("✅ Stopped all real-time monitoring");

    console.log("\n🎉 Campaign Management Demo Completed Successfully!");
    console.log("\n📋 Summary of Features Demonstrated:");
    console.log("   ✅ Contact list creation and management");
    console.log("   ✅ Dynamic segment creation and calculation");
    console.log("   ✅ Campaign creation with validation");
    console.log("   ✅ Real-time campaign monitoring");
    console.log("   ✅ Campaign pause and resume");
    console.log("   ✅ Campaign status with real-time stats");
    console.log("   ✅ Campaign duplication");
    console.log("   ✅ Advanced filtering and segmentation");
    console.log("   ✅ Bulk contact operations");
    console.log("   ✅ Monitoring data export");

  } catch (error) {
    console.error("\n❌ Demo failed:", error);

    // Cleanup on error
    await realtimeMonitor.stopAllMonitoring();

    throw error;
  }
}

// ==================== ADDITIONAL UTILITY FUNCTIONS ====================

/**
 * Demonstrate advanced filtering capabilities
 */
async function demonstrateAdvancedFiltering() {
  console.log("\n🔍 Advanced Filtering Demo\n");

  const campaignManager = new CampaignManagementService();

  // Create filter for recent, active contacts
  const contactFilter = {
    status: ['active' as const],
    created_after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
    has_metadata: ['source'],
    email_contains: '@'
  };

  // Create campaign filter for running campaigns
  const campaignFilter = {
    status: ['running' as const, 'scheduled' as const],
    created_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
    priority_min: 1
  };

  console.log("✅ Filtering examples configured");
  console.log("   Contact Filter:", JSON.stringify(contactFilter, null, 2));
  console.log("   Campaign Filter:", JSON.stringify(campaignFilter, null, 2));
}

/**
 * Demonstrate validation features
 */
async function demonstrateValidation() {
  console.log("\n✅ Validation Demo\n");

  const campaignManager = new CampaignManagementService();

  // Test invalid campaign data
  const invalidCampaignData = {
    // Missing template_id
    name: "Test Campaign",
    subject: "Hi", // Too short
    scheduled_at: new Date(Date.now() - 60000).toISOString(), // In the past
    from_email: "invalid-email" // Invalid format
  };

  const validation = await campaignManager.validateCampaignCreation(invalidCampaignData);

  console.log("📋 Validation Result:");
  console.log(`   Valid: ${validation.is_valid}`);
  console.log(`   Errors: ${validation.errors.length}`);
  validation.errors.forEach(error => console.log(`     ❌ ${error}`));
  console.log(`   Warnings: ${validation.warnings.length}`);
  validation.warnings.forEach(warning => console.log(`     ⚠️ ${warning}`));
}

// Export the demo functions
export {
    demonstrateAdvancedFiltering, demonstrateCampaignManagement, demonstrateValidation
};

// Run the main demo if this file is executed directly
if (require.main === module) {
  demonstrateCampaignManagement()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Demo failed:", error);
      process.exit(1);
    });
}
