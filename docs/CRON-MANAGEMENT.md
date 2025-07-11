# Supabase Cron Jobs Management

This document provides SQL commands and instructions for managing and monitoring the email system cron jobs.

## Setup Instructions

### 1. Apply the Migration

```bash
# Apply the cron jobs migration
supabase db push

# Or if using migrations
supabase migration up
```

### 2. Configure Settings

Before running the cron jobs, you need to set up the required database settings:

```sql
-- Set your Supabase project reference (replace with your actual project ref)
ALTER DATABASE postgres SET app.settings.project_ref = 'your-project-ref-here';

-- Set your service role key (replace with your actual service role key)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- Verify settings
SELECT name, setting FROM pg_settings
WHERE name LIKE 'app.settings.%';
```

## Cron Jobs Overview

| Job Name | Schedule | Function | Purpose | Batch Size |
|----------|----------|----------|---------|------------|
| `email-processor-job` | Every minute | email-processor | Process email queue | 4 emails |
| `status-updater-job` | Every 5 minutes | webhook-handler | Sync delivery status | N/A |
| `campaign-scheduler-job` | Every minute | campaign-scheduler | Start scheduled campaigns | 5 campaigns |
| `bounce-handler-job` | Every 15 minutes | bounce-processor | Process bounces | 1000 notifications |
| `log-cleanup-job` | Daily at 3 AM | cleanup_cron_logs | Clean old logs | N/A |

## Monitoring Commands

### Check Job Status (Last 24 Hours)

```sql
-- Overall job performance summary
SELECT * FROM public.cron_job_status;

-- Detailed view with execution times
SELECT
    job_name,
    total_executions,
    success_rate_percent,
    ROUND(avg_execution_time_ms/1000.0, 2) as avg_execution_seconds,
    last_execution,
    last_successful_execution,
    last_failed_execution
FROM public.cron_job_status
ORDER BY success_rate_percent DESC;
```

### View Recent Job Logs

```sql
-- Get recent logs for all jobs (last 24 hours)
SELECT * FROM public.get_recent_cron_logs();

-- Get logs for specific job
SELECT * FROM public.get_recent_cron_logs('email-processor');

-- Get logs for last 6 hours only
SELECT * FROM public.get_recent_cron_logs(NULL, 6);

-- Get failed jobs only
SELECT * FROM public.get_recent_cron_logs()
WHERE success = false;
```

### Check Currently Scheduled Jobs

```sql
-- View all scheduled cron jobs
SELECT
    jobname,
    schedule,
    command,
    active,
    jobid
FROM cron.job
WHERE jobname LIKE '%-job'
ORDER BY jobname;
```

## Manual Job Execution (Testing)

### Trigger Individual Jobs

```sql
-- Test email processor with small batch
SELECT public.trigger_cron_job(
    'email-processor-test',
    'email-processor',
    '{"batch_size": 2}'::jsonb
);

-- Test campaign scheduler
SELECT public.trigger_cron_job(
    'campaign-scheduler-test',
    'campaign-scheduler',
    '{"batch_size": 1}'::jsonb
);

-- Test bounce processor
SELECT public.trigger_cron_job(
    'bounce-processor-test',
    'bounce-processor',
    '{}'::jsonb
);

-- Test webhook handler
SELECT public.trigger_cron_job(
    'webhook-handler-test',
    'webhook-handler',
    '{}'::jsonb
);
```

## Job Management Commands

### Pause/Resume Jobs

```sql
-- Pause a specific job
UPDATE cron.job
SET active = false
WHERE jobname = 'email-processor-job';

-- Resume a specific job
UPDATE cron.job
SET active = true
WHERE jobname = 'email-processor-job';

-- Pause all email system jobs
UPDATE cron.job
SET active = false
WHERE jobname LIKE '%-job';

-- Resume all email system jobs
UPDATE cron.job
SET active = true
WHERE jobname LIKE '%-job';
```

### Modify Job Schedules

```sql
-- Change email processor to run every 2 minutes
SELECT cron.alter_job('email-processor-job', schedule => '*/2 * * * *');

-- Change bounce handler to run every 30 minutes
SELECT cron.alter_job('bounce-handler-job', schedule => '*/30 * * * *');

-- Change campaign scheduler to run every 5 minutes
SELECT cron.alter_job('campaign-scheduler-job', schedule => '*/5 * * * *');
```

### Delete Jobs

```sql
-- Remove a specific job
SELECT cron.unschedule('email-processor-job');

-- Remove all email system jobs
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname LIKE '%-job';
```

## Configuration Management

### Update Runtime Settings

