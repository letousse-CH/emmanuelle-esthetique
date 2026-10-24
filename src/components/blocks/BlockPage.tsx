/**
 * Page publique v2 rendue côté serveur : HTML complet pour les visiteurs et
 * les moteurs, sans JavaScript nécessaire à l'affichage. L'éditeur ne se
 * charge que pour une administratrice connectée (PageEditGate).
 */
import type { DynamicPage } from '../../services/dynamicPages';
import { BlockRenderer, collectFaq, collectImageUrlsNeedingDims, hasCurrentOfferBlock, hasGiftBlock, type BlockData } from './BlockRenderer';
import { getImageDimsMap } from '../../utils/imageDims';
import { isOptimizable } from '../../utils/imageOptim';
import { resolvePageContent } from './pageContent';
import PageEditGate from './PageEditGate';
import { getPublicOffers } from '../../services/offersServer';
import { getSettingsServer } from '../../services/settingsServer';
import { getBusinessInfoServer } from '../../config/site';

export default async function BlockPage({ page }: { page: DynamicPage }) {
  const content = resolvePageContent(page);
  // Largeur/hauteur des photos sans ratio imposé : le navigateur réserve leur place (pas de CLS).
  const [dims, offers] = await Promise.all([
    getImageDimsMap(collectImageUrlsNeedingDims(content).filter(isOptimizable)),
    // Offre du moment : lue à chaque régénération de la page (ISR), donc elle
    // apparaît et disparaît d'elle-même aux dates prévues.
    hasCurrentOfferBlock(content) ? getPublicOffers() : Promise.resolve(undefined),
  ]);
  const brand = offers?.length ? (await getSettingsServer(['business_name'])).business_name || undefined : undefined;
  const gift = hasGiftBlock(content) ? await loadGiftData() : undefined;
  const faq = collectFaq(content);
  const faqLd = faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
      }
    : null;

  return (
    <>
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      {/* `admin-exclude` : l'éditeur de textes générique (UniversalPageEditor) ne touche pas au contenu des pages en blocs. */}
      <div className="admin-exclude" data-page-id={page.id}>
        <BlockRenderer content={content} images={{ dims }} data={{ offers, brand, gift }} />
      </div>
      <PageEditGate pageId={page.id} />
    </>
  );
}

/** Logo clair, ville et validité : ce qu'affiche le bon en miniature de l'encart « Offrir ». */
async function loadGiftData(): Promise<BlockData['gift']> {
  const [business, s] = await Promise.all([
    getBusinessInfoServer(),
    getSettingsServer(['footer_logo', 'caisse_bon_validite_mois']),
  ]);
  return {
    businessName: business.name,
    logoLight: s.footer_logo || '',
    place: [business.addressPostal, business.addressCity].filter(Boolean).join(' '),
    validiteMois: Math.max(12, Number(s.caisse_bon_validite_mois) || 60),
  };
}
