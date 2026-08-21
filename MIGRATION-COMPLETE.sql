-- ═══════════════════════════════════════════════════════════════════════
-- Studio — structure complète de la base de données
--
-- À copier-coller dans Supabase → SQL Editor → New query → Run.
-- Sans danger à relancer : tout est en CREATE TABLE IF NOT EXISTS.
--
-- Généré le 19.08.2026 à partir de supabase/migrations/
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260610_dynamic_pages.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Table `dynamic_pages` — pages créées via le Page Builder
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dynamic_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sections    JSONB NOT NULL DEFAULT '[]',
  published   BOOLEAN NOT NULL DEFAULT false,
  show_header BOOLEAN NOT NULL DEFAULT true,
  show_footer BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dynamic_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published" ON dynamic_pages;
DROP POLICY IF EXISTS "admin_all" ON dynamic_pages;

-- Lecture publique des pages publiées
CREATE POLICY "public_read_published" ON dynamic_pages
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Admin : lecture et écriture complètes
CREATE POLICY "admin_all" ON dynamic_pages
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dynamic_pages_updated_at ON dynamic_pages;
CREATE TRIGGER dynamic_pages_updated_at
  BEFORE UPDATE ON dynamic_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260727_articles.sql
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260727_events.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Module Événements — tables `events` + `event_registrations`.
-- Consolidé depuis events-schema, events-dates-migration, events-features-migration,
-- events-installments-migration, events-meta-migration, discount-label-migration,
-- fix-events-rls.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title                   text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  category                text        NOT NULL DEFAULT 'atelier_groupe'
                                      CHECK (category IN ('retraite_spirituelle','atelier_groupe','module','evenement_regulier')),
  excerpt                 text,
  description             text,
  date_start              date,
  date_end                date,
  time_start              text,
  time_end                text,
  location                text        NOT NULL DEFAULT '',
  address                 text,
  price_chf               integer     NOT NULL DEFAULT 0,
  max_participants        integer,
  image_url               text,
  status                  text        NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('published','draft','paused')),
  -- Visio
  is_online               boolean     DEFAULT false,
  visio_url               text,
  -- Récurrence
  is_recurring            boolean     DEFAULT false,
  recurrence_sessions     integer,
  recurrence_day          text,
  recurrence_description  text,
  -- Tarif
  discount_label          text,
  -- SEO
  meta_title              text,
  meta_description        text,
  meta_keywords           text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id                uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name              text        NOT NULL,
  last_name               text        NOT NULL,
  email                   text        NOT NULL,
  phone                   text,
  payment_type            text        NOT NULL DEFAULT 'full'
                                      CHECK (payment_type IN ('full','installment')),
  payment_status          text        NOT NULL DEFAULT 'pending'
                                      CHECK (payment_status IN ('pending','paid','failed','refunded')),
  stripe_session_id       text,
  amount_chf              integer     NOT NULL DEFAULT 0,
  -- Paiement fractionné (3x)
  installment_amount_chf  integer,
  installment_2_url       text,
  installment_2_date      date,
  installment_2_status    text        DEFAULT 'pending',
  installment_3_url       text,
  installment_3_date      date,
  installment_3_status    text        DEFAULT 'pending',
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON events', pol.policyname);
  END LOOP;
END $$;

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'event_registrations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON event_registrations', pol.policyname);
  END LOOP;
END $$;

-- Lecture publique : événements publiés uniquement
CREATE POLICY "events_select_public"
  ON events FOR SELECT TO anon
  USING (status = 'published');

-- Admin : accès complet aux événements
CREATE POLICY "events_all_admin"
  ON events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Inscription : n'importe qui peut s'inscrire
CREATE POLICY "registrations_insert_anon"
  ON event_registrations FOR INSERT TO anon
  WITH CHECK (true);

-- Admin : lecture et gestion de toutes les inscriptions
CREATE POLICY "registrations_all_admin"
  ON event_registrations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT ON events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT INSERT ON event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_registrations TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260727_settings.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Table `settings` — configuration clé/valeur générique du site (branding,
-- coordonnées d'entreprise, modules activés/désactivés, copie des pages).
-- Consolidé depuis settings.sql + fix-settings-rls.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON settings;
DROP POLICY IF EXISTS "admin_update" ON settings;
DROP POLICY IF EXISTS "admin_all" ON settings;

-- Lecture publique (nécessaire pour le rendu SSR/CSR des pages publiques)
CREATE POLICY "public_read" ON settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture et gestion réservées à l'admin authentifié
CREATE POLICY "admin_all" ON settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO authenticated;

-- Valeurs par défaut minimales (le reste est fourni par SETTINGS_DEFAULTS
-- côté app — src/constants/settings.ts — tant que la ligne n'existe pas en base).
INSERT INTO settings (key, value) VALUES
  ('module_blog_enabled',          'true'),
  ('module_ai_generation_enabled', 'true'),
  ('module_events_enabled',        'true')
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260728_social.sql
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260729_ai_usage.sql
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260730_medias_analytics_newsletter_seo.sql
-- ─────────────────────────────────────────────────────────────────────

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
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id          uuid        REFERENCES seo_keywords(id) ON DELETE CASCADE,
  focus_keyword       text        NOT NULL,
  category            text,
  funnel_level        text        DEFAULT 'découverte',
  secondary_keywords  text[]      NOT NULL DEFAULT '{}',
  related_questions   text[]      NOT NULL DEFAULT '{}',
  ai_prompts          text[]      NOT NULL DEFAULT '{}',
  community_questions text[]      NOT NULL DEFAULT '{}',
  geo_citation_tips   text[]      NOT NULL DEFAULT '{}',
  rel_bridge          text        DEFAULT '',
  suggested_title     text,
  suggested_slug      text,
  suggested_intro     text,
  content_tips        text[]      NOT NULL DEFAULT '{}',
  cta                 text,
  opportunity         text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
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


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260731_caisse.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Module Caisse — clientèle, catalogue de prestations, encaissements, factures.
--
-- Conformité comptable suisse (CO art. 957a al. 2 et 958f) :
--  · Intégralité et chronologie  → numérotation séquentielle sans trou, allouée
--    en base par `caisse_next_invoice_seq` (verrou de ligne, donc sûre même si
--    deux encaissements sont validés en même temps).
--  · Immuabilité                 → aucune SUPPRESSION possible d'une écriture ;
--    les montants, la date et le numéro sont verrouillés par trigger. Une erreur
--    se corrige par une ANNULATION (status='annulee'), qui laisse la trace.
--  · Traçabilité de l'identité   → le nom du client est recopié sur la
--    transaction (`client_label`) : renommer ou supprimer une fiche cliente ne
--    réécrit pas une facture déjà émise.
--  · Conservation 10 ans         → les tables ne sont jamais purgées ; la fiche
--    cliente s'archive (`archived`) au lieu d'être supprimée si elle est liée.
--
-- Les montants sont en francs, `numeric(10,2)` : les centimes comptent dès que
-- la TVA est activée (8.1 % de CHF 120.00 = CHF 9.72), donc pas d'entier CHF
-- comme dans le module Événements.
--
-- ⚠️ À appliquer AVANT `20260801_caisse_bons_cadeaux.sql`, qui remplace
-- `caisse_create_transaction` par une version étendue. Rejouer ce fichier seul
-- après le second recréerait l'ancienne signature à 5 arguments, et PostgREST
-- ne saurait plus laquelle des deux appeler.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Clientèle ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text        NOT NULL,
  prenom      text        NOT NULL DEFAULT '',
  telephone   text,
  email       text,
  notes       text,
  -- On archive au lieu de supprimer : une cliente citée sur une facture émise
  -- doit rester consultable (CO art. 958f, conservation 10 ans).
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Recherche rapide « nom, prénom ou téléphone » du flux d'encaissement.
CREATE INDEX IF NOT EXISTS clients_search_idx
  ON clients (lower(nom), lower(prenom));
CREATE INDEX IF NOT EXISTS clients_telephone_idx
  ON clients (telephone);

-- ── Catalogue de prestations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  nom               text          NOT NULL,
  description       text,
  prix_chf          numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_chf >= 0),
  -- Taux appliqué par défaut lors de l'ajout au panier. 0 tant que l'activité
  -- n'est pas assujettie ; 8.1 (normal) ou 2.6 (réduit) le jour où elle l'est.
  taux_tva_defaut   numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva_defaut >= 0 AND taux_tva_defaut <= 100),
  active            boolean       NOT NULL DEFAULT true,
  ordre             integer       NOT NULL DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_active_idx ON services (active, ordre);

-- ── Compteur de numérotation des factures ───────────────────────────────────
-- Une ligne par année civile. Jamais écrit directement : seule la fonction
-- `caisse_next_invoice_seq` (SECURITY DEFINER) y touche, ce qui garantit une
-- séquence continue même en cas d'encaissements simultanés.
CREATE TABLE IF NOT EXISTS invoice_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

