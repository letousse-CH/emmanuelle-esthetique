-- ═════════════════════════════════════════════════════════════════════════════
-- Module Finances, Factures Dépenses, Gestion Cabine, AVS & Déclaration Vaud
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Évolution de la table products pour distinguer Vente, Cabine et Matériel
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'vente';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_usage_type_check;
ALTER TABLE products ADD CONSTRAINT products_usage_type_check
  CHECK (usage_type IN ('vente', 'cabine', 'consommable', 'testeur', 'echantillon'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS contenance text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cout_dose numeric(10,2) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS products_usage_type_idx ON products (usage_type, active);

-- 2. Recette & Dotation matière par prestation (Coût de revient cabine)
CREATE TABLE IF NOT EXISTS service_supplies (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id        uuid          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantite_estimee  numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite_estimee > 0),
  notes             text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (service_id, product_id)
);

CREATE INDEX IF NOT EXISTS service_supplies_service_idx ON service_supplies (service_id);

-- 3. Catégories de dépenses (Plan comptable suisse PME / Indépendant)
CREATE TABLE IF NOT EXISTS expense_categories (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code               text        NOT NULL UNIQUE,
  nom                text        NOT NULL,
  description        text,
  groupe             text        NOT NULL, -- 'marchandises_matieres', 'personnel_avs', 'charges_exploitation', 'prelevements_prives', 'autre'
  ordre              integer     NOT NULL DEFAULT 0,
  deductible_fiscal  boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_categories_ordre_idx ON expense_categories (ordre);

-- Initialisation des catégories suisses courantes pour institut de beauté
INSERT INTO expense_categories (code, nom, description, groupe, ordre, deductible_fiscal)
VALUES
  ('4000', 'Achats marchandises boutique (revente)', 'Articles de cosmétique revendus aux clientes (PHY.V)', 'marchandises_matieres', 10, true),
  ('4200', 'Achats produits cabine & matières premières', 'Produits professionnels grands formats pour soins visage/corps (PHY.C)', 'marchandises_matieres', 20, true),
  ('4400', 'Consommables & fournitures de soin', 'Draps d''examen, bandes d''épilation, papier parathermique, sacs (PHY.A)', 'charges_exploitation', 30, true),
  ('5000', 'Cotisations sociales AVS / AI / APG', 'Cotisations pour indépendants (Caisse de compensation vaudoise)', 'personnel_avs', 40, true),
  ('5100', 'Prélèvements privés de l''exploitante', 'Rémunération / retraits de l''indépendante (non déductible du bénéfice fiscal)', 'prelevements_prives', 50, false),
  ('6000', 'Loyer & quote-part local professionnel', 'Loyer de la cabine ou quote-part professionnelle du logement à domicile', 'charges_exploitation', 60, true),
  ('6200', 'Assurances professionnelles', 'Assurance RC professionnelle, perte de gain facultative', 'charges_exploitation', 70, true),
  ('6500', 'Marketing, publicité & réseaux sociaux', 'Campagnes Instagram/Meta, Google Ads, flyers, cartes de visite', 'charges_exploitation', 80, true),
  ('6570', 'Informatique, logiciels & télécoms', 'Site web, hébergement, logiciel de caisse, abonnement mobile / internet', 'charges_exploitation', 90, true),
  ('6800', 'Frais bancaires & commissions d''encaissement', 'Commissions TWINT, commissions terminal de carte, frais de compte', 'charges_exploitation', 100, true),
  ('6900', 'Électricité, eau & blanchissage', 'Quote-part énergie, lavage du linge et des serviettes de cabine', 'charges_exploitation', 110, true),
  ('6990', 'Autres charges d''exploitation', 'Petits outillages, papeterie, frais divers', 'charges_exploitation', 120, true)
ON CONFLICT (code) DO NOTHING;

-- 4. Factures de dépenses & achats
CREATE TABLE IF NOT EXISTS expenses (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  fournisseur       text          NOT NULL,
  numero_facture    text,
  date_facture      date          NOT NULL DEFAULT CURRENT_DATE,
  date_echeance     date,
  date_paiement     date,
  montant_ht        numeric(10,2) NOT NULL DEFAULT 0 CHECK (montant_ht >= 0),
  taux_tva          numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva >= 0 AND taux_tva <= 100),
  montant_tva       numeric(10,2) NOT NULL DEFAULT 0 CHECK (montant_tva >= 0),
  montant_ttc       numeric(10,2) NOT NULL DEFAULT 0 CHECK (montant_ttc >= 0),
  category_id       uuid          REFERENCES expense_categories(id) ON DELETE SET NULL,
  statut            text          NOT NULL DEFAULT 'a_payer' CHECK (statut IN ('a_payer', 'payee', 'annulee')),
  mode_paiement     text          CHECK (mode_paiement IN ('virement', 'carte', 'twint', 'especes', 'prelevement_auto', 'echelonne')),
  notes             text,
  document_url      text,
  is_stock_invoice  boolean       NOT NULL DEFAULT false,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_date_facture_idx ON expenses (date_facture DESC);
CREATE INDEX IF NOT EXISTS expenses_statut_idx ON expenses (statut);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category_id);

-- 5. Lignes détaillées d'une facture de dépense (ex: ventilation Coskyn)
CREATE TABLE IF NOT EXISTS expense_items (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id        uuid          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  designation       text          NOT NULL,
  reference         text,
  quantite          numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantite >= 0),
  prix_unitaire     numeric(10,2) NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
  taux_tva          numeric(5,2)  NOT NULL DEFAULT 0 CHECK (taux_tva >= 0 AND taux_tva <= 100),
  rabais_pct        numeric(5,2)  NOT NULL DEFAULT 0 CHECK (rabais_pct >= 0 AND rabais_pct <= 100),
  total_ttc         numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_ttc >= 0),
  usage_type        text          DEFAULT 'vente',
  product_id        uuid          REFERENCES products(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_items_expense_idx ON expense_items (expense_id);
CREATE INDEX IF NOT EXISTS expense_items_product_idx ON expense_items (product_id);

-- 6. Sécurité RLS : lecture et écriture pour le rôle authenticated
ALTER TABLE service_supplies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_service_supplies"   ON service_supplies   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_service_supplies"  ON service_supplies   FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_expense_categories" ON expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_expense_categories" ON expense_categories FOR ALL   TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_expenses"           ON expenses           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_expenses"          ON expenses           FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_expense_items"      ON expense_items      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_expense_items"     ON expense_items      FOR ALL    TO authenticated USING (true) WITH CHECK (true);
