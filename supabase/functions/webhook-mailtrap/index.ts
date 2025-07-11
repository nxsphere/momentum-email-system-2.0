import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mailtrap-signature',
};

interface MailtrapWebhookPayload {
  message_id: string;
  inbox_id: number;
  email: string;
  event: string;
  timestamp: number;
  response?: string;
  category?: string;
  custom_variables?: Record<string, any>;
  user_agent?: string;
  ip?: string;
  location?: string;
  bounce_type?: 'hard' | 'soft';
  bounce_reason?: string;
  bounce_code?: string;
  url?: string; // For click events
  unsubscribe_type?: 'automatic' | 'manual';
}

interface WebhookProcessingResult {
  success: boolean;
  event_id?: string;
  message: string;
  actions_performed?: string[];
  duplicate_detected?: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let eventId: string | null = null;

  try {
    // Only allow POST requests for webhook
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get environment variables
    const webhookSecret = Deno.env.get('MAILTRAP_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the request body and signature
    const body = await req.text();
    const signature = req.headers.get('x-mailtrap-signature');
    let payload: MailtrapWebhookPayload;

    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error('❌ Invalid JSON payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📬 Received Mailtrap webhook:', {
      event: payload.event,
      email: payload.email,
      messageId: payload.message_id,
      timestamp: new Date(payload.timestamp * 1000).toISOString(),
      signature: signature ? 'present' : 'missing'
    });

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      if (!signature) {
        console.error('❌ Missing webhook signature');
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const isValidSignature = await verifyWebhookSignature(body, signature, webhookSecret);
      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️ Webhook secret not configured - signature verification skipped');
    }

    // Initialize Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process the webhook event
    const result = await processWebhookEvent(payload, signature, supabase);
    eventId = result.event_id || null;

    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook processed successfully in ${processingTime}ms:`, {
      eventId,
      messageId: payload.message_id,
      event: payload.event,
      email: payload.email,
      actionsPerformed: result.actions_performed,
      duplicateDetected: result.duplicate_detected
    });

    // Return success response to Mailtrap
    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        event_id: eventId,
        actions_performed: result.actions_performed,
        duplicate_detected: result.duplicate_detected,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Webhook processing error:', {
      error: error.message,
      stack: error.stack,
      eventId,
      processingTime
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
        event_id: eventId,
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Enhanced signature verification with multiple algorithm support
async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Remove algorithm prefix if present (e.g., "sha256=")
    const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    return cleanSignature.length === expectedHex.length &&
           crypto.subtle.timingSafeEqual(
             encoder.encode(cleanSignature),
             encoder.encode(expectedHex)
           );
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// Main webhook event processing function
async function processWebhookEvent(
  payload: MailtrapWebhookPayload,
  signature: string | null,
  supabase: any
): Promise<WebhookProcessingResult> {
  try {
    // Step 1: Log the webhook event and check for duplicates
    const { eventId, isDuplicate, duplicateCount } = await logWebhookEvent(
      payload,
      signature,
      supabase
    );

    if (isDuplicate) {
      console.log(`🔄 Duplicate webhook detected (count: ${duplicateCount}):`, {
        eventId,
        messageId: payload.message_id,
        event: payload.event
      });

      return {
        success: true,
        event_id: eventId,
        message: `Duplicate webhook processed (count: ${duplicateCount})`,
        duplicate_detected: true,
        actions_performed: ['duplicate_logged']
      };
    }

    // Step 2: Process the specific event type
    const result = await processEventByType(payload, eventId, supabase);

    // Step 3: Update webhook event as processed
    await supabase
      .from('webhook_events')
      .update({
        processed_successfully: result.success,
        processed_at: new Date().toISOString(),
        error_message: result.error || null
      })
      .eq('id', eventId);

    return {
      ...result,
      event_id: eventId
    };

  } catch (error) {
    console.error('❌ Error processing webhook event:', error);

    return {
      success: false,
      message: 'Failed to process webhook event',
      error: error.message
    };
  }
}

// Log webhook event and check for duplicates
async function logWebhookEvent(
  payload: MailtrapWebhookPayload,
  signature: string | null,
  supabase: any
): Promise<{ eventId: string; isDuplicate: boolean; duplicateCount: number }> {
  // Check for duplicates first
  const { data: duplicateCheck } = await supabase
    .rpc('check_webhook_duplicate', {
      p_provider: 'mailtrap',
      p_event_type: payload.event,
      p_message_id: payload.message_id,
      p_payload: payload
    });

  if (duplicateCheck && duplicateCheck.length > 0) {
    const duplicate = duplicateCheck[0];
    if (duplicate.is_duplicate) {
      return {
        eventId: duplicate.existing_event_id,
        isDuplicate: true,
        duplicateCount: duplicate.duplicate_count
      };
    }
  }

  // Insert new webhook event
  const { data: eventData, error } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'mailtrap',
      event_type: payload.event,
      message_id: payload.message_id,
      email: payload.email,
      payload: payload,
      signature: signature,
      processed_successfully: false,
      duplicate_count: 0
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to log webhook event: ${error.message}`);
  }

