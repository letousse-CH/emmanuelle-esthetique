-- ── analytics_events : clics et formulaires envoyés ─────────────────────────
-- Lue par /admin/analytics (`fetchAnalyticsSummary`, avec la clé de service),
-- écrite par `trackAnalyticsEvent` : formulaire de contact (/api/contact) et
-- /api/analytics/track. Le code s'en servait sans qu'aucune migration ne la
-- crée : faute de table, les chiffres « clics », « formulaires » et
-- « conversion » du tableau de bord restaient à 0.
-- Sans cookie ni donnée personnelle (type d'événement, page, détails libres).

CREATE TABLE IF NOT EXISTS analytics_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text        NOT NULL CHECK (event_type IN ('page_view', 'cta_click', 'form_submit')),
  page_slug  text        NOT NULL DEFAULT 'home',
  page_title text,
  metadata   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_public_insert" ON analytics_events;
CREATE POLICY "analytics_events_public_insert" ON analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "analytics_events_admin_select" ON analytics_events;
CREATE POLICY "analytics_events_admin_select" ON analytics_events
  FOR SELECT TO authenticated
  USING (true);
