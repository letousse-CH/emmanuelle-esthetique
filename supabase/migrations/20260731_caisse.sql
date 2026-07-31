-- ─────────────────────────────────────────────────────────────────────────────
-- Module Caisse — clientèle, catalogue de prestations, encaissements, factures.
--
-- Conformité comptable suisse (CO art. 957a al. 2 et 958f) :
--  · Intégralité et chronologie  → numérotation séquentielle sans trou, allouée
--    en base par `caisse_next_invoice_seq` (verrou de ligne, donc sûre même si
--    deux encaissements sont validés en même temps).
--  · Immuabilité                 → aucune SUPPRESSION possible d'une écriture ;
--    les montants, la date et le numéro sont verrouillés par trigger. Une erreur
--    se corrige par une ANNULATION (status='annulee'), qui laisse la trace.
--  · Traçabilité de l'identité   → le nom du client est recopié sur la
--    transaction (`client_label`) : renommer ou supprimer une fiche cliente ne
--    réécrit pas une facture déjà émise.
--  · Conservation 10 ans         → les tables ne sont jamais purgées ; la fiche
--    cliente s'archive (`archived`) au lieu d'être supprimée si elle est liée.
--
-- Les montants sont en francs, `numeric(10,2)` : les centimes comptent dès que
-- la TVA est activée (8.1 % de CHF 120.00 = CHF 9.72), donc pas d'entier CHF
-- comme dans le module Événements.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Clientèle ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text        NOT NULL,
  prenom      text        NOT NULL DEFAULT '',
  telephone   text,
  email       text,
  notes       text,
  -- On archive au lieu de supprimer : une cliente citée sur une facture émise
  -- doit rester consultable (CO art. 958f, conservation 10 ans).
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Recherche rapide « nom, prénom ou téléphone » du flux d'encaissement.
CREATE INDEX IF NOT EXISTS clients_search_idx
  ON clients (lower(nom), lower(prenom));
CREATE INDEX IF NOT EXISTS clients_telephone_idx
  ON clients (telephone);

-- ── Catalogue de prestations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  nom               text          NOT NULL,
  description       text,
  prix_chf          numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_chf >= 0),
  -- Taux appliqué par défaut lors de l'ajout au panier. 0 tant que l'activité
  -- n'est pas assujettie ; 8.1 (normal) ou 2.6 (réduit) le jour où elle l'est.
  taux_tva_defaut   numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva_defaut >= 0 AND taux_tva_defaut <= 100),
  active            boolean       NOT NULL DEFAULT true,
  ordre             integer       NOT NULL DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_active_idx ON services (active, ordre);

-- ── Compteur de numérotation des factures ───────────────────────────────────
-- Une ligne par année civile. Jamais écrit directement : seule la fonction
-- `caisse_next_invoice_seq` (SECURITY DEFINER) y touche, ce qui garantit une
-- séquence continue même en cas d'encaissements simultanés.
CREATE TABLE IF NOT EXISTS invoice_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

-- ── Encaissements ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee          integer       NOT NULL,
  number_seq     integer       NOT NULL,
  -- Numéro affiché et imprimé : FAC-2026-0001. Colonne générée, donc jamais
  -- désynchronisée de (annee, number_seq).
  numero         text          GENERATED ALWAYS AS
                               ('FAC-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  client_id      uuid          REFERENCES clients(id) ON DELETE SET NULL,
  -- Nom figé au moment de l'encaissement (« Client de passage » si anonyme).
  client_label   text          NOT NULL DEFAULT 'Client de passage',
  total_ht       numeric(10,2) NOT NULL DEFAULT 0,
  total_tva      numeric(10,2) NOT NULL DEFAULT 0,
  total_ttc      numeric(10,2) NOT NULL DEFAULT 0,
  mode_paiement  text          NOT NULL DEFAULT 'especes'
                               CHECK (mode_paiement IN ('especes','carte','twint','virement')),
  status         text          NOT NULL DEFAULT 'payee'
                               CHECK (status IN ('payee','annulee')),
  note           text,
  cancelled_at   timestamptz,
  cancel_reason  text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq)
);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_client_idx     ON transactions (client_id);

