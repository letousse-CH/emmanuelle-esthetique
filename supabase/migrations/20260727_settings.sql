-- ─────────────────────────────────────────────────────────────────────────────
-- Table `settings` — configuration clé/valeur générique du site (branding,
-- coordonnées d'entreprise, modules activés/désactivés, copie des pages).
-- Consolidé depuis settings.sql + fix-settings-rls.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON settings;
DROP POLICY IF EXISTS "admin_update" ON settings;
DROP POLICY IF EXISTS "admin_all" ON settings;

-- Lecture publique (nécessaire pour le rendu SSR/CSR des pages publiques)
CREATE POLICY "public_read" ON settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture et gestion réservées à l'admin authentifié
CREATE POLICY "admin_all" ON settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO authenticated;

-- Valeurs par défaut minimales (le reste est fourni par SETTINGS_DEFAULTS
-- côté app — src/constants/settings.ts — tant que la ligne n'existe pas en base).
INSERT INTO settings (key, value) VALUES
  ('module_blog_enabled',          'true'),
  ('module_ai_generation_enabled', 'true'),
  ('module_events_enabled',        'true')
ON CONFLICT (key) DO NOTHING;
