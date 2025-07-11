-- =============================================
-- EMAIL QUEUE TABLE
-- =============================================
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    template_data JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (
        status IN (
            'pending',
            'processing',
            'sent',
            'failed',
            'cancelled'
        )
    )
);
-- =============================================
-- CAMPAIGN LOGS TABLE  
-- =============================================
CREATE TABLE campaign_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_log_level CHECK (level IN ('debug', 'info', 'warning', 'error'))
);
-- =============================================
-- RATE LIMITING TABLE
-- =============================================
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    limit_key VARCHAR(100) NOT NULL UNIQUE,
    count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_duration_minutes INTEGER DEFAULT 60,
    max_count INTEGER DEFAULT 200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_campaign_id ON email_queue(campaign_id);
CREATE INDEX idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX idx_email_queue_priority ON email_queue(priority DESC);
CREATE INDEX idx_campaign_logs_campaign_id ON campaign_logs(campaign_id);
CREATE INDEX idx_campaign_logs_level ON campaign_logs(level);
CREATE INDEX idx_campaign_logs_created_at ON campaign_logs(created_at);
CREATE INDEX idx_rate_limits_key ON rate_limits(limit_key);
-- =============================================
-- LOGGING HELPER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION log_campaign_event(
        p_campaign_id UUID,
        p_level VARCHAR(20),
        p_message TEXT,
        p_metadata JSONB DEFAULT '{}'
    ) RETURNS VOID AS $$ BEGIN
INSERT INTO campaign_logs (campaign_id, level, message, metadata)
VALUES (p_campaign_id, p_level, p_message, p_metadata);
EXCEPTION
WHEN OTHERS THEN -- Fail silently to prevent logging from breaking main operations
NULL;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- RATE LIMITING FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
        p_limit_key VARCHAR(100),
        p_max_count INTEGER DEFAULT 200,
        p_window_minutes INTEGER DEFAULT 60
    ) RETURNS BOOLEAN AS $$
DECLARE v_current_count INTEGER;
v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN -- Get or create rate limit record
INSERT INTO rate_limits (limit_key, max_count, window_duration_minutes)
VALUES (p_limit_key, p_max_count, p_window_minutes) ON CONFLICT (limit_key) DO NOTHING;
-- Get current rate limit data
SELECT count,
    window_start INTO v_current_count,
    v_window_start
FROM rate_limits
WHERE limit_key = p_limit_key;
-- Check if window has expired
IF v_window_start + (p_window_minutes || ' minutes')::INTERVAL < NOW() THEN -- Reset the window
UPDATE rate_limits
SET count = 0,
    window_start = NOW(),
    updated_at = NOW()
WHERE limit_key = p_limit_key;
v_current_count := 0;
END IF;
-- Check if we're under the limit
IF v_current_count < p_max_count THEN -- Increment counter
UPDATE rate_limits
SET count = count + 1,
    updated_at = NOW()
WHERE limit_key = p_limit_key;
RETURN TRUE;
ELSE RETURN FALSE;
END IF;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- FUNCTION 1: PROCESS EMAIL QUEUE
-- =============================================
CREATE OR REPLACE FUNCTION process_email_queue(p_batch_size INTEGER DEFAULT 50) RETURNS TABLE (
        processed_count INTEGER,
        failed_count INTEGER,
        remaining_count INTEGER
    ) AS $$
DECLARE v_processed_count INTEGER := 0;
v_failed_count INTEGER := 0;
v_remaining_count INTEGER;
v_queue_record RECORD;
v_campaign_record RECORD;
v_contact_record RECORD;
v_template_record RECORD;
v_can_send BOOLEAN;
BEGIN -- Log start of processing
PERFORM log_campaign_event(
    NULL,
    'info',
    'Starting email queue processing',
    jsonb_build_object('batch_size', p_batch_size)
);
-- Process emails in batch
FOR v_queue_record IN
SELECT eq.*,
    ec.name as campaign_name,
    ec.status as campaign_status
FROM email_queue eq
    JOIN email_campaigns ec ON eq.campaign_id = ec.id
WHERE eq.status = 'pending'
    AND eq.scheduled_at <= NOW()
    AND eq.attempts < eq.max_attempts
    AND ec.status = 'running'
ORDER BY eq.priority DESC,
    eq.scheduled_at ASC
