-- =============================================
-- BACKUP AND MONITORING SYSTEM MIGRATION
-- =============================================
-- This migration creates tables for backup metadata and system monitoring
-- Create backup metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_id VARCHAR(255) NOT NULL UNIQUE,
  environment VARCHAR(50) NOT NULL,
  backup_type VARCHAR(50) NOT NULL,
  -- full, incremental, configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  size_bytes BIGINT NOT NULL,
  tables TEXT [] NOT NULL,
  file_path TEXT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  encryption_key VARCHAR(255),
  restored_at TIMESTAMP WITH TIME ZONE,
  restoration_notes TEXT,
  storage_type VARCHAR(50) DEFAULT 'local',
  remote_path TEXT,
  retention_until TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_status VARCHAR(50),
  tags JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);
-- Create indexes for backup metadata
CREATE INDEX IF NOT EXISTS idx_backup_metadata_environment ON backup_metadata(environment);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_type ON backup_metadata(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_created_at ON backup_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_backup_id ON backup_metadata(backup_id);
-- Create system metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_queue_size INTEGER DEFAULT 0,
  failed_jobs_count INTEGER DEFAULT 0,
  success_rate_24h DECIMAL(5, 2) DEFAULT 100.0,
  avg_response_time DECIMAL(10, 2) DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  total_emails_sent_24h INTEGER DEFAULT 0,
  bounce_rate_24h DECIMAL(5, 2) DEFAULT 0,
  memory_usage DECIMAL(5, 2),
  cpu_usage DECIMAL(5, 2),
  disk_usage DECIMAL(5, 2),
  network_latency DECIMAL(10, 2),
  additional_metrics JSONB DEFAULT '{}'
);
-- Create indexes for system metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_environment ON system_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
-- Create system alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  -- warning, critical
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  alert_channels TEXT [] DEFAULT '{}',
  -- email, slack, webhook
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE
);
-- Create indexes for system alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_environment ON system_alerts(environment);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_sent_at ON system_alerts(sent_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON system_alerts(acknowledged_at);
-- Create health check results table
CREATE TABLE IF NOT EXISTS health_check_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  service VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  -- healthy, degraded, unhealthy
  response_time INTEGER NOT NULL,
  message TEXT,
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_duration INTEGER -- Duration of the health check in ms
);
-- Create indexes for health check results
CREATE INDEX IF NOT EXISTS idx_health_check_environment ON health_check_results(environment);
CREATE INDEX IF NOT EXISTS idx_health_check_service ON health_check_results(service);
CREATE INDEX IF NOT EXISTS idx_health_check_status ON health_check_results(status);
CREATE INDEX IF NOT EXISTS idx_health_check_checked_at ON health_check_results(checked_at);
-- Enable RLS on all tables
ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;
-- Create RLS policies for backup_metadata
CREATE POLICY "Service role can manage backup metadata" ON backup_metadata FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read backup metadata" ON backup_metadata FOR
SELECT TO authenticated USING (true);
-- Create RLS policies for system_metrics
CREATE POLICY "Service role can manage system metrics" ON system_metrics FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read system metrics" ON system_metrics FOR
SELECT TO authenticated USING (true);
-- Create RLS policies for system_alerts
CREATE POLICY "Service role can manage system alerts" ON system_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read system alerts" ON system_alerts FOR
SELECT TO authenticated USING (true);
-- Create RLS policies for health_check_results
CREATE POLICY "Service role can manage health check results" ON health_check_results FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read health check results" ON health_check_results FOR
SELECT TO authenticated USING (true);
-- =============================================
-- HELPER FUNCTIONS
-- =============================================
-- Function to get user tables (for backup)
CREATE OR REPLACE FUNCTION get_user_tables() RETURNS TABLE (
    table_name TEXT,
    table_schema TEXT,
    estimated_row_count BIGINT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT t.tablename::TEXT,
  t.schemaname::TEXT,
  COALESCE(c.reltuples::BIGINT, 0)
FROM pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT LIKE '_migrations'
ORDER BY t.tablename;
END;
$$;
-- Function to execute SQL (for restore operations)
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE sql_query;
END;
$$;
-- Function to get backup summary
CREATE OR REPLACE FUNCTION get_backup_summary(p_environment TEXT) RETURNS TABLE (
    total_backups BIGINT,
    total_size_bytes BIGINT,
    latest_backup TIMESTAMP WITH TIME ZONE,
    oldest_backup TIMESTAMP WITH TIME ZONE,
    full_backups BIGINT,
    incremental_backups BIGINT,
    config_backups BIGINT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT COUNT(*)::BIGINT,
  SUM(size_bytes)::BIGINT,
  MAX(created_at),
  MIN(created_at),
  COUNT(*) FILTER (
    WHERE backup_type = 'full'
  )::BIGINT,
  COUNT(*) FILTER (
    WHERE backup_type = 'incremental'
  )::BIGINT,
  COUNT(*) FILTER (
    WHERE backup_type = 'configuration'
  )::BIGINT
FROM backup_metadata
WHERE environment = p_environment;
END;
$$;
-- Function to get system health status
CREATE OR REPLACE FUNCTION get_system_health_status(p_environment TEXT) RETURNS TABLE (
    service TEXT,
    status TEXT,
    last_check TIMESTAMP WITH TIME ZONE,
    response_time INTEGER,
    message TEXT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT DISTINCT ON (h.service) h.service,
  h.status,
  h.checked_at,
  h.response_time,
  h.message
FROM health_check_results h
WHERE h.environment = p_environment
ORDER BY h.service,
  h.checked_at DESC;
END;
$$;
-- Function to cleanup old records
CREATE OR REPLACE FUNCTION cleanup_monitoring_data(p_days_old INTEGER DEFAULT 30) RETURNS TABLE (
    metrics_deleted INTEGER,
    health_checks_deleted INTEGER,
    alerts_deleted INTEGER
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_metrics_deleted INTEGER;
v_health_checks_deleted INTEGER;
v_alerts_deleted INTEGER;
BEGIN -- Delete old system metrics (keep configurable days)
DELETE FROM system_metrics
WHERE timestamp < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_metrics_deleted = ROW_COUNT;
-- Delete old health check results (keep configurable days)
DELETE FROM health_check_results
WHERE checked_at < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_health_checks_deleted = ROW_COUNT;
-- Delete old resolved alerts (keep configurable days)
DELETE FROM system_alerts
WHERE resolved_at IS NOT NULL
  AND resolved_at < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;
RETURN QUERY
SELECT v_metrics_deleted,
  v_health_checks_deleted,
  v_alerts_deleted;
END;
$$;
-- =============================================
-- BACKUP AUTOMATION
-- =============================================
-- Function to trigger automated backup
CREATE OR REPLACE FUNCTION trigger_automated_backup(
    p_environment TEXT,
    p_backup_type TEXT DEFAULT 'incremental'
  ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
v_function_url TEXT;
BEGIN -- Determine which function to call based on backup type
v_function_url := CASE
  p_backup_type
  WHEN 'full' THEN 'backup-full'
  WHEN 'incremental' THEN 'backup-incremental'
  WHEN 'configuration' THEN 'backup-config'
  ELSE 'backup-incremental'
END;
-- Call edge function to perform backup
SELECT public.call_edge_function(
    v_function_url,
    jsonb_build_object(
      'environment',
      p_environment,
      'backup_type',
      p_backup_type,
      'automated',
      true
    )
  ) INTO v_result;
-- Log the backup trigger
INSERT INTO system_alerts (
    environment,
    severity,
    title,
    message,
    details
  )
VALUES (
    p_environment,
    'info',
    'Automated Backup Triggered',
    format(
      'Automated %s backup triggered for %s',
      p_backup_type,
      p_environment
    ),
    jsonb_build_object(
      'backup_type',
      p_backup_type,
      'trigger_function',
      v_function_url,
      'result',
      v_result
    )
  );
RETURN v_result;
END;
$$;
-- =============================================
-- MONITORING VIEWS
-- =============================================
-- View for backup status dashboard
CREATE OR REPLACE VIEW backup_status_dashboard AS
SELECT environment,
  backup_type,
  COUNT(*) as backup_count,
  SUM(size_bytes) as total_size_bytes,
  AVG(size_bytes) as avg_size_bytes,
  MAX(created_at) as latest_backup,
  MIN(created_at) as oldest_backup,
  COUNT(*) FILTER (
    WHERE verified_at IS NOT NULL
  ) as verified_count,
  COUNT(*) FILTER (
    WHERE restored_at IS NOT NULL
  ) as restored_count
FROM backup_metadata
GROUP BY environment,
  backup_type
ORDER BY environment,
  backup_type;
-- View for system health dashboard
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT environment,
  COUNT(DISTINCT service) as total_services,
  COUNT(*) FILTER (
    WHERE status = 'healthy'
  ) as healthy_services,
  COUNT(*) FILTER (
    WHERE status = 'degraded'
  ) as degraded_services,
  COUNT(*) FILTER (
    WHERE status = 'unhealthy'
  ) as unhealthy_services,
  AVG(response_time) as avg_response_time,
  MAX(checked_at) as last_check_time
FROM (
    SELECT DISTINCT ON (environment, service) environment,
      service,
      status,
      response_time,
      checked_at
    FROM health_check_results
    ORDER BY environment,
      service,
      checked_at DESC
  ) latest_checks
GROUP BY environment
ORDER BY environment;
-- View for recent alerts
CREATE OR REPLACE VIEW recent_alerts_dashboard AS
SELECT environment,
  severity,
  title,
  message,
  sent_at,
  acknowledged_at,
  resolved_at,
  CASE
    WHEN resolved_at IS NOT NULL THEN 'resolved'
    WHEN acknowledged_at IS NOT NULL THEN 'acknowledged'
    ELSE 'active'
  END as alert_status
FROM system_alerts
WHERE sent_at >= NOW() - INTERVAL '7 days'
ORDER BY sent_at DESC;
-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE backup_metadata IS 'Metadata for all system backups across environments';
COMMENT ON TABLE system_metrics IS 'System performance and health metrics collected over time';
COMMENT ON TABLE system_alerts IS 'System alerts and notifications with acknowledgment tracking';
COMMENT ON TABLE health_check_results IS 'Results from automated health checks of system components';
COMMENT ON FUNCTION get_user_tables IS 'Get list of user tables for backup operations';
COMMENT ON FUNCTION execute_sql IS 'Execute SQL statements (used for restore operations)';
COMMENT ON FUNCTION get_backup_summary IS 'Get backup summary statistics for an environment';
COMMENT ON FUNCTION get_system_health_status IS 'Get current health status of all services';
COMMENT ON FUNCTION cleanup_monitoring_data IS 'Clean up old monitoring and health check data';
COMMENT ON FUNCTION trigger_automated_backup IS 'Trigger automated backup process';
COMMENT ON VIEW backup_status_dashboard IS 'Dashboard view showing backup status by environment and type';
COMMENT ON VIEW system_health_dashboard IS 'Dashboard view showing system health summary by environment';
COMMENT ON VIEW recent_alerts_dashboard IS 'Dashboard view showing recent alerts with status';
