-- ─────────────────────────────────────────────────────────────────────────────
-- Réservations v2 — Emmanuelle Esthétique
--
-- Migration : 20261004_reservations_v2.sql  (à appliquer APRÈS 20261003)
--
-- Le modèle métier : la cliente demande une DATE et une PÉRIODE (matin / après-
-- midi). Emmanuelle la rappelle, fait l'upselling au téléphone, puis fixe
-- l'horaire DÉFINITIF. D'où `periode` (demandée) et `horaire_fixe` (vrai quand
-- l'heure est définitive et bloque réellement l'agenda).
--
-- Ce fichier est ADDITIF et rejouable (IF NOT EXISTS partout) : on peut
-- l'appliquer avant de déployer le code, l'ancien code continue de fonctionner.
-- Seule exception, la section 6 (retrait de l'INSERT anonyme) : elle suppose que
-- SUPABASE_SERVICE_ROLE_KEY est définie sur Netlify — c'est le cas dès que
-- l'envoi de réservation passe par `getSupabaseAdmin()`.
--
-- Contenu :
--  1. bookings        : période, horaire définitif, total, source, suivi d'appel
--  2. booking_blocks  : indisponibilités (jour, plage de jours, plage horaire)
--  3. booking_events  : journal des changements d'un rendez-vous
--  4. booking_settings: pas de la grille, heure de coupure matin/après-midi
--  5. RLS / grants
--  6. Sécurité : plus d'INSERT anonyme direct sur `bookings`
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. bookings ──────────────────────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS periode                  text
    CHECK (periode IN ('matin', 'apres_midi')),
  -- Faux : l'heure est provisoire (début de période), la demande est « souple »
  -- et ne bloque pas une heure précise. Vrai : Emmanuelle a fixé l'horaire.
  ADD COLUMN IF NOT EXISTS horaire_fixe             boolean     NOT NULL DEFAULT false,
  -- Ce que la cliente a demandé à l'origine, conservé quand le rdv est déplacé.
  ADD COLUMN IF NOT EXISTS date_demandee            date,
  ADD COLUMN IF NOT EXISTS periode_demandee        text
    CHECK (periode_demandee IN ('matin', 'apres_midi')),
  -- Instantané du total (soin + options), recalculé côté serveur à chaque écriture.
  ADD COLUMN IF NOT EXISTS total_chf                numeric(10,2) CHECK (total_chf >= 0),
  ADD COLUMN IF NOT EXISTS source                   text        NOT NULL DEFAULT 'en_ligne'
    CHECK (source IN ('en_ligne', 'admin', 'telephone')),
  -- Date du rappel téléphonique : sert à trier « à appeler » vs « déjà contactée ».
  ADD COLUMN IF NOT EXISTS contacte_at              timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_envoyee_at  timestamptz,
  -- Accord promotionnel donné (ou non) sur le formulaire public.
  ADD COLUMN IF NOT EXISTS optin_promotions         boolean     NOT NULL DEFAULT false;

-- Reprise des lignes existantes
UPDATE bookings
   SET periode = CASE WHEN heure_rdv < '13:00' THEN 'matin' ELSE 'apres_midi' END
 WHERE periode IS NULL;

UPDATE bookings
   SET date_demandee = date_rdv, periode_demandee = periode
 WHERE date_demandee IS NULL;

-- Un rendez-vous déjà confirmé ou terminé avait une heure arrêtée.
UPDATE bookings SET horaire_fixe = true
 WHERE statut IN ('confirme', 'termine') AND horaire_fixe = false;

UPDATE bookings SET source = 'admin'
 WHERE source = 'en_ligne' AND notes_cliente LIKE '[Prise manuelle admin]%';

UPDATE bookings
   SET total_chf = service_prix_chf + COALESCE((
         SELECT sum(COALESCE((o->>'prix_chf')::numeric, 0))
           FROM jsonb_array_elements(options) o
       ), 0)
 WHERE total_chf IS NULL;

-- Format d'heure garanti en base (la colonne est du texte 'HH:mm').
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_heure_rdv_format') THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_heure_rdv_format
      CHECK (heure_rdv ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_periode_idx ON bookings (date_rdv, periode);
CREATE INDEX IF NOT EXISTS bookings_contacte_idx ON bookings (statut, contacte_at);

-- Anti double-clic : une même cliente ne dépose qu'une demande en ligne active
-- par jour et par période.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_double_submit_idx
  ON bookings (telephone, date_rdv, periode)
  WHERE source = 'en_ligne' AND statut IN ('en_attente', 'confirme');

-- ── 2. Indisponibilités ──────────────────────────────────────────────────────
-- Une ligne = un jour, une plage de jours (vacances), ou une plage horaire sur
-- un seul jour (rendez-vous médecin, formation…).
CREATE TABLE IF NOT EXISTS booking_blocks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  date_debut   date        NOT NULL,
  date_fin     date        NOT NULL,
  heure_debut  text,
  heure_fin    text,
  motif        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_blocks_dates CHECK (date_fin >= date_debut),
  -- Journée entière (heures nulles) ou plage horaire (les deux renseignées).
  CONSTRAINT booking_blocks_heures_paires CHECK ((heure_debut IS NULL) = (heure_fin IS NULL)),
  CONSTRAINT booking_blocks_heures CHECK (
    heure_debut IS NULL OR (
      heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND heure_fin > heure_debut
      AND date_debut = date_fin
    )
  )
);

CREATE INDEX IF NOT EXISTS booking_blocks_dates_idx ON booking_blocks (date_debut, date_fin);

DROP TRIGGER IF EXISTS booking_blocks_updated_at ON booking_blocks;
CREATE TRIGGER booking_blocks_updated_at
  BEFORE UPDATE ON booking_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reprise de l'ancienne liste de fermetures (jours entiers) puis vidage : le
-- moteur de créneaux lit désormais `booking_blocks`.
INSERT INTO booking_blocks (date_debut, date_fin, motif)
SELECT t.d::date, t.d::date, 'Fermeture (reprise)'
  FROM booking_settings s, jsonb_array_elements_text(s.fermetures_exceptionnelles) AS t(d)
 WHERE jsonb_typeof(s.fermetures_exceptionnelles) = 'array'
   AND NOT EXISTS (
     SELECT 1 FROM booking_blocks b
      WHERE b.date_debut = t.d::date AND b.date_fin = t.d::date AND b.heure_debut IS NULL
   );

UPDATE booking_settings SET fermetures_exceptionnelles = '[]'::jsonb
 WHERE fermetures_exceptionnelles <> '[]'::jsonb;

-- ── 3. Journal des rendez-vous ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id  uuid        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- creation | statut | deplacement | modification | contact | email | crm | note
  type        text        NOT NULL,
  detail      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  actor       text        NOT NULL DEFAULT 'systeme' CHECK (actor IN ('cliente', 'admin', 'systeme')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_events_booking_idx ON booking_events (booking_id, created_at DESC);

-- ── 4. Paramètres ────────────────────────────────────────────────────────────
ALTER TABLE booking_settings
  ADD COLUMN IF NOT EXISTS pas_creneau_minutes   integer NOT NULL DEFAULT 30
    CHECK (pas_creneau_minutes IN (5, 10, 15, 20, 30, 60)),
  -- Un créneau qui commence avant cette heure est « matin », sinon « après-midi ».
  ADD COLUMN IF NOT EXISTS heure_coupure_periode text    NOT NULL DEFAULT '13:00'
    CHECK (heure_coupure_periode ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ── 5. RLS & droits ──────────────────────────────────────────────────────────
ALTER TABLE booking_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_blocks_all_admin" ON booking_blocks;
CREATE POLICY "booking_blocks_all_admin"
  ON booking_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "booking_events_all_admin" ON booking_events;
CREATE POLICY "booking_events_all_admin"
  ON booking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rien n'est exposé au rôle `anon` : la grille de disponibilité publique est
-- calculée par une route serveur (clé de service), jamais lue depuis le navigateur.
REVOKE ALL ON booking_blocks FROM anon;
REVOKE ALL ON booking_events FROM anon;
GRANT ALL ON booking_blocks TO authenticated;
GRANT ALL ON booking_events TO authenticated;

-- ── 6. Sécurité : fin de l'INSERT anonyme direct ─────────────────────────────
-- Avant : `bookings_insert_public` (WITH CHECK (true)) + GRANT INSERT à anon
-- laissaient n'importe qui, avec la clé publique, écrire une ligne
-- `statut = 'confirme'`, au prix et à l'heure de son choix, en contournant le
-- contrôle de disponibilité et la limite de débit. Toute création passe
-- maintenant par POST /api/bookings (clé de service, validation serveur).
DROP POLICY IF EXISTS "bookings_insert_public" ON bookings;
REVOKE INSERT ON bookings FROM anon;
