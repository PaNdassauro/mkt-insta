-- 024: Add content category to posts and reels
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE instagram_reels ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_category ON instagram_posts(category);
CREATE INDEX IF NOT EXISTS idx_reels_category ON instagram_reels(category);
