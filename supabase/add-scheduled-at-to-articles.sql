-- Ajout de la colonne scheduled_at pour la programmation des articles
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Index pour accélérer la requête de la fonction de publication automatique
CREATE INDEX IF NOT EXISTS articles_scheduled_idx
  ON articles (scheduled_at)
  WHERE published = false AND scheduled_at IS NOT NULL;
