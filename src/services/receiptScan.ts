/**
 * Lecture d'un ticket de caisse ou d'une facture par Claude (vision).
 *
 * Serveur uniquement (passe par `callClaude`). L'IA recopie ce qui est imprimé
 * et propose un compte ; tout le nettoyage et les contrôles se font ensuite
 * dans `normalizeReceiptExtraction` (types/receipts.ts), et rien n'est
 * enregistré sans que l'exploitante ait relu le formulaire.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { callClaude, extractJson } from '../utils/ai';
import { DEFAULT_SWISS_CATEGORIES, type ExpenseCategory } from '../types/finance';
import { normalizeReceiptExtraction, type ReceiptExtraction } from '../types/receipts';

export const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const RECEIPT_MEDIA_TYPES = [...RECEIPT_IMAGE_TYPES, 'application/pdf'] as const;
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];

export type ReceiptAccount = Pick<ExpenseCategory, 'code' | 'nom' | 'description' | 'groupe'>;

const SYSTEM = `Tu lis des pièces d'achat (tickets de caisse, factures, quittances) pour la comptabilité d'un institut de beauté tenu en raison individuelle en Suisse (canton de Vaud). Ta lecture sert à la fiduciaire et à la déclaration d'impôts : tu recopies ce qui est imprimé, sans jamais rien inventer ni compléter de mémoire. Tu réponds uniquement par un objet JSON.`;

function instructions(accounts: ReceiptAccount[]): string {
  const list = accounts
    .map((a) => `- ${a.code} — ${a.nom}${a.description ? ` : ${a.description}` : ''}`)
    .join('\n');

  return `Lis cette pièce et réponds par ce JSON, sans texte autour :
{
  "type_piece": "ticket" | "facture" | "autre",
  "fournisseur": "raison sociale du vendeur telle qu'imprimée, avec l'enseigne ou la succursale si elle figure",
  "fournisseur_adresse": "Rue et n°, NPA Localité, Pays — sur une ligne" | null,
  "fournisseur_ide": "n° IDE / TVA tel qu'imprimé (ex. CHE-123.456.789 TVA, MWST, IVA) ; n° de TVA étranger sinon" | null,
  "numero_piece": "n° du ticket, de la transaction ou de la facture" | null,
  "date": "AAAA-MM-JJ" | null,
  "heure": "HH:MM" | null,
  "devise": "CHF",
  "montant_ttc": 0.00,
  "tva": [{ "taux": 8.1, "montant_ht": 0.00, "montant_tva": 0.00, "montant_ttc": 0.00 }],
  "mode_paiement": "carte" | "twint" | "especes" | "virement" | null,
  "lignes": [{ "designation": "", "quantite": 1, "montant_ttc": 0.00, "taux_tva": 8.1, "compte": "4400" }],
  "ventilation": [{ "compte": "4400", "libelle": "Coton et lingettes", "montant_ttc": 0.00, "taux_tva": 8.1 }],
  "compte_principal": "4400",
  "raison": "une phrase courte qui justifie le compte principal",
  "confiance": "haute" | "moyenne" | "basse",
  "remarques": ["ce que vous devez vérifier"]
}

Règles :
- Une information absente ou illisible vaut null (ou [] pour une liste). Ne devine jamais un n° IDE, une adresse ou un montant.
- Montants en nombres avec un point décimal. montant_ttc = ce qui a réellement été payé, rabais déduits.
- numero_piece : pas le n° de caisse, de terminal ni de carte bancaire.
- tva : une entrée par taux du récapitulatif TVA imprimé (8.1, 2.6, 3.8 ; 7.7, 2.5, 3.7 avant 2024). Si les articles portent un code (A, B, 1, 2…), sers-t'en pour leur taux. Liste vide si la pièce ne mentionne aucune TVA.
- mode_paiement : « carte » pour toute carte (débit, crédit, PostFinance Card, Apple Pay…).
- compte : un des codes ci-dessous, ou "prive" pour un achat manifestement personnel (courses du ménage, vêtements, objets sans lien avec l'institut).
- ventilation : les lignes regroupées par compte et par taux de TVA. Sa somme, part "prive" comprise, doit être égale à montant_ttc ; un rabais global se répartit au prorata. Un ticket entièrement professionnel d'un seul compte n'a qu'une entrée.
- compte_principal : le compte professionnel qui porte le plus gros montant.
- remarques : adressées directement à l'exploitante, au vouvoiement, courtes (photo floue, total coupé, article qui semble privé, devise étrangère…). Liste vide si tout est clair.

Comptes disponibles :
${list}

Repères pour un institut de beauté :
- 4200 : produits utilisés pendant les soins (crèmes, huiles et masques professionnels, cire, pâte de sucre).
- 4000 : produits achetés pour être revendus tels quels aux clientes.
- 4400 : consommables jetés après usage (coton, lingettes, gants, spatules, draps d'examen, papier de table).
- 6100 : petit matériel et linge (ustensiles, bols, pinceaux, serviettes, petits appareils, réparations).
- 6210 : déplacements professionnels (carburant, parking, train, bus).
- 6640 : représentation (restaurant, café, thé, boissons et douceurs offerts aux clientes, cadeaux clientèle).
- 6990 : poste, papeterie et ce qui n'entre nulle part ailleurs.`;
}

/** Comptes proposables : ceux de la base, sans le compte privé (géré par « prive »). */
export function receiptAccounts(categories?: ReceiptAccount[] | null): ReceiptAccount[] {
  const source = categories && categories.length > 0 ? categories : DEFAULT_SWISS_CATEGORIES;
  return source.filter((c) => c.groupe !== 'prelevements_prives');
}

/** Requête de lecture (système + message avec la pièce), séparée pour pouvoir la tester. */
export function buildReceiptRequest(params: {
  base64: string;
  mediaType: ReceiptMediaType;
  accounts: ReceiptAccount[];
}): { system: string; messages: Anthropic.MessageParam[] } {
  const source: Anthropic.ContentBlockParam =
    params.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: params.base64 } }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: params.mediaType as (typeof RECEIPT_IMAGE_TYPES)[number],
            data: params.base64,
          },
        };
  return {
    system: SYSTEM,
    messages: [{ role: 'user', content: [source, { type: 'text', text: instructions(params.accounts) }] }],
  };
}

export async function scanReceipt(params: {
  base64: string;
  mediaType: ReceiptMediaType;
  categories?: ReceiptAccount[] | null;
  today: string;
}): Promise<ReceiptExtraction> {
  const accounts = receiptAccounts(params.categories);
  const request = buildReceiptRequest({ base64: params.base64, mediaType: params.mediaType, accounts });

  const response = await callClaude({
    mode: 'quick',
    feature: 'ticket-depense',
    max_tokens: 6000,
    ...request,
  });

  let raw: unknown;
  try {
    raw = extractJson(response.content[0].text);
  } catch {
    throw new Error("La lecture du ticket n'a pas abouti (réponse illisible) : réessayez avec une photo plus nette.");
  }
  return normalizeReceiptExtraction(raw, accounts.map((a) => a.code), params.today);
}
