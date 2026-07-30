-- ─────────────────────────────────────────────────────────────────────────────
-- Tables utilisées par le code mais absentes des migrations versionnées :
-- une installation neuve suivant `supabase/migrations/*.sql` échouait avec
-- « relation does not exist » sur la bibliothèque médias, le tableau de bord,
-- la newsletter et le hub SEO.
--
-- Consolidé depuis les scripts ad-hoc historiques : page_views.sql,
-- add-page-views-indexes.sql, subscribers.sql, newsletters.sql,
-- seo-intelligence-migration.sql (parties seo_keywords / seo_clusters).
-- `media_assets` et `saved_ideas` n'avaient jamais été écrits nulle part :
-- leur schéma est déduit du code qui les consomme.
--
-- Idempotent : réexécutable sans effet de bord.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── media_assets : bibliothèque médias de l'admin ────────────────────────────
-- Alimentée par /admin/medias (upload R2 ou ajout par URL) et lue par le
-- sélecteur d'images du page builder.
CREATE TABLE IF NOT EXISTS media_assets (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name  text        NOT NULL,
  url        text        NOT NULL,
  alt_text   text        DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Les URL des médias apparaissent dans les pages publiques : lecture ouverte,
-- écriture réservée à l'admin authentifié.
DROP POLICY IF EXISTS "media_assets_public_select" ON media_assets;
CREATE POLICY "media_assets_public_select" ON media_assets
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "media_assets_admin_write" ON media_assets;
CREATE POLICY "media_assets_admin_write" ON media_assets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── page_views : statistiques de fréquentation ───────────────────────────────
-- Sans cookie ni donnée personnelle. Écrit par components/PageViewTracker.tsx,
-- agrégé par /api/admin-stats.
CREATE TABLE IF NOT EXISTS page_views (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  page       text        NOT NULL,
  referrer   text,
  created_at timestamptz DEFAULT now()
);

-- Sans ces index, les agrégations du tableau de bord font un full scan
-- au-delà de ~50k lignes.
CREATE INDEX IF NOT EXISTS idx_page_views_page       ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_views_public_insert" ON page_views;
CREATE POLICY "page_views_public_insert" ON page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "page_views_admin_select" ON page_views;
CREATE POLICY "page_views_admin_select" ON page_views
  FOR SELECT TO authenticated
  USING (true);

-- ── subscribers : abonnés newsletter ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email           text        UNIQUE NOT NULL,
  active          boolean     DEFAULT true,
  welcome_sent    boolean     DEFAULT false,
  welcome_sent_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscribers_public_insert" ON subscribers;
CREATE POLICY "subscribers_public_insert" ON subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Désinscription publique : passer active=false est autorisé, jamais true.
DROP POLICY IF EXISTS "subscribers_public_unsubscribe" ON subscribers;
CREATE POLICY "subscribers_public_unsubscribe" ON subscribers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (active = false);

DROP POLICY IF EXISTS "subscribers_admin_all" ON subscribers;
CREATE POLICY "subscribers_admin_all" ON subscribers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── newsletters : historique des envois ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletters (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  subject      text        NOT NULL,
  html         text        NOT NULL,
  sent_count   integer     DEFAULT 0,
  failed_count integer     DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletters_admin_all" ON newsletters;
CREATE POLICY "newsletters_admin_all" ON newsletters
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── seo_keywords : mots-clés analysés depuis /admin/seo ──────────────────────
CREATE TABLE IF NOT EXISTS seo_keywords (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword          text        NOT NULL,
  volume_label     text CHECK (volume_label     IN ('faible', 'moyen', 'élevé')),
  difficulty_label text CHECK (difficulty_label IN ('faible', 'moyen', 'élevé')),
  intent           text CHECK (intent           IN ('informationnel', 'transactionnel', 'navigationnel')),
  category         text,
  source           text        DEFAULT 'keyword_research',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_keywords_admin_all" ON seo_keywords;
CREATE POLICY "seo_keywords_admin_all" ON seo_keywords
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── seo_clusters : grappe sémantique attachée à un mot-clé ───────────────────
-- `article_seo_scores.cluster_id` (migration 20260727_articles) pointe sur
-- cette table sans contrainte formelle, pour rester applicable dans n'importe
-- quel ordre sur une base existante.
CREATE TABLE IF NOT EXISTS seo_clusters (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id         uuid        REFERENCES seo_keywords(id) ON DELETE CASCADE,
  focus_keyword      text        NOT NULL,
  category           text,
  secondary_keywords text[]      NOT NULL DEFAULT '{}',
  related_questions  text[]      NOT NULL DEFAULT '{}',
  suggested_title    text,
  suggested_slug     text,
  suggested_intro    text,
  content_tips       text[]      NOT NULL DEFAULT '{}',
  cta                text,
  opportunity        text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE seo_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_clusters_admin_all" ON seo_clusters;
CREATE POLICY "seo_clusters_admin_all" ON seo_clusters
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── saved_ideas : idées d'articles mises de côté depuis /admin/seo ───────────
-- `data` conserve la suggestion brute renvoyée par la génération IA.
CREATE TABLE IF NOT EXISTS saved_ideas (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type       text        NOT NULL DEFAULT 'article',
  title      text        NOT NULL,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_ideas_type_created
  ON saved_ideas(type, created_at DESC);

ALTER TABLE saved_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_ideas_admin_all" ON saved_ideas;
CREATE POLICY "saved_ideas_admin_all" ON saved_ideas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
