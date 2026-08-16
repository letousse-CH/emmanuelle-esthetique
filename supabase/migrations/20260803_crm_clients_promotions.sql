-- ─────────────────────────────────────────────────────────────────────────────
-- CRM : fiche cliente enrichie, journal de suivi, promotions e-mail & WhatsApp.
--
-- À appliquer APRÈS `20260802_caisse_categories_forfaits_stock.sql`.
--
-- ⚠️ OBSOLÈTE EN PARTIE — `20260804_retrait_donnees_sante.sql` supprime ensuite
-- `clients.allergies` et la table `client_notes` créées ici : l'exploitante a
-- décidé de ne conserver aucune donnée de santé. Ce fichier n'est pas réécrit
-- parce qu'une migration déjà appliquée quelque part ne se modifie plus — elle
-- cesserait de décrire ce que la base a réellement vécu. Le code applicatif ne
-- lit plus ni l'une ni l'autre.
--
-- ┌─ LA RÈGLE QUI GOUVERNE LES PROMOTIONS ─────────────────────────────────┐
-- │ Encaisser une cliente n'est PAS un consentement publicitaire.          │
-- │                                                                        │
-- │ La LCD (art. 3 al. 1 let. o) interdit la publicité de masse par        │
-- │ e-mail ou message sans accord préalable, avec identification correcte  │
-- │ de l'expéditeur et refus gratuit et facile. Une fiche créée à la       │
-- │ caisse ne vaut donc pas opt-in : le consentement est stocké à part,    │
-- │ par canal (`consent_email`, `consent_whatsapp`), horodaté et sourcé.   │
-- │                                                                        │
-- │ Aucune requête d'audience de ce module ne doit ignorer ces colonnes.   │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Les allergies et le journal de suivi touchent à la santé : ce sont des
-- données personnelles sensibles au sens de la LPD révisée. Comme le reste du
-- module caisse, rien n'est exposé au rôle `anon`, et le privilège lui-même est
-- retiré — pas seulement la policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Fiche cliente enrichie
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_naissance   date,
  -- Champ à part, jamais noyé dans les notes : c'est la seule information de
  -- la fiche qui peut faire mal si on l'oublie avant un soin.
  ADD COLUMN IF NOT EXISTS allergies        text,
  ADD COLUMN IF NOT EXISTS consent_email    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_whatsapp boolean NOT NULL DEFAULT false,
  -- Quand et comment l'accord a été donné. Sans ces deux colonnes, un
  -- consentement est indéfendable le jour où quelqu'un le conteste.
  ADD COLUMN IF NOT EXISTS consent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source   text;

-- Segment « anniversaires du mois » : `extract` est immutable sur une date,
-- l'index est donc utilisable.
CREATE INDEX IF NOT EXISTS clients_anniversaire_idx
  ON clients ((EXTRACT(MONTH FROM date_naissance)))
  WHERE date_naissance IS NOT NULL;

-- Rapprochement avec les abonnés du site, et audiences e-mail dédoublonnées.
CREATE INDEX IF NOT EXISTS clients_email_lower_idx
  ON clients (lower(email))
  WHERE email IS NOT NULL;

/**
 * Retirer un consentement doit toujours effacer sa date : sinon une fiche
 * garderait la trace d'un accord qu'elle n'a plus, et le prochain audit lirait
 * un opt-in là où il n'y en a pas. À l'inverse, accorder un consentement sans
 * date l'horodate automatiquement — on ne peut pas oublier de le faire.
 */
CREATE OR REPLACE FUNCTION clients_consent_stamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.consent_email OR NEW.consent_whatsapp THEN
    IF NEW.consent_at IS NULL
    OR (TG_OP = 'UPDATE' AND NOT (OLD.consent_email OR OLD.consent_whatsapp))
    THEN
      NEW.consent_at := now();
    END IF;
  ELSE
    NEW.consent_at     := NULL;
    NEW.consent_source := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_consent_stamp ON clients;
CREATE TRIGGER clients_consent_stamp
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION clients_consent_stamp();

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Journal de suivi — ce que la facture ne dit pas
--
-- La facture sait quel soin, quand, combien. Elle ne sait pas que la peau a
-- rougi, qu'il faut baisser l'intensité, ni quel produit a été utilisé en
-- cabine. C'est ce carnet qui fait la différence entre un fichier clients et
-- un CRM d'institut.
--
-- Contrairement aux écritures de caisse, ces notes se corrigent et se
-- suppriment : ce ne sont pas des pièces comptables, et une observation fausse
-- sur la peau d'une cliente doit pouvoir disparaître.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS client_notes (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- Visite à laquelle la note se rattache, quand elle en a une. SET NULL et
  -- non CASCADE : annuler une facture ne doit pas effacer l'observation de
  -- soin qui l'accompagnait.
  transaction_id uuid        REFERENCES transactions(id) ON DELETE SET NULL,
  date_soin      date        NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Zurich')::date,
  contenu        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, date_soin DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Statistiques par cliente — dernière visite, fréquence, encaissé
