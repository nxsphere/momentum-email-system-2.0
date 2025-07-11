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
  click_id?: string;
  url?: string;
  user_agent?: string;
  ip?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

    // Get the webhook payload
    const payload = await req.json() as MailtrapWebhookPayload;
    const signature = req.headers.get('x-mailtrap-signature');

    console.log('📬 Received Mailtrap webhook:', {
      event: payload.event,
      email: payload.email,
      messageId: payload.message_id,
      timestamp: new Date(payload.timestamp * 1000).toISOString(),
      hasLocation: !!payload.location,
      hasClickData: !!payload.click_id
    });

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const bodyText = JSON.stringify(payload);
      const expectedSignature = await generateSignature(bodyText, webhookSecret);

      if (!verifySignature(signature, expectedSignature)) {
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
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process the webhook event
    const processResult = await processWebhookEvent(payload, supabase);

    if (!processResult.success) {
      console.error('❌ Failed to process webhook:', processResult.error);
      // Don't return error to Mailtrap - we'll retry processing later
    }

    // Log the webhook event for debugging and analytics
    await logWebhookEvent(payload, supabase, processResult.success);

    console.log('🪝 Webhook processed:', {
      messageId: payload.message_id,
      event: payload.event,
      email: payload.email,
      success: processResult.success
    });

    // Return success response to Mailtrap
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        eventId: payload.message_id,
        event: payload.event,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processWebhookEvent(
  payload: MailtrapWebhookPayload,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload.message_id) {
      return { success: false, error: 'Missing message_id' };
    }

    const emailStatus = mapMailtrapEventToStatus(payload.event);
    const timestampField = getTimestampField(payload.event);

    // Prepare update data
    const updateData: any = {
      status: emailStatus,
      tracking_data: {
        ...payload,
        processed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    // Set specific timestamp field based on event type
    if (timestampField) {
      updateData[timestampField] = new Date(payload.timestamp * 1000).toISOString();
    }

    // Update email log status in database
    const { data, error } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('mailtrap_message_id', payload.message_id)
      .select();

    if (error) {
      return { success: false, error: `Database update failed: ${error.message}` };
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ No email log found for message_id: ${payload.message_id}`);
      // Try to find by custom variables if available
      if (payload.custom_variables?.queue_id) {
        const { data: queueData, error: queueError } = await supabase
          .from('email_logs')
          .update(updateData)
          .eq('queue_id', payload.custom_variables.queue_id)
          .select();

        if (queueError || !queueData || queueData.length === 0) {
          return { success: false, error: 'Email log not found' };
        }
      } else {
        return { success: false, error: 'Email log not found' };
      }
    }

    // Handle special events
    await handleSpecialEvents(payload, supabase);

    console.log('✅ Email log updated successfully:', {
      messageId: payload.message_id,
      status: emailStatus,
      event: payload.event
    });

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleSpecialEvents(payload: MailtrapWebhookPayload, supabase: any) {
  try {
    switch (payload.event) {
      case 'bounce':
      case 'spam':
        // Mark contact as bounced/spam
        await supabase
          .from('contacts')
          .update({
            email_status: payload.event,
            bounced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('email', payload.email);
        console.log(`📧 Contact ${payload.email} marked as ${payload.event}`);
        break;

      case 'unsubscribe':
        // Mark contact as unsubscribed
        await supabase
          .from('contacts')
          .update({
            is_subscribed: false,
            unsubscribed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('email', payload.email);
        console.log(`📧 Contact ${payload.email} unsubscribed`);
        break;

      case 'click':
        // Log click tracking data
        if (payload.url && payload.click_id) {
          await supabase
            .from('email_clicks')
            .insert({
              email_log_id: null, // Will be updated via message_id lookup
              mailtrap_message_id: payload.message_id,
              click_id: payload.click_id,
              url: payload.url,
              user_agent: payload.user_agent,
              ip_address: payload.ip,
              location: payload.location,
              clicked_at: new Date(payload.timestamp * 1000).toISOString()
            });
          console.log(`🖱️ Click tracked for ${payload.email}: ${payload.url}`);
        }
        break;

      case 'open':
        // Log open tracking data
        await supabase
          .from('email_opens')
          .insert({
            email_log_id: null, // Will be updated via message_id lookup
            mailtrap_message_id: payload.message_id,
            user_agent: payload.user_agent,
            ip_address: payload.ip,
            location: payload.location,
            opened_at: new Date(payload.timestamp * 1000).toISOString()
          });
        console.log(`👀 Open tracked for ${payload.email}`);
        break;
    }
  } catch (error) {
    console.warn(`⚠️ Failed to handle special event ${payload.event}:`, error);
    // Don't throw - we still want the main webhook to succeed
  }
}

async function logWebhookEvent(
  payload: MailtrapWebhookPayload,
  supabase: any,
  success: boolean
) {
  try {
    await supabase
      .from('webhook_events')
      .insert({
        provider: 'mailtrap',
        event_type: payload.event,
        message_id: payload.message_id,
        email: payload.email,
        payload: payload,
        processed_successfully: success,
        received_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn('⚠️ Failed to log webhook event:', error);
    // Don't throw - this is just for debugging
  }
}

// Helper function to generate HMAC signature
async function generateSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to verify signature
function verifySignature(received: string, expected: string): boolean {
  // Remove 'sha256=' prefix if present
  const cleanReceived = received.startsWith('sha256=') ? received.slice(7) : received;
  return cleanReceived === expected;
}

// Map Mailtrap events to our email log status
function mapMailtrapEventToStatus(event: string): string {
  const eventMap: Record<string, string> = {
    'delivery': 'delivered',
    'open': 'opened',
    'click': 'clicked',
    'bounce': 'bounced',
    'spam': 'spam',
    'reject': 'failed',
    'unsubscribe': 'unsubscribed',
    'subscription': 'subscribed'
  };

  return eventMap[event] || 'sent';
}

// Get the appropriate timestamp field for the event
function getTimestampField(event: string): string | null {
  const fieldMap: Record<string, string> = {
    'delivery': 'delivered_at',
    'open': 'opened_at',
    'click': 'clicked_at',
    'bounce': 'bounced_at',
    'unsubscribe': 'unsubscribed_at'
  };

  return fieldMap[event] || null;
}