CREATE TABLE IF NOT EXISTS transaction_items (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id     uuid          NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  -- Référence indicative : le libellé et le prix sont recopiés, donc modifier
  -- ou supprimer une prestation du catalogue ne réécrit pas les factures.
  service_id         uuid          REFERENCES services(id) ON DELETE SET NULL,
  description        text          NOT NULL,
  prix_unitaire_ttc  numeric(10,2) NOT NULL CHECK (prix_unitaire_ttc >= 0),
  quantite           numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite > 0),
  taux_tva           numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva >= 0 AND taux_tva <= 100),
  total_ttc          numeric(10,2) NOT NULL DEFAULT 0,
  ordre              integer       NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS transaction_items_tx_idx ON transaction_items (transaction_id, ordre);

-- ─────────────────────────────────────────────────────────────────────────────
-- Numérotation séquentielle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_next_invoice_seq(p_annee integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- ON CONFLICT DO UPDATE pose un verrou de ligne : deux appels concurrents
  -- sont sérialisés, donc jamais deux fois le même numéro ni de trou.
  INSERT INTO invoice_counters (annee, last_seq)
  VALUES (p_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Création d'un encaissement (numérotation + lignes + totaux, en une seule
-- transaction). Les montants sont calculés ICI, pas dans le navigateur : la
-- base reste l'unique source de vérité comptable.
--
-- p_items : tableau JSON
--   [{ "service_id": uuid|null, "description": text,
--      "prix_unitaire_ttc": number, "quantite": number, "taux_tva": number }]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_create_transaction(
  p_client_id     uuid,
  p_client_label  text,
  p_mode_paiement text,
  p_note          text,
  p_items         jsonb
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee integer;
  v_seq   integer;
  v_tx    transactions;
  v_item  jsonb;
  v_idx   integer := 0;
  v_label text;
  v_ttc   numeric(10,2);
  v_ht    numeric(10,2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  -- Heure suisse : un encaissement du 31 décembre à 23 h doit tomber sur
  -- l'exercice de l'année en cours à Palézieux, pas sur celui d'UTC.
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;
  v_seq   := caisse_next_invoice_seq(v_annee);

  v_label := NULLIF(btrim(coalesce(p_client_label, '')), '');
  IF v_label IS NULL AND p_client_id IS NOT NULL THEN
    SELECT btrim(prenom || ' ' || nom) INTO v_label FROM clients WHERE id = p_client_id;
  END IF;

  -- Totaux calculés AVANT l'insertion, pas après : le trigger d'immuabilité
  -- refuse toute écriture ultérieure sur les colonnes de montants, y compris
  -- venant d'ici. La transaction naît donc directement avec ses totaux définitifs.
  --
  -- Les prix sont saisis TTC (usage en institut) : le HT se déduit ligne par
  -- ligne et la TVA est le reliquat — jamais l'inverse, sinon la somme des
  -- lignes ne retomberait pas sur le total réellement encaissé. Les expressions
  -- sont identiques à celles des lignes ci-dessous, pour que total = Σ lignes
  -- au centime près.
  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
  FROM jsonb_array_elements(p_items) it;

  INSERT INTO transactions (
    annee, number_seq, client_id, client_label, mode_paiement, note,
    total_ht, total_tva, total_ttc
  )
  VALUES (
    v_annee,
    v_seq,
    p_client_id,
    coalesce(v_label, 'Client de passage'),
    coalesce(p_mode_paiement, 'especes'),
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht,
    v_ttc - v_ht,
    v_ttc
  )
  RETURNING * INTO v_tx;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO transaction_items (
      transaction_id, service_id, description, prix_unitaire_ttc, quantite, taux_tva, total_ttc, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation'),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      coalesce((v_item->>'quantite')::numeric, 1),
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * coalesce((v_item->>'quantite')::numeric, 1), 2),
      v_idx
    );
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Annulation — le seul moyen de « défaire » un encaissement. L'écriture reste
-- en base avec son numéro : c'est ce qu'exige la traçabilité (CO art. 957a).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions;
BEGIN
  UPDATE transactions
  SET status        = 'annulee',
      cancelled_at  = now(),
      cancel_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at    = now()
  WHERE id = p_id AND status = 'payee'
  RETURNING * INTO v_tx;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable ou déjà annulée.';
  END IF;
  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Immuabilité des écritures
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une écriture de caisse ne se supprime pas (CO art. 957a) : annulez la facture %.', OLD.numero;
  END IF;

  IF NEW.annee      IS DISTINCT FROM OLD.annee
  OR NEW.number_seq IS DISTINCT FROM OLD.number_seq
  OR NEW.total_ht   IS DISTINCT FROM OLD.total_ht
  OR NEW.total_tva  IS DISTINCT FROM OLD.total_tva
  OR NEW.total_ttc  IS DISTINCT FROM OLD.total_ttc
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Numéro, date et montants de la facture % sont immuables (CO art. 957a). Annulez-la et ré-encaissez.', OLD.numero;
  END IF;

  IF OLD.status = 'annulee' AND NEW.status <> 'annulee' THEN
    RAISE EXCEPTION 'La facture % est annulée : elle ne peut pas être réactivée.', OLD.numero;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_update ON transactions;
CREATE TRIGGER transactions_guard_update
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION caisse_transactions_guard();

DROP TRIGGER IF EXISTS transactions_guard_delete ON transactions;
CREATE TRIGGER transactions_guard_delete
  BEFORE DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION caisse_transactions_guard();

-- Le détail d'une facture est figé au même titre que son total.
CREATE OR REPLACE FUNCTION caisse_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être supprimé (CO art. 957a).';
  END IF;

  -- Seule mutation tolérée : le `ON DELETE SET NULL` déclenché quand une
  -- prestation sort du catalogue. Sans cette exception, retirer un soin du
  -- catalogue échouerait dès qu'il a été vendu une fois. Le libellé, le prix et
  -- le taux restent figés — la facture, elle, ne bouge pas d'un centime.
  IF NEW.service_id IS NULL AND OLD.service_id IS NOT NULL
  AND NEW.transaction_id    IS NOT DISTINCT FROM OLD.transaction_id
  AND NEW.description       IS NOT DISTINCT FROM OLD.description
  AND NEW.prix_unitaire_ttc IS NOT DISTINCT FROM OLD.prix_unitaire_ttc
  AND NEW.quantite          IS NOT DISTINCT FROM OLD.quantite
  AND NEW.taux_tva          IS NOT DISTINCT FROM OLD.taux_tva
  AND NEW.total_ttc         IS NOT DISTINCT FROM OLD.total_ttc
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être modifié (CO art. 957a).';
END;
$$;

DROP TRIGGER IF EXISTS transaction_items_guard ON transaction_items;
CREATE TRIGGER transaction_items_guard
  BEFORE UPDATE OR DELETE ON transaction_items
  FOR EACH ROW EXECUTE FUNCTION caisse_items_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — module strictement interne : rien n'est exposé au rôle `anon`.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters  ENABLE ROW LEVEL SECURITY;

-- `clients`, `services` et `transactions` sont des noms génériques : on filtre
-- explicitement sur le schéma `public`, sinon une table homonyme d'un autre
-- schéma (storage, realtime…) verrait ses policies supprimées.
DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients','services','transactions','transaction_items','invoice_counters'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "clients_all_admin"  ON clients  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "services_all_admin" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lecture pour le journal et le tableau de bord ; écriture uniquement pour
-- l'annulation et l'édition de la note/du client (les triggers filtrent le
-- reste). Pas de policy INSERT ni DELETE : on passe forcément par les RPC.
CREATE POLICY "transactions_select_admin" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_update_admin" ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "transaction_items_select_admin" ON transaction_items FOR SELECT TO authenticated USING (true);

-- `invoice_counters` n'a aucune policy : seules les fonctions SECURITY DEFINER
-- y accèdent.

-- Supabase accorde par défaut tous les privilèges sur les nouvelles tables du
-- schéma `public` à `anon` et `authenticated` (ALTER DEFAULT PRIVILEGES posé à
-- la création du projet). RLS suffit à bloquer les lectures, mais on ne veut
-- pas que la protection du fichier clientes — des données personnelles —
-- repose sur une seule ligne de défense : on retire le privilège lui-même.
REVOKE ALL ON clients           FROM anon;
REVOKE ALL ON services          FROM anon;
REVOKE ALL ON transactions      FROM anon;
REVOKE ALL ON transaction_items FROM anon;
REVOKE ALL ON invoice_counters  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON clients  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;
GRANT SELECT, UPDATE                 ON transactions      TO authenticated;
GRANT SELECT                         ON transaction_items TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_next_invoice_seq(integer)                        FROM public;
REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)                    FROM public;
GRANT  EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb) TO authenticated;
GRANT  EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)                    TO authenticated;
