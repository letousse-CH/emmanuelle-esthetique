-- ─────────────────────────────────────────────────────────────────────────────
-- Catégories de prestations, forfaits, et gestion de stock des produits revendus.
--
-- À appliquer APRÈS `20260731_caisse.sql` et `20260801_caisse_bons_cadeaux.sql` :
-- ce fichier remplace le corps de `caisse_create_transaction` et de
-- `caisse_cancel_transaction` sans en changer la signature. Rejouer un des deux
-- fichiers précédents après celui-ci écraserait les décomptes de stock.
--
-- Trois ajouts, trois logiques distinctes :
--
--  1. CATÉGORIES — simple rangement du catalogue (Épilation, Soins du visage,
--     Soins du corps, Maquillage, Divers…). Aucun effet comptable : une facture
--     ne cite jamais une catégorie, seulement le libellé figé de la ligne.
--
--  2. FORFAITS — un lot de zones vendu à prix groupé. Le forfait EST une
--     prestation (`services.type = 'forfait'`) avec son propre prix ; sa
--     composition ne sert qu'à le construire et à afficher l'économie réalisée.
--     Il tombe dans le panier en UNE ligne, donc une seule ligne de facture.
--     C'est voulu : le prix groupé n'est pas la somme de ses parties, ventiler
--     après coup inventerait des montants que personne n'a encaissés.
--
--  3. STOCK — les produits revendus sont de la marchandise, pas une prestation.
--     Leur stock ne se saisit pas : il se DÉDUIT du journal des mouvements
--     (`stock_movements`), append-only comme le journal des recettes. Un écart
--     d'inventaire se corrige par un mouvement daté et motivé, jamais en
--     réécrivant le compteur — c'est ce qui rend l'écart explicable.
--
--     Le coût d'achat est FIGÉ sur la ligne de facture au moment de la vente
--     (`transaction_items.prix_achat_unitaire`), au même titre que le libellé
--     et le prix : renégocier un tarif fournisseur ne doit pas réécrire la
--     marge des ventes déjà passées.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Catégories de prestations
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS service_categories (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text        NOT NULL,
  ordre       integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_categories_ordre_idx ON service_categories (ordre);

-- ON DELETE SET NULL : supprimer une catégorie ne fait pas disparaître les
-- soins qu'elle rangeait — ils repassent simplement en « Sans catégorie ».
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS services_category_idx ON services (category_id, ordre);

-- Catégories de départ — uniquement si la table est vierge, pour qu'un rejeu
-- de la migration n'en recrée pas des doublons.
INSERT INTO service_categories (nom, ordre)
SELECT v.nom, v.ordre
FROM (VALUES
  ('Épilation',       0),
  ('Soins du visage', 1),
  ('Soins du corps',  2),
  ('Maquillage',      3),
  ('Divers',          4)
) AS v(nom, ordre)
WHERE NOT EXISTS (SELECT 1 FROM service_categories);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Forfaits
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'prestation';

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_type_check;
ALTER TABLE services ADD  CONSTRAINT services_type_check
  CHECK (type IN ('prestation', 'forfait'));

-- Composition d'un forfait. Purement descriptive : elle sert à le monter dans
-- l'admin et à afficher « valeur cumulée / économie », jamais à recalculer un
-- prix — celui du forfait est celui saisi dans `services.prix_chf`.
CREATE TABLE IF NOT EXISTS service_forfait_items (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  forfait_id  uuid          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  -- RESTRICT : retirer du catalogue un soin encore cité dans un forfait
  -- viderait ce forfait en silence, et son prix groupé ne voudrait plus rien
  -- dire. L'admin détecte le cas et le dit avant de supprimer.
  service_id  uuid          NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantite    numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite > 0),
  ordre       integer       NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (forfait_id, service_id)
);

CREATE INDEX IF NOT EXISTS service_forfait_items_forfait_idx
  ON service_forfait_items (forfait_id, ordre);

/**
 * Un forfait contient des prestations, jamais un autre forfait : autoriser
 * l'imbrication ouvrirait la porte aux cycles (A contient B contient A), donc
 * à un calcul de valeur cumulée qui ne terminerait pas.
 */
