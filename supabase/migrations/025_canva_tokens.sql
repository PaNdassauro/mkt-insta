CREATE TABLE IF NOT EXISTS canva_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES instagram_accounts(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  canva_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE canva_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON canva_tokens FOR SELECT TO authenticated USING (true);
