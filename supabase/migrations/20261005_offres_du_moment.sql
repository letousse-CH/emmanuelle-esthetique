-- ─────────────────────────────────────────────────────────────────────────────
-- Offres du moment — Emmanuelle Esthétique
--
-- Migration : 20261005_offres_du_moment.sql
-- À appliquer APRÈS 20261004_reservations_v2.sql ET 20260802_caisse_categories_
-- forfaits_stock.sql : la section 3 remplace le corps de `caisse_create_transaction`
-- laissé par 20260802 (même signature). Rejouer 20260802 après celle-ci ferait
-- perdre le rattachement des lignes de facture à leur offre.
--
-- L'« offre du mois » de 20261003 n'était qu'un titre, un prix et une image, une
-- seule active à la fois. Une offre du moment est une CAMPAGNE datée :
--
--   · elle vit entre `date_debut` et `date_fin` (dates de Zurich, bornes incluses) :
--     c'est la date du SOIN qui doit tomber dans la période, en ligne comme en caisse ;
--   · elle peut être limitée à `places_max` clientes ; au-delà, elle est complète et
--     disparaît du site (la caisse la garde, pour encaisser celles qui ont réservé) ;
--   · elle se réserve en ligne comme un soin à part entière (durée, prix) ;
--   · elle s'archive au lieu de se supprimer dès qu'une réservation ou une facture
--     la cite — l'historique des campagnes reste consultable par année.
--
-- Le compteur de places ne se saisit pas : il se DÉDUIT des réservations et des
-- factures (vue `monthly_offer_stats`). Règle :
--
--   places prises = lignes de facture non annulées portant l'offre
--                 + réservations encore à venir (en attente ou confirmées)
--
-- Une réservation encaissée passe en « terminé » (bouton « Encaisser » de
-- l'agenda) : elle quitte alors le second terme au moment où elle entre dans le
-- premier, et n'est jamais comptée deux fois.
--
-- Ce fichier est rejouable (IF NOT EXISTS / OR REPLACE partout).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. monthly_offers : la campagne ─────────────────────────────────────────
ALTER TABLE monthly_offers
  -- Prix habituel, affiché barré (« au lieu de »). Facultatif.
  ADD COLUMN IF NOT EXISTS prix_normal_chf     numeric(10,2)
    CHECK (prix_normal_chf IS NULL OR prix_normal_chf >= 0),
  -- Durée du soin : l'agenda en a besoin pour placer la réservation.
  ADD COLUMN IF NOT EXISTS duree_minutes       integer NOT NULL DEFAULT 60
    CHECK (duree_minutes BETWEEN 5 AND 600),
  -- Conditions affichées telles quelles (« Réservé aux 20 premières clientes »…).
  ADD COLUMN IF NOT EXISTS conditions          text,
  ADD COLUMN IF NOT EXISTS date_debut          date,
  ADD COLUMN IF NOT EXISTS date_fin            date,
  -- NULL = sans limite de nombre.
  ADD COLUMN IF NOT EXISTS places_max          integer
    CHECK (places_max IS NULL OR places_max > 0),
  ADD COLUMN IF NOT EXISTS reservable_en_ligne boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at         timestamptz;

-- `active` change de sens : il ne désigne plus « l'unique offre en cours » mais
-- « publiée » (faux = brouillon, visible dans l'admin seulement). Plusieurs offres
-- peuvent coexister ; c'est la période qui décide de ce qui est en ligne.
COMMENT ON COLUMN monthly_offers.active IS
  'Publiée (faux = brouillon). Ce sont les dates qui décident de la mise en ligne.';

-- Reprise : les offres antérieures n'ont pas de dates. On les ARCHIVE plutôt que
-- de leur inventer une période — sinon une ancienne offre (ou une offre de test)
-- réapparaîtrait d'elle-même sur le site et en caisse au déploiement.
UPDATE monthly_offers
   SET date_debut  = (created_at AT TIME ZONE 'Europe/Zurich')::date,
       date_fin    = (created_at AT TIME ZONE 'Europe/Zurich')::date,
       archived_at = COALESCE(archived_at, now())
 WHERE date_debut IS NULL OR date_fin IS NULL;

ALTER TABLE monthly_offers ALTER COLUMN date_debut SET NOT NULL;
ALTER TABLE monthly_offers ALTER COLUMN date_fin   SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_offers_periode') THEN
    ALTER TABLE monthly_offers
      ADD CONSTRAINT monthly_offers_periode CHECK (date_fin >= date_debut);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_offers_periode_idx
  ON monthly_offers (date_debut, date_fin) WHERE archived_at IS NULL;

-- ── 2. Lien facture → offre ──────────────────────────────────────────────────
-- RESTRICT : une offre déjà facturée ne peut pas être supprimée (l'admin propose
-- de l'archiver). La ligne, elle, garde son libellé et son prix figés comme
-- toute ligne de facture : l'offre ne sert qu'au décompte des places.
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES monthly_offers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS transaction_items_offer_idx
  ON transaction_items (offer_id) WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_offer_idx
  ON bookings (offer_of_month_id) WHERE offer_of_month_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Encaissement — même signature et même corps que 20260802, plus `offer_id`
--
-- `p_items` accepte une clé `offer_id`. Elle n'entre dans AUCUN calcul : le prix
-- de la ligne reste celui envoyé par la caisse, comme pour une prestation.
-- `caisse_items_guard` (20260802) interdit déjà toute modification ultérieure
-- de la ligne : l'offre citée par une facture ne peut pas être réécrite.
-- ═════════════════════════════════════════════════════════════════════════════
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
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_qte        := coalesce((v_item->>'quantite')::numeric, 1);
    v_cout       := NULL;

    -- Coût d'achat recopié depuis la fiche produit : à partir de maintenant, la
    -- marge de cette vente est figée. Modifier le tarif fournisseur demain ne
    -- réécrira pas la marge d'aujourd'hui.
    IF v_product_id IS NOT NULL THEN
      SELECT prix_achat_chf INTO v_cout FROM products WHERE id = v_product_id;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, service_id, product_id, offer_id, description, prix_unitaire_ttc,
      quantite, taux_tva, total_ttc, prix_achat_unitaire, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      v_product_id,
      NULLIF(v_item->>'offer_id', '')::uuid,
      coalesce(NULLIF(btrim(coalesce(v_item->>'description', '')), ''), 'Prestation'),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0), 2),
      v_qte,
      coalesce((v_item->>'taux_tva')::numeric, 0),
      round(coalesce((v_item->>'prix_unitaire_ttc')::numeric, 0) * v_qte, 2),
      v_cout,
      v_idx
    );

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
        v_today + (coalesce((v_emission->>'validite_mois')::integer, 60) || ' months')::interval
      )
      RETURNING * INTO v_new_card;

      UPDATE transaction_items
      SET gift_card_id = v_new_card.id
      WHERE transaction_id = v_tx.id
        AND ordre = (v_emission->>'ordre')::integer;
    END LOOP;
  END IF;

  RETURN v_tx;
