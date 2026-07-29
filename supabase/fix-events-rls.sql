-- ─────────────────────────────────────────────────────────────────────────────
-- Correction : RLS policies manquantes sur la table events
-- À exécuter dans Supabase > SQL Editor si les événements n'apparaissent pas
-- ─────────────────────────────────────────────────────────────────────────────

-- Supprime les policies existantes pour repartir proprement
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON events', pol.policyname);
  END LOOP;
END $$;

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'event_registrations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON event_registrations', pol.policyname);
  END LOOP;
END $$;

-- Lecture publique : événements publiés uniquement (anon = visiteurs non connectés)
CREATE POLICY "events_select_public"
  ON events FOR SELECT TO anon
  USING (status = 'published');

-- Admin : accès complet
CREATE POLICY "events_all_admin"
  ON events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Inscriptions : n'importe qui peut s'inscrire
CREATE POLICY "registrations_insert_anon"
  ON event_registrations FOR INSERT TO anon
  WITH CHECK (true);

-- Admin : lecture et gestion des inscriptions
CREATE POLICY "registrations_all_admin"
  ON event_registrations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Grants explicites
GRANT SELECT ON events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT INSERT ON event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_registrations TO authenticated;

-- Vérification : doit retourner les policies créées
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('events', 'event_registrations')
ORDER BY tablename, policyname;
