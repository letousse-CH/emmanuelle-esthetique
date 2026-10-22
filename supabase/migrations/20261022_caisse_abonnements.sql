-- ═════════════════════════════════════════════════════════════════════════════
-- Caisse : abonnements de séances (ex. 10 massages + 1 offert, + 1 soin visage
-- offert).
--
-- ┌─ LA RÈGLE QUI GOUVERNE TOUT CE FICHIER ────────────────────────────────┐
-- │ Un abonnement produit sa recette UNE fois : à sa vente, payée en une   │
-- │ fois. Chaque séance prise ensuite figure sur une facture à CHF 0.00 :  │
-- │ elle trace la prestation, sans recompter l'argent.                     │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Différence avec le bon cadeau : un bon est une SOMME, dont la part utilisée
-- se soustrait d'une facture au prix normal (`montant_bon`). Un abonnement est
-- un NOMBRE de séances d'un soin défini ; une séance n'a pas de prix propre (le
-- prix de l'abonnement couvre aussi les séances offertes), d'où une ligne à
-- zéro plutôt qu'un montant soustrait. La recette encaissée reste donc, partout,
-- `total_ttc - montant_bon` : rien à changer dans le journal, le tableau de
-- bord, le bilan ni l'export fiduciaire.
--
-- L'abonnement est nominatif (rattaché à la fiche de la cliente qui l'a payé),
-- et sa date d'échéance est figée à la vente, comme celle d'un bon : changer la
-- durée de la formule au catalogue ne touche aucun abonnement déjà vendu. Elle
-- se prolonge à la main (`caisse_subscription_prolonger`), jamais en silence.
--
-- TVA : la ligne de vente suit la règle de toute prestation (0 % tant que
-- l'activité n'est pas assujettie). Le jour de l'assujettissement, faire
-- valider par la fiduciaire le traitement des abonnements prépayés.
--
-- À appliquer APRÈS 20261015_caisse_bons_tva_produits.sql, dont elle remplace
-- le corps de `caisse_create_transaction` (même signature, droits conservés),
-- et après 20260802, dont elle remplace celui de `caisse_cancel_transaction`.
-- Ne jamais rejouer 20260801, 20260802, 20261005 ni 20261015 ensuite.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Catalogue : la formule d'abonnement ───────────────────────────────────
--
-- Une formule est une entrée du catalogue (`services.type = 'abonnement'`),
-- avec son prix et sa durée de validité ; sa composition vit dans
-- `service_forfait_items`, comme celle d'un forfait : `quantite` = nombre TOTAL
-- de séances de ce soin, `offertes` = combien d'entre elles sont offertes
-- (« 10 + 1 offerte »). Un soin seulement offert a `offertes = quantite`.
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;
ALTER TABLE services ADD  CONSTRAINT services_type_check
  CHECK (type IN ('prestation', 'forfait', 'abonnement'));

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS validite_mois integer;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_validite_mois_check;
ALTER TABLE services ADD  CONSTRAINT services_validite_mois_check
  CHECK (validite_mois IS NULL OR validite_mois BETWEEN 1 AND 120);

COMMENT ON COLUMN services.validite_mois IS
  'Abonnement : durée de validité en mois à compter de la vente (12 si vide). Figée sur chaque abonnement vendu.';

ALTER TABLE service_forfait_items
  ADD COLUMN IF NOT EXISTS offertes numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE service_forfait_items DROP CONSTRAINT IF EXISTS service_forfait_items_offertes_check;
ALTER TABLE service_forfait_items ADD  CONSTRAINT service_forfait_items_offertes_check
  CHECK (offertes >= 0 AND offertes <= quantite);

-- Un forfait ou un abonnement se compose de prestations simples : jamais d'un
-- forfait ni d'un abonnement (cycles, et une séance qui en contiendrait douze).
CREATE OR REPLACE FUNCTION caisse_forfait_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type text;
  v_child_type  text;
