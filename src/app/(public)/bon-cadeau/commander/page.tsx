import type { Metadata } from 'next';
import GiftOrderClient from './GiftOrderClient';
import './bon-cadeau.css';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../../config/site';
import { getSettingsServer } from '../../../../services/settingsServer';
import { supabase } from '../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { getGiftOrderSettings, isGiftOrderOpen, loadGiftCatalog } from '../../../../services/giftOrders';
import { buildBreadcrumbJsonLd } from '../../../../utils/pageJsonLd';
import type { GiftCatalogItem } from '../../../../types/giftOrders';

export const revalidate = 60;

const PATH = '/bon-cadeau/commander';

export async function generateMetadata(): Promise<Metadata> {
  const [business, open] = await Promise.all([getBusinessInfoServer(), isGiftOrderOpen().catch(() => false)]);
  const name = business.name || SITE_CONFIG.name;
  const title = `Commander un bon cadeau | ${name}`;
  const description = `Offrez un bon cadeau ${name} : un montant dès CHF 100 ou un ou plusieurs soins de la carte, avec votre petit mot. Paiement TWINT, bon envoyé en PDF par e-mail.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_CONFIG.url}${PATH}` },
    openGraph: { title, description, url: `${SITE_CONFIG.url}${PATH}`, type: 'website' },
    // Tant que la vente en ligne est fermée, la page ne fait que renvoyer au contact.
    robots: open ? undefined : { index: false, follow: true },
  };
}

export default async function CommanderBonPage() {
  const [business, settings, s] = await Promise.all([
    getBusinessInfoServer(),
    getGiftOrderSettings(),
    getSettingsServer(['caisse_bon_validite_mois', 'caisse_bon_mentions']),
  ]);
  const open = await isGiftOrderOpen(settings).catch(() => false);

  let catalogue: GiftCatalogItem[] = [];
  if (open) {
    try {
      catalogue = await loadGiftCatalog(getSupabaseAdmin() ?? supabase);
    } catch (err) {
      // Sans carte, le montant libre reste possible.
      console.warn('[bon-cadeau/commander] Carte indisponible:', err);
    }
  }

  const breadcrumbLd = buildBreadcrumbJsonLd({
    slug: 'bon-cadeau/commander',
    pageTitle: 'Commander un bon cadeau',
    siteUrl: SITE_CONFIG.url,
    parents: [{ name: 'Bon cadeau', slug: 'bon-cadeau' }],
  });
  const validiteMois = Math.max(12, Number(s.caisse_bon_validite_mois) || 60);

  return (
    <>
      {breadcrumbLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      )}
      {/* En-tête rendu côté serveur : le H1 figure dans le HTML que lisent les moteurs. */}
      <div className="gco-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/algue.svg" alt="" aria-hidden="true" className="gco-hero__algue" />
        <div className="gco-container gco-hero__inner">
          <div>
            <div className="gco-eyebrow">Bon cadeau · Palézieux-Gare</div>
            <h1>Offrir un bon cadeau</h1>
            <div className="gco-lead">
              {open
                ? 'Un montant ou des soins de la carte, le nom de la personne qui le recevra et, si vous le souhaitez, un petit mot imprimé sur le bon. Vous payez par TWINT ; le bon vous parvient en PDF par e-mail.'
                : 'Un montant ou un soin de la carte, pour la personne de votre choix : une parenthèse de douceur à offrir.'}
            </div>
          </div>
          {open && (
            <ul className="gco-assure algue-list">
              <li>Dès CHF {settings.montantMin}, ou les soins de votre choix</li>
              <li>Votre message imprimé sur le bon</li>
              <li>Valable {validiteMois} mois</li>
            </ul>
          )}
        </div>
      </div>
      <GiftOrderClient
        open={open}
        catalogue={catalogue}
        montantMin={settings.montantMin}
        validiteMois={validiteMois}
        mentions={s.caisse_bon_mentions}
        businessName={business.name || SITE_CONFIG.name}
        ownerFirstName={(business.owner || '').trim().split(/\s+/)[0] || ''}
        phone={business.phone || ''}
      />
    </>
  );
}
