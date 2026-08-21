"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { useAppMode } from '../../hooks/useAppMode';
import { LayoutDashboard, FileText, Settings, LogOut, Image as ImageIcon, Mail, Send, BarChart2, CalendarDays, Layers, Menu, ChevronRight, ExternalLink, Share2, CreditCard, Users, BookOpenCheck, Sparkles, Gift, Package, Megaphone, Bot, Workflow, AlertTriangle, PanelsTopLeft } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { SITE_CONFIG } from '../../config/site';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const moduleFlags = useModuleFlags();
  // Le nom du site vient des réglages : l'ancien « Admin SDE » était le nom du
  // projet d'origine, affiché tel quel sur tous les sites issus du template.
  const siteName = useSettings(['business_name']).business_name;
  // Web app Caisse installée sur l'écran d'accueil : on efface la coque du
  // back-office (barre latérale, topbar) pour laisser tout l'écran à la caisse.
  // La navigation passe alors par la barre d'onglets basse de /admin/caisse.
  const appMode = useAppMode();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [aiBudget, setAiBudget] = useState<any>(null);
  const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const asideRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Drawer mobile : verrouille le scroll du body, ferme sur Échap, rend le focus au bouton hamburger.
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

  // Solde faible : Anthropic n'expose pas le crédit restant, on compare la
  // dépense estimée du mois au budget défini dans Paramètres → IA & Budget.
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

  /*
    Navigation calquée sur les huit modules annoncés commercialement :
    Pages, Articles, Mots-clés, Réseaux, Newsletter, Caisse, Agents,
    Automatisations. Un module désactivé disparaît de la barre mais ses
    écrans restent accessibles par URL directe.
  */
  const navGroups = [
    {
      label: 'Contenu',
      items: [
        { name: 'Tableau de bord', path: '/admin', icon: LayoutDashboard, exact: true },
        { name: 'Pages', path: '/admin/pages', icon: Layers },
        ...(moduleFlags.blog ? [{ name: 'Articles', path: '/admin/blog', icon: FileText }] : []),
        { name: 'Médias', path: '/admin/medias', icon: ImageIcon },
        ...(moduleFlags.events ? [{ name: 'Événements', path: '/admin/events', icon: CalendarDays }] : []),
      ],
    },
    {
      label: 'Acquisition',
      items: [
        ...(moduleFlags.keywords ? [{ name: 'Mots-clés', path: '/admin/seo', icon: BarChart2 }] : []),
        ...(moduleFlags.social ? [{ name: 'Réseaux', path: '/admin/social', icon: Share2 }] : []),
        ...(moduleFlags.newsletter ? [{ name: 'Newsletter', path: '/admin/newsletter', icon: Send }] : []),
        { name: 'Abonnés', path: '/admin/subscribers', icon: Mail },
        ...(moduleFlags.caisse ? [{ name: 'Promotions', path: '/admin/promotions', icon: Megaphone }] : []),
      ],
    },
    ...(moduleFlags.caisse ? [{
      label: 'Caisse',
      items: [
        // `exact` : sans lui, /admin/caisse resterait surligné sur ses
        // sous-pages (journal, clientes, prestations).
        { name: 'Encaissement', path: '/admin/caisse', icon: CreditCard, exact: true },
        { name: 'Journal & CA', path: '/admin/caisse/journal', icon: BookOpenCheck },
        { name: 'Bons cadeaux', path: '/admin/caisse/bons', icon: Gift },
        { name: 'Clients', path: '/admin/caisse/clients', icon: Users },
        { name: 'Prestations', path: '/admin/caisse/prestations', icon: Sparkles },
        { name: 'Produits & stock', path: '/admin/caisse/produits', icon: Package },
      ],
    }] : []),
    {
      label: 'Intelligence',
      items: [
        ...(moduleFlags.agents ? [{ name: 'Agents', path: '/admin/agents', icon: Bot }] : []),
        ...(moduleFlags.automations ? [{ name: 'Automatisations', path: '/admin/automations', icon: Workflow }] : []),
      ],
    },
    {
      label: 'Site',
      items: [
        { name: 'Navigation', path: '/admin/menu', icon: Menu },
        { name: 'En-tête & pied', path: '/admin/entete-pied', icon: PanelsTopLeft },
        { name: 'Paramètres', path: '/admin/settings', icon: Settings },
      ],
    },
  ].filter((group) => group.items.length > 0);

  /*
    Titre de la rubrique courante, affiché dans la barre du haut. Sur les
    écrans profonds (édition d'article, fiche cliente), la barre latérale ne
    suffit plus à dire où l'on se trouve.
  */
  /*
    Le constructeur de pages travaille en pleine largeur : il porte lui-même sa
    hauteur d'écran et sa colonne d'aperçu. La marge de lecture confortable des
    écrans de contenu — 1400 px et huit unités de marge — lui volait le tiers de
    la surface d'aperçu.
  */
  const fullBleed = /^\/admin\/pages\/(new|edit)/.test(pathname);

  const currentSection =
    navGroups
      .flatMap((group) => group.items)
      .filter((item: { path: string; exact?: boolean }) =>
        item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`),
      )
      .sort((a, b) => b.path.length - a.path.length)[0]?.name ?? 'Administration';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
          <p className="text-stone-500 text-xs tracking-widest uppercase">Chargement</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (appMode) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-800">
        <main id="admin-main-content" className="p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex text-stone-800">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-sage focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Aller au contenu
      </a>

      {/* Overlay mobile (derrière la sidebar en mode drawer) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-stone-900/40 z-30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={asideRef}
        aria-label="Navigation principale"
        className={`fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto w-64 ${collapsed ? 'lg:w-16' : 'lg:w-60'} shrink-0 bg-white border-r border-stone-200 flex flex-col transition-transform lg:transition-all duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3.5 border-b border-stone-200 shrink-0">
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${collapsed ? 'mx-auto' : ''}`}
          >
            <span className="w-7 h-7 rounded-lg bg-stone-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(siteName || 'S').charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-stone-900 truncate">{siteName || 'Studio'}</span>
                <span className="block text-[11px] text-stone-500 leading-tight">Administration</span>
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1.5 text-[11px] font-semibold text-stone-500">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item: { name: string; path: string; icon: React.ElementType; exact?: boolean }) => {
                  const isActive = pathname === item.path
                    || (!item.exact && item.path !== '/admin' && pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      title={collapsed ? item.name : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                        isActive
                          ? 'bg-stone-900 text-white font-medium'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <item.icon size={15} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-3 space-y-0.5 border-t border-stone-200 pt-3">
          <a
            href={SITE_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Voir le site' : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <ExternalLink size={15} className="shrink-0" />
            {!collapsed && <span>Voir le site</span>}
          </a>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] text-stone-600 hover:bg-red-50 hover:text-red-700 w-full transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={15} className="shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop uniquement) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
          aria-pressed={collapsed}
          className="hidden lg:flex absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-stone-300 shadow-sm items-center justify-center text-stone-500 hover:text-stone-900 hover:border-stone-400 transition-colors cursor-pointer z-10"
        >
          <ChevronRight size={11} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main */}
      <main id="admin-main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col outline-none">
        {/* Topbar */}
        <div className="h-14 border-b border-stone-200 bg-white/95 backdrop-blur flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-20 gap-3">
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-1 p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={18} />
          </button>
          {/* Où suis-je : le titre de la rubrique courante, toujours visible. */}
          <p className="min-w-0 truncate text-sm font-medium text-stone-900">{currentSection}</p>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[13px] text-stone-600 sm:block">{user?.email}</span>
            <div
              role="img"
              aria-label={user?.email ? `Connecté en tant que ${user.email}` : 'Utilisateur connecté'}
              className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-semibold uppercase"
            >
              {user?.email?.charAt(0) ?? 'A'}
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        {aiStatus && !aiStatus.ok && (
          <div className="bg-red-50 border-b border-red-200 px-4 lg:px-8 py-3 flex items-center gap-3 text-red-900 text-[13px] shrink-0">
            <AlertTriangle size={15} className="shrink-0 text-red-600" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">L'IA ne répond pas.</span>{' '}
              {aiStatus.error || "La clé API est invalide ou épuisée : toutes les générations de contenu sont indisponibles."}
            </div>
            <button
              type="button"
              onClick={() => checkAiStatus(true)}
              className="shrink-0 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[12.5px] font-medium text-red-800 transition-colors hover:bg-red-100 cursor-pointer"
            >
              Re-tester
            </button>
          </div>
        )}

        {/* Alerte budget IA */}
        {aiBudget && aiBudget.level !== 'ok' && (
          <div className={`px-4 lg:px-8 py-3 flex items-center gap-3 text-[13px] shrink-0 border-b ${aiBudget.level === 'exceeded' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            <AlertTriangle size={15} className={`shrink-0 ${aiBudget.level === 'exceeded' ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">
                {aiBudget.level === 'exceeded' ? 'Budget IA dépassé.' : 'Budget IA bientôt atteint.'}
              </span>{' '}
              ${Number(aiBudget.usage?.totalUsd ?? 0).toFixed(2)} consommés ce mois-ci sur
              ${Number(aiBudget.config?.budgetUsd ?? 0).toFixed(2)} ({Math.round(aiBudget.percentUsed)} %).
              Rechargez vos crédits Anthropic ou choisissez un modèle moins cher.
            </div>
            <Link
              href="/admin/settings"
              className={`shrink-0 rounded-lg border bg-white px-2.5 py-1 text-[12.5px] font-medium transition-colors ${aiBudget.level === 'exceeded' ? 'border-red-300 text-red-800 hover:bg-red-100' : 'border-amber-300 text-amber-900 hover:bg-amber-100'}`}
            >
              Réglages IA
            </Link>
          </div>
        )}

        <div className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8'}>
          {children}
        </div>
      </main>
    </div>
  );
}
