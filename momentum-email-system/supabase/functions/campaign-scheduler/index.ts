import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  template_id: string;
  segment_id?: string;
  from_email: string;
  from_name: string;
  status: string;
  scheduled_at: string;
  total_recipients?: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface CampaignRecipient {
  email: string;
  name?: string;
  variables?: Record<string, any>;
}

interface SchedulingResult {
  processed: number;
  successful: number;
  failed: number;
  totalEmailsQueued: number;
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
    const batchSize = parseInt(Deno.env.get('CAMPAIGN_BATCH_SIZE') || '100');

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

    console.log('📅 Starting campaign scheduler...', {
      batchSize,
      timestamp: new Date().toISOString()
    });

    // Initialize Supabase client with service role key for full access
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get scheduled campaigns that are ready to start
    const currentTime = new Date().toISOString();
    const { data: scheduledCampaigns, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', currentTime)
      .order('scheduled_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('❌ Failed to fetch scheduled campaigns:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch scheduled campaigns' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      console.log('✅ No scheduled campaigns ready to start');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No scheduled campaigns ready to start',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📨 Processing ${scheduledCampaigns.length} scheduled campaigns...`);

    const result: SchedulingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalEmailsQueued: 0,
      errors: []
    };

    // Process each campaign
    for (const campaign of scheduledCampaigns) {
      const campaignResult = await processCampaign(campaign, supabase);
      result.processed++;

      if (campaignResult.success) {
        result.successful++;
        result.totalEmailsQueued += campaignResult.emailsQueued || 0;
      } else {
        result.failed++;
        result.errors.push(`Campaign ${campaign.id}: ${campaignResult.error}`);
      }
    }

    console.log('📊 Campaign scheduling completed:', {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      totalEmailsQueued: result.totalEmailsQueued,
      errorCount: result.errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campaign scheduling completed',
        result: {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
          totalEmailsQueued: result.totalEmailsQueued,
          hasErrors: result.errors.length > 0
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Campaign scheduler error:', error);

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

async function processCampaign(
  campaign: EmailCampaign,
  supabase: any
): Promise<{ success: boolean; error?: string; emailsQueued?: number }> {
  try {
    console.log(`📧 Processing campaign: ${campaign.name} (${campaign.id})`);

    // Mark campaign as processing
    await supabase
      .from('email_campaigns')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    // Get campaign template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', campaign.template_id)
      .single();

    if (templateError || !template) {
      throw new Error(`Template not found: ${campaign.template_id}`);
    }

    // Get recipients based on segment or all contacts
    let recipients: CampaignRecipient[] = [];

    if (campaign.segment_id) {
      // Get recipients from specific segment
      const { data: segmentContacts, error: segmentError } = await supabase
        .from('contact_segments')
        .select(`
          contacts (
            email,
            name,
            variables
          )
        `)
        .eq('segment_id', campaign.segment_id)
        .eq('contacts.is_subscribed', true)
        .not('contacts.email_status', 'in', '(bounced,spam)')
        .not('contacts.email', 'is', null);

      if (segmentError) {
        throw new Error(`Failed to fetch segment contacts: ${segmentError.message}`);
      }

      recipients = segmentContacts?.map(sc => ({
        email: sc.contacts.email,
        name: sc.contacts.name,
        variables: sc.contacts.variables
      })) || [];

    } else {
      // Get all active contacts
      const { data: allContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('email, name, variables')
        .eq('is_subscribed', true)
        .not('email_status', 'in', '(bounced,spam)')
        .not('email', 'is', null);

      if (contactsError) {
        throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
      }

      recipients = allContacts || [];
    }

    if (recipients.length === 0) {
      throw new Error('No valid recipients found for campaign');
    }

    console.log(`📮 Queueing ${recipients.length} emails for campaign ${campaign.name}`);

    // Create email queue entries for all recipients
    const queueEntries = recipients.map((recipient, index) => ({
      campaign_id: campaign.id,
      to_email: recipient.email,
      from_email: campaign.from_email,
      subject: campaign.subject,
      body_html: template.body_html,
      body_text: template.body_text,
      template_variables: {
        ...template.default_variables,
        ...recipient.variables,
        recipient_name: recipient.name,
        campaign_name: campaign.name
      },
      priority: campaign.priority,
      scheduled_at: new Date(Date.now() + (index * 1000)).toISOString(), // Stagger sends by 1 second
      retry_count: 0,
      max_retries: 3,
      status: 'pending'
    }));

    // Insert emails into queue in batches to avoid payload size limits
    const insertBatchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < queueEntries.length; i += insertBatchSize) {
      const batch = queueEntries.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('email_queue')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert email batch: ${insertError.message}`);
      }

      totalInserted += batch.length;
      console.log(`📤 Inserted batch ${Math.ceil((i + 1) / insertBatchSize)} of ${Math.ceil(queueEntries.length / insertBatchSize)} (${totalInserted}/${queueEntries.length} emails)`);
    }

    // Update campaign status to 'running'
    await supabase
      .from('email_campaigns')
      .update({
        status: 'running',
        total_recipients: recipients.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    console.log(`✅ Campaign ${campaign.name} started successfully with ${recipients.length} emails queued`);
    return { success: true, emailsQueued: recipients.length };

  } catch (error) {
    console.error(`❌ Failed to process campaign ${campaign.id}:`, error);

    // Update campaign status to 'failed'
    await supabase
      .from('email_campaigns')
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    return { success: false, error: error.message };
  }
}

// Helper function to validate campaign before processing
async function validateCampaign(campaign: EmailCampaign, supabase: any): Promise<boolean> {
  try {
    // Check if template exists
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('id')
      .eq('id', campaign.template_id)
      .single();

    if (templateError || !template) {
      console.error(`Template validation failed for campaign ${campaign.id}: Template ${campaign.template_id} not found`);
      return false;
    }

    // Check if segment exists (if specified)
    if (campaign.segment_id) {
      const { data: segment, error: segmentError } = await supabase
        .from('segments')
        .select('id')
        .eq('id', campaign.segment_id)
        .single();

      if (segmentError || !segment) {
        console.error(`Segment validation failed for campaign ${campaign.id}: Segment ${campaign.segment_id} not found`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Campaign validation error for ${campaign.id}:`, error);
    return false;
  }
}
