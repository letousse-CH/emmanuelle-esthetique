-- ─────────────────────────────────────────────────────────────────────────────
-- Module Blog/Articles — tables `articles` + `article_seo_scores`.
-- Consolidé depuis les migrations ad-hoc historiques : add-category-to-articles,
-- add-meta-keywords-to-articles, add-scheduled-at-to-articles,
-- fix-articles-rls-final, seo-intelligence-migration (partie article_seo_scores).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS articles (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  content          text        NOT NULL DEFAULT '',
  cover_image      text,
  meta_title       text,
  meta_description text,
  meta_keywords    text,
  category         text,
  published        boolean     NOT NULL DEFAULT false,
  scheduled_at     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_scheduled_idx
  ON articles (scheduled_at)
  WHERE published = false AND scheduled_at IS NOT NULL;

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON articles', pol.policyname);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;

-- Lecture publique : visiteurs anonymes → articles publiés uniquement
CREATE POLICY "articles_select_public"
ON articles FOR SELECT
TO anon
USING (published = true);

-- Lecture admin : utilisateurs connectés → tous les articles (brouillons inclus)
CREATE POLICY "articles_select_admin"
ON articles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "articles_insert_admin"
ON articles FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "articles_update_admin"
ON articles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "articles_delete_admin"
ON articles FOR DELETE
TO authenticated
USING (true);

-- ── article_seo_scores : score d'intégration du cluster sémantique par article ──
CREATE TABLE IF NOT EXISTS article_seo_scores (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     uuid REFERENCES articles(id) ON DELETE CASCADE,
  cluster_id     uuid,
  focus_keyword  text,
  keywords_found text[]  DEFAULT '{}',
  keywords_total integer DEFAULT 0,
  score          integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE article_seo_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "article_seo_scores_admin_all" ON article_seo_scores;
CREATE POLICY "article_seo_scores_admin_all" ON article_seo_scores
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
