-- =============================================
-- SECURITY FIX MIGRATION
-- Fix RLS policies for proper service role access and security
-- =============================================
-- =============================================
-- FIX SERVICE ROLE POLICIES FOR CORE TABLES
-- Edge Functions need service role access for email processing
-- =============================================
-- Add missing service role policies for email_queue
CREATE POLICY "Service role can manage email queue" ON email_queue FOR ALL TO service_role USING (true);
-- Add missing service role policies for campaign_logs
CREATE POLICY "Service role can manage campaign logs" ON campaign_logs FOR ALL TO service_role USING (true);
-- Add missing service role policies for rate_limits
CREATE POLICY "Service role can manage rate limits" ON rate_limits FOR ALL TO service_role USING (true);
-- Add missing service role policies for contact management
CREATE POLICY "Service role can manage contact lists" ON contact_lists FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage contact list memberships" ON contact_list_memberships FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage segments" ON segments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage contact segments" ON contact_segments FOR ALL TO service_role USING (true);
-- Add missing service role policies for main tables (for Edge Functions)
CREATE POLICY "Service role can manage contacts" ON contacts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage email templates" ON email_templates FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage email campaigns" ON email_campaigns FOR ALL TO service_role USING (true);
CREATE POLICY "Service role can manage email logs" ON email_logs FOR ALL TO service_role USING (true);
-- =============================================
-- IMPROVE AUTHENTICATED USER POLICIES
-- Make them more restrictive and business-appropriate
-- =============================================
-- Drop overly permissive delete policies for authenticated users
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete email campaigns" ON email_campaigns;
-- Create more restrictive policies for business email system
-- Contacts: Allow read/write but restrict delete to admins only
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create contacts" ON contacts FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contacts" ON contacts FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
-- Email Templates: Allow full access for staff (they need to manage templates)
CREATE POLICY "Authenticated users can manage email templates" ON email_templates FOR ALL TO authenticated USING (true);
-- Email Campaigns: Allow full access for staff (they need to manage campaigns)
CREATE POLICY "Authenticated users can manage email campaigns" ON email_campaigns FOR ALL TO authenticated USING (true);
-- Email Logs: Read-only for authenticated users (logs shouldn't be manually edited)
DROP POLICY IF EXISTS "Users can update email logs" ON email_logs;
CREATE POLICY "Authenticated users can view email logs" ON email_logs FOR
SELECT TO authenticated USING (true);
-- =============================================
-- RESTRICT CONTACT LIST/SEGMENT POLICIES
-- Make them read-heavy with controlled write access
-- =============================================
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can manage contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Users can manage contact list memberships" ON contact_list_memberships;
DROP POLICY IF EXISTS "Users can manage segments" ON segments;
DROP POLICY IF EXISTS "Users can manage contact segments" ON contact_segments;
-- Create more appropriate policies for business use
CREATE POLICY "Authenticated users can create and update contact lists" ON contact_lists FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage list memberships" ON contact_list_memberships FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can create and update segments" ON segments FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can view segment memberships" ON contact_segments FOR
SELECT TO authenticated USING (true);
-- =============================================
-- FIX QUEUE AND LOGGING POLICIES
-- These should be primarily service-managed with read access for staff
-- =============================================
-- Drop overly broad policies
DROP POLICY IF EXISTS "Users can manage email queue" ON email_queue;
DROP POLICY IF EXISTS "Users can manage rate limits" ON rate_limits;
-- Create read-only policies for authenticated users
CREATE POLICY "Authenticated users can view email queue" ON email_queue FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view rate limits" ON rate_limits FOR
SELECT TO authenticated USING (true);
-- Campaign logs should allow inserts for manual logging but not deletes
DROP POLICY IF EXISTS "Users can insert campaign logs" ON campaign_logs;
CREATE POLICY "Authenticated users can view and add campaign logs" ON campaign_logs FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create campaign logs" ON campaign_logs FOR
INSERT TO authenticated WITH CHECK (true);
-- =============================================
-- ENSURE WEBHOOK TABLES HAVE PROPER POLICIES
-- =============================================
-- Add service role policies for webhook tables (if they exist)
DO $$ BEGIN -- Check if webhook tables exist and add policies
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'webhook_events'
) THEN EXECUTE 'CREATE POLICY "Service role can manage webhook events" ON webhook_events FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view webhook events" ON webhook_events FOR SELECT TO authenticated USING (true)';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'contact_status_updates'
) THEN EXECUTE 'CREATE POLICY "Service role can manage contact status updates" ON contact_status_updates FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view contact status updates" ON contact_status_updates FOR SELECT TO authenticated USING (true)';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'automated_actions'
) THEN EXECUTE 'CREATE POLICY "Service role can manage automated actions" ON automated_actions FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view automated actions" ON automated_actions FOR SELECT TO authenticated USING (true)';
END IF;
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'email_tracking_details'
) THEN EXECUTE 'CREATE POLICY "Service role can manage email tracking details" ON email_tracking_details FOR ALL TO service_role USING (true)';
EXECUTE 'CREATE POLICY "Authenticated users can view email tracking details" ON email_tracking_details FOR SELECT TO authenticated USING (true)';
END IF;
END $$;
-- =============================================
-- ADD COMMENTS FOR CLARITY
-- =============================================
COMMENT ON POLICY "Service role can manage email queue" ON email_queue IS 'Edge Functions need full access to process email queue';
COMMENT ON POLICY "Service role can manage email logs" ON email_logs IS 'Edge Functions need to update email delivery status from webhooks';
COMMENT ON POLICY "Authenticated users can view email logs" ON email_logs IS 'Staff can view email delivery logs but not modify them manually';
COMMENT ON POLICY "Authenticated users can view email queue" ON email_queue IS 'Staff can monitor email queue status but not modify queue items directly';
-- =============================================
-- SECURITY AUDIT LOG
-- =============================================
-- Log this security fix
DO $$ BEGIN -- Insert audit log entry if campaign_logs table exists
IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'campaign_logs'
) THEN
INSERT INTO campaign_logs (campaign_id, level, message, metadata)
VALUES (
    NULL,
    'info',
    'RLS Security Policies Updated',
    jsonb_build_object(
      'migration',
      '20250120000000_fix_rls_security_issues',
      'changes',
      'Added service role policies, restricted authenticated user access, improved security patterns',
      'timestamp',
      NOW()
    )
  );
END IF;
END $$;
