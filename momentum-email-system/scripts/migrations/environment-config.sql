-- =============================================
-- ENVIRONMENT CONFIGURATION MIGRATION
-- =============================================
-- This migration sets up environment-specific configurations
-- Run: npm run migrate migrate <environment>
-- Create environment configuration table
CREATE TABLE IF NOT EXISTS environment_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  config_key VARCHAR(255) NOT NULL,
  config_value TEXT,
  config_type VARCHAR(50) DEFAULT 'string',
  -- string, number, boolean, json
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(environment, config_key)
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_environment_config_env ON environment_config(environment);
CREATE INDEX IF NOT EXISTS idx_environment_config_key ON environment_config(config_key);
CREATE INDEX IF NOT EXISTS idx_environment_config_sensitive ON environment_config(is_sensitive);
-- Enable RLS
ALTER TABLE environment_config ENABLE ROW LEVEL SECURITY;
-- Create RLS policies
CREATE POLICY "Service role can manage environment config" ON environment_config FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read non-sensitive config" ON environment_config FOR
SELECT TO authenticated USING (is_sensitive = false);
-- =============================================
-- ENVIRONMENT-SPECIFIC SETTINGS
-- =============================================
-- Development Environment Configuration
INSERT INTO environment_config (
    environment,
    config_key,
    config_value,
    config_type,
    description,
    is_sensitive
  )
VALUES (
    'development',
    'email_batch_size',
    '2',
    'number',
    'Number of emails to process per batch',
    false
  ),
  (
    'development',
    'campaign_batch_size',
    '2',
    'number',
    'Number of campaigns to process per batch',
    false
  ),
  (
    'development',
    'rate_limit_enabled',
    'false',
    'boolean',
    'Enable rate limiting',
    false
  ),
  (
    'development',
    'webhook_verification_enabled',
    'false',
    'boolean',
    'Enable webhook signature verification',
    false
  ),
  (
    'development',
    'log_level',
    'debug',
    'string',
    'Logging level',
    false
  ),
  (
    'development',
    'alert_email_enabled',
    'false',
    'boolean',
    'Enable email alerts',
    false
  ),
  (
    'development',
    'backup_enabled',
    'false',
    'boolean',
    'Enable database backups',
    false
  ),
  (
    'development',
    'tracking_enabled',
    'false',
    'boolean',
    'Enable email tracking (pixel, click)',
    false
  ),
  (
    'development',
    'max_retry_attempts',
    '1',
    'number',
    'Maximum retry attempts for failed emails',
    false
  ),
  (
    'development',
    'cache_enabled',
    'false',
    'boolean',
    'Enable caching',
    false
  ) ON CONFLICT (environment, config_key) DO
UPDATE
SET config_value = EXCLUDED.config_value,
  updated_at = NOW();
-- Staging Environment Configuration
INSERT INTO environment_config (
    environment,
    config_key,
    config_value,
    config_type,
    description,
    is_sensitive
  )
VALUES (
    'staging',
    'email_batch_size',
    '3',
    'number',
    'Number of emails to process per batch',
    false
  ),
  (
    'staging',
    'campaign_batch_size',
    '3',
    'number',
    'Number of campaigns to process per batch',
    false
  ),
  (
    'staging',
    'rate_limit_enabled',
    'true',
    'boolean',
    'Enable rate limiting',
    false
  ),
  (
    'staging',
    'webhook_verification_enabled',
    'true',
    'boolean',
    'Enable webhook signature verification',
    false
  ),
  (
    'staging',
    'log_level',
    'info',
    'string',
    'Logging level',
    false
  ),
  (
    'staging',
    'alert_email_enabled',
    'false',
    'boolean',
    'Enable email alerts (disabled in staging)',
    false
  ),
  (
    'staging',
    'backup_enabled',
    'true',
    'boolean',
    'Enable database backups',
    false
  ),
  (
    'staging',
    'tracking_enabled',
    'true',
    'boolean',
    'Enable email tracking',
    false
  ),
  (
    'staging',
    'max_retry_attempts',
    '2',
    'number',
    'Maximum retry attempts for failed emails',
    false
  ),
  (
    'staging',
    'cache_enabled',
    'true',
    'boolean',
    'Enable caching',
    false
  ),
  (
    'staging',
    'max_daily_emails',
    '10000',
    'number',
    'Maximum emails per day',
    false
  ),
  (
    'staging',
    'failure_rate_threshold',
    '20',
    'number',
    'Alert threshold for failure rate percentage',
    false
  ) ON CONFLICT (environment, config_key) DO
