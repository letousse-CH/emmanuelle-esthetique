-- ═════════════════════════════════════════════════════════════════════════════
-- Caisse : vente des bons cadeaux, TVA d'une activité non assujettie, droits
-- sur les colonnes produits ajoutées le 2026-09-27.
--
-- À appliquer APRÈS 20261005, dont elle remplace le corps de
-- `caisse_create_transaction` (même signature, les droits d'exécution sont
-- conservés). Ne jamais rejouer 20260801, 20260802 ni 20261005 ensuite.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Encaissement ──────────────────────────────────────────────────────────
--
-- a) Vente d'un bon cadeau. Depuis 20260801, la ligne de facture était insérée
--    PUIS modifiée pour y inscrire le bon émis — modification que
--    `caisse_items_guard` refuse sur toute ligne émise (CO art. 957a). Chaque
--    vente de bon échouait donc avec « Le détail d'une facture émise ne peut
--    pas être modifié ». Le bon est désormais émis AVANT les lignes, qui
--    naissent avec leur `gift_card_id` : le garde-fou reste aussi strict.
--    La valeur du bon est celle de sa ligne (prix × quantité), lue ici : le
--    montant envoyé par le navigateur n'est plus pris en compte.
--
-- b) TVA. Tant que `caisse_tva_assujetti` ne vaut pas 'true', toutes les lignes
--    sont à 0 %. Les produits portent un taux par défaut (8.1 %) prévu pour le
--    jour de l'assujettissement, et ce taux finissait sur les factures d'une
--    activité non assujettie — or une TVA mentionnée sur une facture est due,
--    même sans assujettissement (LTVA art. 27 al. 2). La vente d'un bon reste
--    à 0 % en toutes circonstances : l'impôt est dû à l'utilisation du bon.
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
  -- assujettie, 0 % sinon ; toujours 0 % pour la vente d'un bon.
  v_assujetti := coalesce(
    (SELECT lower(btrim(value)) FROM settings WHERE key = 'caisse_tva_assujetti'), 'false'
  ) = 'true';

  SELECT jsonb_agg(
           CASE WHEN v_assujetti AND NOT ((o - 1)::integer = ANY (v_ordres))
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
      / (1 + coalesce((it->>'taux_tva')::numeric, 0) / 100), 2))
  INTO v_ttc, v_ht
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

  -- ── Lignes de la facture ──────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
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
      transaction_id, service_id, product_id, offer_id, gift_card_id, description,
      prix_unitaire_ttc, quantite, taux_tva, total_ttc, prix_achat_unitaire, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      v_product_id,
      NULLIF(v_item->>'offer_id', '')::uuid,
      NULLIF(v_emis->>(v_idx::text), '')::uuid,
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

  RETURN v_tx;
END;
$$;

-- ── 2. Produits : colonnes ajoutées par 20260927 ─────────────────────────────
-- `usage_type` et `contenance` sont arrivées sans privilège pour `authenticated`
-- (20260802 accorde les droits colonne par colonne). Toute création ou
-- modification qui les citait était refusée par Postgres. `stock` reste exclu :
-- il se déduit du journal des mouvements, il ne se saisit pas.
GRANT INSERT (usage_type, contenance) ON products TO authenticated;
GRANT UPDATE (usage_type, contenance) ON products TO authenticated;
