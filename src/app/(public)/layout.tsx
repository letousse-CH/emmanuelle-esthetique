import GlobalStyles from '../../components/GlobalStyles';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageViewTracker from '../../components/PageViewTracker';
import AgentChatWidget from '../../components/AgentChatWidget';
import { getSettingsServer } from '../../services/settingsServer';
import { isModuleEnabledServer } from '../../config/modules';
import { fetchPublicAgent } from '../../services/agents';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettingsServer([
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
    'business_owner',
    'business_address_city',
    'business_address_region',
  ]);

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
    <div data-site-theme className="contents">
      <GlobalStyles />
      <PageViewTracker />
      <Navbar
        initialVariant={settings.header_variant}
        initialLogoUrl={settings.global_logo}
        initialNavigationMenu={settings.navigation_menu}
        initialRegisterLink={settings.header_register_link}
        initialBusinessName={settings.business_name}
      />
      <div className="flex-grow">
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
