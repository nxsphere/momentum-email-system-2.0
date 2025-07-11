-- Enable Realtime for Email System Tables
-- This migration enables real-time subscriptions for campaign monitoring
-- Enable realtime for email tracking and monitoring
ALTER PUBLICATION supabase_realtime
ADD TABLE email_logs;
ALTER PUBLICATION supabase_realtime
ADD TABLE email_queue;
ALTER PUBLICATION supabase_realtime
ADD TABLE email_campaigns;
-- Optional: Enable for templates if you want collaboration features
ALTER PUBLICATION supabase_realtime
ADD TABLE email_templates;
ALTER PUBLICATION supabase_realtime
ADD TABLE contacts;
-- Grant necessary permissions for realtime access
-- These tables can now be subscribed to via Supabase Realtime