LIMIT p_batch_size LOOP BEGIN -- Check rate limit (200 emails per hour)
SELECT check_rate_limit('email_sending', 200, 60) INTO v_can_send;
IF NOT v_can_send THEN PERFORM log_campaign_event(
    v_queue_record.campaign_id,
    'warning',
    'Rate limit reached, stopping queue processing'
);
EXIT;
-- Exit the loop if rate limit is reached
END IF;
-- Update queue record to processing
UPDATE email_queue
SET status = 'processing',
    attempts = attempts + 1
WHERE id = v_queue_record.id;
-- Get campaign details
SELECT * INTO v_campaign_record
FROM email_campaigns
WHERE id = v_queue_record.campaign_id;
-- Get contact details
SELECT * INTO v_contact_record
FROM contacts
WHERE id = v_queue_record.contact_id;
-- Get template details
SELECT * INTO v_template_record
FROM email_templates
WHERE id = v_campaign_record.template_id;
-- Validate all required data exists
IF v_campaign_record IS NULL
OR v_contact_record IS NULL
OR v_template_record IS NULL THEN
UPDATE email_queue
SET status = 'failed',
    error_message = 'Missing campaign, contact, or template data',
    processed_at = NOW()
WHERE id = v_queue_record.id;
v_failed_count := v_failed_count + 1;
CONTINUE;
END IF;
-- Check if contact is still active
IF v_contact_record.status != 'active' THEN
UPDATE email_queue
SET status = 'cancelled',
    error_message = 'Contact is not active: ' || v_contact_record.status,
    processed_at = NOW()
WHERE id = v_queue_record.id;
v_failed_count := v_failed_count + 1;
CONTINUE;
END IF;
-- Create email log entry
INSERT INTO email_logs (
        campaign_id,
        contact_id,
        email,
        status,
        sent_at,
        tracking_data
    )
VALUES (
        v_queue_record.campaign_id,
        v_queue_record.contact_id,
        v_queue_record.email_address,
        'sent',
        NOW(),
        jsonb_build_object(
            'queue_id',
            v_queue_record.id,
            'template_data',
            v_queue_record.template_data
        )
    );
-- Mark queue item as sent
UPDATE email_queue
SET status = 'sent',
    processed_at = NOW()
WHERE id = v_queue_record.id;
-- Update campaign sent count
UPDATE email_campaigns
SET sent_count = sent_count + 1
WHERE id = v_queue_record.campaign_id;
v_processed_count := v_processed_count + 1;
-- Log successful processing
PERFORM log_campaign_event(
    v_queue_record.campaign_id,
    'info',
    'Email queued for sending',
    jsonb_build_object(
        'email',
        v_queue_record.email_address,
        'queue_id',
        v_queue_record.id
    )
);
EXCEPTION
WHEN OTHERS THEN -- Handle any errors
UPDATE email_queue
SET status = CASE
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
    END,
    error_message = SQLERRM,
    processed_at = CASE
        WHEN attempts >= max_attempts THEN NOW()
        ELSE NULL
    END
WHERE id = v_queue_record.id;
v_failed_count := v_failed_count + 1;
PERFORM log_campaign_event(
    v_queue_record.campaign_id,
    'error',
    'Failed to process email: ' || SQLERRM,
    jsonb_build_object(
        'email',
        v_queue_record.email_address,
        'queue_id',
        v_queue_record.id,
        'attempt',
        v_queue_record.attempts + 1
    )
);
END;
END LOOP;
-- Get remaining count
SELECT COUNT(*) INTO v_remaining_count
FROM email_queue
WHERE status = 'pending';
-- Log completion
PERFORM log_campaign_event(
    NULL,
    'info',
    'Email queue processing completed',
    jsonb_build_object(
        'processed',
        v_processed_count,
        'failed',
        v_failed_count,
        'remaining',
        v_remaining_count
    )
);
RETURN QUERY
SELECT v_processed_count,
    v_failed_count,
    v_remaining_count;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- FUNCTION 2: START CAMPAIGN
-- =============================================
CREATE OR REPLACE FUNCTION start_campaign(p_campaign_id UUID) RETURNS TABLE (
        success BOOLEAN,
        message TEXT,
        queued_emails INTEGER
    ) AS $$
DECLARE v_campaign RECORD;
v_template RECORD;
v_contact RECORD;
v_queued_count INTEGER := 0;
v_error_message TEXT;
BEGIN -- Log campaign start attempt
PERFORM log_campaign_event(
    p_campaign_id,
    'info',
    'Attempting to start campaign'
);
-- Get campaign details
SELECT * INTO v_campaign
FROM email_campaigns
WHERE id = p_campaign_id;
-- Validate campaign exists
IF v_campaign IS NULL THEN RETURN QUERY
SELECT FALSE,
    'Campaign not found',
    0;
