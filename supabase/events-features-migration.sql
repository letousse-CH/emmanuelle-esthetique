-- ─────────────────────────────────────────────────────────────
-- Migration : visio, récurrence, options événement
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_online            boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS visio_url            text,
  ADD COLUMN IF NOT EXISTS is_recurring         boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_sessions  integer,
  ADD COLUMN IF NOT EXISTS recurrence_day       text,
  ADD COLUMN IF NOT EXISTS recurrence_description text;
