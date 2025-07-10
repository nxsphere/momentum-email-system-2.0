-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Create enum types for better type safety
CREATE TYPE contact_status AS ENUM ('active', 'unsubscribed', 'bounced');
CREATE TYPE campaign_status AS ENUM (
    'draft',
    'scheduled',
    'running',
    'completed',
    'cancelled'
);
CREATE TYPE email_log_status AS ENUM (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'failed'
);
-- =============================================
-- CONTACTS TABLE
-- =============================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status contact_status NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- EMAIL TEMPLATES TABLE
-- =============================================
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    variables JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- EMAIL CAMPAIGNS TABLE
-- =============================================
CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES email_templates(id) ON DELETE
    SET NULL,
        name VARCHAR(255) NOT NULL,
        status campaign_status NOT NULL DEFAULT 'draft',
        scheduled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        -- Ensure sent_count doesn't exceed total_recipients
        CONSTRAINT sent_count_check CHECK (sent_count <= total_recipients)
);
-- =============================================
-- EMAIL LOGS TABLE
-- =============================================
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status email_log_status NOT NULL DEFAULT 'sent',
    mailtrap_message_id VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounce_reason TEXT,
    tracking_data JSONB DEFAULT '{}',
    -- Ensure logical timestamp ordering
    CONSTRAINT timestamp_order_check CHECK (
        delivered_at IS NULL
        OR delivered_at >= sent_at
    ),
    CONSTRAINT opened_timestamp_check CHECK (
        opened_at IS NULL
        OR opened_at >= COALESCE(delivered_at, sent_at)
    ),
    CONSTRAINT clicked_timestamp_check CHECK (
        clicked_at IS NULL
        OR clicked_at >= COALESCE(opened_at, delivered_at, sent_at)
    )
);
-- =============================================
-- PERFORMANCE INDEXES
-- =============================================
-- Contacts indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_metadata ON contacts USING gin(metadata);
-- Email templates indexes
CREATE INDEX idx_email_templates_name ON email_templates(name);
CREATE INDEX idx_email_templates_created_at ON email_templates(created_at);
CREATE INDEX idx_email_templates_variables ON email_templates USING gin(variables);
-- Email campaigns indexes
CREATE INDEX idx_email_campaigns_template_id ON email_campaigns(template_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);
CREATE INDEX idx_email_campaigns_created_at ON email_campaigns(created_at);
-- Email logs indexes (crucial for performance)
CREATE INDEX idx_email_logs_campaign_id ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_contact_id ON email_logs(contact_id);
CREATE INDEX idx_email_logs_email ON email_logs(email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_mailtrap_message_id ON email_logs(mailtrap_message_id);
CREATE INDEX idx_email_logs_tracking_data ON email_logs USING gin(tracking_data);
-- Composite indexes for common queries
CREATE INDEX idx_email_logs_campaign_status ON email_logs(campaign_id, status);
CREATE INDEX idx_email_logs_contact_status ON email_logs(contact_id, status);
CREATE INDEX idx_contacts_status_created ON contacts(status, created_at);
-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================
-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
-- Contacts policies
CREATE POLICY "Users can view all contacts" ON contacts FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert contacts" ON contacts FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update contacts" ON contacts FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete contacts" ON contacts FOR DELETE TO authenticated USING (true);
-- Email templates policies
CREATE POLICY "Users can view all email templates" ON email_templates FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert email templates" ON email_templates FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update email templates" ON email_templates FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete email templates" ON email_templates FOR DELETE TO authenticated USING (true);
-- Email campaigns policies
CREATE POLICY "Users can view all email campaigns" ON email_campaigns FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert email campaigns" ON email_campaigns FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update email campaigns" ON email_campaigns FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete email campaigns" ON email_campaigns FOR DELETE TO authenticated USING (true);
-- Email logs policies (read-only for most operations)
CREATE POLICY "Users can view all email logs" ON email_logs FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert email logs" ON email_logs FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update email logs" ON email_logs FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_contacts_updated_at BEFORE
UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE
UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =============================================
-- FUNCTIONS FOR CAMPAIGN STATISTICS
-- =============================================
-- Function to get campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_uuid UUID) RETURNS TABLE (
        total_sent BIGINT,
        total_delivered BIGINT,
        total_opened BIGINT,
        total_clicked BIGINT,
        total_bounced BIGINT,
        delivery_rate DECIMAL(5, 2),
        open_rate DECIMAL(5, 2),
        click_rate DECIMAL(5, 2),
        bounce_rate DECIMAL(5, 2)
    ) AS $$ BEGIN RETURN QUERY
SELECT COUNT(*) as total_sent,
    COUNT(*) FILTER (
        WHERE status = 'delivered'
    ) as total_delivered,
    COUNT(*) FILTER (
        WHERE status = 'opened'
    ) as total_opened,
    COUNT(*) FILTER (
        WHERE status = 'clicked'
    ) as total_clicked,
    COUNT(*) FILTER (
        WHERE status = 'bounced'
    ) as total_bounced,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE status = 'delivered'
            )
        )::DECIMAL / NULLIF(COUNT(*), 0) * 100,
        2
    ) as delivery_rate,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE status = 'opened'
            )
        )::DECIMAL / NULLIF(
            COUNT(*) FILTER (
                WHERE status = 'delivered'
            ),
            0
        ) * 100,
        2
    ) as open_rate,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE status = 'clicked'
            )
        )::DECIMAL / NULLIF(
            COUNT(*) FILTER (
                WHERE status = 'delivered'
            ),
            0
        ) * 100,
        2
    ) as click_rate,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE status = 'bounced'
            )
        )::DECIMAL / NULLIF(COUNT(*), 0) * 100,
        2
    ) as bounce_rate
FROM email_logs
WHERE campaign_id = campaign_uuid;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================
-- Insert sample email template
INSERT INTO email_templates (
        name,
        subject,
        html_content,
        text_content,
        variables
    )
VALUES (
        'Welcome Email',
        'Welcome {{first_name}}! 🎉',
        '<html><body><h1>Welcome {{first_name}}!</h1><p>Thanks for joining us, {{first_name}} {{last_name}}!</p></body></html>',
        'Welcome {{first_name}}! Thanks for joining us, {{first_name}} {{last_name}}!',
        '{"first_name": "John", "last_name": "Doe"}'
    );
-- Insert sample contacts
INSERT INTO contacts (email, first_name, last_name, status)
VALUES ('john.doe@example.com', 'John', 'Doe', 'active'),
    (
        'jane.smith@example.com',
        'Jane',
        'Smith',
        'active'
    ),
    ('test@example.com', 'Test', 'User', 'active');