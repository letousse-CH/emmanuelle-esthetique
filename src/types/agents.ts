/** Module Agents IA — types partagés admin / API / widget public. */

export type AgentRole = 'qualification' | 'devis' | 'rendez_vous' | 'support';

/** Champ que l'agent doit récupérer au fil de la conversation. */
export interface AgentCollectField {
  key: string;
  label: string;
  required: boolean;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  role: AgentRole;
  system_prompt: string;
  greeting: string;
  model: string | null;
  temperature: number;
  max_turns: number;
  collect_fields: AgentCollectField[];
  avatar?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentDocumentSource = 'page' | 'article' | 'texte' | 'brief';

export interface AgentDocument {
  id: string;
  agent_id: string;
  title: string;
  source_type: AgentDocumentSource;
  source_ref: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = 'open' | 'qualified' | 'closed';

export interface AgentConversation {
  id: string;
  agent_id: string;
  visitor_ref: string;
  status: ConversationStatus;
  summary: string | null;
  collected: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/** Gabarits proposés à la création — évitent la page blanche. */
export const AGENT_ROLE_PRESETS: Record<
  AgentRole,
  { label: string; description: string; prompt: string; collect: AgentCollectField[] }
> = {
  qualification: {
    label: 'Qualification de demande',
    description: "Comprend le besoin, vérifie qu'il entre dans votre périmètre, et récupère de quoi rappeler.",
    prompt:
      "Tu qualifies les demandes entrantes. Pose une question à la fois. Vérifie que le besoin entre dans le périmètre décrit dans ta base de connaissances. Si ce n'est pas le cas, dis-le franchement plutôt que de faire perdre du temps.",
    collect: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'email', label: 'E-mail', required: true },
      { key: 'besoin', label: 'Besoin', required: true },
      { key: 'delai', label: 'Échéance', required: false },
    ],
  },
  devis: {
    label: 'Estimation de prix',
    description: "Donne une fourchette à partir de vos tarifs réels, jamais un prix ferme.",
    prompt:
      "Tu donnes une estimation de prix à partir des tarifs figurant dans ta base de connaissances. Annonce toujours une fourchette, jamais un prix ferme, et précise ce qui la ferait varier. Si l'information n'est pas dans ta base, dis que le prix doit être confirmé et propose un rappel.",
    collect: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'email', label: 'E-mail', required: true },
      { key: 'prestation', label: 'Prestation souhaitée', required: true },
      { key: 'volume', label: 'Volume / surface / quantité', required: false },
    ],
  },
  rendez_vous: {
    label: 'Prise de rendez-vous',
    description: 'Cadre le motif, propose un créneau et récupère les coordonnées.',
    prompt:
      "Tu aides le visiteur à prendre rendez-vous. Cadre d'abord le motif, puis récupère ses coordonnées. Ne confirme jamais un créneau comme définitif : annonce qu'il sera confirmé par e-mail.",
    collect: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'email', label: 'E-mail', required: true },
      { key: 'telephone', label: 'Téléphone', required: false },
      { key: 'motif', label: 'Motif', required: true },
    ],
  },
  support: {
    label: 'Réponse aux questions',
    description: 'Répond à partir du contenu du site, et passe la main quand il ne sait pas.',
    prompt:
      "Tu réponds aux questions à partir de ta base de connaissances uniquement. Si la réponse ne s'y trouve pas, dis-le clairement et propose de transmettre la question — n'invente jamais.",
    collect: [{ key: 'email', label: 'E-mail', required: false }],
  },
};
