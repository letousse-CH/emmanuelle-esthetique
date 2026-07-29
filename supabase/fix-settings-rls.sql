-- Correction de la politique RLS de la table settings pour permettre l'insertion (nécessaire pour UPSERT)
-- À exécuter dans l'éditeur SQL de Supabase

DROP POLICY IF EXISTS "admin_update" ON settings;
DROP POLICY IF EXISTS "admin_all" ON settings;

CREATE POLICY "admin_all" ON settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
