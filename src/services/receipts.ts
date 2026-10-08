/**
 * Tickets de caisse côté navigateur : préparation de la photo, lecture IA,
 * dépôt du justificatif et création des dépenses.
 *
 * La pièce va dans le dossier Google Drive partagé avec la fiduciaire
 * (services/googleDrive.ts) ; tant que Drive n'est pas connecté, elle reste
 * dans le coffre privé Supabase `justificatifs`.
 *
 * Contrairement au reste du module Dépenses, rien ne se replie sur le
 * stockage du navigateur : une pièce comptable qui n'arrive pas en base doit
 * le dire, pas disparaître au prochain changement d'appareil.
 */
import { supabase } from './supabase';
import type { Expense, ExpenseCategory } from '../types/finance';
import {
  buildTicketExpenseRows,
  type TicketJustificatif,
  type ReceiptExtraction,
  type TicketDraft,
} from '../types/receipts';

export const JUSTIFICATIFS_BUCKET = 'justificatifs';

/** Assez pour lire un ticket de 80 mm imprimé serré, assez léger pour l'envoi. */
const MAX_LONG_SIDE = 2200;
const MAX_PDF_BYTES = 4 * 1024 * 1024;

export interface PreparedReceipt {
  file: File;
  base64: string;
  mediaType: string;
}

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

/**
 * Photo réduite à 2200 px sur son plus grand côté et réencodée en JPEG : c'est
 * ce fichier-là qui est lu par l'IA et archivé. Un PDF passe tel quel.
 */
