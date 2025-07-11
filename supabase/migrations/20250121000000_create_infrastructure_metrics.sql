-- =============================================
-- SUPABASE INFRASTRUCTURE METRICS MIGRATION
-- =============================================
-- This migration creates tables for storing Supabase infrastructure metrics
-- collected from the Prometheus endpoint
-- Create infrastructure metrics table
CREATE TABLE IF NOT EXISTS infrastructure_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Database metrics
  db_connections_active INTEGER DEFAULT 0,
  db_connections_max INTEGER DEFAULT 0,
  db_query_duration_p95 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  db_query_duration_p99 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  db_transactions_per_second DECIMAL(10, 2) DEFAULT 0,
  db_cache_hit_ratio DECIMAL(5, 2) DEFAULT 0,
  -- percentage
  db_size_bytes BIGINT DEFAULT 0,
  -- Edge Functions metrics
  edge_function_invocations_total INTEGER DEFAULT 0,
  edge_function_errors_total INTEGER DEFAULT 0,
  edge_function_duration_p95 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  edge_function_duration_p99 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  edge_function_memory_usage_mb DECIMAL(10, 2) DEFAULT 0,
  edge_function_cpu_usage_percent DECIMAL(5, 2) DEFAULT 0,
  -- API metrics
  api_requests_total INTEGER DEFAULT 0,
  api_requests_per_second DECIMAL(10, 2) DEFAULT 0,
  api_response_time_p95 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  api_response_time_p99 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  api_error_rate DECIMAL(5, 2) DEFAULT 0,
  -- percentage
  api_rate_limit_usage DECIMAL(5, 2) DEFAULT 0,
  -- percentage
  -- Storage metrics
  storage_size_bytes BIGINT DEFAULT 0,
  storage_objects_count INTEGER DEFAULT 0,
  storage_bandwidth_bytes BIGINT DEFAULT 0,
  -- Auth metrics
  auth_users_total INTEGER DEFAULT 0,
  auth_sessions_active INTEGER DEFAULT 0,
  auth_requests_per_second DECIMAL(10, 2) DEFAULT 0,
  -- Real-time metrics
  realtime_connections_active INTEGER DEFAULT 0,
  realtime_messages_per_second DECIMAL(10, 2) DEFAULT 0,
  realtime_channels_active INTEGER DEFAULT 0,
  -- Raw metrics data (for extensibility)
  raw_metrics JSONB DEFAULT '{}',
  -- Collection metadata
  collection_duration_ms INTEGER DEFAULT 0,
  collection_success BOOLEAN DEFAULT true,
  collection_error TEXT
);
-- Create indexes for infrastructure metrics
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_environment ON infrastructure_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_timestamp ON infrastructure_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_infrastructure_metrics_success ON infrastructure_metrics(collection_success);
-- Create edge function performance breakdown table
CREATE TABLE IF NOT EXISTS edge_function_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  infrastructure_metrics_id UUID REFERENCES infrastructure_metrics(id) ON DELETE CASCADE,
  function_name VARCHAR(100) NOT NULL,
  invocations_total INTEGER DEFAULT 0,
  errors_total INTEGER DEFAULT 0,
  duration_avg DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  duration_p95 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  duration_p99 DECIMAL(10, 3) DEFAULT 0,
  -- milliseconds
  memory_usage_avg_mb DECIMAL(10, 2) DEFAULT 0,
  memory_usage_max_mb DECIMAL(10, 2) DEFAULT 0,
  cpu_usage_avg_percent DECIMAL(5, 2) DEFAULT 0,
  cpu_usage_max_percent DECIMAL(5, 2) DEFAULT 0,
  cold_starts INTEGER DEFAULT 0,
  timeout_errors INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create indexes for edge function metrics
