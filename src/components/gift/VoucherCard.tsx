/**
 * Le bon cadeau tel qu'il sera imprimé (`components/pdf/BonCadeauDocument.tsx`),
 * en miniature : photo et logo à gauche, la bénéficiaire, le soin ou la valeur
 * et le petit mot à droite. Ce que l'acheteuse compose est ce qu'elle reçoit.
 *
 * Sans hook : rendu au serveur dans l'en-tête, en direct dans le parcours. La
 * carte garde le format A5 paysage et ses textes suivent sa largeur (`cqw`).
 */
import React from 'react';
import { optimizedImgProps } from '../../utils/imageOptim';
import { GIFT_VISUALS } from './visuals';
import './voucher.css';

export interface VoucherCardProps {
  businessName: string;
  /** Logo clair (pied de page), posé sur le bandeau marine. */
  logoLight?: string;
  place?: string;
  beneficiaire?: string;
  /** Soins offerts ; vide pour un montant. */
  offer?: string;
  /** Absent : la ligne du montant est masquée (encart d'une page soins). */
  montant?: number;
  message?: string;
  validiteMois: number;
  className?: string;
  /** Taille de la photo dans la page (attribut `sizes`). */
  sizes?: string;
  /** Photo du panneau gauche ; par défaut celle du bon imprimé. */
  photoUrl?: string;
}

function chf(n: number): string {
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.max(0, n || 0));
}

export default function VoucherCard(p: VoucherCardProps) {
  const echeance = new Date();
  echeance.setMonth(echeance.getMonth() + p.validiteMois);
  const msg = (p.message ?? '').trim();
  return (
    <div className={`gv ${p.className ?? ''}`} aria-hidden="true">
      <div className="gv__side">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...optimizedImgProps(p.photoUrl || GIFT_VISUALS.montant.url, p.sizes ?? '220px', [384, 640])} alt="" className="gv__photo" decoding="async" />
        <div className="gv__band">
          {p.logoLight
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.logoLight} alt="" className="gv__logo" />
            : <span className="gv__brand">{p.businessName}</span>}
          {p.place && <span className="gv__place">{p.place}</span>}
        </div>
      </div>
      <div className="gv__main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/algue.svg" alt="" className="gv__algue" />
        <div className="gv__top">
          <span className="gv__eyebrow">Bon cadeau</span>
          <span className="gv__code" suppressHydrationWarning>N° BON-{new Date().getFullYear()}-····</span>
        </div>
        <span className="gv__rule" />
        <span className="gv__for">Offert à</span>
        <span className={`gv__name ${p.beneficiaire?.trim() ? '' : 'is-empty'}`}>{p.beneficiaire?.trim() || 'Prénom Nom'}</span>
        <span className="gv__box">
          <span className="gv__label">{p.offer ? 'Valable pour' : 'D’une valeur de'}</span>
          {p.offer && <span className="gv__offer">{p.offer}</span>}
          {p.montant !== undefined && (
            <span className="gv__amount"><small>CHF</small>{p.montant > 0 ? chf(p.montant) : '—'}</span>
          )}
        </span>
        {msg && <span className="gv__msg">« {msg} »</span>}
        <span className="gv__foot">
          <span suppressHydrationWarning><small>Valable jusqu’au</small>{echeance.toLocaleDateString('fr-CH')}</span>
          <span className="gv__foot-r"><small>Réserver</small>en ligne ou par téléphone</span>
        </span>
      </div>
    </div>
  );
}