RETURN;
END IF;
-- Validate campaign status
IF v_campaign.status NOT IN ('draft', 'scheduled') THEN v_error_message := 'Campaign cannot be started. Current status: ' || v_campaign.status;
PERFORM log_campaign_event(p_campaign_id, 'error', v_error_message);
RETURN QUERY
SELECT FALSE,
    v_error_message,
    0;
RETURN;
END IF;
-- Get template details
SELECT * INTO v_template
FROM email_templates
WHERE id = v_campaign.template_id;
-- Validate template exists
IF v_template IS NULL THEN v_error_message := 'Email template not found for campaign';
PERFORM log_campaign_event(p_campaign_id, 'error', v_error_message);
RETURN QUERY
SELECT FALSE,
    v_error_message,
    0;
RETURN;
END IF;
BEGIN -- Update campaign status to running
UPDATE email_campaigns
SET status = 'running',
    total_recipients = (
        SELECT COUNT(*)
        FROM contacts
        WHERE status = 'active'
    )
WHERE id = p_campaign_id;
-- Create queue entries for all active contacts
FOR v_contact IN
SELECT *
FROM contacts
WHERE status = 'active' LOOP
INSERT INTO email_queue (
        campaign_id,
        contact_id,
        email_address,
        template_data,
        priority
    )
VALUES (
        p_campaign_id,
        v_contact.id,
        v_contact.email,
        jsonb_build_object(
            'first_name',
            COALESCE(v_contact.first_name, ''),
            'last_name',
            COALESCE(v_contact.last_name, ''),
            'email',
            v_contact.email,
            'metadata',
            v_contact.metadata
        ),
        0
    );
v_queued_count := v_queued_count + 1;
END LOOP;
-- Log successful start
PERFORM log_campaign_event(
    p_campaign_id,
    'info',
    'Campaign started successfully',
    jsonb_build_object(
        'queued_emails',
        v_queued_count,
        'template_id',
        v_campaign.template_id
    )
);
RETURN QUERY
SELECT TRUE,
    'Campaign started successfully',
    v_queued_count;
EXCEPTION
WHEN OTHERS THEN -- Rollback campaign status on error
UPDATE email_campaigns
SET status = v_campaign.status
WHERE id = p_campaign_id;
v_error_message := 'Failed to start campaign: ' || SQLERRM;
PERFORM log_campaign_event(p_campaign_id, 'error', v_error_message);
RETURN QUERY
SELECT FALSE,
    v_error_message,
    0;
END;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- FUNCTION 3: UPDATE EMAIL STATUS
-- =============================================
CREATE OR REPLACE FUNCTION update_email_status(
        p_message_id TEXT,
        p_status TEXT,
        p_tracking_data JSONB DEFAULT '{}'
    ) RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE v_log_record RECORD;
v_current_time TIMESTAMP WITH TIME ZONE := NOW();
v_error_message TEXT;
BEGIN -- Validate status
IF p_status NOT IN (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'failed'
) THEN RETURN QUERY
SELECT FALSE,
    'Invalid email status: ' || p_status;
RETURN;
END IF;
-- Find email log by message_id
SELECT * INTO v_log_record
FROM email_logs
WHERE mailtrap_message_id = p_message_id
    OR tracking_data->>'message_id' = p_message_id
ORDER BY sent_at DESC
LIMIT 1;
IF v_log_record IS NULL THEN RETURN QUERY
SELECT FALSE,
    'Email log not found for message_id: ' || p_message_id;
RETURN;
END IF;
BEGIN -- Update email log with new status and timestamp
UPDATE email_logs
SET status = p_status,
    delivered_at = CASE
        WHEN p_status = 'delivered' THEN v_current_time
        ELSE delivered_at
    END,
    opened_at = CASE
        WHEN p_status = 'opened' THEN v_current_time
        ELSE opened_at
    END,
    clicked_at = CASE
        WHEN p_status = 'clicked' THEN v_current_time
        ELSE clicked_at
    END,
    bounce_reason = CASE
        WHEN p_status = 'bounced' THEN p_tracking_data->>'reason'
        ELSE bounce_reason
    END,
    tracking_data = tracking_data || p_tracking_data
WHERE id = v_log_record.id;
-- If bounced, handle bounce processing
IF p_status = 'bounced' THEN PERFORM handle_bounce(
    v_log_record.email,
    COALESCE(p_tracking_data->>'reason', 'Email bounced')
);
END IF;
-- Log the status update
PERFORM log_campaign_event(
    v_log_record.campaign_id,
    'info',
    'Email status updated to: ' || p_status,
    jsonb_build_object(
        'email',
        v_log_record.email,
        'message_id',
        p_message_id,
        'tracking_data',
        p_tracking_data
    )
);
RETURN QUERY
SELECT TRUE,
    'Email status updated successfully';
