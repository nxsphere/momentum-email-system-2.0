import { WebhookProcessorService } from '../src/services/webhook-processor.service';
import { MailtrapWebhookPayload } from '../src/types/email-system';

// Demo script showing webhook processing capabilities
async function webhookProcessingDemo() {
  console.log('🔧 Webhook Processing System Demo');
  console.log('==================================\n');

  // Initialize the webhook processor
  const webhookProcessor = new WebhookProcessorService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Simulate different webhook events
    console.log('📬 1. Processing Various Webhook Events');
    console.log('--------------------------------------');

    // Delivery event
    const deliveryPayload: MailtrapWebhookPayload = {
      message_id: 'msg_delivery_123',
      inbox_id: 12345,
      email: 'user@example.com',
      event: 'delivery',
      timestamp: Math.floor(Date.now() / 1000),
      response: 'Message delivered successfully'
    };

    const deliveryResult = await webhookProcessor.processWebhook(deliveryPayload);
    console.log('✅ Delivery Event:', deliveryResult);

    // Open event with tracking data
    const openPayload: MailtrapWebhookPayload = {
      message_id: 'msg_open_456',
      inbox_id: 12345,
      email: 'user@example.com',
      event: 'open',
      timestamp: Math.floor(Date.now() / 1000),
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.100',
      location: JSON.stringify({ country: 'US', city: 'New York' })
    };

    const openResult = await webhookProcessor.processWebhook(openPayload);
    console.log('👀 Open Event:', openResult);

    // Click event with URL
    const clickPayload: MailtrapWebhookPayload = {
      message_id: 'msg_click_789',
      inbox_id: 12345,
      email: 'user@example.com',
      event: 'click',
      timestamp: Math.floor(Date.now() / 1000),
      url: 'https://example.com/landing-page',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      ip: '192.168.1.101'
    };

    const clickResult = await webhookProcessor.processWebhook(clickPayload);
    console.log('🖱️ Click Event:', clickResult);

    // Hard bounce event (triggers contact status update)
    const hardBouncePayload: MailtrapWebhookPayload = {
      message_id: 'msg_bounce_hard_101',
      inbox_id: 12345,
      email: 'invalid@nonexistentdomain.com',
      event: 'bounce',
      timestamp: Math.floor(Date.now() / 1000),
      bounce_type: 'hard',
      bounce_reason: 'Domain does not exist',
      bounce_code: '550'
    };

    const hardBounceResult = await webhookProcessor.processWebhook(hardBouncePayload);
    console.log('💥 Hard Bounce Event:', hardBounceResult);

    // Soft bounce event (logged but no status change)
    const softBouncePayload: MailtrapWebhookPayload = {
      message_id: 'msg_bounce_soft_102',
      inbox_id: 12345,
      email: 'user@example.com',
      event: 'bounce',
      timestamp: Math.floor(Date.now() / 1000),
      bounce_type: 'soft',
      bounce_reason: 'Mailbox full',
      bounce_code: '452'
    };

    const softBounceResult = await webhookProcessor.processWebhook(softBouncePayload);
    console.log('📦 Soft Bounce Event:', softBounceResult);

    // Unsubscribe event (triggers contact status update)
    const unsubscribePayload: MailtrapWebhookPayload = {
      message_id: 'msg_unsubscribe_201',
      inbox_id: 12345,
      email: 'user@example.com',
      event: 'unsubscribe',
      timestamp: Math.floor(Date.now() / 1000),
      unsubscribe_type: 'manual'
    };

    const unsubscribeResult = await webhookProcessor.processWebhook(unsubscribePayload);
    console.log('🚫 Unsubscribe Event:', unsubscribeResult);

    console.log('\n');

    // 2. Test duplicate detection
    console.log('🔄 2. Testing Duplicate Detection');
    console.log('---------------------------------');

    // Send the same delivery event again
    const duplicateResult = await webhookProcessor.processWebhook(deliveryPayload);
    console.log('📋 Duplicate Event Result:', duplicateResult);

    console.log('\n');

    // 3. Get webhook statistics
    console.log('📊 3. Webhook Processing Statistics');
    console.log('-----------------------------------');

    const stats = await webhookProcessor.getWebhookStats({
      provider: 'mailtrap',
      from_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
    });

    console.log('Statistics:', JSON.stringify(stats, null, 2));

    console.log('\n');

    // 4. Query webhook events
    console.log('🔍 4. Querying Webhook Events');
    console.log('-----------------------------');

    // Get recent events
    const recentEvents = await webhookProcessor.getWebhookEvents({
      limit: 5,
      from_date: new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour
    });

    console.log(`📝 Recent Events (${recentEvents.length}):`);
    recentEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.event_type} - ${event.email} (${event.processed_successfully ? 'Success' : 'Failed'})`);
    });

    // Get bounce events specifically
    const bounceEvents = await webhookProcessor.getWebhookEvents({
      event_type: 'bounce',
      limit: 3
    });

    console.log(`\n💥 Bounce Events (${bounceEvents.length}):`);
    bounceEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.email} - ${event.payload.bounce_type} bounce`);
    });

    console.log('\n');

    // 5. Get automated actions
    console.log('🤖 5. Automated Actions Triggered');
    console.log('----------------------------------');

    const automatedActions = await webhookProcessor.getAutomatedActions({
      limit: 5
    });

    console.log(`⚡ Automated Actions (${automatedActions.length}):`);
    automatedActions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.action_type} - ${action.triggered_by} (${action.success ? 'Success' : 'Failed'})`);
    });

    console.log('\n');

    // 6. Get contact status updates
    console.log('👤 6. Contact Status Updates');
    console.log('----------------------------');

    const statusUpdates = await webhookProcessor.getContactStatusUpdates({
      limit: 5
    });

    console.log(`🔄 Status Updates (${statusUpdates.length}):`);
    statusUpdates.forEach((update, index) => {
      console.log(`${index + 1}. ${update.contacts?.email} - ${update.old_status} → ${update.new_status} (${update.reason})`);
    });

    console.log('\n');

    // 7. Manual processing examples
    console.log('🔧 7. Manual Processing Examples');
    console.log('---------------------------------');

    // Manually trigger bounce processing
    console.log('Processing manual bounce...');
    const manualBounceResult = await webhookProcessor.triggerBounceProcessing(
      'manual-test@example.com',
      'hard',
      'Manual bounce test'
    );
    console.log('Manual Bounce Result:', manualBounceResult);

    // Manually trigger unsubscribe processing
    console.log('\nProcessing manual unsubscribe...');
    const manualUnsubscribeResult = await webhookProcessor.triggerUnsubscribeProcessing(
      'manual-unsubscribe@example.com',
      'manual'
    );
    console.log('Manual Unsubscribe Result:', manualUnsubscribeResult);

    console.log('\n');

    // 8. Cleanup demonstration
    console.log('🧹 8. Cleanup Operations');
    console.log('------------------------');

    // Note: In production, you'd typically clean up events older than 30 days
    // For demo purposes, we'll just show the structure
    console.log('To clean up old webhook events (30 days+):');
    console.log('const cleanupResult = await webhookProcessor.cleanupOldWebhookEvents(30);');
    console.log('This would return: { events_deleted: N, actions_deleted: N, tracking_deleted: N }');

    console.log('\n✅ Webhook Processing Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('• ✅ Event processing with automation');
    console.log('• ✅ Duplicate detection and handling');
    console.log('• ✅ Contact status updates on bounces/unsubscribes');
    console.log('• ✅ Detailed tracking for opens and clicks');
    console.log('• ✅ Statistics and reporting');
    console.log('• ✅ Manual processing capabilities');
    console.log('• ✅ Comprehensive error handling');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  webhookProcessingDemo()
    .then(() => {
      console.log('\n🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

export { webhookProcessingDemo };

// Example environment setup for running this demo:
/*
Required environment variables:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

To run this demo:
1. Ensure your Supabase project is set up with the webhook system migrations
2. Set the required environment variables
3. Run: npx ts-node examples/webhook-processing-demo.ts

The demo will:
- Process various types of webhook events
- Demonstrate duplicate detection
- Show automated actions for bounces and unsubscribes
- Display statistics and querying capabilities
- Test manual processing functions
*/
