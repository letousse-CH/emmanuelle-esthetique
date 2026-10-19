/**
 * Retire des articles du blog les ajouts hérités du site d'hypnose, écrits par
 * le maillage automatique de l'admin (utils/internalLinks.ts, corrigé le même jour) :
 *  - la phrase finale « Si ce texte résonne en toi… » ;
 *  - les liens vers /seance-individuelle et /about (pages absentes : 404) — le
 *    texte reste, seul le lien saute ;
 *  - le « À lire aussi » dont le lien ne couvrait qu'une partie du titre : il est
 *    réécrit avec le titre complet de l'article cité.
 *
 *   node scripts/blog-nettoyage-2026-10-19.mjs           # essai : montre les changements
 *   node scripts/blog-nettoyage-2026-10-19.mjs --write   # applique (sauvegarde avant)
 *
 * Sauvegarde du contenu d'origine dans scripts/backups/ (ignoré par git).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
const db = createClient(url, key, { auth: { persistSession: false } });
const write = process.argv.includes('--write');
console.log(`Base : ${url}${write ? '' : '   (essai — rien n’est écrit)'}`);

const { data: articles, error } = await db.from('articles').select('id, slug, title, content');
if (error) throw error;
const titles = new Map(articles.map((a) => [a.slug, a.title]));
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function clean(html) {
  const changes = [];
  let out = html.replace(/<p>\s*Si ce texte résonne en toi[\s\S]*?<\/p>/gi, (m) => {
    changes.push(`− paragraphe retiré : « ${plain(m)} »`);
    return '';
  });
  out = out.replace(/<a\b[^>]*href="\/(?:seance-individuelle|about)"[^>]*>([\s\S]*?)<\/a>/gi, (m, text) => {
    changes.push(`− lien retiré (page absente) sur « ${plain(text)} »`);
    return text;
  });
  out = out.replace(/<p>\s*À lire aussi\s*:[\s\S]*?<\/p>/gi, (m) => {
    const slug = m.match(/href="\/blog\/([^"]+)"/)?.[1];
    const title = slug && titles.get(slug);
    if (!title) return m;
    const next = `<p>À lire aussi : <a href="/blog/${slug}">${escapeHtml(title)}</a></p>`;
    if (next !== m) changes.push(`~ « À lire aussi » réécrit : lien sur le titre complet « ${title} »`);
    return next;
  });
  return { out, changes };
}

const todo = [];
for (const a of articles) {
  const { out, changes } = clean(a.content || '');
  console.log(`\n${a.slug}`);
  if (changes.length === 0) { console.log('  rien à changer'); continue; }
  for (const c of changes) console.log(`  ${c}`);
  console.log(`  fin après nettoyage : …${plain(out).slice(-160)}`);
  todo.push({ a, out });
}

if (write && todo.length) {
  // Sauvegarde AVANT toute écriture.
  mkdirSync('scripts/backups', { recursive: true });
  const file = `scripts/backups/blog-nettoyage-2026-10-19-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(todo.map(({ a }) => ({ id: a.id, slug: a.slug, content: a.content })), null, 2));
  console.log(`\nSauvegarde du contenu d'origine : ${file}`);
  for (const { a, out } of todo) {
    const { error: e } = await db.from('articles').update({ content: out }).eq('id', a.id);
    if (e) throw e;
    console.log(`  ✓ ${a.slug} enregistré`);
  }
}
