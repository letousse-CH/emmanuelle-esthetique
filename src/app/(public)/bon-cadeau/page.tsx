/**
 * `/bon-cadeau` : la page du bon cadeau ET sa commande en ligne (fusionnées le
 * 2026-10-25 ; `/bon-cadeau/commander` y redirige en 301, `next.config.ts`).
 *
 * En tête, rendus par le code : l'en-tête (H1) et le parcours de commande. En
 * dessous, le contenu de la page `bon-cadeau` du page builder (conditions,
 * FAQ…), qu'Emmanuelle modifie comme les autres pages. Cette route passe
 * avant l'attrape-tout `[...slug]`.
 */
import type { Metadata } from 'next';
import GiftOrderClient from './GiftOrderClient';
import './bon-cadeau.css';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../config/site';
import { getSettingsServer } from '../../../services/settingsServer';
import { supabase } from '../../../services/supabase';
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';
import { getGiftOrderSettings, isGiftOrderOpen, loadGiftCatalog } from '../../../services/giftOrders';
import { buildBreadcrumbJsonLd } from '../../../utils/pageJsonLd';
import { fetchPageBySlug } from '../../../services/dynamicPages';
import { buildMetadata, getPageMeta } from '../../../services/pageMeta';
import BlockPage from '../../../components/blocks/BlockPage';
import PageChrome from '../../../components/PageChrome';
import type { GiftCatalogItem } from '../../../types/giftOrders';
import { QUALITY_HERO, optimizedImgProps } from '../../../utils/imageOptim';
import VoucherCard from '../../../components/gift/VoucherCard';
import { GIFT_VISUALS } from '../../../components/gift/visuals';

export const revalidate = 60;

const SLUG = 'bon-cadeau';

export async function generateMetadata(): Promise<Metadata> {
  const [business, page] = await Promise.all([getBusinessInfoServer(), fetchPageBySlug(SLUG, false)]);
  const name = business.name || SITE_CONFIG.name;
  // Réglages SEO de la page (admin) d'abord ; à défaut, ce texte.
  const title = `Bon cadeau à offrir | ${name}`;
  const description = `Offrez un bon cadeau ${name} : un montant dès CHF 100 ou un ou plusieurs soins de la carte, avec votre petit mot. Paiement TWINT, bon envoyé en PDF par e-mail.`;
  const meta = await getPageMeta(page?.slug ?? SLUG, {
    title,
    description,
    og_title: title,
    og_description: description,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
  });
  return buildMetadata(SLUG, meta, `${SITE_CONFIG.url}/${SLUG}`);
}

export default async function BonCadeauPage() {
  const [business, settings, s, page] = await Promise.all([
    getBusinessInfoServer(),
    getGiftOrderSettings(),
    getSettingsServer(['caisse_bon_validite_mois', 'caisse_bon_mentions', 'footer_logo', 'global_logo']),
    fetchPageBySlug(SLUG, false),
  ]);
  const open = await isGiftOrderOpen(settings).catch(() => false);

  let catalogue: GiftCatalogItem[] = [];
  if (open) {
    try {
      catalogue = await loadGiftCatalog(getSupabaseAdmin() ?? supabase);
    } catch (err) {
      // Sans carte, le montant libre reste possible.
      console.warn('[bon-cadeau] Carte indisponible:', err);
    }
  }

  const breadcrumbLd = buildBreadcrumbJsonLd({
    slug: SLUG,
    pageTitle: page?.title || 'Bon cadeau',
    siteUrl: SITE_CONFIG.url,
    parents: [],
  });
  const validiteMois = Math.max(12, Number(s.caisse_bon_validite_mois) || 60);
  // Le logo clair du pied de page, posé sur le bandeau marine du bon.
  const logoLight = s.footer_logo || '';
  const place = [business.addressPostal, business.addressCity].filter(Boolean).join(' ');
  const businessName = business.name || SITE_CONFIG.name;

  return (
    <>
      {breadcrumbLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      )}
      {/* En-tête rendu côté serveur : le H1 figure dans le HTML que lisent les moteurs. */}
      <div className="gco-hero">
        <div className="gco-container gco-hero__grid">
          <div className="gco-hero__text">
            <div className="gco-eyebrow">Bon cadeau · {business.addressCity || 'Palézieux-Gare'}</div>
            <h1>Offrir un moment d’exception</h1>
            <div className="gco-lead">
              {open
                ? 'Un soin du visage Phytomer, un massage, un rituel, ou un montant à choisir : composez le bon, ajoutez quelques mots, il arrive en PDF par e-mail, prêt à offrir.'
                : 'Un montant ou un soin de la carte, pour la personne de votre choix : une parenthèse de douceur à offrir.'}
            </div>
            {open && (
              <>
                <ul className="gco-assure algue-list">
                  <li>Dès CHF {settings.montantMin}, ou les soins de votre choix</li>
                  <li>Votre message imprimé sur le bon</li>
                  <li>Valable {validiteMois} mois · paiement TWINT</li>
                </ul>
                <a href="#composer" data-btn="primary" className="gco-hero__cta">Composer mon bon</a>
              </>
            )}
          </div>
          <div className="gco-hero__visual" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...optimizedImgProps(GIFT_VISUALS.hero.url, '(min-width: 1024px) 460px, 80vw', undefined, QUALITY_HERO)}
              alt=""
              className="gco-hero__photo"
              style={{ objectPosition: GIFT_VISUALS.hero.focus }}
              fetchPriority="high"
            />
            <VoucherCard
              businessName={businessName}
              logoLight={logoLight}
              place={place}
              beneficiaire="Léa"
              montant={150}
              message="Prends du temps pour toi."
              validiteMois={validiteMois}
              className="gv--hero"
              sizes="200px"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/algue.svg" alt="" className="gco-hero__algue" />
          </div>
        </div>
      </div>
      <GiftOrderClient
        open={open}
        catalogue={catalogue}
        montantMin={settings.montantMin}
        validiteMois={validiteMois}
        mentions={s.caisse_bon_mentions}
        businessName={businessName}
        ownerFirstName={(business.owner || '').trim().split(/\s+/)[0] || ''}
        phone={business.phone || ''}
        logoLight={logoLight}
        place={place}
      />
      {page && (
        <>
          {(!page.show_header || !page.show_footer) && (
            <PageChrome showHeader={page.show_header ?? true} showFooter={page.show_footer ?? true} />
          )}
          <BlockPage page={page} />
        </>
      )}
    </>
  );
}
