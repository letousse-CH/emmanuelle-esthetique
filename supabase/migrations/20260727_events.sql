-- ─────────────────────────────────────────────────────────────────────────────
-- Module Événements — tables `events` + `event_registrations`.
-- Consolidé depuis events-schema, events-dates-migration, events-features-migration,
-- events-installments-migration, events-meta-migration, discount-label-migration,
-- fix-events-rls.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title                   text        NOT NULL,
  slug                    text        NOT NULL UNIQUE,
  category                text        NOT NULL DEFAULT 'atelier_groupe'
                                      CHECK (category IN ('retraite_spirituelle','atelier_groupe','module','evenement_regulier')),
  excerpt                 text,
  description             text,
  date_start              date,
  date_end                date,
  time_start              text,
  time_end                text,
  location                text        NOT NULL DEFAULT '',
  address                 text,
  price_chf               integer     NOT NULL DEFAULT 0,
  max_participants        integer,
  image_url               text,
  status                  text        NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('published','draft','paused')),
  -- Visio
  is_online               boolean     DEFAULT false,
  visio_url               text,
  -- Récurrence
  is_recurring            boolean     DEFAULT false,
  recurrence_sessions     integer,
  recurrence_day          text,
  recurrence_description  text,
  -- Tarif
  discount_label          text,
  -- SEO
  meta_title              text,
  meta_description        text,
  meta_keywords           text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id                uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name              text        NOT NULL,
  last_name               text        NOT NULL,
  email                   text        NOT NULL,
  phone                   text,
  payment_type            text        NOT NULL DEFAULT 'full'
                                      CHECK (payment_type IN ('full','installment')),
  payment_status          text        NOT NULL DEFAULT 'pending'
                                      CHECK (payment_status IN ('pending','paid','failed','refunded')),
  stripe_session_id       text,
  amount_chf              integer     NOT NULL DEFAULT 0,
  -- Paiement fractionné (3x)
  installment_amount_chf  integer,
  installment_2_url       text,
  installment_2_date      date,
  installment_2_status    text        DEFAULT 'pending',
  installment_3_url       text,
  installment_3_date      date,
  installment_3_status    text        DEFAULT 'pending',
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

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

-- Lecture publique : événements publiés uniquement
CREATE POLICY "events_select_public"
  ON events FOR SELECT TO anon
  USING (status = 'published');

-- Admin : accès complet aux événements
CREATE POLICY "events_all_admin"
  ON events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Inscription : n'importe qui peut s'inscrire
CREATE POLICY "registrations_insert_anon"
  ON event_registrations FOR INSERT TO anon
  WITH CHECK (true);

-- Admin : lecture et gestion de toutes les inscriptions
CREATE POLICY "registrations_all_admin"
  ON event_registrations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT ON events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT INSERT ON event_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_registrations TO authenticated;
