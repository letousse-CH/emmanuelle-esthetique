-- ─────────────────────────────────────────────────────────────────────────────
-- Module Réseaux Sociaux — tables `social_posts` + `rss_feeds`.
-- Contenu Instagram/LinkedIn/Facebook généré (manuellement ou par l'automatisation
-- en tâche de fond) à partir d'articles, de flux RSS ou de suggestions SEO,
-- organisé par date de planification pour le calendrier admin.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_posts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type  text        NOT NULL CHECK (source_type IN ('article', 'rss', 'suggestion', 'manual')),
  -- id d'article, guid/lien d'entrée RSS, id de suggestion sauvegardée, ou clé
  -- libre pour une génération manuelle. Unique avec source_type : sert de clé
  -- de déduplication pour l'automatisation (ne régénère jamais deux fois la
  -- même source).
  source_ref   text        NOT NULL,
  title        text        NOT NULL,
  cover_image  text,
  -- { pillar, instagram: { slides, caption }, linkedin: { hook_variants, post, hashtags }, facebook: { post } }
  content      jsonb       NOT NULL,
  planned_date date        NOT NULL DEFAULT CURRENT_DATE,
  status       text        NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'posted', 'archived')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS social_posts_planned_date_idx ON social_posts (planned_date);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'social_posts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON social_posts', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "admin_all" ON social_posts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Flux RSS configurés par l'admin comme source de contenu (1 à 3 recommandés,
-- pas de limite technique imposée en base).
CREATE TABLE IF NOT EXISTS rss_feeds (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  url        text        NOT NULL UNIQUE,
  label      text,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'rss_feeds'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON rss_feeds', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "admin_all" ON rss_feeds
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
