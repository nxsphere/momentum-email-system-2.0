-- =============================================
-- WEBHOOK SYSTEM MIGRATION
-- =============================================
-- This migration creates tables and functions for comprehensive webhook processing
-- Webhook Events Table - Tracks all incoming webhook events
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL DEFAULT 'mailtrap',
  event_type VARCHAR(50) NOT NULL,
  message_id VARCHAR(255),
  email VARCHAR(255),
  payload JSONB NOT NULL,
  signature VARCHAR(512),
  processed_successfully BOOLEAN DEFAULT false,
  duplicate_count INTEGER DEFAULT 0,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Contact Status Updates Table - Tracks automated contact status changes
CREATE TABLE contact_status_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  old_status contact_status NOT NULL,
  new_status contact_status NOT NULL,
  reason TEXT NOT NULL,
  triggered_by VARCHAR(100),
  -- 'webhook:bounce', 'webhook:unsubscribe', etc.
  webhook_event_id UUID REFERENCES webhook_events(id) ON DELETE
  SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Automated Actions Table - Tracks all automated actions triggered by webhooks
CREATE TABLE automated_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type VARCHAR(50) NOT NULL,
  target_id UUID,
  -- Contact ID, Segment ID, List ID, etc.
  metadata JSONB DEFAULT '{}',
  triggered_by VARCHAR(100) NOT NULL,
  webhook_event_id UUID REFERENCES webhook_events(id) ON DELETE
  SET NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Email Tracking Details Table - Extended tracking for opens and clicks
CREATE TABLE email_tracking_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_log_id UUID NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL,
  -- 'open', 'click', 'unsubscribe'
  user_agent TEXT,
  ip_address INET,
  location_data JSONB DEFAULT '{}',
  url VARCHAR(2048),
  -- For click events
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  webhook_event_id UUID REFERENCES webhook_events(id) ON DELETE
  SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_webhook_events_provider_event ON webhook_events(provider, event_type);
CREATE INDEX idx_webhook_events_message_id ON webhook_events(message_id);
CREATE INDEX idx_webhook_events_email ON webhook_events(email);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed_successfully, received_at);
CREATE INDEX idx_contact_status_updates_contact_id ON contact_status_updates(contact_id);
CREATE INDEX idx_contact_status_updates_triggered_by ON contact_status_updates(triggered_by);
CREATE INDEX idx_contact_status_updates_created_at ON contact_status_updates(created_at);
CREATE INDEX idx_automated_actions_action_type ON automated_actions(action_type);
CREATE INDEX idx_automated_actions_target_id ON automated_actions(target_id);
CREATE INDEX idx_automated_actions_triggered_by ON automated_actions(triggered_by);
CREATE INDEX idx_automated_actions_created_at ON automated_actions(created_at);
CREATE INDEX idx_email_tracking_details_email_log_id ON email_tracking_details(email_log_id);
CREATE INDEX idx_email_tracking_details_event_type ON email_tracking_details(event_type);
CREATE INDEX idx_email_tracking_details_timestamp ON email_tracking_details(event_timestamp);
-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_details ENABLE ROW LEVEL SECURITY;
-- Webhook events policies
CREATE POLICY "Users can view webhook events" ON webhook_events FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage webhook events" ON webhook_events FOR ALL TO service_role USING (true);
-- Contact status updates policies
CREATE POLICY "Users can view contact status updates" ON contact_status_updates FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage contact status updates" ON contact_status_updates FOR ALL TO service_role USING (true);
-- Automated actions policies
CREATE POLICY "Users can view automated actions" ON automated_actions FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage automated actions" ON automated_actions FOR ALL TO service_role USING (true);
-- Email tracking details policies
CREATE POLICY "Users can view email tracking details" ON email_tracking_details FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage email tracking details" ON email_tracking_details FOR ALL TO service_role USING (true);
-- =============================================
-- WEBHOOK PROCESSING FUNCTIONS
-- =============================================
-- Function to check for duplicate webhook events
CREATE OR REPLACE FUNCTION check_webhook_duplicate(
    p_provider TEXT,
    p_event_type TEXT,
    p_message_id TEXT,
    p_payload JSONB
  ) RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_event_id UUID,
    duplicate_count INTEGER
  ) AS $$
DECLARE v_existing_event RECORD;
v_duplicate_count INTEGER := 0;
BEGIN -- Look for existing events with same message_id and event_type
SELECT id,
  duplicate_count INTO v_existing_event
FROM webhook_events
WHERE provider = p_provider
  AND event_type = p_event_type
  AND message_id = p_message_id
  AND received_at > NOW() - INTERVAL '24 hours' -- Only check last 24 hours
ORDER BY received_at DESC
LIMIT 1;
IF v_existing_event.id IS NOT NULL THEN -- Update duplicate count
v_duplicate_count := v_existing_event.duplicate_count + 1;
UPDATE webhook_events
SET duplicate_count = v_duplicate_count,
  received_at = NOW() -- Update last received time
