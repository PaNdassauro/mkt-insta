CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,        -- e.g., 'campaign.created', 'campaign.approved', 'post.scheduled', 'settings.updated', 'user.login'
  entity_type TEXT,            -- e.g., 'campaign', 'post', 'calendar', 'settings'
  entity_id TEXT,              -- ID of the affected entity
  details JSONB,               -- Additional context
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by date and entity
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON activity_log FOR SELECT TO authenticated USING (true);
