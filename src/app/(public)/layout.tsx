import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageViewTracker from '../../components/PageViewTracker';
import { getSettingsServer } from '../../services/settingsServer';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettingsServer([
    'global_logo',
    'footer_image',
    'navigation_menu',
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

  return (
    <>
      <PageViewTracker />
      <Navbar
        initialLogoUrl={settings.global_logo}
        initialNavigationMenu={settings.navigation_menu}
        initialRegisterLink={settings.header_register_link}
      />
      <div className="flex-grow">
        {children}
      </div>
      <Footer
        initialLogoUrl={settings.global_logo}
        initialFooterImage={settings.footer_image}
        initialNavigationMenu={settings.navigation_menu}
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
    </>
  );
}
