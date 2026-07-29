-- Ajout de la colonne quiz_completed_at sur la table subscribers.
-- Sert d'ancre temporelle pour la séquence email post-quiz (cf. quiz-sequence.sql) :
-- on veut compter les délais depuis la réception du profil, pas depuis la date
-- d'inscription à la newsletter (qui peut être bien antérieure ou inexistante).
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS quiz_completed_at TIMESTAMPTZ DEFAULT NULL;
