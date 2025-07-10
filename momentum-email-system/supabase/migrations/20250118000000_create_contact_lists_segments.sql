-- =============================================
-- CONTACT LISTS AND SEGMENTS MIGRATION
-- Create tables for contact list management and segmentation
-- =============================================
-- Enable UUID extension (should already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Create enum types for segmentation
CREATE TYPE segment_type AS ENUM ('static', 'dynamic');
CREATE TYPE contact_list_type AS ENUM ('manual', 'imported', 'generated');
-- =============================================
-- CONTACT LISTS TABLE
-- Organizes contacts into manageable groups
-- =============================================
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type contact_list_type DEFAULT 'manual',
  total_contacts INTEGER DEFAULT 0,
  active_contacts INTEGER DEFAULT 0,
  created_by UUID,
  -- Could reference a users table if needed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- CONTACT LIST MEMBERSHIPS TABLE
-- Many-to-many relationship between contacts and lists
-- =============================================
CREATE TABLE contact_list_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID,
  -- Could reference a users table if needed
  UNIQUE(contact_id, list_id) -- Prevent duplicate memberships
);
-- =============================================
-- SEGMENTS TABLE
-- Dynamic and static segments for advanced filtering
-- =============================================
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type segment_type DEFAULT 'static',
  filter_criteria JSONB DEFAULT '{}',
  -- For dynamic segments
  contact_list_id UUID REFERENCES contact_lists(id) ON DELETE
  SET NULL,
    total_contacts INTEGER DEFAULT 0,
    active_contacts INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- =============================================
