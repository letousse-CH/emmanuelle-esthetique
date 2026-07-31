/**
 * Bon cadeau imprimable — format A5 paysage, à remettre à l'acheteuse.
 *
 * Mêmes contraintes que la quittance : polices standard du format PDF, aucun
 * fichier externe à charger (voir FactureDocument.tsx).
 */
import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { GiftCard } from '../../types/caisse';
import type { BusinessInfo } from '../../config/site';

const SAGE = '#8A9A7B';
const INK = '#3A3730';
const MUTED = '#8C877D';
const PAPER = '#FAF7F2';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', color: INK, backgroundColor: PAPER, padding: 0 },
  frame: { margin: 18, borderWidth: 1, borderColor: SAGE, borderStyle: 'solid', flexGrow: 1, padding: 26 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  business: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  businessSub: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  code: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: SAGE, letterSpacing: 1 },
  codeLabel: { fontSize: 6.5, letterSpacing: 1.4, color: MUTED, textAlign: 'right', marginBottom: 2 },

  title: { fontFamily: 'Helvetica-Bold', fontSize: 26, letterSpacing: 3, marginTop: 26, textAlign: 'center' },
  rule: { borderBottomWidth: 1, borderBottomColor: SAGE, borderBottomStyle: 'solid', width: 90, alignSelf: 'center', marginTop: 10 },

  offer: { fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.5 },
  amount: { fontFamily: 'Helvetica-Bold', fontSize: 24, textAlign: 'center', marginTop: 8 },

  benef: { fontSize: 9.5, textAlign: 'center', marginTop: 18, color: MUTED },
  benefName: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', color: INK, marginTop: 3 },

  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerBlock: { maxWidth: 250 },
  footerLabel: { fontSize: 6.5, letterSpacing: 1.2, color: MUTED, marginBottom: 2 },
  footerValue: { fontSize: 9 },
  mentions: { fontSize: 6.5, color: MUTED, lineHeight: 1.5, marginTop: 14 },
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

export default function BonCadeauDocument({ card, business, mentions }: {
  card: GiftCard;
  business: BusinessInfo;
  mentions: string;
}) {
  const contact = [business.phone, business.email].filter(Boolean).join(' · ');
  const address = [business.addressStreet, [business.addressPostal, business.addressCity].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  // Un bon déjà entamé se distingue d'un bon neuf : c'est le solde qui compte.
  const entame = Number(card.montant_restant) !== Number(card.montant_initial);

  return (
    <Document title={`${card.code} — ${business.name}`} author={business.name} subject="Bon cadeau">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <View>
              <Text style={styles.business}>{business.name}</Text>
              {address ? <Text style={styles.businessSub}>{address}</Text> : null}
              {contact ? <Text style={styles.businessSub}>{contact}</Text> : null}
            </View>
            <View>
              <Text style={styles.codeLabel}>CODE DU BON</Text>
              <Text style={styles.code}>{card.code}</Text>
            </View>
          </View>

          <Text style={styles.title}>BON CADEAU</Text>
          <View style={styles.rule} />

          <Text style={styles.offer}>{card.libelle}</Text>
          <Text style={styles.amount}>
            CHF {chf(entame ? card.montant_restant : card.montant_initial)}
          </Text>
          {entame ? (
            <Text style={styles.benef}>Solde restant sur un bon de CHF {chf(card.montant_initial)}</Text>
          ) : null}

          {card.beneficiaire ? (
            <>
              <Text style={styles.benef}>Pour</Text>
              <Text style={styles.benefName}>{card.beneficiaire}</Text>
            </>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>ÉMIS LE</Text>
              <Text style={styles.footerValue}>{dateCH(card.emis_le)}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>VALABLE JUSQU&apos;AU</Text>
              <Text style={styles.footerValue}>{dateCH(card.expire_le)}</Text>
            </View>
          </View>

          <Text style={styles.mentions}>{mentions}</Text>
        </View>
      </Page>
    </Document>
  );
}
