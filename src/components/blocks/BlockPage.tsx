/**
 * Page publique v2 rendue côté serveur : HTML complet pour les visiteurs et
 * les moteurs, sans JavaScript nécessaire à l'affichage. L'éditeur ne se
 * charge que pour une administratrice connectée (PageEditGate).
 */
import type { DynamicPage } from '../../services/dynamicPages';
import { BlockRenderer, collectFaq, collectImageUrlsNeedingDims } from './BlockRenderer';
import { getImageDimsMap } from '../../utils/imageDims';
import { isOptimizable } from '../../utils/imageOptim';
import { resolvePageContent } from './pageContent';
import PageEditGate from './PageEditGate';

export default async function BlockPage({ page }: { page: DynamicPage }) {
  const content = resolvePageContent(page);
  // Largeur/hauteur des photos sans ratio imposé : le navigateur réserve leur place (pas de CLS).
  const dims = await getImageDimsMap(collectImageUrlsNeedingDims(content).filter(isOptimizable));
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
        <BlockRenderer content={content} images={{ dims }} />
      </div>
      <PageEditGate pageId={page.id} />
    </>
  );
}
