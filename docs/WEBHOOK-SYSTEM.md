# Webhook Processing System

The Momentum Email System includes a comprehensive webhook processing system that handles Mailtrap events with security, automation, and detailed tracking.

## Overview

The webhook system provides:

1. **Security**: Webhook signature verification to prevent unauthorized requests
2. **Event Processing**: Handles delivery, open, click, bounce, and unsubscribe events
3. **Automated Actions**: Automatically updates contact statuses based on events
4. **Duplicate Prevention**: Detects and handles duplicate webhook events
5. **Comprehensive Logging**: Detailed tracking and audit trails
6. **Error Handling**: Robust error handling with retry mechanisms

## Architecture

```
Mailtrap → Webhook Endpoint → Event Processing → Database Updates → Automated Actions
```

### Components

1. **Supabase Edge Function** (`webhook-mailtrap/index.ts`): Production webhook endpoint
2. **Webhook Processor Service** (`webhook-processor.service.ts`): Application-level webhook handling
3. **Database Functions**: PostgreSQL functions for automated processing
4. **Database Tables**: Comprehensive event and action tracking

## Database Schema

### Core Tables

#### `webhook_events`
Stores all incoming webhook events with duplicate detection:

```sql
- id: UUID (Primary Key)
- provider: VARCHAR(50) (Default: 'mailtrap')
- event_type: VARCHAR(50)
- message_id: VARCHAR(255)
- email: VARCHAR(255)
- payload: JSONB
- signature: VARCHAR(512)
- processed_successfully: BOOLEAN
- duplicate_count: INTEGER
- received_at: TIMESTAMP
- processed_at: TIMESTAMP
- error_message: TEXT
```

#### `contact_status_updates`
Tracks automated contact status changes:

```sql
- id: UUID (Primary Key)
- contact_id: UUID (Foreign Key → contacts.id)
- old_status: contact_status
- new_status: contact_status
- reason: TEXT
- triggered_by: VARCHAR(100)
- webhook_event_id: UUID (Foreign Key → webhook_events.id)
- created_at: TIMESTAMP
```

#### `automated_actions`
Logs all automated actions triggered by webhooks:

```sql
- id: UUID (Primary Key)
- action_type: VARCHAR(50)
- target_id: UUID
- metadata: JSONB
- triggered_by: VARCHAR(100)
- webhook_event_id: UUID (Foreign Key → webhook_events.id)
- success: BOOLEAN
- error_message: TEXT
- created_at: TIMESTAMP
```

#### `email_tracking_details`
Extended tracking for opens, clicks, and unsubscribes:

```sql
- id: UUID (Primary Key)
- email_log_id: UUID (Foreign Key → email_logs.id)
- event_type: VARCHAR(20)
- user_agent: TEXT
- ip_address: INET
- location_data: JSONB
- url: VARCHAR(2048)
- event_timestamp: TIMESTAMP
- webhook_event_id: UUID (Foreign Key → webhook_events.id)
- created_at: TIMESTAMP
```

## Event Types and Processing

### 1. Delivery Events
- **Event Types**: `delivery`, `delivered`
- **Actions**: Updates `email_logs.status` to "delivered", sets `delivered_at` timestamp
- **Automated Actions**: None (successful delivery)

### 2. Open Events
- **Event Types**: `open`, `opened`
- **Actions**:
  - Updates `email_logs.status` to "opened", sets `opened_at` timestamp
  - Creates detailed tracking record with user agent, IP, location
- **Automated Actions**: None (engagement tracking)

### 3. Click Events
- **Event Types**: `click`, `clicked`
- **Actions**:
  - Updates `email_logs.status` to "clicked", sets `clicked_at` timestamp
  - Creates detailed tracking record with clicked URL, user agent, IP, location
- **Automated Actions**: None (engagement tracking)

### 4. Bounce Events
- **Event Types**: `bounce`, `bounced`, `spam`, `reject`
- **Actions**:
  - Updates `email_logs.status` to "bounced", sets `bounced_at` timestamp and `bounce_reason`
  - Determines bounce type (hard/soft) and triggers appropriate action
- **Automated Actions**:
  - **Hard Bounces**: Contact status updated to "bounced"
  - **Soft Bounces**: Logged for monitoring (status unchanged)

### 5. Unsubscribe Events
- **Event Types**: `unsubscribe`, `unsubscribed`
- **Actions**:
  - Updates `email_logs.status` to "bounced" (prevents future sends)
  - Creates detailed tracking record
- **Automated Actions**: Contact status updated to "unsubscribed"

## Security Features

### Webhook Signature Verification

The system verifies webhook signatures using HMAC-SHA256:

```typescript
// Environment variable required
MAILTRAP_WEBHOOK_SECRET=your_webhook_secret

// Verification process
1. Extract signature from 'x-mailtrap-signature' header
2. Generate expected signature using webhook secret
3. Compare signatures using constant-time comparison
4. Reject requests with invalid signatures
```

### Access Control

- Webhook endpoint uses service role for full database access
- Row Level Security (RLS) policies restrict data access by role
- All webhook events logged for audit purposes

## Duplicate Event Handling

The system automatically detects and handles duplicate webhook events:

1. **Detection**: Checks for existing events with same `message_id` and `event_type` within 24 hours
2. **Handling**: Updates duplicate count and timestamp, skips reprocessing
3. **Response**: Returns success with duplicate indication

## Error Handling and Retry

### Edge Function Level
- Validates JSON payload structure
- Logs all errors with detailed context
- Returns appropriate HTTP status codes
- Never fails webhooks due to processing errors (prevents Mailtrap retries)

### Database Level
- Transaction-based processing ensures data consistency
- Graceful handling of missing records
- Detailed error logging for debugging

### Application Level
- Comprehensive error catching and logging
- Fallback mechanisms for missing data
- Retry capabilities for failed operations

## Usage Examples

### Using the Webhook Processor Service

```typescript
import { WebhookProcessorService } from './services/webhook-processor.service';

// Initialize service
const webhookProcessor = new WebhookProcessorService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Process a webhook manually
const result = await webhookProcessor.processWebhook({
  message_id: "abc123",
  inbox_id: 12345,
  email: "user@example.com",
  event: "bounce",
  timestamp: Date.now() / 1000,
  bounce_type: "hard",
  bounce_reason: "Invalid email address"
});

console.log('Processing result:', result);
// {
//   success: true,
//   event_id: "uuid",
//   message: "Webhook event bounce processed successfully",
//   actions_performed: ["email_log_updated", "hard_bounce_contact_status_update", "contact_status_updated"]
// }
```

### Getting Webhook Statistics

```typescript
// Get processing statistics
const stats = await webhookProcessor.getWebhookStats({
  provider: 'mailtrap',
  from_date: '2024-01-01T00:00:00Z',
  to_date: '2024-01-31T23:59:59Z'
});

console.log('Webhook stats:', stats);
// {
//   total_events: 1500,
//   successful_events: 1485,
//   failed_events: 15,
//   by_event_type: {
//     delivery: { total: 800, successful: 800, failed: 0 },
//     open: { total: 400, successful: 395, failed: 5 },
//     click: { total: 200, successful: 200, failed: 0 },
//     bounce: { total: 100, successful: 90, failed: 10 }
//   }
// }
```

### Querying Webhook Events

```typescript
// Get recent failed webhook events
const failedEvents = await webhookProcessor.getWebhookEvents({
  processed_successfully: false,
  limit: 10,
  from_date: '2024-01-01T00:00:00Z'
});

// Get bounce events for specific email
const bounceEvents = await webhookProcessor.getWebhookEvents({
  event_type: 'bounce',
  email: 'problematic@example.com',
  limit: 5
});
```

### Getting Automated Actions

```typescript
// Get contact status updates from webhooks
const statusUpdates = await webhookProcessor.getContactStatusUpdates({
  triggered_by: 'webhook:bounce',
  limit: 20
});

// Get all automated actions for a specific contact
const contactActions = await webhookProcessor.getAutomatedActions({
  target_id: 'contact-uuid',
  limit: 10
});
```

### Manual Processing

```typescript
// Manually trigger bounce processing
const bounceResult = await webhookProcessor.triggerBounceProcessing(
  'user@invalid-domain.com',
  'hard',
  'Domain does not exist'
);

// Manually trigger unsubscribe processing
const unsubscribeResult = await webhookProcessor.triggerUnsubscribeProcessing(
  'user@example.com',
  'manual'
);
```

## Configuration

### Environment Variables

Required environment variables for the webhook system:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Webhook Security
MAILTRAP_WEBHOOK_SECRET=your_webhook_secret_from_mailtrap

# Optional: Webhook URL for testing
WEBHOOK_URL=https://your-project.supabase.co/functions/v1/webhook-mailtrap
```

### Mailtrap Configuration

1. **Add Webhook Endpoint**: Configure Mailtrap to send webhooks to your endpoint
2. **Select Events**: Enable delivery, open, click, bounce, and unsubscribe events
3. **Set Secret**: Configure webhook secret for signature verification

### Database Migration

Apply the webhook system migration:

```bash
# Apply the webhook system migration
supabase db push

