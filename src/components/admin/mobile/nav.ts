/**
 * Source unique de la navigation de l'admin.
 *
 * Alimente la barre latérale (bureau), l'écran « Plus », le menu de commandes,
 * le titre de l'en-tête mobile et la barre d'onglets : une entrée ajoutée ici
 * apparaît partout, avec le même nom et la même icône.
 */
import type React from 'react';
import {
  LayoutDashboard,
  FileText,
  Settings,
  Image as ImageIcon,
  Mail,
  Send,
  BarChart2,
  CalendarDays,
  Layers,
  Menu,
  Share2,
  CreditCard,
  Users,
  BookOpenCheck,
  Sparkles,
  Gift,
  Megaphone,
  Bot,
  Workflow,
  PanelsTopLeft,
  TrendingUp,
  Rocket,
  Receipt,
  PieChart,
  Target,
  Package,
  FlaskConical,
  BadgePercent,
} from 'lucide-react';
import type { ModuleFlags } from '../../../config/moduleFlags';

export type NavItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Chemins supplémentaires qui rendent l'entrée active. */
  also?: string[];
  /** Pastille de compte (ex. demandes à rappeler). */
  badge?: number;
};
export type NavGroup = { label?: string; items: NavItem[] };

export function isItemActive(item: NavItem, pathname: string) {
  const match = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (item.exact) return pathname === item.path;
  return match(item.path) || (item.also ?? []).some(match);
}

/** Vrai si `pathname` est `base` ou une sous-route de `base`. */
export function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// ── Catalogue des entrées ────────────────────────────────────────────────────

const I = {
  dashboard: { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, exact: true },
  reservations: { name: 'Réservations', path: '/admin/reservations', icon: CalendarDays },
  offres: { name: 'Offre du moment', path: '/admin/offres', icon: BadgePercent },
  pages: { name: 'Pages', path: '/admin/pages', icon: Layers },
  medias: { name: 'Médiathèque', path: '/admin/medias', icon: ImageIcon },
  menu: { name: 'Menu', path: '/admin/menu', icon: Menu },
  entete: { name: 'En-tête et pied de page', path: '/admin/entete-pied', icon: PanelsTopLeft },
  blog: { name: 'Articles', path: '/admin/blog', icon: FileText },
  events: { name: 'Événements', path: '/admin/events', icon: CalendarDays },
  newsletter: { name: 'Newsletter', path: '/admin/newsletter', icon: Send },
  social: { name: 'Réseaux sociaux', path: '/admin/social', icon: Share2 },
  cockpit: { name: 'Cockpit Hebdo', path: '/admin/caisse/cockpit', icon: Target },
  caisse: { name: 'Encaisser', path: '/admin/caisse', icon: CreditCard, exact: true },
  journal: { name: 'Journal', path: '/admin/caisse/journal', icon: BookOpenCheck },
  clients: { name: 'Clientes', path: '/admin/caisse/clients', icon: Users },
  catalogue: {
    name: 'Catalogue & Stock',
    path: '/admin/caisse/prestations',
    icon: Sparkles,
    also: ['/admin/caisse/produits', '/admin/caisse/cabine', '/admin/caisse/cockpit'],
  },
  depenses: { name: 'Factures & Dépenses', path: '/admin/caisse/depenses', icon: Receipt },
  bilan: { name: 'Bilan & Fiscalité', path: '/admin/caisse/bilan', icon: PieChart },
  bons: { name: 'Bons cadeaux', path: '/admin/caisse/bons', icon: Gift },
  promotions: { name: 'Promotions', path: '/admin/promotions', icon: Megaphone },
  analytics: { name: 'Statistiques', path: '/admin/analytics', icon: TrendingUp },
  seo: { name: 'SEO et mots-clés', path: '/admin/seo', icon: BarChart2 },
  subscribers: { name: 'Abonnés', path: '/admin/subscribers', icon: Mail },
  autopilot: { name: 'Pilote automatique', path: '/admin/autopilot', icon: Rocket },
  agents: { name: 'Agent IA', path: '/admin/agents', icon: Bot },
  automations: { name: 'Automatisations', path: '/admin/automations', icon: Workflow },
  settings: { name: 'Paramètres', path: '/admin/settings', icon: Settings },
} satisfies Record<string, NavItem>;

