-- ─────────────────────────────────────────────────────────────
-- RLS articles — version finale et complète
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. S'assurer que RLS est bien activé sur la table articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer toutes les policies existantes proprement
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON articles', pol.policyname);
  END LOOP;
END $$;

-- 3. S'assurer que les rôles ont bien les privilèges PostgreSQL de base
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;

-- ─── POLICIES ────────────────────────────────────────────────

-- Lecture publique : visiteurs anonymes → articles publiés uniquement
CREATE POLICY "articles_select_public"
ON articles FOR SELECT
TO anon
USING (published = true);

-- Lecture admin : utilisateurs connectés → tous les articles (brouillons inclus)
CREATE POLICY "articles_select_admin"
ON articles FOR SELECT
TO authenticated
USING (true);

-- Création : utilisateurs connectés uniquement
CREATE POLICY "articles_insert_admin"
ON articles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Modification : utilisateurs connectés uniquement
CREATE POLICY "articles_update_admin"
ON articles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Suppression : utilisateurs connectés uniquement
CREATE POLICY "articles_delete_admin"
ON articles FOR DELETE
TO authenticated
USING (true);
