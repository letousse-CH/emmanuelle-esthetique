-- ═════════════════════════════════════════════════════════════════════════════
-- Réseaux sociaux : plan éditorial, stories et Reels.
-- À appliquer après 20261020_social_publication_fiable.sql.
--
--  · `kind` : post (fil), story (9:16, sans légende), reel (vidéo MP4).
--  · `planned_at` / `pillar` / `plan_note` : un sujet du plan éditorial, posé
--    sur un créneau du rythme. C'est un brouillon : seul « Programmer » (serveur,
--    après contrôle) en fait une publication programmée (`scheduled_at`).
--  · `reel` : la composition du Reel (scènes, musique) ; `video_url` : le MP4
--    rendu dans le navigateur et déposé sur R2.
--  · `social_music` : la bibliothèque de musiques libres de droits des Reels.
--    L'API Meta ne donne pas accès à la musique d'Instagram : la piste est
--    intégrée à la vidéo, d'où une bibliothèque à soi, aux licences vérifiées.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS kind       text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS planned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pillar     text,
  ADD COLUMN IF NOT EXISTS plan_note  text,
  ADD COLUMN IF NOT EXISTS reel       jsonb,
  ADD COLUMN IF NOT EXISTS video_url  text;

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_kind_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_kind_check CHECK (kind IN ('post', 'story', 'reel'));

COMMENT ON COLUMN social_posts.kind       IS 'post (fil 4:5 ou carré), story (9:16, sans légende), reel (vidéo MP4 9:16).';
COMMENT ON COLUMN social_posts.planned_at IS 'Créneau prévu par le plan éditorial ; la programmation réelle reste scheduled_at.';
COMMENT ON COLUMN social_posts.reel       IS '{ scenes: [{ type, photo_url | video_url, text, duration }], music: { url, title, credit }, hash }';
COMMENT ON COLUMN social_posts.video_url  IS 'Vidéo MP4 du Reel déposée sur R2 : exactement le fichier envoyé à Meta.';

CREATE INDEX IF NOT EXISTS social_posts_planned_idx ON social_posts (planned_at) WHERE planned_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS social_music (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  -- Ambiance, pour que l'IA choisisse : douce, lumineuse, zen, rythmée…
  mood       text        NOT NULL DEFAULT 'douce',
  url        text        NOT NULL,
  duration_s numeric,
  -- Source et licence (ex. « Pixabay — licence de contenu Pixabay »).
  credit     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE social_music ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON social_music;
CREATE POLICY "admin_all" ON social_music FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON social_music FROM anon;
REVOKE TRUNCATE ON social_music FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON social_music TO authenticated;