export const SETTINGS_ITEM: NavItem = I.settings;

/*
 * Navigation rangée par usage : ce que l'on modifie sur le site, ce que l'on
 * publie, ce que l'on encaisse, ce que l'on mesure, ce que l'on délègue.
 * Les réglages vivent en pied de barre, à part du travail quotidien.
 */
export function buildNavGroups(flags: ModuleFlags, toCallCount = 0): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [I.dashboard, { ...I.reservations, badge: toCallCount }, I.offres],
    },
    {
      label: 'Site',
      items: [I.pages, I.medias, I.menu, I.entete],
    },
    {
      label: 'Contenu',
      items: [
        ...(flags.blog ? [I.blog] : []),
        ...(flags.events ? [I.events] : []),
        ...(flags.newsletter ? [I.newsletter] : []),
        ...(flags.social ? [I.social] : []),
      ],
    },
    ...(flags.caisse
      ? [
          {
            label: 'Caisse & Finances',
            items: [I.cockpit, I.caisse, I.journal, I.clients, I.catalogue, I.depenses, I.bilan, I.bons, I.promotions],
          },
        ]
      : []),
    {
      label: 'Audience',
      items: [I.analytics, ...(flags.keywords ? [I.seo] : []), I.subscribers],
    },
    {
      label: 'Assistants',
      items: [
        I.autopilot,
        ...(flags.agents ? [I.agents] : []),
        ...(flags.automations ? [I.automations] : []),
      ],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export function buildCommandItems(groups: NavGroup[]) {
  return [
    ...groups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.path,
        name: item.name,
        category: group.label ?? 'Accueil',
        path: item.path,
        icon: item.icon,
      })),
    ),
    { id: SETTINGS_ITEM.path, name: SETTINGS_ITEM.name, category: 'Réglages', path: SETTINGS_ITEM.path, icon: SETTINGS_ITEM.icon },
  ];
}

// ── Écran « Plus » ───────────────────────────────────────────────────────────

export type PlusEntry = {
  id: string;
  name: string;
  path: string;
  icon: React.ElementType;
  description?: string;
  badge?: number;
  /** Outil lourd : plus confortable sur grand écran. */
  heavy?: boolean;
};
export type PlusGroup = { label: string; entries: PlusEntry[] };

function entry(item: NavItem, extra: Partial<PlusEntry> & { name?: string } = {}): PlusEntry {
  return { id: item.path, name: item.name, path: item.path, icon: item.icon, badge: item.badge, ...extra };
}

