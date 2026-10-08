-- ═════════════════════════════════════════════════════════════════════════════
-- Dépenses : ticket de caisse photographié, mentions légales du fournisseur,
-- TVA par taux et justificatif conservé.
--
-- À appliquer APRÈS 20260927_finances_depenses_cabine_avs.sql, qui crée les
-- tables `expenses` et `expense_categories`. Les deux ont été appliquées en
-- production le 2026-10-08 ; avant, le module Dépenses écrivait dans le
-- navigateur seulement.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Ce que la fiduciaire et le fisc demandent de lire sur une pièce d'achat.
--    `tva_details` garde la TVA taux par taux (un ticket de grande surface en
--    mélange souvent deux) : c'est ce qui servira à récupérer l'impôt préalable
--    le jour où l'activité deviendra assujettie.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type_piece          text  NOT NULL DEFAULT 'facture',
  ADD COLUMN IF NOT EXISTS fournisseur_adresse text,
  ADD COLUMN IF NOT EXISTS fournisseur_ide     text,
  ADD COLUMN IF NOT EXISTS tva_details         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS justificatif_path   text,
  ADD COLUMN IF NOT EXISTS extraction_ia       jsonb;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_type_piece_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_type_piece_check
  CHECK (type_piece IN ('facture', 'ticket', 'autre'));

-- Un ticket ventilé sur plusieurs comptes donne plusieurs lignes qui partagent
-- la même photo : l'index sert à les retrouver ensemble.
CREATE INDEX IF NOT EXISTS expenses_justificatif_idx ON expenses (justificatif_path)
  WHERE justificatif_path IS NOT NULL;

-- 2. Comptes utiles aux tickets du quotidien d'un institut.
INSERT INTO expense_categories (code, nom, description, groupe, ordre, deductible_fiscal)
VALUES
  ('6100', 'Petit matériel, linge & entretien',
   'Ustensiles, petits appareils, serviettes et linge de cabine, réparations. Un appareil coûteux (au-delà d''environ CHF 1''000) s''amortit : voir avec la fiduciaire.',
   'charges_exploitation', 62, true),
  ('6210', 'Frais de déplacement & véhicule',
   'Carburant, parking, transports publics, péages pour les trajets professionnels (fournisseur, formation, banque, poste).',
   'charges_exploitation', 72, true),
  ('6580', 'Formation continue & documentation',
   'Formations, salons professionnels, livres et abonnements métier.',
   'charges_exploitation', 92, true),
  ('6640', 'Frais de représentation',
   'Repas d''affaires, café, thé et boissons offerts aux clientes, petits cadeaux clientèle. Noter le motif et les personnes concernées.',
   'charges_exploitation', 96, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Coffre des justificatifs : privé (lecture par lien signé à durée limitée),
--    jamais réécrit ni effacé depuis l'admin — CO art. 958f, conservation
--    10 ans. Pas de policy UPDATE ni DELETE : une erreur de saisie se corrige
--    sur la dépense, la pièce d'origine reste.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('justificatifs', 'justificatifs', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "justificatifs_lecture_auth" ON storage.objects;
CREATE POLICY "justificatifs_lecture_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'justificatifs');

DROP POLICY IF EXISTS "justificatifs_ajout_auth" ON storage.objects;
CREATE POLICY "justificatifs_ajout_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'justificatifs');
