-- Ajouter la colonne category à la table articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Mettre à jour les articles existants selon leur slug (détection par mots-clés)
UPDATE articles SET category = 'Régulation nerveuse'
  WHERE slug ILIKE '%corps-tremble%' OR slug ILIKE '%systeme-nerveux%' OR slug ILIKE '%trauma%';

UPDATE articles SET category = 'Deuil & perte'
  WHERE slug ILIKE '%deuil%' OR slug ILIKE '%perte%' OR slug ILIKE '%deuil-de-soi%';

UPDATE articles SET category = 'Connaissance de soi'
  WHERE slug ILIKE '%developpement-personnel%' OR slug ILIKE '%connaissance%' OR slug ILIKE '%architecture%';

UPDATE articles SET category = 'Analyse des rêves'
  WHERE slug ILIKE '%reve%' OR slug ILIKE '%rêve%' OR slug ILIKE '%songe%';

UPDATE articles SET category = 'Burn-out spirituel'
  WHERE slug ILIKE '%burn%' OR slug ILIKE '%burnout%' OR slug ILIKE '%vide%' OR slug ILIKE '%sens%';

UPDATE articles SET category = 'Ombres & Jung'
  WHERE slug ILIKE '%ombre%' OR slug ILIKE '%jung%' OR slug ILIKE '%archetype%';

-- Fallback : articles sans catégorie détectée
UPDATE articles SET category = 'Spiritualité pratique'
  WHERE category IS NULL;