/** Les groupes de l'écran « Plus », en français simple, dérivés des mêmes entrées que la barre latérale. */
export function buildPlusGroups(flags: ModuleFlags, toCallCount = 0): PlusGroup[] {
  const groups: PlusGroup[] = [
    ...(flags.caisse
      ? [
          {
            label: 'Au quotidien',
            entries: [
              entry(I.caisse, { description: 'Nouvelle vente' }),
              entry(I.journal, { description: 'Les ventes passées' }),
              entry(I.bons, { name: 'Bons cadeaux', description: 'Vendre et utiliser' }),
              entry(I.cockpit, { name: 'Cockpit hebdo', description: 'La semaine en un coup d’œil' }),
              entry(I.offres, { description: 'Site, réservation et caisse' }),
              entry(I.promotions, { description: 'Offres par e-mail ou WhatsApp' }),
            ],
          },
          {
            label: 'Ma clientèle',
            entries: [
              entry(I.clients, { description: 'Fiches et historique' }),
              entry(I.reservations, { name: 'Agenda', description: 'Rendez-vous et demandes', badge: toCallCount }),
            ],
          },
          {
            label: 'Ma gestion',
            entries: [
              entry(I.catalogue, { name: 'Catalogue et stock', description: 'Soins, produits, forfaits' }),
              entry(I.depenses, { name: 'Dépenses', description: 'Factures reçues' }),
              entry(I.bilan, { name: 'Bilan', description: 'Chiffres et fiscalité' }),
            ],
          },
        ]
      : [
          {
            label: 'Au quotidien',
            entries: [
              entry(I.reservations, { name: 'Agenda', description: 'Rendez-vous et demandes', badge: toCallCount }),
              entry(I.offres, { description: 'Site et réservation' }),
            ],
          },
        ]),
    {
      label: 'Mon site',
      entries: [
        entry(I.pages, { description: 'Modifier les textes', heavy: true }),
        entry(I.medias, { description: 'Mes photos' }),
        entry(I.menu, { description: 'Liens du haut de page' }),
        entry(I.entete, { name: 'En-tête et pied de page', description: 'Logo, coordonnées', heavy: true }),
      ],
    },
    {
      label: 'Contenu',
      entries: [
        ...(flags.blog ? [entry(I.blog, { description: 'Écrire et publier' })] : []),
        ...(flags.events ? [entry(I.events, { description: 'Ateliers et soirées' })] : []),
        ...(flags.newsletter ? [entry(I.newsletter, { description: 'Écrire à mes abonnés' })] : []),
        ...(flags.social ? [entry(I.social, { description: 'Publications' })] : []),
      ],
    },
    {
      label: 'Audience',
      entries: [
        entry(I.analytics, { description: 'Visites du site' }),
        ...(flags.keywords ? [entry(I.seo, { name: 'SEO', description: 'Être trouvée sur Google' })] : []),
        entry(I.subscribers, { description: 'Inscrits à la newsletter' }),
      ],
    },
    {
      label: 'Assistants',
      entries: [
        entry(I.autopilot, { description: 'Il s’occupe du site' }),
        ...(flags.agents ? [entry(I.agents, { description: 'Poser une question' })] : []),
        ...(flags.automations ? [entry(I.automations, { description: 'Tâches automatiques', heavy: true })] : []),
      ],
    },
  ];
  return groups.filter((g) => g.entries.length > 0);
}

// ── Sous-navigation de la caisse ─────────────────────────────────────────────

export const CAISSE_SUBNAV: { name: string; path: string; exact?: boolean; icon: React.ElementType; also?: string[] }[] = [
  { name: 'Encaisser', path: '/admin/caisse', exact: true, icon: CreditCard },
  { name: 'Journal', path: '/admin/caisse/journal', icon: BookOpenCheck },
  { name: 'Bons', path: '/admin/caisse/bons', icon: Gift },
  { name: 'Clientes', path: '/admin/caisse/clients', icon: Users },
  { name: 'Catalogue', path: '/admin/caisse/prestations', icon: Sparkles },
  { name: 'Produits', path: '/admin/caisse/produits', icon: Package },
  { name: 'Cabine', path: '/admin/caisse/cabine', icon: FlaskConical },
  { name: 'Dépenses', path: '/admin/caisse/depenses', icon: Receipt },
  { name: 'Bilan', path: '/admin/caisse/bilan', icon: PieChart },
  { name: 'Cockpit', path: '/admin/caisse/cockpit', icon: Target },
];

// ── Onglets du bas ───────────────────────────────────────────────────────────

export type TabId = 'home' | 'agenda' | 'caisse' | 'clients' | 'plus' | 'pages' | 'medias';