```sql
-- Change email batch size
UPDATE public.cron_settings
SET value = '3', updated_at = NOW()
WHERE key = 'email_batch_size';

-- Change campaign batch size
UPDATE public.cron_settings
SET value = '10', updated_at = NOW()
WHERE key = 'campaign_batch_size';

-- View current settings
SELECT * FROM public.cron_settings
ORDER BY key;
```

### Apply New Settings to Jobs

After changing settings, you need to recreate the jobs with new parameters:

```sql
-- Update email processor with new batch size
SELECT cron.unschedule('email-processor-job');
SELECT cron.schedule(
    'email-processor-job',
    '* * * * *',
    $$SELECT public.execute_cron_job(
        'email-processor',
        'email-processor',
        '{"batch_size": 3}'::jsonb
    );$$
);
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Jobs Not Running

```sql
-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if jobs are scheduled
SELECT jobname, active, schedule FROM cron.job;

-- Check for recent errors
SELECT * FROM public.get_recent_cron_logs()
WHERE success = false
ORDER BY started_at DESC
LIMIT 10;
```

#### 2. Edge Function Errors

```sql
-- Check function call errors
SELECT
    job_name,
    error_message,
    result,
    started_at
FROM public.cron_job_logs
WHERE success = false
    AND error_message IS NOT NULL
ORDER BY started_at DESC;
```

#### 3. Rate Limiting Issues

```sql
-- Check execution frequency
SELECT
    job_name,
    DATE_TRUNC('minute', started_at) as minute,
    COUNT(*) as executions_per_minute
FROM public.cron_job_logs
WHERE started_at > NOW() - INTERVAL '1 hour'
GROUP BY job_name, DATE_TRUNC('minute', started_at)
HAVING COUNT(*) > 1
ORDER BY executions_per_minute DESC;
```

### Performance Monitoring

```sql
-- Find slow-running jobs
SELECT
    job_name,
    execution_time_ms,
    started_at,
    success
FROM public.cron_job_logs
WHERE execution_time_ms > 30000  -- More than 30 seconds
ORDER BY execution_time_ms DESC;

-- Average execution times by job
SELECT
    job_name,
    COUNT(*) as total_runs,
    ROUND(AVG(execution_time_ms)/1000.0, 2) as avg_seconds,
    ROUND(MAX(execution_time_ms)/1000.0, 2) as max_seconds,
    ROUND(MIN(execution_time_ms)/1000.0, 2) as min_seconds
FROM public.cron_job_logs
WHERE started_at > NOW() - INTERVAL '7 days'
    AND execution_time_ms IS NOT NULL
GROUP BY job_name
ORDER BY avg_seconds DESC;
```

## Alerting and Notifications

### Setup Failure Alerts

```sql
-- Create function to send alerts (you'll need to implement notification logic)
CREATE OR REPLACE FUNCTION public.alert_on_job_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only alert on failures
    IF NEW.success = false AND NEW.completed_at IS NOT NULL THEN
        -- Log the failure
        RAISE WARNING 'ALERT: Cron job % failed: %', NEW.job_name, NEW.error_message;

        -- Here you could call an Edge Function to send notifications
        -- PERFORM public.call_edge_function('send-alert',
        --     jsonb_build_object('job_name', NEW.job_name, 'error', NEW.error_message));
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for failure alerts
DROP TRIGGER IF EXISTS trigger_job_failure_alert ON public.cron_job_logs;
CREATE TRIGGER trigger_job_failure_alert
    AFTER UPDATE ON public.cron_job_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.alert_on_job_failure();
```

## Best Practices

1. **Monitor Regularly**: Check the `cron_job_status` view daily
2. **Log Retention**: The system keeps 7 days of logs by default
3. **Batch Sizes**: Start small and increase based on performance
4. **Rate Limiting**: Respect Mailtrap's rate limits (adjust schedules if needed)
5. **Error Handling**: All functions have built-in retry logic
6. **Testing**: Use manual triggers before deploying schedule changes

## Emergency Procedures

### Stop All Jobs Immediately

```sql
-- Disable all cron jobs
UPDATE cron.job SET active = false WHERE jobname LIKE '%-job';
```

### Emergency Rate Limit Adjustment

```sql
-- Reduce email processing frequency to every 5 minutes
SELECT cron.alter_job('email-processor-job', schedule => '*/5 * * * *');

-- Reduce batch size to 1
SELECT cron.unschedule('email-processor-job');
SELECT cron.schedule(
    'email-processor-job',
    '*/5 * * * *',
    $$SELECT public.execute_cron_job(
        'email-processor',
        'email-processor',
        '{"batch_size": 1}'::jsonb
    );$$
);
```

### Clear All Logs

```sql
-- Clear all cron job logs (use with caution)
TRUNCATE public.cron_job_logs;
```
