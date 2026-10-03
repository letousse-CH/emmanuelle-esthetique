-- ─────────────────────────────────────────────────────────────────────────────
-- Module Réservations & Offre du Mois — Emmanuelle Esthétique
--
-- Migration : 20261003_reservations_et_offredumois.sql
--
-- Fonctionnalités :
--  · `monthly_offers`  : Offre exclusive du mois avec mise en avant, tarif et image
--  · `bookings`        : Réservations clientes en ligne, créneau horaire, service,
--                        options, lien CRM cliente et synchronisation Google Calendar
--  · `booking_settings`: Paramètres d'exploitation (horaires d'ouverture matin /
--                        après-midi, buffer de 30 min entre rdv, règles de délai)
--  · RLS sécurisé      : Insertion publique de réservation, lecture/gestion réservée
--                        au personnel authentifié (protection stricte des données personnelles LPD)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Offre du Mois ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_offers (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       text          NOT NULL,
  description text,
  prix_chf    numeric(10,2) NOT NULL CHECK (prix_chf >= 0),
  image_url   text,
  active      boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monthly_offers_active_idx ON monthly_offers (active);
CREATE INDEX IF NOT EXISTS monthly_offers_created_at_idx ON monthly_offers (created_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS monthly_offers_updated_at ON monthly_offers;
CREATE TRIGGER monthly_offers_updated_at
  BEFORE UPDATE ON monthly_offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Réservations (Bookings) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                     uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id              uuid          REFERENCES clients(id) ON DELETE SET NULL,
  nom                    text          NOT NULL,
  prenom                 text          NOT NULL,
  telephone              text          NOT NULL,
  email                  text,
  code_postal            text,
  ville                  text,
  service_id             text,
  service_nom            text          NOT NULL,
  service_prix_chf       numeric(10,2) NOT NULL CHECK (service_prix_chf >= 0),
  service_duree_minutes  integer       NOT NULL DEFAULT 60 CHECK (service_duree_minutes > 0),
  options                jsonb         NOT NULL DEFAULT '[]'::jsonb,
  offer_of_month_id      uuid          REFERENCES monthly_offers(id) ON DELETE SET NULL,
  date_rdv               date          NOT NULL,
  heure_rdv              text          NOT NULL, -- format 'HH:mm' ex: '09:00', '14:30'
  statut                 text          NOT NULL DEFAULT 'en_attente'
                                       CHECK (statut IN ('en_attente', 'confirme', 'refuse', 'annule', 'termine')),
  notes_cliente          text,
  notes_admin            text,
  gcal_event_id          text,
  rappel_effectue        boolean       NOT NULL DEFAULT false,
  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now()
);

-- Index pour accélérer la recherche par créneau et par statut
CREATE INDEX IF NOT EXISTS bookings_date_rdv_idx ON bookings (date_rdv, heure_rdv);
CREATE INDEX IF NOT EXISTS bookings_statut_idx ON bookings (statut);
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON bookings (client_id);
CREATE INDEX IF NOT EXISTS bookings_gcal_event_id_idx ON bookings (gcal_event_id) WHERE gcal_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Paramètres de réservation (Booking Settings) ─────────────────────────
CREATE TABLE IF NOT EXISTS booking_settings (
  id                         text        PRIMARY KEY DEFAULT 'default',
  buffer_minutes             integer     NOT NULL DEFAULT 30 CHECK (buffer_minutes >= 0),
  anticipation_min_heures    integer     NOT NULL DEFAULT 2 CHECK (anticipation_min_heures >= 0),
  anticipation_max_jours     integer     NOT NULL DEFAULT 60 CHECK (anticipation_max_jours > 0),
  jours_ouverture            jsonb       NOT NULL DEFAULT '{
    "1": {"ouvert": true,  "plages": [{"debut": "09:00", "fin": "12:00"}, {"debut": "13:30", "fin": "18:30"}]},
    "2": {"ouvert": true,  "plages": [{"debut": "09:00", "fin": "12:00"}, {"debut": "13:30", "fin": "18:30"}]},
    "3": {"ouvert": true,  "plages": [{"debut": "09:00", "fin": "12:00"}, {"debut": "13:30", "fin": "18:30"}]},
    "4": {"ouvert": true,  "plages": [{"debut": "09:00", "fin": "12:00"}, {"debut": "13:30", "fin": "18:30"}]},
    "5": {"ouvert": true,  "plages": [{"debut": "09:00", "fin": "12:00"}, {"debut": "13:30", "fin": "18:30"}]},
    "6": {"ouvert": false, "plages": []},
    "0": {"ouvert": false, "plages": []}
  }'::jsonb,
  fermetures_exceptionnelles jsonb       NOT NULL DEFAULT '[]'::jsonb,
  gcal_sync_enabled          boolean     NOT NULL DEFAULT false,
  gcal_calendar_id           text,
  notification_email         text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- Insertion de la ligne de configuration par défaut
INSERT INTO booking_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Trigger updated_at
DROP TRIGGER IF EXISTS booking_settings_updated_at ON booking_settings;
CREATE TRIGGER booking_settings_updated_at
  BEFORE UPDATE ON booking_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Sécurité & Politiques RLS (Row Level Security) ───────────────────────
ALTER TABLE monthly_offers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['monthly_offers','bookings','booking_settings'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- 4.1 Offres du mois
-- Tout le monde (anonyme & connecté) peut consulter les offres actives
CREATE POLICY "monthly_offers_select_public"
  ON monthly_offers FOR SELECT TO anon, authenticated
  USING (active = true);

-- L'administratrice connectée a un accès complet aux offres (création, modif, désactivation)
CREATE POLICY "monthly_offers_all_admin"
  ON monthly_offers FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4.2 Réservations (Bookings)
-- Réservation publique : n'importe quelle cliente peut insérer une demande de rdv
CREATE POLICY "bookings_insert_public"
  ON bookings FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- L'admin connecté gère et consulte l'ensemble des rendez-vous
CREATE POLICY "bookings_all_admin"
  ON bookings FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4.3 Paramètres de réservation (Booking Settings)
-- Lecture publique des horaires et délais pour permettre le calcul des créneaux
CREATE POLICY "booking_settings_select_public"
  ON booking_settings FOR SELECT TO anon, authenticated
  USING (true);

-- Modification réservée à l'administratrice connectée
CREATE POLICY "booking_settings_all_admin"
  ON booking_settings FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 5. Droits d'accès (Grants) ───────────────────────────────────────────────
-- Protection LPD : pas de SELECT anonyme direct sur la table bookings (contenant nom, tél, email)
REVOKE ALL ON monthly_offers   FROM anon;
REVOKE ALL ON bookings         FROM anon;
REVOKE ALL ON booking_settings FROM anon;

GRANT SELECT                  ON monthly_offers   TO anon;
GRANT INSERT                  ON bookings         TO anon;
GRANT SELECT                  ON booking_settings TO anon;

GRANT ALL                     ON monthly_offers   TO authenticated;
GRANT ALL                     ON bookings         TO authenticated;
GRANT ALL                     ON booking_settings TO authenticated;
