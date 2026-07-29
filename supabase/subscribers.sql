-- Table des abonnés newsletter
CREATE TABLE IF NOT EXISTS subscribers (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active     BOOLEAN     DEFAULT TRUE
);

-- Tout le monde peut s'abonner (INSERT public)
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert" ON subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Désinscription publique : n'importe qui peut passer active=false (jamais true)
CREATE POLICY "public_unsubscribe" ON subscribers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (active = false);

-- Seul l'admin authentifié peut lire, supprimer et modifier
CREATE POLICY "admin_select" ON subscribers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_delete" ON subscribers
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "admin_update" ON subscribers
  FOR UPDATE TO authenticated
  USING (true);
