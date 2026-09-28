-- À coller une fois dans Supabase > SQL Editor (projet agbbvwnhcadxpvgqkiyc).
-- Crée les tables manquantes : app_secrets (clé Claude), agents IA, automatisations.
-- Sans effet si elles existent déjà (IF NOT EXISTS, politiques recréées).
BEGIN;

-- ===== 20260819_app_secrets.sql =====
-- ─────────────────────────────────────────────────────────────────────────────
-- Table `app_secrets` — clés d'API et jetons saisis depuis l'admin.
--
-- Pourquoi une table à part plutôt que `settings` : `settings` est lisible
-- publiquement (`GRANT SELECT ... TO anon`), ce qui est nécessaire au rendu des
-- pages publiques. Y déposer une clé d'API reviendrait à la publier — la clé
-- anonyme Supabase est embarquée dans le bundle navigateur, donc n'importe qui
-- pourrait interroger la table.
--
-- Ici : aucun droit pour `anon`, aucune politique de lecture publique. Les
-- valeurs ne sortent jamais vers le navigateur ; les routes serveur y accèdent
-- avec la clé de service, et l'interface n'affiche qu'un état « définie ou non ».
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_secrets (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'app_secrets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app_secrets', pol.policyname);
  END LOOP;
END $$;

-- Écriture réservée à l'admin connecté. Pas de politique de lecture : même un
-- compte authentifié ne récupère pas la valeur depuis le navigateur, elle n'a
-- aucune raison d'y transiter.
CREATE POLICY "admin_write" ON app_secrets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin_update" ON app_secrets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete" ON app_secrets
  FOR DELETE TO authenticated USING (true);

REVOKE ALL ON app_secrets FROM anon;
GRANT INSERT, UPDATE, DELETE ON app_secrets TO authenticated;

-- ===== 20260819_agents.sql =====
-- ─────────────────────────────────────────────────────────────────────────────
-- Module Agents IA — tables `agents`, `agent_documents`, `agent_conversations`,
-- `agent_messages`.
--
-- Un agent est un assistant public branché sur le site : il répond aux
-- visiteurs à partir d'une base de connaissances constituée du contenu réel du
-- site (pages, articles) et de textes ajoutés à la main, puis collecte les
-- informations qualifiantes définies par l'exploitant.
--
-- Les conversations sont conservées pour deux raisons : relire ce que l'agent
-- a réellement répondu (obligation de transparence), et transformer un échange
-- en fiche de contact exploitable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  -- Détermine le gabarit d'instructions et les champs collectés par défaut.
  role          text        NOT NULL DEFAULT 'qualification'
                            CHECK (role IN ('qualification', 'devis', 'rendez_vous', 'support')),
  -- Consigne système. Complétée à l'exécution par la base de connaissances.
  system_prompt text        NOT NULL DEFAULT '',
  greeting      text        NOT NULL DEFAULT 'Bonjour ! Comment puis-je vous aider ?',
  -- Modèle et température repris de /admin/settings si laissés vides.
  model         text,
  temperature   numeric(3,2) NOT NULL DEFAULT 0.30,
  -- Garde-fou : au-delà, l'agent invite à laisser ses coordonnées plutôt que
  -- de poursuivre indéfiniment (et de consommer du budget).
  max_turns     integer     NOT NULL DEFAULT 12,
  -- Champs à récupérer au fil de l'échange :
  -- [{ key: 'email', label: 'E-mail', required: true }]
  collect_fields jsonb      NOT NULL DEFAULT '[]'::jsonb,
  enabled       boolean     NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_documents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  -- 'page' et 'article' sont réindexés depuis le contenu du site ; 'texte' est
  -- saisi à la main (tarifs, zone d'intervention, conditions).
  source_type text        NOT NULL DEFAULT 'texte'
                          CHECK (source_type IN ('page', 'article', 'texte')),
  source_ref  text,
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (agent_id, source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS agent_documents_agent_idx ON agent_documents (agent_id);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  -- Identifiant anonyme stocké côté navigateur : permet de reprendre un
  -- échange sans jamais créer de compte visiteur.
  visitor_ref text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'qualified', 'closed')),
  summary     text,
  -- Valeurs collectées, indexées par la clé déclarée dans collect_fields.
  collected   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_conversations_agent_idx
  ON agent_conversations (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text        NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_messages_conversation_idx
  ON agent_messages (conversation_id, created_at);

-- ── Sécurité au niveau des lignes ───────────────────────────────────────────
-- Les agents sont lisibles publiquement (le widget doit connaître le nom et le
-- message d'accueil) mais modifiables uniquement par l'admin. Les conversations
-- ne sont jamais lisibles publiquement : elles transitent par une route serveur
-- qui utilise la clé de service.

ALTER TABLE agents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['agents','agent_documents','agent_conversations','agent_messages']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "public_read_enabled" ON agents
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

CREATE POLICY "admin_all" ON agents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all" ON agent_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== 20260819_automations.sql =====
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

COMMIT;
NOTIFY pgrst, 'reload schema';