  return {
    eventId: eventData.id,
    isDuplicate: false,
    duplicateCount: 0
  };
}

// Process event based on type
async function processEventByType(
  payload: MailtrapWebhookPayload,
  eventId: string,
  supabase: any
): Promise<WebhookProcessingResult> {
  const actions: string[] = [];

  try {
    // Step 1: Update email_logs table for all events
    const emailLogResult = await updateEmailLog(payload, supabase);
    if (emailLogResult.success) {
      actions.push('email_log_updated');
    } else {
      console.warn('⚠️ Failed to update email log:', emailLogResult.error);
      actions.push('email_log_update_failed');
    }

    // Step 2: Create detailed tracking record
    if (['open', 'click', 'unsubscribe'].includes(payload.event)) {
      const trackingResult = await createTrackingDetail(payload, eventId, supabase);
      if (trackingResult.success) {
        actions.push('tracking_detail_created');
      }
    }

    // Step 3: Process event-specific automated actions
    switch (payload.event.toLowerCase()) {
      case 'delivery':
      case 'delivered':
        actions.push('delivery_processed');
        break;

      case 'open':
      case 'opened':
        actions.push('open_tracked');
        break;

      case 'click':
      case 'clicked':
        actions.push('click_tracked');
        break;

      case 'bounce':
      case 'bounced':
        const bounceResult = await processBounceEvent(payload, eventId, supabase);
        actions.push(...bounceResult.actions_performed);
        break;

      case 'unsubscribe':
      case 'unsubscribed':
        const unsubscribeResult = await processUnsubscribeEvent(payload, eventId, supabase);
        actions.push(...unsubscribeResult.actions_performed);
        break;

      case 'spam':
      case 'reject':
      case 'reject':
        // Treat spam/reject as bounces
        const spamResult = await processBounceEvent(
          { ...payload, bounce_type: 'hard', bounce_reason: `Email ${payload.event}` },
          eventId,
          supabase
        );
        actions.push(...spamResult.actions_performed);
        break;

      default:
        console.warn(`⚠️ Unknown event type: ${payload.event}`);
        actions.push('unknown_event_logged');
    }

    return {
      success: true,
      message: `Webhook event ${payload.event} processed successfully`,
      actions_performed: actions
    };

  } catch (error) {
    console.error(`❌ Error processing ${payload.event} event:`, error);
    return {
      success: false,
      message: `Failed to process ${payload.event} event`,
      actions_performed: actions,
      error: error.message
    };
  }
}

