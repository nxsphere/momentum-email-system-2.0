-- Quick Setup: Supabase Cron Jobs for Email System
-- Run these commands directly in your Supabase SQL editor
-- ============================================================================
-- PREREQUISITES
-- ============================================================================
-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Set your project configuration (REPLACE WITH YOUR ACTUAL VALUES)
ALTER DATABASE postgres
SET app.settings.project_ref = 'your-project-ref-here';
ALTER DATABASE postgres
SET app.settings.service_role_key = 'your-service-role-key-here';
-- ============================================================================
-- ESSENTIAL FUNCTIONS
-- ============================================================================
-- Function to call Edge Functions
CREATE OR REPLACE FUNCTION public.call_edge_function(
    function_name TEXT,
    payload JSONB DEFAULT '{}'::jsonb
  ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
function_url TEXT;
headers JSONB;
response RECORD;
BEGIN function_url := format(
  'https://%s.supabase.co/functions/v1/%s',
  current_setting('app.settings.project_ref', true),
  function_name
);
headers := jsonb_build_object(
  'Content-Type',
  'application/json',
  'Authorization',
  format(
    'Bearer %s',
    current_setting('app.settings.service_role_key', true)
  )
);
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
IF response.status BETWEEN 200 AND 299 THEN result := jsonb_build_object('success', true, 'data', response.body);
ELSE result := jsonb_build_object('success', false, 'error', response.body);
END IF;
RETURN result;
EXCEPTION
WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
-- Simple logging table
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN,
  result JSONB,
  error_message TEXT
);
-- ============================================================================
-- SCHEDULE THE CRON JOBS
-- ============================================================================
-- 1. EMAIL PROCESSOR - Every minute, 4 emails per batch
SELECT cron.schedule(
    'email-processor-job',
    '* * * * *',
    $$
    INSERT INTO public.cron_job_logs (job_name, success, result)
    SELECT 'email-processor',
      (result->>'success')::boolean,
      result
    FROM (
        SELECT public.call_edge_function('email-processor', '{"batch_size": 4}'::jsonb) as result
      ) t;
$$
);
-- 2. STATUS UPDATER - Every 5 minutes
SELECT cron.schedule(
    'status-updater-job',
    '*/5 * * * *',
    $$
    INSERT INTO public.cron_job_logs (job_name, success, result)
    SELECT 'status-updater',
      (result->>'success')::boolean,
      result
    FROM (
        SELECT public.call_edge_function('webhook-handler', '{}'::jsonb) as result
      ) t;
$$
);
-- 3. CAMPAIGN SCHEDULER - Every minute
SELECT cron.schedule(
    'campaign-scheduler-job',
    '* * * * *',
    $$
    INSERT INTO public.cron_job_logs (job_name, success, result)
    SELECT 'campaign-scheduler',
      (result->>'success')::boolean,
      result
    FROM (
        SELECT public.call_edge_function('campaign-scheduler', '{"batch_size": 5}'::jsonb) as result
      ) t;
$$
);
-- 4. BOUNCE HANDLER - Every 15 minutes
SELECT cron.schedule(
    'bounce-handler-job',
    '*/15 * * * *',
    $$
    INSERT INTO public.cron_job_logs (job_name, success, result)
    SELECT 'bounce-handler',
      (result->>'success')::boolean,
      result
    FROM (
        SELECT public.call_edge_function('bounce-processor', '{}'::jsonb) as result
      ) t;
$$
);
-- 5. LOG CLEANUP - Daily at 3 AM
SELECT cron.schedule(
    'log-cleanup-job',
    '0 3 * * *',
    $$DELETE
    FROM public.cron_job_logs
    WHERE started_at < NOW() - INTERVAL '7 days';
$$
);
-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check scheduled jobs
SELECT jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE '%-job'
ORDER BY jobname;
-- Check recent logs
SELECT job_name,
  started_at,
  success,
  result->>'message' as message,
  error_message
FROM public.cron_job_logs
ORDER BY started_at DESC
LIMIT 20;
-- Job performance summary
SELECT job_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (
    WHERE success = true
  ) as successful_runs,
  COUNT(*) FILTER (
    WHERE success = false
  ) as failed_runs,
  ROUND(
    (
      COUNT(*) FILTER (
        WHERE success = true
      )::numeric / COUNT(*)::numeric
    ) * 100,
    2
  ) as success_rate_percent
FROM public.cron_job_logs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name
ORDER BY job_name;
-- ============================================================================
-- MANUAL TESTING COMMANDS
-- ============================================================================
-- Test individual functions (run these one at a time)
-- Test email processor
SELECT public.call_edge_function('email-processor', '{"batch_size": 2}'::jsonb);
-- Test campaign scheduler
SELECT public.call_edge_function('campaign-scheduler', '{"batch_size": 1}'::jsonb);
-- Test bounce processor
SELECT public.call_edge_function('bounce-processor', '{}'::jsonb);
-- Test webhook handler
SELECT public.call_edge_function('webhook-handler', '{}'::jsonb);
-- ============================================================================
-- MANAGEMENT COMMANDS
-- ============================================================================
-- Pause all jobs
-- UPDATE cron.job SET active = false WHERE jobname LIKE '%-job';
-- Resume all jobs
-- UPDATE cron.job SET active = true WHERE jobname LIKE '%-job';
-- Remove all jobs (careful!)
-- SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE '%-job';
-- Change email processor to every 2 minutes
-- SELECT cron.alter_job('email-processor-job', schedule => '*/2 * * * *');
-- Change bounce handler to every 30 minutes
-- SELECT cron.alter_job('bounce-handler-job', schedule => '*/30 * * * *');
-- ============================================================================
-- NOTES
-- ============================================================================
/*
 IMPORTANT SETUP STEPS:
 
 1. Replace 'your-project-ref-here' with your actual Supabase project reference
 2. Replace 'your-service-role-key-here' with your actual service role key
 3. Make sure your Edge Functions are deployed first:
 - email-processor
 - webhook-handler
 - campaign-scheduler
 - bounce-processor
 
 RATE LIMITING CONSIDERATIONS:
 
 - Email processor: 4 emails/minute = 240 emails/hour (respects Mailtrap limits)
 - Campaign scheduler: Runs every minute but only processes scheduled campaigns
 - Bounce handler: Runs every 15 minutes to avoid overwhelming the system
 - Status updater: Runs every 5 minutes for timely status updates
 
 MONITORING:
 
 - Check cron_job_logs table regularly
 - Monitor success rates
 - Watch for error messages
 - Logs are cleaned up automatically after 7 days
 
 EMERGENCY STOP:
 
 UPDATE cron.job SET active = false WHERE jobname LIKE '%-job';
 */
