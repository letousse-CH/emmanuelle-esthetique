-- ═════════════════════════════════════════════════════════════════════════════
-- Achats & stock : chaque entrée en stock est justifiée par une facture
-- d'achat, et une facture ne peut entrer qu'une fois.
--
-- À appliquer APRÈS 20261015_depenses_versements.sql.
--
-- Avant : l'import d'une facture enchaînait une dizaine d'appels depuis le
-- navigateur (dépense, lignes, fiches, réceptions) — une coupure au milieu
-- laissait une facture à moitié en stock ; rien n'empêchait d'importer deux
-- fois la même facture ; une « réception » ou un « retour » pouvaient être
-- saisis sans aucune pièce.
--
-- Désormais :
--   1. `stock_importer_facture` fait tout l'import dans UNE transaction :
--      contrôles, dépense, lignes, fiches produits, réceptions. Tout ou rien.
--   2. Une facture de stock (même fournisseur, même n°, non annulée) ne
--      s'enregistre qu'une fois (index unique + verrou).
--   3. Une réception porte la facture d'achat qui la justifie, sans dépasser
--      son montant ; une ligne de facture n'entre en stock qu'une fois.
--   4. Un retour cliente ou une vente ne naissent que d'une facture de vente
--      (caisse) ; la saisie manuelle se limite à la réception justifiée et à
--      la perte / consommation. L'écart se règle par l'inventaire.
--   5. Annuler une facture de stock retire ses articles du stock (mouvements
--      inverses, la trace reste) ; elle ne se supprime pas et ne se rétablit pas.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Lien mouvement → facture d'achat ──────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS expense_id      uuid REFERENCES expenses(id)      ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS expense_item_id uuid REFERENCES expense_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS stock_movements_expense_idx
  ON stock_movements (expense_id) WHERE expense_id IS NOT NULL;

-- Une ligne de facture n'entre qu'une fois en stock (son annulation, négative, reste possible).
CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_ligne_facture_uniq
  ON stock_movements (expense_item_id) WHERE expense_item_id IS NOT NULL AND quantite > 0;

-- Une facture de stock ne s'enregistre qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS expenses_facture_stock_uniq
  ON expenses (lower(btrim(fournisseur)), btrim(numero_facture))
  WHERE is_stock_invoice AND statut <> 'annulee' AND numero_facture IS NOT NULL;

-- ── 2. Règles d'un mouvement nouveau ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION stock_mouvement_justifie()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense expenses;
  v_code    text;
  v_recu    numeric(12,2);
BEGIN
  IF NEW.type IN ('vente', 'retour') AND NEW.transaction_id IS NULL THEN
    RAISE EXCEPTION '%', CASE NEW.type
      WHEN 'vente' THEN 'Une vente se fait en caisse : elle sort du stock avec sa facture.'
      ELSE 'Un retour cliente se fait en corrigeant ou en annulant sa facture de vente (Journal) : la marchandise revient alors en stock avec la trace de la vente.'
    END;
  END IF;

  IF NEW.type = 'reception' THEN
    IF NEW.expense_id IS NULL THEN
      RAISE EXCEPTION 'Une entrée en stock se rattache à la facture d''achat qui la justifie (Factures & Dépenses).';
    END IF;
    SELECT e.* INTO v_expense FROM expenses e WHERE e.id = NEW.expense_id;
    SELECT c.code INTO v_code FROM expense_categories c WHERE c.id = v_expense.category_id;

    IF NEW.quantite > 0 THEN
      IF v_expense.statut = 'annulee' THEN
        RAISE EXCEPTION 'La facture % est annulée : elle ne fait plus entrer de stock.',
          coalesce(v_expense.numero_facture, v_expense.fournisseur);
      END IF;
      IF coalesce(v_code, '') NOT LIKE '4%' THEN
        RAISE EXCEPTION 'Seule une facture d''achat de marchandises ou de matières (comptes 4000, 4200, 4400) fait entrer du stock.';
      END IF;
      IF NEW.prix_achat_unitaire IS NULL OR NEW.prix_achat_unitaire < 0 THEN
        RAISE EXCEPTION 'Une réception indique son prix d''achat unitaire (0 pour un article offert).';
      END IF;
      -- Le stock reçu sur une facture ne dépasse pas ce qu'elle a coûté.
      SELECT coalesce(sum(m.quantite * coalesce(m.prix_achat_unitaire, 0)), 0) INTO v_recu
      FROM stock_movements m WHERE m.expense_id = NEW.expense_id AND m.type = 'reception';
      IF v_recu + NEW.quantite * NEW.prix_achat_unitaire > v_expense.montant_ttc + 0.05 THEN
        RAISE EXCEPTION 'Les réceptions rattachées à la facture % (CHF %) dépasseraient son montant (CHF %).',
          coalesce(v_expense.numero_facture, v_expense.fournisseur),
          to_char(v_recu + NEW.quantite * NEW.prix_achat_unitaire, 'FM999999990.00'),
          to_char(v_expense.montant_ttc, 'FM999999990.00');
      END IF;
    ELSIF v_expense.statut <> 'annulee' THEN
      -- Une réception négative n'existe que pour défaire une facture annulée.
      RAISE EXCEPTION 'Pour sortir du stock, saisissez une perte ou faites un inventaire.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_mouvement_justifie ON stock_movements;