BEGIN
  IF NEW.forfait_id = NEW.service_id THEN
    RAISE EXCEPTION 'Un forfait ou un abonnement ne peut pas se contenir lui-même.';
  END IF;

  SELECT type INTO v_parent_type FROM services WHERE id = NEW.forfait_id;
  IF v_parent_type IS NULL OR v_parent_type NOT IN ('forfait', 'abonnement') THEN
    RAISE EXCEPTION 'Seuls un forfait ou un abonnement ont une composition.';
  END IF;

  SELECT type INTO v_child_type FROM services WHERE id = NEW.service_id;
  IF v_child_type IN ('forfait', 'abonnement') THEN
    RAISE EXCEPTION 'Un forfait ou un abonnement se compose de prestations, pas d''un autre forfait ni d''un abonnement.';
  END IF;

  IF v_parent_type = 'abonnement' AND NEW.quantite <> trunc(NEW.quantite) THEN
    RAISE EXCEPTION 'Un abonnement compte des séances entières.';
  END IF;
  IF v_parent_type = 'abonnement' AND NEW.offertes <> trunc(NEW.offertes) THEN
    RAISE EXCEPTION 'Un abonnement compte des séances offertes entières.';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Abonnements vendus ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee               integer       NOT NULL,
  number_seq          integer       NOT NULL,
  code                text          GENERATED ALWAYS AS
                                    ('ABO-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  -- La formule du catalogue ; son nom est recopié dans `libelle`, qui ne bouge
  -- plus même si la formule est renommée ou retirée.
  service_id          uuid          REFERENCES services(id) ON DELETE SET NULL,
  libelle             text          NOT NULL,
  -- Nominatif : la fiche de la cliente qui l'a payé. RESTRICT : une fiche citée
  -- sur une facture s'archive, elle ne se supprime pas.
  client_id           uuid          NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  client_label        text          NOT NULL,
  -- Montant de la ligne de vente (après remise éventuelle) : sert à estimer la
  -- valeur des séances encore dues, jamais à un calcul de recette.
  prix_paye           numeric(10,2) NOT NULL CHECK (prix_paye >= 0),
  sale_transaction_id uuid          NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  emis_le             timestamptz   NOT NULL DEFAULT now(),
  expire_initiale     date          NOT NULL,
  expire_le           date          NOT NULL,
  prolonge_le         timestamptz,
  -- Pas de statut « échu » stocké : il se déduit de `expire_le` (même raison
  -- que pour les bons — aucune tâche planifiée dont dépendrait la vérité).
  status              text          NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'epuise', 'annule')),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq),
  CHECK (expire_le >= expire_initiale)
);

CREATE INDEX IF NOT EXISTS subscriptions_client_idx ON subscriptions (client_id, status);
CREATE INDEX IF NOT EXISTS subscriptions_sale_idx   ON subscriptions (sale_transaction_id);

-- Un compteur par soin de l'abonnement, recopié de la formule à la vente.
CREATE TABLE IF NOT EXISTS subscription_credits (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  service_id      uuid        REFERENCES services(id) ON DELETE SET NULL,
  libelle         text        NOT NULL,
  seances         integer     NOT NULL CHECK (seances > 0),
  offertes        integer     NOT NULL DEFAULT 0 CHECK (offertes >= 0 AND offertes <= seances),
  restantes       integer     NOT NULL CHECK (restantes >= 0 AND restantes <= seances),
  ordre           integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, service_id)
);

CREATE INDEX IF NOT EXISTS subscription_credits_sub_idx ON subscription_credits (subscription_id, ordre);