export async function prepareReceiptFile(file: File): Promise<PreparedReceipt> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('PDF trop lourd (4 Mo au plus) : photographiez plutôt la pièce.');
    return { file, base64: await readAsBase64(file), mediaType: 'application/pdf' };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error('Image illisible par ce navigateur (format HEIC ?) : réessayez depuis le téléphone ou exportez la photo en JPEG.');
  }

  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Préparation de la photo impossible sur cet appareil.');
  // Fond blanc : une capture PNG transparente deviendrait noire en JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Préparation de la photo impossible sur cet appareil.');
  const name = (file.name.replace(/\.[^.]+$/, '') || 'ticket') + '.jpg';
  const jpeg = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  return { file: jpeg, base64: await readAsBase64(jpeg), mediaType: 'image/jpeg' };
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function scanReceipt(
  prepared: PreparedReceipt,
  categories: ExpenseCategory[],
): Promise<ReceiptExtraction> {
  const res = await fetch('/api/admin/expenses/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await bearer()}` },
    body: JSON.stringify({
      fileBase64: prepared.base64,
      mediaType: prepared.mediaType,
      categories: categories.map(({ code, nom, description, groupe }) => ({ code, nom, description, groupe })),
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) throw new Error(json?.error || `Lecture du ticket impossible (HTTP ${res.status}).`);
  return json.data as ReceiptExtraction;
}

/** Message lisible quand la base n'a pas encore les tables ou le coffre. */
function explain(error: { message?: string } | null, what: string): Error {
  const msg = error?.message || 'erreur inconnue';
  if (/bucket not found|relation .* does not exist|could not find the table|column .* does not exist|schema cache/i.test(msg)) {
    return new Error(
      `${what} : la base n'est pas encore prête (migrations 20260927_finances_depenses_cabine_avs.sql puis 20261008_depenses_tickets_justificatifs.sql à appliquer). Détail : ${msg}`,
    );
  }
  return new Error(`${what} : ${msg}`);
}

/**
 * Dépose la pièce : Google Drive si connecté, sinon coffre privé Supabase.
 * `path` vaut `gdrive:<id>` pour Drive, le chemin du coffre sinon ; `url` est
 * le lien Drive (null pour le coffre, lu par lien signé).
 */
export async function storeJustificatif(
  file: File,
  meta: { date: string; fournisseur: string; montant: number; description?: string },
): Promise<TicketJustificatif> {
  const res = await fetch('/api/admin/expenses/justificatif', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await bearer()}` },
    body: JSON.stringify({ fileBase64: await readAsBase64(file), mediaType: file.type, ...meta }),
  });
  const json = await res.json().catch(() => null);
  if (res.ok && json?.id) return { path: `gdrive:${json.id}`, url: json.url };
  if (!(res.status === 409 && (json?.code === 'not_connected' || json?.code === 'not_configured'))) {
    throw new Error(json?.error || `Dépôt de la pièce impossible (HTTP ${res.status}).`);
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  const [year, month] = meta.date.split('-');
  const path = `${year}/${month}/${meta.date}-${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from(JUSTIFICATIFS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw explain(upload.error, 'Dépôt de la pièce impossible');
  return { path, url: null };
}

/**
 * Dépose la pièce puis crée une dépense par compte imputé ; les parts
 * partagent le même justificatif. Retourne le nombre de dépenses créées.
 */
export async function saveTicket(params: {
  draft: TicketDraft;
  file: File;
  categories: ExpenseCategory[];
  extraction: ReceiptExtraction | null;
}): Promise<number> {
  const { draft, file } = params;

  // Les comptes par défaut (`cat-4000`…) ne servent qu'à l'affichage : sans
  // table en base, inutile de déposer une pièce qu'aucune dépense ne citerait.
  const probe = buildTicketExpenseRows(draft, params.categories, null, null);
  if (probe.some((r) => !r.category_id || r.category_id.startsWith('cat-'))) {
    throw explain({ message: 'relation "expense_categories" does not exist' }, 'Comptes introuvables');
  }

  const comptes = draft.ventilation.map((v) => v.compte).join(', ');
  const justificatif = await storeJustificatif(file, {
    date: draft.date,
    fournisseur: draft.fournisseur.trim(),
    montant: draft.montant_ttc,
    description: [draft.numero_piece && `Pièce n° ${draft.numero_piece}`, `Compte(s) ${comptes}`].filter(Boolean).join(' — '),
  });

  // Une seule instruction : toutes les parts du ticket entrent ensemble, ou aucune.
  const rows = buildTicketExpenseRows(draft, params.categories, justificatif, params.extraction);
  const { error } = await supabase.from('expenses').insert(rows);
  if (error) throw explain(error, 'Enregistrement de la dépense impossible');
  return rows.length;
}

/** Joint une pièce à une dépense saisie sans (facture fournisseur, saisie manuelle). */
export async function attachJustificatif(expense: Expense, picked: File): Promise<void> {
  const prepared = await prepareReceiptFile(picked);
  const justificatif = await storeJustificatif(prepared.file, {
    date: expense.date_facture,
    fournisseur: expense.fournisseur,
    montant: Number(expense.montant_ttc),
    description: [expense.numero_facture && `Pièce n° ${expense.numero_facture}`, expense.category?.code && `Compte ${expense.category.code}`]
      .filter(Boolean)
      .join(' — '),
  });
  const { error } = await supabase
    .from('expenses')
    .update({ justificatif_path: justificatif.path, document_url: justificatif.url, updated_at: new Date().toISOString() })
    .eq('id', expense.id);
  if (error) throw explain(error, 'Rattachement de la pièce impossible');
}

/** Lien Drive ouvert tel quel ; une pièce du coffre privé, par lien signé de cinq minutes. */
export async function openJustificatif(expense: Pick<Expense, 'document_url' | 'justificatif_path'>): Promise<void> {
  if (expense.document_url && /^https?:\/\//.test(expense.document_url)) {
    window.open(expense.document_url, '_blank', 'noopener');
    return;
  }
  const path = expense.justificatif_path;
  if (!path) return;
  // Fenêtre ouverte avant l'attente : Safari bloque un `window.open` lancé après un `await`.
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(JUSTIFICATIFS_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    throw explain(error, 'Ouverture du justificatif impossible');
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
