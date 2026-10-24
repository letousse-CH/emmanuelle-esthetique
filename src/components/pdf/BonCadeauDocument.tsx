/**
 * Bon cadeau imprimable — A5 paysage, à remettre ou à transmettre.
 *
 * Mise en page « carte de spa » : une photo pleine hauteur à gauche, le logo
 * en blanc sur un bandeau marine ; à droite, sur papier blanc, la bénéficiaire,
 * le soin ou la valeur, le petit mot, l'échéance et le code. L'algue de la
 * charte en filigrane.
 *
 * Polices standard du format PDF (Times pour les titres, Helvetica pour le
 * reste) : rien à charger. Les images arrivent déjà lues (`BonImages`,
 * préparées par `services/caissePdf.ts`) ; une image absente laisse sa place
 * au nom de l'institut, jamais un cadre vide.
 */
import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { GiftCard } from '../../types/caisse';
import type { BusinessInfo } from '../../config/site';

const MARINE = '#12283A';
const LAGON = '#3E97A1';
const INK = '#22252A';
const MUTED = '#6B7378';
const LINE = '#DCE4E7';
const CREAM = '#F7F3EC';

export interface PdfImage { data: Buffer; format: 'png' | 'jpg' }

export interface BonImages {
  /** Photo du panneau gauche (portrait). */
  photo: PdfImage | null;
  /** Logo en blanc, posé sur le bandeau marine. */
  logoLight: PdfImage | null;
  /** Algue de la charte, en filigrane. */
  algue: PdfImage | null;
}

const PHOTO_W = 214;

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', color: INK, backgroundColor: '#FFFFFF', flexDirection: 'row' },

  // ── Panneau photo ──
  side: { width: PHOTO_W, height: '100%', position: 'relative', backgroundColor: MARINE },
  photo: { width: PHOTO_W, height: '100%', objectFit: 'cover' },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, backgroundColor: MARINE, opacity: 0.86 },
  bandContent: { position: 'absolute', left: 22, right: 22, bottom: 22 },
  logo: { width: 150, height: 24, objectFit: 'contain', objectPositionX: 0 },
  sideName: { fontFamily: 'Times-Roman', fontSize: 17, color: '#FFFFFF', letterSpacing: 0.5 },
  sidePlace: { marginTop: 8, fontSize: 6.5, letterSpacing: 2, color: '#C9DDE1' },

  // ── Panneau texte ──
  main: { flex: 1, position: 'relative', paddingTop: 34, paddingBottom: 26, paddingHorizontal: 36 },
  frame: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, borderWidth: 0.6, borderColor: LINE, borderStyle: 'solid' },
  algue: { position: 'absolute', right: -18, bottom: 18, width: 170, height: 170, opacity: 0.09 },

  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 3.2, color: LAGON },
  code: { fontSize: 7.5, letterSpacing: 1.6, color: MUTED },
  codeStrong: { fontFamily: 'Helvetica-Bold', color: MARINE },
  rule: { width: 34, borderBottomWidth: 0.8, borderBottomColor: LAGON, borderBottomStyle: 'solid', marginTop: 12 },

  forLabel: { marginTop: 22, fontFamily: 'Times-Italic', fontSize: 11, color: MUTED },
  forName: { marginTop: 2, fontFamily: 'Times-Roman', fontSize: 27, color: MARINE, lineHeight: 1.15 },

  offerBox: { marginTop: 18, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: CREAM },
  offerLabel: { fontSize: 6.5, letterSpacing: 2.2, color: MUTED },
  offerText: { marginTop: 5, fontFamily: 'Times-Roman', fontSize: 12.5, lineHeight: 1.35, color: INK },
  amountRow: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' },
  amountCur: { fontSize: 9, letterSpacing: 1.6, color: MUTED, marginRight: 6, marginBottom: 5 },
  amount: { fontFamily: 'Times-Roman', fontSize: 28, color: MARINE, lineHeight: 1 },
  amountNote: { marginLeft: 10, marginBottom: 5, fontSize: 7.5, color: MUTED },

  message: { marginTop: 14, paddingLeft: 11, borderLeftWidth: 1, borderLeftColor: LAGON, borderLeftStyle: 'solid' },
  messageText: { fontFamily: 'Times-Italic', fontSize: 10.5, lineHeight: 1.45, color: INK },

  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 14 },
  fLabel: { fontSize: 6, letterSpacing: 1.8, color: MUTED, marginBottom: 3 },
  fValue: { fontSize: 9, color: INK },
  fValueStrong: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: MARINE },
  book: { width: 168, textAlign: 'right' },
  bookUrl: { fontSize: 8, color: INK, textAlign: 'right' },
  mentions: { marginTop: 10, fontSize: 6, lineHeight: 1.5, color: MUTED },

  // Libellé ou message longs : tout se resserre pour tenir sur une page.
  compactName: { fontSize: 23, marginTop: 1 },
  compactFor: { marginTop: 16 },
  compactBox: { marginTop: 12, paddingVertical: 10 },
  compactAmount: { fontSize: 24 },
  compactMessage: { marginTop: 10 },
  compactMessageText: { fontSize: 9.5, lineHeight: 1.4 },
});

