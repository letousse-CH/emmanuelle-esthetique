-- ─────────────────────────────────────────────────────────────────────────────
-- Bons cadeaux + correction d'écriture.
--
-- ┌─ LA RÈGLE QUI GOUVERNE TOUT CE FICHIER ────────────────────────────────┐
-- │ Un bon cadeau ne produit de recette QU'UNE FOIS : à sa vente.          │
-- │ Le jour où la cliente l'utilise, aucun argent n'entre — la prestation  │
-- │ est déjà payée. Compter les deux doublerait le chiffre d'affaires.     │
-- │                                                                        │
-- │ D'où `transactions.montant_bon` : la part de la facture réglée avec un │
-- │ bon. La recette encaissée vaut TOUJOURS `total_ttc - montant_bon`.     │
-- │ Cette soustraction est la seule définition correcte du CA dans tout le │
-- │ module — journal, tableau de bord et export fiducie l'appliquent.      │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Ce modèle couvre aussi le cas courant du bon partiel : bon de CHF 150 sur un
-- soin à CHF 200 → montant_bon = 150, mode_paiement = twint pour les 50 restants.
--
-- Durée de validité : le droit suisse ne fixe aucun minimum. Un bon est une
-- créance ordinaire, donc prescrite par 10 ans (CO art. 127) faute d'accord
-- contraire. Les organisations de consommateurs contestent les validités
-- courtes ; le réglage `caisse_bon_validite_mois` vaut 60 mois (5 ans) par
-- défaut, un compromis usuel dans la branche. La date d'échéance est figée sur
-- chaque bon à son émission : changer le réglage n'altère jamais un bon déjà
-- vendu.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Numérotation des bons (même principe que les factures) ──────────────────
CREATE TABLE IF NOT EXISTS gift_card_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee               integer       NOT NULL,
  number_seq          integer       NOT NULL,
  code                text          GENERATED ALWAYS AS
                                    ('BON-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  -- « Bon cadeau », ou la liste des soins choisis dans la carte.
  libelle             text          NOT NULL DEFAULT 'Bon cadeau',
  montant_initial     numeric(10,2) NOT NULL CHECK (montant_initial > 0),
  montant_restant     numeric(10,2) NOT NULL CHECK (montant_restant >= 0),
  beneficiaire        text,
  acheteur_client_id  uuid          REFERENCES clients(id) ON DELETE SET NULL,
  acheteur_label      text          NOT NULL DEFAULT 'Client de passage',
  -- La vente qui l'a émis. RESTRICT : on ne détruit pas la trace d'un bon en
  -- vie — de toute façon les transactions ne se suppriment pas.
  sale_transaction_id uuid          REFERENCES transactions(id) ON DELETE RESTRICT,
  emis_le             timestamptz   NOT NULL DEFAULT now(),
  expire_le           date          NOT NULL,
  -- Pas de statut « expiré » stocké : il se déduit de `expire_le`, sinon il
  -- faudrait une tâche planifiée pour le tenir à jour, et un bon deviendrait
  -- faussement valable le jour où elle ne tourne pas.
  status              text          NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','epuise','annule')),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq),
  CHECK (montant_restant <= montant_initial)
);

CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards (status, expire_le);
CREATE INDEX IF NOT EXISTS gift_cards_sale_idx   ON gift_cards (sale_transaction_id);

-- ── Colonnes ajoutées aux encaissements ─────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS gift_card_id           uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS montant_bon            numeric(10,2) NOT NULL DEFAULT 0 CHECK (montant_bon >= 0),
  -- Facture que celle-ci corrige. L'ancienne reste annulée au journal avec son
  -- numéro : c'est le chaînage qui rend la correction traçable (CO art. 957a).
  ADD COLUMN IF NOT EXISTS corrige_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

-- Le bon cadeau devient un mode de règlement à part entière (facture soldée
-- intégralement par un bon).
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_mode_paiement_check;
ALTER TABLE transactions ADD  CONSTRAINT transactions_mode_paiement_check
  CHECK (mode_paiement IN ('especes','carte','twint','virement','bon_cadeau'));

-- Un bon lié à une ligne : permet d'imprimer le code sur la quittance de vente.
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Immuabilité — `montant_bon` est une donnée financière au même titre que les
-- totaux : le modifier après coup fausserait le CA de la période.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une écriture de caisse ne se supprime pas (CO art. 957a) : annulez la facture %.', OLD.numero;
  END IF;

  IF NEW.annee                  IS DISTINCT FROM OLD.annee
  OR NEW.number_seq             IS DISTINCT FROM OLD.number_seq
  OR NEW.total_ht               IS DISTINCT FROM OLD.total_ht
  OR NEW.total_tva              IS DISTINCT FROM OLD.total_tva
  OR NEW.total_ttc              IS DISTINCT FROM OLD.total_ttc
  OR NEW.montant_bon            IS DISTINCT FROM OLD.montant_bon
  OR NEW.corrige_transaction_id IS DISTINCT FROM OLD.corrige_transaction_id
  OR NEW.created_at             IS DISTINCT FROM OLD.created_at
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