UPDATE
SET config_value = EXCLUDED.config_value,
  updated_at = NOW();
-- Production Environment Configuration
INSERT INTO environment_config (
    environment,
    config_key,
    config_value,
    config_type,
    description,
    is_sensitive
  )
VALUES (
    'production',
    'email_batch_size',
    '4',
    'number',
    'Number of emails to process per batch',
    false
  ),
  (
    'production',
    'campaign_batch_size',
    '5',
    'number',
    'Number of campaigns to process per batch',
    false
  ),
  (
    'production',
    'rate_limit_enabled',
    'true',
    'boolean',
    'Enable rate limiting',
    false
  ),
  (
    'production',
    'webhook_verification_enabled',
    'true',
    'boolean',
    'Enable webhook signature verification',
    false
  ),
  (
    'production',
    'log_level',
    'warn',
    'string',
    'Logging level',
    false
  ),
  (
    'production',
    'alert_email_enabled',
    'true',
    'boolean',
    'Enable email alerts',
    false
  ),
  (
    'production',
    'backup_enabled',
    'true',
    'boolean',
    'Enable database backups',
    false
  ),
  (
    'production',
    'tracking_enabled',
    'true',
    'boolean',
    'Enable email tracking',
    false
  ),
  (
    'production',
    'max_retry_attempts',
    '3',
    'number',
    'Maximum retry attempts for failed emails',
    false
  ),
  (
    'production',
    'cache_enabled',
    'true',
    'boolean',
    'Enable caching',
    false
  ),
  (
    'production',
    'max_daily_emails',
    '50000',
    'number',
    'Maximum emails per day',
    false
  ),
  (
    'production',
    'failure_rate_threshold',
    '10',
    'number',
    'Alert threshold for failure rate percentage',
    false
  ),
  (
    'production',
    'queue_size_threshold',
    '1000',
    'number',
    'Alert threshold for queue size',
    false
  ),
  (
    'production',
    'response_time_threshold',
    '30000',
    'number',
    'Alert threshold for response time (ms)',
    false
  ),
  (
    'production',
    'audit_log_enabled',
    'true',
    'boolean',
    'Enable audit logging',
    false
  ),
  (
    'production',
    'gdpr_compliance_mode',
    'true',
    'boolean',
    'Enable GDPR compliance features',
    false
  ),
  (
    'production',
    'data_retention_days',
    '2555',
    'number',
    'Data retention period in days (7 years)',
    false
  ) ON CONFLICT (environment, config_key) DO
UPDATE
SET config_value = EXCLUDED.config_value,
  updated_at = NOW();
-- =============================================
-- CRON JOB CONFIGURATION BY ENVIRONMENT
-- =============================================
-- Create cron job configuration table
CREATE TABLE IF NOT EXISTS cron_job_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  job_name VARCHAR(255) NOT NULL,
  schedule VARCHAR(50) NOT NULL,
  -- Cron expression
  enabled BOOLEAN DEFAULT true,
  batch_size INTEGER DEFAULT 1,
  timeout_seconds INTEGER DEFAULT 300,
  max_retries INTEGER DEFAULT 3,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(environment, job_name)
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cron_job_config_env ON cron_job_config(environment);
CREATE INDEX IF NOT EXISTS idx_cron_job_config_enabled ON cron_job_config(enabled);
-- Enable RLS
ALTER TABLE cron_job_config ENABLE ROW LEVEL SECURITY;
-- Create RLS policies
CREATE POLICY "Service role can manage cron job config" ON cron_job_config FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read cron job config" ON cron_job_config FOR
SELECT TO authenticated USING (true);
-- Development cron job configuration (reduced frequency)
INSERT INTO cron_job_config (
    environment,
    job_name,
    schedule,
    enabled,
    batch_size,
    timeout_seconds,
    description
  )
