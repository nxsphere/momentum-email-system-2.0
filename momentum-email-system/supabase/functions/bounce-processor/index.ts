import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BounceNotification {
  email: string;
  bounce_type: 'hard' | 'soft' | 'spam' | 'complaint';
  bounce_reason?: string;
  bounce_code?: string;
  timestamp: string;
  message_id?: string;
  campaign_id?: string;
  provider: string;
  raw_data?: any;
}

interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  hardBounces: number;
  softBounces: number;
  spamComplaints: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests for bounce processing
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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

    console.log('🔄 Starting bounce processor...', {
      timestamp: new Date().toISOString()
    });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending bounce notifications to process
    const { data: bounceNotifications, error: fetchError } = await supabase
      .from('bounce_notifications')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(1000); // Process up to 1000 bounces at a time

    if (fetchError) {
      console.error('❌ Failed to fetch bounce notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bounce notifications' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!bounceNotifications || bounceNotifications.length === 0) {
      console.log('✅ No pending bounce notifications to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending bounce notifications',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📧 Processing ${bounceNotifications.length} bounce notifications...`);

    const result: ProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      hardBounces: 0,
      softBounces: 0,
      spamComplaints: 0,
      errors: []
    };

    // Process bounce notifications in parallel (with concurrency control)
    const concurrency = Math.min(20, bounceNotifications.length);
    const chunks = [];
    for (let i = 0; i < bounceNotifications.length; i += concurrency) {
      chunks.push(bounceNotifications.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(notification => processBounceNotification(notification, supabase));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((chunkResult, index) => {
        result.processed++;
        if (chunkResult.status === 'fulfilled' && chunkResult.value.success) {
          result.successful++;
          const bounceType = chunk[index].bounce_type;
          if (bounceType === 'hard') result.hardBounces++;
          else if (bounceType === 'soft') result.softBounces++;
          else if (bounceType === 'spam' || bounceType === 'complaint') result.spamComplaints++;
        } else {
          result.failed++;
          const error = chunkResult.status === 'rejected'
            ? chunkResult.reason
            : chunkResult.value.error;
          result.errors.push(`Notification ${chunk[index].id}: ${error}`);
        }
      });
    }

    console.log('📊 Bounce processing completed:', {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      hardBounces: result.hardBounces,
      softBounces: result.softBounces,
      spamComplaints: result.spamComplaints,
      errorCount: result.errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bounce processing completed',
        result: {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          hardBounces: result.hardBounces,
          softBounces: result.softBounces,
          spamComplaints: result.spamComplaints,
          hasErrors: result.errors.length > 0
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Bounce processor error:', error);

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

async function processBounceNotification(
  notification: any,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📮 Processing bounce for ${notification.email} (${notification.bounce_type})`);

    // Mark notification as being processed
    await supabase
      .from('bounce_notifications')
      .update({
        processing: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    // Update contact status based on bounce type
    const contactUpdate = await updateContactStatus(notification, supabase);
    if (!contactUpdate.success) {
      throw new Error(`Failed to update contact: ${contactUpdate.error}`);
    }

    // Update email logs if message_id is available
    if (notification.message_id) {
      await updateEmailLogs(notification, supabase);
    }

    // Handle campaign-specific bounce processing
    if (notification.campaign_id) {
      await updateCampaignBounceStats(notification, supabase);
    }

    // Create bounce event record for analytics
    await createBounceEvent(notification, supabase);

    // Check if contact should be suppressed
    await checkAndSuppressContact(notification, supabase);

    // Mark notification as processed
    await supabase
      .from('bounce_notifications')
      .update({
        processed: true,
        processing: false,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    console.log(`✅ Bounce processed for ${notification.email}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to process bounce for ${notification.email}:`, error);

    // Update notification with error
    await supabase
      .from('bounce_notifications')
      .update({
        processing: false,
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return { success: false, error: error.message };
  }
}

async function updateContactStatus(
  notification: any,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (notification.bounce_type) {
      case 'hard':
        updateData.email_status = 'bounced';
        updateData.is_subscribed = false;
        updateData.bounced_at = new Date(notification.timestamp).toISOString();
        updateData.bounce_count = supabase.rpc('increment_bounce_count', { email: notification.email });
        break;

      case 'soft':
        updateData.email_status = 'soft_bounce';
        updateData.last_soft_bounce_at = new Date(notification.timestamp).toISOString();
        updateData.soft_bounce_count = supabase.rpc('increment_soft_bounce_count', { email: notification.email });
        break;

      case 'spam':
      case 'complaint':
        updateData.email_status = 'spam';
        updateData.is_subscribed = false;
        updateData.spam_complaint_at = new Date(notification.timestamp).toISOString();
        break;

      default:
        console.warn(`Unknown bounce type: ${notification.bounce_type}`);
        return { success: true }; // Don't fail for unknown types
    }

    const { error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('email', notification.email);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateEmailLogs(notification: any, supabase: any) {
  try {
    const bounceStatus = notification.bounce_type === 'hard' ? 'bounced' : 'soft_bounce';

    await supabase
      .from('email_logs')
      .update({
        status: bounceStatus,
        bounced_at: new Date(notification.timestamp).toISOString(),
        bounce_reason: notification.bounce_reason,
        bounce_code: notification.bounce_code,
        updated_at: new Date().toISOString()
      })
      .eq('mailtrap_message_id', notification.message_id);

  } catch (error) {
    console.warn(`Failed to update email logs for message ${notification.message_id}:`, error);
    // Don't throw - this is not critical
  }
}

async function updateCampaignBounceStats(notification: any, supabase: any) {
  try {
    const statField = notification.bounce_type === 'hard' ? 'hard_bounces' : 'soft_bounces';

    await supabase.rpc('increment_campaign_stat', {
      campaign_id: notification.campaign_id,
      stat_field: statField
    });

  } catch (error) {
    console.warn(`Failed to update campaign bounce stats for campaign ${notification.campaign_id}:`, error);
    // Don't throw - this is not critical
  }
}

async function createBounceEvent(notification: any, supabase: any) {
  try {
    await supabase
      .from('bounce_events')
      .insert({
        email: notification.email,
        bounce_type: notification.bounce_type,
        bounce_reason: notification.bounce_reason,
        bounce_code: notification.bounce_code,
        message_id: notification.message_id,
        campaign_id: notification.campaign_id,
        provider: notification.provider,
        bounced_at: new Date(notification.timestamp).toISOString(),
        raw_data: notification.raw_data,
        created_at: new Date().toISOString()
      });

  } catch (error) {
    console.warn(`Failed to create bounce event for ${notification.email}:`, error);
    // Don't throw - this is for analytics only
  }
}

async function checkAndSuppressContact(notification: any, supabase: any) {
  try {
    // Get contact's bounce history
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('bounce_count, soft_bounce_count, email_status')
      .eq('email', notification.email)
      .single();

    if (error || !contact) {
      console.warn(`Could not fetch contact data for ${notification.email}`);
      return;
    }

    // Suppress contact if they have too many soft bounces
    if (contact.soft_bounce_count >= 5 && contact.email_status !== 'bounced') {
      await supabase
        .from('contacts')
        .update({
          email_status: 'bounced',
          is_subscribed: false,
          bounced_at: new Date().toISOString(),
          bounce_reason: 'Too many soft bounces',
          updated_at: new Date().toISOString()
        })
        .eq('email', notification.email);

      console.log(`🚫 Contact ${notification.email} suppressed due to excessive soft bounces`);
    }

    // Add to global suppression list for hard bounces and spam complaints
    if (notification.bounce_type === 'hard' || notification.bounce_type === 'spam' || notification.bounce_type === 'complaint') {
      await supabase
        .from('suppression_list')
        .upsert({
          email: notification.email,
          reason: notification.bounce_type,
          suppressed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        });

      console.log(`🚫 Email ${notification.email} added to suppression list`);
    }

  } catch (error) {
    console.warn(`Failed to check suppression for ${notification.email}:`, error);
    // Don't throw - this is not critical
  }
}
