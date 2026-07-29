-- Tracking des visites de pages (sans données personnelles, sans cookie)
CREATE TABLE IF NOT EXISTS page_views (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  page       TEXT        NOT NULL,
  referrer   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- N'importe qui peut enregistrer une visite (INSERT)
CREATE POLICY "public_insert" ON page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Seul l'admin authentifié peut lire
CREATE POLICY "admin_select" ON page_views
  FOR SELECT TO authenticated
  USING (true);