-- Le `ON DELETE SET NULL` de gift_cards touche aussi les lignes de facture :
-- on l'autorise au même titre que celui de services.
CREATE OR REPLACE FUNCTION caisse_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être supprimé (CO art. 957a).';
  END IF;

  IF (
       (NEW.service_id   IS NULL AND OLD.service_id   IS NOT NULL)
    OR (NEW.gift_card_id IS NULL AND OLD.gift_card_id IS NOT NULL)
     )
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

-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_next_gift_card_seq(p_annee integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO gift_card_counters (annee, last_seq)
  VALUES (p_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = gift_card_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Création d'un encaissement — version étendue.
--
-- L'ancienne signature à 5 arguments est supprimée : la garder créerait une
-- surcharge, et PostgREST ne saurait plus laquelle appeler.
--
--  p_gift_card_code : bon présenté en paiement (NULL si aucun)
--  p_montant_bon    : part de la facture réglée avec ce bon
--  p_emissions      : bons à émettre, [{ ordre, montant, libelle, beneficiaire,
--                     validite_mois }] — un par ligne « bon cadeau » du panier,
--                     `ordre` étant l'indice de cette ligne dans p_items
--  p_corrige_transaction_id : facture que cet encaissement corrige
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS caisse_create_transaction(uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION caisse_create_transaction(
  p_client_id              uuid,
  p_client_label           text,
  p_mode_paiement          text,
  p_note                   text,
  p_items                  jsonb,
  p_gift_card_code         text    DEFAULT NULL,
  p_montant_bon            numeric DEFAULT 0,
  p_emissions              jsonb   DEFAULT NULL,
  p_corrige_transaction_id uuid    DEFAULT NULL
)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee    integer;
  v_seq      integer;
  v_tx       transactions;
  v_item     jsonb;
  v_emission jsonb;
  v_idx      integer := 0;
  v_label    text;
  v_ttc      numeric(10,2);
  v_ht       numeric(10,2);
  v_bon      numeric(10,2) := round(coalesce(p_montant_bon, 0), 2);
  v_card     gift_cards;
  v_card_id  uuid := NULL;
  v_today    date;
  v_new_card gift_cards;
  v_gseq     integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;

  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
  FROM jsonb_array_elements(p_items) it;

  -- ── Bon présenté en paiement ──────────────────────────────────────────────
  IF p_gift_card_code IS NOT NULL AND btrim(p_gift_card_code) <> '' THEN
    -- FOR UPDATE : verrouille le bon le temps de la transaction, pour que deux
    -- encaissements simultanés ne puissent pas dépenser deux fois le solde.
    SELECT * INTO v_card FROM gift_cards
    WHERE upper(code) = upper(btrim(p_gift_card_code))
    FOR UPDATE;

    IF v_card.id IS NULL THEN
      RAISE EXCEPTION 'Bon cadeau introuvable : %.', p_gift_card_code;
    END IF;
    IF v_card.status = 'annule' THEN
      RAISE EXCEPTION 'Le bon % a été annulé.', v_card.code;
    END IF;
    IF v_card.expire_le < v_today THEN
      RAISE EXCEPTION 'Le bon % a expiré le %.', v_card.code, to_char(v_card.expire_le, 'DD.MM.YYYY');
    END IF;
    IF v_bon <= 0 THEN
      RAISE EXCEPTION 'Le montant prélevé sur le bon % doit être supérieur à zéro.', v_card.code;
    END IF;
    IF v_bon > v_card.montant_restant THEN
      RAISE EXCEPTION 'Le bon % ne dispose que de CHF % (demandé : CHF %).',
        v_card.code, to_char(v_card.montant_restant, 'FM999999990.00'), to_char(v_bon, 'FM999999990.00');
    END IF;
    IF v_bon > v_ttc THEN
      RAISE EXCEPTION 'Le montant réglé par bon (CHF %) dépasse le total de la facture (CHF %).',
        to_char(v_bon, 'FM999999990.00'), to_char(v_ttc, 'FM999999990.00');
    END IF;

    v_card_id := v_card.id;
  ELSE
    v_bon := 0;
  END IF;

  v_seq := caisse_next_invoice_seq(v_annee);

  v_label := NULLIF(btrim(coalesce(p_client_label, '')), '');
  IF v_label IS NULL AND p_client_id IS NOT NULL THEN
    SELECT btrim(prenom || ' ' || nom) INTO v_label FROM clients WHERE id = p_client_id;
  END IF;

  INSERT INTO transactions (
    annee, number_seq, client_id, client_label, mode_paiement, note,
    total_ht, total_tva, total_ttc, gift_card_id, montant_bon, corrige_transaction_id
  )
  VALUES (
    v_annee, v_seq, p_client_id,
    coalesce(v_label, 'Client de passage'),
    coalesce(p_mode_paiement, 'especes'),
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht, v_ttc - v_ht, v_ttc,
    v_card_id, v_bon, p_corrige_transaction_id
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

  -- ── Décompte du bon utilisé ───────────────────────────────────────────────
  IF v_card_id IS NOT NULL THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant - v_bon,
        status = CASE WHEN montant_restant - v_bon <= 0 THEN 'epuise' ELSE 'active' END,
        updated_at = now()
    WHERE id = v_card_id;
  END IF;

  -- ── Émission des bons vendus ──────────────────────────────────────────────
  IF p_emissions IS NOT NULL AND jsonb_typeof(p_emissions) = 'array' THEN
    FOR v_emission IN SELECT * FROM jsonb_array_elements(p_emissions)
    LOOP
      v_gseq := caisse_next_gift_card_seq(v_annee);

      INSERT INTO gift_cards (
        annee, number_seq, libelle, montant_initial, montant_restant,
        beneficiaire, acheteur_client_id, acheteur_label, sale_transaction_id, expire_le
      )
      VALUES (
        v_annee, v_gseq,
        coalesce(NULLIF(btrim(coalesce(v_emission->>'libelle', '')), ''), 'Bon cadeau'),
        round((v_emission->>'montant')::numeric, 2),
        round((v_emission->>'montant')::numeric, 2),
        NULLIF(btrim(coalesce(v_emission->>'beneficiaire', '')), ''),
        p_client_id,
        coalesce(v_label, 'Client de passage'),
        v_tx.id,
        -- Échéance figée maintenant : le réglage de durée peut changer ensuite
        -- sans jamais rogner la validité d'un bon déjà vendu.
        v_today + (coalesce((v_emission->>'validite_mois')::integer, 60) || ' months')::interval
      )
      RETURNING * INTO v_new_card;

      -- Rattache la ligne du panier qui a produit ce bon, pour que son code
      -- s'imprime sur la quittance. L'appelant fournit l'indice de la ligne
      -- (`ordre`) : rapprocher par montant se tromperait dès que deux bons de
      -- même valeur sont vendus ensemble.
      UPDATE transaction_items
      SET gift_card_id = v_new_card.id
      WHERE transaction_id = v_tx.id
        AND ordre = (v_emission->>'ordre')::integer;
    END LOOP;
  END IF;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Annulation — doit aussi défaire les effets sur les bons cadeaux.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx     transactions;
  v_entame record;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_id FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable.';
  END IF;
  IF v_tx.status = 'annulee' THEN
    RAISE EXCEPTION 'La facture % est déjà annulée.', v_tx.numero;
  END IF;

  -- Un bon vendu par cette facture et déjà entamé ne peut pas être repris :
  -- la cliente a consommé une prestation, annuler la vente créerait un bon
  -- fantôme et un trou dans les recettes.
  SELECT code, montant_initial, montant_restant INTO v_entame
  FROM gift_cards
  WHERE sale_transaction_id = v_tx.id
    AND status <> 'annule'
    AND montant_restant < montant_initial
  LIMIT 1;

  IF v_entame.code IS NOT NULL THEN
    RAISE EXCEPTION 'Le bon % vendu par cette facture a déjà été utilisé : la vente ne peut plus être annulée.', v_entame.code;
  END IF;

  -- Bons émis et intacts → invalidés avec la vente.
  UPDATE gift_cards
  SET status = 'annule', updated_at = now()
  WHERE sale_transaction_id = v_tx.id AND status <> 'annule';

  -- Bon utilisé pour payer → le solde revient à la cliente.
  IF v_tx.gift_card_id IS NOT NULL AND v_tx.montant_bon > 0 THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant + v_tx.montant_bon,
        status = CASE WHEN status = 'epuise' THEN 'active' ELSE status END,
        updated_at = now()
    WHERE id = v_tx.gift_card_id;
  END IF;

  UPDATE transactions
  SET status        = 'annulee',
      cancelled_at  = now(),
      cancel_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
      updated_at    = now()
  WHERE id = p_id
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS & privilèges
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gift_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_counters ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['gift_cards','gift_card_counters'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Lecture pour consulter et rechercher un bon ; création et décompte passent
-- exclusivement par les fonctions ci-dessus.
CREATE POLICY "gift_cards_select_admin" ON gift_cards FOR SELECT TO authenticated USING (true);

REVOKE ALL ON gift_cards         FROM anon;
REVOKE ALL ON gift_card_counters FROM anon, authenticated;
GRANT  SELECT ON gift_cards TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_next_gift_card_seq(integer) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) TO authenticated;