WHERE id = v_existing_event.id;
RETURN QUERY
SELECT true,
  v_existing_event.id,
  v_duplicate_count;
ELSE RETURN QUERY
SELECT false,
  NULL::UUID,
  0;
END IF;
END;
$$ LANGUAGE plpgsql;
-- Function to log automated action
CREATE OR REPLACE FUNCTION log_automated_action(
    p_action_type TEXT,
    p_target_id UUID,
    p_metadata JSONB,
    p_triggered_by TEXT,
    p_webhook_event_id UUID,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
  ) RETURNS UUID AS $$
DECLARE v_action_id UUID;
BEGIN
INSERT INTO automated_actions (
    action_type,
    target_id,
    metadata,
    triggered_by,
    webhook_event_id,
    success,
    error_message
  )
VALUES (
    p_action_type,
    p_target_id,
    p_metadata,
    p_triggered_by,
    p_webhook_event_id,
    p_success,
    p_error_message
  )
RETURNING id INTO v_action_id;
RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;
-- Function to update contact status with logging
CREATE OR REPLACE FUNCTION update_contact_status_with_log(
    p_contact_id UUID,
    p_new_status contact_status,
    p_reason TEXT,
    p_triggered_by TEXT,
    p_webhook_event_id UUID DEFAULT NULL
  ) RETURNS TABLE (
    success BOOLEAN,
    old_status contact_status,
    message TEXT
  ) AS $$
DECLARE v_contact RECORD;
v_action_id UUID;
BEGIN -- Get current contact status
SELECT * INTO v_contact
FROM contacts
WHERE id = p_contact_id;
IF v_contact IS NULL THEN RETURN QUERY
SELECT false,
  NULL::contact_status,
  'Contact not found';
RETURN;
END IF;
-- Don't update if status is the same
IF v_contact.status = p_new_status THEN RETURN QUERY
SELECT true,
  v_contact.status,
  'Status unchanged';
RETURN;
END IF;
BEGIN -- Update contact status
UPDATE contacts
SET status = p_new_status,
  updated_at = NOW()
WHERE id = p_contact_id;
-- Log the status change
INSERT INTO contact_status_updates (
    contact_id,
    old_status,
    new_status,
    reason,
    triggered_by,
    webhook_event_id
  )
VALUES (
    p_contact_id,
    v_contact.status,
    p_new_status,
    p_reason,
    p_triggered_by,
    p_webhook_event_id
  );
-- Log as automated action
v_action_id := log_automated_action(
  'update_contact_status',
  p_contact_id,
  jsonb_build_object(
    'old_status',
    v_contact.status,
    'new_status',
    p_new_status,
    'reason',
    p_reason
  ),
  p_triggered_by,
  p_webhook_event_id
);
RETURN QUERY
SELECT true,
  v_contact.status,
  'Contact status updated successfully';
EXCEPTION
WHEN OTHERS THEN -- Log failed action
v_action_id := log_automated_action(
  'update_contact_status',
  p_contact_id,
  jsonb_build_object(
    'old_status',
    v_contact.status,
    'new_status',
    p_new_status,
    'reason',
    p_reason,
    'error',
    SQLERRM
  ),
  p_triggered_by,
  p_webhook_event_id,
  false,
  SQLERRM
);
RETURN QUERY
SELECT false,
  v_contact.status,
  'Failed to update contact status: ' || SQLERRM;
END;
END;
$$ LANGUAGE plpgsql;
-- Function to process bounce events with automated actions
CREATE OR REPLACE FUNCTION process_bounce_event(
    p_email TEXT,
    p_bounce_type TEXT,
    p_bounce_reason TEXT,
    p_webhook_event_id UUID
  ) RETURNS TABLE (
    success BOOLEAN,
    actions_performed TEXT [],
    message TEXT
  ) AS $$
DECLARE v_contact RECORD;
v_new_status contact_status;
v_actions TEXT [] := ARRAY []::TEXT [];
v_result RECORD;
BEGIN -- Find contact by email
SELECT * INTO v_contact
FROM contacts
WHERE email = p_email;
IF v_contact IS NULL THEN RETURN QUERY
SELECT false,
  v_actions,
  'Contact not found for email: ' || p_email;
RETURN;
END IF;
-- Determine action based on bounce type
IF p_bounce_type IN ('hard', 'permanent') THEN v_new_status := 'bounced';
v_actions := array_append(v_actions, 'hard_bounce_contact_status_update');
ELSIF p_bounce_type IN ('soft', 'temporary') THEN -- For soft bounces, we might not change status immediately
-- Could implement a counter here for repeated soft bounces
v_actions := array_append(v_actions, 'soft_bounce_logged');
RETURN QUERY
SELECT true,
  v_actions,
  'Soft bounce logged, contact status unchanged';
