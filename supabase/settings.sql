-- Table de configuration générale du site
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Valeurs par défaut
INSERT INTO settings (key, value) VALUES
  ('promo_code',   'BIENVENUE'),
  ('promo_amount', '20 CHF')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Lecture publique (nécessaire pour la Netlify Function qui utilise anon ou service role)
CREATE POLICY "public_read" ON settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture et gestion réservées à l'admin authentifié
CREATE POLICY "admin_all" ON settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

