-- ─────────────────────────────────────────────────────────────────────────────
-- Tâches IA longues (rédaction d'article, génération de page, synthèse…).
--
-- Une fonction Netlify synchrone est coupée à 60 s. Les générations longues
-- sont donc enregistrées ici, exécutées par la fonction de fond
-- netlify/functions/ai-job-background.mts (jusqu'à 15 min), et l'admin
-- interroge la ligne toutes les deux secondes jusqu'au résultat.
--
-- Le serveur lit et écrit avec la clé service_role. La lecture/écriture est
-- aussi ouverte aux comptes connectés ; aucun accès pour les visiteurs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'running', 'done', 'error')),
  input       jsonb NOT NULL DEFAULT '{}'::jsonb,
  result      jsonb,
  error       text,
  attempts    integer NOT NULL DEFAULT 0,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_jobs_created_at_idx ON ai_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_status_idx ON ai_jobs (status);

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_jobs_authenticated_all" ON ai_jobs;
CREATE POLICY "ai_jobs_authenticated_all" ON ai_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON ai_jobs FROM anon;