CREATE OR REPLACE FUNCTION caisse_forfait_items_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type text;
  v_child_type  text;
BEGIN
  IF NEW.forfait_id = NEW.service_id THEN
    RAISE EXCEPTION 'Un forfait ne peut pas se contenir lui-même.';
  END IF;

  SELECT type INTO v_parent_type FROM services WHERE id = NEW.forfait_id;
  IF v_parent_type IS DISTINCT FROM 'forfait' THEN
    RAISE EXCEPTION 'Seule une entrée de type « forfait » peut avoir une composition.';
  END IF;

  SELECT type INTO v_child_type FROM services WHERE id = NEW.service_id;
  IF v_child_type = 'forfait' THEN
    RAISE EXCEPTION 'Un forfait ne peut pas en contenir un autre : compose-le de prestations.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_forfait_items_guard ON service_forfait_items;
CREATE TRIGGER service_forfait_items_guard
  BEFORE INSERT OR UPDATE ON service_forfait_items
  FOR EACH ROW EXECUTE FUNCTION caisse_forfait_items_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Produits revendus & stock
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  nom              text          NOT NULL,
  marque           text,
  reference        text,
  description      text,
  -- Ce que coûte l'article au fournisseur. Tant que l'activité n'est pas
  -- assujettie à la TVA, elle ne récupère pas l'impôt préalable : c'est donc
  -- le montant TTC de la facture fournisseur. Le jour de l'assujettissement,
  -- saisir le prix HT — la marge se calcule contre un prix de vente HT.
  prix_achat_chf   numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_achat_chf >= 0),
  prix_vente_chf   numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_vente_chf >= 0),
  taux_tva_defaut  numeric(5,2)  NOT NULL DEFAULT 0
                                 CHECK (taux_tva_defaut >= 0 AND taux_tva_defaut <= 100),
  -- Jamais écrit à la main : maintenu par trigger depuis `stock_movements`.
  -- Le privilège UPDATE de cette colonne est retiré au rôle `authenticated`
  -- plus bas, pour que la règle ne repose pas sur la seule discipline du code.
  stock            numeric(10,2) NOT NULL DEFAULT 0,
  seuil_alerte     numeric(10,2) NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
  active           boolean       NOT NULL DEFAULT true,
  ordre            integer       NOT NULL DEFAULT 0,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_active_idx ON products (active, ordre);

/**
 * Journal des mouvements de stock — append-only, comme le journal des recettes.
 *
 * `quantite` est SIGNÉE : positive à l'entrée (réception, retour cliente,
 * inventaire à la hausse), négative à la sortie (vente, perte, inventaire à la
 * baisse). Un seul champ, donc aucun risque qu'un signe et un type se
 * contredisent.
 */
