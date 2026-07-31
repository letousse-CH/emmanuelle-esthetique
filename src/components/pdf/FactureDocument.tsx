/**
 * Quittance / facture PDF d'un encaissement.
 *
 * Rendu par `@react-pdf/renderer` côté serveur (route handler Node.js). On s'en
 * tient aux polices standard du format PDF (Helvetica) : elles couvrent les
 * accents français en encodage WinAnsi, ce qui évite d'embarquer un fichier de
 * police ou d'aller le chercher sur le réseau — impossible dans une fonction
 * serverless Netlify au système de fichiers en lecture seule.
 */
import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { MODE_PAIEMENT_LABELS } from '../../types/caisse';
import type { TransactionWithItems } from '../../types/caisse';
import type { BusinessInfo } from '../../config/site';

export interface FactureSettings {
  tvaAssujetti: boolean;
  tvaNumero: string;
  iban: string;
  mentions: string;
}

/** Bons émis par cette vente, et bon éventuellement présenté en paiement. */
export interface FactureGiftCards {
  emis: { code: string; libelle: string; montant: number; expireLe: string }[];
  utilise: { code: string; montant: number; restant: number } | null;
}

const SAGE = '#8A9A7B';
const INK = '#3A3730';
const MUTED = '#8C877D';
const LINE = '#E4DFD6';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 9.5, color: INK },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 34 },
  businessName: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: INK, marginBottom: 5 },
  businessLine: { fontSize: 8.5, color: MUTED, marginBottom: 1.5 },

  docLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 1.6, color: SAGE, textAlign: 'right', marginBottom: 4 },
  docNumber: { fontFamily: 'Helvetica-Bold', fontSize: 14, textAlign: 'right', marginBottom: 3 },
  docDate: { fontSize: 8.5, color: MUTED, textAlign: 'right' },

  cancelledBanner: {
    borderWidth: 1, borderColor: '#D9534F', borderStyle: 'solid', borderRadius: 3,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 20,
  },
  cancelledText: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#D9534F' },
  cancelledReason: { fontSize: 8.5, color: '#D9534F', marginTop: 2 },

  sectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 1.2, color: MUTED, marginBottom: 5 },
  clientBlock: { marginBottom: 28 },
  clientName: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  clientLine: { fontSize: 9, color: MUTED, marginBottom: 1.5 },

  tableHead: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, borderBottomStyle: 'solid',
    paddingBottom: 5, marginBottom: 2,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, letterSpacing: 0.9, color: MUTED },
  tr: {
    flexDirection: 'row', paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: LINE, borderBottomStyle: 'solid',
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty:  { width: 38, textAlign: 'right' },
  cUnit: { width: 68, textAlign: 'right' },
  cTva:  { width: 44, textAlign: 'right' },
  cTot:  { width: 74, textAlign: 'right' },

  totals: { marginTop: 16, alignSelf: 'flex-end', width: 236 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9 },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 7,
    borderTopWidth: 1, borderTopColor: INK, borderTopStyle: 'solid',
  },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 13 },

  payment: {
    marginTop: 30, paddingTop: 14,
    borderTopWidth: 0.5, borderTopColor: LINE, borderTopStyle: 'solid',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  paymentValue: { fontFamily: 'Helvetica-Bold', fontSize: 9.5 },

  note: { marginTop: 16, fontSize: 8.5, color: MUTED },

  giftBox: {
    marginTop: 18, padding: 10,
    borderWidth: 0.5, borderColor: SAGE, borderStyle: 'solid', borderRadius: 3,
  },
  giftLine: { fontSize: 9, marginTop: 1 },

  footer: {
    position: 'absolute', bottom: 30, left: 48, right: 48,
    paddingTop: 10, borderTopWidth: 0.5, borderTopColor: LINE, borderTopStyle: 'solid',
  },
  footerText: { fontSize: 7.5, color: MUTED, textAlign: 'center', lineHeight: 1.5 },
});

/** Montants en `1'234.50` — voir la note sur `de-CH` dans types/caisse.ts. */
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

function dateTimeCH(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' });
  const time = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
  return `${date} à ${time}`;
}

