-- ─────────────────────────────────────────────────────────────────────────────
-- Module SEO Intelligence — Migration complète
-- Tables : seo_keywords, seo_clusters, article_seo_scores
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. seo_keywords ──────────────────────────────────────────────────────────
-- Catalogue des mots-clés recherchés et analysés depuis l'interface admin.

CREATE TABLE IF NOT EXISTS seo_keywords (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword          text NOT NULL,
  volume_label     text CHECK (volume_label    IN ('faible', 'moyen', 'élevé')),
  difficulty_label text CHECK (difficulty_label IN ('faible', 'moyen', 'élevé')),
  intent           text CHECK (intent          IN ('informationnel', 'transactionnel', 'navigationnel')),
  category         text,
  source           text DEFAULT 'keyword_research',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_keywords_admin_all" ON seo_keywords
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 2. seo_clusters ──────────────────────────────────────────────────────────
-- Grappe sémantique complète associée à un mot-clé principal.
-- Contient tout ce qu'il faut pour générer un article optimisé.

CREATE TABLE IF NOT EXISTS seo_clusters (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id         uuid REFERENCES seo_keywords(id) ON DELETE CASCADE,
  focus_keyword      text NOT NULL,
  category           text,
  secondary_keywords text[] NOT NULL DEFAULT '{}',
  related_questions  text[] NOT NULL DEFAULT '{}',
  suggested_title    text,
  suggested_slug     text,
  suggested_intro    text,
  content_tips       text[] NOT NULL DEFAULT '{}',
  cta                text,
  opportunity        text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE seo_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_clusters_admin_all" ON seo_clusters
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seo_clusters_updated_at
  BEFORE UPDATE ON seo_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. article_seo_scores ────────────────────────────────────────────────────
-- Score sémantique d'un article : suivi de l'inclusion du cluster dans le texte.
-- Alimenté par l'analyseur temps-réel de BlogEdit (Phase 2).

CREATE TABLE IF NOT EXISTS article_seo_scores (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     uuid REFERENCES articles(id) ON DELETE CASCADE,
  cluster_id     uuid REFERENCES seo_clusters(id) ON DELETE SET NULL,
  focus_keyword  text,
  keywords_found text[]  DEFAULT '{}',
  keywords_total integer DEFAULT 0,
  score          integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE article_seo_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_seo_scores_admin_all" ON article_seo_scores
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER article_seo_scores_updated_at
  BEFORE UPDATE ON article_seo_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
