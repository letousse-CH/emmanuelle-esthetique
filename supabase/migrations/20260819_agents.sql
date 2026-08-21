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
