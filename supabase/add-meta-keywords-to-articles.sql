-- Ajout de la colonne meta_keywords pour des mots-clés SEO spécifiques par article
-- À exécuter dans Supabase > SQL Editor
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT DEFAULT NULL;

-- Exemple de remplissage pour l'article prioritaire (facultatif) :
-- UPDATE articles
--   SET meta_keywords = 'rêve éveillé libre, gens qui ne ressentent rien, alexithymie, empathie cognitive, thérapeute inconscient'
--   WHERE slug = 'les-gens-qui-ne-ressentent-rien';
