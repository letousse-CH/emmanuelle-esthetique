-- ═════════════════════════════════════════════════════════════════════════════
-- Caisse : droits d'exécution des fonctions SECURITY DEFINER.
--
-- Les migrations 20260731 à 20260802 retiraient EXECUTE à `PUBLIC`, mais
-- Supabase accorde EXECUTE explicitement à `anon` (privilèges par défaut du
-- schéma public) : ce REVOKE-là ne le touchait pas. Avec la seule clé publique
-- du site, n'importe qui pouvait donc créer ou annuler une facture, bouger le
-- stock ou consommer un compteur — ces fonctions contournent la RLS.
--
-- Le module est interne : seule l'admin connectée (`authenticated`) encaisse.
-- Les compteurs ne sont appelés que par les fonctions d'encaissement, qui
-- s'exécutent avec les droits de leur propriétaire : personne d'autre n'a à
-- les appeler (un appel isolé laisserait un trou dans la numérotation).
-- ═════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION caisse_create_transaction(uuid, text, text, text, jsonb, text, numeric, jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION caisse_cancel_transaction(uuid, text)                                               FROM anon;
REVOKE EXECUTE ON FUNCTION caisse_stock_movement(uuid, text, numeric, numeric, text)                           FROM anon;
REVOKE EXECUTE ON FUNCTION caisse_stock_inventaire(uuid, numeric, text)                                        FROM anon;

REVOKE EXECUTE ON FUNCTION caisse_next_invoice_seq(integer)   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION caisse_next_gift_card_seq(integer) FROM anon, authenticated;
