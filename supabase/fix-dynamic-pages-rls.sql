-- Permettre aux utilisateurs anonymes de lire toutes les pages dynamiques
-- (publiées ou non), pour que la page d'accueil builder soit toujours visible.

DROP POLICY IF EXISTS "public_read_published" ON dynamic_pages;

CREATE POLICY "public_read_all" ON dynamic_pages
  FOR SELECT TO anon, authenticated
  USING (true);
