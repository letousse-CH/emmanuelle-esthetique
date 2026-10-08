/**
 * Tickets de caisse côté navigateur : préparation de la photo, lecture IA,
 * dépôt du justificatif dans le coffre privé et création des dépenses.
 *
 * Contrairement au reste du module Dépenses, rien ne se replie sur le
 * stockage du navigateur : une pièce comptable qui n'arrive pas en base doit
 * le dire, pas disparaître au prochain changement d'appareil.
 */
import { supabase } from './supabase';
import type { ExpenseCategory } from '../types/finance';
import {
  buildTicketExpenseRows,
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
 * Dépose la pièce dans le coffre et crée une dépense par compte imputé.
 * Les parts partagent le même justificatif. Retourne le nombre de dépenses créées.
 */
export async function saveTicket(params: {
  draft: TicketDraft;
  file: File;
  categories: ExpenseCategory[];
  extraction: ReceiptExtraction | null;
}): Promise<number> {
  const { draft, file } = params;
  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  const [year, month] = draft.date.split('-');
  const path = `${year}/${month}/${draft.date}-${crypto.randomUUID()}.${ext}`;

  // Les comptes par défaut (`cat-4000`…) ne servent qu'à l'affichage : sans
  // table en base, inutile de déposer une pièce qu'aucune dépense ne citerait.
  const rows = buildTicketExpenseRows(draft, params.categories, path, params.extraction);
  if (rows.some((r) => !r.category_id || r.category_id.startsWith('cat-'))) {
    throw explain({ message: 'relation "expense_categories" does not exist' }, 'Comptes introuvables');
  }

  const upload = await supabase.storage
    .from(JUSTIFICATIFS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw explain(upload.error, 'Dépôt de la pièce impossible');

  // Une seule instruction : toutes les parts du ticket entrent ensemble, ou aucune.
  const { error } = await supabase.from('expenses').insert(rows);
  if (error) throw explain(error, 'Enregistrement de la dépense impossible');
  return rows.length;
}

/**
 * Ouvre la pièce par un lien signé de cinq minutes. La fenêtre est ouverte
 * avant l'attente : Safari bloque un `window.open` lancé après un `await`.
 */
export async function openJustificatif(path: string): Promise<void> {
  const win = window.open('', '_blank');
  const { data, error } = await supabase.storage.from(JUSTIFICATIFS_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    throw explain(error, 'Ouverture du justificatif impossible');
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
