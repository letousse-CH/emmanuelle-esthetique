import { Lora, Open_Sans } from 'next/font/google';
import GlobalStyles from '../../components/GlobalStyles';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageViewTracker from '../../components/PageViewTracker';
import AgentChatWidget from '../../components/AgentChatWidget';
import MobileCallBar from '../../components/MobileCallBar';
import CookieConsent from '../../components/CookieConsent';
import GoogleAnalytics from '../../components/GoogleAnalytics';
import { getSettingsServer, getDesignTokensServer } from '../../services/settingsServer';
import { isModuleEnabledServer } from '../../config/modules';
import { fetchPublicAgent } from '../../services/agents';
import { DRAFT_PREVIEW } from '../../services/draftPreview';
import type { SettingKey } from '../../constants/settings';

/*
  Pas de `force-dynamic` : le layout ne lit ni cookies, ni en-têtes, ni paramètres
  d'URL. Il était dynamique à cause de `noStore()` dans getSettingsServer (retiré,
  sauf en DRAFT_PREVIEW). Les pages publiques sont rendues en ISR — durée de
  revalidation fixée par chaque page (`revalidate = 60`) — et l'éditeur de pages
  appelle `/api/revalidate` à chaque enregistrement.
*/

// Polices de la charte en vigueur (Design & Style : titres Lora, texte Open Sans), servies par le
// site : préchargées, sans aller-retour vers Google, avec un repli aux métriques ajustées
// (`adjustFontFallback` par défaut) — la police arrive sans faire sauter la mise en page.
// Une police variable : un seul fichier couvre tous les poids. Déclarées ici et non dans le layout
// racine : le back-office ne les utilise pas et ne doit pas les précharger. Le lien avec les
// réglages se fait dans `constants/selfHostedFonts.ts`.
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans', display: 'swap' });

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tokens, settings] = await Promise.all([getDesignTokensServer(), getSettingsServer([
    'global_logo',
    'footer_image',
    'navigation_menu',
    'header_variant',
    'footer_variant',
    'footer_theme',
    'footer_bg_color',
    'footer_legal_links',
    'header_register_link',
    'social_instagram',
    'social_linkedin',
    'social_youtube',
    'social_spotify',
    'business_name',
    'business_phone',
    'business_owner',
    'business_address_city',
    'business_address_region',
    ...(DRAFT_PREVIEW ? (['navigation_menu_draft'] as SettingKey[]) : []),
  ])]);
  if (DRAFT_PREVIEW && settings['navigation_menu_draft' as SettingKey]) {
    settings.navigation_menu = settings['navigation_menu_draft' as SettingKey];
  }

  // Le widget de conversation n'apparaît que si le module est actif *et* qu'un
  // agent est réellement publié : un bouton qui ouvrirait sur le vide serait
  // pire que pas de bouton du tout.
  const agent = (await isModuleEnabledServer('agents')) ? await fetchPublicAgent() : null;

  return (
    /*
      `data-site-theme` délimite la portée du style piloté depuis l'admin.
      Le back-office ne porte pas cet attribut : la palette d'un client ne peut
      donc pas déborder sur l'interface d'administration et la rendre illisible.
    */
    <div data-site-theme className={`contents ${lora.variable} ${openSans.variable}`}>
      <GlobalStyles initialTokens={tokens} />
      <PageViewTracker />
      <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      <CookieConsent />
      <Navbar
        initialVariant={settings.header_variant}
        initialLogoUrl={settings.global_logo}
        initialNavigationMenu={settings.navigation_menu}
        initialRegisterLink={settings.header_register_link}
        initialBusinessName={settings.business_name}
      />
      {/* role et non <main> : les feuilles du site ciblent `main section …` (index.css) et changeraient de rendu. */}
      <div className="flex-grow" role="main">
        {children}
      </div>
      <Footer
        initialVariant={settings.footer_variant}
        initialTheme={settings.footer_theme}
        initialBgColor={settings.footer_bg_color}
        initialLogoUrl={settings.global_logo}
        initialFooterImage={settings.footer_image}
        initialNavigationMenu={settings.navigation_menu}
        initialLegalLinks={settings.footer_legal_links}
        initialSocials={{
          social_instagram: settings.social_instagram,
          social_linkedin: settings.social_linkedin,
          social_youtube: settings.social_youtube,
          social_spotify: settings.social_spotify,
        }}
        initialBusiness={{
          business_name: settings.business_name,
          business_owner: settings.business_owner,
          business_address_city: settings.business_address_city,
          business_address_region: settings.business_address_region,
        }}
      />
      <MobileCallBar phone={settings.business_phone} />
      {agent && (
        <AgentChatWidget
          slug={agent.slug}
          name={agent.name}
          avatar={agent.avatar}
          greeting={agent.greeting || 'Bonjour ! Que puis-je faire pour vous ?'}
        />
      )}
    </div>
  );
}
