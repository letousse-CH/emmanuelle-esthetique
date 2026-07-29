"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { LayoutDashboard, FileText, Settings, LogOut, Image as ImageIcon, Mail, Send, BarChart2, CalendarDays, Layers, Menu, ChevronRight, ExternalLink, HelpCircle, Share2 } from 'lucide-react';
import { SITE_CONFIG } from '../../config/site';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const moduleFlags = useModuleFlags();
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

  const navGroups = [
    {
      label: 'Contenu',
      items: [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        ...(moduleFlags.blog ? [{ name: 'Articles', path: '/admin/blog', icon: FileText }] : []),
        ...(moduleFlags.events ? [{ name: 'Événements', path: '/admin/events', icon: CalendarDays }] : []),
        { name: 'Médias', path: '/admin/medias', icon: ImageIcon },
      ],
    },
    {
      label: 'Audience',
      items: [
        { name: 'Abonnés', path: '/admin/subscribers', icon: Mail },
        ...(moduleFlags.newsletter ? [{ name: 'Newsletter', path: '/admin/newsletter', icon: Send }] : []),
        ...(moduleFlags.social ? [{ name: 'Réseaux Sociaux', path: '/admin/social', icon: Share2 }] : []),
        { name: 'SEO', path: '/admin/seo', icon: BarChart2 },
      ],
    },
    {
      label: 'Site',
      items: [
        { name: 'Pages', path: '/admin/pages', icon: Layers },
        { name: 'Menu', path: '/admin/menu', icon: Menu },
        { name: 'Paramètres', path: '/admin/settings', icon: Settings },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
          <p className="text-stone-400 text-xs tracking-widest uppercase">Chargement</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

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
        className={`fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto w-64 ${collapsed ? 'lg:w-14' : 'lg:w-56'} shrink-0 bg-white border-r border-stone-100 flex flex-col transition-transform lg:transition-all duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3.5 border-b border-stone-100 shrink-0">
          {!collapsed ? (
            <Link href="/" className="flex items-center gap-2.5 group min-w-0">
              <span className="w-7 h-7 rounded-lg bg-sage flex items-center justify-center text-white text-xs font-bold shrink-0">A</span>
              <span className="text-sm font-semibold text-stone-800 group-hover:text-sage transition-colors truncate">Admin SDE</span>
            </Link>
          ) : (
            <Link href="/" className="mx-auto">
              <span className="w-7 h-7 rounded-lg bg-sage flex items-center justify-center text-white text-xs font-bold">A</span>
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1 text-[9px] font-bold tracking-widest uppercase text-stone-400">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      title={collapsed ? item.name : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-100 ${
                        isActive
                          ? 'bg-sage/8 text-sage font-medium'
                          : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
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
        <div className="px-2 pb-3 space-y-0.5 border-t border-stone-100 pt-3">
          <a
            href={SITE_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Voir le site' : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <ExternalLink size={15} className="shrink-0" />
            {!collapsed && <span>Voir le site</span>}
          </a>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-400 hover:bg-red-50 hover:text-red-500 w-full transition-all cursor-pointer ${collapsed ? 'justify-center' : ''}`}
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
          className="hidden lg:flex absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-stone-200 shadow-sm items-center justify-center text-stone-400 hover:text-stone-700 hover:border-stone-300 transition-all cursor-pointer z-10"
        >
          <ChevronRight size={11} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main */}
      <main id="admin-main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col outline-none">
        {/* Topbar */}
        <div className="h-14 border-b border-stone-100 bg-white flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-20 gap-3">
          <button
            ref={mobileMenuButtonRef}
            onClick={() => setMobileOpen(true)}
            className="lg:hidden -ml-1 p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
            aria-label="Ouvrir le menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={18} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-stone-400 hidden sm:block">{user?.email}</span>
            <div
              role="img"
              aria-label={user?.email ? `Connecté en tant que ${user.email}` : 'Utilisateur connecté'}
              className="w-7 h-7 rounded-full bg-sage/15 text-sage flex items-center justify-center text-xs font-bold uppercase"
            >
              {user?.email?.charAt(0) ?? 'A'}
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        {aiStatus && !aiStatus.ok && (
          <div className="bg-red-50 border-b border-red-100 px-4 lg:px-8 py-3 flex items-center gap-3 text-red-800 text-xs shrink-0 animate-fade-in">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 font-bold text-xs">!</div>
            <div className="flex-1">
              <span className="font-bold">⚠️ Dysfonctionnement de l'IA :</span>{' '}
              {aiStatus.error || "Une clé API IA est invalide ou épuisée. Les fonctionnalités de génération de contenu sont indisponibles."}
            </div>
            <button 
              type="button" 
              onClick={() => checkAiStatus(true)} 
              className="text-[10px] bg-red-100 hover:bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Re-tester
            </button>
          </div>
        )}

        {/* Alerte budget IA */}
        {aiBudget && aiBudget.level !== 'ok' && (
          <div className={`px-4 lg:px-8 py-3 flex items-center gap-3 text-xs shrink-0 animate-fade-in border-b ${aiBudget.level === 'exceeded' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${aiBudget.level === 'exceeded' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>$</div>
            <div className="flex-1">
              <span className="font-bold">
                {aiBudget.level === 'exceeded' ? '⚠️ Budget IA dépassé :' : '⚠️ Budget IA bientôt atteint :'}
              </span>{' '}
              ${Number(aiBudget.usage?.totalUsd ?? 0).toFixed(2)} consommés ce mois-ci sur un budget de
              ${Number(aiBudget.config?.budgetUsd ?? 0).toFixed(2)} ({Math.round(aiBudget.percentUsed)} %).
              Pense à recharger tes crédits Anthropic ou à passer sur un modèle moins cher.
            </div>
            <Link
              href="/admin/settings"
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-colors ${aiBudget.level === 'exceeded' ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-800'}`}
            >
              Réglages IA
            </Link>
          </div>
        )}

        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
