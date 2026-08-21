"use client";

import Link from 'next/link';
import { Instagram, Linkedin, Youtube, Music2 } from 'lucide-react';
import { useSettings, settingsCache } from '../hooks/useSettings';
import type { FooterVariant } from '../constants/chromeVariants';

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
  initialVariant?: string;
  initialTheme?: string;
  initialBgColor?: string;
  initialLegalLinks?: string;
  initialBusiness?: {
    business_name?: string;
    business_owner?: string;
    business_address_city?: string;
    business_address_region?: string;
  };
}

export default function Footer({ initialVariant, initialTheme, initialBgColor, initialLogoUrl, initialFooterImage, initialNavigationMenu, initialLegalLinks, initialSocials, initialBusiness }: FooterProps) {
  // Seed le cache avec les réglages lus côté serveur — même logique que dans
  // Navbar : évite le flash de l'ancien menu / des icônes sociales manquantes
  // le temps que le fetch client se termine.
  if (initialVariant) {
    settingsCache.set('footer_variant', initialVariant);
  }
  if (initialTheme) {
    settingsCache.set('footer_theme', initialTheme);
  }
  if (initialBgColor !== undefined) {
    settingsCache.set('footer_bg_color', initialBgColor);
  }
  if (initialLogoUrl && !settingsCache.has('global_logo')) {
    settingsCache.set('global_logo', initialLogoUrl);
  }
  if (initialFooterImage && !settingsCache.has('footer_image')) {
    settingsCache.set('footer_image', initialFooterImage);
  }
  if (initialNavigationMenu && !settingsCache.has('navigation_menu')) {
    settingsCache.set('navigation_menu', initialNavigationMenu);
  }
  if (initialLegalLinks && !settingsCache.has('footer_legal_links')) {
    settingsCache.set('footer_legal_links', initialLegalLinks);
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
    'footer_variant',
    'footer_theme',
    'footer_bg_color',
    'footer_legal_links',
    'social_instagram',
    'social_linkedin',
    'social_youtube',
    'social_spotify',
    'business_name',
    'business_owner',
    'business_email',
    'business_phone',
    'business_address_city',
    'business_address_street',
    'business_address_postal',
    'business_address_region',
  ]);

  const logoUrl = settings.footer_logo || settings.global_logo;

  let navLinks: { name: string; path: string }[] = [];
  try {
    const parsed: NavItem[] = JSON.parse(settings.navigation_menu || '[]');
    navLinks = flattenMenu(parsed);
  } catch { /* keep empty */ }

  /*
    Les liens de bas de page viennent des réglages, comme la navigation. Ils
    étaient écrits en dur (`/cgv`, `/politique-de-confidentialite`) et
    pointaient vers des pages que ce site n'a pas : trois 404 sur toutes les
    pages du site, dans le pied de page.
  */
  let legalLinks: { name: string; path: string }[] = [];
  try {
    const parsed = JSON.parse(settings.footer_legal_links || '[]');
    if (Array.isArray(parsed)) {
      legalLinks = parsed.filter(
        (l): l is { name: string; path: string } =>
          !!l && typeof l.name === 'string' && typeof l.path === 'string' && !!l.name.trim() && !!l.path.trim(),
      );
    }
  } catch { /* keep empty */ }

  /*
    Modèle de pied de page. Voir `constants/chromeVariants`.

    — « complet » : le rendu d'origine, trois colonnes plus navigation.
    — « colonnes » : même contenu, sans le bandeau visuel du haut.
    — « une ligne » : nom, liens légaux et réseaux, rien d'autre.
  */
  const variant = (settings.footer_variant || 'complet') as FooterVariant;

  /*
    Fond et encre du pied de page.

    Le pied était noir en dur (`bg-[#0f0e0d]`) avec du texte blanc : impossible
    d'avoir un pied clair, et une palette claire donnait un bas de page qui
    n'avait rien à voir avec le reste. Le fond se choisit maintenant dans la
    charte ; l'encre suit le thème, et toutes les nuances du pied en dérivent
    par `color-mix`.
  */
  const footerTheme = settings.footer_theme === 'light' ? 'light' : 'dark';
  const customBg = (settings.footer_bg_color || '').trim();

  // Détection dynamique si la couleur personnalisée est claire ou foncée
  let isLight = footerTheme === 'light';
  if (customBg) {
    const c = customBg.toLowerCase();
    if (c.includes('var(--brand-bg)') || c.includes('light') || c === '#ffffff' || c === '#fafaf9' || c === '#f5f5f4' || c === '#f1f5f2' || c === '#faf7f2') {
      isLight = true;
    } else if (c.includes('var(--brand-text)') || c === '#1c1917' || c === '#0f0e0d' || c === '#181d28') {
      isLight = false;
    } else if (c.startsWith('#')) {
      const hex = c.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        isLight = (r * 299 + g * 587 + b * 114) / 1000 > 160;
      }
    }
  }

  const footerBg = customBg
    || (footerTheme === 'light' ? 'var(--brand-bg, #FFFFFF)' : 'var(--brand-text, #1C1917)');
  const footerInk = isLight ? 'var(--brand-text, #1C1917)' : 'var(--brand-bg, #FFFFFF)';

  const locationLine = [
    settings.business_address_postal,
    settings.business_address_city,
    settings.business_address_region,
  ].filter(Boolean).join(' ');

  const socials = [
    { label: 'Instagram', href: settings.social_instagram, icon: Instagram },
    { label: 'LinkedIn',  href: settings.social_linkedin,  icon: Linkedin  },
    { label: 'YouTube',   href: settings.social_youtube,   icon: Youtube   },
    { label: 'Spotify',   href: settings.social_spotify,   icon: Music2    },
  ].filter(s => !!s.href);

  return (
    <footer
      data-footer-theme={footerTheme}
      className="text-[color:var(--footer-ink)]"
      style={{ backgroundColor: footerBg, ['--footer-ink' as string]: footerInk }}
    >

      {/* Bande accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-sage/40 to-transparent" />

      {/* Corps principal — masqué en entier sur le modèle « une ligne ». */}
      {variant !== 'simple' && (
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-14">

        {/* 3 colonnes : image / tagline / icônes — le modèle « colonnes » s'en passe. */}
        {variant === 'complet' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-end pb-0 border-b border-[color-mix(in_srgb,var(--footer-ink)_8%,transparent)]">

          {/* Colonne gauche : image */}
          <div className="flex justify-center md:justify-start">
            {/*
              Rien tant qu'aucune image n'est choisie dans l'admin. Le réglage
              livrait auparavant une photo Unsplash en dur : le pied de page de
              chaque nouveau site affichait donc le visuel d'un inconnu. Le
              texte alternatif décrivait en plus une activité — « institut à
              domicile » — qui n'est pas celle de tous les sites.
            */}
            {settings.footer_image && (
              <img
                src={settings.footer_image}
                alt={[settings.business_name, settings.business_address_city].filter(Boolean).join(' — ')}
                className="w-56 md:w-72 object-cover rounded-2xl"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>

          {/* Colonne centrale : accroche */}
          <div className="text-left space-y-3 pb-10">
            {(settings.footer_tagline_line1 || settings.footer_tagline_line2) && (
              <p className="text-2xl font-serif font-light text-[color:color-mix(in_srgb,var(--footer-ink)_90%,transparent)] leading-snug">
                {settings.footer_tagline_line1}
                {settings.footer_tagline_line1 && settings.footer_tagline_line2 && <br />}
                {settings.footer_tagline_line2 && (
                  <span className="text-sage">{settings.footer_tagline_line2}</span>
                )}
              </p>
            )}
            {settings.footer_tagline_text && (
              <p className="text-[color:color-mix(in_srgb,var(--footer-ink)_40%,transparent)] text-sm leading-relaxed">
                {settings.footer_tagline_text}
              </p>
            )}
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
                    className="w-10 h-10 flex items-center justify-center border border-[color-mix(in_srgb,var(--footer-ink)_10%,transparent)] hover:border-sage/60 hover:text-sage text-[color:color-mix(in_srgb,var(--footer-ink)_50%,transparent)] transition-all duration-200"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Liens + infos */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 ${variant === 'complet' ? 'pt-12' : ''}`}>

          {/* Navigation */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[color:color-mix(in_srgb,var(--footer-ink)_30%,transparent)] mb-5">Navigation</p>
            <nav className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              {navLinks.map(({ name, path }) => (
                <Link
                  key={path}
                  href={path}
                  className="text-sm text-[color:color-mix(in_srgb,var(--footer-ink)_50%,transparent)] hover:text-[color:var(--footer-ink)] transition-colors duration-200 flex items-center gap-1.5 group w-fit"
                >
                  <span className="w-3 h-px bg-[color-mix(in_srgb,var(--footer-ink)_20%,transparent)] group-hover:bg-sage group-hover:w-4 transition-all duration-200 shrink-0" />
                  {name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Lieu & contact */}
          <div>
            {/*
              L'intitulé et la première ligne disaient « Institut » et
              « Institut à domicile » : l'activité du site d'origine, affichée
              en pied de page de tout site issu du template. On n'imprime plus
              que ce qui est réellement renseigné.
            */}
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[color:color-mix(in_srgb,var(--footer-ink)_30%,transparent)] mb-5">Coordonnées</p>
            <address className="not-italic text-sm text-[color:color-mix(in_srgb,var(--footer-ink)_50%,transparent)] leading-relaxed space-y-2">
              {(settings.business_address_street || locationLine) && (
                <p>
                  {settings.business_address_street && (
                    <>
                      {settings.business_address_street}
                      <br />
                    </>
                  )}
                  <span className="text-[color:color-mix(in_srgb,var(--footer-ink)_30%,transparent)]">{locationLine}</span>
                </p>
              )}
              {settings.business_phone && (
                <p>
                  <a href={`tel:${settings.business_phone.replace(/\s+/g, '')}`} className="hover:text-[color:var(--footer-ink)] transition-colors">
                    {settings.business_phone}
                  </a>
                </p>
              )}
              {settings.business_email && (
                <p>
                  <a href={`mailto:${settings.business_email}`} className="hover:text-[color:var(--footer-ink)] transition-colors break-all">
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
      )}

      {/* Barre basse — présente dans les trois modèles. */}
      <div className={variant === 'simple' ? '' : 'border-t border-[color-mix(in_srgb,var(--footer-ink)_5%,transparent)]'}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[color:color-mix(in_srgb,var(--footer-ink)_25%,transparent)] tracking-wide">
          <span>© {new Date().getFullYear()} {[settings.business_name, settings.business_owner].filter(Boolean).join(' · ')}</span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            {legalLinks.map((link) => (
              <Link key={link.path} href={link.path} className="hover:text-[color:color-mix(in_srgb,var(--footer-ink)_60%,transparent)] transition-colors">
                {link.name}
              </Link>
            ))}
            {variant === 'simple' && socials.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-[color:color-mix(in_srgb,var(--footer-ink)_40%,transparent)] transition-colors hover:text-[color:var(--footer-ink)]"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