EXCEPTION
WHEN OTHERS THEN v_error_message := 'Failed to update email status: ' || SQLERRM;
PERFORM log_campaign_event(
    v_log_record.campaign_id,
    'error',
    v_error_message
);
RETURN QUERY
SELECT FALSE,
    v_error_message;
END;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- FUNCTION 4: GET ENHANCED CAMPAIGN STATS
-- =============================================
CREATE OR REPLACE FUNCTION get_enhanced_campaign_stats(p_campaign_id UUID) RETURNS TABLE (
        campaign_name TEXT,
        campaign_status campaign_status,
        total_sent BIGINT,
        total_delivered BIGINT,
        total_opened BIGINT,
        total_clicked BIGINT,
        total_bounced BIGINT,
        total_failed BIGINT,
        delivery_rate DECIMAL(5, 2),
        open_rate DECIMAL(5, 2),
        click_rate DECIMAL(5, 2),
        bounce_rate DECIMAL(5, 2),
        queue_pending BIGINT,
        queue_failed BIGINT,
        last_activity TIMESTAMP WITH TIME ZONE
    ) AS $$ BEGIN RETURN QUERY
SELECT ec.name as campaign_name,
    ec.status as campaign_status,
    COUNT(el.*) as total_sent,
    COUNT(el.*) FILTER (
        WHERE el.status = 'delivered'
    ) as total_delivered,
    COUNT(el.*) FILTER (
        WHERE el.status = 'opened'
    ) as total_opened,
    COUNT(el.*) FILTER (
        WHERE el.status = 'clicked'
    ) as total_clicked,
    COUNT(el.*) FILTER (
        WHERE el.status = 'bounced'
    ) as total_bounced,
    COUNT(el.*) FILTER (
        WHERE el.status = 'failed'
    ) as total_failed,
    ROUND(
        (
            COUNT(el.*) FILTER (
                WHERE el.status = 'delivered'
            )
        )::DECIMAL / NULLIF(COUNT(el.*), 0) * 100,
        2
    ) as delivery_rate,
    ROUND(
        (
            COUNT(el.*) FILTER (
                WHERE el.status = 'opened'
            )
        )::DECIMAL / NULLIF(
            COUNT(el.*) FILTER (
                WHERE el.status = 'delivered'
            ),
            0
        ) * 100,
        2
    ) as open_rate,
    ROUND(
        (
            COUNT(el.*) FILTER (
                WHERE el.status = 'clicked'
            )
        )::DECIMAL / NULLIF(
            COUNT(el.*) FILTER (
                WHERE el.status = 'delivered'
            ),
            0
        ) * 100,
        2
    ) as click_rate,
    ROUND(
        (
            COUNT(el.*) FILTER (
                WHERE el.status = 'bounced'
            )
        )::DECIMAL / NULLIF(COUNT(el.*), 0) * 100,
        2
    ) as bounce_rate,
    (
        SELECT COUNT(*)
        FROM email_queue eq
        WHERE eq.campaign_id = p_campaign_id
            AND eq.status = 'pending'
    ) as queue_pending,
    (
        SELECT COUNT(*)
        FROM email_queue eq
        WHERE eq.campaign_id = p_campaign_id
            AND eq.status = 'failed'
    ) as queue_failed,
    GREATEST(
        MAX(el.sent_at),
        MAX(el.delivered_at),
        MAX(el.opened_at),
        MAX(el.clicked_at)
    ) as last_activity
FROM email_campaigns ec
    LEFT JOIN email_logs el ON ec.id = el.campaign_id
WHERE ec.id = p_campaign_id
GROUP BY ec.id,
    ec.name,
    ec.status;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- FUNCTION 5: HANDLE BOUNCE
-- =============================================
CREATE OR REPLACE FUNCTION handle_bounce(p_email TEXT, p_reason TEXT) RETURNS TABLE (
        success BOOLEAN,
        message TEXT,
        action_taken TEXT
    ) AS $$
DECLARE v_contact RECORD;
v_bounce_type TEXT;
v_action TEXT;
v_error_message TEXT;
BEGIN -- Get contact information
SELECT * INTO v_contact
FROM contacts
WHERE email = p_email;
IF v_contact IS NULL THEN RETURN QUERY
SELECT FALSE,
    'Contact not found for email: ' || p_email,
    'none';