--
-- `security_invoker = true` : sans cette option une vue s'exécute avec les
-- droits de son propriétaire et court-circuiterait la RLS des tables
-- sous-jacentes. Ici elle doit au contraire hériter des droits de l'appelant.
--
-- Le cumul applique la règle du module — `total_ttc - montant_bon` — et jamais
-- la somme brute des TTC : la part réglée par bon a été encaissée le jour de
-- la vente du bon, la recompter doublerait ce qu'a rapporté la cliente.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW client_stats WITH (security_invoker = true) AS
SELECT
  c.id                                                              AS client_id,
  count(t.id)                                                       AS nb_visites,
  max(t.created_at)                                                 AS derniere_visite,
  min(t.created_at)                                                 AS premiere_visite,
  coalesce(sum(t.total_ttc - coalesce(t.montant_bon, 0)), 0)::numeric(10,2) AS total_encaisse
FROM clients c
LEFT JOIN transactions t
  ON t.client_id = c.id AND t.status = 'payee'
GROUP BY c.id;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Promotions
--
-- Une promotion porte DEUX rédactions : l'e-mail (HTML, avec objet) et le
-- message WhatsApp (texte brut, court). Ce ne sont pas deux rendus du même
-- texte — on n'écrit pas à quelqu'un sur WhatsApp comme dans un e-mail, et
-- vouloir dériver l'un de l'autre produit toujours du mauvais des deux.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS promotions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom                text        NOT NULL,
  canal              text        NOT NULL DEFAULT 'email'
                                 CHECK (canal IN ('email','whatsapp','les_deux')),
  -- Clé d'un segment prédéfini (`toutes`, `anniversaires`, `inactives`,
  -- `fideles`, `abonnes`), et ses paramètres éventuels — par exemple
  -- {"mois": 6} pour « inactives depuis 6 mois ».
  segment            text        NOT NULL DEFAULT 'toutes',
  segment_params     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  objet              text,
  message_email      text,
  message_whatsapp   text,
  status             text        NOT NULL DEFAULT 'brouillon'
                                 CHECK (status IN ('brouillon','en_cours','envoyee')),
  sent_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_created_idx ON promotions (created_at DESC);

/**
 * Qui a reçu quoi, par quel canal.
 *
 * La contrainte d'unicité est le cœur de cette table : c'est elle qui empêche
 * qu'une cliente reçoive deux fois la même promotion. Indispensable côté
 * WhatsApp, où l'envoi se fait à la main, un contact après l'autre, et où l'on
 * perd le fil dès la dixième — mais tout aussi utile pour reprendre un envoi
 * e-mail interrompu sans re-solliciter ceux qui l'ont déjà reçu.
 *
 * `destinataire` fige l'adresse ou le numéro réellement utilisé : la fiche peut
 * changer ensuite, la trace de l'envoi ne doit pas bouger.
 */
CREATE TABLE IF NOT EXISTS promotion_sends (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id  uuid        NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  client_id     uuid        REFERENCES clients(id) ON DELETE SET NULL,
  subscriber_id uuid        REFERENCES subscribers(id) ON DELETE SET NULL,
  canal         text        NOT NULL CHECK (canal IN ('email','whatsapp')),
  destinataire  text        NOT NULL,
  status        text        NOT NULL DEFAULT 'envoye'
                            CHECK (status IN ('envoye','echec')),
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, canal, destinataire)
);

CREATE INDEX IF NOT EXISTS promotion_sends_promo_idx  ON promotion_sends (promotion_id, canal);
CREATE INDEX IF NOT EXISTS promotion_sends_client_idx ON promotion_sends (client_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. RLS & privilèges
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE client_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_sends  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['client_notes','promotions','promotion_sends'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "client_notes_all_admin"    ON client_notes    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotions_all_admin"      ON promotions      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "promotion_sends_all_admin" ON promotion_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON client_notes    FROM anon;
REVOKE ALL ON promotions      FROM anon;
REVOKE ALL ON promotion_sends FROM anon;
REVOKE ALL ON client_stats    FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON client_notes    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotions      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotion_sends TO authenticated;
GRANT SELECT                         ON client_stats    TO authenticated;