CREATE TABLE IF NOT EXISTS stock_movements (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id           uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type                 text          NOT NULL
                                     CHECK (type IN ('reception','vente','retour','inventaire','perte')),
  quantite             numeric(10,2) NOT NULL CHECK (quantite <> 0),
  -- Coût unitaire à la réception : garde la trace de l'évolution des tarifs
  -- fournisseur, indépendamment du `prix_achat_chf` courant de la fiche.
  prix_achat_unitaire  numeric(10,2),
  -- Vente ou annulation de vente. RESTRICT est sans effet en pratique : une
  -- transaction ne se supprime jamais (trigger d'immuabilité).
  transaction_id       uuid          REFERENCES transactions(id) ON DELETE RESTRICT,
  motif                text,
  created_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tx_idx      ON stock_movements (transaction_id);

-- Le stock courant est la somme des mouvements. On le matérialise sur la fiche
-- produit pour que l'écran de caisse l'affiche sans agrégat à chaque frappe.
CREATE OR REPLACE FUNCTION caisse_stock_apply()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = stock + NEW.quantite,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_apply ON stock_movements;
CREATE TRIGGER stock_movements_apply
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION caisse_stock_apply();

-- Un mouvement passé ne se réécrit pas : sinon le stock affiché cesserait
-- d'être la somme du journal, et un écart d'inventaire redeviendrait
-- inexplicable — ce que ce journal existe précisément pour éviter.
CREATE OR REPLACE FUNCTION caisse_stock_movements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un mouvement de stock ne s''efface pas : corrige par un mouvement inverse (retour, perte ou inventaire). Un produit qui a déjà bougé ne se supprime donc pas non plus — désactive-le.';
  END IF;
  RAISE EXCEPTION 'Un mouvement de stock est définitif : enregistre un mouvement inverse (retour, perte ou inventaire) plutôt que de le modifier.';
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_guard ON stock_movements;
CREATE TRIGGER stock_movements_guard
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION caisse_stock_movements_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. La ligne de facture peut désormais porter un produit
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  -- Coût figé à la vente. C'est lui, et jamais `products.prix_achat_chf`, qui
  -- sert à calculer la marge d'une période révolue.
  ADD COLUMN IF NOT EXISTS prix_achat_unitaire numeric(10,2);

CREATE INDEX IF NOT EXISTS transaction_items_product_idx ON transaction_items (product_id);

-- Le guard d'immuabilité doit connaître les deux nouvelles colonnes : `product_id`
-- rejoint la liste des `ON DELETE SET NULL` tolérés, `prix_achat_unitaire` celle
-- des valeurs qui ne bougent plus.
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
    OR (NEW.product_id   IS NULL AND OLD.product_id   IS NOT NULL)
     )
  AND NEW.transaction_id      IS NOT DISTINCT FROM OLD.transaction_id
  AND NEW.description         IS NOT DISTINCT FROM OLD.description
  AND NEW.prix_unitaire_ttc   IS NOT DISTINCT FROM OLD.prix_unitaire_ttc
  AND NEW.quantite            IS NOT DISTINCT FROM OLD.quantite
  AND NEW.taux_tva            IS NOT DISTINCT FROM OLD.taux_tva
  AND NEW.total_ttc           IS NOT DISTINCT FROM OLD.total_ttc
  AND NEW.prix_achat_unitaire IS NOT DISTINCT FROM OLD.prix_achat_unitaire
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Le détail d''une facture émise ne peut pas être modifié (CO art. 957a).';
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Encaissement — même signature, le corps sait maintenant sortir du stock
--
-- `p_items` accepte une clé `product_id` en plus de `service_id`. Les deux
-- s'excluent en pratique (une ligne vend soit un soin, soit un article), mais
-- rien ne l'impose : le libellé et le prix restent la seule vérité de la ligne.
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
      transaction_id, service_id, product_id, description, prix_unitaire_ttc,
      quantite, taux_tva, total_ttc, prix_achat_unitaire, ordre
    )
    VALUES (
      v_tx.id,
      NULLIF(v_item->>'service_id', '')::uuid,
      v_product_id,
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

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Annulation — la marchandise revient en rayon
--
-- Par un mouvement INVERSE, jamais en effaçant la sortie : le journal de stock
-- doit raconter ce qui s'est passé, pas ce qu'on aurait voulu.
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Mouvements de stock saisis à la main
--
-- Le navigateur n'a aucun privilège d'écriture sur `stock_movements` : il passe
-- par ces deux fonctions, exactement comme il passe par `caisse_create_transaction`
-- pour écrire un montant. Un mouvement `vente` ne peut donc naître que d'une
-- vraie vente, et pas d'un appel forgé depuis la console du navigateur.
--
-- `p_quantite` est une quantité POSITIVE : c'est le type qui décide du sens.
-- Demander un signe à l'utilisateur, c'est se garantir une perte saisie en +.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION caisse_stock_movement(
  p_product_id          uuid,
  p_type                text,
  p_quantite            numeric,
  p_prix_achat_unitaire numeric DEFAULT NULL,
  p_motif               text    DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
  v_signe   integer;
BEGIN
  IF p_type NOT IN ('reception', 'retour', 'perte') THEN
    RAISE EXCEPTION 'Type de mouvement invalide : %. Une sortie de vente naît de la caisse, un écart d''inventaire de caisse_stock_inventaire.', p_type;
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être un nombre positif.';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  v_signe := CASE WHEN p_type = 'perte' THEN -1 ELSE 1 END;

  INSERT INTO stock_movements (product_id, type, quantite, prix_achat_unitaire, motif)
  VALUES (
    p_product_id,
    p_type,
    v_signe * round(p_quantite, 2),
    CASE WHEN p_type = 'reception' THEN round(p_prix_achat_unitaire, 2) ELSE NULL END,
    NULLIF(btrim(coalesce(p_motif, '')), '')
  );

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  RETURN v_product;
END;
$$;

/**
 * Inventaire : on saisit ce qu'on a COMPTÉ dans le tiroir, la fonction en
 * déduit l'écart et l'enregistre comme mouvement. Le compteur n'est jamais
 * écrasé — c'est l'écart qui est archivé, avec son motif, et c'est lui qui
 * s'explique devant la fiducie.
 */
CREATE OR REPLACE FUNCTION caisse_stock_inventaire(
  p_product_id uuid,
  p_stock_reel numeric,
  p_motif      text DEFAULT NULL
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
  v_ecart   numeric(10,2);
BEGIN
  IF p_stock_reel IS NULL OR p_stock_reel < 0 THEN
    RAISE EXCEPTION 'Le stock compté ne peut pas être négatif.';
  END IF;

  -- FOR UPDATE : entre la lecture du stock et l'écriture de l'écart, aucune
  -- vente ne doit se glisser — elle serait annulée par la correction.
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;

  v_ecart := round(p_stock_reel, 2) - v_product.stock;

  IF v_ecart = 0 THEN
    RETURN v_product;  -- rien à corriger : pas de mouvement fantôme au journal
  END IF;

  INSERT INTO stock_movements (product_id, type, quantite, motif)
  VALUES (
    p_product_id, 'inventaire', v_ecart,
    coalesce(
      NULLIF(btrim(coalesce(p_motif, '')), ''),
      'Inventaire — stock compté : ' || to_char(round(p_stock_reel, 2), 'FM999999990.##')
    )
  );

  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  RETURN v_product;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. RLS & privilèges — module interne, rien n'est exposé au rôle `anon`
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE service_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_forfait_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements       ENABLE ROW LEVEL SECURITY;

-- `products` est un nom générique : on filtre sur le schéma `public`, sinon une
-- table homonyme d'un autre schéma verrait ses policies supprimées.
DO $$
DECLARE pol RECORD; tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['service_categories','service_forfait_items','products','stock_movements'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "service_categories_all_admin"    ON service_categories    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_forfait_items_all_admin" ON service_forfait_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_all_admin"              ON products              FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Lecture seule : le journal de stock s'écrit exclusivement par les fonctions.
CREATE POLICY "stock_movements_select_admin"    ON stock_movements       FOR SELECT TO authenticated USING (true);

REVOKE ALL ON service_categories    FROM anon;
REVOKE ALL ON service_forfait_items FROM anon;
REVOKE ALL ON products              FROM anon, authenticated;
REVOKE ALL ON stock_movements       FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON service_categories    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_forfait_items TO authenticated;
GRANT SELECT                         ON stock_movements       TO authenticated;

-- Privilèges COLONNE par COLONNE sur `products` : `stock` en est volontairement
-- absent. La règle « le stock se déduit du journal, il ne se saisit pas » cesse
-- ainsi de reposer sur la discipline du code applicatif — même un appel direct
-- à PostgREST se ferait refuser par Postgres.
GRANT SELECT, DELETE ON products TO authenticated;
GRANT INSERT (nom, marque, reference, description, prix_achat_chf, prix_vente_chf,
              taux_tva_defaut, seuil_alerte, active, ordre, updated_at)
  ON products TO authenticated;
GRANT UPDATE (nom, marque, reference, description, prix_achat_chf, prix_vente_chf,
              taux_tva_defaut, seuil_alerte, active, ordre, updated_at)
  ON products TO authenticated;

REVOKE EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text) FROM public;
REVOKE EXECUTE ON FUNCTION caisse_stock_inventaire(uuid, numeric, text)              FROM public;
GRANT  EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION caisse_stock_inventaire(uuid, numeric, text)              TO authenticated;
