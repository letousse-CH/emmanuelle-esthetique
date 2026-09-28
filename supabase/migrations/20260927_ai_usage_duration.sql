-- ─────────────────────────────────────────────────────────────────────────────
-- Durée de chaque appel IA, en millisecondes.
--
-- Sert à repérer les générations qui frôlent la limite de 60 s des fonctions
-- Netlify synchrones (voir src/utils/ai.ts, modes « quick » et « long »).
-- Le code fonctionne sans cette colonne : il cesse alors simplement de
-- l'écrire.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS duration_ms integer;
