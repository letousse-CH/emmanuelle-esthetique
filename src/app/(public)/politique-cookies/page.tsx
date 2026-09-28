import { fetchPageBySlug } from '../../../services/dynamicPages';
import DynamicPageClient from '../../../components/pagebuilder/DynamicPageClient';
import CookiePreferencesButton from '../../../components/CookiePreferencesButton';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../config/site';

const SLUG = 'politique-cookies';

export const metadata = {
  title: `Politique de cookies | ${SITE_CONFIG.name}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CookiePolicyPage() {
  const [cmsPage, business] = await Promise.all([
    fetchPageBySlug(SLUG, false),
    getBusinessInfoServer(),
  ]);

  const fallback = (
    <div className="pt-32 pb-28 px-6 bg-paper min-h-screen animate-fadein">
      <div className="max-w-3xl mx-auto">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400 mb-4">Vie privée</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-16">Politique de cookies</h1>

          <div className="divide-y divide-stone-100 text-stone-600">
            <section className="pb-10">
              <h2 className="font-serif font-semibold text-stone-900">1. Ce qu'est un cookie</h2>
              <p className="leading-7">
                Un cookie est un petit fichier déposé par un site dans votre navigateur, qui permet de
                reconnaître votre appareil lors d'une visite ultérieure ou de mesurer la fréquentation
                d'un site. Certains outils utilisent des technologies similaires (stockage local,
                identifiants techniques) sans être des cookies au sens strict ; nous les traitons ici de
                la même façon, par souci de clarté.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">2. Cookies strictement nécessaires</h2>
              <p className="leading-7">
                Ces cookies et technologies assurent le fonctionnement de base du site : navigation,
                affichage sécurisé, et — pour {business.owner} uniquement — la connexion à l'espace
                d'administration. Ils sont toujours actifs et ne nécessitent pas votre consentement, car
                le site ne peut pas fonctionner correctement sans eux.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">3. Mesure d'audience interne</h2>
              <p className="leading-7">
                Le site enregistre, dans sa propre base de données, les pages consultées et leur
                provenance (site référent), afin de savoir quels contenus sont utiles aux visiteuses. Cette
                mesure ne dépose aucun cookie de suivi publicitaire, ne croise aucune donnée avec un autre
                site, et ne permet pas de vous identifier individuellement.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">4. Mesure d'audience Google Analytics (soumise à votre accord)</h2>
              <p className="leading-7">
                Avec votre consentement, donné via le bandeau affiché à votre première visite, le site
                utilise Google Analytics pour mesurer sa fréquentation (pages vues, durée de visite,
                appareil utilisé). Google Analytics dépose des cookies (notamment{' '}
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[13px]">_ga</code>,{' '}
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[13px]">_ga_*</code>) conservés
                jusqu'à 13 mois. Ces données peuvent être traitées par Google LLC (États-Unis) ; Google
                adhère aux clauses contractuelles types reconnues par la Confédération pour ce type de
                transfert.
              </p>
              <p className="leading-7 mt-5">
                Tant que vous n'avez pas donné votre accord, aucun script Google Analytics n'est chargé et
                aucun cookie associé n'est déposé.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">5. Google Search Console</h2>
              <p className="leading-7">
                Le site est référencé auprès de Google Search Console afin de suivre son indexation et ses
                performances dans les résultats de recherche. Cet outil ne dépose aucun cookie dans votre
                navigateur et ne collecte aucune donnée personnelle vous concernant : il analyse
                uniquement la structure du site et son apparition dans les pages de résultats Google.
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">6. Fonctionnalités à venir</h2>
              <p className="leading-7">
                {business.owner} prévoit d'ouvrir progressivement de nouveaux services sur ce site :
                inscription à une newsletter, prise de rendez-vous en ligne, achat de bons cadeaux. Chacun
                de ces services collectera uniquement les données nécessaires à son usage (adresse e-mail
                pour la newsletter, informations de réservation ou de paiement pour la prise de rendez-vous
                et les bons cadeaux), avec votre consentement explicite ou dans le cadre de l'exécution de
                votre commande. Cette page sera mise à jour dès l'activation de chacun de ces services pour
                en détailler le fonctionnement et, le cas échéant, les prestataires tiers impliqués
                (paiement, réservation, envoi d'e-mails).
              </p>
            </section>

            <section className="py-10">
              <h2 className="font-serif font-semibold text-stone-900">7. Gérer vos choix</h2>
              <p className="leading-7">
                Vous pouvez modifier votre consentement à tout moment, sans effet sur les traitements déjà
                effectués :
              </p>
              <div className="mt-6">
                <CookiePreferencesButton />
              </div>
              <p className="leading-7 mt-5">
                Vous pouvez aussi bloquer ou supprimer les cookies directement depuis les réglages de votre
                navigateur ; cela peut toutefois limiter certaines fonctionnalités du site.
              </p>
            </section>

            <section className="pt-10">
              <h2 className="font-serif font-semibold text-stone-900">8. Vos droits (nLPD)</h2>
              <p className="leading-7">
                Conformément à la Loi fédérale sur la protection des données (nLPD), vous disposez d'un
                droit d'accès, de rectification et de suppression des données vous concernant. Pour
                l'exercer, écrivez à{' '}
                <a href={`mailto:${business.email}`} className="text-sage hover:underline">
                  {business.email}
                </a>
                . Pour en savoir plus sur l'éditeur du site, consultez les{' '}
                <a href="/mentions-legales" className="text-sage hover:underline">
                  mentions légales
                </a>
                .
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
