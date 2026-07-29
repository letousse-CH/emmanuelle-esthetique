-- ─────────────────────────────────────────────────────────────
-- Migration : colonnes de paiement fractionné sur event_registrations
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS installment_amount_chf  integer,
  ADD COLUMN IF NOT EXISTS installment_2_url        text,
  ADD COLUMN IF NOT EXISTS installment_2_date       date,
  ADD COLUMN IF NOT EXISTS installment_2_status     text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS installment_3_url        text,
  ADD COLUMN IF NOT EXISTS installment_3_date       date,
  ADD COLUMN IF NOT EXISTS installment_3_status     text DEFAULT 'pending';
