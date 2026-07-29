CREATE TABLE IF NOT EXISTS dynamic_pages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sections   JSONB NOT NULL DEFAULT '[]',
  published  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dynamic_pages ENABLE ROW LEVEL SECURITY;

-- Lecture publique des pages publiées
CREATE POLICY "public_read_published" ON dynamic_pages
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Admin : lecture complète + écriture
CREATE POLICY "admin_all" ON dynamic_pages
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dynamic_pages_updated_at
  BEFORE UPDATE ON dynamic_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
