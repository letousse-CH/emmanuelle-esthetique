"use client";

import React, { useState } from 'react';
import './admin.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { useAppMode } from '../../hooks/useAppMode';
import { useAdminAccent } from '../../hooks/useAdminAccent';
import SystemHealthPill from '../../components/admin/SystemHealthPill';
import {
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Image as ImageIcon,
  Mail,
  Send,
  BarChart2,
  CalendarDays,
  Layers,
  Menu,
  ExternalLink,
  Share2,
  CreditCard,
  Users,
  BookOpenCheck,
  Sparkles,
  Gift,
  Megaphone,
  Bot,
  Workflow,
  AlertTriangle,
  PanelsTopLeft,
  TrendingUp,
  Rocket,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Receipt,
  PieChart,
  Target,
} from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SITE_CONFIG } from '../../config/site';
import { CommandMenu, Kbd } from '../../components/admin/ui';

type NavItem = {
  name: string;
  path: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Chemins supplémentaires qui rendent l'entrée active. */
  also?: string[];
};
type NavGroup = { label?: string; items: NavItem[] };

function isItemActive(item: NavItem, pathname: string) {
  const match = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (item.exact) return pathname === item.path;
  return match(item.path) || (item.also ?? []).some(match);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const moduleFlags = useModuleFlags();
  const siteName = useSettings(['business_name']).business_name;
  const appMode = useAppMode();
  useAdminAccent();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<any>(null);
  const [aiBudget, setAiBudget] = useState<any>(null);

  const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const asideRef = React.useRef<HTMLElement>(null);
  const quickCreateRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setMobileOpen(false); setQuickCreateOpen(false); }, [pathname]);

  // Recherche rapide : ⌘K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Menu « Créer » : fermeture au clic extérieur et à Échap
  React.useEffect(() => {
    if (!quickCreateOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!quickCreateRef.current?.contains(e.target as Node)) setQuickCreateOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setQuickCreateOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [quickCreateOpen]);

  // Tiroir mobile
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    asideRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      mobileMenuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const checkAiStatus = async (force = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const url = `/api/admin/ai-status${force ? '?refresh=true' : ''}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch AI status:', err);
    }
  };

  const checkAiBudget = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/ai-usage', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setAiBudget(await res.json());
    } catch (err) {
      console.error('Failed to fetch AI budget:', err);
    }
  };

  React.useEffect(() => {
    const isScreenshot = typeof window !== 'undefined' && (
      window.location.search.includes('screenshot=true') ||
      document.cookie.includes('screenshot_bypass=true')
    );

    if (isScreenshot) return;

    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      checkAiStatus();
      checkAiBudget();
    }
  }, [user, loading, router]);

  // Une clé Claude enregistrée ou retirée dans Paramètres : on refait le
  // diagnostic tout de suite, pour que le bandeau ne reste pas périmé.
  React.useEffect(() => {
    const onKeyChange = () => { void checkAiStatus(true); };
    window.addEventListener('admin:ai-key-changed', onKeyChange);
    return () => window.removeEventListener('admin:ai-key-changed', onKeyChange);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  /*
   * Navigation rangée par usage : ce que l'on modifie sur le site, ce que l'on
   * publie, ce que l'on encaisse, ce que l'on mesure, ce que l'on délègue.
   * Les réglages vivent en pied de barre, à part du travail quotidien.
   */
  const navGroups: NavGroup[] = ([
    {
      items: [
        { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, exact: true },
        { name: 'Réservations', path: '/admin/reservations', icon: CalendarDays },
      ],
    },
    {
      label: 'Site',
      items: [
        { name: 'Pages', path: '/admin/pages', icon: Layers },
        { name: 'Médiathèque', path: '/admin/medias', icon: ImageIcon },
        { name: 'Menu', path: '/admin/menu', icon: Menu },
        { name: 'En-tête et pied de page', path: '/admin/entete-pied', icon: PanelsTopLeft },
      ],
    },
    {
      label: 'Contenu',
      items: [
        ...(moduleFlags.blog ? [{ name: 'Articles', path: '/admin/blog', icon: FileText }] : []),
        ...(moduleFlags.events ? [{ name: 'Événements', path: '/admin/events', icon: CalendarDays }] : []),
        ...(moduleFlags.newsletter ? [{ name: 'Newsletter', path: '/admin/newsletter', icon: Send }] : []),
        ...(moduleFlags.social ? [{ name: 'Réseaux sociaux', path: '/admin/social', icon: Share2 }] : []),
      ],
    },
    ...(moduleFlags.caisse
      ? [
          {
            label: 'Caisse & Finances',
            items: [
              { name: 'Cockpit Hebdo', path: '/admin/caisse/cockpit', icon: Target },
              { name: 'Encaisser', path: '/admin/caisse', icon: CreditCard, exact: true },
              { name: 'Journal', path: '/admin/caisse/journal', icon: BookOpenCheck },
              { name: 'Clientes', path: '/admin/caisse/clients', icon: Users },
              { name: 'Catalogue & Stock', path: '/admin/caisse/prestations', icon: Sparkles, also: ['/admin/caisse/produits', '/admin/caisse/cabine', '/admin/caisse/cockpit'] },
              { name: 'Factures & Dépenses', path: '/admin/caisse/depenses', icon: Receipt },
              { name: 'Bilan & Fiscalité', path: '/admin/caisse/bilan', icon: PieChart },
              { name: 'Bons cadeaux', path: '/admin/caisse/bons', icon: Gift },
              { name: 'Promotions', path: '/admin/promotions', icon: Megaphone },
            ],
          },
        ]
      : []),
    {
      label: 'Audience',
      items: [
        { name: 'Statistiques', path: '/admin/analytics', icon: TrendingUp },
        ...(moduleFlags.keywords ? [{ name: 'SEO et mots-clés', path: '/admin/seo', icon: BarChart2 }] : []),
        { name: 'Abonnés', path: '/admin/subscribers', icon: Mail },
      ],
    },
    {
      label: 'Assistants',
      items: [
        { name: 'Pilote automatique', path: '/admin/autopilot', icon: Rocket },
        ...(moduleFlags.agents ? [{ name: 'Agent IA', path: '/admin/agents', icon: Bot }] : []),
        ...(moduleFlags.automations ? [{ name: 'Automatisations', path: '/admin/automations', icon: Workflow }] : []),
      ],
    },
  ] as NavGroup[]).filter((group) => group.items.length > 0);

  const settingsItem: NavItem = { name: 'Paramètres', path: '/admin/settings', icon: Settings };

  const fullBleed = /^\/admin\/pages\/(new|edit)/.test(pathname);

  const allItems = [...navGroups.flatMap((g) => g.items), settingsItem];
  const currentItem = allItems
    .filter((item) => isItemActive(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const currentGroup = navGroups.find((g) => currentItem && g.items.includes(currentItem))?.label;

  const commandItems = [
    ...navGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.path,
        name: item.name,
        category: group.label ?? 'Accueil',
        path: item.path,
        icon: item.icon,
      })),
    ),
    { id: settingsItem.path, name: settingsItem.name, category: 'Réglages', path: settingsItem.path, icon: settingsItem.icon },
  ];

  const quickCreate = [
    ...(moduleFlags.blog ? [{ label: 'Article', href: '/admin/blog/new', icon: FileText }] : []),
    { label: 'Page', href: '/admin/pages/new', icon: Layers },
    ...(moduleFlags.events ? [{ label: 'Événement', href: '/admin/events/new', icon: CalendarDays }] : []),
    ...(moduleFlags.caisse
      ? [
          { label: 'Encaissement', href: '/admin/caisse', icon: CreditCard },
          { label: 'Fiche cliente', href: '/admin/caisse/clients', icon: Users },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-stone-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-accent animate-spin" />
          <p className="text-stone-600 text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (appMode) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <main id="admin-main-content" className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          {children}
        </main>
      </div>
    );
  }

  const navLink = (item: NavItem) => {
    const active = isItemActive(item, pathname);
    return (
      <Link
        key={item.path}
        href={item.path}
        title={collapsed ? item.name : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 rounded-lg px-3 h-10 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          active
            ? 'bg-white text-accent font-semibold ring-1 ring-stone-200 shadow-xs'
            : 'text-stone-900 font-medium hover:bg-stone-200/60'
        } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
      >
        <item.icon
          size={17}
          strokeWidth={active ? 2.2 : 1.9}
          className={`shrink-0 ${active ? 'text-accent' : 'text-stone-700'}`}
        />
        <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-white flex text-stone-900 antialiased font-sans">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-accent focus:text-accent-fg focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Aller au contenu
      </a>

      {/* Voile mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-stone-900/30 z-30 lg:hidden"
        />
      )}

      {/* Barre latérale */}
      <aside
        ref={asideRef}
        aria-label="Navigation principale"
        className={`fixed inset-y-0 left-0 z-40 w-64 lg:sticky lg:top-0 lg:h-screen lg:z-auto ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-64'
        } shrink-0 bg-stone-50 border-r border-stone-200 flex flex-col transition-[width,transform] duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Marque */}
        <div className={`h-16 flex items-center shrink-0 ${collapsed ? 'lg:justify-center px-4 lg:px-0' : 'px-5'}`}>
          <Link
            href="/admin"
            className="flex items-center gap-3 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <span className="size-8 rounded-lg bg-accent text-accent-fg grid place-items-center text-[13px] font-semibold shrink-0">
              {(siteName || 'S').charAt(0).toUpperCase()}
            </span>
            <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="block text-[15px] font-semibold text-stone-950 truncate tracking-tight">
                {siteName || 'Administration'}
              </span>
              <span className="block text-[13px] text-stone-600">Administration</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
            className="ml-auto lg:hidden p-2 -mr-2 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-1 space-y-6">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`}>
              {group.label && (
                <p className={`px-3 mb-1.5 text-[13px] font-semibold text-stone-600 ${collapsed ? 'lg:hidden' : ''}`}>
                  {group.label}
                </p>
              )}
              {group.label && collapsed && <div className="hidden lg:block mx-3 mb-2 border-t border-stone-200" />}
              <div className="space-y-0.5">{group.items.map(navLink)}</div>
            </div>
          ))}
        </nav>

        {/* Pied de barre */}
        <div className="px-3 py-3 space-y-0.5 border-t border-stone-200">
          {navLink(settingsItem)}
          <a
            href={SITE_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Voir le site' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 h-10 text-[15px] font-medium text-stone-900 hover:bg-stone-200/60 transition-colors ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <ExternalLink size={17} strokeWidth={1.9} className="shrink-0 text-stone-700" />
            <span className={collapsed ? 'lg:hidden' : ''}>Voir le site</span>
          </a>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 h-10 text-[15px] font-medium text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOut size={17} strokeWidth={1.9} className="shrink-0 text-stone-700" />
            <span className={collapsed ? 'lg:hidden' : ''}>Déconnexion</span>
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
            aria-pressed={collapsed}
            title={collapsed ? 'Déplier' : 'Replier'}
            className={`hidden lg:flex w-full items-center gap-3 rounded-lg px-3 h-10 text-[15px] font-medium text-stone-700 hover:bg-stone-200/60 hover:text-stone-900 transition-colors cursor-pointer ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen size={17} strokeWidth={1.75} /> : <PanelLeftClose size={17} strokeWidth={1.75} className="text-stone-500" />}
            {!collapsed && <span>Replier</span>}
          </button>
        </div>
      </aside>

      {/* Zone principale */}
      <main id="admin-main-content" tabIndex={-1} className="flex-1 min-w-0 flex flex-col outline-none">
        {/* Barre du haut */}
        <header className="h-16 bg-white/95 backdrop-blur border-b border-stone-200 flex items-center gap-3 px-4 sm:px-6 lg:px-10 shrink-0 sticky top-0 z-20">
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-1 p-2 text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex items-baseline gap-2">
            {currentGroup && <span className="hidden sm:inline text-[16px] text-stone-600">{currentGroup}</span>}
            {currentGroup && <span className="hidden sm:inline text-[16px] text-stone-400">/</span>}
            <p className="truncate text-[16px] font-semibold text-stone-950">{currentItem?.name ?? 'Administration'}</p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 h-9 w-64 px-3 rounded-lg bg-stone-100 text-[14px] font-medium text-stone-700 hover:bg-stone-200/70 transition-colors cursor-pointer"
            >
              <Search size={15} className="text-stone-700" />
              <span className="flex-1 text-left">Rechercher</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              aria-label="Rechercher"
              className="md:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <Search size={18} />
            </button>

            <SystemHealthPill />

            <div className="relative" ref={quickCreateRef}>
              <button
                type="button"
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                aria-expanded={quickCreateOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-accent text-accent-fg text-[14px] font-semibold hover:bg-accent-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Créer</span>
              </button>

              {quickCreateOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-stone-200 shadow-lg p-1.5 z-30 animate-fadein"
                >
                  {quickCreate.map((q) => (
                    <Link
                      key={q.href + q.label}
                      role="menuitem"
                      href={q.href}
                      onClick={() => setQuickCreateOpen(false)}
                      className="flex items-center gap-3 px-3 h-10 rounded-lg text-[15px] font-medium text-stone-900 hover:bg-stone-100"
                    >
                      <q.icon size={16} strokeWidth={1.9} className="text-stone-700" />
                      <span>{q.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div
              role="img"
              title={user?.email ?? undefined}
              aria-label={user?.email ? `Connecté en tant que ${user.email}` : 'Utilisateur connecté'}
              className="hidden sm:grid size-9 rounded-full bg-stone-100 text-stone-700 place-items-center text-[13px] font-medium"
            >
              {user?.email?.charAt(0).toUpperCase() ?? 'A'}
            </div>
          </div>
        </header>

        {/* Alerte IA */}
        {aiStatus && !aiStatus.ok && (
          <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 lg:px-10 py-2.5 flex items-center gap-3 text-red-900 text-[14px] shrink-0">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <p className="flex-1">
              <span className="font-medium">L'IA est indisponible.</span>{' '}
              {aiStatus.error || "La clé API est invalide ou épuisée."}
            </p>
            <button
              type="button"
              onClick={() => checkAiStatus(true)}
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 h-8 text-[13px] font-medium text-red-800 hover:bg-red-50 cursor-pointer"
            >
              Tester à nouveau
            </button>
          </div>
        )}

        {/* Alerte budget */}
        {aiBudget && aiBudget.level !== 'ok' && (
          <div className={`px-4 sm:px-6 lg:px-10 py-2.5 flex items-center gap-3 text-[14px] shrink-0 border-b ${
            aiBudget.level === 'exceeded' ? 'bg-red-50 border-red-100 text-red-900' : 'bg-amber-50 border-amber-100 text-amber-900'
          }`}>
            <AlertTriangle size={16} className={`shrink-0 ${aiBudget.level === 'exceeded' ? 'text-red-600' : 'text-amber-600'}`} />
            <p className="flex-1">
              <span className="font-medium">
                {aiBudget.level === 'exceeded' ? 'Budget IA dépassé.' : 'Budget IA bientôt atteint.'}
              </span>{' '}
              ${Number(aiBudget.usage?.totalUsd ?? 0).toFixed(2)} consommés ce mois-ci ({Math.round(aiBudget.percentUsed)} %).
            </p>
            <Link
              href="/admin/settings"
              className="shrink-0 rounded-lg border border-current/20 bg-white px-3 h-8 inline-flex items-center text-[13px] font-medium hover:bg-white/60"
            >
              Réglages IA
            </Link>
          </div>
        )}

        {/* Contenu */}
        <div className={fullBleed ? 'flex-1' : 'w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 2xl:px-14'}>
          {children}
        </div>
      </main>

      <CommandMenu
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