RETURN;
END IF;
-- Determine bounce type and action
IF p_reason ILIKE '%permanent%'
OR p_reason ILIKE '%invalid%'
OR p_reason ILIKE '%not found%' THEN v_bounce_type := 'hard';
v_action := 'contact_bounced';
ELSIF p_reason ILIKE '%temporary%'
OR p_reason ILIKE '%mailbox full%'
OR p_reason ILIKE '%deferred%' THEN v_bounce_type := 'soft';
v_action := 'retry_later';
ELSE v_bounce_type := 'unknown';
v_action := 'contact_bounced';
-- Default to hard bounce for safety
END IF;
BEGIN -- Handle hard bounces or unknown bounces
IF v_bounce_type IN ('hard', 'unknown') THEN -- Update contact status to bounced
UPDATE contacts
SET status = 'bounced',
    metadata = metadata || jsonb_build_object(
        'bounce_reason',
        p_reason,
        'bounce_type',
        v_bounce_type,
        'bounced_at',
        NOW()::text
    )
WHERE email = p_email;
-- Cancel any pending emails for this contact
UPDATE email_queue
SET status = 'cancelled',
    error_message = 'Contact bounced: ' || p_reason,
    processed_at = NOW()
WHERE email_address = p_email
    AND status = 'pending';
ELSE -- For soft bounces, just update metadata but keep contact active
UPDATE contacts
SET metadata = metadata || jsonb_build_object(
        'last_soft_bounce',
        p_reason,
        'last_soft_bounce_at',
        NOW()::text,
        'soft_bounce_count',
        COALESCE((metadata->>'soft_bounce_count')::INTEGER, 0) + 1
    )
WHERE email = p_email;
END IF;
-- Log the bounce handling
PERFORM log_campaign_event(
    NULL,
    'info',
    'Bounce handled for email: ' || p_email,
    jsonb_build_object(
        'email',
        p_email,
        'reason',
        p_reason,
        'bounce_type',
        v_bounce_type,
        'action_taken',
        v_action
    )
);
RETURN QUERY
SELECT TRUE,
    'Bounce handled successfully',
    v_action;
EXCEPTION
WHEN OTHERS THEN v_error_message := 'Failed to handle bounce: ' || SQLERRM;
PERFORM log_campaign_event(NULL, 'error', v_error_message);
RETURN QUERY
SELECT FALSE,
    v_error_message,
    'error';
END;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- CLEANUP FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_old_data(p_days_old INTEGER DEFAULT 90) RETURNS TABLE (
        logs_deleted INTEGER,
        queue_deleted INTEGER
    ) AS $$
DECLARE v_logs_deleted INTEGER;
v_queue_deleted INTEGER;
BEGIN -- Delete old campaign logs
DELETE FROM campaign_logs
WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
-- Delete old completed/failed queue items
DELETE FROM email_queue
WHERE processed_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND status IN ('sent', 'failed', 'cancelled');
GET DIAGNOSTICS v_queue_deleted = ROW_COUNT;
RETURN QUERY
SELECT v_logs_deleted,
    v_queue_deleted;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- RLS POLICIES FOR NEW TABLES
-- =============================================
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Email queue policies
CREATE POLICY "Users can view email queue" ON email_queue FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage email queue" ON email_queue FOR ALL TO authenticated USING (true);
-- Campaign logs policies  
CREATE POLICY "Users can view campaign logs" ON campaign_logs FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign logs" ON campaign_logs FOR
INSERT TO authenticated WITH CHECK (true);
-- Rate limits policies
CREATE POLICY "Users can view rate limits" ON rate_limits FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage rate limits" ON rate_limits FOR ALL TO authenticated USING (true);
-- =============================================
-- SAMPLE USAGE EXAMPLES (COMMENTED OUT)
-- =============================================
/*
 -- Start a campaign
 SELECT * FROM start_campaign('your-campaign-uuid-here');
 
 -- Process email queue
 SELECT * FROM process_email_queue(25);
 
 -- Update email status from webhook
 SELECT * FROM update_email_status('message-id-123', 'delivered', '{"ip": "1.2.3.4"}');
 
 -- Get campaign statistics
 SELECT * FROM get_enhanced_campaign_stats('your-campaign-uuid-here');
 
 -- Handle a bounce
 SELECT * FROM handle_bounce('user@example.com', 'Mailbox does not exist');
 
 -- Cleanup old data
 SELECT * FROM cleanup_old_data(30);
 */