CREATE TRIGGER stock_mouvement_justifie
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_mouvement_justifie();

-- ── 3. Saisie manuelle : réception justifiée ou perte, rien d'autre ──────────
DROP FUNCTION IF EXISTS caisse_stock_movement(uuid, text, numeric, numeric, text);

CREATE FUNCTION caisse_stock_movement(
  p_product_id          uuid,
  p_type                text,
  p_quantite            numeric,
  p_prix_achat_unitaire numeric DEFAULT NULL,
  p_motif               text    DEFAULT NULL,
  p_expense_id          uuid    DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
BEGIN
  IF p_type NOT IN ('reception', 'perte') THEN
    RAISE EXCEPTION 'Mouvement « % » refusé : une vente naît de la caisse, un retour cliente de la correction de sa facture, un écart de l''inventaire.', p_type;
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être un nombre positif.';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  INSERT INTO stock_movements (product_id, type, quantite, prix_achat_unitaire, motif, expense_id)
  VALUES (
    p_product_id,
    p_type,
    CASE WHEN p_type = 'perte' THEN -1 ELSE 1 END * round(p_quantite, 2),
    CASE WHEN p_type = 'reception' THEN round(p_prix_achat_unitaire, 2) END,
    NULLIF(btrim(coalesce(p_motif, '')), ''),
    CASE WHEN p_type = 'reception' THEN p_expense_id END
  );

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  RETURN v_product;
END;
$$;

REVOKE EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text, uuid) TO authenticated;

