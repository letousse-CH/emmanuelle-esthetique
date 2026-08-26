"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { useAppMode } from '../../hooks/useAppMode';
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
  ChevronRight,
  ExternalLink,
  Share2,
  CreditCard,
  Users,
  BookOpenCheck,
  Sparkles,
  Gift,
  Package,
  Megaphone,
  Bot,
  Workflow,
  AlertTriangle,
  PanelsTopLeft,
  TrendingUp,
  Rocket,
  Search,
  Plus,
  Compass,
} from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SITE_CONFIG } from '../../config/site';
import { CommandMenu, Kbd } from '../../components/admin/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const moduleFlags = useModuleFlags();
  const siteName = useSettings(['business_name']).business_name;
  const appMode = useAppMode();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [aiStatus, setAiStatus] = useState<any>(null);
  const [aiBudget, setAiBudget] = useState<any>(null);

  const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const asideRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Écouteur global pour ouvrir la recherche rapide via ⌘K ou Ctrl+K
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

  // Drawer mobile
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  /* ═══ 6 Hubs Métier 2026 ═══ */
  const navGroups = [
    {
      label: '📊 Pilotage',
      items: [
        { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, exact: true },
        { name: 'Analytics', path: '/admin/analytics', icon: TrendingUp },
        { name: 'Pilote automatique', path: '/admin/autopilot', icon: Rocket },
      ],
    },
    {
      label: '📝 Contenu & Médias',
      items: [
        { name: 'Pages du site', path: '/admin/pages', icon: Layers },
        ...(moduleFlags.blog ? [{ name: 'Articles de blog', path: '/admin/blog', icon: FileText }] : []),
        { name: 'Médiathèque', path: '/admin/medias', icon: ImageIcon },
        ...(moduleFlags.events ? [{ name: 'Événements', path: '/admin/events', icon: CalendarDays }] : []),
      ],
    },
    {
      label: '📢 Marketing & Audience',
      items: [
        ...(moduleFlags.newsletter ? [{ name: 'Newsletter', path: '/admin/newsletter', icon: Send }] : []),
        ...(moduleFlags.social ? [{ name: 'Réseaux sociaux', path: '/admin/social', icon: Share2 }] : []),
        { name: 'Abonnés & Leads', path: '/admin/subscribers', icon: Mail },
        ...(moduleFlags.keywords ? [{ name: 'SEO & Mots-clés', path: '/admin/seo', icon: BarChart2 }] : []),
        ...(moduleFlags.caisse ? [{ name: 'Promotions', path: '/admin/promotions', icon: Megaphone }] : []),
      ],
    },
    ...(moduleFlags.caisse
      ? [
          {
            label: '🛒 Caisse & Commerce',
            items: [
              { name: 'Encaissement POS', path: '/admin/caisse', icon: CreditCard, exact: true },
              { name: 'Journal & Chiffre d\'affaires', path: '/admin/caisse/journal', icon: BookOpenCheck },
              { name: 'Bons cadeaux', path: '/admin/caisse/bons', icon: Gift },
              { name: 'Fiches Clients', path: '/admin/caisse/clients', icon: Users },
              { name: 'Prestations', path: '/admin/caisse/prestations', icon: Sparkles },
              { name: 'Produits & Stock', path: '/admin/caisse/produits', icon: Package },
            ],
          },
        ]
      : []),
    {
      label: '🤖 Intelligence IA',
      items: [
        ...(moduleFlags.agents ? [{ name: 'Agent IA', path: '/admin/agents', icon: Bot }] : []),
        ...(moduleFlags.automations ? [{ name: 'Automatisations', path: '/admin/automations', icon: Workflow }] : []),
      ],
    },
    {
      label: '⚙️ Configuration',
      items: [
        { name: 'Menu de navigation', path: '/admin/menu', icon: Menu },
        { name: 'En-tête & Pied de page', path: '/admin/entete-pied', icon: PanelsTopLeft },
        { name: 'Paramètres & Style', path: '/admin/settings', icon: Settings },
      ],
    },
  ].filter((group) => group.items.length > 0);

  const fullBleed = /^\/admin\/pages\/(new|edit)/.test(pathname);

  const currentSection =
    navGroups
      .flatMap((group) => group.items)
      .filter((item: { path: string; exact?: boolean }) =>
        item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`),
      )
      .sort((a, b) => b.path.length - a.path.length)[0]?.name ?? 'Administration';

  // Liste plate pour le CommandMenu
  const commandItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.path,
      name: item.name,
      category: group.label,
      path: item.path,
      icon: item.icon,
    }))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-stone-900 animate-spin" />
          <p className="text-stone-500 text-xs tracking-widest uppercase font-semibold">Chargement du Studio 2026…</p>
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-stone-900 antialiased font-sans">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-stone-900 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:text-sm focus:font-medium"
      >
        Aller au contenu
      </a>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Sidebar Luminous Light 2026 */}
      <aside
        ref={asideRef}
        aria-label="Navigation principale"
        className={`fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto w-64 ${
          collapsed ? 'lg:w-16' : 'lg:w-64'
        } shrink-0 bg-white border-r border-stone-200/80 flex flex-col transition-all duration-200 ease-in-out text-stone-700 shadow-2xs ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo / Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-purple-100 shrink-0">
          <Link
            href="/admin"
            className={`flex items-center gap-3 group min-w-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
              collapsed ? 'mx-auto' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
              {(siteName || 'S').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold text-zinc-900 truncate tracking-tight">
                  {siteName || 'Studio Admin'}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-bold">
                  <span className="size-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
                  Studio 2026
                </span>
              </span>
            )}
          </Link>
        </div>

        {/* Quick Search Button in Sidebar */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="w-full flex items-center justify-between px-4 py-2 rounded-full bg-slate-100/80 border border-purple-100 text-zinc-600 text-xs hover:bg-white hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Search size={14} className="text-purple-500 group-hover:text-purple-700 transition-colors" />
                <span className="font-semibold">Rechercher...</span>
              </span>
              <Kbd>⌘K</Kbd>
            </button>
          </div>
        )}

        {/* Nav list */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item: { name: string; path: string; icon: React.ElementType; exact?: boolean }) => {
                  const isActive =
                    pathname === item.path ||
                    (!item.exact && item.path !== '/admin' && pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      title={collapsed ? item.name : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13px] font-extrabold transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white shadow-[0_4px_14px_rgba(168,85,247,0.3)] scale-[1.02]'
                          : 'text-zinc-600 hover:bg-purple-50/70 hover:text-purple-900'
                      } ${collapsed ? 'justify-center px-2' : ''}`}
                    >
                      <item.icon
                        size={17}
                        className={`shrink-0 ${
                          isActive ? 'text-amber-300' : 'text-zinc-400 group-hover:text-purple-600'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Profile / Links */}
        <div className="px-3 pb-4 space-y-1 border-t border-stone-100 pt-3">
          <a
            href={SITE_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Voir le site' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <ExternalLink size={16} className="shrink-0 text-stone-400" />
            {!collapsed && <span>Voir le site public</span>}
          </a>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 w-full transition-colors cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={16} className="shrink-0 text-stone-400" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
          aria-pressed={collapsed}
          className="hidden lg:flex absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-stone-200 shadow-sm items-center justify-center text-stone-500 hover:text-stone-900 hover:border-stone-400 transition-colors cursor-pointer z-10"
        >
          <ChevronRight size={12} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main Area */}
      <main id="admin-main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col outline-none">
        {/* Topbar 2026 Glassmorphic */}
        <div className="h-16 border-b border-stone-200/80 bg-white/80 backdrop-blur-md flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-20 gap-4">
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-1 p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} />
          </button>

          {/* Section Breadcrumb */}
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-emerald-500 shadow-2xs shadow-emerald-500/50" />
            <p className="min-w-0 truncate text-sm font-bold text-stone-900 tracking-tight">{currentSection}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Indicateur de Santé & Diagnostic des Clés API */}
            <SystemHealthPill />

            {/* Quick Action Button "+ Créer" */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus size={14} />
                <span>Créer</span>
              </button>

              {quickCreateOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-stone-200 shadow-xl py-1.5 z-30 animate-fadein"
                  onClick={() => setQuickCreateOpen(false)}
                >
                  <Link href="/admin/blog/new" className="flex items-center gap-2.5 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium">
                    <FileText size={14} className="text-stone-400" />
                    <span>Nouvel article</span>
                  </Link>
                  <Link href="/admin/pages/new" className="flex items-center gap-2.5 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium">
                    <Layers size={14} className="text-stone-400" />
                    <span>Nouvelle page</span>
                  </Link>
                  {moduleFlags.caisse && (
                    <>
                      <Link href="/admin/caisse" className="flex items-center gap-2.5 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium border-t border-stone-100">
                        <CreditCard size={14} className="text-emerald-600" />
                        <span>Encaissement rapide</span>
                      </Link>
                      <Link href="/admin/caisse/clients" className="flex items-center gap-2.5 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium">
                        <Users size={14} className="text-stone-400" />
                        <span>Nouveau client</span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Chip */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-stone-200/80">
              <span className="hidden text-[13px] font-semibold text-stone-700 sm:block">{user?.email}</span>
              <div
                role="img"
                aria-label={user?.email ? `Connecté en tant que ${user.email}` : 'Utilisateur connecté'}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-900 to-stone-800 text-white flex items-center justify-center text-xs font-bold shadow-2xs border border-stone-700"
              >
                {user?.email?.charAt(0).toUpperCase() ?? 'A'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Status Alert */}
        {aiStatus && !aiStatus.ok && (
          <div className="bg-red-50 border-b border-red-200 px-4 lg:px-8 py-3 flex items-center gap-3 text-red-900 text-[13px] shrink-0">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">L'IA est indisponible :</span>{' '}
              {aiStatus.error || "La clé API est invalide ou épuisée."}
            </div>
            <button
              type="button"
              onClick={() => checkAiStatus(true)}
              className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1 text-[12.5px] font-semibold text-red-800 hover:bg-red-100 cursor-pointer shadow-2xs"
            >
              Re-tester
            </button>
          </div>
        )}

        {/* Budget Alert */}
        {aiBudget && aiBudget.level !== 'ok' && (
          <div className={`px-4 lg:px-8 py-3 flex items-center gap-3 text-[13px] shrink-0 border-b ${
            aiBudget.level === 'exceeded' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <AlertTriangle size={16} className={`shrink-0 ${aiBudget.level === 'exceeded' ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">
                {aiBudget.level === 'exceeded' ? 'Budget IA dépassé.' : 'Budget IA bientôt atteint.'}
              </span>{' '}
              ${Number(aiBudget.usage?.totalUsd ?? 0).toFixed(2)} consommés ce mois-ci ({Math.round(aiBudget.percentUsed)} %).
            </div>
            <Link
              href="/admin/settings"
              className={`shrink-0 rounded-xl border bg-white px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                aiBudget.level === 'exceeded' ? 'border-red-300 text-red-800 hover:bg-red-100' : 'border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
            >
              Réglages IA
            </Link>
          </div>
        )}

        {/* Main Content View */}
        <div className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8'}>
          {children}
        </div>
      </main>

      {/* Command Menu Modal Overlay (⌘K) */}
      <CommandMenu
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={commandItems}
      />
    </div>
  );
}

