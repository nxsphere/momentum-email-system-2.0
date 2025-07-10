import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailQueueItem {
  id: string;
  to_email: string;
  subject: string;
  body_html: string;
  body_text?: string;
  from_email?: string;
  campaign_id?: string;
  scheduled_at: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests for cron triggers
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
    const batchSize = parseInt(Deno.env.get('EMAIL_BATCH_SIZE') || '50');
    const mailtrapToken = Deno.env.get('MAILTRAP_API_TOKEN');

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

    if (!mailtrapToken) {
      console.error('❌ Missing Mailtrap configuration');
      return new Response(
        JSON.stringify({ error: 'Email provider configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📧 Starting email queue processing...', {
      batchSize,
      timestamp: new Date().toISOString()
    });

    // Initialize Supabase client with service role key for full access
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending emails from queue (ordered by priority and created_at)
    const { data: queueItems, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('❌ Failed to fetch email queue:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch email queue' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No pending emails to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending emails to process',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📮 Processing ${queueItems.length} emails...`);

    const result: ProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process emails in parallel (with some concurrency control)
    const concurrency = Math.min(10, queueItems.length);
    const chunks = [];
    for (let i = 0; i < queueItems.length; i += concurrency) {
      chunks.push(queueItems.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(item => processEmailItem(item, supabase, mailtrapToken));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((chunkResult, index) => {
        result.processed++;
        if (chunkResult.status === 'fulfilled' && chunkResult.value.success) {
          result.successful++;
        } else {
          result.failed++;
          const error = chunkResult.status === 'rejected'
            ? chunkResult.reason
            : chunkResult.value.error;
          result.errors.push(`Email ${chunk[index].id}: ${error}`);
        }
      });
    }

    console.log('📊 Email processing completed:', {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      errorCount: result.errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email processing completed',
        result: {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          hasErrors: result.errors.length > 0
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Email processor error:', error);

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

async function processEmailItem(
  item: EmailQueueItem,
  supabase: any,
  mailtrapToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📤 Processing email ${item.id} to ${item.to_email}`);

    // Mark as processing
    await supabase
      .from('email_queue')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    // Send email via Mailtrap API
    const emailPayload = {
      from: {
        email: item.from_email || "funding@momentumbusiness.capital",
        name: "Momentum Business Capital"
      },
      to: [{ email: item.to_email }],
      subject: item.subject,
      html: item.body_html,
      text: item.body_text,
      custom_variables: {
        queue_id: item.id,
        campaign_id: item.campaign_id
      }
    };

    const response = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailtrapToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mailtrap API error: ${response.status} - ${errorText}`);
    }

    const mailtrapResponse = await response.json();
    const messageId = mailtrapResponse.message_id;

    // Update queue item as sent
    await supabase
      .from('email_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    // Create email log entry
    await supabase
      .from('email_logs')
      .insert({
        queue_id: item.id,
        campaign_id: item.campaign_id,
        to_email: item.to_email,
        from_email: item.from_email || "funding@momentumbusiness.capital",
        subject: item.subject,
        status: 'sent',
        mailtrap_message_id: messageId,
        sent_at: new Date().toISOString(),
        tracking_data: {
          queue_processed_at: new Date().toISOString(),
          mailtrap_response: mailtrapResponse
        }
      });

    console.log(`✅ Email ${item.id} sent successfully (Message ID: ${messageId})`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to process email ${item.id}:`, error);

    // Update retry count and status
    const newRetryCount = item.retry_count + 1;
    const newStatus = newRetryCount >= item.max_retries ? 'failed' : 'pending';
    const nextRetryAt = newStatus === 'pending'
      ? new Date(Date.now() + Math.pow(2, newRetryCount) * 60000).toISOString() // Exponential backoff
      : null;

    await supabase
      .from('email_queue')
      .update({
        status: newStatus,
        retry_count: newRetryCount,
        scheduled_at: nextRetryAt,
        updated_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', item.id);

    // Log the failure
    await supabase
      .from('email_logs')
      .insert({
        queue_id: item.id,
        campaign_id: item.campaign_id,
        to_email: item.to_email,
        from_email: item.from_email || "funding@momentumbusiness.capital",
        subject: item.subject,
        status: 'failed',
        error_message: error.message,
        tracking_data: {
          retry_count: newRetryCount,
          failed_at: new Date().toISOString()
        }
      });

    return { success: false, error: error.message };
  }
}
