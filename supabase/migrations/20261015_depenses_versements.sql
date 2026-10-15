-- ═════════════════════════════════════════════════════════════════════════════
-- Dépenses : paiement échelonné des factures d'achat.
--
-- À appliquer APRÈS 20261008_depenses_tickets_justificatifs.sql.
--
-- Une facture d'achat reste UNE pièce, avec son montant total : c'est la charge
-- de l'exercice de sa date (le résultat ne dépend pas de la façon de payer).
-- Ses paiements vivent à part, dans `expense_payments` :
--
--   date_paiement NULL      → échéance à venir (l'échéancier convenu avec le
--                             fournisseur) : un plan, modifiable et supprimable ;
--   date_paiement renseignée → versement effectué, écriture de trésorerie à sa
--                             date. Il ne se modifie ni ne se supprime : une
--                             erreur s'annule avec un motif, la trace reste
--                             (CO art. 957a — chronologie, traçabilité).
--
-- `expenses.statut` et `expenses.date_paiement` deviennent des reflets : ils se
-- recalculent à chaque versement (payée = versements ≥ total). Ce qui reste dû
-- au 31 décembre est une dette fournisseur de l'état du patrimoine.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expense_payments (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id         uuid          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  -- Rang dans l'échéancier (versement 2 sur 3) : affichage seulement.
  rang               integer       NOT NULL DEFAULT 1,
  date_prevue        date,
  montant            numeric(10,2) NOT NULL CHECK (montant > 0),
  date_paiement      date,
  mode_paiement      text          CHECK (mode_paiement IN ('virement', 'carte', 'twint', 'especes', 'prelevement_auto')),
  -- Référence de la transaction (relevé bancaire, n° TWINT…) et lien vers la preuve.
  reference          text,
  justificatif_url   text,
  annule             boolean       NOT NULL DEFAULT false,
  annule_le          timestamptz,
  motif_annulation   text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  CHECK (date_prevue IS NOT NULL OR date_paiement IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS expense_payments_expense_idx ON expense_payments (expense_id);
CREATE INDEX IF NOT EXISTS expense_payments_date_idx    ON expense_payments (date_paiement)
  WHERE date_paiement IS NOT NULL AND NOT annule;

-- ── 1. Un versement effectué est une écriture ────────────────────────────────
CREATE OR REPLACE FUNCTION expense_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense   expenses;
  v_engage    numeric(10,2);
  v_today     date := (now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.date_paiement IS NOT NULL THEN
      RAISE EXCEPTION 'Un versement effectué ne se supprime pas (CO art. 957a) : annulez-le avec un motif.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.date_paiement IS NOT NULL THEN
    -- Seuls l'annulation et le complément de preuve sont permis.
    IF NEW.expense_id    IS DISTINCT FROM OLD.expense_id
    OR NEW.montant       IS DISTINCT FROM OLD.montant
    OR NEW.date_paiement IS DISTINCT FROM OLD.date_paiement
    OR NEW.mode_paiement IS DISTINCT FROM OLD.mode_paiement
    OR NEW.date_prevue   IS DISTINCT FROM OLD.date_prevue
    OR NEW.rang          IS DISTINCT FROM OLD.rang
    THEN
      RAISE EXCEPTION 'Un versement effectué ne se modifie pas (CO art. 957a) : annulez-le et enregistrez le bon.';
    END IF;
    IF OLD.annule AND NOT NEW.annule THEN
      RAISE EXCEPTION 'Un versement annulé ne peut pas être rétabli : enregistrez-en un nouveau.';
    END IF;
    IF NEW.annule AND NOT OLD.annule THEN
      NEW.annule_le := now();
      IF NULLIF(btrim(coalesce(NEW.motif_annulation, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Indiquez le motif de l''annulation du versement.';
      END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Insertion, ou échéance à venir modifiée / payée.
  IF NEW.date_paiement IS NOT NULL AND NEW.date_paiement > v_today THEN
    RAISE EXCEPTION 'Un versement daté du % n''a pas encore eu lieu : enregistrez-le comme échéance.',
      to_char(NEW.date_paiement, 'DD.MM.YYYY');
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = NEW.expense_id FOR UPDATE;
  IF v_expense.statut = 'annulee' AND NOT NEW.annule THEN
    RAISE EXCEPTION 'La facture % est annulée : elle ne reçoit plus de versement.',
      coalesce(v_expense.numero_facture, v_expense.fournisseur);
  END IF;

  -- Versements et échéances ne dépassent jamais le montant de la facture.
  SELECT coalesce(sum(montant), 0) INTO v_engage
  FROM expense_payments
  WHERE expense_id = NEW.expense_id AND NOT annule AND id <> NEW.id;
  IF NOT NEW.annule AND v_engage + NEW.montant > v_expense.montant_ttc + 0.005 THEN
    RAISE EXCEPTION 'Versements et échéances (CHF %) dépasseraient le montant de la facture (CHF %).',
      to_char(v_engage + NEW.montant, 'FM999999990.00'), to_char(v_expense.montant_ttc, 'FM999999990.00');
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_payments_guard ON expense_payments;
CREATE TRIGGER expense_payments_guard
  BEFORE INSERT OR UPDATE OR DELETE ON expense_payments
  FOR EACH ROW EXECUTE FUNCTION expense_payments_guard();

-- ── 2. Statut de la facture, reflet de ses versements ────────────────────────
CREATE OR REPLACE FUNCTION expenses_sync_paiement(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_paye     numeric(10,2);
  v_dernier  date;
BEGIN
  SELECT coalesce(sum(montant), 0), max(date_paiement) INTO v_paye, v_dernier
  FROM expense_payments
  WHERE expense_id = p_expense_id AND date_paiement IS NOT NULL AND NOT annule;

  UPDATE expenses e
  SET statut        = s.statut,
      date_paiement = s.date_paiement,
      updated_at    = now()
  FROM (
    SELECT
      CASE WHEN x.statut = 'annulee' THEN 'annulee'
           WHEN x.montant_ttc > 0 AND v_paye >= x.montant_ttc - 0.005 THEN 'payee'
           ELSE 'a_payer' END AS statut,
      CASE WHEN x.statut <> 'annulee' AND x.montant_ttc > 0 AND v_paye >= x.montant_ttc - 0.005
           THEN v_dernier END AS date_paiement
    FROM expenses x WHERE x.id = p_expense_id
  ) s
  WHERE e.id = p_expense_id
    AND (e.statut, e.date_paiement) IS DISTINCT FROM (s.statut, s.date_paiement);
END;
$$;

CREATE OR REPLACE FUNCTION expense_payments_after()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM expenses_sync_paiement(CASE WHEN TG_OP = 'DELETE' THEN OLD.expense_id ELSE NEW.expense_id END);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS expense_payments_after ON expense_payments;
CREATE TRIGGER expense_payments_after
  AFTER INSERT OR UPDATE OR DELETE ON expense_payments
  FOR EACH ROW EXECUTE FUNCTION expense_payments_after();

-- ── 3. Les anciens chemins restent justes ────────────────────────────────────
-- Un ticket photographié, une dépense saisie « déjà payée » ou un changement de
-- statut fait directement sur la facture se traduisent en versements, pour que
-- la trésorerie n'ait qu'une seule source.
CREATE OR REPLACE FUNCTION expenses_versements_auto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_today   date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_paye    numeric(10,2);
  v_mode    text;
BEGIN
  -- Les mises à jour faites par expenses_sync_paiement ne sont qu'un reflet.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  v_mode := CASE WHEN NEW.mode_paiement IN ('virement', 'carte', 'twint', 'especes', 'prelevement_auto')
                 THEN NEW.mode_paiement END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.statut = 'payee' AND NEW.montant_ttc > 0 THEN
      INSERT INTO expense_payments (expense_id, rang, montant, date_paiement, mode_paiement)
      VALUES (NEW.id, 1, NEW.montant_ttc,
              least(coalesce(NEW.date_paiement, NEW.date_facture), v_today), v_mode);
    END IF;
    RETURN NULL;
  END IF;

  IF NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NULL;
  END IF;

  IF NEW.statut = 'payee' THEN
    -- « Marquer comme payée » : le solde est versé ce jour-là, l'échéancier tombe.
    DELETE FROM expense_payments WHERE expense_id = NEW.id AND date_paiement IS NULL;
    SELECT coalesce(sum(montant), 0) INTO v_paye
    FROM expense_payments WHERE expense_id = NEW.id AND date_paiement IS NOT NULL AND NOT annule;
    IF NEW.montant_ttc - v_paye > 0.005 THEN
      INSERT INTO expense_payments (expense_id, rang, montant, date_paiement, mode_paiement)
      VALUES (NEW.id,
              (SELECT coalesce(max(rang), 0) + 1 FROM expense_payments WHERE expense_id = NEW.id),
              NEW.montant_ttc - v_paye,
              least(coalesce(NEW.date_paiement, v_today), v_today), v_mode);
    END IF;
  ELSE
    -- Remise « à payer », ou facture annulée (erreur de saisie, avoir) : les
    -- versements sont annulés — la trace reste — et l'échéancier tombe.
    DELETE FROM expense_payments WHERE expense_id = NEW.id AND date_paiement IS NULL;
    UPDATE expense_payments
    SET annule = true,
        motif_annulation = CASE WHEN NEW.statut = 'annulee' THEN 'Facture annulée' ELSE 'Facture remise à payer' END
    WHERE expense_id = NEW.id AND date_paiement IS NOT NULL AND NOT annule;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS expenses_versements_auto ON expenses;
CREATE TRIGGER expenses_versements_auto
  AFTER INSERT OR UPDATE OF statut ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_versements_auto();

-- Le total d'une facture ne descend pas sous ce qui est déjà versé ou planifié,
-- et une facture qui a reçu des versements ne se supprime pas : elle s'annule.
CREATE OR REPLACE FUNCTION expenses_versements_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_engage numeric(10,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM expense_payments WHERE expense_id = OLD.id AND date_paiement IS NOT NULL) THEN
      RAISE EXCEPTION 'Cette facture a des versements enregistrés : annulez-la au lieu de la supprimer (CO art. 957a).';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.montant_ttc IS DISTINCT FROM OLD.montant_ttc THEN
    SELECT coalesce(sum(montant), 0) INTO v_engage
    FROM expense_payments WHERE expense_id = NEW.id AND NOT annule;
    IF NEW.montant_ttc + 0.005 < v_engage THEN
      RAISE EXCEPTION 'Le montant (CHF %) serait inférieur aux versements et échéances déjà enregistrés (CHF %).',
        to_char(NEW.montant_ttc, 'FM999999990.00'), to_char(v_engage, 'FM999999990.00');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_versements_guard ON expenses;
CREATE TRIGGER expenses_versements_guard
  BEFORE UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_versements_guard();

-- Un montant modifié peut rendre une facture soldée (ou non) : on resynchronise.
CREATE OR REPLACE FUNCTION expenses_montant_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    PERFORM expenses_sync_paiement(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS expenses_montant_sync ON expenses;
CREATE TRIGGER expenses_montant_sync
  AFTER UPDATE OF montant_ttc ON expenses
  FOR EACH ROW EXECUTE FUNCTION expenses_montant_sync();

-- ── 4. Reprise : chaque dépense déjà payée reçoit son versement ─────────────
INSERT INTO expense_payments (expense_id, rang, montant, date_paiement, mode_paiement)
SELECT e.id, 1, e.montant_ttc,
       least(coalesce(e.date_paiement, e.date_facture), (now() AT TIME ZONE 'Europe/Zurich')::date),
       CASE WHEN e.mode_paiement IN ('virement', 'carte', 'twint', 'especes', 'prelevement_auto')
            THEN e.mode_paiement END
FROM expenses e
WHERE e.statut = 'payee'
  AND e.montant_ttc > 0
  AND NOT EXISTS (SELECT 1 FROM expense_payments p WHERE p.expense_id = e.id);

-- ── 5. Droits : module interne ───────────────────────────────────────────────
ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_expense_payments" ON expense_payments;
CREATE POLICY "auth_all_expense_payments" ON expense_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON expense_payments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_payments TO authenticated;

-- Appelée par les déclencheurs, avec les droits de l'admin connectée : jamais
-- par le rôle public (voir 20261015_caisse_droits_execution).
REVOKE EXECUTE ON FUNCTION expenses_sync_paiement(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION expenses_sync_paiement(uuid) TO authenticated;
