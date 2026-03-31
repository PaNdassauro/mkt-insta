CREATE TABLE IF NOT EXISTS instagram_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_user_id TEXT NOT NULL UNIQUE,
  username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  label TEXT NOT NULL,  -- e.g., "Welcome Weddings", "Welcome Trips"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON instagram_accounts FOR SELECT TO authenticated USING (true);

-- Seed with current account from env vars (will be populated manually)
-- INSERT INTO instagram_accounts (ig_user_id, username, access_token, label)
-- VALUES ('17841402369678583', 'welcomeweddings', '<token>', 'Welcome Weddings');
