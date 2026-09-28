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
