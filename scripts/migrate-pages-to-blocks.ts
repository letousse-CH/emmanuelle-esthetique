/**
 * Conversion des pages Studio vers le page builder v2.
 *
 *   npx tsx scripts/migrate-pages-to-blocks.ts            # essai : rapport seul
 *   npx tsx scripts/migrate-pages-to-blocks.ts --write    # écrit content + content_version = 2
 *
 * N'écrit jamais dans `sections` (lu par l'ancien code, sert de retour
 * arrière). Les pages déjà en v2 sont ignorées. Nécessite la migration
 * supabase/migrations/20260926_page_blocks_content.sql.
 *
 * Note : la conversion a aussi lieu à la lecture ; ce script sert à figer la
 * version convertie (par exemple avant de retirer l'ancien code).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { convertStudioSections, type ConversionReport, type StudioSection } from '../src/components/blocks/convert';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  loadEnv();
  const write = process.argv.includes('--write');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Base : ${url}\nMode : ${write ? 'ÉCRITURE' : 'essai (aucune écriture)'}\n`);

  const { data: pages, error } = await db.from('dynamic_pages').select('*').order('slug');
  if (error) throw error;

  const total: ConversionReport = { converted: {}, legacy: {}, warnings: [] };
  for (const p of pages ?? []) {
    if (p.content_version === 2) { console.log(`= ${p.slug} : déjà en v2, ignorée`); continue; }
    const rep: ConversionReport = { converted: {}, legacy: {}, warnings: [] };
    const content = convertStudioSections(p.sections as StudioSection[], rep);
    const blocks = content.reduce((n, s) => n + s.columns.reduce((m, c) => m + c.blocks.length, 0), 0);
    const legacy = Object.entries(rep.legacy).map(([t, n]) => `${t}×${n}`).join(', ');
    console.log(`${legacy ? '!' : '✓'} ${p.slug} : ${(p.sections ?? []).length} sections → ${content.length} sections, ${blocks} blocs${legacy ? ` — conservées telles quelles : ${legacy}` : ''}`);
    for (const w of new Set(rep.warnings)) console.log(`    ⚠ ${w}`);
    for (const [k, v] of Object.entries(rep.converted)) total.converted[k] = (total.converted[k] ?? 0) + v;
    for (const [k, v] of Object.entries(rep.legacy)) total.legacy[k] = (total.legacy[k] ?? 0) + v;
    if (write) {
      const { error: e } = await db.from('dynamic_pages').update({ content, content_version: 2 }).eq('id', p.id);
      if (e) { console.error(`    ✗ écriture : ${e.message}`); process.exitCode = 1; }
    }
  }
  console.log('\nConverties :', total.converted);
  console.log('Conservées (legacy_section) :', Object.keys(total.legacy).length ? total.legacy : 'aucune');
}

main().catch((e) => { console.error(e); process.exit(1); });
