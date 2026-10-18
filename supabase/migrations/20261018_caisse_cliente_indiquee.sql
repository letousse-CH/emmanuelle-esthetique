-- ═════════════════════════════════════════════════════════════════════════════
-- Caisse : indiquer après coup la cliente d'une facture « Client de passage ».
--
-- FAC-2026-0001 et 0002 ont été encaissées sans fiche choisie alors que les
-- clientes étaient connues. Les refaire par « Corriger » les daterait du jour
-- de la correction : ce n'est pas leur date. On permet donc d'y inscrire la
-- cliente, et seulement cela — numéro, date et montants restent verrouillés
-- comme avant (CO art. 957a).
--
-- Règles, tenues ici et pas seulement dans l'écran :
--  · Le nom d'une facture émise au nom d'une cliente ne change plus jamais
--    (il ne se changeait pas dans l'app, mais rien en base ne l'empêchait).
--    Pour la refaire : « Corriger ».
--  · Une facture « Client de passage » peut recevoir une cliente, à condition
--    que ce soit une fiche : le nom inscrit est celui de la fiche, recopié par
--    le déclencheur, jamais un texte libre venu du navigateur.
--  · `client_indiquee_le` garde la date de cet ajout : la fiduciaire voit que
--    le nom a été inscrit après l'encaissement. Une erreur de fiche se rectifie
--    en en choisissant une autre (la date est alors celle du dernier choix).
--  · Le `ON DELETE SET NULL` d'une fiche supprimée reste toléré : le nom figé
--    sur la facture ne bouge pas.
--
-- À appliquer après 20260801_caisse_bons_cadeaux.sql, dont il reprend le corps
-- de `caisse_transactions_guard` en y ajoutant le bloc « cliente ».
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_indiquee_le timestamptz;

COMMENT ON COLUMN transactions.client_indiquee_le IS
  'Date à laquelle la cliente a été inscrite sur une facture émise « Client de passage ». NULL : nom inscrit à l''encaissement.';

CREATE OR REPLACE FUNCTION caisse_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_nom text;
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

  -- ── Cliente ────────────────────────────────────────────────────────────────
  IF NEW.client_id          IS DISTINCT FROM OLD.client_id
  OR NEW.client_label       IS DISTINCT FROM OLD.client_label
  OR NEW.client_indiquee_le IS DISTINCT FROM OLD.client_indiquee_le
  THEN
    IF NEW.client_id IS NULL AND OLD.client_id IS NOT NULL
    AND NEW.client_label       IS NOT DISTINCT FROM OLD.client_label
    AND NEW.client_indiquee_le IS NOT DISTINCT FROM OLD.client_indiquee_le
    THEN
      NULL;  -- fiche supprimée (ON DELETE SET NULL) : le nom figé reste.
    ELSIF NEW.client_id IS NOT NULL
    AND OLD.status = 'payee'
    AND (
          (OLD.client_id IS NULL AND OLD.client_label = 'Client de passage')
       OR OLD.client_indiquee_le IS NOT NULL
        )
    THEN
      SELECT trim(coalesce(prenom, '') || ' ' || coalesce(nom, ''))
        INTO v_nom
        FROM clients
       WHERE id = NEW.client_id;
      IF v_nom IS NULL OR v_nom = '' THEN
        RAISE EXCEPTION 'Fiche cliente introuvable : la facture % garde son nom.', OLD.numero;
      END IF;
      NEW.client_label       := v_nom;
      NEW.client_indiquee_le := now();
    ELSIF OLD.status = 'annulee' THEN
      RAISE EXCEPTION 'La facture % est annulée : sa cliente ne se change plus.', OLD.numero;
    ELSE
      RAISE EXCEPTION 'La facture % est au nom de « % » : ce nom ne se change pas. Pour la refaire, utilisez « Corriger ».', OLD.numero, OLD.client_label;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