-- ── 4. Import d'une facture de stock : tout ou rien ──────────────────────────
CREATE OR REPLACE FUNCTION stock_importer_facture(
  p_facture        jsonb,
  p_lignes         jsonb,
  p_ecart_justifie boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fourn      text := NULLIF(btrim(coalesce(p_facture->>'fournisseur', '')), '');
  v_num        text := NULLIF(btrim(coalesce(p_facture->>'numero_facture', '')), '');
  v_statut     text := coalesce(NULLIF(p_facture->>'statut', ''), 'a_payer');
  v_today      date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_date       date;
  v_echeance   date;
  v_ht         numeric(10,2);
  v_tva        numeric(10,2);
  v_ttc        numeric(10,2);
  v_code       text;
  v_exist      expenses;
  v_somme      numeric(12,2) := 0;
  v_ligne      jsonb;
  v_idx        integer := 0;
  v_des        text;
  v_ref        text;
  v_q          numeric;
  v_pu         numeric;
  v_r          numeric;
  v_pv         numeric;
  v_usage      text;
  v_cout       numeric(10,2);
  v_total      numeric(10,2);
  v_prod       products;
  v_item_id    uuid;
  v_expense_id uuid;
  v_crees      integer := 0;
  v_maj        integer := 0;
  v_unites     numeric := 0;
BEGIN
  -- En-tête
  IF v_fourn IS NULL THEN RAISE EXCEPTION 'Fournisseur manquant.'; END IF;
  IF v_num IS NULL THEN
    RAISE EXCEPTION 'N° de facture manquant : c''est lui qui empêche d''importer deux fois la même facture.';
  END IF;
  BEGIN
    v_date := (p_facture->>'date_facture')::date;
    v_echeance := NULLIF(p_facture->>'date_echeance', '')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Date de facture ou d''échéance illisible.';
  END;
  IF v_date IS NULL THEN RAISE EXCEPTION 'Date de facture manquante.'; END IF;
  IF v_date > v_today THEN
    RAISE EXCEPTION 'La facture est datée du % : une date future est sans doute une erreur de lecture.', to_char(v_date, 'DD.MM.YYYY');
  END IF;
  IF v_statut NOT IN ('a_payer', 'payee') THEN RAISE EXCEPTION 'Statut de paiement invalide.'; END IF;

  v_ht  := round((p_facture->>'montant_ht')::numeric, 2);
  v_tva := round(coalesce((p_facture->>'montant_tva')::numeric, 0), 2);
  v_ttc := round((p_facture->>'montant_ttc')::numeric, 2);
  IF v_ht IS NULL OR v_ht < 0 OR v_ttc IS NULL OR v_ttc <= 0 OR v_tva < 0 THEN
    RAISE EXCEPTION 'Montants HT, TVA et TTC de la facture requis.';
  END IF;
  IF abs(v_ht + v_tva - v_ttc) > 0.05 THEN
    RAISE EXCEPTION 'HT (CHF %) + TVA (CHF %) ne donnent pas le TTC (CHF %) : vérifiez la lecture de la facture.',
      to_char(v_ht, 'FM999999990.00'), to_char(v_tva, 'FM999999990.00'), to_char(v_ttc, 'FM999999990.00');
  END IF;

  SELECT c.code INTO v_code FROM expense_categories c WHERE c.id = NULLIF(p_facture->>'category_id', '')::uuid;
  IF coalesce(v_code, '') NOT LIKE '4%' THEN
    RAISE EXCEPTION 'Une facture qui fait entrer du stock s''impute à un compte d''achat (4000, 4200 ou 4400).';
  END IF;

  -- Doublon : deux imports simultanés de la même facture s'attendent l'un l'autre.
  PERFORM pg_advisory_xact_lock(hashtext(lower(v_fourn) || '|' || v_num));
  SELECT * INTO v_exist FROM expenses
  WHERE lower(btrim(fournisseur)) = lower(v_fourn) AND btrim(numero_facture) = v_num AND statut <> 'annulee'
  LIMIT 1;
  IF v_exist.id IS NOT NULL THEN
    RAISE EXCEPTION 'La facture n° % de % est déjà enregistrée (facture du %) : un second import doublerait le stock.',
      v_num, v_fourn, to_char(v_exist.date_facture, 'DD.MM.YYYY');
  END IF;

  -- Lignes : contrôles et total
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'La facture ne contient aucune ligne.';
  END IF;
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    v_idx   := v_idx + 1;
    v_des   := NULLIF(btrim(coalesce(v_ligne->>'designation', '')), '');
    v_q     := (v_ligne->>'quantite')::numeric;
    v_pu    := (v_ligne->>'prix_unitaire')::numeric;
    v_r     := coalesce((v_ligne->>'rabais_pct')::numeric, 0);
    v_usage := coalesce(NULLIF(v_ligne->>'usage_type', ''), 'vente');
    IF v_des IS NULL THEN RAISE EXCEPTION 'Ligne % : désignation manquante.', v_idx; END IF;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Ligne % (%) : quantité invalide.', v_idx, v_des; END IF;
    IF v_pu IS NULL OR v_pu < 0 THEN RAISE EXCEPTION 'Ligne % (%) : prix unitaire invalide.', v_idx, v_des; END IF;
    IF v_r < 0 OR v_r > 100 THEN RAISE EXCEPTION 'Ligne % (%) : rabais invalide.', v_idx, v_des; END IF;
    IF v_usage NOT IN ('vente', 'cabine', 'consommable', 'testeur', 'echantillon') THEN
      RAISE EXCEPTION 'Ligne % (%) : usage invalide.', v_idx, v_des;
    END IF;
    IF NULLIF(v_ligne->>'product_id', '') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM products WHERE id = (v_ligne->>'product_id')::uuid) THEN
      RAISE EXCEPTION 'Ligne % (%) : le produit choisi n''existe plus.', v_idx, v_des;
    END IF;
    v_somme := v_somme + round(v_q * v_pu * (1 - v_r / 100), 2);
  END LOOP;

  IF abs(v_somme - v_ht) > 0.05 AND NOT coalesce(p_ecart_justifie, false) THEN
    RAISE EXCEPTION 'Les lignes totalisent CHF % HT, la facture CHF % HT : vérifiez la lecture, ou justifiez l''écart (frais de port…).',
      to_char(v_somme, 'FM999999990.00'), to_char(v_ht, 'FM999999990.00');
  END IF;

  -- La dépense
  INSERT INTO expenses (
    fournisseur, numero_facture, date_facture, date_echeance, date_paiement,
    montant_ht, taux_tva, montant_tva, montant_ttc, category_id, statut, mode_paiement,
    notes, document_url, is_stock_invoice, type_piece, fournisseur_adresse, fournisseur_ide, justificatif_path
  )
  VALUES (
    v_fourn, v_num, v_date, v_echeance,
    CASE WHEN v_statut = 'payee' THEN least(coalesce(NULLIF(p_facture->>'date_paiement', '')::date, v_date), v_today) END,
    v_ht, coalesce((p_facture->>'taux_tva')::numeric, 0), v_tva, v_ttc,
    (p_facture->>'category_id')::uuid, v_statut,
    NULLIF(p_facture->>'mode_paiement', ''),
    NULLIF(btrim(coalesce(p_facture->>'notes', '')), ''),
    NULLIF(p_facture->>'document_url', ''),
    true, 'facture',
    NULLIF(btrim(coalesce(p_facture->>'fournisseur_adresse', '')), ''),
    NULLIF(btrim(coalesce(p_facture->>'fournisseur_ide', '')), ''),
    NULLIF(p_facture->>'justificatif_path', '')
  )
  RETURNING id INTO v_expense_id;

  -- Fiches, lignes et réceptions
  v_idx := 0;
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    v_idx   := v_idx + 1;
    v_des   := btrim(v_ligne->>'designation');
    v_ref   := NULLIF(btrim(coalesce(v_ligne->>'reference', '')), '');
    v_q     := round((v_ligne->>'quantite')::numeric, 2);
    v_pu    := (v_ligne->>'prix_unitaire')::numeric;
    v_r     := coalesce((v_ligne->>'rabais_pct')::numeric, 0);
    v_usage := coalesce(NULLIF(v_ligne->>'usage_type', ''), 'vente');
    v_cout  := round(v_pu * (1 - v_r / 100), 2);
    v_total := round(v_q * v_pu * (1 - v_r / 100), 2);
    v_prod  := NULL;

    -- Fiche : celle choisie à la relecture, sinon même référence, sinon même nom.
    IF NULLIF(v_ligne->>'product_id', '') IS NOT NULL THEN
      SELECT * INTO v_prod FROM products WHERE id = (v_ligne->>'product_id')::uuid FOR UPDATE;
    END IF;
    IF v_prod.id IS NULL AND v_ref IS NOT NULL THEN
      SELECT * INTO v_prod FROM products
      WHERE regexp_replace(lower(coalesce(reference, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_ref), '[^a-z0-9]', '', 'g')
      ORDER BY active DESC, created_at
      LIMIT 1 FOR UPDATE;
    END IF;
    IF v_prod.id IS NULL THEN
      SELECT * INTO v_prod FROM products WHERE lower(btrim(nom)) = lower(v_des)
      ORDER BY active DESC, created_at
      LIMIT 1 FOR UPDATE;
    END IF;

    IF v_prod.id IS NULL THEN
      v_pv := coalesce((v_ligne->>'prix_vente')::numeric, 0);
      IF v_usage = 'vente' AND v_pv <= 0 THEN
        RAISE EXCEPTION 'Ligne % (%) : nouveau produit de revente sans prix de vente.', v_idx, v_des;
      END IF;
      INSERT INTO products (
        nom, marque, reference, prix_achat_chf, prix_vente_chf, taux_tva_defaut,
        seuil_alerte, active, ordre, usage_type, contenance, updated_at
      )
      VALUES (
        v_des,
        NULLIF(btrim(coalesce(v_ligne->>'marque', '')), ''),
        v_ref, v_cout,
        CASE WHEN v_usage = 'vente' THEN round(v_pv, 2) ELSE 0 END,
        coalesce((v_ligne->>'taux_tva')::numeric, 0),
        CASE WHEN v_usage IN ('cabine', 'consommable') THEN 1 ELSE 2 END,
        true, 99, v_usage,
        NULLIF(btrim(coalesce(v_ligne->>'contenance', '')), ''),
        now()
      )
      RETURNING * INTO v_prod;
      v_crees := v_crees + 1;
    ELSE
      -- Le tarif de cette facture devient le prix d'achat de référence (un article offert ne l'écrase pas).
      IF v_r < 100 AND v_prod.prix_achat_chf IS DISTINCT FROM v_cout THEN
        UPDATE products SET prix_achat_chf = v_cout, updated_at = now() WHERE id = v_prod.id;
      END IF;
      v_maj := v_maj + 1;
    END IF;

    INSERT INTO expense_items (
      expense_id, designation, reference, quantite, prix_unitaire, taux_tva, rabais_pct, total_ttc, usage_type, product_id
    )
    VALUES (
      v_expense_id, v_des, v_ref, v_q, round(v_pu, 2), coalesce((v_ligne->>'taux_tva')::numeric, 0),
      v_r, v_total, v_usage, v_prod.id
    )
    RETURNING id INTO v_item_id;

    INSERT INTO stock_movements (product_id, type, quantite, prix_achat_unitaire, motif, expense_id, expense_item_id)
    VALUES (v_prod.id, 'reception', v_q, v_cout, 'Facture ' || v_fourn || ' n° ' || v_num, v_expense_id, v_item_id);

    v_unites := v_unites + v_q;
  END LOOP;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'crees', v_crees, 'mis_a_jour', v_maj, 'unites', v_unites);