-- Une ligne de facture vend un abonnement (`subscription_id`), ou consomme une
-- séance d'un compteur (`subscription_credit_id`). Les deux naissent avec la
-- ligne : `caisse_items_guard` refuse toute modification après coup.
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS subscription_id        uuid REFERENCES subscriptions(id)        ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS subscription_credit_id uuid REFERENCES subscription_credits(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS transaction_items_subscription_idx
  ON transaction_items (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transaction_items_subscription_credit_idx
  ON transaction_items (subscription_credit_id) WHERE subscription_credit_id IS NOT NULL;

-- Facture soldée par des séances d'abonnement : rien n'est encaissé.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_mode_paiement_check;
ALTER TABLE transactions ADD  CONSTRAINT transactions_mode_paiement_check
  CHECK (mode_paiement IN ('especes', 'carte', 'twint', 'virement', 'bon_cadeau', 'abonnement'));

-- ── Immuabilité ──────────────────────────────────────────────────────────────
-- Seuls bougent : le statut, l'échéance (prolongation) et, sur un compteur, les
-- séances restantes. Le reste est la trace de la vente.
CREATE OR REPLACE FUNCTION caisse_subscriptions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un abonnement vendu ne se supprime pas : annulez sa facture de vente.';
  END IF;

  IF NEW.annee               IS DISTINCT FROM OLD.annee
  OR NEW.number_seq          IS DISTINCT FROM OLD.number_seq
  OR NEW.libelle             IS DISTINCT FROM OLD.libelle
  OR NEW.client_id           IS DISTINCT FROM OLD.client_id
  OR NEW.client_label        IS DISTINCT FROM OLD.client_label
  OR NEW.prix_paye           IS DISTINCT FROM OLD.prix_paye
  OR NEW.sale_transaction_id IS DISTINCT FROM OLD.sale_transaction_id
  OR NEW.emis_le             IS DISTINCT FROM OLD.emis_le
  OR NEW.expire_initiale     IS DISTINCT FROM OLD.expire_initiale
  OR NEW.created_at          IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'L''abonnement % ne se réécrit pas : seuls son échéance et son état évoluent.', OLD.code;
  END IF;

  IF OLD.status = 'annule' AND NEW.status <> 'annule' THEN
    RAISE EXCEPTION 'L''abonnement % est annulé : il ne peut pas être réactivé.', OLD.code;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_guard ON subscriptions;
CREATE TRIGGER subscriptions_guard
  BEFORE UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION caisse_subscriptions_guard();

CREATE OR REPLACE FUNCTION caisse_subscription_credits_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Le détail d''un abonnement vendu ne se supprime pas.';
  END IF;

  IF NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
  OR NEW.libelle         IS DISTINCT FROM OLD.libelle
  OR NEW.seances         IS DISTINCT FROM OLD.seances
  OR NEW.offertes        IS DISTINCT FROM OLD.offertes
  OR NEW.ordre           IS DISTINCT FROM OLD.ordre
  OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  -- `service_id` ne peut que tomber à NULL (soin retiré du catalogue).
  OR (NEW.service_id IS DISTINCT FROM OLD.service_id AND NEW.service_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Le détail d''un abonnement vendu ne se réécrit pas : seules les séances restantes évoluent.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_credits_guard ON subscription_credits;
CREATE TRIGGER subscription_credits_guard
  BEFORE UPDATE OR DELETE ON subscription_credits
  FOR EACH ROW EXECUTE FUNCTION caisse_subscription_credits_guard();

-- ── Numérotation (même principe que les factures et les bons) ───────────────
CREATE OR REPLACE FUNCTION caisse_next_subscription_seq(p_annee integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO subscription_counters (annee, last_seq)
  VALUES (p_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = subscription_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

-- ── 3. Encaissement ──────────────────────────────────────────────────────────
--
-- Même signature et même corps que 20261015, plus :
--
-- a) Vente. Toute ligne dont le `service_id` désigne une formule d'abonnement
--    (lu en base, jamais déclaré par le navigateur) émet un abonnement au nom de
--    la cliente, AVANT les lignes, qui naissent avec leur `subscription_id`.
--    Sans cliente, ou en quantité autre que 1, la vente est refusée.
--
-- b) Séance. Une ligne portant `subscription_credit_id` (abonnement déjà vendu)
--    ou `seance_de_ligne` (rang, dans `p_items`, de l'abonnement vendu sur ce
--    même ticket : la première séance le jour de l'achat) consomme une séance.
--    Postgres force son prix à 0, vérifie la cliente, l'échéance et le solde
--    sous verrou, et écrit lui-même le libellé (« séance 4/11 ») : le numéro
--    vient du compteur, pas de l'écran.
--
-- c) Mode. Une facture soldée par ses seules séances prend le mode
--    « abonnement » ; ce mode est refusé s'il reste quelque chose à encaisser.
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
  v_annee      integer;
  v_seq        integer;
  v_tx         transactions;
  v_item       jsonb;
  v_emission   jsonb;
  v_idx        integer := 0;
  v_label      text;
  v_ttc        numeric(10,2);
  v_ht         numeric(10,2);
  v_bon        numeric(10,2) := round(coalesce(p_montant_bon, 0), 2);
  v_card       gift_cards;
  v_card_id    uuid := NULL;
  v_today      date;
  v_new_card   gift_cards;
  v_gseq       integer;
  v_product_id uuid;
  v_cout       numeric(10,2);
  -- `numeric` et non `numeric(10,2)` : le total de l'en-tête est calculé depuis
  -- le JSON brut, arrondir la quantité ici pourrait le désaccorder d'un centime
  -- avec la somme des lignes.
  v_qte        numeric;
  v_assujetti  boolean;
  v_items      jsonb;
  v_ordre      integer;
  v_ordres     integer[] := '{}';
  v_montant    numeric(10,2);
  v_mois       integer;
  -- Rang de la ligne (texte) → bon émis par cette ligne.
  v_emis       jsonb := '{}'::jsonb;
  -- Abonnements : rang de la ligne (texte) → abonnement vendu par cette ligne.
  v_vendus     jsonb := '{}'::jsonb;
  v_pos        integer;
  v_svc        services;
  v_sub        subscriptions;
  v_aseq       integer;
  v_n          integer;
  v_seance     boolean;
  v_has_seance boolean;
  v_credit     subscription_credits;
  v_credit_id  uuid;
  v_sub_id     uuid;
  v_desc       text;
  v_mode       text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Un encaissement doit contenir au moins une ligne.';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_annee := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;

  -- Lignes qui émettent un bon, désignées par leur rang dans `p_items`.
  IF p_emissions IS NOT NULL AND jsonb_typeof(p_emissions) = 'array' THEN
    FOR v_emission IN SELECT * FROM jsonb_array_elements(p_emissions)
    LOOP
      v_ordre := (v_emission->>'ordre')::integer;
      IF v_ordre IS NULL OR v_ordre < 0 OR v_ordre >= jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'Bon cadeau rattaché à une ligne inexistante.';
      END IF;
      IF v_ordre = ANY (v_ordres) THEN
        RAISE EXCEPTION 'Une même ligne ne peut pas émettre deux bons cadeaux.';
      END IF;
      v_ordres := v_ordres || v_ordre;
    END LOOP;
  END IF;

  -- Taux effectif de chaque ligne : celui de la caisse si l'activité est
  -- assujettie, 0 % sinon ; toujours 0 % pour la vente d'un bon. Une séance
  -- d'abonnement est à CHF 0 et 0 %, quoi qu'envoie le navigateur.
  v_assujetti := coalesce(
    (SELECT lower(btrim(value)) FROM settings WHERE key = 'caisse_tva_assujetti'), 'false'
  ) = 'true';

  SELECT jsonb_agg(
           CASE WHEN NULLIF(it->>'subscription_credit_id', '') IS NOT NULL
                  OR NULLIF(it->>'seance_de_ligne', '') IS NOT NULL
                THEN it || jsonb_build_object('prix_unitaire_ttc', 0, 'taux_tva', 0)
                WHEN v_assujetti AND NOT ((o - 1)::integer = ANY (v_ordres))
                THEN it
                ELSE jsonb_set(it, '{taux_tva}', '0'::jsonb)
           END
           ORDER BY o)
  INTO v_items
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(it, o);

  SELECT
    sum(round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)),
    sum(round(
      round(coalesce((it->>'prix_unitaire_ttc')::numeric, 0) * coalesce((it->>'quantite')::numeric, 1), 2)
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2)),
    coalesce(bool_or(NULLIF(it->>'subscription_credit_id', '') IS NOT NULL
                  OR NULLIF(it->>'seance_de_ligne', '') IS NOT NULL), false)
  INTO v_ttc, v_ht, v_has_seance
  FROM jsonb_array_elements(v_items) it;

  -- ── Bon présenté en paiement ──────────────────────────────────────────────
  IF p_gift_card_code IS NOT NULL AND btrim(p_gift_card_code) <> '' THEN
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

  -- ── Mode de règlement ─────────────────────────────────────────────────────
  v_mode := coalesce(p_mode_paiement, 'especes');
  IF v_has_seance AND v_ttc - v_bon <= 0 THEN
    v_mode := CASE WHEN v_bon > 0 THEN 'bon_cadeau' ELSE 'abonnement' END;
  ELSIF v_mode = 'abonnement' THEN
    RAISE EXCEPTION 'Il reste CHF % à encaisser : choisissez un mode de paiement.',
      to_char(v_ttc - v_bon, 'FM999999990.00');
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
    v_mode,
    NULLIF(btrim(coalesce(p_note, '')), ''),
    v_ht, v_ttc - v_ht, v_ttc,
    v_card_id, v_bon, p_corrige_transaction_id
  )
  RETURNING * INTO v_tx;

  -- ── Émission des bons vendus, AVANT les lignes ────────────────────────────
  IF p_emissions IS NOT NULL AND jsonb_typeof(p_emissions) = 'array' THEN
    FOR v_emission IN SELECT * FROM jsonb_array_elements(p_emissions)
    LOOP
      v_ordre   := (v_emission->>'ordre')::integer;
      v_item    := v_items->v_ordre;
      v_montant := round(
        coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * coalesce((v_item->>'quantite')::numeric, 1), 2);
      IF v_montant <= 0 THEN
        RAISE EXCEPTION 'Un bon cadeau doit avoir une valeur supérieure à zéro.';
      END IF;
      v_mois := greatest(1, coalesce((v_emission->>'validite_mois')::integer, 60));

      v_gseq := caisse_next_gift_card_seq(v_annee);

      INSERT INTO gift_cards (
        annee, number_seq, libelle, montant_initial, montant_restant,
        beneficiaire, acheteur_client_id, acheteur_label, sale_transaction_id, expire_le
      )
      VALUES (
        v_annee, v_gseq,
        coalesce(
          NULLIF(btrim(coalesce(v_emission->>'libelle', '')), ''),
          NULLIF(btrim(coalesce(v_item->>'description', '')), ''),
          'Bon cadeau'),
        v_montant,
        v_montant,
        NULLIF(btrim(coalesce(v_emission->>'beneficiaire', '')), ''),
        p_client_id,
        coalesce(v_label, 'Client de passage'),
        v_tx.id,
        (v_today + make_interval(months => v_mois))::date
      )
      RETURNING * INTO v_new_card;

      v_emis := v_emis || jsonb_build_object(v_ordre::text, v_new_card.id);
    END LOOP;
  END IF;

  -- ── Émission des abonnements vendus, AVANT les lignes ─────────────────────
  v_pos := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_seance := NULLIF(v_item->>'subscription_credit_id', '') IS NOT NULL
             OR NULLIF(v_item->>'seance_de_ligne', '') IS NOT NULL;
    v_svc := NULL;
    IF NOT v_seance AND NULLIF(v_item->>'service_id', '') IS NOT NULL THEN
      SELECT * INTO v_svc FROM services WHERE id = (v_item->>'service_id')::uuid;
    END IF;

    IF v_svc.type = 'abonnement' THEN
      IF p_client_id IS NULL THEN
        RAISE EXCEPTION 'Un abonnement est nominatif : choisissez la cliente avant d''encaisser « % ».', v_svc.nom;
      END IF;
      IF coalesce((v_item->>'quantite')::numeric, 1) <> 1 THEN
        RAISE EXCEPTION 'Un abonnement se vend à l''unité (« % ») : ajoutez une seconde ligne pour en vendre deux.', v_svc.nom;
      END IF;
      IF v_pos = ANY (v_ordres) THEN
        RAISE EXCEPTION 'Une même ligne ne peut pas vendre un bon cadeau et un abonnement.';
      END IF;

      v_aseq := caisse_next_subscription_seq(v_annee);

      INSERT INTO subscriptions (
        annee, number_seq, service_id, libelle, client_id, client_label,
        prix_paye, sale_transaction_id, expire_initiale, expire_le
      )
      VALUES (
        v_annee, v_aseq, v_svc.id, v_svc.nom, p_client_id,
        coalesce(v_label, 'Client de passage'),
        round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
        v_tx.id,
        (v_today + make_interval(months => coalesce(v_svc.validite_mois, 12)))::date,
        (v_today + make_interval(months => coalesce(v_svc.validite_mois, 12)))::date
      )
      RETURNING * INTO v_sub;

      INSERT INTO subscription_credits (subscription_id, service_id, libelle, seances, offertes, restantes, ordre)
      SELECT v_sub.id, fi.service_id, s.nom, fi.quantite::integer, fi.offertes::integer, fi.quantite::integer, fi.ordre
      FROM service_forfait_items fi
      JOIN services s ON s.id = fi.service_id
      WHERE fi.forfait_id = v_svc.id;

      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n = 0 THEN
        RAISE EXCEPTION 'L''abonnement « % » ne contient aucune séance : complétez-le dans le catalogue.', v_svc.nom;
      END IF;

      v_vendus := v_vendus || jsonb_build_object(v_pos::text, v_sub.id);
    END IF;

    v_pos := v_pos + 1;
  END LOOP;

  -- ── Lignes de la facture ──────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qte        := coalesce((v_item->>'quantite')::numeric, 1);
    v_cout       := NULL;
    v_credit_id  := NULLIF(v_item->>'subscription_credit_id', '')::uuid;
    v_desc       := coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation');

    -- Première séance d'un abonnement vendu sur ce même ticket : le compteur
    -- est celui du soin de la ligne, dans l'abonnement que vient d'émettre la
    -- ligne désignée.
    IF v_credit_id IS NULL AND NULLIF(v_item->>'seance_de_ligne', '') IS NOT NULL THEN
      v_sub_id := NULLIF(v_vendus->>(v_item->>'seance_de_ligne'), '')::uuid;
      IF v_sub_id IS NULL THEN
        RAISE EXCEPTION 'Séance rattachée à un abonnement absent du ticket.';
      END IF;
      SELECT id INTO v_credit_id FROM subscription_credits
      WHERE subscription_id = v_sub_id
        AND service_id = NULLIF(v_item->>'service_id', '')::uuid;
      IF v_credit_id IS NULL THEN
        RAISE EXCEPTION 'Ce soin ne fait pas partie de l''abonnement vendu sur ce ticket.';
      END IF;
    END IF;

    -- Séance : contrôles sous verrou, puis libellé écrit ici depuis le compteur.
    IF v_credit_id IS NOT NULL THEN
      SELECT * INTO v_credit FROM subscription_credits WHERE id = v_credit_id FOR UPDATE;
      IF v_credit.id IS NULL THEN
        RAISE EXCEPTION 'Séance d''abonnement introuvable.';
      END IF;
      SELECT * INTO v_sub FROM subscriptions WHERE id = v_credit.subscription_id FOR UPDATE;

      IF p_client_id IS DISTINCT FROM v_sub.client_id THEN
        RAISE EXCEPTION 'L''abonnement % est au nom de %, il ne sert que pour elle.', v_sub.code, v_sub.client_label;
      END IF;
      IF v_sub.status = 'annule' THEN
        RAISE EXCEPTION 'L''abonnement % a été annulé.', v_sub.code;
      END IF;
      IF v_sub.expire_le < v_today THEN
        RAISE EXCEPTION 'L''abonnement % est échu depuis le % : prolongez-le avant d''y prendre une séance.',
          v_sub.code, to_char(v_sub.expire_le, 'DD.MM.YYYY');
      END IF;
      IF v_qte < 1 OR v_qte <> trunc(v_qte) THEN
        RAISE EXCEPTION 'Une séance d''abonnement se compte à l''unité.';
      END IF;
      IF v_qte > v_credit.restantes THEN
        RAISE EXCEPTION 'L''abonnement % n''a plus que % séance(s) de « % ».',
          v_sub.code, v_credit.restantes, v_credit.libelle;
      END IF;

      v_n := v_credit.seances - v_credit.restantes + 1;
      v_desc := v_credit.libelle || ' — '
        || CASE WHEN v_qte = 1
                THEN 'séance ' || v_n
                ELSE 'séances ' || v_n || ' à ' || (v_n + v_qte::integer - 1)
           END
        || '/' || v_credit.seances || ' (abonnement ' || v_sub.code || ')';
    END IF;

    -- Coût d'achat recopié depuis la fiche produit : à partir de maintenant, la
    -- marge de cette vente est figée. Modifier le tarif fournisseur demain ne
    -- réécrira pas la marge d'aujourd'hui.
    IF v_product_id IS NOT NULL THEN
      SELECT prix_achat_chf INTO v_cout FROM products WHERE id = v_product_id;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, service_id, product_id, offer_id, gift_card_id,
      subscription_id, subscription_credit_id, description,
      prix_unitaire_ttc, quantite, taux_tva, total_ttc, prix_achat_unitaire, ordre
    )
    VALUES (
      v_tx.id,
      -- Une séance porte le soin de son compteur, pas celui annoncé par l'écran.
      CASE WHEN v_credit_id IS NOT NULL THEN v_credit.service_id
           ELSE NULLIF(v_item->>'service_id', '')::uuid END,
      v_product_id,
      NULLIF(v_item->>'offer_id', '')::uuid,
      NULLIF(v_emis->>(v_idx::text), '')::uuid,
      NULLIF(v_vendus->>(v_idx::text), '')::uuid,
      v_credit_id,
      v_desc,
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      v_qte,
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * v_qte, 2),
      v_cout,
      v_idx
    );

    -- Décompte de la séance ; l'abonnement est épuisé quand plus aucun de ses
    -- compteurs n'a de séance.
    IF v_credit_id IS NOT NULL THEN
      UPDATE subscription_credits
      SET restantes = restantes - v_qte::integer
      WHERE id = v_credit_id;

      UPDATE subscriptions
      SET status = 'epuise'
      WHERE id = v_credit.subscription_id
        AND status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM subscription_credits
          WHERE subscription_id = v_credit.subscription_id AND restantes > 0
        );
    END IF;

    -- Sortie de stock. Le stock peut passer sous zéro et c'est délibéré :
    -- refuser la vente parce que le compteur dit 0 bloquerait une cliente qui
    -- tient le produit en main. L'écran de caisse affiche l'alerte, l'inventaire
    -- rattrape l'écart — mais la vente, elle, doit toujours pouvoir se faire.
    IF v_product_id IS NOT NULL THEN
      INSERT INTO stock_movements (product_id, type, quantite, transaction_id, motif)
      VALUES (v_product_id, 'vente', -v_qte, v_tx.id, 'Vente ' || v_tx.numero);
    END IF;

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

  RETURN v_tx;