RETURN;
ELSE -- Unknown bounce type, treat as hard bounce for safety
v_new_status := 'bounced';
v_actions := array_append(v_actions, 'unknown_bounce_treated_as_hard');
END IF;
-- Update contact status for hard bounces
SELECT * INTO v_result
FROM update_contact_status_with_log(
    v_contact.id,
    v_new_status,
    format(
      'Email bounced: %s (%s)',
      p_bounce_reason,
      p_bounce_type
    ),
    format('webhook:bounce:%s', p_bounce_type),
    p_webhook_event_id
  );
IF v_result.success THEN v_actions := array_append(v_actions, 'contact_status_updated');
RETURN QUERY
SELECT true,
  v_actions,
  'Bounce processed successfully';
ELSE RETURN QUERY
SELECT false,
  v_actions,
  v_result.message;
END IF;
END;
$$ LANGUAGE plpgsql;
-- Function to process unsubscribe events
CREATE OR REPLACE FUNCTION process_unsubscribe_event(
    p_email TEXT,
    p_unsubscribe_type TEXT,
    p_webhook_event_id UUID
  ) RETURNS TABLE (
    success BOOLEAN,
    actions_performed TEXT [],
    message TEXT
  ) AS $$
DECLARE v_contact RECORD;
v_actions TEXT [] := ARRAY []::TEXT [];
v_result RECORD;
BEGIN -- Find contact by email
SELECT * INTO v_contact
FROM contacts
WHERE email = p_email;
IF v_contact IS NULL THEN RETURN QUERY
SELECT false,
  v_actions,
  'Contact not found for email: ' || p_email;
RETURN;
END IF;
-- Update contact status to unsubscribed
SELECT * INTO v_result
FROM update_contact_status_with_log(
    v_contact.id,
    'unsubscribed',
    format(
      'Unsubscribed via %s',
      COALESCE(p_unsubscribe_type, 'email')
    ),
    'webhook:unsubscribe',
    p_webhook_event_id
  );
v_actions := array_append(v_actions, 'contact_unsubscribed');
IF v_result.success THEN RETURN QUERY
SELECT true,
  v_actions,
  'Unsubscribe processed successfully';
ELSE RETURN QUERY
SELECT false,
  v_actions,
  v_result.message;
END IF;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- CLEANUP FUNCTIONS
-- =============================================
-- Function to cleanup old webhook events
CREATE OR REPLACE FUNCTION cleanup_webhook_events(p_days_old INTEGER DEFAULT 30) RETURNS TABLE (
    events_deleted INTEGER,
    actions_deleted INTEGER,
    tracking_deleted INTEGER
  ) AS $$
DECLARE v_events_deleted INTEGER;
v_actions_deleted INTEGER;
v_tracking_deleted INTEGER;
BEGIN -- Delete old webhook events (cascades to related tables)
DELETE FROM webhook_events
WHERE received_at < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_events_deleted = ROW_COUNT;
-- Delete orphaned automated actions
DELETE FROM automated_actions
WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
  AND webhook_event_id IS NULL;
GET DIAGNOSTICS v_actions_deleted = ROW_COUNT;
-- Delete old tracking details for processed emails
DELETE FROM email_tracking_details
WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_tracking_deleted = ROW_COUNT;
RETURN QUERY
SELECT v_events_deleted,
  v_actions_deleted,
  v_tracking_deleted;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- REALTIME CONFIGURATION
-- =============================================
-- Enable realtime for webhook monitoring
ALTER PUBLICATION supabase_realtime
ADD TABLE webhook_events;
ALTER PUBLICATION supabase_realtime
ADD TABLE contact_status_updates;
ALTER PUBLICATION supabase_realtime
ADD TABLE automated_actions;
-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE webhook_events IS 'Stores all incoming webhook events with duplicate detection';
COMMENT ON TABLE contact_status_updates IS 'Tracks automated contact status changes triggered by webhooks';
COMMENT ON TABLE automated_actions IS 'Logs all automated actions performed by the webhook system';
COMMENT ON TABLE email_tracking_details IS 'Extended tracking data for email opens, clicks, and unsubscribes';
COMMENT ON FUNCTION check_webhook_duplicate IS 'Checks for duplicate webhook events within 24 hours';
COMMENT ON FUNCTION log_automated_action IS 'Logs an automated action with metadata';
COMMENT ON FUNCTION update_contact_status_with_log IS 'Updates contact status and logs the change';
COMMENT ON FUNCTION process_bounce_event IS 'Processes bounce events and performs automated actions';
COMMENT ON FUNCTION process_unsubscribe_event IS 'Processes unsubscribe events and updates contact status';
COMMENT ON FUNCTION cleanup_webhook_events IS 'Cleans up old webhook events and related data';
