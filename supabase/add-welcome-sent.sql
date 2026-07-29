-- Ajout de la colonne welcome_sent sur la table subscribers
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT FALSE;

-- Permettre à anon de mettre welcome_sent=true (envoi auto depuis le frontend)
DROP POLICY IF EXISTS "public_unsubscribe" ON subscribers;

CREATE POLICY "public_unsubscribe" ON subscribers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (
    active = false
    OR (welcome_sent = true AND active = true)
  );