/** L'onglet allumé pour une route donnée : l'onglet de la section courante, « Plus » pour le reste. */
export function activeTabFor(pathname: string, caisseEnabled: boolean): TabId {
  if (pathname === '/admin') return 'home';
  if (isUnder(pathname, '/admin/reservations')) return 'agenda';
  if (caisseEnabled) {
    if (isUnder(pathname, '/admin/caisse/clients')) return 'clients';
    if (isUnder(pathname, '/admin/caisse')) return 'caisse';
  } else {
    if (isUnder(pathname, '/admin/pages')) return 'pages';
    if (isUnder(pathname, '/admin/medias')) return 'medias';
  }
  return 'plus';
}

// ── Titre et retour de l'en-tête mobile ──────────────────────────────────────

/** Écrans racines : ceux des onglets du bas. Pas de bouton retour. */
const ROOTS = new Set(['/admin', '/admin/reservations', '/admin/caisse', '/admin/caisse/clients', '/admin/plus']);

const TITLES: [string, string][] = [
  ['/admin', 'Accueil'],
  ['/admin/plus', 'Plus'],
  ['/admin/reservations', 'Agenda'],
  ['/admin/caisse', 'Caisse'],
  ['/admin/caisse/clients', 'Clientes'],
  ['/admin/caisse/journal', 'Journal'],
  ['/admin/caisse/bons', 'Bons cadeaux'],
  ['/admin/caisse/prestations', 'Catalogue'],
  ['/admin/caisse/produits', 'Produits'],
  ['/admin/caisse/cabine', 'Stock cabine'],
  ['/admin/caisse/depenses', 'Dépenses'],
  ['/admin/caisse/bilan', 'Bilan'],
  ['/admin/caisse/cockpit', 'Cockpit hebdo'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/pages', 'Pages'],
  ['/admin/pages/new', 'Nouvelle page'],
  ['/admin/pages/edit', 'Modifier la page'],
  ['/admin/medias', 'Médiathèque'],
  ['/admin/menu', 'Menu'],
  ['/admin/entete-pied', 'En-tête et pied de page'],
  ['/admin/blog', 'Articles'],
  ['/admin/blog/new', 'Nouvel article'],
  ['/admin/blog/edit', 'Modifier l’article'],
  ['/admin/events', 'Événements'],
  ['/admin/events/new', 'Nouvel événement'],
  ['/admin/events/edit', 'Modifier l’événement'],
  ['/admin/newsletter', 'Newsletter'],
  ['/admin/social', 'Réseaux sociaux'],
  ['/admin/analytics', 'Statistiques'],
  ['/admin/seo', 'SEO'],
  ['/admin/subscribers', 'Abonnés'],
  ['/admin/autopilot', 'Pilote automatique'],
  ['/admin/agents', 'Agent IA'],
  ['/admin/automations', 'Automatisations'],
  ['/admin/settings', 'Paramètres'],
];

export type RouteInfo = {
  title: string;
  /** Destination du bouton retour ; `null` sur les écrans racines. */
  backHref: string | null;
  isRoot: boolean;
};

export function getRouteInfo(pathname: string): RouteInfo {
  const path = pathname.replace(/\/+$/, '') || '/admin';
  let best: [string, string] | undefined;
  for (const t of TITLES) {
    if (isUnder(path, t[0]) && (!best || t[0].length > best[0].length)) best = t;
  }
  const title = best?.[1] ?? 'Administration';
  const matched = best?.[0] ?? '/admin';

  if (ROOTS.has(path)) return { title, backHref: null, isRoot: true };

  const editMatch = /^(.*?)\/(new|edit)(\/.*)?$/.exec(path);
  let backHref: string;
  if (editMatch) backHref = editMatch[1] || '/admin/plus';          // /admin/blog/edit/12 → /admin/blog
  else if (isUnder(path, '/admin/caisse')) backHref = '/admin/caisse';
  else if (isUnder(path, '/admin/reservations')) backHref = '/admin/reservations';
  else if (path !== matched) backHref = matched;                     // route inconnue sous un écran connu
  else backHref = '/admin/plus';                                     // écran atteint depuis « Plus »
  return { title, backHref, isRoot: false };
}
