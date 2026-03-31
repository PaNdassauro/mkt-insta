-- Table for user roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON user_roles FOR SELECT TO authenticated USING (true);
-- Only admins can modify roles (enforced at API level since we can't reference user_roles in its own policy easily)

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = uid),
    'viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER;