CREATE INDEX IF NOT EXISTS idx_edge_function_metrics_function_name ON edge_function_metrics(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_metrics_timestamp ON edge_function_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_edge_function_metrics_infrastructure_id ON edge_function_metrics(infrastructure_metrics_id);
-- Create infrastructure alerts configuration table
CREATE TABLE IF NOT EXISTS infrastructure_alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  -- threshold, rate_of_change, absence
  threshold_warning DECIMAL(15, 5),
  threshold_critical DECIMAL(15, 5),
  comparison_operator VARCHAR(10) NOT NULL,
  -- gt, lt, eq, gte, lte
  time_window_minutes INTEGER DEFAULT 5,
  consecutive_breaches INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  alert_title VARCHAR(255) NOT NULL,
  alert_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create indexes for infrastructure alert rules
CREATE INDEX IF NOT EXISTS idx_infrastructure_alert_rules_environment ON infrastructure_alert_rules(environment);
CREATE INDEX IF NOT EXISTS idx_infrastructure_alert_rules_metric_name ON infrastructure_alert_rules(metric_name);
CREATE INDEX IF NOT EXISTS idx_infrastructure_alert_rules_enabled ON infrastructure_alert_rules(enabled);
-- Enable RLS on all tables
ALTER TABLE infrastructure_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_function_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_alert_rules ENABLE ROW LEVEL SECURITY;
-- Create RLS policies for infrastructure_metrics
CREATE POLICY "Service role can manage infrastructure metrics" ON infrastructure_metrics FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read infrastructure metrics" ON infrastructure_metrics FOR
SELECT TO authenticated USING (true);
-- Create RLS policies for edge_function_metrics
CREATE POLICY "Service role can manage edge function metrics" ON edge_function_metrics FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read edge function metrics" ON edge_function_metrics FOR
SELECT TO authenticated USING (true);
-- Create RLS policies for infrastructure_alert_rules
CREATE POLICY "Service role can manage infrastructure alert rules" ON infrastructure_alert_rules FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated users can read infrastructure alert rules" ON infrastructure_alert_rules FOR
SELECT TO authenticated USING (true);
-- =============================================
-- HELPER FUNCTIONS
-- =============================================
-- Function to get latest infrastructure metrics for an environment
CREATE OR REPLACE FUNCTION get_latest_infrastructure_metrics(p_environment TEXT) RETURNS TABLE (
    metric_timestamp TIMESTAMP WITH TIME ZONE,
    db_connections_active INTEGER,
    db_query_duration_p95 DECIMAL,
    edge_function_invocations_total INTEGER,
    edge_function_errors_total INTEGER,
    api_requests_per_second DECIMAL,
    api_error_rate DECIMAL,
    collection_success BOOLEAN
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT i.timestamp,
  i.db_connections_active,
  i.db_query_duration_p95,
  i.edge_function_invocations_total,
  i.edge_function_errors_total,
  i.api_requests_per_second,
  i.api_error_rate,
  i.collection_success
FROM infrastructure_metrics i
WHERE i.environment = p_environment
ORDER BY i.timestamp DESC
LIMIT 1;
END;
$$;
-- Function to calculate infrastructure metrics trends
CREATE OR REPLACE FUNCTION get_infrastructure_trends(p_environment TEXT, p_hours INTEGER DEFAULT 24) RETURNS TABLE (
    metric_name TEXT,
    current_value DECIMAL,
    previous_value DECIMAL,
    change_percent DECIMAL,
    trend VARCHAR(20)
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY WITH current_metrics AS (
    SELECT db_query_duration_p95,
      edge_function_errors_total,
      api_error_rate,
      api_response_time_p95
    FROM infrastructure_metrics
    WHERE environment = p_environment
      AND timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY timestamp DESC
    LIMIT 1
  ), previous_metrics AS (
    SELECT db_query_duration_p95,
      edge_function_errors_total,
      api_error_rate,
      api_response_time_p95
    FROM infrastructure_metrics
    WHERE environment = p_environment
      AND timestamp <= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY timestamp DESC
    LIMIT 1
  )
SELECT 'db_query_duration_p95'::TEXT,
  c.db_query_duration_p95,
  p.db_query_duration_p95,
  CASE
    WHEN p.db_query_duration_p95 > 0 THEN (
      (
        c.db_query_duration_p95 - p.db_query_duration_p95
      ) / p.db_query_duration_p95
    ) * 100
    ELSE 0
  END,
  CASE
    WHEN c.db_query_duration_p95 > p.db_query_duration_p95 * 1.1 THEN 'increasing'
    WHEN c.db_query_duration_p95 < p.db_query_duration_p95 * 0.9 THEN 'decreasing'
    ELSE 'stable'
  END
FROM current_metrics c,
  previous_metrics p
UNION ALL
SELECT 'api_error_rate'::TEXT,
  c.api_error_rate,
  p.api_error_rate,
  CASE
    WHEN p.api_error_rate > 0 THEN (
      (c.api_error_rate - p.api_error_rate) / p.api_error_rate
    ) * 100
    ELSE 0
  END,
  CASE
    WHEN c.api_error_rate > p.api_error_rate * 1.1 THEN 'increasing'
    WHEN c.api_error_rate < p.api_error_rate * 0.9 THEN 'decreasing'
    ELSE 'stable'
  END
FROM current_metrics c,
  previous_metrics p;
END;
$$;
-- Function to check infrastructure alert conditions
CREATE OR REPLACE FUNCTION check_infrastructure_alerts(p_environment TEXT) RETURNS TABLE (
    alert_rule_id UUID,
    metric_name TEXT,
    current_value DECIMAL,
    threshold_breached TEXT,
    severity TEXT,
    alert_title TEXT,
    alert_description TEXT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY WITH latest_metrics AS (
    SELECT *
    FROM infrastructure_metrics
    WHERE environment = p_environment
    ORDER BY timestamp DESC
    LIMIT 1
  )
SELECT r.id,
  r.metric_name,
  CASE
    WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
    WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
    WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
    WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
    ELSE 0
  END as current_value,
  CASE
    WHEN (
      CASE
        WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
        WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
        WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
        WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
        ELSE 0
      END
    ) >= r.threshold_critical THEN 'critical'
    WHEN (
      CASE
        WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
        WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
        WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
        WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
        ELSE 0
      END
    ) >= r.threshold_warning THEN 'warning'
    ELSE NULL
  END as threshold_breached,
  CASE
    WHEN (
      CASE
        WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
        WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
        WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
        WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
        ELSE 0
      END
    ) >= r.threshold_critical THEN 'critical'
    WHEN (
      CASE
        WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
        WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
        WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
        WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
        ELSE 0
      END
    ) >= r.threshold_warning THEN 'warning'
    ELSE 'healthy'
  END as severity,
  r.alert_title,
  r.alert_description
FROM infrastructure_alert_rules r
  CROSS JOIN latest_metrics m
WHERE r.environment = p_environment
  AND r.enabled = true
  AND (
    (
      r.comparison_operator = 'gt'
      AND (
        CASE
          WHEN r.metric_name = 'db_query_duration_p95' THEN m.db_query_duration_p95
          WHEN r.metric_name = 'edge_function_errors_total' THEN m.edge_function_errors_total::DECIMAL
          WHEN r.metric_name = 'api_error_rate' THEN m.api_error_rate
          WHEN r.metric_name = 'api_response_time_p95' THEN m.api_response_time_p95
          ELSE 0
        END
      ) >= COALESCE(r.threshold_warning, r.threshold_critical)
    )
  );
END;
$$;
-- Function to cleanup old infrastructure metrics
CREATE OR REPLACE FUNCTION cleanup_infrastructure_metrics(p_days_old INTEGER DEFAULT 30) RETURNS TABLE (
    infrastructure_metrics_deleted INTEGER,
    edge_function_metrics_deleted INTEGER
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_infrastructure_deleted INTEGER;
v_edge_function_deleted INTEGER;
BEGIN -- Delete old infrastructure metrics
DELETE FROM infrastructure_metrics
WHERE timestamp < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_infrastructure_deleted = ROW_COUNT;
-- Delete old edge function metrics
DELETE FROM edge_function_metrics
WHERE timestamp < NOW() - (p_days_old || ' days')::INTERVAL;
GET DIAGNOSTICS v_edge_function_deleted = ROW_COUNT;
RETURN QUERY
SELECT v_infrastructure_deleted,
  v_edge_function_deleted;
END;
$$;
-- =============================================
-- DASHBOARD VIEWS
-- =============================================
-- Infrastructure metrics dashboard view
CREATE OR REPLACE VIEW infrastructure_metrics_dashboard AS
SELECT environment,
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(db_connections_active) as avg_db_connections,
  AVG(db_query_duration_p95) as avg_db_query_p95,
  AVG(edge_function_invocations_total) as avg_edge_invocations,
  AVG(edge_function_errors_total) as avg_edge_errors,
  AVG(api_requests_per_second) as avg_api_rps,
  AVG(api_error_rate) as avg_api_error_rate,
  AVG(api_response_time_p95) as avg_api_response_p95,
  COUNT(*) as data_points,
  AVG(collection_duration_ms) as avg_collection_time
FROM infrastructure_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY environment,
  DATE_TRUNC('hour', timestamp)
ORDER BY environment,
  hour DESC;
-- Edge function performance view
CREATE OR REPLACE VIEW edge_function_performance_dashboard AS
SELECT function_name,
  DATE_TRUNC('hour', timestamp) as hour,
  SUM(invocations_total) as total_invocations,
  SUM(errors_total) as total_errors,
  CASE
    WHEN SUM(invocations_total) > 0 THEN (
      SUM(errors_total)::DECIMAL / SUM(invocations_total)
    ) * 100
    ELSE 0
  END as error_rate,
  AVG(duration_p95) as avg_duration_p95,
  AVG(memory_usage_avg_mb) as avg_memory_usage,
  SUM(cold_starts) as total_cold_starts
FROM edge_function_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY function_name,
  DATE_TRUNC('hour', timestamp)
ORDER BY function_name,
  hour DESC;
-- Insert default alert rules for production
INSERT INTO infrastructure_alert_rules (
    environment,
    metric_name,
    alert_type,
    threshold_warning,
    threshold_critical,
    comparison_operator,
    alert_title,
    alert_description
  )
VALUES (
    'production',
    'db_query_duration_p95',
    'threshold',
    2000,
    5000,
    'gte',
    'Database Query Performance Degradation',
    'Database queries are taking longer than expected'
  ),
  (
    'production',
    'edge_function_errors_total',
    'threshold',
    10,
    50,
    'gte',
    'Edge Function Error Rate High',
    'Edge functions are experiencing elevated error rates'
  ),
  (
    'production',
    'api_error_rate',
    'threshold',
    5,
    10,
    'gte',
    'API Error Rate High',
    'API requests are failing at an elevated rate'
  ),
  (
    'production',
    'api_response_time_p95',
    'threshold',
    3000,
    10000,
    'gte',
    'API Response Time Degradation',
    'API response times are degraded'
  ) ON CONFLICT DO NOTHING;
-- Insert default alert rules for staging
INSERT INTO infrastructure_alert_rules (
    environment,
    metric_name,
    alert_type,
    threshold_warning,
    threshold_critical,
    comparison_operator,
    alert_title,
    alert_description
  )
VALUES (
    'staging',
    'db_query_duration_p95',
    'threshold',
    3000,
    8000,
    'gte',
    'Database Query Performance Degradation',
    'Database queries are taking longer than expected'
  ),
  (
    'staging',
    'edge_function_errors_total',
    'threshold',
    20,
    100,
    'gte',
    'Edge Function Error Rate High',
    'Edge functions are experiencing elevated error rates'
  ),
  (
    'staging',
    'api_error_rate',
    'threshold',
    8,
    15,
    'gte',
    'API Error Rate High',
    'API requests are failing at an elevated rate'
  ),
  (
    'staging',
    'api_response_time_p95',
    'threshold',
    5000,
    15000,
    'gte',
    'API Response Time Degradation',
    'API response times are degraded'
  ) ON CONFLICT DO NOTHING;
-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE infrastructure_metrics IS 'Supabase infrastructure metrics collected from Prometheus endpoint';
COMMENT ON TABLE edge_function_metrics IS 'Detailed performance metrics for individual edge functions';
COMMENT ON TABLE infrastructure_alert_rules IS 'Alert rules and thresholds for infrastructure monitoring';
COMMENT ON FUNCTION get_latest_infrastructure_metrics IS 'Get the most recent infrastructure metrics for an environment';
COMMENT ON FUNCTION get_infrastructure_trends IS 'Calculate trends for key infrastructure metrics';
COMMENT ON FUNCTION check_infrastructure_alerts IS 'Check current metrics against alert thresholds';
COMMENT ON FUNCTION cleanup_infrastructure_metrics IS 'Clean up old infrastructure metrics data';
COMMENT ON VIEW infrastructure_metrics_dashboard IS 'Hourly aggregated infrastructure metrics for dashboards';
COMMENT ON VIEW edge_function_performance_dashboard IS 'Hourly aggregated edge function performance metrics';
