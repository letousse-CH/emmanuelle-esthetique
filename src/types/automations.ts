/** Module Automatisations — types partagés admin / API / cron. */

export type TriggerType = 'schedule' | 'event' | 'manual';

export type ActionType =
  | 'webhook'
  | 'email'
  | 'generate_article'
  | 'generate_social'
  | 'keyword_scan'
  | 'newsletter_digest'
  | 'publish_scheduled';

export type RunStatus = 'success' | 'error' | 'running';

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: { cron?: string; event?: string };
  action_type: ActionType;
  action_config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  last_status: RunStatus | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  status: RunStatus;
  triggered_by: string;
  detail: Record<string, unknown>;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface ActionField {
  key: string;
  label: string;
  placeholder?: string;
  /** Phrase d'aide affichée sous le champ. */
  hint?: string;
  type?: 'text' | 'url' | 'email' | 'number';
  required?: boolean;
}

export interface ActionSpec {
  label: string;
  /** Une phrase : ce que l'action fait, vue du client. */
  description: string;
  /** Ce qui se passe concrètement, étape par étape. */
  detail: string;
  /** Ce qu'il faut avoir configuré ailleurs pour que ça marche. */
  requires?: string;
  /** L'action modifie-t-elle quelque chose de visible publiquement ? */
  publishes?: boolean;
  fields: ActionField[];
}

/**
 * Catalogue des actions.
 *
 * Chaque entrée doit répondre à trois questions que se pose la personne devant
 * l'écran : qu'est-ce que ça fait, qu'est-ce que ça produit, et de quoi ça a
 * besoin pour marcher. Les descriptions d'origine tenaient en une ligne et
 * laissaient les trois sans réponse.
 */
export const ACTION_CATALOG: Record<ActionType, ActionSpec> = {
  webhook: {
    label: 'Appeler un webhook',
    description: "Prévient un autre service que quelque chose s'est passé.",
    detail:
      "Envoie un message au format JSON à l'adresse indiquée, avec le nom de l'automatisation et la date. C'est le pont vers Make, n8n, Zapier ou votre propre outil, qui prend ensuite le relais.",
    requires: "L'adresse fournie par le service destinataire.",
    fields: [
      { key: 'url', label: 'Adresse du webhook', type: 'url', required: true,
        placeholder: 'https://hook.eu2.make.com/…',
        hint: 'Copiez-la depuis le scénario Make / n8n / Zapier qui doit recevoir le message.' },
      { key: 'secret', label: "En-tête d'authentification", placeholder: 'Bearer …',
        hint: "Facultatif. À remplir seulement si le service destinataire l'exige." },
    ],
  },
  email: {
    label: 'Envoyer un e-mail',
    description: "Vous prévient par e-mail, ou prévient quelqu'un de votre équipe.",
    detail:
      "Envoie un message court indiquant que l'automatisation s'est déclenchée et à quelle heure. Utile pour être alerté sans surveiller l'admin.",
    requires: 'La clé Resend (RESEND_API_KEY) configurée sur le serveur.',
    fields: [
      { key: 'to', label: 'Destinataire', type: 'email', required: true, placeholder: 'vous@entreprise.ch' },
      { key: 'subject', label: "Objet du message", placeholder: 'Nouvelle demande reçue',
        hint: "Facultatif — sinon le nom de l'automatisation est utilisé." },
    ],
  },
  generate_article: {
    label: "Rédiger un brouillon d'article",
    description: 'Écrit un article complet à partir de la prochaine idée en file.',
    detail:
      "Prend l'idée la plus ancienne enregistrée dans l'espace Mots-clés, rédige l'article, et le dépose dans les Articles **en brouillon**. Rien n'est mis en ligne : vous relisez avant de publier. L'idée utilisée est retirée de la file.",
    requires: "Au moins une idée enregistrée dans Mots-clés, et une clé IA valide.",
    fields: [
      { key: 'pillar', label: 'Limiter à un pilier éditorial',
        placeholder: 'ex. soins du visage',
        hint: "Facultatif. Si aucune idée ne correspond, la plus ancienne est prise quand même." },
    ],
  },
  generate_social: {
    label: 'Préparer des posts réseaux sociaux',
    description: 'Décline vos contenus récents en posts Instagram, LinkedIn et Facebook.',
    detail:
      "Repère les articles publiés, les entrées de flux RSS et les idées non encore déclinées, génère les trois formats, et les range dans le calendrier /admin/social avec une date de publication proposée. Rien n'est publié automatiquement.",
    requires: 'Le module Réseaux sociaux activé et une clé IA valide.',
    fields: [
      { key: 'count', label: 'Nombre de posts par passage', type: 'number', placeholder: '3',
        hint: 'Entre 1 et 10. Trois est un bon rythme pour ne pas saturer le calendrier.' },
    ],
  },
  keyword_scan: {
    label: 'Scanner les mots-clés',
    description: 'Relance la veille SEO et repère les sujets que vous ne couvrez pas.',
    detail:
      "Produit vingt recommandations de mots-clés classées par étape du parcours d'achat, plus une synthèse des lacunes de couverture. Le résultat est consultable dans le journal des exécutions.",
    requires: 'Une clé IA valide.',
    fields: [],
  },
  newsletter_digest: {
    label: 'Préparer une newsletter',
    description: 'Assemble un brouillon de campagne avec les articles parus depuis la dernière.',
    detail:
      "Crée un brouillon dans l'écran Newsletter, avec la liste des articles publiés depuis le dernier envoi. **Aucun e-mail n'est envoyé** : vous relisez et déclenchez l'envoi vous-même.",
    requires: 'Le module Newsletter activé et au moins un article publié récemment.',
    fields: [],
  },
  publish_scheduled: {
    label: 'Publier les articles programmés',
    description: "Met en ligne les articles dont la date de publication est arrivée.",
    detail:
      "Passe en revue les articles ayant une date de publication programmée et publie ceux dont l'heure est passée. Les pages du blog sont rafraîchies et les moteurs de recherche prévenus.",
    requires: 'Le module Blog activé.',
    publishes: true,
    fields: [],
  },
};