-- ── Encaissements ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee          integer       NOT NULL,
  number_seq     integer       NOT NULL,
  -- Numéro affiché et imprimé : FAC-2026-0001. Colonne générée, donc jamais
  -- désynchronisée de (annee, number_seq).
  numero         text          GENERATED ALWAYS AS
                               ('FAC-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  client_id      uuid          REFERENCES clients(id) ON DELETE SET NULL,
  -- Nom figé au moment de l'encaissement (« Client de passage » si anonyme).
  client_label   text          NOT NULL DEFAULT 'Client de passage',
  total_ht       numeric(10,2) NOT NULL DEFAULT 0,
  total_tva      numeric(10,2) NOT NULL DEFAULT 0,
  total_ttc      numeric(10,2) NOT NULL DEFAULT 0,
  mode_paiement  text          NOT NULL DEFAULT 'especes'
                               CHECK (mode_paiement IN ('especes','carte','twint','virement')),
  status         text          NOT NULL DEFAULT 'payee'
                               CHECK (status IN ('payee','annulee')),
  note           text,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq)
);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_client_idx     ON transactions (client_id);

CREATE TABLE IF NOT EXISTS transaction_items (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id     uuid          NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  -- Référence indicative : le libellé et le prix sont recopiés, donc modifier
  -- ou supprimer une prestation du catalogue ne réécrit pas les factures.
  service_id         uuid          REFERENCES services(id) ON DELETE SET NULL,
  description        text          NOT NULL,
  prix_unitaire_ttc  numeric(10,2) NOT NULL CHECK (prix_unitaire_ttc >= 0),
  quantite           numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite > 0),
  taux_tva           numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva >= 0 AND taux_tva <= 100),
  total_ttc          numeric(10,2) NOT NULL DEFAULT 0,
  ordre              integer       NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS transaction_items_tx_idx ON transaction_items (transaction_id, ordre);

-- ─────────────────────────────────────────────────────────────────────────────
-- Numérotation séquentielle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_next_invoice_seq(p_annee integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- ON CONFLICT DO UPDATE pose un verrou de ligne : deux appels concurrents
  -- sont sérialisés, donc jamais deux fois le même numéro ni de trou.
  INSERT INTO invoice_counters (annee, last_seq)
  VALUES (p_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Création d'un encaissement (numérotation + lignes + totaux, en une seule
-- transaction). Les montants sont calculés ICI, pas dans le navigateur : la
-- base reste l'unique source de vérité comptable.
--
-- p_items : tableau JSON
--   [{ "service_id": uuid|null, "description": text,
--      "prix_unitaire_ttc": number, "quantite": number, "taux_tva": number }]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_create_transaction(
  p_client_id     uuid,
  p_client_label  text,
  p_mode_paiement text,
  p_note          text,
  p_items         jsonb
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee integer;
  v_seq   integer;
  v_tx    transactions;
  v_item  jsonb;
  v_idx   integer := 0;
  v_label text;
  v_ttc   numeric(10,2);
  v_ht    numeric(10,2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  -- Heure suisse : un encaissement du 31 décembre à 23 h doit tomber sur
  -- l'exercice de l'année en cours à Palézieux, pas sur celui d'UTC.
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;
  v_seq   := caisse_next_invoice_seq(v_annee);

  v_label := NULLIF(btrim(coalesce(p_client_label, '')), '');
  IF v_label IS NULL AND p_client_id IS NOT NULL THEN
    SELECT btrim(prenom || ' ' || nom) INTO v_label FROM clients WHERE id = p_client_id;
  END IF;

  -- Totaux calculés AVANT l'insertion, pas après : le trigger d'immuabilité
  -- refuse toute écriture ultérieure sur les colonnes de montants, y compris
  -- venant d'ici. La transaction naît donc directement avec ses totaux définitifs.
  --
  -- Les prix sont saisis TTC (usage en institut) : le HT se déduit ligne par
  -- ligne et la TVA est le reliquat — jamais l'inverse, sinon la somme des
  -- lignes ne retomberait pas sur le total réellement encaissé. Les expressions
  -- sont identiques à celles des lignes ci-dessous, pour que total = Σ lignes
  -- au centime près.
  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
  FROM jsonb_array_elements(p_items) it;

  INSERT INTO transactions (
    annee, number_seq, client_id, client_label, mode_paiement, note,
    total_ht, total_tva, total_ttc
  )
  VALUES (
    v_annee,
    v_seq,
    p_client_id,
    coalesce(v_label, 'Client de passage'),
    coalesce(p_mode_paiement, 'especes'),
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht,
    v_ttc - v_ht,
    v_ttc
  )
  RETURNING * INTO v_tx;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, service_id, description, prix_unitaire_ttc, quantite, taux_tva, total_ttc, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation'),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      coalesce((v_item->>'quantite')::numeric, 1),
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * coalesce((v_item->>'quantite')::numeric, 1), 2),
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Annulation — le seul moyen de « défaire » un encaissement. L'écriture reste
-- en base avec son numéro : c'est ce qu'exige la traçabilité (CO art. 957a).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions;
BEGIN
  UPDATE transactions
  SET status        = 'annulee',
      cancelled_at  = now(),
      cancel_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at    = now()
  WHERE id = p_id AND status = 'payee'
  RETURNING * INTO v_tx;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable ou déjà annulée.';
  END IF;
  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Immuabilité des écritures
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une écriture de caisse ne se supprime pas (CO art. 957a) : annulez la facture %.', OLD.numero;
  END IF;

  IF NEW.annee      IS DISTINCT FROM OLD.annee
  OR NEW.number_seq IS DISTINCT FROM OLD.number_seq
  OR NEW.total_ht   IS DISTINCT FROM OLD.total_ht
  OR NEW.total_tva  IS DISTINCT FROM OLD.total_tva
  OR NEW.total_ttc  IS DISTINCT FROM OLD.total_ttc
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Numéro, date et montants de la facture % sont immuables (CO art. 957a). Annulez-la et ré-encaissez.', OLD.numero;
  END IF;

  IF OLD.status = 'annulee' AND NEW.status <> 'annulee' THEN
    RAISE EXCEPTION 'La facture % est annulée : elle ne peut pas être réactivée.', OLD.numero;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_update ON transactions;
CREATE TRIGGER transactions_guard_update
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION caisse_transactions_guard();

DROP TRIGGER IF EXISTS transactions_guard_delete ON transactions;
CREATE TRIGGER transactions_guard_delete
  BEFORE DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION caisse_transactions_guard();

-- Le détail d'une facture est figé au même titre que son total.
CREATE OR REPLACE FUNCTION caisse_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être supprimé (CO art. 957a).';
  END IF;

  -- Seule mutation tolérée : le `ON DELETE SET NULL` déclenché quand une
  -- prestation sort du catalogue. Sans cette exception, retirer un soin du
  -- catalogue échouerait dès qu'il a été vendu une fois. Le libellé, le prix et
  -- le taux restent figés — la facture, elle, ne bouge pas d'un centime.
  IF NEW.service_id IS NULL AND OLD.service_id IS NOT NULL
  AND NEW.transaction_id    IS NOT DISTINCT FROM OLD.transaction_id
  AND NEW.description       IS NOT DISTINCT FROM OLD.description
  AND NEW.prix_unitaire_ttc IS NOT DISTINCT FROM OLD.prix_unitaire_ttc
  AND NEW.quantite          IS NOT DISTINCT FROM OLD.quantite
  AND NEW.taux_tva          IS NOT DISTINCT FROM OLD.taux_tva
  AND NEW.total_ttc         IS NOT DISTINCT FROM OLD.total_ttc
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être modifié (CO art. 957a).';
END;
$$;

DROP TRIGGER IF EXISTS transaction_items_guard ON transaction_items;
CREATE TRIGGER transaction_items_guard
  BEFORE UPDATE OR DELETE ON transaction_items
  FOR EACH ROW EXECUTE FUNCTION caisse_items_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — module strictement interne : rien n'est exposé au rôle `anon`.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters  ENABLE ROW LEVEL SECURITY;

-- `clients`, `services` et `transactions` sont des noms génériques : on filtre
-- explicitement sur le schéma `public`, sinon une table homonyme d'un autre
-- schéma (storage, realtime…) verrait ses policies supprimées.
DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients','services','transactions','transaction_items','invoice_counters'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "clients_all_admin"  ON clients  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "services_all_admin" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lecture pour le journal et le tableau de bord ; écriture uniquement pour
-- l'annulation et l'édition de la note/du client (les triggers filtrent le
-- reste). Pas de policy INSERT ni DELETE : on passe forcément par les RPC.
CREATE POLICY "transactions_select_admin" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_update_admin" ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "transaction_items_select_admin" ON transaction_items FOR SELECT TO authenticated USING (true);

-- `invoice_counters` n'a aucune policy : seules les fonctions SECURITY DEFINER
-- y accèdent.

-- Supabase accorde par défaut tous les privilèges sur les nouvelles tables du
-- schéma `public` à `anon` et `authenticated` (ALTER DEFAULT PRIVILEGES posé à
-- la création du projet). RLS suffit à bloquer les lectures, mais on ne veut
-- pas que la protection du fichier clientes — des données personnelles —
-- repose sur une seule ligne de défense : on retire le privilège lui-même.
REVOKE ALL ON clients           FROM anon;
REVOKE ALL ON services          FROM anon;
REVOKE ALL ON transactions      FROM anon;
REVOKE ALL ON transaction_items FROM anon;
REVOKE ALL ON invoice_counters  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON clients  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;
GRANT SELECT, UPDATE                 ON transactions      TO authenticated;
GRANT SELECT                         ON transaction_items TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_next_invoice_seq(integer)                        FROM public;
REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)                    FROM public;
GRANT  EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb) TO authenticated;
GRANT  EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)                    TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260801_caisse_bons_cadeaux.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Bons cadeaux + correction d'écriture.
--
-- ┌─ LA RÈGLE QUI GOUVERNE TOUT CE FICHIER ────────────────────────────────┐
-- │ Un bon cadeau ne produit de recette QU'UNE FOIS : à sa vente.          │
-- │ Le jour où la cliente l'utilise, aucun argent n'entre — la prestation  │
-- │ est déjà payée. Compter les deux doublerait le chiffre d'affaires.     │
-- │                                                                        │
-- │ D'où `transactions.montant_bon` : la part de la facture réglée avec un │
-- │ bon. La recette encaissée vaut TOUJOURS `total_ttc - montant_bon`.     │
-- │ Cette soustraction est la seule définition correcte du CA dans tout le │
-- │ module — journal, tableau de bord et export fiducie l'appliquent.      │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Ce modèle couvre aussi le cas courant du bon partiel : bon de CHF 150 sur un
-- soin à CHF 200 → montant_bon = 150, mode_paiement = twint pour les 50 restants.
--
-- Durée de validité : le droit suisse ne fixe aucun minimum. Un bon est une
-- créance ordinaire, donc prescrite par 10 ans (CO art. 127) faute d'accord
-- contraire. Les organisations de consommateurs contestent les validités
-- courtes ; le réglage `caisse_bon_validite_mois` vaut 60 mois (5 ans) par
-- défaut, un compromis usuel dans la branche. La date d'échéance est figée sur
-- chaque bon à son émission : changer le réglage n'altère jamais un bon déjà
-- vendu.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Numérotation des bons (même principe que les factures) ──────────────────
CREATE TABLE IF NOT EXISTS gift_card_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee               integer       NOT NULL,
  number_seq          integer       NOT NULL,
  code                text          GENERATED ALWAYS AS
                                    ('BON-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  -- « Bon cadeau », ou la liste des soins choisis dans la carte.
  libelle             text          NOT NULL DEFAULT 'Bon cadeau',
  montant_initial     numeric(10,2) NOT NULL CHECK (montant_initial > 0),
  montant_restant     numeric(10,2) NOT NULL CHECK (montant_restant >= 0),
  beneficiaire        text,
  acheteur_client_id  uuid          REFERENCES clients(id) ON DELETE SET NULL,
  acheteur_label      text          NOT NULL DEFAULT 'Client de passage',
  -- La vente qui l'a émis. RESTRICT : on ne détruit pas la trace d'un bon en
  -- vie — de toute façon les transactions ne se suppriment pas.
  sale_transaction_id uuid          REFERENCES transactions(id) ON DELETE RESTRICT,
  emis_le             timestamptz   NOT NULL DEFAULT now(),
  expire_le           date          NOT NULL,
  -- Pas de statut « expiré » stocké : il se déduit de `expire_le`, sinon il
  -- faudrait une tâche planifiée pour le tenir à jour, et un bon deviendrait
  -- faussement valable le jour où elle ne tourne pas.
  status              text          NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','epuise','annule')),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq),
  CHECK (montant_restant <= montant_initial)
);

CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards (status, expire_le);
CREATE INDEX IF NOT EXISTS gift_cards_sale_idx   ON gift_cards (sale_transaction_id);

-- ── Colonnes ajoutées aux encaissements ─────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS gift_card_id           uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS montant_bon            numeric(10,2) NOT NULL DEFAULT 0 CHECK (montant_bon >= 0),
  -- Facture que celle-ci corrige. L'ancienne reste annulée au journal avec son
  -- numéro : c'est le chaînage qui rend la correction traçable (CO art. 957a).
  ADD COLUMN IF NOT EXISTS corrige_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

-- Le bon cadeau devient un mode de règlement à part entière (facture soldée
-- intégralement par un bon).
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_mode_paiement_check;
ALTER TABLE transactions ADD  CONSTRAINT transactions_mode_paiement_check
  CHECK (mode_paiement IN ('especes','carte','twint','virement','bon_cadeau'));

-- Un bon lié à une ligne : permet d'imprimer le code sur la quittance de vente.
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Immuabilité — `montant_bon` est une donnée financière au même titre que les
-- totaux : le modifier après coup fausserait le CA de la période.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une écriture de caisse ne se supprime pas (CO art. 957a) : annulez la facture %.', OLD.numero;
  END IF;

  IF NEW.annee                  IS DISTINCT FROM OLD.annee
  OR NEW.number_seq             IS DISTINCT FROM OLD.number_seq
  OR NEW.total_ht               IS DISTINCT FROM OLD.total_ht
  OR NEW.total_tva              IS DISTINCT FROM OLD.total_tva
  OR NEW.total_ttc              IS DISTINCT FROM OLD.total_ttc
  OR NEW.montant_bon            IS DISTINCT FROM OLD.montant_bon
  OR NEW.corrige_transaction_id IS DISTINCT FROM OLD.corrige_transaction_id
  OR NEW.created_at             IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Numéro, date et montants de la facture % sont immuables (CO art. 957a). Annulez-la et ré-encaissez.', OLD.numero;
  END IF;

  IF OLD.status = 'annulee' AND NEW.status <> 'annulee' THEN
    RAISE EXCEPTION 'La facture % est annulée : elle ne peut pas être réactivée.', OLD.numero;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Le `ON DELETE SET NULL` de gift_cards touche aussi les lignes de facture :
