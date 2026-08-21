-- ─────────────────────────────────────────────────────────────────────────────
-- Module Automatisations — tables `automations` et `automation_runs`.
--
-- Une automatisation relie un déclencheur (horaire, événement interne, ou
-- lancement manuel) à une action (appel d'un webhook, envoi d'e-mail,
-- génération d'un contenu, écriture dans un outil tiers).
--
-- Chaque exécution est journalisée dans `automation_runs` : sans trace, une
-- automatisation silencieuse qui échoue est indétectable, ce qui est le
-- reproche le plus fréquent fait à ce genre d'outil.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automations (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text        NOT NULL,
  description    text,

  -- 'schedule' : expression cron évaluée par /api/cron
  -- 'event'    : déclenché par le code applicatif (lead.created, sale.created…)
  -- 'manual'   : uniquement depuis le bouton « Exécuter » de l'admin
  trigger_type   text        NOT NULL DEFAULT 'manual'
                             CHECK (trigger_type IN ('schedule', 'event', 'manual')),
  -- { cron: '0 6 * * 1' } | { event: 'lead.created' }
  trigger_config jsonb       NOT NULL DEFAULT '{}'::jsonb,

  action_type    text        NOT NULL
                             CHECK (action_type IN (
                               'webhook', 'email', 'generate_article',
                               'generate_social', 'keyword_scan', 'newsletter_digest'
                             )),
  -- Dépend de action_type. Pour 'webhook' : { url, method, headers, body }.
  action_config  jsonb       NOT NULL DEFAULT '{}'::jsonb,

  enabled        boolean     NOT NULL DEFAULT true,
  last_run_at    timestamptz,
  last_status    text        CHECK (last_status IN ('success', 'error', 'running')),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_trigger_idx
  ON automations (trigger_type, enabled);

CREATE TABLE IF NOT EXISTS automation_runs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'running'
                            CHECK (status IN ('success', 'error', 'running')),
  -- Ce qui a déclenché l'exécution : 'schedule', 'manual', ou le nom de
  -- l'événement applicatif.
  triggered_by  text        NOT NULL DEFAULT 'manual',
  detail        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error         text,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS automation_runs_automation_idx
  ON automation_runs (automation_id, started_at DESC);

-- ── Sécurité au niveau des lignes ───────────────────────────────────────────
-- Rien n'est lisible publiquement : une automatisation contient des URL de
-- webhook et des jetons.

ALTER TABLE automations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['automations','automation_runs']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "admin_all" ON automations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON automation_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
