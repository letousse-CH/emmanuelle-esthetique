-- ─────────────────────────────────────────────────────────────────────────────
-- Système d'événements — Semeur d'Éveil
-- À exécuter dans Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table événements
CREATE TABLE IF NOT EXISTS events (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title          text        NOT NULL,
  slug           text        NOT NULL UNIQUE,
  category       text        NOT NULL DEFAULT 'atelier_groupe'
                             CHECK (category IN ('retraite_spirituelle','atelier_groupe','module','evenement_regulier')),
  excerpt        text,
  description    text,
  date           date,
  time_start     text,
  time_end       text,
  location       text        NOT NULL DEFAULT '',
  address        text,
  price_chf      integer     NOT NULL DEFAULT 0,
  max_participants integer,
  image_url      text,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('published','draft','paused')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 2. Table inscriptions / paiements
CREATE TABLE IF NOT EXISTS event_registrations (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name          text        NOT NULL,
  last_name           text        NOT NULL,
  email               text        NOT NULL,
  phone               text,
  payment_type        text        NOT NULL DEFAULT 'full'
                                  CHECK (payment_type IN ('full','installment')),
  payment_status      text        NOT NULL DEFAULT 'pending'
                                  CHECK (payment_status IN ('pending','paid','failed','refunded')),
  stripe_session_id   text,
  amount_chf          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Lecture publique : événements publiés uniquement
CREATE POLICY "events_select_public"
  ON events FOR SELECT TO anon
  USING (status = 'published');

-- Admin : accès complet aux événements
CREATE POLICY "events_all_admin"
  ON events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Inscription : n'importe qui peut insérer
CREATE POLICY "registrations_insert_anon"
  ON event_registrations FOR INSERT TO anon
  WITH CHECK (true);

-- Admin : lecture et gestion de toutes les inscriptions
CREATE POLICY "registrations_select_admin"
  ON event_registrations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "registrations_update_admin"
  ON event_registrations FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Grants explicites
GRANT SELECT ON events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT INSERT ON event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_registrations TO authenticated;

-- 4. Événement d'exemple
INSERT INTO events (
  title, slug, category, excerpt, description,
  date, time_start, time_end,
  location, address,
  price_chf, max_participants,
  image_url, status
) VALUES (
  'Atelier Méditation & Rêves — Écouter les messages de la nuit',
  'atelier-meditation-reves-mai-2026',
  'atelier_groupe',
  'Un espace pour apprendre à décoder vos rêves et les relier à votre chemin intérieur. Méditations guidées, partage en groupe et exercices pratiques.',
  '<h2>Présentation</h2>
<p>Nos rêves ne sont pas de simples images aléatoires. Ils sont une voix — celle de notre inconscient qui cherche à nous parler.</p>
<p>Dans cet atelier en groupe (12 personnes maximum), nous explorerons ensemble les fondements de l''interprétation des rêves selon l''approche jungienne, associés à des méditations guidées pour développer l''écoute intérieure.</p>

<h2>Au programme</h2>
<p><strong>Matin (9h–12h)</strong></p>
<ul>
  <li>Accueil, intention et méditation d''ouverture</li>
  <li>Introduction à la symbolique des rêves (archétypes, ombres, animus/anima)</li>
  <li>Partage et travail en binôme</li>
</ul>
<p><strong>Après-midi (14h–17h)</strong></p>
<ul>
  <li>Méditation guidée approfondie</li>
  <li>Travail en groupe sur des rêves volontaires</li>
  <li>Intégration et clôture</li>
</ul>

<h2>Ce que vous repartez avec</h2>
<ul>
  <li>Une méthode simple pour noter et décoder vos rêves au quotidien</li>
  <li>Des repères pour reconnaître les figures archétypales</li>
  <li>Un espace de connexion avec votre vie intérieure</li>
</ul>

<h2>Pour qui ?</h2>
<p>Toute personne curieuse de son monde intérieur, quel que soit son niveau de pratique. Aucune expérience requise.</p>

<h2>Infos pratiques</h2>
<ul>
  <li>Repas de midi non inclus (pause libre de 12h à 14h)</li>
  <li>Tenue confortable recommandée</li>
  <li>Adresse complète communiquée après confirmation de l''inscription</li>
</ul>',
  '2026-05-30',
  '09:00',
  '17:00',
  'Palézieux, Vaud — Suisse',
  'Adresse complète communiquée après inscription',
  120,
  12,
  'https://xyzyhzdabmbqyycxcpgl.supabase.co/storage/v1/object/public/medias/h23wnol67rr_1778316518261.jpg',
  'published'
) ON CONFLICT (slug) DO NOTHING;