// Update email_logs table with tracking data
async function updateEmailLog(
  payload: MailtrapWebhookPayload,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload.message_id) {
      return { success: false, error: 'Missing message_id' };
    }

    const emailStatus = mapEventToStatus(payload.event);
    const timestampField = getTimestampField(payload.event);
    const currentTime = new Date(payload.timestamp * 1000).toISOString();

    // Prepare update data
    const updateData: any = {
      status: emailStatus,
      tracking_data: {
        ...payload,
        processed_at: new Date().toISOString()
      }
    };

    // Set specific timestamp field based on event type
    if (timestampField) {
      updateData[timestampField] = currentTime;
    }

    // Set bounce-specific fields
    if (payload.event === 'bounce' || payload.event === 'bounced') {
      updateData.bounce_reason = payload.bounce_reason || payload.response || 'Email bounced';
      if (!updateData.bounced_at) {
        updateData.bounced_at = currentTime;
      }
    }

    // Update email log
    const { data, error } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('mailtrap_message_id', payload.message_id)
      .select();

    if (error) {
      return { success: false, error: `Database update failed: ${error.message}` };
    }

    if (!data || data.length === 0) {
      // Try to find by custom variables if available
      if (payload.custom_variables?.queue_id) {
        const { data: queueData, error: queueError } = await supabase
          .from('email_logs')
          .update(updateData)
          .eq('id', payload.custom_variables.queue_id)
          .select();

        if (queueError || !queueData || queueData.length === 0) {
          return { success: false, error: 'Email log not found' };
        }
      } else {
        return { success: false, error: 'Email log not found' };
      }
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create detailed tracking record
async function createTrackingDetail(
  payload: MailtrapWebhookPayload,
  eventId: string,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, find the email_log_id
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('mailtrap_message_id', payload.message_id)
      .single();

    if (findError || !emailLog) {
      return { success: false, error: 'Email log not found for tracking detail' };
    }

    // Parse location data if available
    let locationData = {};
    if (payload.location) {
      try {
        locationData = typeof payload.location === 'string'
          ? JSON.parse(payload.location)
          : payload.location;
      } catch (e) {
        locationData = { raw: payload.location };
      }
    }

    // Insert tracking detail
    const { error } = await supabase
      .from('email_tracking_details')
      .insert({
        email_log_id: emailLog.id,
        event_type: payload.event,
        user_agent: payload.user_agent,
        ip_address: payload.ip,
        location_data: locationData,
        url: payload.url,
        event_timestamp: new Date(payload.timestamp * 1000).toISOString(),
        webhook_event_id: eventId
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process bounce events with automated actions
async function processBounceEvent(
  payload: MailtrapWebhookPayload,
  eventId: string,
  supabase: any
): Promise<{ success: boolean; actions_performed: string[]; message: string }> {
  try {
    const bounceType = payload.bounce_type ||
                      (payload.response?.includes('permanent') ? 'hard' : 'hard'); // Default to hard
    const bounceReason = payload.bounce_reason || payload.response || 'Email bounced';

    const { data: result, error } = await supabase
      .rpc('process_bounce_event', {
        p_email: payload.email,
        p_bounce_type: bounceType,
        p_bounce_reason: bounceReason,
        p_webhook_event_id: eventId
      });

    if (error) {
      throw error;
    }

    const bounceResult = result[0];
    return {
      success: bounceResult.success,
      actions_performed: bounceResult.actions_performed || [],
      message: bounceResult.message
    };

  } catch (error) {
    console.error('❌ Error processing bounce event:', error);
    return {
      success: false,
      actions_performed: ['bounce_processing_failed'],
      message: `Failed to process bounce: ${error.message}`
    };
  }
}

// Process unsubscribe events
async function processUnsubscribeEvent(
  payload: MailtrapWebhookPayload,
  eventId: string,
  supabase: any
): Promise<{ success: boolean; actions_performed: string[]; message: string }> {
  try {
    const unsubscribeType = payload.unsubscribe_type || 'email';

    const { data: result, error } = await supabase
      .rpc('process_unsubscribe_event', {
        p_email: payload.email,
        p_unsubscribe_type: unsubscribeType,
        p_webhook_event_id: eventId
      });

    if (error) {
      throw error;
    }

    const unsubscribeResult = result[0];
    return {
      success: unsubscribeResult.success,
      actions_performed: unsubscribeResult.actions_performed || [],
      message: unsubscribeResult.message
    };

  } catch (error) {
    console.error('❌ Error processing unsubscribe event:', error);
    return {
      success: false,
      actions_performed: ['unsubscribe_processing_failed'],
      message: `Failed to process unsubscribe: ${error.message}`
    };
  }
}

// Map event types to email statuses
function mapEventToStatus(event: string): string {
  const eventMap: Record<string, string> = {
    'delivery': 'delivered',
    'delivered': 'delivered',
    'open': 'opened',
    'opened': 'opened',
    'click': 'clicked',
    'clicked': 'clicked',
    'bounce': 'bounced',
    'bounced': 'bounced',
    'spam': 'bounced',
    'reject': 'failed',
    'unsubscribe': 'bounced', // We mark unsubscribed emails as bounced to stop sending
    'unsubscribed': 'bounced'
  };

  return eventMap[event.toLowerCase()] || 'sent';
}

// Get the appropriate timestamp field for the event
function getTimestampField(event: string): string | null {
  const fieldMap: Record<string, string> = {
    'delivery': 'delivered_at',
    'delivered': 'delivered_at',
    'open': 'opened_at',
    'opened': 'opened_at',
    'click': 'clicked_at',
    'clicked': 'clicked_at',
    'bounce': 'bounced_at',
    'bounced': 'bounced_at'
  };

  return fieldMap[event.toLowerCase()] || null;
}
