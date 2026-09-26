-- Page builder v2 (sections > colonnes > blocs)
-- Le nouveau contenu vit dans `content`, à côté de l'ancien `sections` qui
-- reste intact : le site en production (code Studio) continue de lire
-- `sections`, le nouveau code lit `content` quand content_version = 2.
-- Retour arrière : UPDATE dynamic_pages SET content_version = 1;

ALTER TABLE dynamic_pages ADD COLUMN IF NOT EXISTS content JSONB;
ALTER TABLE dynamic_pages ADD COLUMN IF NOT EXISTS content_version INT NOT NULL DEFAULT 1;

NOTIFY pgrst, 'reload schema';
