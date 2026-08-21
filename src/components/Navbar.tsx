/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useSettings, settingsCache } from '../hooks/useSettings';
import { useModuleFlags } from '../hooks/useModuleFlags';
import type { HeaderVariant } from '../constants/chromeVariants';

// Pas de logo par défaut : tant qu'aucun fichier n'est déposé dans
// Paramètres > Design & Style, la navbar affiche le nom du site en toutes
// lettres (voir plus bas). Un `src=""` ferait recharger la page entière par le
// navigateur en plus d'afficher une image cassée.

function readHeroColor(): 'dark' | 'light' {
  try {
    const raw = localStorage.getItem('sde_hero_v1');
    if (raw) return (JSON.parse(raw).color as 'dark' | 'light') || 'dark';
  } catch {}
  return 'dark';
}

interface NavbarProps {
  initialVariant?: string;
  initialLogoUrl?: string;
  initialNavigationMenu?: string;
  initialRegisterLink?: string;
  /*
    Le nom d'entreprise sert d'alternative textuelle au logo et de repli quand
    il n'y a pas d'image. Il n'était pas transmis : le serveur le lisait dans
    son cache de réglages, le premier rendu du navigateur partait d'un cache
    vide, et React signalait une divergence d'hydratation sur l'attribut `alt`.
  */
  initialBusinessName?: string;
}