-- on l'autorise au même titre que celui de services.
CREATE OR REPLACE FUNCTION caisse_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être supprimé (CO art. 957a).';
  END IF;

  IF (
       (NEW.service_id   IS NULL AND OLD.service_id   IS NOT NULL)
    OR (NEW.gift_card_id IS NULL AND OLD.gift_card_id IS NOT NULL)
     )
  AND NEW.transaction_id    IS NOT DISTINCT FROM OLD.transaction_id
  AND NEW.description       IS NOT DISTINCT FROM OLD.description
  AND NEW.prix_unitaire_ttc IS NOT DISTINCT FROM OLD.prix_unitaire_ttc
  AND NEW.quantite          IS NOT DISTINCT FROM OLD.quantite
  AND NEW.taux_tva          IS NOT DISTINCT FROM OLD.taux_tva
  AND NEW.total_ttc         IS NOT DISTINCT FROM OLD.total_ttc
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être modifié (CO art. 957a).';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_next_gift_card_seq(p_annee integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO gift_card_counters (annee, last_seq)
  VALUES (p_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = gift_card_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Création d'un encaissement — version étendue.
--
-- L'ancienne signature à 5 arguments est supprimée : la garder créerait une
-- surcharge, et PostgREST ne saurait plus laquelle appeler.
--
--  p_gift_card_code : bon présenté en paiement (NULL si aucun)
--  p_montant_bon    : part de la facture réglée avec ce bon
--  p_emissions      : bons à émettre, [{ ordre, montant, libelle, beneficiaire,
--                     validite_mois }] — un par ligne « bon cadeau » du panier,
--                     `ordre` étant l'indice de cette ligne dans p_items
--  p_corrige_transaction_id : facture que cet encaissement corrige
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS caisse_create_transaction(uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION caisse_create_transaction(
  p_client_id              uuid,
  p_client_label           text,
  p_mode_paiement          text,
  p_note                   text,
  p_items                  jsonb,
  p_gift_card_code         text    DEFAULT NULL,
  p_montant_bon            numeric DEFAULT 0,
  p_emissions              jsonb   DEFAULT NULL,
  p_corrige_transaction_id uuid    DEFAULT NULL
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee    integer;
  v_seq      integer;
  v_tx       transactions;
  v_item     jsonb;
  v_emission jsonb;
  v_idx      integer := 0;
  v_label    text;
  v_ttc      numeric(10,2);
  v_ht       numeric(10,2);
  v_bon      numeric(10,2) := round(coalesce(p_montant_bon, 0), 2);
  v_card     gift_cards;
  v_card_id  uuid := NULL;
  v_today    date;
  v_new_card gift_cards;
  v_gseq     integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;

  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
  FROM jsonb_array_elements(p_items) it;

  -- ── Bon présenté en paiement ──────────────────────────────────────────────
  IF p_gift_card_code IS NOT NULL AND btrim(p_gift_card_code) <> '' THEN
    -- FOR UPDATE : verrouille le bon le temps de la transaction, pour que deux
    -- encaissements simultanés ne puissent pas dépenser deux fois le solde.
    SELECT * INTO v_card FROM gift_cards
    WHERE upper(code) = upper(btrim(p_gift_card_code))
    FOR UPDATE;

    IF v_card.id IS NULL THEN
      RAISE EXCEPTION 'Bon cadeau introuvable : %.', p_gift_card_code;
    END IF;
    IF v_card.status = 'annule' THEN
      RAISE EXCEPTION 'Le bon % a été annulé.', v_card.code;
    END IF;
    IF v_card.expire_le < v_today THEN
      RAISE EXCEPTION 'Le bon % a expiré le %.', v_card.code, to_char(v_card.expire_le, 'DD.MM.YYYY');
    END IF;
    IF v_bon <= 0 THEN
      RAISE EXCEPTION 'Le montant prélevé sur le bon % doit être supérieur à zéro.', v_card.code;
    END IF;
    IF v_bon > v_card.montant_restant THEN
      RAISE EXCEPTION 'Le bon % ne dispose que de CHF % (demandé : CHF %).',
        v_card.code, to_char(v_card.montant_restant, 'FM999999990.00'), to_char(v_bon, 'FM999999990.00');
    END IF;
    IF v_bon > v_ttc THEN
      RAISE EXCEPTION 'Le montant réglé par bon (CHF %) dépasse le total de la facture (CHF %).',
        to_char(v_bon, 'FM999999990.00'), to_char(v_ttc, 'FM999999990.00');
    END IF;

    v_card_id := v_card.id;
  ELSE
    v_bon := 0;
  END IF;

  v_seq := caisse_next_invoice_seq(v_annee);

  v_label := NULLIF(btrim(coalesce(p_client_label, '')), '');
  IF v_label IS NULL AND p_client_id IS NOT NULL THEN
    SELECT btrim(prenom || ' ' || nom) INTO v_label FROM clients WHERE id = p_client_id;
  END IF;

  INSERT INTO transactions (
    annee, number_seq, client_id, client_label, mode_paiement, note,
    total_ht, total_tva, total_ttc, gift_card_id, montant_bon, corrige_transaction_id
  )
  VALUES (
    v_annee, v_seq, p_client_id,
    coalesce(v_label, 'Client de passage'),
    coalesce(p_mode_paiement, 'especes'),
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht, v_ttc - v_ht, v_ttc,
    v_card_id, v_bon, p_corrige_transaction_id
  )
  RETURNING * INTO v_tx;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, service_id, description, prix_unitaire_ttc, quantite, taux_tva, total_ttc, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation'),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      coalesce((v_item->>'quantite')::numeric, 1),
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * coalesce((v_item->>'quantite')::numeric, 1), 2),
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- ── Décompte du bon utilisé ───────────────────────────────────────────────
  IF v_card_id IS NOT NULL THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant - v_bon,
        status = CASE WHEN montant_restant - v_bon <= 0 THEN 'epuise' ELSE 'active' END,
        updated_at = now()
    WHERE id = v_card_id;
  END IF;

  -- ── Émission des bons vendus ──────────────────────────────────────────────
  IF p_emissions IS NOT NULL AND jsonb_typeof(p_emissions) = 'array' THEN
    FOR v_emission IN SELECT * FROM jsonb_array_elements(p_emissions)
    LOOP
      v_gseq := caisse_next_gift_card_seq(v_annee);

      INSERT INTO gift_cards (
        annee, number_seq, libelle, montant_initial, montant_restant,
        beneficiaire, acheteur_client_id, acheteur_label, sale_transaction_id, expire_le
      )
      VALUES (
        v_annee, v_gseq,
        coalesce(NULLIF(btrim(coalesce(v_emission->>'libelle', '')), ''), 'Bon cadeau'),
        round((v_emission->>'montant')::numeric, 2),
        round((v_emission->>'montant')::numeric, 2),
        NULLIF(btrim(coalesce(v_emission->>'beneficiaire', '')), ''),
        p_client_id,
        coalesce(v_label, 'Client de passage'),
        v_tx.id,
        -- Échéance figée maintenant : le réglage de durée peut changer ensuite
        -- sans jamais rogner la validité d'un bon déjà vendu.
        v_today + (coalesce((v_emission->>'validite_mois')::integer, 60) || ' months')::interval
      )
      RETURNING * INTO v_new_card;

      -- Rattache la ligne du panier qui a produit ce bon, pour que son code
      -- s'imprime sur la quittance. L'appelant fournit l'indice de la ligne
      -- (`ordre`) : rapprocher par montant se tromperait dès que deux bons de
      -- même valeur sont vendus ensemble.
      UPDATE transaction_items
      SET gift_card_id = v_new_card.id
      WHERE transaction_id = v_tx.id
        AND ordre = (v_emission->>'ordre')::integer;
    END LOOP;
  END IF;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Annulation — doit aussi défaire les effets sur les bons cadeaux.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx     transactions;
  v_entame record;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_id FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable.';
  END IF;
  IF v_tx.status = 'annulee' THEN
    RAISE EXCEPTION 'La facture % est déjà annulée.', v_tx.numero;
  END IF;

  -- Un bon vendu par cette facture et déjà entamé ne peut pas être repris :
  -- la cliente a consommé une prestation, annuler la vente créerait un bon
  -- fantôme et un trou dans les recettes.
  SELECT code, montant_initial, montant_restant INTO v_entame
  FROM gift_cards
  WHERE sale_transaction_id = v_tx.id
    AND status <> 'annule'
    AND montant_restant < montant_initial
  LIMIT 1;

  IF v_entame.code IS NOT NULL THEN
    RAISE EXCEPTION 'Le bon % vendu par cette facture a déjà été utilisé : la vente ne peut plus être annulée.', v_entame.code;
  END IF;

  -- Bons émis et intacts → invalidés avec la vente.
  UPDATE gift_cards
  SET status = 'annule', updated_at = now()
  WHERE sale_transaction_id = v_tx.id AND status <> 'annule';

  -- Bon utilisé pour payer → le solde revient à la cliente.
  IF v_tx.gift_card_id IS NOT NULL AND v_tx.montant_bon > 0 THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant + v_tx.montant_bon,
        status = CASE WHEN status = 'epuise' THEN 'active' ELSE status END,
        updated_at = now()
    WHERE id = v_tx.gift_card_id;
  END IF;

  UPDATE transactions
  SET status        = 'annulee',
      cancelled_at  = now(),
      cancel_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at    = now()
  WHERE id = p_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS & privilèges
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gift_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_counters ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['gift_cards','gift_card_counters'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Lecture pour consulter et rechercher un bon ; création et décompte passent
-- exclusivement par les fonctions ci-dessus.
CREATE POLICY "gift_cards_select_admin" ON gift_cards FOR SELECT TO authenticated USING (true);

REVOKE ALL ON gift_cards         FROM anon;
REVOKE ALL ON gift_card_counters FROM anon, authenticated;
GRANT  SELECT ON gift_cards TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_next_gift_card_seq(integer) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260802_caisse_categories_forfaits_stock.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Catégories de prestations, forfaits, et gestion de stock des produits revendus.
--
-- À appliquer APRÈS `20260731_caisse.sql` et `20260801_caisse_bons_cadeaux.sql` :
-- ce fichier remplace le corps de `caisse_create_transaction` et de
-- `caisse_cancel_transaction` sans en changer la signature. Rejouer un des deux
-- fichiers précédents après celui-ci écraserait les décomptes de stock.
--
-- Trois ajouts, trois logiques distinctes :
--
--  1. CATÉGORIES — simple rangement du catalogue (Épilation, Soins du visage,
--     Soins du corps, Maquillage, Divers…). Aucun effet comptable : une facture
--     ne cite jamais une catégorie, seulement le libellé figé de la ligne.
--
--  2. FORFAITS — un lot de zones vendu à prix groupé. Le forfait EST une
--     prestation (`services.type = 'forfait'`) avec son propre prix ; sa
--     composition ne sert qu'à le construire et à afficher l'économie réalisée.
--     Il tombe dans le panier en UNE ligne, donc une seule ligne de facture.
--     C'est voulu : le prix groupé n'est pas la somme de ses parties, ventiler
--     après coup inventerait des montants que personne n'a encaissés.
--
--  3. STOCK — les produits revendus sont de la marchandise, pas une prestation.
--     Leur stock ne se saisit pas : il se DÉDUIT du journal des mouvements
--     (`stock_movements`), append-only comme le journal des recettes. Un écart
--     d'inventaire se corrige par un mouvement daté et motivé, jamais en
--     réécrivant le compteur — c'est ce qui rend l'écart explicable.
--
--     Le coût d'achat est FIGÉ sur la ligne de facture au moment de la vente
--     (`transaction_items.prix_achat_unitaire`), au même titre que le libellé
--     et le prix : renégocier un tarif fournisseur ne doit pas réécrire la
--     marge des ventes déjà passées.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Catégories de prestations
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS service_categories (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text        NOT NULL,
  ordre       integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_categories_ordre_idx ON service_categories (ordre);

-- ON DELETE SET NULL : supprimer une catégorie ne fait pas disparaître les
-- soins qu'elle rangeait — ils repassent simplement en « Sans catégorie ».
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS services_category_idx ON services (category_id, ordre);

-- Catégories de départ — uniquement si la table est vierge, pour qu'un rejeu
-- de la migration n'en recrée pas des doublons.
INSERT INTO service_categories (nom, ordre)
SELECT v.nom, v.ordre
FROM (VALUES
  ('Épilation',       0),
  ('Soins du visage', 1),
  ('Soins du corps',  2),
  ('Maquillage',      3),
  ('Divers',          4)
) AS v(nom, ordre)
WHERE NOT EXISTS (SELECT 1 FROM service_categories);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Forfaits
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'prestation';

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;
ALTER TABLE services ADD  CONSTRAINT services_type_check
  CHECK (type IN ('prestation', 'forfait'));

-- Composition d'un forfait. Purement descriptive : elle sert à le monter dans
-- l'admin et à afficher « valeur cumulée / économie », jamais à recalculer un
-- prix — celui du forfait est celui saisi dans `services.prix_chf`.
CREATE TABLE IF NOT EXISTS service_forfait_items (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  forfait_id  uuid          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  -- RESTRICT : retirer du catalogue un soin encore cité dans un forfait
  -- viderait ce forfait en silence, et son prix groupé ne voudrait plus rien
  -- dire. L'admin détecte le cas et le dit avant de supprimer.
  service_id  uuid          NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantite    numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite > 0),
  ordre       integer       NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (forfait_id, service_id)
);

CREATE INDEX IF NOT EXISTS service_forfait_items_forfait_idx
  ON service_forfait_items (forfait_id, ordre);

/**
 * Un forfait contient des prestations, jamais un autre forfait : autoriser
 * l'imbrication ouvrirait la porte aux cycles (A contient B contient A), donc
 * à un calcul de valeur cumulée qui ne terminerait pas.
 */
CREATE OR REPLACE FUNCTION caisse_forfait_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type text;
  v_child_type  text;
BEGIN
  IF NEW.forfait_id = NEW.service_id THEN
    RAISE EXCEPTION 'Un forfait ne peut pas se contenir lui-même.';
  END IF;

  SELECT type INTO v_parent_type FROM services WHERE id = NEW.forfait_id;
  IF v_parent_type IS DISTINCT FROM 'forfait' THEN
    RAISE EXCEPTION 'Seule une entrée de type « forfait » peut avoir une composition.';
  END IF;

  SELECT type INTO v_child_type FROM services WHERE id = NEW.service_id;
  IF v_child_type = 'forfait' THEN
    RAISE EXCEPTION 'Un forfait ne peut pas en contenir un autre : compose-le de prestations.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_forfait_items_guard ON service_forfait_items;
CREATE TRIGGER service_forfait_items_guard
  BEFORE INSERT OR UPDATE ON service_forfait_items
  FOR EACH ROW EXECUTE FUNCTION caisse_forfait_items_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Produits revendus & stock
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  nom              text          NOT NULL,
  marque           text,
  reference        text,
  description      text,
  -- Ce que coûte l'article au fournisseur. Tant que l'activité n'est pas
  -- assujettie à la TVA, elle ne récupère pas l'impôt préalable : c'est donc
  -- le montant TTC de la facture fournisseur. Le jour de l'assujettissement,
  -- saisir le prix HT — la marge se calcule contre un prix de vente HT.
  prix_achat_chf   numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_achat_chf >= 0),
  prix_vente_chf   numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_vente_chf >= 0),
  taux_tva_defaut  numeric(5,2)  NOT NULL DEFAULT 0
                                 CHECK (taux_tva_defaut >= 0 AND taux_tva_defaut <= 100),
  -- Jamais écrit à la main : maintenu par trigger depuis `stock_movements`.
  -- Le privilège UPDATE de cette colonne est retiré au rôle `authenticated`
  -- plus bas, pour que la règle ne repose pas sur la seule discipline du code.
  stock            numeric(10,2) NOT NULL DEFAULT 0,
  seuil_alerte     numeric(10,2) NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
  active           boolean       NOT NULL DEFAULT true,
  ordre            integer       NOT NULL DEFAULT 0,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_active_idx ON products (active, ordre);

/**
 * Journal des mouvements de stock — append-only, comme le journal des recettes.
 *
 * `quantite` est SIGNÉE : positive à l'entrée (réception, retour cliente,
 * inventaire à la hausse), négative à la sortie (vente, perte, inventaire à la
 * baisse). Un seul champ, donc aucun risque qu'un signe et un type se
 * contredisent.
 */
CREATE TABLE IF NOT EXISTS stock_movements (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id           uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type                 text          NOT NULL
                                     CHECK (type IN ('reception','vente','retour','inventaire','perte')),
  quantite             numeric(10,2) NOT NULL CHECK (quantite <> 0),
  -- Coût unitaire à la réception : garde la trace de l'évolution des tarifs
  -- fournisseur, indépendamment du `prix_achat_chf` courant de la fiche.
  prix_achat_unitaire  numeric(10,2),
  -- Vente ou annulation de vente. RESTRICT est sans effet en pratique : une
  -- transaction ne se supprime jamais (trigger d'immuabilité).
  transaction_id       uuid          REFERENCES transactions(id) ON DELETE RESTRICT,
  motif                text,
  created_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tx_idx      ON stock_movements (transaction_id);

-- Le stock courant est la somme des mouvements. On le matérialise sur la fiche
-- produit pour que l'écran de caisse l'affiche sans agrégat à chaque frappe.
CREATE OR REPLACE FUNCTION caisse_stock_apply()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantite,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_apply ON stock_movements;
CREATE TRIGGER stock_movements_apply
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION caisse_stock_apply();

-- Un mouvement passé ne se réécrit pas : sinon le stock affiché cesserait
-- d'être la somme du journal, et un écart d'inventaire redeviendrait
-- inexplicable — ce que ce journal existe précisément pour éviter.
CREATE OR REPLACE FUNCTION caisse_stock_movements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un mouvement de stock ne s''efface pas : corrige par un mouvement inverse (retour, perte ou inventaire). Un produit qui a déjà bougé ne se supprime donc pas non plus — désactive-le.';
  END IF;
  RAISE EXCEPTION 'Un mouvement de stock est définitif : enregistre un mouvement inverse (retour, perte ou inventaire) plutôt que de le modifier.';
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_guard ON stock_movements;
CREATE TRIGGER stock_movements_guard
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION caisse_stock_movements_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. La ligne de facture peut désormais porter un produit
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  -- Coût figé à la vente. C'est lui, et jamais `products.prix_achat_chf`, qui
  -- sert à calculer la marge d'une période révolue.
  ADD COLUMN IF NOT EXISTS prix_achat_unitaire numeric(10,2);

CREATE INDEX IF NOT EXISTS transaction_items_product_idx ON transaction_items (product_id);

-- Le guard d'immuabilité doit connaître les deux nouvelles colonnes : `product_id`
-- rejoint la liste des `ON DELETE SET NULL` tolérés, `prix_achat_unitaire` celle
-- des valeurs qui ne bougent plus.
CREATE OR REPLACE FUNCTION caisse_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être supprimé (CO art. 957a).';
  END IF;

  IF (
       (NEW.service_id   IS NULL AND OLD.service_id   IS NOT NULL)
    OR (NEW.gift_card_id IS NULL AND OLD.gift_card_id IS NOT NULL)
    OR (NEW.product_id   IS NULL AND OLD.product_id   IS NOT NULL)
     )
  AND NEW.transaction_id      IS NOT DISTINCT FROM OLD.transaction_id
  AND NEW.description         IS NOT DISTINCT FROM OLD.description
  AND NEW.prix_unitaire_ttc   IS NOT DISTINCT FROM OLD.prix_unitaire_ttc
  AND NEW.quantite            IS NOT DISTINCT FROM OLD.quantite
  AND NEW.taux_tva            IS NOT DISTINCT FROM OLD.taux_tva
  AND NEW.total_ttc           IS NOT DISTINCT FROM OLD.total_ttc
  AND NEW.prix_achat_unitaire IS NOT DISTINCT FROM OLD.prix_achat_unitaire
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être modifié (CO art. 957a).';
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Encaissement — même signature, le corps sait maintenant sortir du stock
--
-- `p_items` accepte une clé `product_id` en plus de `service_id`. Les deux
-- s'excluent en pratique (une ligne vend soit un soin, soit un article), mais
-- rien ne l'impose : le libellé et le prix restent la seule vérité de la ligne.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION caisse_create_transaction(
  p_client_id              uuid,
  p_client_label           text,
  p_mode_paiement          text,
  p_note                   text,
  p_items                  jsonb,
  p_gift_card_code         text    DEFAULT NULL,
  p_montant_bon            numeric DEFAULT 0,
  p_emissions              jsonb   DEFAULT NULL,
  p_corrige_transaction_id uuid    DEFAULT NULL
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee      integer;
  v_seq        integer;
  v_tx         transactions;
  v_item       jsonb;
  v_emission   jsonb;
  v_idx        integer := 0;
  v_label      text;
  v_ttc        numeric(10,2);
  v_ht         numeric(10,2);
  v_bon        numeric(10,2) := round(coalesce(p_montant_bon, 0), 2);
  v_card       gift_cards;
  v_card_id    uuid := NULL;
  v_today      date;
  v_new_card   gift_cards;
  v_gseq       integer;
  v_product_id uuid;
  v_cout       numeric(10,2);
  -- `numeric` et non `numeric(10,2)` : le total de l'en-tête est calculé depuis
  -- le JSON brut, arrondir la quantité ici pourrait le désaccorder d'un centime
  -- avec la somme des lignes.
  v_qte        numeric;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;

  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
  FROM jsonb_array_elements(p_items) it;

  -- ── Bon présenté en paiement ──────────────────────────────────────────────
  IF p_gift_card_code IS NOT NULL AND btrim(p_gift_card_code) <> '' THEN
    SELECT * INTO v_card FROM gift_cards
    WHERE upper(code) = upper(btrim(p_gift_card_code))
    FOR UPDATE;

    IF v_card.id IS NULL THEN
      RAISE EXCEPTION 'Bon cadeau introuvable : %.', p_gift_card_code;
    END IF;
    IF v_card.status = 'annule' THEN
      RAISE EXCEPTION 'Le bon % a été annulé.', v_card.code;
    END IF;
    IF v_card.expire_le < v_today THEN
      RAISE EXCEPTION 'Le bon % a expiré le %.', v_card.code, to_char(v_card.expire_le, 'DD.MM.YYYY');
    END IF;
    IF v_bon <= 0 THEN
      RAISE EXCEPTION 'Le montant prélevé sur le bon % doit être supérieur à zéro.', v_card.code;
    END IF;
    IF v_bon > v_card.montant_restant THEN
      RAISE EXCEPTION 'Le bon % ne dispose que de CHF % (demandé : CHF %).',
        v_card.code, to_char(v_card.montant_restant, 'FM999999990.00'), to_char(v_bon, 'FM999999990.00');
    END IF;
    IF v_bon > v_ttc THEN
      RAISE EXCEPTION 'Le montant réglé par bon (CHF %) dépasse le total de la facture (CHF %).',
        to_char(v_bon, 'FM999999990.00'), to_char(v_ttc, 'FM999999990.00');
    END IF;

    v_card_id := v_card.id;
  ELSE
    v_bon := 0;
  END IF;

  v_seq := caisse_next_invoice_seq(v_annee);

  v_label := NULLIF(btrim(coalesce(p_client_label, '')), '');
  IF v_label IS NULL AND p_client_id IS NOT NULL THEN
    SELECT btrim(prenom || ' ' || nom) INTO v_label FROM clients WHERE id = p_client_id;
  END IF;

  INSERT INTO transactions (
    annee, number_seq, client_id, client_label, mode_paiement, note,
    total_ht, total_tva, total_ttc, gift_card_id, montant_bon, corrige_transaction_id
  )
  VALUES (
    v_annee, v_seq, p_client_id,
    coalesce(v_label, 'Client de passage'),
    coalesce(p_mode_paiement, 'especes'),
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht, v_ttc - v_ht, v_ttc,
    v_card_id, v_bon, p_corrige_transaction_id
  )
  RETURNING * INTO v_tx;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qte        := coalesce((v_item->>'quantite')::numeric, 1);
    v_cout       := NULL;

    -- Coût d'achat recopié depuis la fiche produit : à partir de maintenant, la
    -- marge de cette vente est figée. Modifier le tarif fournisseur demain ne
    -- réécrira pas la marge d'aujourd'hui.
    IF v_product_id IS NOT NULL THEN
      SELECT prix_achat_chf INTO v_cout FROM products WHERE id = v_product_id;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, service_id, product_id, description, prix_unitaire_ttc,
      quantite, taux_tva, total_ttc, prix_achat_unitaire, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      v_product_id,
      coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation'),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      v_qte,
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * v_qte, 2),
      v_cout,
      v_idx
    );

    -- Sortie de stock. Le stock peut passer sous zéro et c'est délibéré :
    -- refuser la vente parce que le compteur dit 0 bloquerait une cliente qui
    -- tient le produit en main. L'écran de caisse affiche l'alerte, l'inventaire
    -- rattrape l'écart — mais la vente, elle, doit toujours pouvoir se faire.
    IF v_product_id IS NOT NULL THEN
      INSERT INTO stock_movements (product_id, type, quantite, transaction_id, motif)
      VALUES (v_product_id, 'vente', -v_qte, v_tx.id, 'Vente ' || v_tx.numero);
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- ── Décompte du bon utilisé ───────────────────────────────────────────────
  IF v_card_id IS NOT NULL THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant - v_bon,
        status = CASE WHEN montant_restant - v_bon <= 0 THEN 'epuise' ELSE 'active' END,
        updated_at = now()
    WHERE id = v_card_id;
  END IF;

  -- ── Émission des bons vendus ──────────────────────────────────────────────
  IF p_emissions IS NOT NULL AND jsonb_typeof(p_emissions) = 'array' THEN
    FOR v_emission IN SELECT * FROM jsonb_array_elements(p_emissions)
    LOOP
      v_gseq := caisse_next_gift_card_seq(v_annee);

      INSERT INTO gift_cards (
        annee, number_seq, libelle, montant_initial, montant_restant,
        beneficiaire, acheteur_client_id, acheteur_label, sale_transaction_id, expire_le
      )
      VALUES (
        v_annee, v_gseq,
        coalesce(NULLIF(btrim(coalesce(v_emission->>'libelle', '')), ''), 'Bon cadeau'),
        round((v_emission->>'montant')::numeric, 2),
        round((v_emission->>'montant')::numeric, 2),
        NULLIF(btrim(coalesce(v_emission->>'beneficiaire', '')), ''),
        p_client_id,
        coalesce(v_label, 'Client de passage'),
        v_tx.id,
        v_today + (coalesce((v_emission->>'validite_mois')::integer, 60) || ' months')::interval
      )
      RETURNING * INTO v_new_card;

      UPDATE transaction_items
      SET gift_card_id = v_new_card.id
      WHERE transaction_id = v_tx.id
        AND ordre = (v_emission->>'ordre')::integer;
    END LOOP;
  END IF;

  RETURN v_tx;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Annulation — la marchandise revient en rayon
--
-- Par un mouvement INVERSE, jamais en effaçant la sortie : le journal de stock
-- doit raconter ce qui s'est passé, pas ce qu'on aurait voulu.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx     transactions;
  v_entame record;
  v_line   record;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_id FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable.';
  END IF;
  IF v_tx.status = 'annulee' THEN
    RAISE EXCEPTION 'La facture % est déjà annulée.', v_tx.numero;
  END IF;

  SELECT code, montant_initial, montant_restant INTO v_entame
  FROM gift_cards
  WHERE sale_transaction_id = v_tx.id
    AND status <> 'annule'
    AND montant_restant < montant_initial
  LIMIT 1;

  IF v_entame.code IS NOT NULL THEN
    RAISE EXCEPTION 'Le bon % vendu par cette facture a déjà été utilisé : la vente ne peut plus être annulée.', v_entame.code;
  END IF;

  UPDATE gift_cards
  SET status = 'annule', updated_at = now()
  WHERE sale_transaction_id = v_tx.id AND status <> 'annule';

  IF v_tx.gift_card_id IS NOT NULL AND v_tx.montant_bon > 0 THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant + v_tx.montant_bon,
        status = CASE WHEN status = 'epuise' THEN 'active' ELSE status END,
        updated_at = now()
    WHERE id = v_tx.gift_card_id;
  END IF;

  -- Retour en stock de chaque article vendu par cette facture.
  FOR v_line IN
    SELECT product_id, quantite FROM transaction_items
    WHERE transaction_id = v_tx.id AND product_id IS NOT NULL
  LOOP
    INSERT INTO stock_movements (product_id, type, quantite, transaction_id, motif)
    VALUES (v_line.product_id, 'retour', v_line.quantite, v_tx.id,
            'Annulation ' || v_tx.numero);
  END LOOP;

  UPDATE transactions
  SET status        = 'annulee',
      cancelled_at  = now(),
      cancel_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at    = now()
  WHERE id = p_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Mouvements de stock saisis à la main
--
-- Le navigateur n'a aucun privilège d'écriture sur `stock_movements` : il passe
-- par ces deux fonctions, exactement comme il passe par `caisse_create_transaction`
-- pour écrire un montant. Un mouvement `vente` ne peut donc naître que d'une
-- vraie vente, et pas d'un appel forgé depuis la console du navigateur.
--
-- `p_quantite` est une quantité POSITIVE : c'est le type qui décide du sens.
-- Demander un signe à l'utilisateur, c'est se garantir une perte saisie en +.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION caisse_stock_movement(
  p_product_id          uuid,
  p_type                text,
  p_quantite            numeric,
  p_prix_achat_unitaire numeric DEFAULT NULL,
  p_motif               text    DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
  v_signe   integer;
BEGIN
  IF p_type NOT IN ('reception', 'retour', 'perte') THEN
    RAISE EXCEPTION 'Type de mouvement invalide : %. Une sortie de vente naît de la caisse, un écart d''inventaire de caisse_stock_inventaire.', p_type;
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être un nombre positif.';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  v_signe := CASE WHEN p_type = 'perte' THEN -1 ELSE 1 END;

  INSERT INTO stock_movements (product_id, type, quantite, prix_achat_unitaire, motif)
  VALUES (
    p_product_id,
    p_type,
    v_signe * round(p_quantite, 2),
    CASE WHEN p_type = 'reception' THEN round(p_prix_achat_unitaire, 2) ELSE NULL END,
    NULLIF(btrim(coalesce(p_motif, '')), '')
  );

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  RETURN v_product;
END;
$$;

/**
 * Inventaire : on saisit ce qu'on a COMPTÉ dans le tiroir, la fonction en
 * déduit l'écart et l'enregistre comme mouvement. Le compteur n'est jamais
 * écrasé — c'est l'écart qui est archivé, avec son motif, et c'est lui qui
 * s'explique devant la fiducie.
 */
CREATE OR REPLACE FUNCTION caisse_stock_inventaire(
  p_product_id uuid,
  p_stock_reel numeric,
  p_motif      text DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
  v_ecart   numeric(10,2);
BEGIN
  IF p_stock_reel IS NULL OR p_stock_reel < 0 THEN
    RAISE EXCEPTION 'Le stock compté ne peut pas être négatif.';
  END IF;

  -- FOR UPDATE : entre la lecture du stock et l'écriture de l'écart, aucune
  -- vente ne doit se glisser — elle serait annulée par la correction.
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  v_ecart := round(p_stock_reel, 2) - v_product.stock;

  IF v_ecart = 0 THEN
    RETURN v_product;  -- rien à corriger : pas de mouvement fantôme au journal
  END IF;

  INSERT INTO stock_movements (product_id, type, quantite, motif)
  VALUES (
    p_product_id, 'inventaire', v_ecart,
    coalesce(
      NULLIF(btrim(coalesce(p_motif, '')), ''),
      'Inventaire — stock compté : ' || to_char(round(p_stock_reel, 2), 'FM999999990.##')
    )
  );

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  RETURN v_product;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. RLS & privilèges — module interne, rien n'est exposé au rôle `anon`
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE service_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_forfait_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements       ENABLE ROW LEVEL SECURITY;

-- `products` est un nom générique : on filtre sur le schéma `public`, sinon une
-- table homonyme d'un autre schéma verrait ses policies supprimées.
DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['service_categories','service_forfait_items','products','stock_movements'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "service_categories_all_admin"    ON service_categories    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_forfait_items_all_admin" ON service_forfait_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_all_admin"              ON products              FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Lecture seule : le journal de stock s'écrit exclusivement par les fonctions.
CREATE POLICY "stock_movements_select_admin"    ON stock_movements       FOR SELECT TO authenticated USING (true);

REVOKE ALL ON service_categories    FROM anon;
REVOKE ALL ON service_forfait_items FROM anon;
REVOKE ALL ON products              FROM anon, authenticated;
REVOKE ALL ON stock_movements       FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON service_categories    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_forfait_items TO authenticated;
GRANT SELECT                         ON stock_movements       TO authenticated;

-- Privilèges COLONNE par COLONNE sur `products` : `stock` en est volontairement
-- absent. La règle « le stock se déduit du journal, il ne se saisit pas » cesse
-- ainsi de reposer sur la discipline du code applicatif — même un appel direct
-- à PostgREST se ferait refuser par Postgres.
GRANT SELECT, DELETE ON products TO authenticated;
GRANT INSERT (nom, marque, reference, description, prix_achat_chf, prix_vente_chf,
              taux_tva_defaut, seuil_alerte, active, ordre, updated_at)
  ON products TO authenticated;
GRANT UPDATE (nom, marque, reference, description, prix_achat_chf, prix_vente_chf,
              taux_tva_defaut, seuil_alerte, active, ordre, updated_at)
  ON products TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_stock_inventaire(uuid, numeric, text)              FROM public;
GRANT  EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION caisse_stock_inventaire(uuid, numeric, text)              TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260803_crm_clients_promotions.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM : fiche cliente enrichie, journal de suivi, promotions e-mail & WhatsApp.
--
-- À appliquer APRÈS `20260802_caisse_categories_forfaits_stock.sql`.
--
-- ⚠️ OBSOLÈTE EN PARTIE — `20260804_retrait_donnees_sante.sql` supprime ensuite
-- `clients.allergies` et la table `client_notes` créées ici : l'exploitante a
-- décidé de ne conserver aucune donnée de santé. Ce fichier n'est pas réécrit
-- parce qu'une migration déjà appliquée quelque part ne se modifie plus — elle
-- cesserait de décrire ce que la base a réellement vécu. Le code applicatif ne
-- lit plus ni l'une ni l'autre.
--
-- ┌─ LA RÈGLE QUI GOUVERNE LES PROMOTIONS ─────────────────────────────────┐
-- │ Encaisser une cliente n'est PAS un consentement publicitaire.          │
-- │                                                                        │
-- │ La LCD (art. 3 al. 1 let. o) interdit la publicité de masse par        │
-- │ e-mail ou message sans accord préalable, avec identification correcte  │
-- │ de l'expéditeur et refus gratuit et facile. Une fiche créée à la       │
-- │ caisse ne vaut donc pas opt-in : le consentement est stocké à part,    │
-- │ par canal (`consent_email`, `consent_whatsapp`), horodaté et sourcé.   │
-- │                                                                        │
-- │ Aucune requête d'audience de ce module ne doit ignorer ces colonnes.   │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Les allergies et le journal de suivi touchent à la santé : ce sont des
-- données personnelles sensibles au sens de la LPD révisée. Comme le reste du
-- module caisse, rien n'est exposé au rôle `anon`, et le privilège lui-même est
-- retiré — pas seulement la policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Fiche cliente enrichie
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_naissance   date,
  -- Champ à part, jamais noyé dans les notes : c'est la seule information de
  -- la fiche qui peut faire mal si on l'oublie avant un soin.
  ADD COLUMN IF NOT EXISTS allergies        text,
  ADD COLUMN IF NOT EXISTS consent_email    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_whatsapp boolean NOT NULL DEFAULT false,
  -- Quand et comment l'accord a été donné. Sans ces deux colonnes, un
  -- consentement est indéfendable le jour où quelqu'un le conteste.
  ADD COLUMN IF NOT EXISTS consent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source   text;

-- Segment « anniversaires du mois » : `extract` est immutable sur une date,
-- l'index est donc utilisable.
CREATE INDEX IF NOT EXISTS clients_anniversaire_idx
  ON clients ((EXTRACT(MONTH FROM date_naissance)))
  WHERE date_naissance IS NOT NULL;

-- Rapprochement avec les abonnés du site, et audiences e-mail dédoublonnées.
CREATE INDEX IF NOT EXISTS clients_email_lower_idx
  ON clients (lower(email))
  WHERE email IS NOT NULL;

/**
 * Retirer un consentement doit toujours effacer sa date : sinon une fiche
 * garderait la trace d'un accord qu'elle n'a plus, et le prochain audit lirait
 * un opt-in là où il n'y en a pas. À l'inverse, accorder un consentement sans
 * date l'horodate automatiquement — on ne peut pas oublier de le faire.
 */
CREATE OR REPLACE FUNCTION clients_consent_stamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.consent_email OR NEW.consent_whatsapp THEN
    IF NEW.consent_at IS NULL
    OR (TG_OP = 'UPDATE' AND NOT (OLD.consent_email OR OLD.consent_whatsapp))
    THEN
      NEW.consent_at := now();
    END IF;
  ELSE
    NEW.consent_at     := NULL;
    NEW.consent_source := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_consent_stamp ON clients;
CREATE TRIGGER clients_consent_stamp
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION clients_consent_stamp();

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Journal de suivi — ce que la facture ne dit pas
--
-- La facture sait quel soin, quand, combien. Elle ne sait pas que la peau a
-- rougi, qu'il faut baisser l'intensité, ni quel produit a été utilisé en
-- cabine. C'est ce carnet qui fait la différence entre un fichier clients et
-- un CRM d'institut.
--
-- Contrairement aux écritures de caisse, ces notes se corrigent et se
-- suppriment : ce ne sont pas des pièces comptables, et une observation fausse
-- sur la peau d'une cliente doit pouvoir disparaître.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS client_notes (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- Visite à laquelle la note se rattache, quand elle en a une. SET NULL et
  -- non CASCADE : annuler une facture ne doit pas effacer l'observation de
  -- soin qui l'accompagnait.
  transaction_id uuid        REFERENCES transactions(id) ON DELETE SET NULL,
  date_soin      date        NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Zurich')::date,
  contenu        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, date_soin DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Statistiques par cliente — dernière visite, fréquence, encaissé
--
-- `security_invoker = true` : sans cette option une vue s'exécute avec les
-- droits de son propriétaire et court-circuiterait la RLS des tables
-- sous-jacentes. Ici elle doit au contraire hériter des droits de l'appelant.
--
-- Le cumul applique la règle du module — `total_ttc - montant_bon` — et jamais
-- la somme brute des TTC : la part réglée par bon a été encaissée le jour de
-- la vente du bon, la recompter doublerait ce qu'a rapporté la cliente.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW client_stats WITH (security_invoker = true) AS
SELECT
  c.id                                                              AS client_id,
  count(t.id)                                                       AS nb_visites,
  max(t.created_at)                                                 AS derniere_visite,
  min(t.created_at)                                                 AS premiere_visite,
  coalesce(sum(t.total_ttc - coalesce(t.montant_bon, 0)), 0)::numeric(10,2) AS total_encaisse
FROM clients c
LEFT JOIN transactions t
  ON t.client_id = c.id AND t.status = 'payee'
GROUP BY c.id;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Promotions
--
-- Une promotion porte DEUX rédactions : l'e-mail (HTML, avec objet) et le
-- message WhatsApp (texte brut, court). Ce ne sont pas deux rendus du même
-- texte — on n'écrit pas à quelqu'un sur WhatsApp comme dans un e-mail, et
-- vouloir dériver l'un de l'autre produit toujours du mauvais des deux.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS promotions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom                text        NOT NULL,
  canal              text        NOT NULL DEFAULT 'email'
                                 CHECK (canal IN ('email','whatsapp','les_deux')),
  -- Clé d'un segment prédéfini (`toutes`, `anniversaires`, `inactives`,
  -- `fideles`, `abonnes`), et ses paramètres éventuels — par exemple
  -- {"mois": 6} pour « inactives depuis 6 mois ».
  segment            text        NOT NULL DEFAULT 'toutes',
  segment_params     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  objet              text,
  message_email      text,
  message_whatsapp   text,
  status             text        NOT NULL DEFAULT 'brouillon'
                                 CHECK (status IN ('brouillon','en_cours','envoyee')),
  sent_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_created_idx ON promotions (created_at DESC);

/**
 * Qui a reçu quoi, par quel canal.
 *
 * La contrainte d'unicité est le cœur de cette table : c'est elle qui empêche
 * qu'une cliente reçoive deux fois la même promotion. Indispensable côté
 * WhatsApp, où l'envoi se fait à la main, un contact après l'autre, et où l'on
 * perd le fil dès la dixième — mais tout aussi utile pour reprendre un envoi
 * e-mail interrompu sans re-solliciter ceux qui l'ont déjà reçu.
 *
 * `destinataire` fige l'adresse ou le numéro réellement utilisé : la fiche peut
 * changer ensuite, la trace de l'envoi ne doit pas bouger.
 */
CREATE TABLE IF NOT EXISTS promotion_sends (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id  uuid        NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  client_id     uuid        REFERENCES clients(id) ON DELETE SET NULL,
  subscriber_id uuid        REFERENCES subscribers(id) ON DELETE SET NULL,
  canal         text        NOT NULL CHECK (canal IN ('email','whatsapp')),
  destinataire  text        NOT NULL,
  status        text        NOT NULL DEFAULT 'envoye'
                            CHECK (status IN ('envoye','echec')),
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, canal, destinataire)
);

CREATE INDEX IF NOT EXISTS promotion_sends_promo_idx  ON promotion_sends (promotion_id, canal);
CREATE INDEX IF NOT EXISTS promotion_sends_client_idx ON promotion_sends (client_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. RLS & privilèges
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE client_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_sends  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['client_notes','promotions','promotion_sends'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "client_notes_all_admin"    ON client_notes    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotions_all_admin"      ON promotions      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotion_sends_all_admin" ON promotion_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON client_notes    FROM anon;
REVOKE ALL ON promotions      FROM anon;
REVOKE ALL ON promotion_sends FROM anon;
REVOKE ALL ON client_stats    FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON client_notes    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotions      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotion_sends TO authenticated;
GRANT SELECT                         ON client_stats    TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260804_retrait_donnees_sante.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Retrait des données de santé du fichier clientes.
--
-- Décision de l'exploitante : ne pas conserver de données de santé du tout.
-- Sont donc supprimés le champ `clients.allergies` et le journal de suivi
-- `client_notes` (observations après soin : réaction de la peau, réglages,
-- produits utilisés en cabine), introduits par `20260803_crm_clients_promotions.sql`.
--
-- Ce fichier est écrit pour être rejouable et sans effet si la migration
-- précédente n'a jamais été appliquée : `IF EXISTS` partout. On ne réécrit pas
-- `20260803` — une migration déjà appliquée quelque part ne se modifie plus,
-- sinon le fichier cesse de décrire ce que la base a réellement vécu.
--
-- ⚠️ DESTRUCTIF. `DROP COLUMN` et `DROP TABLE` effacent définitivement le
-- contenu. C'est l'objet même de la migration, mais il n'y a pas de retour :
-- une sauvegarde avant application ne coûte rien.
--
-- Ce qui RESTE au fichier clientes, et qui n'est pas de la donnée de santé :
-- coordonnées, date de naissance, notes générales (préférences, habitudes),
-- accords publicitaires, et l'historique des passages reconstruit depuis les
-- factures — lequel est une donnée comptable, conservée 10 ans par obligation
-- légale (CO art. 958f) et hors de portée de ce nettoyage.
-- ─────────────────────────────────────────────────────────────────────────────

-- Journal de suivi : la table entière, avec ses lignes.
DROP TABLE IF EXISTS client_notes;

-- Allergies et contre-indications.
ALTER TABLE clients DROP COLUMN IF EXISTS allergies;


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260819_agents.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Module Agents IA — tables `agents`, `agent_documents`, `agent_conversations`,
-- `agent_messages`.
--
-- Un agent est un assistant public branché sur le site : il répond aux
-- visiteurs à partir d'une base de connaissances constituée du contenu réel du
-- site (pages, articles) et de textes ajoutés à la main, puis collecte les
-- informations qualifiantes définies par l'exploitant.
--
-- Les conversations sont conservées pour deux raisons : relire ce que l'agent
-- a réellement répondu (obligation de transparence), et transformer un échange
-- en fiche de contact exploitable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  -- Détermine le gabarit d'instructions et les champs collectés par défaut.
  role          text        NOT NULL DEFAULT 'qualification'
                            CHECK (role IN ('qualification', 'devis', 'rendez_vous', 'support')),
  -- Consigne système. Complétée à l'exécution par la base de connaissances.
  system_prompt text        NOT NULL DEFAULT '',
  greeting      text        NOT NULL DEFAULT 'Bonjour ! Comment puis-je vous aider ?',
  -- Modèle et température repris de /admin/settings si laissés vides.
  model         text,
  temperature   numeric(3,2) NOT NULL DEFAULT 0.30,
  -- Garde-fou : au-delà, l'agent invite à laisser ses coordonnées plutôt que
  -- de poursuivre indéfiniment (et de consommer du budget).
  max_turns     integer     NOT NULL DEFAULT 12,
  -- Champs à récupérer au fil de l'échange :
  -- [{ key: 'email', label: 'E-mail', required: true }]
  collect_fields jsonb      NOT NULL DEFAULT '[]'::jsonb,
  enabled       boolean     NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_documents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  -- 'page' et 'article' sont réindexés depuis le contenu du site ; 'texte' est
  -- saisi à la main (tarifs, zone d'intervention, conditions).
  source_type text        NOT NULL DEFAULT 'texte'
                          CHECK (source_type IN ('page', 'article', 'texte')),
  source_ref  text,
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (agent_id, source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS agent_documents_agent_idx ON agent_documents (agent_id);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  -- Identifiant anonyme stocké côté navigateur : permet de reprendre un
  -- échange sans jamais créer de compte visiteur.
  visitor_ref text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'qualified', 'closed')),
  summary     text,
  -- Valeurs collectées, indexées par la clé déclarée dans collect_fields.
  collected   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_conversations_agent_idx
  ON agent_conversations (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text        NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_conversation_idx
  ON agent_messages (conversation_id, created_at);

-- ── Sécurité au niveau des lignes ───────────────────────────────────────────
-- Les agents sont lisibles publiquement (le widget doit connaître le nom et le
-- message d'accueil) mais modifiables uniquement par l'admin. Les conversations
-- ne sont jamais lisibles publiquement : elles transitent par une route serveur
-- qui utilise la clé de service.

ALTER TABLE agents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents','agent_documents','agent_conversations','agent_messages']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "public_read_enabled" ON agents
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

CREATE POLICY "admin_all" ON agents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- Source : 20260819_automations.sql
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Module Automatisations — tables `automations` et `automation_runs`.
--
-- Une automatisation relie un déclencheur (horaire, événement interne, ou
-- lancement manuel) à une action (appel d'un webhook, envoi d'e-mail,
-- génération d'un contenu, écriture dans un outil tiers).
--
-- Chaque exécution est journalisée dans `automation_runs` : sans trace, une
-- automatisation silencieuse qui échoue est indétectable, ce qui est le
-- reproche le plus fréquent fait à ce genre d'outil.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automations (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text        NOT NULL,
  description    text,

  -- 'schedule' : expression cron évaluée par /api/cron
  -- 'event'    : déclenché par le code applicatif (lead.created, sale.created…)
  -- 'manual'   : uniquement depuis le bouton « Exécuter » de l'admin
  trigger_type   text        NOT NULL DEFAULT 'manual'
                             CHECK (trigger_type IN ('schedule', 'event', 'manual')),
  -- { cron: '0 6 * * 1' } | { event: 'lead.created' }
  trigger_config jsonb       NOT NULL DEFAULT '{}'::jsonb,

  action_type    text        NOT NULL
                             CHECK (action_type IN (
                               'webhook', 'email', 'generate_article',
                               'generate_social', 'keyword_scan', 'newsletter_digest'
                             )),
  -- Dépend de action_type. Pour 'webhook' : { url, method, headers, body }.
  action_config  jsonb       NOT NULL DEFAULT '{}'::jsonb,

  enabled        boolean     NOT NULL DEFAULT true,
  last_run_at    timestamptz,
  last_status    text        CHECK (last_status IN ('success', 'error', 'running')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_trigger_idx
  ON automations (trigger_type, enabled);

CREATE TABLE IF NOT EXISTS automation_runs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'running'
                            CHECK (status IN ('success', 'error', 'running')),
  -- Ce qui a déclenché l'exécution : 'schedule', 'manual', ou le nom de
  -- l'événement applicatif.
  triggered_by  text        NOT NULL DEFAULT 'manual',
  detail        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error         text,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS automation_runs_automation_idx
  ON automation_runs (automation_id, started_at DESC);

-- ── Sécurité au niveau des lignes ───────────────────────────────────────────
-- Rien n'est lisible publiquement : une automatisation contient des URL de
-- webhook et des jetons.

ALTER TABLE automations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['automations','automation_runs']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "admin_all" ON automations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON automation_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

