-- ===========================================================
-- 018_MARKETING.SQL
-- Campaigns, Sources, Landing Pages, A/B Tests, Referrals
-- Depends on: 000_common.sql, 001_leads_table.sql, 005_tenants_users.sql
-- ===========================================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'scheduled',
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE campaign_type AS ENUM (
  'email',
  'sms',
  'social',
  'ppc',
  'display',
  'direct_mail',
  'referral',
  'event',
  'content',
  'retargeting',
  'multi_channel'
);

CREATE TYPE ad_platform AS ENUM (
  'google_ads',
  'meta_ads',
  'tiktok_ads',
  'linkedin_ads',
  'bing_ads',
  'nextdoor',
  'yelp',
  'other'
);

CREATE TYPE conversion_type AS ENUM (
  'page_view',
  'form_submit',
  'phone_call',
  'chat_start',
  'quote_request',
  'appointment_scheduled',
  'quote_sent',
  'quote_accepted',
  'job_completed',
  'payment_received',
  'referral_sent',
  'custom'
);

CREATE TYPE ab_test_status AS ENUM (
  'draft',
  'running',
  'paused',
  'completed',
  'winner_selected'
);

CREATE TYPE referral_status AS ENUM (
  'pending',
  'contacted',
  'qualified',
  'converted',
  'rewarded',
  'expired',
  'invalid'
);

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Campaign identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Type and status
  campaign_type campaign_type NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  
  -- Targeting
  target_audience JSONB DEFAULT '{}' CHECK (jsonb_typeof(target_audience) = 'object'),
  -- { demographics, locations, interests, custom_audiences }
  
  -- Schedule
  start_date DATE,
  end_date DATE,
  
  -- Budget
  budget_total NUMERIC(12, 2),
  budget_daily NUMERIC(12, 2),
  budget_spent NUMERIC(12, 2) DEFAULT 0,
  
  -- Goals
  goal_type TEXT, -- 'leads', 'quotes', 'revenue', 'awareness'
  goal_value NUMERIC(12, 2),
  goal_achieved NUMERIC(12, 2) DEFAULT 0,
  
  -- External tracking
  external_id TEXT, -- ID in external platform
  external_platform ad_platform,
  tracking_url TEXT,
  
  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- Stats
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  leads_generated INT DEFAULT 0,
  quotes_generated INT DEFAULT 0,
  revenue_generated NUMERIC(12, 2) DEFAULT 0,
  
  -- Calculated metrics
  ctr NUMERIC(8, 4), -- Click-through rate
  cpl NUMERIC(12, 2), -- Cost per lead
  cpa NUMERIC(12, 2), -- Cost per acquisition
  roas NUMERIC(8, 2), -- Return on ad spend
  
  -- Audit
  audit_log JSONB DEFAULT '[]' CHECK (jsonb_typeof(audit_log) = 'array'),
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- CAMPAIGN_SOURCES TABLE
-- ============================================

CREATE TABLE campaign_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source identity
  name TEXT NOT NULL,
  code TEXT NOT NULL, -- Short code for tracking
  description TEXT,
  
  -- Category
  category TEXT, -- 'organic', 'paid', 'referral', 'direct', 'social'
  
  -- Campaign link
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Tracking
  tracking_url TEXT,
  phone_number TEXT, -- Tracking phone number
  
  -- UTM defaults
  default_utm_source TEXT,
  default_utm_medium TEXT,
  
  -- Cost
  cost_per_lead NUMERIC(12, 2),
  monthly_cost NUMERIC(12, 2),
  
  -- Stats
  total_leads INT DEFAULT 0,
  total_quotes INT DEFAULT 0,
  total_revenue NUMERIC(12, 2) DEFAULT 0,
  conversion_rate NUMERIC(8, 4),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, code)
) WITH (fillfactor = 90);

-- ============================================
-- LANDING_PAGES TABLE
-- ============================================

CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Page identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Campaign link
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Content
  title TEXT,
  headline TEXT,
  subheadline TEXT,
  body_html TEXT,
  
  -- Form configuration
  form_fields JSONB DEFAULT '[]' CHECK (jsonb_typeof(form_fields) = 'array'),
  -- Array of { name, type, label, required, options }
  
  -- Design
  template TEXT DEFAULT 'default',
  custom_css TEXT,
  custom_js TEXT,
  
  -- Images
  hero_image_url TEXT,
  og_image_url TEXT,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Tracking
  tracking_scripts JSONB DEFAULT '[]' CHECK (jsonb_typeof(tracking_scripts) = 'array'),
  
  -- A/B testing
  ab_test_id UUID,
  variant_name TEXT,
  
  -- Stats
  views INT DEFAULT 0,
  unique_views INT DEFAULT 0,
  form_submissions INT DEFAULT 0,
  conversion_rate NUMERIC(8, 4),
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID,
  
  UNIQUE(tenant_id, slug)
) WITH (fillfactor = 90);

-- ============================================
-- AB_TESTS TABLE
-- ============================================

CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Test identity
  name TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT,
  
  -- What we're testing
  test_type TEXT NOT NULL, -- 'landing_page', 'email', 'form', 'cta'
  
  -- Status
  status ab_test_status NOT NULL DEFAULT 'draft',
  
  -- Variants
  variants JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(variants) = 'array'),
  -- Array of { id, name, weight, is_control }
  
  -- Traffic allocation
  traffic_percentage INT DEFAULT 100 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
  
  -- Goals
  primary_metric TEXT NOT NULL, -- 'conversion_rate', 'click_rate', 'revenue'
  secondary_metrics TEXT[],
  
  -- Statistical settings
  confidence_level NUMERIC(5, 2) DEFAULT 95.00,
  minimum_sample_size INT DEFAULT 100,
  
  -- Schedule
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Results
  results JSONB DEFAULT '{}' CHECK (jsonb_typeof(results) = 'object'),
  -- { variant_id: { visitors, conversions, rate, confidence } }
  
  winner_variant_id TEXT,
  winner_selected_at TIMESTAMPTZ,
  winner_selected_by UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- AD_CREATIVES TABLE
-- ============================================

CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creative_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Campaign link
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Creative identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Platform
  platform ad_platform NOT NULL,
  ad_format TEXT, -- 'image', 'video', 'carousel', 'text'
  
  -- Content
  headline TEXT,
  primary_text TEXT,
  description_text TEXT,
  call_to_action TEXT,
  
  -- Media
  image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  
  -- Dimensions
  width INT,
  height INT,
  
  -- Destination
  destination_url TEXT,
  
  -- External tracking
  external_id TEXT,
  
  -- Stats
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  spend NUMERIC(12, 2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- CONVERSION_EVENTS TABLE
-- ============================================

CREATE TABLE conversion_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event type
  conversion_type conversion_type NOT NULL,
  
  -- Attribution
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  source_id UUID REFERENCES campaign_sources(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  ab_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ab_variant_id TEXT,
  
  -- Related entities
  lead_id UUID,
  quote_id UUID,
  job_id UUID,
  homeowner_id UUID,
  
  -- Session info
  session_id TEXT,
  visitor_id TEXT,
  
  -- UTM tracking
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- Referrer
  referrer_url TEXT,
  landing_url TEXT,
  
  -- Value
  conversion_value NUMERIC(12, 2),
  
  -- Device info
  device_type TEXT,
  browser TEXT,
  os TEXT,
  
  -- Location
  ip_address INET,
  city TEXT,
  state TEXT,
  country TEXT,
  
  -- Timing
  time_to_convert_seconds INT,
  
  -- Event data
  event_data JSONB DEFAULT '{}' CHECK (jsonb_typeof(event_data) = 'object'),
  
  -- Timestamps
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- REFERRAL_PROGRAMS TABLE
-- ============================================

CREATE TABLE referral_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Program identity
  name TEXT NOT NULL,
  description TEXT,
  
  -- Rewards
  referrer_reward_type TEXT NOT NULL, -- 'cash', 'credit', 'discount', 'gift_card'
  referrer_reward_amount NUMERIC(12, 2) NOT NULL,
  referee_reward_type TEXT,
  referee_reward_amount NUMERIC(12, 2),
  
  -- Conditions
  minimum_job_value NUMERIC(12, 2),
  reward_trigger TEXT DEFAULT 'job_completed', -- 'quote_sent', 'job_scheduled', 'job_completed', 'payment_received'
  
  -- Limits
  max_referrals_per_person INT,
  max_total_referrals INT,
  budget_total NUMERIC(12, 2),
  budget_used NUMERIC(12, 2) DEFAULT 0,
  
  -- Validity
  start_date DATE,
  end_date DATE,
  referral_valid_days INT DEFAULT 90,
  
  -- Terms
  terms_and_conditions TEXT,
  
  -- Stats
  total_referrals INT DEFAULT 0,
  successful_referrals INT DEFAULT 0,
  total_rewards_paid NUMERIC(12, 2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  created_by UUID,
  updated_by UUID
) WITH (fillfactor = 90);

-- ============================================
-- REFERRAL_REWARDS TABLE
-- ============================================

CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_number TEXT UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Program reference
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  
  -- Referrer (who made the referral)
  referrer_homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  referrer_name TEXT NOT NULL,
  referrer_email TEXT,
  referrer_phone TEXT,
  
  -- Referee (who was referred)
  referee_name TEXT NOT NULL,
  referee_email TEXT,
  referee_phone TEXT,
  referee_lead_id UUID,
  referee_homeowner_id UUID REFERENCES homeowners(id) ON DELETE SET NULL,
  
  -- Referral tracking
  referral_code TEXT UNIQUE,
  referral_url TEXT,
  
  -- Status
  status referral_status NOT NULL DEFAULT 'pending',
  
  -- Related entities
  quote_id UUID,
  job_id UUID,
  
  -- Reward details
  reward_type TEXT,
  reward_amount NUMERIC(12, 2),
  reward_description TEXT,
  
  -- Payment
  reward_paid BOOLEAN DEFAULT false,
  reward_paid_at TIMESTAMPTZ,
  reward_paid_method TEXT,
  reward_paid_reference TEXT,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  
  -- Timestamps
  referred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) WITH (fillfactor = 90);

-- ============================================
-- INDEXES
-- ============================================

-- campaigns
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_type ON campaigns(tenant_id, campaign_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_dates ON campaigns(tenant_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_created ON campaigns(tenant_id, created_at DESC);

-- campaign_sources
CREATE INDEX idx_campaign_sources_tenant ON campaign_sources(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaign_sources_code ON campaign_sources(tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaign_sources_campaign ON campaign_sources(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_campaign_sources_active ON campaign_sources(tenant_id, is_active) WHERE deleted_at IS NULL AND is_active = true;

-- landing_pages
CREATE INDEX idx_landing_pages_tenant ON landing_pages(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_landing_pages_slug ON landing_pages(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_landing_pages_campaign ON landing_pages(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_landing_pages_published ON landing_pages(tenant_id, is_published) WHERE deleted_at IS NULL AND is_published = true;

-- ab_tests
CREATE INDEX idx_ab_tests_tenant ON ab_tests(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ab_tests_status ON ab_tests(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ab_tests_running ON ab_tests(status, start_date, end_date) WHERE status = 'running';

-- ad_creatives
CREATE INDEX idx_ad_creatives_tenant ON ad_creatives(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ad_creatives_campaign ON ad_creatives(campaign_id);
CREATE INDEX idx_ad_creatives_platform ON ad_creatives(tenant_id, platform) WHERE deleted_at IS NULL;

-- conversion_events
CREATE INDEX idx_conversion_events_tenant ON conversion_events(tenant_id);
CREATE INDEX idx_conversion_events_type ON conversion_events(tenant_id, conversion_type);
CREATE INDEX idx_conversion_events_campaign ON conversion_events(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_conversion_events_source ON conversion_events(source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_conversion_events_lead ON conversion_events(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_conversion_events_date ON conversion_events(tenant_id, converted_at DESC);
CREATE INDEX idx_conversion_events_utm ON conversion_events(utm_source, utm_medium, utm_campaign);

-- referral_programs
CREATE INDEX idx_referral_programs_tenant ON referral_programs(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_referral_programs_active ON referral_programs(tenant_id, is_active) WHERE deleted_at IS NULL AND is_active = true;

-- referral_rewards
CREATE INDEX idx_referral_rewards_tenant ON referral_rewards(tenant_id);
CREATE INDEX idx_referral_rewards_program ON referral_rewards(program_id);
CREATE INDEX idx_referral_rewards_referrer ON referral_rewards(referrer_homeowner_id) WHERE referrer_homeowner_id IS NOT NULL;
CREATE INDEX idx_referral_rewards_status ON referral_rewards(tenant_id, status);
CREATE INDEX idx_referral_rewards_code ON referral_rewards(referral_code) WHERE referral_code IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaign_sources_updated_at BEFORE UPDATE ON campaign_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER landing_pages_updated_at BEFORE UPDATE ON landing_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ab_tests_updated_at BEFORE UPDATE ON ab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ad_creatives_updated_at BEFORE UPDATE ON ad_creatives FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER referral_programs_updated_at BEFORE UPDATE ON referral_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER referral_rewards_updated_at BEFORE UPDATE ON referral_rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate campaign number
CREATE OR REPLACE FUNCTION generate_campaign_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.campaign_number := 'CMP-' || next_tenant_sequence(NEW.tenant_id, 'campaign');
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_number BEFORE INSERT ON campaigns FOR EACH ROW EXECUTE FUNCTION generate_campaign_number();

-- Generate landing page number
CREATE OR REPLACE FUNCTION generate_landing_page_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.page_number := 'LP-' || next_tenant_sequence(NEW.tenant_id, 'landing_page');
  RETURN NEW;
END;
$$;

CREATE TRIGGER landing_pages_number BEFORE INSERT ON landing_pages FOR EACH ROW EXECUTE FUNCTION generate_landing_page_number();

-- Generate AB test number
CREATE OR REPLACE FUNCTION generate_ab_test_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.test_number := 'AB-' || next_tenant_sequence(NEW.tenant_id, 'ab_test');
  RETURN NEW;
END;
$$;

CREATE TRIGGER ab_tests_number BEFORE INSERT ON ab_tests FOR EACH ROW EXECUTE FUNCTION generate_ab_test_number();

-- Generate creative number
CREATE OR REPLACE FUNCTION generate_creative_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.creative_number := 'AD-' || next_tenant_sequence(NEW.tenant_id, 'ad_creative');
  RETURN NEW;
END;
$$;

CREATE TRIGGER ad_creatives_number BEFORE INSERT ON ad_creatives FOR EACH ROW EXECUTE FUNCTION generate_creative_number();

-- Generate referral program number
CREATE OR REPLACE FUNCTION generate_referral_program_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.program_number := 'REF-' || next_tenant_sequence(NEW.tenant_id, 'referral_program');
  RETURN NEW;
END;
$$;

CREATE TRIGGER referral_programs_number BEFORE INSERT ON referral_programs FOR EACH ROW EXECUTE FUNCTION generate_referral_program_number();

-- Generate referral reward number and code
CREATE OR REPLACE FUNCTION generate_referral_reward_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reward_number := 'RWD-' || next_tenant_sequence(NEW.tenant_id, 'referral_reward');
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER referral_rewards_number BEFORE INSERT ON referral_rewards FOR EACH ROW EXECUTE FUNCTION generate_referral_reward_number();

-- Update campaign stats on conversion
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE campaigns
    SET 
      leads_generated = leads_generated + CASE WHEN NEW.conversion_type = 'form_submit' THEN 1 ELSE 0 END,
      quotes_generated = quotes_generated + CASE WHEN NEW.conversion_type = 'quote_sent' THEN 1 ELSE 0 END,
      revenue_generated = revenue_generated + COALESCE(NEW.conversion_value, 0)
    WHERE id = NEW.campaign_id;
  END IF;
  
  IF NEW.source_id IS NOT NULL THEN
    UPDATE campaign_sources
    SET 
      total_leads = total_leads + CASE WHEN NEW.conversion_type = 'form_submit' THEN 1 ELSE 0 END,
      total_quotes = total_quotes + CASE WHEN NEW.conversion_type = 'quote_sent' THEN 1 ELSE 0 END,
      total_revenue = total_revenue + COALESCE(NEW.conversion_value, 0)
    WHERE id = NEW.source_id;
  END IF;
  
  IF NEW.landing_page_id IS NOT NULL AND NEW.conversion_type = 'form_submit' THEN
    UPDATE landing_pages
    SET form_submissions = form_submissions + 1
    WHERE id = NEW.landing_page_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversion_events_stats AFTER INSERT ON conversion_events FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;

CREATE POLICY campaigns_select ON campaigns FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY campaigns_insert ON campaigns FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin', 'manager') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY campaigns_update ON campaigns FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY campaigns_delete ON campaigns FOR DELETE USING (false);

-- campaign_sources
ALTER TABLE campaign_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sources FORCE ROW LEVEL SECURITY;

CREATE POLICY campaign_sources_select ON campaign_sources FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY campaign_sources_insert ON campaign_sources FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY campaign_sources_update ON campaign_sources FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY campaign_sources_delete ON campaign_sources FOR DELETE USING (false);

-- landing_pages
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages FORCE ROW LEVEL SECURITY;

CREATE POLICY landing_pages_select ON landing_pages FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY landing_pages_insert ON landing_pages FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY landing_pages_update ON landing_pages FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY landing_pages_delete ON landing_pages FOR DELETE USING (false);

-- ab_tests
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests FORCE ROW LEVEL SECURITY;

CREATE POLICY ab_tests_select ON ab_tests FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ab_tests_insert ON ab_tests FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ab_tests_update ON ab_tests FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ab_tests_delete ON ab_tests FOR DELETE USING (false);

-- ad_creatives
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives FORCE ROW LEVEL SECURITY;

CREATE POLICY ad_creatives_select ON ad_creatives FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ad_creatives_insert ON ad_creatives FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY ad_creatives_update ON ad_creatives FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY ad_creatives_delete ON ad_creatives FOR DELETE USING (false);

-- conversion_events
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events FORCE ROW LEVEL SECURITY;

CREATE POLICY conversion_events_select ON conversion_events FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY conversion_events_insert ON conversion_events FOR INSERT
  WITH CHECK (tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY conversion_events_update ON conversion_events FOR UPDATE USING (false);
CREATE POLICY conversion_events_delete ON conversion_events FOR DELETE USING (false);

-- referral_programs
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_programs FORCE ROW LEVEL SECURITY;

CREATE POLICY referral_programs_select ON referral_programs FOR SELECT
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY referral_programs_insert ON referral_programs FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') IN ('superadmin', 'owner', 'admin') AND tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY referral_programs_update ON referral_programs FOR UPDATE
  USING (deleted_at IS NULL AND ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)));

CREATE POLICY referral_programs_delete ON referral_programs FOR DELETE USING (false);

-- referral_rewards
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards FORCE ROW LEVEL SECURITY;

CREATE POLICY referral_rewards_select ON referral_rewards FOR SELECT
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY referral_rewards_insert ON referral_rewards FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    AND EXISTS (SELECT 1 FROM referral_programs WHERE id = program_id AND tenant_id = referral_rewards.tenant_id AND deleted_at IS NULL)
  );

CREATE POLICY referral_rewards_update ON referral_rewards FOR UPDATE
  USING ((auth.jwt() ->> 'role') = 'superadmin' OR tenant_id = COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID));

CREATE POLICY referral_rewards_delete ON referral_rewards FOR DELETE USING (false);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Track conversion
CREATE OR REPLACE FUNCTION track_conversion(
  p_conversion_type conversion_type,
  p_campaign_id UUID DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_conversion_value NUMERIC DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_event_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  INSERT INTO conversion_events (
    tenant_id, conversion_type, campaign_id, source_id, lead_id,
    conversion_value, utm_source, utm_medium, utm_campaign
  )
  VALUES (
    v_tenant_id, p_conversion_type, p_campaign_id, p_source_id, p_lead_id,
    p_conversion_value, p_utm_source, p_utm_medium, p_utm_campaign
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Create referral
CREATE OR REPLACE FUNCTION create_referral(
  p_program_id UUID,
  p_referrer_homeowner_id UUID,
  p_referee_name TEXT,
  p_referee_phone TEXT,
  p_referee_email TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_program RECORD;
  v_referrer RECORD;
  v_reward_id UUID;
BEGIN
  v_tenant_id := COALESCE((auth.jwt() ->> 'tenant_id')::UUID, NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  
  SELECT * INTO v_program FROM referral_programs WHERE id = p_program_id AND tenant_id = v_tenant_id AND deleted_at IS NULL AND is_active = true;
  IF v_program IS NULL THEN
    RAISE EXCEPTION 'Referral program not found or inactive';
  END IF;
  
  SELECT * INTO v_referrer FROM homeowners WHERE id = p_referrer_homeowner_id AND tenant_id = v_tenant_id AND deleted_at IS NULL;
  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'Referrer not found';
  END IF;
  
  INSERT INTO referral_rewards (
    tenant_id, program_id, referrer_homeowner_id, referrer_name, referrer_email, referrer_phone,
    referee_name, referee_email, referee_phone, reward_type, reward_amount, expires_at
  )
  VALUES (
    v_tenant_id, p_program_id, p_referrer_homeowner_id,
    v_referrer.first_name || ' ' || v_referrer.last_name, v_referrer.email, v_referrer.phone,
    p_referee_name, p_referee_email, p_referee_phone,
    v_program.referrer_reward_type, v_program.referrer_reward_amount,
    NOW() + (v_program.referral_valid_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_reward_id;
  
  UPDATE referral_programs SET total_referrals = total_referrals + 1 WHERE id = p_program_id;
  
  RETURN v_reward_id;
END;
$$;

-- Get campaign ROI
CREATE OR REPLACE FUNCTION get_campaign_roi(p_campaign_id UUID)
RETURNS TABLE (
  total_spend NUMERIC,
  total_revenue NUMERIC,
  roi_percentage NUMERIC,
  leads INT,
  quotes INT,
  cost_per_lead NUMERIC,
  cost_per_quote NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    c.budget_spent,
    c.revenue_generated,
    CASE WHEN c.budget_spent > 0 THEN ((c.revenue_generated - c.budget_spent) / c.budget_spent * 100) ELSE 0 END,
    c.leads_generated,
    c.quotes_generated,
    CASE WHEN c.leads_generated > 0 THEN (c.budget_spent / c.leads_generated) ELSE 0 END,
    CASE WHEN c.quotes_generated > 0 THEN (c.budget_spent / c.quotes_generated) ELSE 0 END
  FROM campaigns c
  WHERE c.id = p_campaign_id;
$$;
