-- Migration : remplace la colonne date unique par date_start + date_end
-- À exécuter dans Supabase SQL Editor

ALTER TABLE events
  RENAME COLUMN date TO date_start;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS date_end date;
