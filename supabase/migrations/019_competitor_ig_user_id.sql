-- Add ig_user_id to instagram_competitors for Meta Graph API lookups
ALTER TABLE instagram_competitors ADD COLUMN IF NOT EXISTS ig_user_id TEXT;

-- Also add media_count to snapshots (fetched from API)
ALTER TABLE instagram_competitor_snapshots ADD COLUMN IF NOT EXISTS media_count INTEGER;
