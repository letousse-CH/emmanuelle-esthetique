-- ─────────────────────────────────────────────────────────────
-- Fix RLS articles — autoriser les brouillons (published = false)
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. Supprimer toutes les policies existantes sur la table articles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON articles', pol.policyname);
  END LOOP;
END $$;

-- 2. Recréer des policies permissives pour les utilisateurs authentifiés
--    (lecture publique + écriture complète pour les admins connectés)

-- Lecture publique : tout le monde peut lire les articles publiés
CREATE POLICY "Lecture publique articles publiés"
ON articles FOR SELECT
USING (published = true);

-- Lecture admin : les utilisateurs connectés voient tous les articles (brouillons inclus)
CREATE POLICY "Lecture admin tous articles"
ON articles FOR SELECT
TO authenticated
USING (true);

-- INSERT : les utilisateurs connectés peuvent créer un article (publié ou brouillon)
CREATE POLICY "Insert pour utilisateurs authentifiés"
ON articles FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE : les utilisateurs connectés peuvent modifier n'importe quel article
CREATE POLICY "Update pour utilisateurs authentifiés"
ON articles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE : les utilisateurs connectés peuvent supprimer
CREATE POLICY "Delete pour utilisateurs authentifiés"
ON articles FOR DELETE
TO authenticated
USING (true);
