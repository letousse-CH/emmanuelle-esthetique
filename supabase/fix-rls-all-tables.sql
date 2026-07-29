-- ─────────────────────────────────────────────────────────────────────────────
-- Correction sécurité : activation RLS sur toutes les tables publiques
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. articles ──────────────────────────────────────────────────────────────
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'articles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON articles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "articles_select_public"  ON articles FOR SELECT TO anon          USING (published = true);
CREATE POLICY "articles_select_admin"   ON articles FOR SELECT TO authenticated  USING (true);
CREATE POLICY "articles_insert_admin"   ON articles FOR INSERT TO authenticated  WITH CHECK (true);
CREATE POLICY "articles_update_admin"   ON articles FOR UPDATE TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY "articles_delete_admin"   ON articles FOR DELETE TO authenticated  USING (true);

-- ── 2. subscribers ───────────────────────────────────────────────────────────
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- ── 3. newsletters ───────────────────────────────────────────────────────────
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

-- ── 4. page_views ────────────────────────────────────────────────────────────
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- ── 5. settings ──────────────────────────────────────────────────────────────
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ── 6. events ────────────────────────────────────────────────────────────────
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ── 7. event_registrations ───────────────────────────────────────────────────
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- ── Vérification finale ───────────────────────────────────────────────────────
-- Ce SELECT doit retourner 0 ligne après exécution.
-- Si des lignes apparaissent, ces tables sont encore sans RLS.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity = true
  );
