-- ═════════════════════════════════════════════════════════════════════════════
-- Réseaux sociaux : une publication = un visuel + une légende, publiés sur
-- Instagram et Facebook de façon traçable.
--
-- Ce que corrige cette migration :
--  · Les jetons Meta et l'App Secret vivaient dans `settings`, que n'importe
--    quel visiteur lit avec la clé publique du site : quiconque pouvait publier
--    sur la Page. Ils passent dans `app_secrets` (aucun droit de lecture hors
--    clé de service) et disparaissent de `settings`.
--  · Un post était marqué « publié » par le navigateur même quand l'envoi à
--    Meta avait échoué (2 posts « posted » sans qu'aucun compte soit relié).
--    Désormais, seul le serveur écrit les statuts de publication, réseau par
--    réseau, dans `social_publications` (un réseau n'est publié qu'une fois :
--    UNIQUE (post_id, network) + verrou `locked_until`).
--
-- Statuts d'une publication (`social_posts.status`) :
--   draft       brouillon (seul statut qu'un INSERT du navigateur peut poser)
--   scheduled   programmée à `scheduled_at` (posé par le serveur après contrôle)
--   publishing  envoi en cours (serveur)
--   published   en ligne sur tous les réseaux choisis (serveur)
--   partial     en ligne sur un réseau, échec sur l'autre (serveur)
--   failed      échec (serveur) — modifiable puis relançable
--   archived    rangée
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Jetons Meta : hors de la table publique ───────────────────────────────
INSERT INTO app_secrets (key, value, updated_at)
SELECT m.new_key, s.value, now()
FROM settings s
JOIN (VALUES
  ('social_meta_token',      'meta_user_token'),
  ('social_meta_page_token', 'meta_page_token'),
  ('social_meta_app_secret', 'meta_app_secret')
) AS m(old_key, new_key) ON s.key = m.old_key
WHERE coalesce(trim(s.value), '') <> ''
ON CONFLICT (key) DO NOTHING;

DELETE FROM settings
WHERE key IN (
  'social_meta_token', 'social_meta_page_token', 'social_meta_app_secret',
  'social_linkedin_token', 'social_linkedin_client_secret'
);

-- ── 2. social_posts : le contenu publié ──────────────────────────────────────
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS caption      text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hashtags     text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS link_path    text,
  ADD COLUMN IF NOT EXISTS visual       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_url    text,
  ADD COLUMN IF NOT EXISTS networks     text[]      NOT NULL DEFAULT ARRAY['instagram', 'facebook'],
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error   text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN social_posts.caption   IS 'Légende commune Instagram / Facebook, sans hashtags (ajoutés à l''envoi).';
COMMENT ON COLUMN social_posts.visual    IS '{ layout, format, eyebrow, headline, photo_url, hash } — de quoi redessiner le visuel.';
COMMENT ON COLUMN social_posts.image_url IS 'Visuel JPEG rendu et déposé sur R2 : exactement l''image envoyée à Meta.';
COMMENT ON COLUMN social_posts.link_path IS 'Page du site citée en fin de message Facebook (/reservation, /soins/visage…).';

-- Reprise des posts de l'ancien Studio (contenu JSON multi-formats).
UPDATE social_posts SET
  caption = trim(both E'\n' FROM concat_ws(E'\n\n',
    nullif(content #>> '{instagram,caption,hook}', ''),
    nullif(content #>> '{instagram,caption,body}', ''),
    nullif(content #>> '{instagram,caption,cta}', ''))),
  hashtags = coalesce(content #>> '{instagram,caption,hashtags}', ''),
  visual = jsonb_build_object(
    'layout', 'photo',
    'format', 'portrait',
    'eyebrow', '',
    'headline', coalesce(nullif(content #>> '{instagram,slides,0,text}', ''), title),
    'photo_url', cover_image)
WHERE caption = '' AND content ? 'instagram';

-- Les contraintes de l'ancien modèle.
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_source_type_check;
-- Servait à l'automatisation (une source = un post). On peut désormais tirer
-- plusieurs publications du même article ou du même soin.
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_source_type_source_ref_key;

-- « posted » n'a jamais voulu dire publié : aucun compte n'était relié quand
-- ces posts ont été « approuvés ». Ils redeviennent des brouillons.
UPDATE social_posts SET
  status = 'draft',
  last_error = 'Jamais publiée : aucun compte Facebook ni Instagram n''était relié lors de la validation.'
WHERE status = 'posted';
UPDATE social_posts SET status = 'draft' WHERE status = 'ready';

ALTER TABLE social_posts ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE social_posts ALTER COLUMN content SET DEFAULT '{}'::jsonb;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'archived'));
ALTER TABLE social_posts ADD CONSTRAINT social_posts_source_type_check
  CHECK (source_type IN ('idee', 'soin', 'offre', 'article', 'manual', 'rss', 'suggestion'));
ALTER TABLE social_posts ADD CONSTRAINT social_posts_networks_check
  CHECK (networks <@ ARRAY['instagram', 'facebook']::text[]);

CREATE INDEX IF NOT EXISTS social_posts_due_idx ON social_posts (status, scheduled_at);

-- ── 3. social_publications : un envoi par réseau ─────────────────────────────
CREATE TABLE IF NOT EXISTS social_publications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  network       text        NOT NULL CHECK (network IN ('instagram', 'facebook')),
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  -- Instagram : conteneur créé, en attente de traitement par Meta.
  container_id  text,
  -- Identifiant du média / du post chez Meta, et son adresse publique.
  external_id   text,
  permalink     text,
  error         text,
  attempts      integer     NOT NULL DEFAULT 0,
  -- Verrou : deux déclencheurs simultanés (navigateur + tâche planifiée) ne
  -- traitent jamais le même envoi en même temps.
  locked_until  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, network)
);

COMMENT ON TABLE social_publications IS
  'Envoi d''une publication sociale sur un réseau. Écrit uniquement par le serveur (clé de service).';

ALTER TABLE social_publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read" ON social_publications;
CREATE POLICY "admin_read" ON social_publications FOR SELECT TO authenticated USING (true);
-- TRUNCATE compris : il contourne les politiques et les déclencheurs.
REVOKE ALL ON social_publications FROM anon, authenticated;
GRANT SELECT ON social_publications TO authenticated;
REVOKE TRUNCATE ON social_posts FROM anon, authenticated;

-- Un envoi publié le reste : rien ne le remet en file (ce qui le republierait).
CREATE OR REPLACE FUNCTION social_publications_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published'
     AND (NEW.status <> 'published' OR NEW.external_id IS DISTINCT FROM OLD.external_id) THEN
    RAISE EXCEPTION 'Cette publication est déjà en ligne sur % : elle ne se renvoie pas.', OLD.network;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_publications_guard ON social_publications;
CREATE TRIGGER social_publications_guard
  BEFORE UPDATE ON social_publications
  FOR EACH ROW EXECUTE FUNCTION social_publications_guard();

-- ── 4. Ce que le navigateur peut écrire sur social_posts ─────────────────────
-- Le navigateur rédige (texte, visuel, réseaux) et range (brouillon, archive).
-- Programmer, publier et constater un échec passent par le serveur, qui
-- vérifie d'abord le visuel, la légende et les comptes reliés.
CREATE OR REPLACE FUNCTION social_posts_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM social_publications p
               WHERE p.post_id = OLD.id AND p.status IN ('published', 'processing')) THEN
      RAISE EXCEPTION 'Cette publication est en ligne : archivez-la plutôt que de la supprimer.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Une nouvelle publication commence en brouillon.';
    END IF;
    NEW.scheduled_at := NULL;
    NEW.published_at := NULL;
    NEW.last_error := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- En ligne ou en cours d'envoi : on ne peut plus que l'archiver.
  IF OLD.status IN ('publishing', 'published', 'partial') THEN
    IF NEW.status <> 'archived' OR OLD.status = 'publishing' THEN
      RAISE EXCEPTION 'Cette publication est déjà partie : elle ne se modifie plus.';
    END IF;
    NEW := OLD;
    NEW.status := 'archived';
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Archivée : on peut seulement la ressortir en brouillon, si rien n'est en ligne.
  IF OLD.status = 'archived' THEN
    IF NEW.status = 'archived' THEN
      RETURN OLD;
    END IF;
    IF NEW.status <> 'draft' OR EXISTS (SELECT 1 FROM social_publications p
                                        WHERE p.post_id = OLD.id AND p.status = 'published') THEN
      RAISE EXCEPTION 'Cette publication archivée reste dans l''historique.';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft', 'archived') THEN
    RAISE EXCEPTION 'Programmer ou publier passe par le bouton prévu (contrôle du visuel et des comptes).';
  END IF;

  IF NEW.status = 'scheduled' AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    RAISE EXCEPTION 'Changez l''heure de publication avec le bouton « Programmer ».';
  END IF;

  IF NEW.status IN ('draft', 'archived') THEN
    NEW.scheduled_at := NULL;
  END IF;
  NEW.published_at := OLD.published_at;
  IF NEW.status <> 'failed' THEN
    NEW.last_error := CASE WHEN NEW.status = OLD.status THEN OLD.last_error ELSE NULL END;
  ELSE
    NEW.last_error := OLD.last_error;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_guard ON social_posts;
CREATE TRIGGER social_posts_guard
  BEFORE INSERT OR UPDATE OR DELETE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION social_posts_guard();
