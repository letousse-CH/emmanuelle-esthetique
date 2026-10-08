/**
 * Transfère vers Google Drive les justificatifs restés dans le coffre privé
 * Supabase (`justificatifs`), puis rattache le lien Drive aux dépenses.
 *
 *   npx tsx --env-file=.env scripts/move-justificatifs-to-drive.ts           # essai
 *   npx tsx --env-file=.env scripts/move-justificatifs-to-drive.ts --write   # applique
 *
 * À lancer après avoir connecté Google Drive depuis /admin/caisse/depenses.
 * La pièce d'origine reste dans le coffre (rien n'est effacé) : seul le lien
 * de la dépense change.
 */
import { getSupabaseAdmin } from '../src/utils/supabaseAdmin';
import { justificatifName, uploadToDrive } from '../src/services/googleDrive';

const write = process.argv.includes('--write');
const admin = getSupabaseAdmin();
if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente.');

const { data: rows, error } = await admin
  .from('expenses')
  .select('id, fournisseur, numero_facture, date_facture, montant_ttc, justificatif_path, category:expense_categories(code)')
  .not('justificatif_path', 'is', null)
  .not('justificatif_path', 'like', 'gdrive:%');
if (error) throw error;

// Un ticket ventilé : plusieurs dépenses, une seule pièce.
const byPath = new Map<string, NonNullable<typeof rows>>();
for (const r of rows ?? []) byPath.set(r.justificatif_path!, [...(byPath.get(r.justificatif_path!) ?? []), r]);

console.log(`${byPath.size} pièce(s) à transférer${write ? '' : ' (essai : ajoutez --write)'}.`);
for (const [path, group] of byPath) {
  const first = group[0];
  const total = group.reduce((s, r) => s + Number(r.montant_ttc), 0);
  const ext = path.endsWith('.pdf') ? 'pdf' : 'jpg';
  const name = justificatifName({ date: first.date_facture, fournisseur: first.fournisseur, montant: total, ext });
  console.log(`- ${path} → ${name} (${group.length} dépense(s))`);
  if (!write) continue;

  const file = await admin.storage.from('justificatifs').download(path);
  if (file.error || !file.data) throw new Error(`Téléchargement de ${path} impossible : ${file.error?.message}`);
  const comptes = group.map((r) => (r.category as { code?: string } | null)?.code).filter(Boolean).join(', ');
  const drive = await uploadToDrive({
    bytes: new Uint8Array(await file.data.arrayBuffer()),
    mimeType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
    name,
    date: first.date_facture,
    description: [first.numero_facture && `Pièce n° ${first.numero_facture}`, comptes && `Compte(s) ${comptes}`].filter(Boolean).join(' — '),
  });
  const upd = await admin
    .from('expenses')
    .update({ justificatif_path: `gdrive:${drive.id}`, document_url: drive.url, updated_at: new Date().toISOString() })
    .in('id', group.map((r) => r.id));
  if (upd.error) throw upd.error;
  console.log(`  ✓ ${drive.url}`);
}
