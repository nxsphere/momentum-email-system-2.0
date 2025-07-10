-- =============================================
-- CREATE MISSING TABLES MIGRATION
-- These tables should exist but weren't created properly
-- =============================================
-- =============================================
-- EMAIL QUEUE TABLE
-- For batch email processing
-- =============================================
CREATE TABLE IF NOT EXISTS email_queue (
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
-- For logging campaign activities
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_logs (
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
-- For API rate limiting
-- =============================================
CREATE TABLE IF NOT EXISTS rate_limits (
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
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_id ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_level ON campaign_logs(level);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_created_at ON campaign_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(limit_key);
-- =============================================
-- ENABLE RLS AND CREATE POLICIES
-- =============================================
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Service role policies (Edge Functions need full access)
CREATE POLICY "Service role can manage email queue" ON email_queue FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage campaign logs" ON campaign_logs FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage rate limits" ON rate_limits FOR ALL TO service_role USING (true);
-- Authenticated user policies (staff can view, limited write)
CREATE POLICY "Authenticated users can view email queue" ON email_queue FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view campaign logs" ON campaign_logs FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create campaign logs" ON campaign_logs FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view rate limits" ON rate_limits FOR
SELECT TO authenticated USING (true);
-- =============================================
-- ADD FUNCTIONS IF MISSING
-- =============================================
-- Rate limiting function
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
-- Campaign logging function
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
-- LOG THE TABLE CREATION
-- =============================================
DO $$ BEGIN -- Log this fix to campaign_logs
PERFORM log_campaign_event(
  NULL,
  'info',
  'Missing Tables Created',
  jsonb_build_object(
    'migration',
    '20250120000002_create_missing_tables',
    'tables_created',
    ARRAY ['email_queue', 'campaign_logs', 'rate_limits'],
    'timestamp',
    NOW()
  )
);
RAISE NOTICE '=== Missing Tables Created Successfully ===';
RAISE NOTICE 'Created: email_queue, campaign_logs, rate_limits';
RAISE NOTICE 'Added proper RLS policies and indexes';
RAISE NOTICE 'Your email system should now be fully functional';
END $$;
