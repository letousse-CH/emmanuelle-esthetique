-- Ajout de la colonne welcome_sent_at sur la table subscribers
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ DEFAULT NULL;
