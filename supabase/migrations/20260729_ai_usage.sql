-- ─────────────────────────────────────────────────────────────────────────────
-- Table `ai_usage` — journal de consommation des appels Claude.
--
-- L'API Anthropic n'expose aucun endpoint de solde ou de crédit : la seule
-- façon d'alerter sur un budget qui s'épuise est de comptabiliser nous-mêmes
-- les tokens facturés à chaque appel. Une ligne = un appel IA.
--
-- Le coût est figé au moment de l'appel (`cost_usd`) : il reste juste même si
-- les tarifs du catalogue changent plus tard.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Identifiant du modèle réellement appelé (ex. 'claude-sonnet-5').
  model                   text        NOT NULL,
  -- Fonctionnalité à l'origine de l'appel : 'article', 'page', 'seo-ideas',
  -- 'keyword-research', 'keyword-scan', 'seo-analyze', 'social', 'plan-editorial',
  -- 'meta', 'status-check'… Sert au détail par usage dans l'admin.
  feature                 text        NOT NULL DEFAULT 'inconnu',
  input_tokens            integer     NOT NULL DEFAULT 0,
  output_tokens           integer     NOT NULL DEFAULT 0,
  cache_read_tokens       integer     NOT NULL DEFAULT 0,
  cache_creation_tokens   integer     NOT NULL DEFAULT 0,
  -- Coût estimé en USD d'après les tarifs publics Anthropic.
  cost_usd                numeric(10, 6) NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Les agrégats de l'admin filtrent toujours sur une période : index sur la date.
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage (created_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_insert" ON ai_usage;
DROP POLICY IF EXISTS "ai_usage_read" ON ai_usage;

-- Les routes serveur écrivent avec la clé service_role quand elle est
-- configurée (RLS contournée) ; cette policy couvre le repli sur la clé anon
-- en développement local.
CREATE POLICY "ai_usage_insert" ON ai_usage
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ai_usage_read" ON ai_usage
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT, INSERT ON ai_usage TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agrégat par modèle et par fonctionnalité depuis une date donnée.
-- Passer par une fonction évite de rapatrier les lignes une à une côté app
-- (PostgREST plafonne les listes à 1000 lignes : un total calculé en JS serait
-- silencieusement faux au-delà).
-- Les colonnes de sortie sont nommées différemment des colonnes de la table
-- pour éviter toute ambiguïté dans le corps de la fonction.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ai_usage_summary(since timestamptz)
RETURNS TABLE (
  model_id   text,
  feature_key text,
  calls      bigint,
  tokens_in  bigint,
  tokens_out bigint,
  cost       numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.model,
    u.feature,
    count(*)::bigint,
    sum(u.input_tokens + u.cache_read_tokens + u.cache_creation_tokens)::bigint,
    sum(u.output_tokens)::bigint,
    sum(u.cost_usd)
  FROM ai_usage u
  WHERE u.created_at >= since
  GROUP BY u.model, u.feature;
$$;

GRANT EXECUTE ON FUNCTION ai_usage_summary(timestamptz) TO anon, authenticated;
