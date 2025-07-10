# Supabase Edge Functions Documentation

This document describes all the Supabase Edge Functions in the Momentum Email System.

## Overview

The email system uses 5 Supabase Edge Functions to handle different aspects of email processing, tracking, and management:

1. **email-processor** - Processes email queue in batches (cron-triggered)
2. **webhook-handler** - Receives Mailtrap webhooks for tracking updates
3. **campaign-scheduler** - Checks for scheduled campaigns and starts them
4. **bounce-processor** - Handles bounce notifications and updates contact status
5. **webhook-mailtrap** - Legacy webhook handler (consider migrating to webhook-handler)

## Functions Detail

### 1. email-processor

**Purpose**: Processes pending emails from the queue in batches
**Trigger**: Cron job (scheduled execution)
**Location**: `supabase/functions/email-processor/index.ts`

#### Features:
- Fetches pending emails from `email_queue` table
- Processes emails in configurable batches (default 50)
- Sends emails via Mailtrap API
- Updates email status and creates logs
- Implements retry logic with exponential backoff
- Handles concurrency control (max 10 parallel requests)

#### Environment Variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `MAILTRAP_API_TOKEN` - Mailtrap API token for sending emails
- `EMAIL_BATCH_SIZE` - Number of emails to process per batch (default: 50)

#### Response Format:
```json
{
  "success": true,
  "message": "Email processing completed",
  "result": {
    "processed": 25,
    "successful": 23,
    "failed": 2,
    "hasErrors": true
  }
}
```

### 2. webhook-handler

**Purpose**: Enhanced webhook handler for Mailtrap events
**Trigger**: HTTP POST from Mailtrap
**Location**: `supabase/functions/webhook-handler/index.ts`

#### Features:
- Signature verification with HMAC SHA-256
- Handles all Mailtrap events (delivery, open, click, bounce, spam, unsubscribe)
- Updates email logs and contact status
- Tracks click and open events separately
- Logs webhook events for debugging
- Updates contact subscription status

#### Supported Events:
- `delivery` → status: delivered
- `open` → status: opened (creates open tracking record)
- `click` → status: clicked (creates click tracking record)
- `bounce` → status: bounced (updates contact status)
- `spam` → status: spam (unsubscribes contact)
- `unsubscribe` → status: unsubscribed (updates contact)

#### Environment Variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `MAILTRAP_WEBHOOK_SECRET` - Secret for webhook signature verification

### 3. campaign-scheduler

**Purpose**: Schedules and starts email campaigns
**Trigger**: Cron job (scheduled execution)
**Location**: `supabase/functions/campaign-scheduler/index.ts`

#### Features:
- Finds campaigns scheduled to start
- Validates templates and segments
- Generates email queue entries for all recipients
- Supports segmented and broadcast campaigns
- Staggers email sends to avoid rate limits
- Updates campaign status and statistics

#### Environment Variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `CAMPAIGN_BATCH_SIZE` - Number of campaigns to process per run (default: 100)

#### Campaign Flow:
1. `scheduled` → `processing` → `running`
2. Creates email queue entries for all valid recipients
3. Updates campaign with total recipient count
4. Handles template variable substitution

### 4. bounce-processor

**Purpose**: Processes bounce notifications and updates contact status
**Trigger**: Cron job or HTTP POST
**Location**: `supabase/functions/bounce-processor/index.ts`

#### Features:
- Processes pending bounce notifications
- Updates contact email status
- Implements bounce suppression logic
- Tracks bounce statistics per campaign
- Creates bounce events for analytics
- Handles hard bounces, soft bounces, and spam complaints

#### Bounce Types:
- **Hard Bounce**: Permanent delivery failure (unsubscribes contact)
- **Soft Bounce**: Temporary delivery failure (tracks count)
- **Spam Complaint**: Marked as spam (unsubscribes and suppresses)

#### Suppression Rules:
- Hard bounces: Immediate suppression
- Soft bounces: Suppressed after 5 consecutive bounces
- Spam complaints: Immediate suppression

#### Environment Variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

### 5. webhook-mailtrap (Legacy)

**Purpose**: Original webhook handler for Mailtrap
**Status**: Legacy - consider migrating to webhook-handler
**Location**: `supabase/functions/webhook-mailtrap/index.ts`

This is the original webhook handler that's currently deployed. The new `webhook-handler` provides enhanced functionality and should be used for new implementations.

## Database Tables

The Edge Functions interact with several database tables:

### Core Tables:
- `email_queue` - Pending emails to be sent
- `email_logs` - Sent email tracking and status
- `email_campaigns` - Campaign definitions and status
- `contacts` - Contact list with subscription status
- `email_templates` - Email template storage

### Tracking Tables:
- `email_opens` - Email open tracking data
- `email_clicks` - Email click tracking data
- `bounce_events` - Bounce event history
- `webhook_events` - Webhook event logs

### Support Tables:
- `bounce_notifications` - Bounce processing queue
- `suppression_list` - Global email suppression
- `contact_segments` - Segment-to-contact relationships

## Deployment Commands

To deploy the functions to Supabase:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy email-processor
supabase functions deploy webhook-handler
supabase functions deploy campaign-scheduler
supabase functions deploy bounce-processor
```

## Cron Jobs Setup

Set up cron jobs to trigger the functions:

```bash
# Process email queue every minute
*/1 * * * * curl -X POST https://your-project.supabase.co/functions/v1/email-processor

# Check for scheduled campaigns every 5 minutes
*/5 * * * * curl -X POST https://your-project.supabase.co/functions/v1/campaign-scheduler

# Process bounces every 10 minutes
*/10 * * * * curl -X POST https://your-project.supabase.co/functions/v1/bounce-processor
```

## Monitoring and Logging

All functions include comprehensive logging:

- **Success logs**: ✅ with operation details
- **Error logs**: ❌ with error messages and context
- **Warning logs**: ⚠️ for non-critical issues
- **Info logs**: 📧 📮 📊 for tracking operations

Monitor function execution in:
- Supabase Dashboard → Edge Functions → Logs
- Real-time logs via `supabase functions logs`

## Error Handling

All functions implement robust error handling:

1. **Graceful degradation** - Non-critical operations don't fail the entire process
2. **Retry logic** - Failed operations are retried with exponential backoff
3. **Status tracking** - Failed items are marked for later processing
4. **Comprehensive logging** - All errors are logged with context

## Security

- Functions use service role keys for database access
- Webhook signature verification prevents unauthorized requests
- CORS headers configured for security
- Input validation on all endpoints
- Rate limiting through batch processing

## Performance Optimization

- **Batch processing** - Multiple items processed in single function call
- **Concurrency control** - Parallel processing with limits
- **Database optimization** - Efficient queries with proper indexing
- **Memory management** - Chunked processing for large datasets