/**
 * Événements applicatifs qu'une automatisation peut écouter.
 *
 * `emitted` dit d'où vient réellement le signal. C'est la question que pose
 * immédiatement quelqu'un qui configure un déclencheur — et à laquelle un
 * simple intitulé ne répond pas.
 */
export interface EventSpec {
  key: string;
  label: string;
  description: string;
  emitted: string;
}

export const EVENT_CATALOG: EventSpec[] = [
  { key: 'lead.created', label: 'Une demande est reçue',
    description: "Quelqu'un remplit le formulaire de contact du site.",
    emitted: 'Au moment où le message vous est envoyé.' },
  { key: 'subscriber.created', label: 'Un abonné rejoint la newsletter',
    description: "Une adresse s'inscrit depuis le site.",
    emitted: "Après l'envoi de l'e-mail de bienvenue." },
  { key: 'sale.created', label: 'Une vente est encaissée',
    description: 'Une facture est créée depuis la caisse.',
    emitted: "Dès que l'encaissement est validé, facture émise." },
  { key: 'article.published', label: 'Un article est publié',
    description: 'Un article programmé passe en ligne.',
    emitted: 'Lors du passage de publication automatique.' },
  { key: 'agent.qualified', label: 'Un agent IA passe la main',
    description: "Une conversation atteint sa limite d'échanges et attend un humain.",
    emitted: "Quand l'agent propose de transmettre à une personne." },
];

/** Les trois façons de déclencher une automatisation, expliquées. */
export const TRIGGER_CATALOG: { key: TriggerType; label: string; description: string }[] = [
  { key: 'schedule', label: 'À intervalle régulier',
    description: 'Tous les jours, chaque lundi, une fois par mois… Vous choisissez le rythme.' },
  { key: 'event', label: "Quand quelque chose se passe",
    description: "Une demande arrive, une vente est encaissée, un abonné s'inscrit." },
  { key: 'manual', label: 'Uniquement à la demande',
    description: "Rien ne part tout seul : vous appuyez sur « Exécuter » quand vous le voulez." },
];

/**
 * Recettes prêtes à l'emploi.
 *
 * Le premier obstacle n'est pas de remplir le formulaire, c'est de savoir quoi
 * automatiser. Ces combinaisons se créent en un clic et restent modifiables.
 */
export interface AutomationRecipe {
  id: string;
  name: string;
  summary: string;
  trigger_type: TriggerType;
  trigger_config: { cron?: string; event?: string };
  action_type: ActionType;
  action_config: Record<string, string>;
}

export const AUTOMATION_RECIPES: AutomationRecipe[] = [
  {
    id: 'publish-daily',
    name: 'Publier les articles programmés',
    summary: "Chaque matin à 6 h, met en ligne les articles dont la date est arrivée.",
    trigger_type: 'schedule',
    trigger_config: { cron: '0 6 * * *' },
    action_type: 'publish_scheduled',
    action_config: {},
  },
  {
    id: 'social-weekly',
    name: 'Remplir le calendrier social',
    summary: 'Chaque lundi matin, prépare trois posts à relire pour la semaine.',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 7 * * 1' },
    action_type: 'generate_social',
    action_config: { count: '3' },
  },
  {
    id: 'lead-alert',
    name: "Être prévenu d'une nouvelle demande",
    summary: "Un e-mail dès qu'un visiteur remplit le formulaire de contact.",
    trigger_type: 'event',
    trigger_config: { event: 'lead.created' },
    action_type: 'email',
    action_config: { subject: 'Nouvelle demande depuis le site' },
  },
  {
    id: 'newsletter-monthly',
    name: 'Préparer la newsletter du mois',
    summary: 'Le 1er de chaque mois, assemble un brouillon avec les articles parus.',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 8 1 * *' },
    action_type: 'newsletter_digest',
    action_config: {},
  },
  {
    id: 'keywords-monthly',
    name: 'Veille SEO mensuelle',
    summary: 'Le 1er de chaque mois, relance la recherche de sujets à couvrir.',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 5 1 * *' },
    action_type: 'keyword_scan',
    action_config: {},
  },
  {
    id: 'sale-webhook',
    name: 'Envoyer chaque vente vers un outil externe',
    summary: 'À chaque encaissement, prévient Make / n8n / Zapier.',
    trigger_type: 'event',
    trigger_config: { event: 'sale.created' },
    action_type: 'webhook',
    action_config: {},
  },
];
