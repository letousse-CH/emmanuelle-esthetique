-- Historique des newsletters envoyées
CREATE TABLE IF NOT EXISTS newsletters (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  subject      TEXT        NOT NULL,
  html         TEXT        NOT NULL,
  sent_count   INTEGER     DEFAULT 0,
  failed_count INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON newsletters
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