VALUES (
    'development',
    'email-processor-job',
    '*/2 * * * *',
    true,
    2,
    120,
    'Process email queue every 2 minutes'
  ),
  (
    'development',
    'status-updater-job',
    '*/10 * * * *',
    true,
    1,
    60,
    'Update email status every 10 minutes'
  ),
  (
    'development',
    'campaign-scheduler-job',
    '*/5 * * * *',
    true,
    2,
    60,
    'Check for scheduled campaigns every 5 minutes'
  ),
  (
    'development',
    'bounce-handler-job',
    '*/30 * * * *',
    true,
    10,
    120,
    'Process bounces every 30 minutes'
  ),
  (
    'development',
    'log-cleanup-job',
    '0 6 * * *',
    true,
    1,
    300,
    'Clean old logs daily at 6 AM'
  ) ON CONFLICT (environment, job_name) DO
UPDATE
SET schedule = EXCLUDED.schedule,
  batch_size = EXCLUDED.batch_size,
  timeout_seconds = EXCLUDED.timeout_seconds,
  updated_at = NOW();
-- Staging cron job configuration
INSERT INTO cron_job_config (
    environment,
    job_name,
    schedule,
    enabled,
    batch_size,
    timeout_seconds,
    description
  )
VALUES (
    'staging',
    'email-processor-job',
    '* * * * *',
    true,
    3,
    180,
    'Process email queue every minute'
  ),
  (
    'staging',
    'status-updater-job',
    '*/5 * * * *',
    true,
    1,
    120,
    'Update email status every 5 minutes'
  ),
  (
    'staging',
    'campaign-scheduler-job',
    '* * * * *',
    true,
    3,
    120,
    'Check for scheduled campaigns every minute'
  ),
  (
    'staging',
    'bounce-handler-job',
    '*/15 * * * *',
    true,
    50,
    180,
    'Process bounces every 15 minutes'
  ),
  (
    'staging',
    'log-cleanup-job',
    '0 4 * * *',
    true,
    1,
    300,
    'Clean old logs daily at 4 AM'
  ) ON CONFLICT (environment, job_name) DO
UPDATE
SET schedule = EXCLUDED.schedule,
  batch_size = EXCLUDED.batch_size,
  timeout_seconds = EXCLUDED.timeout_seconds,
  updated_at = NOW();
-- Production cron job configuration
INSERT INTO cron_job_config (
    environment,
    job_name,
    schedule,
    enabled,
    batch_size,
    timeout_seconds,
    description
  )
VALUES (
    'production',
    'email-processor-job',
    '* * * * *',
    true,
    4,
    300,
    'Process email queue every minute'
  ),
  (
    'production',
    'status-updater-job',
    '*/5 * * * *',
    true,
    1,
    180,
    'Update email status every 5 minutes'
  ),
  (
    'production',
    'campaign-scheduler-job',
    '* * * * *',
    true,
    5,
    180,
    'Check for scheduled campaigns every minute'
  ),
  (
    'production',
    'bounce-handler-job',
    '*/15 * * * *',
    true,
    100,
    300,
    'Process bounces every 15 minutes'
  ),
  (
    'production',
    'log-cleanup-job',
    '0 2 * * *',
    true,
    1,
    600,
    'Clean old logs daily at 2 AM'
  ) ON CONFLICT (environment, job_name) DO
UPDATE
SET schedule = EXCLUDED.schedule,
  batch_size = EXCLUDED.batch_size,
  timeout_seconds = EXCLUDED.timeout_seconds,
  updated_at = NOW();
-- =============================================
-- HELPER FUNCTIONS
-- =============================================
-- Function to get environment configuration
CREATE OR REPLACE FUNCTION get_environment_config(p_environment TEXT, p_config_key TEXT) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_config_value TEXT;
BEGIN
SELECT config_value INTO v_config_value
FROM environment_config
WHERE environment = p_environment
  AND config_key = p_config_key;
RETURN v_config_value;
END;
$$;
-- Function to set environment configuration
CREATE OR REPLACE FUNCTION set_environment_config(
    p_environment TEXT,
    p_config_key TEXT,
    p_config_value TEXT,
    p_config_type TEXT DEFAULT 'string',
    p_description TEXT DEFAULT NULL,
    p_is_sensitive BOOLEAN DEFAULT false
  ) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
