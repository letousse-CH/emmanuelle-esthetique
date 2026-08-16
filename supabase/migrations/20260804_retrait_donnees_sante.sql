-- ─────────────────────────────────────────────────────────────────────────────
-- Retrait des données de santé du fichier clientes.
--
-- Décision de l'exploitante : ne pas conserver de données de santé du tout.
-- Sont donc supprimés le champ `clients.allergies` et le journal de suivi
-- `client_notes` (observations après soin : réaction de la peau, réglages,
-- produits utilisés en cabine), introduits par `20260803_crm_clients_promotions.sql`.
--
-- Ce fichier est écrit pour être rejouable et sans effet si la migration
-- précédente n'a jamais été appliquée : `IF EXISTS` partout. On ne réécrit pas
-- `20260803` — une migration déjà appliquée quelque part ne se modifie plus,
-- sinon le fichier cesse de décrire ce que la base a réellement vécu.
--
-- ⚠️ DESTRUCTIF. `DROP COLUMN` et `DROP TABLE` effacent définitivement le
-- contenu. C'est l'objet même de la migration, mais il n'y a pas de retour :
-- une sauvegarde avant application ne coûte rien.
--
-- Ce qui RESTE au fichier clientes, et qui n'est pas de la donnée de santé :
-- coordonnées, date de naissance, notes générales (préférences, habitudes),
-- accords publicitaires, et l'historique des passages reconstruit depuis les
-- factures — lequel est une donnée comptable, conservée 10 ans par obligation
-- légale (CO art. 958f) et hors de portée de ce nettoyage.
-- ─────────────────────────────────────────────────────────────────────────────

-- Journal de suivi : la table entière, avec ses lignes.
DROP TABLE IF EXISTS client_notes;

-- Allergies et contre-indications.
ALTER TABLE clients DROP COLUMN IF EXISTS allergies;
