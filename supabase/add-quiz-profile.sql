-- Ajout de la colonne quiz_profile sur la table subscribers
-- Stocke le tag de profil obtenu au "Décodeur de Relations" (ex. profil-terrain-stable,
-- profil-signaux-faibles, profil-emprise-en-construction, profil-sous-emprise-totale)
-- pour permettre un segment futur des séquences email par profil.
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS quiz_profile TEXT DEFAULT NULL;