END;
$$;

-- ── 4. Annulation ────────────────────────────────────────────────────────────
--
-- Même corps que 20260802, plus :
--  · les séances prises par cette facture sont rendues à leur abonnement ;
--  · un abonnement vendu par cette facture est annulé avec elle, à condition
--    qu'aucune séance n'y ait été prise ailleurs. Sinon la vente reste : la
--    cliente a reçu des soins payés par elle (comme pour un bon entamé).
CREATE OR REPLACE FUNCTION caisse_cancel_transaction(p_id uuid, p_reason text)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx     transactions;
  v_entame record;
  v_line   record;
  v_sub_id uuid;
  v_abo    text;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_id FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable.';
  END IF;
  IF v_tx.status = 'annulee' THEN
    RAISE EXCEPTION 'La facture % est déjà annulée.', v_tx.numero;
  END IF;

  SELECT code, montant_initial, montant_restant INTO v_entame
  FROM gift_cards
  WHERE sale_transaction_id = v_tx.id
    AND status <> 'annule'
    AND montant_restant < montant_initial
  LIMIT 1;

  IF v_entame.code IS NOT NULL THEN
    RAISE EXCEPTION 'Le bon % vendu par cette facture a déjà été utilisé : la vente ne peut plus être annulée.', v_entame.code;
  END IF;

  UPDATE gift_cards
  SET status = 'annule', updated_at = now()
  WHERE sale_transaction_id = v_tx.id AND status <> 'annule';

  IF v_tx.gift_card_id IS NOT NULL AND v_tx.montant_bon > 0 THEN
    UPDATE gift_cards
    SET montant_restant = montant_restant + v_tx.montant_bon,
        status = CASE WHEN status = 'epuise' THEN 'active' ELSE status END,
        updated_at = now()
    WHERE id = v_tx.gift_card_id;
  END IF;

  -- Séances prises par cette facture : rendues à leur abonnement. D'abord, pour
  -- qu'une vente d'abonnement dont la première séance figure sur la même
  -- facture puisse être annulée d'un bloc.
  FOR v_line IN
    SELECT subscription_credit_id, quantite FROM transaction_items
    WHERE transaction_id = v_tx.id AND subscription_credit_id IS NOT NULL
  LOOP
    UPDATE subscription_credits
    SET restantes = restantes + v_line.quantite::integer
    WHERE id = v_line.subscription_credit_id
    RETURNING subscription_id INTO v_sub_id;

    UPDATE subscriptions SET status = 'active'
    WHERE id = v_sub_id AND status = 'epuise';
  END LOOP;

  SELECT s.code INTO v_abo
  FROM subscriptions s
  WHERE s.sale_transaction_id = v_tx.id
    AND s.status <> 'annule'
    AND EXISTS (
      SELECT 1 FROM subscription_credits c
      WHERE c.subscription_id = s.id AND c.restantes < c.seances
    )
  LIMIT 1;

  IF v_abo IS NOT NULL THEN
    RAISE EXCEPTION 'Des séances de l''abonnement % vendu par cette facture ont déjà été prises : la vente ne peut plus être annulée.', v_abo;
  END IF;

  UPDATE subscriptions SET status = 'annule'
  WHERE sale_transaction_id = v_tx.id AND status <> 'annule';

  -- Retour en stock de chaque article vendu par cette facture.
  FOR v_line IN
    SELECT product_id, quantite FROM transaction_items
    WHERE transaction_id = v_tx.id AND product_id IS NOT NULL
  LOOP
    INSERT INTO stock_movements (product_id, type, quantite, transaction_id, motif)
    VALUES (v_line.product_id, 'retour', v_line.quantite, v_tx.id,
            'Annulation ' || v_tx.numero);
  END LOOP;

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

