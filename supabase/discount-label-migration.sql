-- Ajout du champ texte de ristourne sur les événements
-- À exécuter dans l'éditeur SQL Supabase

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS discount_label text DEFAULT NULL;