END;
$$;

REVOKE EXECUTE ON FUNCTION stock_importer_facture(jsonb, jsonb, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION stock_importer_facture(jsonb, jsonb, boolean) TO authenticated;

-- ── 5. Facture de stock annulée, supprimée ou rétablie ───────────────────────
-- SECURITY DEFINER : l'admin n'écrit jamais directement dans le journal de stock.
CREATE OR REPLACE FUNCTION expenses_stock_annulation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'annulee' AND OLD.statut <> 'annulee' THEN
    -- Le stock reçu sur cette facture repart : un mouvement inverse par réception.
    INSERT INTO stock_movements (product_id, type, quantite, prix_achat_unitaire, motif, expense_id, expense_item_id)
    SELECT m.product_id, 'reception', -m.quantite, m.prix_achat_unitaire,
           'Annulation facture ' || coalesce(NEW.numero_facture, NEW.fournisseur), m.expense_id, m.expense_item_id
    FROM stock_movements m
    WHERE m.expense_id = NEW.id AND m.type = 'reception' AND m.quantite > 0;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS expenses_stock_annulation ON expenses;
CREATE TRIGGER expenses_stock_annulation
  AFTER UPDATE OF statut ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_stock_annulation();

CREATE OR REPLACE FUNCTION expenses_stock_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM stock_movements WHERE expense_id = OLD.id) THEN
      RAISE EXCEPTION 'Cette facture a fait entrer du stock : annulez-la (ses articles sortiront du stock) au lieu de la supprimer.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.statut = 'annulee' AND NEW.statut <> 'annulee'
     AND EXISTS (SELECT 1 FROM stock_movements WHERE expense_id = OLD.id) THEN
    RAISE EXCEPTION 'Une facture de stock annulée ne se rétablit pas : importez-la à nouveau.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_stock_guard ON expenses;
