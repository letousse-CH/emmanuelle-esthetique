-- Ajout de la colonne quiz_score sur la table subscribers.
-- Permet de reconstruire un lien vers le résultat exact (score + profil) dans
-- les emails de la séquence post-quiz, via /decodeur?score=X&profil=Y.
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS quiz_score INTEGER DEFAULT NULL;
