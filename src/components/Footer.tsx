"use client";

import Link from 'next/link';
import { Instagram, Linkedin, Youtube, Music2 } from 'lucide-react';
import { useSettings, settingsCache } from '../hooks/useSettings';

// Pas de logo par défaut : l'affichage est conditionné à un logo réellement
// renseigné dans Paramètres > Design & Style.

interface NavItem { name: string; path?: string; type?: string; children?: NavItem[] }

function flattenMenu(items: NavItem[]): { name: string; path: string }[] {
  return items.flatMap(item =>
    item.type === 'dropdown' && item.children
      ? flattenMenu(item.children)
      : item.path ? [{ name: item.name, path: item.path }] : []
  );
}

interface FooterProps {
  initialLogoUrl?: string;
  initialFooterImage?: string;
  initialNavigationMenu?: string;
  initialSocials?: {
    social_instagram?: string;
    social_linkedin?: string;
    social_youtube?: string;
    social_spotify?: string;
  };
  initialBusiness?: {
    business_name?: string;
    business_owner?: string;
    business_address_city?: string;
    business_address_region?: string;
  };
}

export default function Footer({ initialLogoUrl, initialFooterImage, initialNavigationMenu, initialSocials, initialBusiness }: FooterProps) {
  // Seed le cache avec les réglages lus côté serveur — même logique que dans
  // Navbar : évite le flash de l'ancien menu / des icônes sociales manquantes
  // le temps que le fetch client se termine.
  if (initialLogoUrl && !settingsCache.has('global_logo')) {
    settingsCache.set('global_logo', initialLogoUrl);
  }
  if (initialFooterImage && !settingsCache.has('footer_image')) {
    settingsCache.set('footer_image', initialFooterImage);
  }
  if (initialNavigationMenu && !settingsCache.has('navigation_menu')) {
    settingsCache.set('navigation_menu', initialNavigationMenu);
  }
  if (initialSocials) {
    for (const [key, value] of Object.entries(initialSocials)) {
      if (value && !settingsCache.has(key)) settingsCache.set(key, value);
    }
  }
  if (initialBusiness) {
    for (const [key, value] of Object.entries(initialBusiness)) {
      if (value && !settingsCache.has(key)) settingsCache.set(key, value);
    }
  }

  const settings = useSettings([
    'global_logo',
    'footer_logo',
    'footer_image',
    'footer_tagline_line1',
    'footer_tagline_line2',
    'footer_tagline_text',
    'navigation_menu',
    'social_instagram',
    'social_linkedin',
    'social_youtube',
    'social_spotify',
    'business_name',
    'business_owner',
    'business_email',
    'business_phone',
    'business_address_city',
    'business_address_postal',
    'business_address_region',
  ]);

  const logoUrl = settings.footer_logo || settings.global_logo;

  let navLinks: { name: string; path: string }[] = [];
  try {
    const parsed: NavItem[] = JSON.parse(settings.navigation_menu || '[]');
    navLinks = flattenMenu(parsed);
  } catch { /* keep empty */ }

  const socials = [
    { label: 'Instagram', href: settings.social_instagram, icon: Instagram },
    { label: 'LinkedIn',  href: settings.social_linkedin,  icon: Linkedin  },
    { label: 'YouTube',   href: settings.social_youtube,   icon: Youtube   },
    { label: 'Spotify',   href: settings.social_spotify,   icon: Music2    },
  ].filter(s => !!s.href);

  return (
    <footer className="bg-[#0f0e0d] text-white">

      {/* Bande accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-sage/40 to-transparent" />

      {/* Corps principal */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-14">

        {/* 3 colonnes : image / tagline / icônes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-end pb-0 border-b border-white/8">

          {/* Colonne gauche : image */}
          <div className="flex justify-center md:justify-start">
            {/* Tant qu'aucune image n'est choisie dans l'admin, on n'affiche
                rien : un `src=""` fait recharger la page entière. */}
            {settings.footer_image && (
              <img
                src={settings.footer_image}
                alt={`${settings.business_name} — institut à domicile à ${settings.business_address_city}`}
                className="w-56 md:w-72 object-cover rounded-2xl"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>

          {/* Colonne centrale : tagline */}
          <div className="text-left space-y-3 pb-10">
            <p className="text-2xl font-serif font-light text-white/90 leading-snug">
              {settings.footer_tagline_line1}<br />
              <span className="text-sage">{settings.footer_tagline_line2}</span>
            </p>
            <p className="text-white/40 text-sm leading-relaxed">
              {settings.footer_tagline_text}
            </p>
          </div>

          {/* Colonne droite : icônes sociales */}
          <div className="flex justify-center md:justify-end pb-10">
            {socials.length > 0 && (
              <div className="flex items-center gap-3">
                {socials.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-10 h-10 flex items-center justify-center border border-white/10 hover:border-sage/60 hover:text-sage text-white/50 transition-all duration-200"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Liens + infos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12">

          {/* Navigation */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/30 mb-5">Navigation</p>
            <nav className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              {navLinks.map(({ name, path }) => (
                <Link
                  key={path}
                  href={path}
                  className="text-sm text-white/50 hover:text-white transition-colors duration-200 flex items-center gap-1.5 group w-fit"
                >
                  <span className="w-3 h-px bg-white/20 group-hover:bg-sage group-hover:w-4 transition-all duration-200 shrink-0" />
                  {name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Lieu & contact */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/30 mb-5">Institut &amp; contact</p>
            <address className="not-italic text-sm text-white/50 leading-relaxed space-y-2">
              <p>
                Institut à domicile<br />
                <span className="text-white/30">
                  {[settings.business_address_postal, settings.business_address_city, settings.business_address_region]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </p>
              {settings.business_phone && (
                <p>
                  <a href={`tel:${settings.business_phone.replace(/\s+/g, '')}`} className="hover:text-white transition-colors">
                    {settings.business_phone}
                  </a>
                </p>
              )}
              {settings.business_email && (
                <p>
                  <a href={`mailto:${settings.business_email}`} className="hover:text-white transition-colors break-all">
                    {settings.business_email}
                  </a>
                </p>
              )}
            </address>
          </div>

          {/* Logo */}
          <div className="flex justify-center md:justify-end items-start">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={settings.business_name}
                className="h-28 w-auto object-contain opacity-80"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        </div>
      </div>

      {/* Barre basse */}
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/25 tracking-wide">
          <span>© {new Date().getFullYear()} {settings.business_name} · {settings.business_owner}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <Link href="/mentions-legales" className="hover:text-white/60 transition-colors">Mentions légales</Link>
            <Link href="/cgv" className="hover:text-white/60 transition-colors">CGV</Link>
            <Link href="/politique-de-confidentialite" className="hover:text-white/60 transition-colors">Confidentialité</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
