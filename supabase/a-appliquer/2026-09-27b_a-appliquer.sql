-- À coller dans Supabase > SQL Editor (projet agbbvwnhcadxpvgqkiyc). Rejouable sans risque.

-- ═══ 20260927_secrets_hors_settings.sql ═══
-- ─────────────────────────────────────────────────────────────────────────────
-- Clés Resend et Cloudflare R2 : de `settings` (lisible par tout visiteur)
-- vers `app_secrets` (aucune lecture possible depuis le navigateur).
--
-- 1. Copie les valeurs non vides. Une clé déjà présente dans app_secrets
--    (saisie depuis la nouvelle interface) n'est pas écrasée.
-- 2. Supprime ces lignes de `settings`.
--
-- Rejouable : la seconde exécution ne trouve plus rien à copier ni à effacer.
-- Les clés ayant été publiques, elles doivent être régénérées chez Cloudflare
-- et chez Resend, puis saisies à nouveau dans Admin > Paramètres > Clés API.
--
-- L'adresse publique des images (r2_public_url), l'adresse d'expédition
-- (resend_from_email) et la clé IndexNow ne sont pas des secrets : elles
-- restent dans `settings`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_secrets (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_secrets FROM anon;

INSERT INTO app_secrets (key, value, updated_at)
SELECT key, btrim(value), now()
FROM settings
WHERE key IN ('resend_api_key', 'r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name')
  AND value IS NOT NULL
  AND btrim(value) <> ''
ON CONFLICT (key) DO NOTHING;

DELETE FROM settings
WHERE key IN ('resend_api_key', 'r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name');

-- ═══ 20260927_ai_usage_duration.sql ═══
-- ─────────────────────────────────────────────────────────────────────────────
-- Durée de chaque appel IA, en millisecondes.
--
-- Sert à repérer les générations qui frôlent la limite de 60 s des fonctions
-- Netlify synchrones (voir src/utils/ai.ts, modes « quick » et « long »).
-- Le code fonctionne sans cette colonne : il cesse alors simplement de
-- l'écrire.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS duration_ms integer;

-- ═══ 20260927_ai_jobs.sql ═══
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