END;
$$;

-- ── 4. Compteurs ─────────────────────────────────────────────────────────────
-- `security_invoker = true` : la vue s'exécute avec les droits de l'appelant,
-- donc avec la RLS de `bookings` et `transactions` (voir client_stats, 20260803).
-- `anon` n'y a pas accès : le site public passe par une route serveur.
CREATE OR REPLACE VIEW monthly_offer_stats WITH (security_invoker = true) AS
SELECT
  o.id AS offer_id,
  (SELECT count(*)::integer FROM bookings b
    WHERE b.offer_of_month_id = o.id AND b.statut IN ('en_attente', 'confirme'))      AS reservations_en_cours,
  (SELECT count(*)::integer FROM bookings b
    WHERE b.offer_of_month_id = o.id AND b.statut NOT IN ('refuse', 'annule'))        AS reservations_total,
  (SELECT COALESCE(sum(ti.quantite), 0)::integer
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
    WHERE ti.offer_id = o.id AND t.status <> 'annulee')                               AS facturations
FROM monthly_offers o;

REVOKE ALL ON monthly_offer_stats FROM anon;
GRANT SELECT ON monthly_offer_stats TO authenticated;

-- ── 5. RLS : le public ne voit que les offres publiées et non archivées ──────
DROP POLICY IF EXISTS "monthly_offers_select_public" ON monthly_offers;
CREATE POLICY "monthly_offers_select_public"
  ON monthly_offers FOR SELECT TO anon
  USING (active = true AND archived_at IS NULL);
-- (La policy « monthly_offers_all_admin » de 20261003 reste en place pour `authenticated`.)
