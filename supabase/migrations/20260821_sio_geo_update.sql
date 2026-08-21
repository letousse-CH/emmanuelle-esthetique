-- ─────────────────────────────────────────────────────────────────────────────
-- Migration Idempotente : Mise à jour SIO & GEO (Mots-Clés, Prompts IA & Réseaux)
-- Permet de mettre à jour la base de n'importe quel site existant sans perte de données.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Mise à jour de la table seo_clusters ──────────────────────────────────
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS funnel_level text DEFAULT 'découverte';
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS ai_prompts text[] DEFAULT '{}';
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS community_questions text[] DEFAULT '{}';
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS geo_citation_tips text[] DEFAULT '{}';
ALTER TABLE seo_clusters ADD COLUMN IF NOT EXISTS rel_bridge text DEFAULT '';

-- ── 2. Mise à jour de la table social_posts ──────────────────────────────────
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS ai_prompts text[] DEFAULT '{}';
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS rel_bridge text DEFAULT '';

-- ── 3. Mise à jour de la table saved_ideas ──────────────────────────────────
ALTER TABLE saved_ideas ADD COLUMN IF NOT EXISTS funnel_level text DEFAULT 'découverte';

-- Index pour accélérer les requêtes filtrées par niveau d'entonnoir
CREATE INDEX IF NOT EXISTS idx_seo_clusters_funnel ON seo_clusters(funnel_level);
