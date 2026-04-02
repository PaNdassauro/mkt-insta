-- 023: Campaign Templates + Recurring Calendar Entries

CREATE TABLE IF NOT EXISTS campaign_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source_campaign_id UUID REFERENCES instagram_campaigns(id) ON DELETE SET NULL,
  briefing JSONB NOT NULL, -- { objective, theme, audience, duration_days, formats, tone }
  account_id UUID REFERENCES instagram_accounts(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON campaign_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON campaign_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recurring calendar entries
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS recurrence TEXT; -- 'weekly', 'biweekly', 'monthly', null
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS recurrence_end DATE;