INSERT INTO environment_config (
    environment,
    config_key,
    config_value,
    config_type,
    description,
    is_sensitive
  )
VALUES (
    p_environment,
    p_config_key,
    p_config_value,
    p_config_type,
    p_description,
    p_is_sensitive
  ) ON CONFLICT (environment, config_key) DO
UPDATE
SET config_value = EXCLUDED.config_value,
  config_type = EXCLUDED.config_type,
  description = EXCLUDED.description,
  is_sensitive = EXCLUDED.is_sensitive,
  updated_at = NOW();
RETURN true;
END;
$$;
-- Function to get cron job configuration
CREATE OR REPLACE FUNCTION get_cron_job_config(p_environment TEXT) RETURNS TABLE (
    job_name TEXT,
    schedule TEXT,
    enabled BOOLEAN,
    batch_size INTEGER,
    timeout_seconds INTEGER,
    description TEXT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT c.job_name,
  c.schedule,
  c.enabled,
  c.batch_size,
  c.timeout_seconds,
  c.description
FROM cron_job_config c
WHERE c.environment = p_environment
ORDER BY c.job_name;
END;
$$;
-- =============================================
-- AUDIT LOGGING FOR CONFIG CHANGES
-- =============================================
-- Create audit log table for configuration changes
CREATE TABLE IF NOT EXISTS config_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(255) NOT NULL,
  operation VARCHAR(50) NOT NULL,
  -- INSERT, UPDATE, DELETE
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  environment VARCHAR(50)
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_config_audit_log_table ON config_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_operation ON config_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_environment ON config_audit_log(environment);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_changed_at ON config_audit_log(changed_at);
-- Enable RLS
ALTER TABLE config_audit_log ENABLE ROW LEVEL SECURITY;
-- Create RLS policies
CREATE POLICY "Service role can manage config audit log" ON config_audit_log FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read config audit log" ON config_audit_log FOR
SELECT TO authenticated USING (true);
-- Create audit trigger function
CREATE OR REPLACE FUNCTION config_audit_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF TG_OP = 'DELETE' THEN
INSERT INTO config_audit_log (
    table_name,
    operation,
    record_id,
    old_values,
    environment
  )
VALUES (
    TG_TABLE_NAME,
    TG_OP,
    OLD.id,
    to_jsonb(OLD),
    OLD.environment
  );
RETURN OLD;
ELSIF TG_OP = 'UPDATE' THEN
INSERT INTO config_audit_log (
    table_name,
    operation,
    record_id,
    old_values,
    new_values,
    environment
  )
VALUES (
    TG_TABLE_NAME,
    TG_OP,
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    NEW.environment
  );
RETURN NEW;
ELSIF TG_OP = 'INSERT' THEN
INSERT INTO config_audit_log (
    table_name,
    operation,
    record_id,
    new_values,
    environment
  )
VALUES (
    TG_TABLE_NAME,
    TG_OP,
    NEW.id,
    to_jsonb(NEW),
    NEW.environment
  );
RETURN NEW;
END IF;
RETURN NULL;
END;
$$;
-- Create audit triggers
DROP TRIGGER IF EXISTS environment_config_audit_trigger ON environment_config;
CREATE TRIGGER environment_config_audit_trigger
AFTER
INSERT
  OR
UPDATE
  OR DELETE ON environment_config FOR EACH ROW EXECUTE FUNCTION config_audit_trigger();
DROP TRIGGER IF EXISTS cron_job_config_audit_trigger ON cron_job_config;
CREATE TRIGGER cron_job_config_audit_trigger
AFTER
INSERT
  OR
UPDATE
  OR DELETE ON cron_job_config FOR EACH ROW EXECUTE FUNCTION config_audit_trigger();
-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE environment_config IS 'Environment-specific configuration settings';
COMMENT ON TABLE cron_job_config IS 'Cron job configuration by environment';
COMMENT ON TABLE config_audit_log IS 'Audit log for configuration changes';
COMMENT ON FUNCTION get_environment_config IS 'Get a configuration value for an environment';
COMMENT ON FUNCTION set_environment_config IS 'Set a configuration value for an environment';
COMMENT ON FUNCTION get_cron_job_config IS 'Get cron job configuration for an environment';
