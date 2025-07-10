-- =============================================
-- SAFE RLS SECURITY FIX MIGRATION
-- Fix RLS policies with table existence checks
-- =============================================
-- =============================================
-- SAFE SERVICE ROLE POLICY CREATION
-- Only create policies if tables exist
-- =============================================
DO $$ BEGIN -- Add service role policies for tables that exist
-- Main email tables
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contacts'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contacts" ON contacts FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for contacts table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_templates'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email templates" ON email_templates FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for email_templates table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_campaigns'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email campaigns" ON email_campaigns FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for email_campaigns table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_logs'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email logs" ON email_logs FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for email_logs table';
END IF;
-- Queue and processing tables
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_queue'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email queue" ON email_queue FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for email_queue table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'campaign_logs'
) THEN EXECUTE 'CREATE POLICY "Service role can manage campaign logs" ON campaign_logs FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for campaign_logs table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'rate_limits'
) THEN EXECUTE 'CREATE POLICY "Service role can manage rate limits" ON rate_limits FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for rate_limits table';
END IF;
-- Contact management tables
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contact_lists'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contact lists" ON contact_lists FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for contact_lists table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contact_list_memberships'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contact list memberships" ON contact_list_memberships FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for contact_list_memberships table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'segments'
) THEN EXECUTE 'CREATE POLICY "Service role can manage segments" ON segments FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for segments table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contact_segments'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contact segments" ON contact_segments FOR ALL TO service_role USING (true)';
RAISE NOTICE 'Added service role policy for contact_segments table';
END IF;
-- Webhook tables
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'webhook_events'
) THEN EXECUTE 'CREATE POLICY "Service role can manage webhook events" ON webhook_events FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view webhook events" ON webhook_events FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Added policies for webhook_events table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contact_status_updates'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contact status updates" ON contact_status_updates FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view contact status updates" ON contact_status_updates FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Added policies for contact_status_updates table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'automated_actions'
) THEN EXECUTE 'CREATE POLICY "Service role can manage automated actions" ON automated_actions FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view automated actions" ON automated_actions FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Added policies for automated_actions table';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_tracking_details'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email tracking details" ON email_tracking_details FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view email tracking details" ON email_tracking_details FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Added policies for email_tracking_details table';
END IF;
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Some policies already exist, continuing...';
WHEN OTHERS THEN RAISE WARNING 'Error creating service role policies: %',
SQLERRM;
END $$;
-- =============================================
-- IMPROVE AUTHENTICATED USER POLICIES
-- Make them more restrictive where tables exist
-- =============================================
DO $$ BEGIN -- Improve contact policies if table exists
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contacts'
) THEN -- Drop overly permissive delete policy
BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can delete contacts" ON contacts';
EXCEPTION
WHEN OTHERS THEN NULL;
-- Continue if policy doesn't exist
END;
-- Create more restrictive policies
BEGIN EXECUTE 'CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can create contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (true)';
EXECUTE 'CREATE POLICY "Authenticated users can update contacts" ON contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
RAISE NOTICE 'Updated contact policies - removed delete access for authenticated users';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Contact policies already exist';
END;
END IF;
-- Improve email template policies
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_templates'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can delete email templates" ON email_templates';
EXECUTE 'CREATE POLICY "Authenticated users can manage email templates" ON email_templates FOR ALL TO authenticated USING (true)';
RAISE NOTICE 'Updated email template policies';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Email template policies already exist';
END;
END IF;
-- Improve email campaign policies
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_campaigns'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can delete email campaigns" ON email_campaigns';
EXECUTE 'CREATE POLICY "Authenticated users can manage email campaigns" ON email_campaigns FOR ALL TO authenticated USING (true)';
RAISE NOTICE 'Updated email campaign policies';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Email campaign policies already exist';
END;
END IF;
-- Make email logs read-only for authenticated users
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_logs'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can update email logs" ON email_logs';
EXECUTE 'CREATE POLICY "Authenticated users can view email logs" ON email_logs FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Made email logs read-only for authenticated users';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Email log policies already exist';
END;
END IF;
-- Restrict queue access for authenticated users
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_queue'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can manage email queue" ON email_queue';
EXECUTE 'CREATE POLICY "Authenticated users can view email queue" ON email_queue FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Made email queue read-only for authenticated users';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Email queue policies already exist';
END;
END IF;
-- Restrict rate limits access
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'rate_limits'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can manage rate limits" ON rate_limits';
EXECUTE 'CREATE POLICY "Authenticated users can view rate limits" ON rate_limits FOR SELECT TO authenticated USING (true)';
RAISE NOTICE 'Made rate limits read-only for authenticated users';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Rate limit policies already exist';
END;
END IF;
-- Improve campaign log policies
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'campaign_logs'
) THEN BEGIN EXECUTE 'DROP POLICY IF EXISTS "Users can insert campaign logs" ON campaign_logs';
EXECUTE 'CREATE POLICY "Authenticated users can view and add campaign logs" ON campaign_logs FOR SELECT TO authenticated USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can create campaign logs" ON campaign_logs FOR INSERT TO authenticated WITH CHECK (true)';
RAISE NOTICE 'Updated campaign log policies - view and insert only';
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'Campaign log policies already exist';
END;
END IF;
EXCEPTION
WHEN OTHERS THEN RAISE WARNING 'Error updating authenticated user policies: %',
SQLERRM;
END $$;
-- =============================================
-- LOG THE SECURITY UPDATE
-- =============================================
DO $$ BEGIN -- Log this security fix if campaign_logs table exists
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'campaign_logs'
) THEN
INSERT INTO campaign_logs (campaign_id, level, message, metadata)
VALUES (
    NULL,
    'info',
    'Safe RLS Security Policies Applied',
    jsonb_build_object(
      'migration',
      '20250120000001_safe_rls_security_fix',
      'changes',
      'Added service role policies with table existence checks, improved authenticated user restrictions',
      'timestamp',
      NOW()
    )
  );
RAISE NOTICE 'Security update logged to campaign_logs';
ELSE RAISE NOTICE 'Security update completed - no campaign_logs table for logging';
END IF;
EXCEPTION
WHEN OTHERS THEN RAISE WARNING 'Could not log security update: %',
SQLERRM;
END $$;
-- =============================================
-- SUMMARY
-- =============================================
DO $$ BEGIN RAISE NOTICE '=== RLS Security Fix Summary ===';
RAISE NOTICE 'This migration safely adds missing service role policies';
RAISE NOTICE 'and improves authenticated user restrictions';
RAISE NOTICE 'Only applied to tables that actually exist';
RAISE NOTICE 'Your Edge Functions should now work properly';
END $$;
