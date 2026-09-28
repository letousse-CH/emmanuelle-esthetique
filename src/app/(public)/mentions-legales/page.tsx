import { fetchPageBySlug } from '../../../services/dynamicPages';
import DynamicPageClient from '../../../components/pagebuilder/DynamicPageClient';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../config/site';

const SLUG = 'mentions-legales';

export const metadata = {
  title: `Mentions Légales | ${SITE_CONFIG.name}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LegalPage() {
  const [cmsPage, business] = await Promise.all([
    fetchPageBySlug(SLUG, false),
    getBusinessInfoServer(),
  ]);

  const addressLine = [business.addressStreet, business.addressPostal, business.addressCity, business.addressRegion]
    .filter(Boolean)
    .join(', ') || `${business.addressCity}, ${business.addressRegion}, Suisse`;

  const fallback = (
    <div className="pt-32 pb-28 px-6 bg-paper min-h-screen animate-fadein">
      <div className="max-w-3xl mx-auto">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400 mb-4">Informations légales</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-16">Mentions Légales</h1>

          <div className="divide-y divide-stone-100 text-stone-600">
            <section className="pb-10">
              <h2 className="font-serif font-semibold text-stone-900">1. Édition du site</h2>
              <p className="leading-7">
                Le présent site est édité par :<br />
                <strong className="text-stone-800">{business.owner}</strong><br />
                Adresse : {addressLine}<br />
                Téléphone : {business.phone}<br />
                E-mail : {business.email}
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">2. Hébergement</h2>
              <p className="leading-7">
                Le site est hébergé par :<br />
                <strong className="text-stone-800">Netlify, Inc.</strong><br />
                512 2nd Street, Suite 200, San Francisco, CA 94107, USA<br />
                Site web : <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer" className="text-sage hover:underline">www.netlify.com</a>
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">3. Propriété intellectuelle</h2>
              <p className="leading-7">
                L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, etc.) est la propriété exclusive de {business.owner}, sauf mention contraire. Toute reproduction, distribution, modification ou publication de ces différents éléments est strictement interdite sans l'accord exprès par écrit de l'auteur.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">4. Protection des données (nLPD)</h2>
              <p className="leading-7">
                Conformément à la nouvelle Loi fédérale sur la Protection des Données (nLPD) en vigueur en Suisse :
              </p>
              <ul className="list-disc pl-6 space-y-3 mt-5 leading-7">
                <li>Les données collectées via le formulaire de contact sont utilisées exclusivement pour répondre à vos demandes de consultation.</li>
                <li>Aucune donnée n'est transmise à des tiers sans votre consentement explicite.</li>
                <li>Vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles sur simple demande par e-mail.</li>
              </ul>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">5. Limitation de responsabilité</h2>
              <p className="leading-7">
                {business.owner} s'efforce de fournir des informations aussi précises que possible. Toutefois, il ne pourra être tenu responsable des omissions, des inexactitudes et des carences dans la mise à jour. L'utilisation du site se fait sous votre propre responsabilité.
              </p>
            </section>

            <section className="pt-10">
              <h2 className="font-serif font-semibold text-stone-900">6. Droit applicable</h2>
              <p className="leading-7">
                Tout litige en relation avec l'utilisation du site est soumis au droit suisse. Le for juridique est situé à {business.addressCity || '[Votre Commune de résidence/professionnelle en Suisse]'}.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="legal-page">
      <DynamicPageClient
        initialPage={cmsPage}
        slug={SLUG}
        fallback={fallback}
      />
    </div>
  );
}