export default function Navbar({ initialVariant, initialLogoUrl, initialNavigationMenu, initialRegisterLink, initialBusinessName }: NavbarProps) {
  // Seed le cache avec les réglages lus côté serveur pour que le premier rendu
  // (SSR + hydratation) affiche déjà le vrai menu, sans flash de l'ancien menu
  // par défaut (SETTINGS_DEFAULTS) le temps que le fetch client se termine.
  if (initialVariant && !settingsCache.has('header_variant')) {
    settingsCache.set('header_variant', initialVariant);
  }
  if (initialLogoUrl && !settingsCache.has('global_logo')) {
    settingsCache.set('global_logo', initialLogoUrl);
  }
  if (initialNavigationMenu && !settingsCache.has('navigation_menu')) {
    settingsCache.set('navigation_menu', initialNavigationMenu);
  }
  if (initialRegisterLink && !settingsCache.has('header_register_link')) {
    settingsCache.set('header_register_link', initialRegisterLink);
  }
  if (initialBusinessName && !settingsCache.has('business_name')) {
    settingsCache.set('business_name', initialBusinessName);
  }
  const settings = useSettings(['global_logo', 'navigation_menu', 'header_register_link', 'business_name', 'header_variant']);
  /*
    Modèle d'en-tête. Voir `constants/chromeVariants`. La barre n'avait qu'une
    forme possible — logo à gauche, liens à droite — et il fallait toucher au
    code pour en changer.
  */
  const variant = (settings.header_variant || 'classique') as HeaderVariant;
  const moduleFlags = useModuleFlags();
  const logoUrl = settings.global_logo;
  // Nom affiché en repli du logo — saisi dans Paramètres > Entreprise.
  const businessName = settings.business_name || '';
  const registerLink = settings.header_register_link || '/contact';
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [heroColor, setHeroColor] = useState<'dark' | 'light'>('dark');
  const pathname = usePathname();

  // Si l'URL du logo est cassée (média supprimé, bucket renommé), on bascule
  // sur le nom en toutes lettres plutôt que de laisser une image cassée.
  const [logoBroken, setLogoBroken] = useState(false);

  // Pages dont la première section est sombre : les liens de la navbar
  // transparente s'y affichent en blanc. Les pages du CMS émettent en plus
  // l'événement `sde:heroColor` (voir SectionWrapper), qui fait autorité.
  const darkHeroPages: string[] = [];

  useEffect(() => {
    const isDark = darkHeroPages.includes(pathname || '');
    setHeroColor(isDark ? 'dark' : 'light');
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Écoute les changements de couleur hero émis par les sections dynamiques
  useEffect(() => {
    const handler = (e: Event) => setHeroColor((e as CustomEvent).detail as 'dark' | 'light');
    window.addEventListener('sde:heroColor', handler);
    return () => window.removeEventListener('sde:heroColor', handler);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  // Les liens de la navbar s'affichent en blanc (lightMode = true) uniquement
  // si la navbar est transparente (non scrollée) et que la hero section est sombre.
  // Le bandeau plein ne dépend pas du défilement : il est opaque dès le départ,
  // donc jamais en mode clair.
  const solid = variant === 'plein' || scrolled;
  const lightMode = !solid && heroColor === 'dark';

  let menuItems: any[] = [];
  try {
    if (settings.navigation_menu) {
      menuItems = JSON.parse(settings.navigation_menu);
    }
  } catch (err) {
    console.error("Failed to parse navigation_menu setting:", err);
  }

  /*
    Aucun menu de repli. Un jeu de liens codé en dur pointerait vers des pages
    qui n'existent pas sur ce site-ci et servirait des 404 dès la première
    visite. Tant que rien n'est défini dans Paramètres > Menu, la navigation
    reste vide — le logo ramène à l'accueil, ce qui suffit.
  */
  if (!Array.isArray(menuItems)) menuItems = [];

  // Défense en profondeur : même un menu personnalisé (JSON en settings) ne
  // doit pas exposer de lien vers un module désactivé.
  const isPathForDisabledModule = (path?: string) =>
    (path === '/blog' && !moduleFlags.blog) || (path === '/ateliers' && !moduleFlags.events);

  menuItems = menuItems
    .filter((item) => !isPathForDisabledModule(item.path))
    .map((item) =>
      Array.isArray(item.children)
        ? { ...item, children: item.children.filter((c: any) => !isPathForDisabledModule(c.path)) }
        : item
    );

  return (
    <nav
      data-main-nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        solid ? 'bg-white/95 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'
      }`}
      data-light={lightMode ? 'true' : undefined}
    >
        <div
          className={`max-w-7xl mx-auto px-6 items-center ${
            variant === 'centre'
              ? 'flex flex-col gap-3 xl:gap-4'
              : 'flex justify-between'
          }`}
        >
        <Link href="/" className="flex items-center gap-3 group">
          <div className={`transition-all duration-500 bg-transparent shrink-0 flex items-center ${scrolled ? 'h-[80px] w-[225px]' : 'h-[88px] w-[250px]'}`}>
            {logoUrl && !logoBroken ? (
              <img
                src={logoUrl}
                onError={() => setLogoBroken(true)}
                alt={businessName ? `${businessName} — retour à l'accueil` : "Retour à l'accueil"}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                width={250}
                height={88}
              />
            ) : (
              /* Repli tant qu'aucun logo n'est chargé : le nom saisi dans
                 Paramètres > Entreprise, jamais une valeur codée en dur. */
              <span className="font-serif text-2xl leading-tight tracking-wide">
                {businessName}
              </span>
            )}
          </div>
        </Link>

        {/*
          Liens de navigation. La variante « épuré » ne les montre jamais en
          ligne : le menu déroulant sert à tous les formats d'écran.
        */}
        <div className={`${variant === 'minimal' ? 'hidden' : 'hidden xl:flex'} items-center gap-10 ${variant === 'centre' ? 'xl:justify-center' : ''}`}>
          {menuItems.map((item, idx) => {
            const isDropdown = item.type === 'dropdown' || (Array.isArray(item.children) && item.children.length > 0);
            
            if (isDropdown) {
              const children = item.children || [];
              const isOpen = openDropdown === idx;
              const isChildActive = children.some((c: any) => pathname === c.path);
              
              return (
                <div
                  key={idx}
                  className="relative group"
                  onMouseEnter={() => setOpenDropdown(idx)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    className={`flex items-center gap-1 text-sm uppercase tracking-[0.2em] font-medium transition-colors duration-300 hover:text-sage ${
                      isChildActive ? 'text-sage' : lightMode ? 'text-white/90' : 'text-stone-deep/70'
                    }`}
                  >
                    {item.name} <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 w-72 bg-white shadow-xl border border-stone-100 py-4 mt-2 rounded-xl"
                      >
                        {children.map((child: any, cidx: number) => (
                          <Link
                            key={cidx}
                            href={child.path}
                            className={`block px-6 py-3 hover:text-sage hover:bg-stone-50 transition-all font-medium text-sm ${
                              pathname === child.path ? 'text-sage bg-stone-50/50' : 'text-stone-deep/70'
                            }`}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            const isActive = pathname === item.path;
            return (
              <Link
                key={idx}
                href={item.path}
                className={`text-sm uppercase tracking-[0.2em] font-medium transition-colors duration-300 hover:text-sage ${
                  isActive ? 'text-sage' : lightMode ? 'text-white/90' : 'text-stone-deep/70'
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          <Link
            data-btn="primary"
            href={registerLink}
            className={`shrink-0 px-8 py-3 text-xs uppercase tracking-widest font-bold transition-all duration-300 ${
              lightMode
                ? 'bg-white/15 backdrop-blur-sm text-white border border-white/30 hover:bg-white/25'
                : 'bg-stone-deep text-paper hover:bg-stone-deep/90'
            }`}
          >
            Prendre rendez-vous
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className={`${variant === 'minimal' ? '' : 'xl:hidden'} p-2 transition-colors duration-300 ${
            variant === 'centre' ? 'absolute right-6 top-6' : ''
          } ${lightMode ? 'text-white' : 'text-stone-deep'}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`${variant === 'minimal' ? '' : 'xl:hidden'} bg-white border-t border-stone-100 overflow-hidden`}
          >
            <div className="flex flex-col p-6 gap-6">
              {menuItems.map((item, idx) => {
                const isDropdown = item.type === 'dropdown' || (Array.isArray(item.children) && item.children.length > 0);
                
                if (isDropdown) {
                  const children = item.children || [];
                  return (
                    <div key={idx} className="space-y-4 border-l-2 border-stone-100 pl-4 py-2">
                      <p className="text-xs uppercase tracking-widest text-stone-400 font-bold">{item.name}</p>
                      {children.map((child: any, cidx: number) => (
                        <Link
                          key={cidx}
                          href={child.path}
                          className={`block text-md font-serif italic ${pathname === child.path ? 'text-sage' : 'text-stone-deep/70'}`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  );
                }

                return (
                  <Link 
                    key={idx}
                    href={item.path}
                    className={`text-lg font-serif italic ${pathname === item.path ? 'text-sage' : 'text-stone-deep'}`}
                  >
                    {item.name}
                  </Link>
                );
              })}

              <Link 
                data-btn="primary"
                href={registerLink} 
                className="bg-sage text-white py-4 text-center font-bold uppercase tracking-widest"
              >
                Prendre rendez-vous
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
