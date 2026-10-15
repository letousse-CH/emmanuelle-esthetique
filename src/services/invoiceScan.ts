/**
 * Lecture d'une facture fournisseur détaillée (photo ou PDF) par Claude.
 *
 * Serveur uniquement. L'IA recopie les lignes imprimées ; les contrôles
 * (total des lignes = HT, doublon, prix de vente…) se font ensuite dans
 * `controlerFactureAchat`, et Postgres les rejoue à l'import. Rien n'est
 * enregistré sans relecture.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { callClaude, extractJson } from '../utils/ai';
import { normalizeFactureAchat, type FactureAchatLue } from '../types/factureAchat';
import { RECEIPT_IMAGE_TYPES, type ReceiptMediaType } from './receiptScan';

const SYSTEM = `Tu lis des factures de fournisseurs pour la gestion du stock et la comptabilité d'un institut de beauté tenu en raison individuelle en Suisse. Tu recopies ce qui est imprimé, ligne par ligne, sans jamais rien inventer, arrondir ni compléter de mémoire. Tu réponds uniquement par un objet JSON.`;

const INSTRUCTIONS = `Lis cette facture et réponds par ce JSON, sans texte autour :
{
  "fournisseur": "raison sociale du vendeur",
  "fournisseur_adresse": "Rue et n°, NPA Localité" | null,
  "fournisseur_ide": "n° IDE / TVA tel qu'imprimé (CHE-…)" | null,
  "numero_facture": "n° de la facture (pas le n° client ni de commande)",
  "date_facture": "AAAA-MM-JJ",
  "date_echeance": "AAAA-MM-JJ" | null,
  "montant_ht": 0.00,
  "montant_tva": 0.00,
  "montant_ttc": 0.00,
  "taux_tva": 8.1,
  "echeances": [{ "date": "AAAA-MM-JJ", "montant": 0.00 }],
  "lignes": [{
    "reference": "code article tel qu'imprimé" | null,
    "designation": "désignation complète",
    "quantite": 1,
    "prix_unitaire_ht": 0.00,
    "rabais_pct": 0,
    "taux_tva": 8.1,
    "contenance": "250 ml" | null,
    "marque": "Phytomer" | null,
    "prix_public_ttc": 0.00 | null,
    "usage": "vente" | "cabine" | "consommable" | "testeur" | "echantillon"
  }],
  "confiance": "haute" | "moyenne" | "basse",
  "remarques": ["ce que l'exploitante doit vérifier"]
}

Règles :
- Une ligne par article facturé, dans l'ordre de la facture. N'omets aucune ligne, même gratuite (rabais 100 %, « offert », « gratuit », prix 0).
- prix_unitaire_ht : le prix unitaire AVANT rabais ; rabais_pct : le rabais de la ligne en %. La somme des quantite × prix_unitaire_ht × (1 − rabais_pct/100) doit retomber sur montant_ht ; si elle n'y retombe pas (frais de port, rabais global), dis-le dans remarques.
- Frais de port, d'emballage ou de transport : PAS de ligne, signale-les dans remarques.
- prix_public_ttc : seulement s'il est imprimé (prix public conseillé, PVC) ; sinon null. Ne le calcule jamais.
- echeances : seulement si la facture imprime un paiement en plusieurs fois (dates et montants) ; sinon [].
- usage : ce que l'institut fait de l'article. Grands formats professionnels (1 l, 2 kg, « cabine », « pro ») : "cabine". Testeurs : "testeur". Échantillons, miniatures « 10x 3 ml » : "echantillon". Draps, papier, sacs, matériel : "consommable". Formats vendus en boutique : "vente".
  Repères Phytomer (Coskyn) par référence : 10xxxx vente, 11xxxx cabine, 12xxxx testeur, 13xxxx échantillon, 15xxxx et 16xxxx consommable.
- Montants en nombres avec un point décimal. Une information absente ou illisible vaut null.
- remarques : courtes, au vouvoiement (ligne coupée, montant illisible, total qui ne tombe pas juste…). [] si tout est clair.`;

export function buildFactureRequest(base64: string, mediaType: ReceiptMediaType): { system: string; messages: Anthropic.MessageParam[] } {
  const source: Anthropic.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType as (typeof RECEIPT_IMAGE_TYPES)[number], data: base64 } };
  return { system: SYSTEM, messages: [{ role: 'user', content: [source, { type: 'text', text: INSTRUCTIONS }] }] };
}

export async function scanFactureAchat(params: { base64: string; mediaType: ReceiptMediaType }): Promise<FactureAchatLue> {
  const response = await callClaude({
    mode: 'quick',
    feature: 'facture-achat',
    max_tokens: 12000,
    ...buildFactureRequest(params.base64, params.mediaType),
  });
  let raw: unknown;
  try {
    raw = extractJson(response.content[0].text);
  } catch {
    throw new Error("La lecture de la facture n'a pas abouti (réponse illisible) : réessayez, ou avec un PDF plutôt qu'une photo.");
  }
  return normalizeFactureAchat(raw);
}
