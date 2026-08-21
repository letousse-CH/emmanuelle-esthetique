import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';

import ContactForm from '../../../components/ContactForm';
import DynamicPageClient from '../../../components/pagebuilder/DynamicPageClient';
import PageChrome from '../../../components/PageChrome';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../config/site';
import { fetchPageBySlug } from '../../../services/dynamicPages';
import { getSettingsServer } from '../../../services/settingsServer';
import { buildMetadata, getPageMeta } from '../../../services/pageMeta';

/**
 * Page de contact.
 *
 * Deux régimes, dans cet ordre :
 *
 * 1. **Une page « contact » créée dans le constructeur fait autorité.** C'est
 *    l'échappatoire pour qui veut une vraie mise en page : sans elle, `/contact`
 *    était la seule page publique dont le contenu vivait dans le code, hors de
 *    portée du client.
 *
 * 2. **Sinon, un gabarit minimal**, construit uniquement à partir des réglages.
 *    Il n'affiche que ce qui est renseigné. Le texte qui s'y trouvait —
 *    « Dites-moi ce qui vous ferait du bien », « Institut à domicile,
 *    l'adresse exacte vous est transmise… » — décrivait l'activité du site
 *    d'origine et s'affichait tel quel sur tout site issu du template.
 */
export const revalidate = 60;

const CONTACT_SLUG = 'contact';

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchPageBySlug(CONTACT_SLUG, false);
  const businessName = (await getSettingsServer(['business_name'])).business_name || SITE_CONFIG.name;

  const meta = await getPageMeta(CONTACT_SLUG, {
    title: `${page?.title ?? 'Contact'} | ${businessName}`,
    description: SITE_CONFIG.seoDefaults.description,
    og_title: `${page?.title ?? 'Contact'} | ${businessName}`,
    og_description: SITE_CONFIG.seoDefaults.ogDescription,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
    keywords: SITE_CONFIG.seoDefaults.keywords,
  });

  return buildMetadata(CONTACT_SLUG, meta, `${SITE_CONFIG.url}/contact`);
}

export default async function ContactPage() {
  const page = await fetchPageBySlug(CONTACT_SLUG, false);

  if (page) {
    return (
      <>
        {(!page.show_header || !page.show_footer) && (
          <PageChrome showHeader={page.show_header ?? true} showFooter={page.show_footer ?? true} />
        )}
        <DynamicPageClient initialPage={page} slug={CONTACT_SLUG} />
      </>
    );
  }

  const business = await getBusinessInfoServer();
  const settings = await getSettingsServer(['contact_intro', 'contact_address_note', 'header_register_link']);
  const locationLabel = [business.addressCity, business.addressRegion].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-paper px-6 pb-24 pt-32">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-sage">Contact</span>
        <h1 className="mb-6 font-serif text-4xl font-bold text-stone-900 md:text-6xl">
          {business.name ? `Écrire à ${business.name}` : 'Nous écrire'}
        </h1>
        {settings.contact_intro && (
          <p className="text-lg font-light leading-relaxed text-stone-500">{settings.contact_intro}</p>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl items-start gap-16 md:grid-cols-2">
        <div className="space-y-8">
          {(business.owner || business.name) && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-stone-500">Contact</p>
              <p className="text-lg font-medium text-stone-900">
                {[business.owner, business.name].filter(Boolean).join(' — ')}
              </p>
            </div>
          )}

          {business.email && (
            <div className="flex items-start gap-5">
              <div className="shrink-0 rounded-full bg-sage/10 p-3"><Mail className="h-5 w-5 text-sage" /></div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-stone-500">E-mail</p>
                <a href={`mailto:${business.email}`} className="text-lg font-medium text-stone-900 transition-colors hover:text-sage">
                  {business.email}
                </a>
              </div>
            </div>
          )}

          {business.phone && (
            <div className="flex items-start gap-5">
              <div className="shrink-0 rounded-full bg-sage/10 p-3"><Phone className="h-5 w-5 text-sage" /></div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-stone-500">Téléphone</p>
                <a href={`tel:${business.phone.replace(/\s+/g, '')}`} className="text-lg font-medium text-stone-900 transition-colors hover:text-sage">
                  {business.phone}
                </a>
              </div>
            </div>
          )}

          {(locationLabel || settings.contact_address_note) && (
            <div className="flex items-start gap-5">
              <div className="shrink-0 rounded-full bg-sage/10 p-3"><MapPin className="h-5 w-5 text-sage" /></div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-stone-500">Adresse</p>
                {locationLabel && <p className="text-lg font-medium text-stone-900">{locationLabel}</p>}
                {settings.contact_address_note && (
                  <p className="mt-1 text-sm text-stone-500">{settings.contact_address_note}</p>
                )}
              </div>
            </div>
          )}

          {settings.header_register_link && (
            <div className="pt-4">
              <a
                href={settings.header_register_link}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage transition-all hover:gap-3"
              >
                Prendre rendez-vous →
              </a>
            </div>
          )}
        </div>

        <ContactForm light />
      </div>
    </div>
  );
}