# Or apply specific migration
psql -h your-db-host -d your-db -f supabase/migrations/20250119000000_create_webhook_system.sql
```

## Monitoring and Maintenance

### Monitoring Webhook Health

```sql
-- Check recent webhook processing success rate
SELECT
  DATE(received_at) as date,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE processed_successfully = true) as successful,
  COUNT(*) FILTER (WHERE processed_successfully = false) as failed,
  ROUND(
    (COUNT(*) FILTER (WHERE processed_successfully = true)::decimal / COUNT(*)) * 100,
    2
  ) as success_rate_percent
FROM webhook_events
WHERE received_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(received_at)
ORDER BY date DESC;
```

### Cleanup Old Data

```typescript
// Clean up webhook events older than 30 days
const cleanupResult = await webhookProcessor.cleanupOldWebhookEvents(30);
console.log('Cleanup result:', cleanupResult);
// { events_deleted: 1000, actions_deleted: 50, tracking_deleted: 200 }
```

### Common Queries

```sql
-- Find emails with multiple bounce events
SELECT
  email,
  COUNT(*) as bounce_count,
  MAX(received_at) as last_bounce
FROM webhook_events
WHERE event_type = 'bounce'
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY bounce_count DESC;

-- Get contact status changes in last 24 hours
SELECT
  csu.*,
  c.email,
  c.first_name,
  c.last_name
FROM contact_status_updates csu
JOIN contacts c ON csu.contact_id = c.id
WHERE csu.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY csu.created_at DESC;

-- Find most active IP addresses (for click/open tracking)
SELECT
  ip_address,
  COUNT(*) as events,
  COUNT(DISTINCT email_log_id) as unique_emails,
  array_agg(DISTINCT event_type) as event_types
FROM email_tracking_details
WHERE event_timestamp >= NOW() - INTERVAL '7 days'
  AND ip_address IS NOT NULL
GROUP BY ip_address
ORDER BY events DESC
LIMIT 10;
```

## Troubleshooting

### Common Issues

1. **Signature Verification Fails**
   - Check webhook secret configuration
   - Verify Mailtrap webhook settings
   - Check request headers

2. **Email Log Not Found**
   - Verify `mailtrap_message_id` is being set correctly
   - Check email sending process
   - Look for timing issues

3. **Duplicate Events**
   - Normal behavior for Mailtrap retries
   - Check duplicate count in webhook_events table
   - Verify 24-hour detection window

4. **Contact Not Found for Bounce/Unsubscribe**
   - Verify email address matches exactly
   - Check contact import process
   - Look for case sensitivity issues

### Debug Queries

```sql
-- Check webhook events for specific message
SELECT * FROM webhook_events
WHERE message_id = 'your-message-id'
ORDER BY received_at DESC;

-- Check email log for specific message
SELECT * FROM email_logs
WHERE mailtrap_message_id = 'your-message-id';

-- Check automated actions for specific event
SELECT * FROM automated_actions
WHERE webhook_event_id = 'your-event-id';
```

## Performance Considerations

### Indexing

The system includes optimized indexes for:
- Message ID lookups
- Email address searches
- Event type filtering
- Timestamp-based queries

### Batch Processing

For high-volume scenarios:
- Process webhooks in batches
- Use database connection pooling
- Consider async processing queues

### Cleanup Strategy

- Automatically clean up old events (default: 30 days)
- Archive important events before deletion
- Monitor database size and performance

## Security Best Practices

1. **Always verify webhook signatures** in production
2. **Use service role key** only in server environments
3. **Log all webhook events** for audit purposes
4. **Monitor for unusual patterns** (high failure rates, suspicious IPs)
5. **Regularly rotate webhook secrets**
6. **Implement rate limiting** if needed for high-volume scenarios

## Integration Examples

### Real-time Dashboard

```typescript
// Subscribe to webhook events for real-time dashboard
const supabase = createClient(url, anonKey);

supabase
  .channel('webhook-events')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'webhook_events' },
    (payload) => {
      console.log('New webhook event:', payload.new);
      updateDashboard(payload.new);
    }
  )
  .subscribe();
```

### Email Campaign Monitoring

```typescript
// Monitor campaign performance in real-time
supabase
  .channel('email-tracking')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'email_logs' },
    (payload) => {
      if (payload.new.campaign_id === campaignId) {
        updateCampaignStats(payload.new);
      }
    }
  )
  .subscribe();
```

This webhook system provides comprehensive email event processing with security, automation, and detailed tracking capabilities. It's designed to handle high-volume email campaigns while maintaining data integrity and providing valuable insights for email marketing optimization.
