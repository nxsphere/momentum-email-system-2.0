-- Setup Supabase Cron Jobs for Email System Edge Functions
-- This migration sets up scheduled jobs using pg_cron extension
-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Grant necessary permissions to the postgres role for cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;
-- Function to make HTTP requests to Edge Functions with error handling
CREATE OR REPLACE FUNCTION public.call_edge_function(
    function_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    timeout_seconds INTEGER DEFAULT 300
  ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
function_url TEXT;
headers JSONB;
response RECORD;
BEGIN -- Construct the function URL
function_url := format(
  'https://%s.supabase.co/functions/v1/%s',
  current_setting('app.settings.project_ref', true),
  function_name
);
-- Set headers for the request
headers := jsonb_build_object(
  'Content-Type',
  'application/json',
  'Authorization',
  format(
    'Bearer %s',
    current_setting('app.settings.service_role_key', true)
  )
);
-- Make the HTTP request using Supabase's http extension
SELECT INTO response status,
  content::jsonb as body
FROM http(
    (
      'POST',
      function_url,
      headers,
      'application/json',
      payload::text
    )::http_request
  );
-- Check if the request was successful
IF response.status BETWEEN 200 AND 299 THEN result := jsonb_build_object(
  'success',
  true,
  'status',
  response.status,
  'data',
  response.body
);
ELSE result := jsonb_build_object(
  'success',
  false,
  'status',
  response.status,
  'error',
  response.body
);
-- Log the error for debugging
RAISE WARNING 'Edge function % failed with status %: %',
function_name,
response.status,
response.body;
END IF;
RETURN result;
EXCEPTION
WHEN OTHERS THEN -- Log any errors and return failure status
RAISE WARNING 'Error calling edge function %: %',
function_name,
SQLERRM;
RETURN jsonb_build_object(
  'success',
  false,
  'error',
  SQLERRM,
  'function',
  function_name
);
END;
$$;
-- Function to log cron job execution results
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN,
  result JSONB,
  error_message TEXT,
  execution_time_ms INTEGER
);
-- Enable RLS on cron_job_logs
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;
-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name_started ON public.cron_job_logs(job_name, started_at DESC);
-- Function to execute and log cron jobs
CREATE OR REPLACE FUNCTION public.execute_cron_job(
    job_name TEXT,
    function_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb
  ) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE log_id BIGINT;
start_time TIMESTAMP WITH TIME ZONE;
end_time TIMESTAMP WITH TIME ZONE;
result JSONB;
execution_time INTEGER;
BEGIN start_time := NOW();
-- Insert initial log entry
INSERT INTO public.cron_job_logs (job_name, started_at)
VALUES (job_name, start_time)
RETURNING id INTO log_id;
-- Execute the edge function
result := public.call_edge_function(function_name, payload);
end_time := NOW();
execution_time := EXTRACT(
  EPOCH
  FROM (end_time - start_time)
)::INTEGER * 1000;
-- Update log entry with results
UPDATE public.cron_job_logs
SET completed_at = end_time,
  success = (result->>'success')::boolean,
  result = result,
  error_message = result->>'error',
  execution_time_ms = execution_time
WHERE id = log_id;
-- Raise notice for monitoring
IF (result->>'success')::boolean THEN RAISE NOTICE 'Cron job % completed successfully in %ms',
job_name,
execution_time;
ELSE RAISE WARNING 'Cron job % failed: %',
job_name,
result->>'error';
END IF;
EXCEPTION
WHEN OTHERS THEN -- Update log with error information
UPDATE public.cron_job_logs
SET completed_at = NOW(),
  success = false,
  error_message = SQLERRM,
  execution_time_ms = EXTRACT(
    EPOCH
    FROM (NOW() - start_time)
  )::INTEGER * 1000
