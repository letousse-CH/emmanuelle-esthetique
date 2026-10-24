-- ─────────────────────────────────────────────────────────────────────────────
-- Bons cadeaux commandés en ligne, payés par TWINT.
--
-- À appliquer après 20261022_caisse_abonnements.sql. Ne remplace AUCUNE
-- fonction de caisse : la confirmation appelle `caisse_create_transaction`
-- telle qu'elle est.
--
-- ┌─ LA RÈGLE ─────────────────────────────────────────────────────────────┐
-- │ Une commande n'est PAS une vente. Elle n'a ni numéro de facture ni bon │
-- │ tant que l'argent n'est pas arrivé.                                    │
-- │                                                                        │
-- │ Le compte TWINT de l'institut est un compte direct (code QR, lien de   │
-- │ paiement), sans interface que le site puisse interroger : c'est        │
-- │ l'exploitante qui constate le paiement dans son app TWINT, puis clique │
-- │ « Paiement reçu ». Alors seulement, et en une seule transaction        │
-- │ Postgres, la facture (mode twint) et le bon sont émis, comme une vente │
-- │ au comptoir. La recette entre à cette date, une fois.                  │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Écritures : par le serveur seul (clé de service). Le navigateur de
-- l'administration lit la table ; le public n'y a aucun accès — une commande
-- se dépose par POST /api/bons-cadeaux/commande, qui retrouve les prix dans le
-- catalogue.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gift_card_order_counters (
  annee     integer PRIMARY KEY,
  last_seq  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gift_card_orders (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  annee              integer       NOT NULL,
  number_seq         integer       NOT NULL,
  -- La référence que l'acheteuse voit (e-mail, écran de paiement) et que
  -- l'exploitante rapproche de son relevé TWINT avec le montant.
  reference          text          GENERATED ALWAYS AS
                                   ('CMD-' || annee::text || '-' || lpad(number_seq::text, 4, '0')) STORED,
  type               text          NOT NULL CHECK (type IN ('montant', 'soins')),
  -- Soins offerts, prix figés à la commande depuis le catalogue :
  -- [{ service_id, nom, prix_chf, quantite }]. Vide pour un montant libre.
  lignes             jsonb         NOT NULL DEFAULT '[]'::jsonb,
  montant            numeric(10,2) NOT NULL CHECK (montant > 0),
  libelle            text          NOT NULL,
  beneficiaire       text          NOT NULL CHECK (btrim(beneficiaire) <> ''),
  message            text          CHECK (message IS NULL OR char_length(message) <= 300),
  acheteur_prenom    text          NOT NULL,
  acheteur_nom       text          NOT NULL,
  acheteur_email     text          NOT NULL,
  acheteur_telephone text,
  status             text          NOT NULL DEFAULT 'en_attente'
                                   CHECK (status IN ('en_attente', 'payee', 'annulee')),
  client_id          uuid          REFERENCES clients(id) ON DELETE SET NULL,
  -- RESTRICT : la vente et le bon émis par une commande sont des écritures de
  -- caisse ; elles ne se suppriment pas (CO art. 957a).
  transaction_id     uuid          REFERENCES transactions(id) ON DELETE RESTRICT,
  gift_card_id       uuid          REFERENCES gift_cards(id) ON DELETE RESTRICT,
  payee_le           timestamptz,
  annulee_le         timestamptz,
  motif_annulation   text,
  -- Envoi du bon par e-mail après le paiement : réussi (date) ou refusé (motif).
  email_envoye_le    timestamptz,
  email_erreur       text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (annee, number_seq),
  CHECK (status <> 'payee' OR (transaction_id IS NOT NULL AND gift_card_id IS NOT NULL AND payee_le IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS gift_card_orders_status_idx ON gift_card_orders (status, created_at DESC);

-- Le petit mot de l'acheteuse, imprimé sur le bon (aussi à la réimpression).
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS message text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Garde-fou : ce qui a été commandé ne se réécrit pas, et une commande payée
-- ou annulée ne change plus d'état. Seules les traces d'envoi de l'e-mail
-- bougent encore (« Renvoyer le bon »).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gift_card_orders_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'payee' THEN
      RAISE EXCEPTION 'La commande % a été payée : elle ne se supprime pas.', OLD.reference;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.annee        IS DISTINCT FROM OLD.annee
  OR NEW.number_seq   IS DISTINCT FROM OLD.number_seq
  OR NEW.type         IS DISTINCT FROM OLD.type
  OR NEW.lignes       IS DISTINCT FROM OLD.lignes
  OR NEW.montant      IS DISTINCT FROM OLD.montant
  OR NEW.libelle      IS DISTINCT FROM OLD.libelle
  OR NEW.beneficiaire IS DISTINCT FROM OLD.beneficiaire
  OR NEW.message      IS DISTINCT FROM OLD.message
  OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Le contenu de la commande % ne se modifie pas : annulez-la, l''acheteuse en dépose une nouvelle.', OLD.reference;
  END IF;

  IF OLD.status <> 'en_attente' AND (
       NEW.status         IS DISTINCT FROM OLD.status
    OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
    OR NEW.gift_card_id   IS DISTINCT FROM OLD.gift_card_id
    OR NEW.payee_le       IS DISTINCT FROM OLD.payee_le
    OR NEW.annulee_le     IS DISTINCT FROM OLD.annulee_le
  ) THEN
    RAISE EXCEPTION 'La commande % est % : son état ne change plus.', OLD.reference,
      CASE OLD.status WHEN 'payee' THEN 'payée' ELSE 'annulée' END;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gift_card_orders_guard ON gift_card_orders;
CREATE TRIGGER gift_card_orders_guard
  BEFORE UPDATE OR DELETE ON gift_card_orders
  FOR EACH ROW EXECUTE FUNCTION gift_card_orders_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- Dépôt d'une commande. Le serveur a déjà validé le contenu et retrouvé les
-- prix ; la fonction alloue la référence sous verrou (même principe que les
-- factures et les bons), sans trou en cas d'échec.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bon_commande_creer(
  p_type               text,
  p_lignes             jsonb,
  p_montant            numeric,
  p_libelle            text,
  p_beneficiaire       text,
  p_message            text,
  p_acheteur_prenom    text,
  p_acheteur_nom       text,
  p_acheteur_email     text,
  p_acheteur_telephone text
)
RETURNS gift_card_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::integer;
  v_seq   integer;
  v_order gift_card_orders;
BEGIN
  INSERT INTO gift_card_order_counters (annee, last_seq)
  VALUES (v_annee, 1)
  ON CONFLICT (annee) DO UPDATE SET last_seq = gift_card_order_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  INSERT INTO gift_card_orders (
    annee, number_seq, type, lignes, montant, libelle, beneficiaire, message,
    acheteur_prenom, acheteur_nom, acheteur_email, acheteur_telephone
  )
  VALUES (
    v_annee, v_seq, p_type, coalesce(p_lignes, '[]'::jsonb), round(p_montant, 2),
    btrim(p_libelle), btrim(p_beneficiaire), NULLIF(btrim(coalesce(p_message, '')), ''),
    btrim(p_acheteur_prenom), btrim(p_acheteur_nom), lower(btrim(p_acheteur_email)),
    NULLIF(btrim(coalesce(p_acheteur_telephone, '')), '')
  )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- « Paiement reçu » : émet la facture et le bon, en une transaction.
--
-- Verrou sur la commande : deux clics (ou deux appareils) ne peuvent pas
-- émettre deux factures. Une commande déjà payée est renvoyée telle quelle —
-- le second clic ne fait rien, il ne lève pas d'erreur.
--
-- La vente passe par `caisse_create_transaction`, exactement comme un bon
-- vendu au comptoir : ligne à 0 % de TVA (l'impôt est dû à l'utilisation du
-- bon), échéance figée selon `caisse_bon_validite_mois`, numéros FAC et BON
-- alloués sans trou.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bon_commande_confirmer(p_order_id uuid, p_client_id uuid DEFAULT NULL)
RETURNS gift_card_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   gift_card_orders;
  v_tx      transactions;
  v_card_id uuid;
  v_mois    integer;
BEGIN
  SELECT * INTO v_order FROM gift_card_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;
  IF v_order.status = 'payee' THEN
    RETURN v_order;
  END IF;
  IF v_order.status = 'annulee' THEN
    RAISE EXCEPTION 'La commande % a été annulée : elle ne peut plus être encaissée.', v_order.reference;
  END IF;

  v_mois := greatest(12, coalesce(
    (SELECT NULLIF(btrim(value), '')::integer FROM settings WHERE key = 'caisse_bon_validite_mois'), 60));

  v_tx := caisse_create_transaction(
    p_client_id,
    btrim(v_order.acheteur_prenom || ' ' || v_order.acheteur_nom),
    'twint',
    'Commande en ligne ' || v_order.reference,
    jsonb_build_array(jsonb_build_object(
      'service_id', NULL,
      'description', v_order.libelle,
      'prix_unitaire_ttc', v_order.montant,
      'quantite', 1,
      'taux_tva', 0
    )),
    NULL,
    0,
    jsonb_build_array(jsonb_build_object(
      'ordre', 0,
      'libelle', v_order.libelle,
      'beneficiaire', v_order.beneficiaire,
      'validite_mois', v_mois
    )),
    NULL
  );

  SELECT id INTO v_card_id FROM gift_cards WHERE sale_transaction_id = v_tx.id;
  IF v_card_id IS NULL THEN
    RAISE EXCEPTION 'Le bon de la commande % n''a pas été émis.', v_order.reference;
  END IF;

  IF v_order.message IS NOT NULL THEN
    UPDATE gift_cards SET message = v_order.message, updated_at = now() WHERE id = v_card_id;
  END IF;

  UPDATE gift_card_orders
  SET status = 'payee',
      client_id = p_client_id,
      transaction_id = v_tx.id,
      gift_card_id = v_card_id,
      payee_le = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Droits. Le public ne lit ni n'écrit rien ici ; l'administration lit. Toute
-- écriture passe par les routes serveur (clé de service).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gift_card_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_order_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gift_card_orders_select_admin" ON gift_card_orders;
CREATE POLICY "gift_card_orders_select_admin" ON gift_card_orders FOR SELECT TO authenticated USING (true);

REVOKE ALL ON gift_card_orders         FROM anon, authenticated;
REVOKE ALL ON gift_card_order_counters FROM anon, authenticated;
GRANT  SELECT ON gift_card_orders TO authenticated;
-- Le serveur (clé de service) annule et consigne l'envoi de l'e-mail.
GRANT  ALL ON gift_card_orders, gift_card_order_counters TO service_role;

-- Supabase accorde EXECUTE à `anon` et `authenticated` nommément : REVOKE FROM
-- public ne suffit pas.
REVOKE EXECUTE ON FUNCTION bon_commande_creer(text, jsonb, numeric, text, text, text, text, text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION bon_commande_confirmer(uuid, uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION bon_commande_creer(text, jsonb, numeric, text, text, text, text, text, text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION bon_commande_confirmer(uuid, uuid) TO service_role;
