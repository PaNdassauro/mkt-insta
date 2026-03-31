-- 018: Audit Trail — add created_by / updated_by to campaigns, campaign_posts, editorial calendar

-- Add audit columns to campaigns
ALTER TABLE instagram_campaigns ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE instagram_campaigns ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add audit columns to campaign_posts
ALTER TABLE campaign_posts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE campaign_posts ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add audit columns to editorial calendar
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