CREATE TRIGGER expenses_stock_guard
  BEFORE UPDATE OF statut OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_stock_guard();

REVOKE EXECUTE ON FUNCTION expenses_stock_annulation() FROM public, anon;

-- ── 6. Reprise : les réceptions déjà faites rejoignent leur facture ──────────
-- Les entrées en stock antérieures (facture Coskyn du 2026-09-25) ont été
-- saisies sans lien. On les rattache à la ligne de facture de même référence,
-- pour qu'elles bénéficient des mêmes protections (pas de suppression de la
-- facture, sortie du stock si elle est annulée). Seules les colonnes de lien
-- sont écrites : quantités, prix et dates restent intacts.
ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_guard;

UPDATE stock_movements m
SET expense_id = l.expense_id, expense_item_id = l.item_id
FROM (
  -- Une ligne de facture ne reçoit qu'une réception, et réciproquement.
  SELECT DISTINCT ON (c.item_id) c.movement_id, c.expense_id, c.item_id
  FROM (
  SELECT DISTINCT ON (m2.id) m2.id AS movement_id, i.expense_id, i.id AS item_id, m2.created_at
  FROM stock_movements m2
  JOIN products p ON p.id = m2.product_id
  JOIN expense_items i
    ON regexp_replace(lower(coalesce(i.reference, '')), '[^a-z0-9]', '', 'g')
     = regexp_replace(lower(coalesce(p.reference, '')), '[^a-z0-9]', '', 'g')
   AND coalesce(p.reference, '') <> ''
  JOIN expenses e ON e.id = i.expense_id AND e.is_stock_invoice AND e.statut <> 'annulee'
  WHERE m2.type = 'reception' AND m2.quantite > 0 AND m2.expense_id IS NULL
    AND e.date_facture <= (m2.created_at AT TIME ZONE 'Europe/Zurich')::date
    AND NOT EXISTS (SELECT 1 FROM stock_movements x WHERE x.expense_item_id = i.id)
  ORDER BY m2.id, e.date_facture DESC
  ) c
  ORDER BY c.item_id, c.created_at
) l
WHERE m.id = l.movement_id;

ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_guard;