function chf(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateCH(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** « Bon cadeau — A + B » → « A + B » ; « Bon cadeau » seul → rien (c'est un montant). */
function offerFromLibelle(libelle: string): string {
  const s = libelle.trim();
  if (/^bon cadeau$/i.test(s)) return '';
  return s.replace(/^bon cadeau\s*[—–-]\s*/i, '');
}

export default function BonCadeauDocument({ card, business, mentions, images, bookingUrl }: {
  card: GiftCard;
  business: BusinessInfo;
  mentions: string;
  images?: BonImages;
  /** Adresse de réservation affichée en pied (« emmanuelle-esthetique.ch/reservation »). */
  bookingUrl?: string;
}) {
  const img: BonImages = images ?? { photo: null, logoLight: null, algue: null };
  const place = [business.addressPostal, business.addressCity].filter(Boolean).join(' ');

  // Un bon déjà entamé se distingue d'un bon neuf : c'est le solde qui compte.
  const entame = Number(card.montant_restant) !== Number(card.montant_initial);
  const message = (card.message ?? '').trim();
  const offer = offerFromLibelle(card.libelle);
  const compact = message.length > 140 || offer.length > 90 || (message.length > 60 && offer.length > 50);

  return (
    <Document title={`${card.code} — ${business.name}`} author={business.name} subject="Bon cadeau">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.side}>
          {img.photo ? <Image src={img.photo} style={styles.photo} /> : null}
          <View style={styles.band} />
          <View style={styles.bandContent}>
            {img.logoLight
              ? <Image src={img.logoLight} style={styles.logo} />
              : <Text style={styles.sideName}>{business.name}</Text>}
            {place ? <Text style={styles.sidePlace}>{place.toUpperCase()}</Text> : null}
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.frame} fixed />
          {img.algue ? <Image src={img.algue} style={styles.algue} /> : null}

          <View style={styles.top}>
            <Text style={styles.eyebrow}>BON CADEAU</Text>
            <Text style={styles.code}>N° <Text style={styles.codeStrong}>{card.code}</Text></Text>
          </View>
          <View style={styles.rule} />

          {card.beneficiaire ? (
            <>
              <Text style={compact ? [styles.forLabel, styles.compactFor] : styles.forLabel}>Offert à</Text>
              <Text style={compact ? [styles.forName, styles.compactName] : styles.forName}>{card.beneficiaire}</Text>
            </>
          ) : (
            <Text style={compact ? [styles.forName, styles.compactName, styles.compactFor] : [styles.forName, { marginTop: 22 }]}>
              Une parenthèse de douceur
            </Text>
          )}

          <View style={compact ? [styles.offerBox, styles.compactBox] : styles.offerBox}>
            <Text style={styles.offerLabel}>{offer ? 'VALABLE POUR' : 'D’UNE VALEUR DE'}</Text>
            {offer ? <Text style={styles.offerText}>{offer}</Text> : null}
            <View style={styles.amountRow}>
              <Text style={styles.amountCur}>CHF</Text>
              <Text style={compact ? [styles.amount, styles.compactAmount] : styles.amount}>
                {chf(entame ? card.montant_restant : card.montant_initial)}
              </Text>
              {entame ? <Text style={styles.amountNote}>solde d’un bon de CHF {chf(card.montant_initial)}</Text> : null}
            </View>
          </View>

          {message ? (
            <View style={compact ? [styles.message, styles.compactMessage] : styles.message}>
              <Text style={compact ? [styles.messageText, styles.compactMessageText] : styles.messageText}>« {message} »</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <View style={{ marginRight: 18 }}>
              <Text style={styles.fLabel}>VALABLE JUSQU’AU</Text>
              <Text style={styles.fValueStrong}>{dateCH(card.expire_le)}</Text>
            </View>
            <View>
              <Text style={styles.fLabel}>ÉMIS LE</Text>
              <Text style={styles.fValue}>{dateCH(card.emis_le)}</Text>
            </View>
            <View style={styles.book}>
              <Text style={[styles.fLabel, { textAlign: 'right' }]}>RÉSERVER</Text>
              {/* Un seul « mot » pour react-pdf : l'adresse ne se coupe jamais par un trait d'union. */}
              {bookingUrl ? <Text style={styles.bookUrl} hyphenationCallback={(w) => [w]}>{bookingUrl}</Text> : null}
              {business.phone ? <Text style={[styles.fValue, { textAlign: 'right' }]}>{business.phone}</Text> : null}
            </View>
          </View>
          <Text style={styles.mentions}>
            {mentions}{business.addressStreet ? ` ${business.name} · ${business.addressStreet}, ${place}.` : ''}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