-- ── 5. Prolonger un abonnement ───────────────────────────────────────────────
-- Seule écriture possible depuis l'admin. L'échéance d'origine reste
-- (`expire_initiale`) et la date de la prolongation est notée.
CREATE OR REPLACE FUNCTION caisse_subscription_prolonger(p_id uuid, p_expire_le date)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub   subscriptions;
  v_today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_id FOR UPDATE;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Abonnement introuvable.';
  END IF;
  IF v_sub.status = 'annule' THEN
    RAISE EXCEPTION 'L''abonnement % est annulé.', v_sub.code;
  END IF;
  IF p_expire_le IS NULL OR p_expire_le < v_today THEN
    RAISE EXCEPTION 'La nouvelle échéance doit être aujourd''hui ou plus tard.';
  END IF;
  IF p_expire_le <= v_sub.expire_le THEN
    RAISE EXCEPTION 'Pour prolonger l''abonnement %, choisissez une date après le %.',
      v_sub.code, to_char(v_sub.expire_le, 'DD.MM.YYYY');
  END IF;

  UPDATE subscriptions
  SET expire_le = p_expire_le, prolonge_le = now()
  WHERE id = p_id
  RETURNING * INTO v_sub;

  RETURN v_sub;
END;
$$;

-- ── 6. RLS & privilèges ──────────────────────────────────────────────────────
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_credits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_counters ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['subscriptions','subscription_credits','subscription_counters'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Lecture pour l'admin ; vente, séances, annulation et prolongation passent
-- exclusivement par les fonctions ci-dessus.
CREATE POLICY "subscriptions_select_admin"        ON subscriptions        FOR SELECT TO authenticated USING (true);
CREATE POLICY "subscription_credits_select_admin" ON subscription_credits FOR SELECT TO authenticated USING (true);

REVOKE ALL ON subscriptions         FROM anon, authenticated;
REVOKE ALL ON subscription_credits  FROM anon, authenticated;
REVOKE ALL ON subscription_counters FROM anon, authenticated;
GRANT  SELECT ON subscriptions        TO authenticated;
GRANT  SELECT ON subscription_credits TO authenticated;

-- Supabase accorde EXECUTE à `anon` par défaut : le retirer nommément
-- (voir 20261015_caisse_droits_execution.sql).
REVOKE EXECUTE ON FUNCTION caisse_next_subscription_seq(integer)         FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION caisse_subscription_prolonger(uuid, date)     FROM public, anon;
GRANT  EXECUTE ON FUNCTION caisse_subscription_prolonger(uuid, date)     TO authenticated;
REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)         FROM public, anon;
GRANT  EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)         TO authenticated;
