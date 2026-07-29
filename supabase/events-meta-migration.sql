-- ─────────────────────────────────────────────────────────────
-- Migration : balises SEO générées par IA sur les événements
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS meta_title       text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords    text;
