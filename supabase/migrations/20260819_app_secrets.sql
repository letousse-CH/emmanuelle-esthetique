-- ─────────────────────────────────────────────────────────────────────────────
-- Table `app_secrets` — clés d'API et jetons saisis depuis l'admin.
--
-- Pourquoi une table à part plutôt que `settings` : `settings` est lisible
-- publiquement (`GRANT SELECT ... TO anon`), ce qui est nécessaire au rendu des
-- pages publiques. Y déposer une clé d'API reviendrait à la publier — la clé
-- anonyme Supabase est embarquée dans le bundle navigateur, donc n'importe qui
-- pourrait interroger la table.
--
-- Ici : aucun droit pour `anon`, aucune politique de lecture publique. Les
-- valeurs ne sortent jamais vers le navigateur ; les routes serveur y accèdent
-- avec la clé de service, et l'interface n'affiche qu'un état « définie ou non ».
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_secrets (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'app_secrets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app_secrets', pol.policyname);
  END LOOP;
END $$;

-- Écriture réservée à l'admin connecté. Pas de politique de lecture : même un
-- compte authentifié ne récupère pas la valeur depuis le navigateur, elle n'a
-- aucune raison d'y transiter.
CREATE POLICY "admin_write" ON app_secrets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update" ON app_secrets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete" ON app_secrets
  FOR DELETE TO authenticated USING (true);

REVOKE ALL ON app_secrets FROM anon;
GRANT INSERT, UPDATE, DELETE ON app_secrets TO authenticated;
