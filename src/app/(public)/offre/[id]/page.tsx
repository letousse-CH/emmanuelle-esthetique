import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockRenderer } from '../../../../components/blocks/BlockRenderer';
import { resolvePageContent } from '../../../../components/blocks/pageContent';
import type { ContentStructure, CurrentOfferBlock } from '../../../../components/blocks/types';
import { BLOCK_META } from '../../../../components/blocks/blockMeta';
import { fetchHomePage } from '../../../../services/homePage';
import { getOfferForPage, getPublicOffers } from '../../../../services/offersServer';
import { getSettingsServer } from '../../../../services/settingsServer';
import { getImageDims } from '../../../../utils/imageDims';
import { SITE_CONFIG } from '../../../../config/site';
import type { OfferStatus, PublicOffer } from '../../../../types/offers';
import { formatOfferPeriod, offerAccroche, offerPagePath, offerShareSummary } from '../../../../types/offers';

/**
 * Page d'une offre du moment : c'est le lien partagé sur WhatsApp, Facebook…
 * Ses balises Open Graph (visuel carré, titre, prix, période) fabriquent
 * l'aperçu du message. L'offre s'affiche avec le même encart que l'accueil
 * (mêmes réglages de bloc, couleur de carte comprise).
 *
 * Une offre terminée, complète ou archivée n'est pas un 404 — le lien a pu être
 * partagé : la page le dit et propose l'offre en cours s'il y en a une.
 */
export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function brandName(): Promise<string> {
  const { business_name } = await getSettingsServer(['business_name']);
  return business_name || SITE_CONFIG.name;
}

/** Le bloc « Offre du moment » de l'accueil, pour reprendre ses réglages ; sinon ceux par défaut. */
async function offerBlockSettings(): Promise<CurrentOfferBlock> {
  try {
    const { page } = await fetchHomePage();
    for (const s of resolvePageContent(page)) for (const c of s.columns) for (const b of c.blocks) {
      if (b.type === 'current_offer') return b;
    }
  } catch { /* repli ci-dessous */ }
  return BLOCK_META.current_offer.create() as CurrentOfferBlock;
}

function offerSection(id: string, block: CurrentOfferBlock): ContentStructure {
  return [{
    id: `offre-${id}`,
    layout: '1-col',
    background: 'dark',
    paddingY: 'large',
    width: 'wide',
    columns: [{ id: `offre-${id}-col`, blocks: [{ ...block, id: `offre-${id}-bloc` }] }],
  }] as ContentStructure;
}

const ENDED: Record<Exclude<OfferStatus, 'en_cours'>, string> = {
  terminee: 'Cette offre est terminée.',
  complete: 'Toutes les places de cette offre ont été réservées.',
  archivee: 'Cette offre est terminée.',
  a_venir: 'Cette offre n’a pas encore commencé.',
  brouillon: 'Cette offre n’est pas disponible.',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getOfferForPage(id);
  if (!data) return { title: 'Offre introuvable', robots: { index: false } };

  const { offer, status } = data;
  const brand = await brandName();
  const url = `${SITE_CONFIG.url}${offerPagePath(offer.id)}`;
  const description = offerShareSummary(offer);
  const dims = offer.image_url ? await getImageDims(offer.image_url).catch(() => null) : null;
  const images = offer.image_url
    ? [{ url: offer.image_url, alt: offer.titre, ...(dims ? { width: dims.w, height: dims.h } : {}) }]
    : undefined;

  return {
    title: `${offer.titre} | ${brand}`,
    description,
    alternates: { canonical: url },
    // Une offre qui n'est plus valable ne doit pas rester dans les résultats de recherche.
    robots: status === 'en_cours' ? undefined : { index: false, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: brand,
      locale: 'fr_CH',
      title: offer.titre,
      description,
      images,
    },
    twitter: { card: 'summary_large_image', title: offer.titre, description, images: images?.map((i) => i.url) },
  };
}

function offerJsonLd(o: PublicOffer, brand: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: o.titre,
    description: offerAccroche(o.description, 300) || undefined,
    url: `${SITE_CONFIG.url}${offerPagePath(o.id)}`,
    image: o.image_url || undefined,
    price: o.prix_chf.toFixed(2),
    priceCurrency: 'CHF',
    validFrom: o.date_debut,
    validThrough: o.date_fin,
    availability: 'https://schema.org/LimitedAvailability',
    seller: { '@type': 'BeautySalon', name: brand, url: SITE_CONFIG.url },
  };
}

export default async function OffrePage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOfferForPage(id);
  if (!data) notFound();

  const { offer, status } = data;
  const [brand, block] = await Promise.all([brandName(), offerBlockSettings()]);

  if (status === 'en_cours') {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offerJsonLd(offer, brand)) }} />
        <h1 className="sr-only">{offer.titre}</h1>
        <BlockRenderer content={offerSection(offer.id, block)} data={{ offers: [offer], brand }} />
      </>
    );
  }

  // Offre plus (ou pas encore) valable : on le dit, et on montre celle du moment s'il y en a une.
  const current = (await getPublicOffers()).filter((o) => o.id !== offer.id);
  return (
    <>
      <section className="px-6 pb-12 pt-[calc(var(--nav-h,138px)+3rem)] text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="font-serif text-3xl font-semibold text-[#12283A]">{offer.titre}</h1>
          <div className="mt-4 text-[17px] text-[#5F676E]">
            {ENDED[status]}
            {status === 'a_venir' && <> Elle sera valable {formatOfferPeriod(offer.date_debut, offer.date_fin)}.</>}
          </div>
          {current.length === 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/soins" data-btn="primary" className="pb-btn btn-primary">Voir la carte des soins</Link>
              <Link href="/reservation" data-btn="secondary" className="pb-btn btn-secondary">Prendre rendez-vous</Link>
            </div>
          )}
          {current.length > 0 && <div className="mt-6 text-[15px] font-semibold text-[#12283A]">En ce moment :</div>}
        </div>
      </section>
      {current.length > 0 && <BlockRenderer content={offerSection('en-cours', block)} data={{ offers: current, brand }} />}
    </>
  );
}