-- CONTACT SEGMENTS TABLE
-- Many-to-many relationship between contacts and segments
-- =============================================
CREATE TABLE contact_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- For dynamic segments
  UNIQUE(contact_id, segment_id) -- Prevent duplicate memberships
);
-- =============================================
-- UPDATE EMAIL CAMPAIGNS TABLE
-- Add support for segments and contact lists
-- =============================================
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES segments(id) ON DELETE
SET NULL;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS contact_list_id UUID REFERENCES contact_lists(id) ON DELETE
SET NULL;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS from_email VARCHAR(255) DEFAULT 'funding@momentumbusiness.capital';
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS from_name VARCHAR(255) DEFAULT 'Momentum Business Capital';
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS paused_reason TEXT;
-- Add new campaign status values if needed
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1
  FROM pg_type
  WHERE typname = 'campaign_status'
) THEN CREATE TYPE campaign_status AS ENUM (
  'draft',
  'scheduled',
  'running',
  'completed',
  'cancelled',
  'paused'
);
ELSE -- Add 'paused' status if it doesn't exist
BEGIN ALTER TYPE campaign_status
ADD VALUE 'paused';
EXCEPTION
WHEN duplicate_object THEN NULL;
END;
END IF;
END $$;
-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Contact Lists indexes
CREATE INDEX idx_contact_lists_name ON contact_lists(name);
CREATE INDEX idx_contact_lists_type ON contact_lists(type);
CREATE INDEX idx_contact_lists_created_at ON contact_lists(created_at);
CREATE INDEX idx_contact_lists_metadata ON contact_lists USING gin(metadata);
-- Contact List Memberships indexes
CREATE INDEX idx_contact_list_memberships_contact_id ON contact_list_memberships(contact_id);
CREATE INDEX idx_contact_list_memberships_list_id ON contact_list_memberships(list_id);
CREATE INDEX idx_contact_list_memberships_added_at ON contact_list_memberships(added_at);
-- Segments indexes
CREATE INDEX idx_segments_name ON segments(name);
CREATE INDEX idx_segments_type ON segments(type);
CREATE INDEX idx_segments_contact_list_id ON segments(contact_list_id);
CREATE INDEX idx_segments_created_at ON segments(created_at);
CREATE INDEX idx_segments_filter_criteria ON segments USING gin(filter_criteria);
-- Contact Segments indexes
CREATE INDEX idx_contact_segments_contact_id ON contact_segments(contact_id);
CREATE INDEX idx_contact_segments_segment_id ON contact_segments(segment_id);
CREATE INDEX idx_contact_segments_calculated_at ON contact_segments(calculated_at);
-- Email Campaigns enhanced indexes
CREATE INDEX idx_email_campaigns_segment_id ON email_campaigns(segment_id);
CREATE INDEX idx_email_campaigns_contact_list_id ON email_campaigns(contact_list_id);
CREATE INDEX idx_email_campaigns_priority ON email_campaigns(priority DESC);
CREATE INDEX idx_email_campaigns_started_at ON email_campaigns(started_at);
-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================
-- Enable RLS on new tables
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_list_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;
-- Contact Lists policies
CREATE POLICY "Users can view all contact lists" ON contact_lists FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage contact lists" ON contact_lists FOR ALL TO authenticated USING (true);
-- Contact List Memberships policies
CREATE POLICY "Users can view contact list memberships" ON contact_list_memberships FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage contact list memberships" ON contact_list_memberships FOR ALL TO authenticated USING (true);
-- Segments policies
CREATE POLICY "Users can view all segments" ON segments FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage segments" ON segments FOR ALL TO authenticated USING (true);
-- Contact Segments policies
CREATE POLICY "Users can view contact segments" ON contact_segments FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage contact segments" ON contact_segments FOR ALL TO authenticated USING (true);
-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
-- Function to update updated_at timestamp (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply update_updated_at trigger to new tables
CREATE TRIGGER update_contact_lists_updated_at BEFORE
UPDATE ON contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_segments_updated_at BEFORE
UPDATE ON segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =============================================
-- FUNCTIONS FOR CONTACT LIST MANAGEMENT
-- =============================================
-- Function to refresh contact list counts
CREATE OR REPLACE FUNCTION refresh_contact_list_counts(p_list_id UUID DEFAULT NULL) RETURNS VOID AS $$ BEGIN IF p_list_id IS NOT NULL THEN -- Update specific list
UPDATE contact_lists
SET total_contacts = (
    SELECT COUNT(*)
    FROM contact_list_memberships clm
    WHERE clm.list_id = p_list_id
  ),
  active_contacts = (
    SELECT COUNT(*)
    FROM contact_list_memberships clm
      JOIN contacts c ON clm.contact_id = c.id
    WHERE clm.list_id = p_list_id
      AND c.status = 'active'
  ),
  updated_at = NOW()
WHERE id = p_list_id;
ELSE -- Update all lists
UPDATE contact_lists
SET total_contacts = subquery.total,
  active_contacts = subquery.active,
  updated_at = NOW()
FROM (
    SELECT cl.id,
      COUNT(clm.contact_id) as total,
      COUNT(
        CASE
          WHEN c.status = 'active' THEN 1
        END
      ) as active
    FROM contact_lists cl
      LEFT JOIN contact_list_memberships clm ON cl.id = clm.list_id
      LEFT JOIN contacts c ON clm.contact_id = c.id
    GROUP BY cl.id
  ) as subquery
WHERE contact_lists.id = subquery.id;
END IF;
END;
$$ LANGUAGE plpgsql;
-- Function to refresh segment counts
CREATE OR REPLACE FUNCTION refresh_segment_counts(p_segment_id UUID DEFAULT NULL) RETURNS VOID AS $$ BEGIN IF p_segment_id IS NOT NULL THEN -- Update specific segment
UPDATE segments
SET total_contacts = (
    SELECT COUNT(*)
    FROM contact_segments cs
    WHERE cs.segment_id = p_segment_id
  ),
  active_contacts = (
    SELECT COUNT(*)
    FROM contact_segments cs
      JOIN contacts c ON cs.contact_id = c.id
    WHERE cs.segment_id = p_segment_id
      AND c.status = 'active'
  ),
  last_calculated_at = NOW(),
  updated_at = NOW()
WHERE id = p_segment_id;
ELSE -- Update all segments
UPDATE segments
SET total_contacts = subquery.total,
  active_contacts = subquery.active,
  last_calculated_at = NOW(),
  updated_at = NOW()
FROM (
    SELECT s.id,
      COUNT(cs.contact_id) as total,
      COUNT(
        CASE
          WHEN c.status = 'active' THEN 1
        END
      ) as active
    FROM segments s
      LEFT JOIN contact_segments cs ON s.id = cs.segment_id
      LEFT JOIN contacts c ON cs.contact_id = c.id
    GROUP BY s.id
  ) as subquery
WHERE segments.id = subquery.id;
END IF;
END;
$$ LANGUAGE plpgsql;
-- Function to add contacts to a list
CREATE OR REPLACE FUNCTION add_contacts_to_list(
    p_list_id UUID,
    p_contact_emails TEXT []
  ) RETURNS TABLE (
    added_count INTEGER,
    skipped_count INTEGER,
    not_found_count INTEGER
  ) AS $$
DECLARE v_added_count INTEGER := 0;
v_skipped_count INTEGER := 0;
v_not_found_count INTEGER := 0;
v_contact_id UUID;
contact_email TEXT;
BEGIN FOREACH contact_email IN ARRAY p_contact_emails LOOP -- Find the contact
SELECT id INTO v_contact_id
FROM contacts
WHERE email = contact_email;
IF v_contact_id IS NULL THEN v_not_found_count := v_not_found_count + 1;
ELSE -- Try to add to list
INSERT INTO contact_list_memberships (contact_id, list_id)
VALUES (v_contact_id, p_list_id) ON CONFLICT (contact_id, list_id) DO NOTHING;
IF FOUND THEN v_added_count := v_added_count + 1;
ELSE v_skipped_count := v_skipped_count + 1;
END IF;
END IF;
END LOOP;
-- Refresh list counts
PERFORM refresh_contact_list_counts(p_list_id);
RETURN QUERY
SELECT v_added_count,
  v_skipped_count,
  v_not_found_count;
END;
$$ LANGUAGE plpgsql;
-- Function to calculate dynamic segment membership
CREATE OR REPLACE FUNCTION calculate_dynamic_segment(p_segment_id UUID) RETURNS INTEGER AS $$
DECLARE v_segment RECORD;
v_contact_count INTEGER := 0;
v_sql TEXT;
v_contact_ids UUID [];
BEGIN -- Get segment details
SELECT * INTO v_segment
FROM segments
WHERE id = p_segment_id
  AND type = 'dynamic';
IF v_segment IS NULL THEN RAISE EXCEPTION 'Segment not found or not dynamic: %',
p_segment_id;
END IF;
-- Build dynamic SQL based on filter criteria
-- This is a simplified example - you'd extend this based on your filtering needs
v_sql := 'SELECT ARRAY_AGG(id) FROM contacts WHERE status = ''active''';
-- Add filters based on segment criteria (extend as needed)
IF v_segment.filter_criteria ? 'metadata_filter' THEN v_sql := v_sql || ' AND metadata @> ''' || (v_segment.filter_criteria->>'metadata_filter') || '''::jsonb';
END IF;
IF v_segment.filter_criteria ? 'created_after' THEN v_sql := v_sql || ' AND created_at >= ''' || (v_segment.filter_criteria->>'created_after') || '''::timestamp';
END IF;
-- Execute the dynamic query
EXECUTE v_sql INTO v_contact_ids;
-- Clear existing segment memberships
DELETE FROM contact_segments
WHERE segment_id = p_segment_id;
-- Add new memberships
IF v_contact_ids IS NOT NULL THEN
INSERT INTO contact_segments (contact_id, segment_id, calculated_at)
SELECT unnest(v_contact_ids),
  p_segment_id,
  NOW();
v_contact_count := array_length(v_contact_ids, 1);
END IF;
-- Update segment counts
PERFORM refresh_segment_counts(p_segment_id);
RETURN v_contact_count;
END;
$$ LANGUAGE plpgsql;
-- =============================================
-- TRIGGERS FOR AUTOMATIC COUNT UPDATES
-- =============================================
-- Trigger to update list counts when memberships change
CREATE OR REPLACE FUNCTION trigger_refresh_list_counts() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT' THEN PERFORM refresh_contact_list_counts(NEW.list_id);
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN PERFORM refresh_contact_list_counts(OLD.list_id);
RETURN OLD;
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contact_list_membership_changes
AFTER
INSERT
  OR DELETE ON contact_list_memberships FOR EACH ROW EXECUTE FUNCTION trigger_refresh_list_counts();
-- Trigger to update segment counts when memberships change
CREATE OR REPLACE FUNCTION trigger_refresh_segment_counts() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT' THEN PERFORM refresh_segment_counts(NEW.segment_id);
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN PERFORM refresh_segment_counts(OLD.segment_id);
RETURN OLD;
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_contact_segment_changes
AFTER
INSERT
  OR DELETE ON contact_segments FOR EACH ROW EXECUTE FUNCTION trigger_refresh_segment_counts();
-- =============================================
-- ENABLE REALTIME FOR NEW TABLES
-- =============================================
ALTER PUBLICATION supabase_realtime
ADD TABLE contact_lists;
ALTER PUBLICATION supabase_realtime
ADD TABLE contact_list_memberships;
ALTER PUBLICATION supabase_realtime
ADD TABLE segments;
ALTER PUBLICATION supabase_realtime
ADD TABLE contact_segments;
