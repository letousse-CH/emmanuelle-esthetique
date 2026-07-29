-- Corrige un cas bloqué : un email déjà inscrit à la newsletter qui refait
-- Le Décodeur de Relations ne recevait ni son tag de profil à jour, ni la
-- séquence email (l'INSERT échoue en doublon, et l'ancienne policy
-- "public_unsubscribe" n'autorisait un UPDATE anonyme que si le résultat
-- final avait active = false — bloquant donc toute mise à jour de
-- quiz_profile / quiz_score / quiz_completed_at sur un abonné actif).
--
-- Les policies RLS permissives s'additionnent en OR : impossible de garder
-- "active seulement false→true interdit" tout en ouvrant les autres colonnes
-- via une simple policy. On ouvre donc l'UPDATE anonyme largement, et on
-- déplace la protection anti-réactivation dans un trigger, qui s'applique
-- quel que soit le chemin emprunté.

DROP POLICY IF EXISTS "public_unsubscribe" ON subscribers;

CREATE POLICY "public_update" ON subscribers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION prevent_anon_resubscribe()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'anon' AND OLD.active = false AND NEW.active = true THEN
    NEW.active := false; -- une clé anonyme ne peut jamais réactiver un désinscrit
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_anon_resubscribe ON subscribers;
CREATE TRIGGER trg_prevent_anon_resubscribe
  BEFORE UPDATE ON subscribers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_anon_resubscribe();