WHERE id = log_id;
RAISE WARNING 'Cron job % encountered error: %',
job_name,
SQLERRM;
END;
$$;
-- Clean up old cron job logs (keep last 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_cron_logs() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
DELETE FROM public.cron_job_logs
WHERE started_at < NOW() - INTERVAL '7 days';
RAISE NOTICE 'Cleaned up old cron job logs older than 7 days';
END;
$$;
-- Helper function to safely unschedule cron jobs
CREATE OR REPLACE FUNCTION public.safe_unschedule_job(job_name TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN -- Check if job exists before trying to unschedule it
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = job_name
  ) THEN PERFORM cron.unschedule(job_name);
RAISE NOTICE 'Unscheduled existing job: %',
job_name;
ELSE RAISE NOTICE 'Job % does not exist, skipping unschedule',
job_name;
END IF;
EXCEPTION
WHEN OTHERS THEN RAISE WARNING 'Error unscheduling job %: %',
job_name,
SQLERRM;
END;
$$;
-- ============================================================================
-- CRON JOB SETUP
-- ============================================================================
-- 1. EMAIL PROCESSOR - Every minute, processes 3-4 emails per batch
-- Remove existing job if it exists
SELECT public.safe_unschedule_job('email-processor-job');
SELECT cron.schedule(
    'email-processor-job',
    -- job name
    '* * * * *',
    -- every minute
    $$SELECT public.execute_cron_job(
      'email-processor',
      'email-processor',
      '{"batch_size": 4}'::jsonb
    );
$$
);
-- 2. STATUS UPDATER - Every 5 minutes, sync delivery status from Mailtrap
-- This calls the webhook-handler to process any pending webhook events
SELECT public.safe_unschedule_job('status-updater-job');
SELECT cron.schedule(
    'status-updater-job',
    -- job name
    '*/5 * * * *',
    -- every 5 minutes
    $$SELECT public.execute_cron_job(
      'status-updater',
      'webhook-handler',
      '{}'::jsonb
    );
$$
);
-- 3. CAMPAIGN SCHEDULER - Every minute, starts scheduled campaigns
SELECT public.safe_unschedule_job('campaign-scheduler-job');
SELECT cron.schedule(
    'campaign-scheduler-job',
    -- job name
    '* * * * *',
    -- every minute
    $$SELECT public.execute_cron_job(
      'campaign-scheduler',
      'campaign-scheduler',
      '{"batch_size": 5}'::jsonb
    );
$$
);
-- 4. BOUNCE HANDLER - Every 15 minutes, processes bounces
SELECT public.safe_unschedule_job('bounce-handler-job');
SELECT cron.schedule(
    'bounce-handler-job',
    -- job name
    '*/15 * * * *',
    -- every 15 minutes
    $$SELECT public.execute_cron_job(
      'bounce-handler',
      'bounce-processor',
      '{}'::jsonb
    );
$$
);
-- 5. LOG CLEANUP - Daily at 3 AM, clean up old logs
SELECT public.safe_unschedule_job('log-cleanup-job');
SELECT cron.schedule(
    'log-cleanup-job',
    -- job name
    '0 3 * * *',
    -- daily at 3 AM
    $$SELECT public.cleanup_cron_logs();
$$
);
-- ============================================================================
-- MONITORING AND UTILITIES
-- ============================================================================
-- View to check cron job status
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT job_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (
    WHERE success = true
  ) as successful_executions,
  COUNT(*) FILTER (
    WHERE success = false
  ) as failed_executions,
  ROUND(
    (
      COUNT(*) FILTER (
        WHERE success = true
      )::numeric / COUNT(*)::numeric
    ) * 100,
    2
  ) as success_rate_percent,
  AVG(execution_time_ms) as avg_execution_time_ms,
  MAX(started_at) as last_execution,
  MAX(
    CASE
      WHEN success = true THEN started_at
    END
  ) as last_successful_execution,
  MAX(
    CASE
      WHEN success = false THEN started_at
    END
  ) as last_failed_execution
FROM public.cron_job_logs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name
ORDER BY job_name;
-- Function to get recent job logs
CREATE OR REPLACE FUNCTION public.get_recent_cron_logs(
    job_name_filter TEXT DEFAULT NULL,
    hours_back INTEGER DEFAULT 24,
    limit_rows INTEGER DEFAULT 100
  ) RETURNS TABLE (
    id BIGINT,
    job_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    success BOOLEAN,
    execution_time_ms INTEGER,
    error_message TEXT,
    result_summary TEXT
  ) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY
SELECT l.id,
  l.job_name,
  l.started_at,
  l.completed_at,
  l.success,
  l.execution_time_ms,
  l.error_message,
  CASE
    WHEN l.result IS NOT NULL THEN COALESCE(l.result->>'message', 'No message')
    ELSE 'No result'
  END as result_summary
FROM public.cron_job_logs l
WHERE l.started_at > NOW() - (hours_back || ' hours')::interval
  AND (
    job_name_filter IS NULL
    OR l.job_name = job_name_filter
  )
ORDER BY l.started_at DESC
LIMIT limit_rows;
END;
$$;
-- Function to manually trigger a cron job (for testing)
CREATE OR REPLACE FUNCTION public.trigger_cron_job(
    job_name TEXT,
    function_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb
  ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
BEGIN -- Execute the job
PERFORM public.execute_cron_job(job_name || '-manual', function_name, payload);
-- Return the latest log entry for this manual execution
SELECT jsonb_build_object(
    'job_name',
    l.job_name,
    'success',
    l.success,
    'execution_time_ms',
    l.execution_time_ms,
    'result',
    l.result,
    'error_message',
    l.error_message
  ) INTO result
FROM public.cron_job_logs l
WHERE l.job_name = job_name || '-manual'
ORDER BY l.started_at DESC
LIMIT 1;
RETURN result;
END;
$$;
-- ============================================================================
-- SETTINGS AND CONFIGURATION
-- ============================================================================
-- Create settings table for runtime configuration
CREATE TABLE IF NOT EXISTS public.cron_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS
ALTER TABLE public.cron_settings ENABLE ROW LEVEL SECURITY;
-- Insert default settings
INSERT INTO public.cron_settings (key, value, description)
VALUES (
    'email_batch_size',
    '4',
    'Number of emails to process per batch in email-processor'
  ),
  (
    'campaign_batch_size',
    '5',
    'Number of campaigns to process per batch in campaign-scheduler'
  ),
  (
    'max_retry_attempts',
    '3',
    'Maximum number of retry attempts for failed cron jobs'
  ),
  (
    'log_retention_days',
    '7',
    'Number of days to retain cron job logs'
  ) ON CONFLICT (key) DO NOTHING;
-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.cron_job_logs IS 'Logs for all scheduled cron job executions';
COMMENT ON VIEW public.cron_job_status IS 'Summary view of cron job performance over the last 24 hours';
COMMENT ON TABLE public.cron_settings IS 'Runtime configuration settings for cron jobs';
COMMENT ON FUNCTION public.call_edge_function IS 'Makes HTTP requests to Supabase Edge Functions with error handling';
COMMENT ON FUNCTION public.execute_cron_job IS 'Executes a cron job and logs the results';
COMMENT ON FUNCTION public.cleanup_cron_logs IS 'Removes old cron job logs to manage storage';
COMMENT ON FUNCTION public.get_recent_cron_logs IS 'Retrieves recent cron job execution logs';
COMMENT ON FUNCTION public.trigger_cron_job IS 'Manually triggers a cron job for testing purposes';
-- Grant permissions for monitoring
GRANT SELECT ON public.cron_job_logs TO authenticated;
GRANT SELECT ON public.cron_job_status TO authenticated;
GRANT SELECT ON public.cron_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_cron_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_cron_job TO authenticated;