export default function FactureDocument({ transaction, business, settings, giftCards }: {
  transaction: TransactionWithItems;
  business: BusinessInfo;
  settings: FactureSettings;
  giftCards?: FactureGiftCards;
}) {
  const cancelled = transaction.status === 'annulee';
  const showTva = settings.tvaAssujetti || Number(transaction.total_tva) > 0;

  // Ventilation par taux : exigée sur la facture dès l'assujettissement
  // (OTVA art. 26) quand plusieurs taux coexistent.
  const parTaux = new Map<number, { ht: number; tva: number }>();
  for (const item of transaction.transaction_items) {
    const taux = Number(item.taux_tva);
    const ttc = Number(item.total_ttc);
    const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
    const entry = parTaux.get(taux) ?? { ht: 0, tva: 0 };
    entry.ht += ht;
    entry.tva += ttc - ht;
    parTaux.set(taux, entry);
  }
  const ventilation = [...parTaux.entries()].sort((a, b) => a[0] - b[0]);

  const addressLine = [business.addressPostal, business.addressCity].filter(Boolean).join(' ');
  const contactLine = [business.phone, business.email].filter(Boolean).join(' · ');

  return (
    <Document
      title={`${transaction.numero} — ${business.name}`}
      author={business.name}
      subject={`Quittance ${transaction.numero}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{business.name}</Text>
            {business.owner ? <Text style={styles.businessLine}>{business.owner}</Text> : null}
            {business.addressStreet ? <Text style={styles.businessLine}>{business.addressStreet}</Text> : null}
            {addressLine ? <Text style={styles.businessLine}>{addressLine}</Text> : null}
            {contactLine ? <Text style={styles.businessLine}>{contactLine}</Text> : null}
            {settings.tvaNumero ? <Text style={styles.businessLine}>N° TVA : {settings.tvaNumero}</Text> : null}
          </View>
          <View>
            <Text style={styles.docLabel}>QUITTANCE</Text>
            <Text style={styles.docNumber}>{transaction.numero}</Text>
            <Text style={styles.docDate}>{dateTimeCH(transaction.created_at)}</Text>
          </View>
        </View>

        {cancelled ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>FACTURE ANNULÉE — sans valeur comptable</Text>
            {transaction.cancel_reason ? (
              <Text style={styles.cancelledReason}>Motif : {transaction.cancel_reason}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.clientBlock}>
          <Text style={styles.sectionLabel}>CLIENT</Text>
          <Text style={styles.clientName}>{transaction.client_label}</Text>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.cDesc]}>PRESTATION</Text>
          <Text style={[styles.th, styles.cQty]}>QTÉ</Text>
          <Text style={[styles.th, styles.cUnit]}>PRIX UNIT.</Text>
          {showTva ? <Text style={[styles.th, styles.cTva]}>TVA</Text> : null}
          <Text style={[styles.th, styles.cTot]}>TOTAL CHF</Text>
        </View>

        {transaction.transaction_items.map(item => (
          <View key={item.id} style={styles.tr} wrap={false}>
            <Text style={styles.cDesc}>{item.description}</Text>
            <Text style={styles.cQty}>{Number(item.quantite)}</Text>
            <Text style={styles.cUnit}>{chf(item.prix_unitaire_ttc)}</Text>
            {showTva ? <Text style={styles.cTva}>{Number(item.taux_tva)} %</Text> : null}
            <Text style={styles.cTot}>{chf(item.total_ttc)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>CHF {chf(transaction.total_ht)}</Text>
          </View>

          {showTva
            ? ventilation.map(([taux, v]) => (
                <View key={taux} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA {taux} % sur CHF {chf(v.ht)}</Text>
                  <Text style={styles.totalValue}>CHF {chf(v.tva)}</Text>
                </View>
              ))
            : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA 0 %</Text>
                <Text style={styles.totalValue}>CHF 0.00</Text>
              </View>
            )}

          {giftCards?.utilise ? (
            <>
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Total TTC</Text>
                <Text style={styles.grandValue}>CHF {chf(transaction.total_ttc)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Bon {giftCards.utilise.code}</Text>
                {/* Trait d'union ASCII, pas le signe « moins » U+2212 : les
                    polices standard du PDF sont encodées en WinAnsi, où ce
                    caractère n'existe pas — il disparaîtrait sans un bruit. */}
                <Text style={styles.totalValue}>- CHF {chf(giftCards.utilise.montant)}</Text>
              </View>
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Montant encaissé</Text>
                <Text style={styles.grandValue}>
                  CHF {chf(Number(transaction.total_ttc) - Number(giftCards.utilise.montant))}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total TTC</Text>
              <Text style={styles.grandValue}>CHF {chf(transaction.total_ttc)}</Text>
            </View>
          )}
        </View>

        <View style={styles.payment}>
          <View>
            <Text style={styles.sectionLabel}>MODE DE PAIEMENT</Text>
            <Text style={styles.paymentValue}>{MODE_PAIEMENT_LABELS[transaction.mode_paiement]}</Text>
          </View>
          <View>
            <Text style={styles.sectionLabel}>STATUT</Text>
            <Text style={styles.paymentValue}>
              {cancelled ? 'Annulée' : `Payé le ${dateTimeCH(transaction.created_at)}`}
            </Text>
          </View>
        </View>

        {giftCards && giftCards.emis.length > 0 ? (
          <View style={styles.giftBox}>
            <Text style={styles.sectionLabel}>
              BON{giftCards.emis.length > 1 ? 'S' : ''} CADEAU{giftCards.emis.length > 1 ? 'X' : ''} ÉMIS
            </Text>
            {giftCards.emis.map(g => (
              <Text key={g.code} style={styles.giftLine}>
                {g.code} — {g.libelle}, CHF {chf(g.montant)}, valable jusqu&apos;au {dateCH(g.expireLe)}
              </Text>
            ))}
          </View>
        ) : null}

        {giftCards?.utilise ? (
          <Text style={styles.note}>
            Bon {giftCards.utilise.code} — solde restant après cette visite :
            CHF {chf(giftCards.utilise.restant)}.
          </Text>
        ) : null}

        {transaction.mode_paiement === 'virement' && settings.iban ? (
          <Text style={styles.note}>IBAN : {settings.iban}</Text>
        ) : null}

        {transaction.note ? <Text style={styles.note}>{transaction.note}</Text> : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {settings.mentions}
            {settings.tvaAssujetti ? '' : '\nTVA non applicable — prestataire non assujetti (LTVA art. 10).'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
