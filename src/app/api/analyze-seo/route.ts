import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';
import { SITE_CONFIG } from '../../../config/site';
import { getAnthropicKey } from '../../../services/secrets';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SeoFix {
  field: 'title' | 'meta_title' | 'meta_description' | 'content';
  value: string;
  original?: string;
}
interface SeoIssue {
  id: string;
  type: 'blocking' | 'warning' | 'success';
  category: 'meta' | 'structure' | 'contenu' | 'mots-cles';
  message: string;
  detail: string;
  fix?: SeoFix;
}
type IssueInternal = SeoIssue & { _needsFix: boolean; _aiKey?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseContent(html: string) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/&[a-zA-Z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const firstH2Html = h2Matches[0]?.[0] ?? '';
  const firstH2Text = (h2Matches[0]?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
  const firstParaMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const firstParaHtml = firstParaMatch?.[0] ?? '';
  const firstParaText = (firstParaMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
  const imgMatches = [...html.matchAll(/<img[^>]*/gi)];
  const imgsWithoutAlt = imgMatches.filter(m => {
    const altMatch = m[0].match(/alt=["']([^"']*)["']/i);
    return !altMatch || altMatch[1].trim() === '';
  }).length;
  const linkCount = [...html.matchAll(/<a\s/gi)].length;
  const words = plain.trim() === '' ? [] : plain.trim().split(/\s+/);
  return { plain, wordCount: words.length, h2Count: h2Matches.length, firstH2Html, firstH2Text, firstParaHtml, firstParaText, imageCount: imgMatches.length, imgsWithoutAlt, linkCount };
}

function normalize(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['']/g, "'");
}
function hasKeyword(text: string, kw: string) {
  return !kw.trim() || normalize(text).includes(normalize(kw));
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
 try {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = await getAnthropicKey();
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') return NextResponse.json({ error: 'not_configured' }, { status: 500 });

  let title = '', meta_title = '', meta_description = '', content = '', focus_keyword = '';
  try {
    const body = await req.json();
    title            = String(body.title            || '').trim();
    meta_title       = String(body.meta_title       || '').trim();
    meta_description = String(body.meta_description || '').trim();
    content          = String(body.content          || '').trim();
    focus_keyword    = String(body.focus_keyword    || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const p = parseContent(content);
  const issues: IssueInternal[] = [];
  const push = (issue: SeoIssue & { _needsFix?: boolean; _aiKey?: string }) =>
    issues.push({ _needsFix: false, ...issue });

  // ── Meta titre ───────────────────────────────────────────────────────────────
  const mtLen = meta_title.length;
  if (mtLen === 0)      push({ id: 'meta_title_empty', type: 'blocking', category: 'meta', _needsFix: true, _aiKey: 'new_meta_title', message: 'Meta titre manquant', detail: "Le meta titre est vide — Google ne peut pas l'afficher dans les résultats." });
  else if (mtLen > 60)  push({ id: 'meta_title_long',  type: 'blocking', category: 'meta', _needsFix: true, _aiKey: 'new_meta_title', message: `Meta titre trop long (${mtLen}/60 car.)`, detail: `Il dépasse de ${mtLen - 60} caractère(s). Google le tronquera dans les SERP.` });
  else if (mtLen < 40)  push({ id: 'meta_title_short', type: 'warning',  category: 'meta', _needsFix: true, _aiKey: 'new_meta_title', message: `Meta titre court (${mtLen} car.)`, detail: 'Cible : 50–60 caractères.' });
  else                  push({ id: 'meta_title_ok',    type: 'success',  category: 'meta', message: `Meta titre optimisé (${mtLen}/60 car.)`, detail: 'Longueur parfaite pour les SERP Google.' });

  // ── Meta description ─────────────────────────────────────────────────────────
  const mdLen = meta_description.length;
  if (mdLen === 0)      push({ id: 'meta_desc_empty', type: 'blocking', category: 'meta', _needsFix: true, _aiKey: 'new_meta_description', message: 'Meta description manquante', detail: 'Google générera automatiquement un extrait souvent hors-contexte.' });
  else if (mdLen > 160) push({ id: 'meta_desc_long',  type: 'blocking', category: 'meta', _needsFix: true, _aiKey: 'new_meta_description', message: `Meta description trop longue (${mdLen}/160 car.)`, detail: `Elle dépasse de ${mdLen - 160} caractère(s) et sera tronquée.` });
  else if (mdLen < 140) push({ id: 'meta_desc_short', type: 'warning',  category: 'meta', _needsFix: true, _aiKey: 'new_meta_description', message: `Meta description courte (${mdLen} car.)`, detail: 'Cible : 150–160 caractères.' });
  else                  push({ id: 'meta_desc_ok',    type: 'success',  category: 'meta', message: `Meta description parfaite (${mdLen}/160 car.)`, detail: '' });

  // ── Mots-clés ────────────────────────────────────────────────────────────────
  if (focus_keyword) {
    if (!hasKeyword(title, focus_keyword))            push({ id: 'title_kw',      type: 'blocking', category: 'mots-cles', _needsFix: true, _aiKey: 'new_title',            message: 'Mot-clé absent du titre H1',         detail: `"${focus_keyword}" n'est pas dans le titre.` });
    else                                              push({ id: 'title_kw_ok',   type: 'success',  category: 'mots-cles', message: 'Mot-clé présent dans le titre H1', detail: '' });
    if (mtLen > 0 && !hasKeyword(meta_title, focus_keyword))       push({ id: 'meta_title_kw',  type: 'warning', category: 'mots-cles', _needsFix: true, _aiKey: 'new_meta_title', message: 'Mot-clé absent du meta titre',       detail: `Intégrer "${focus_keyword}" renforce le signal Google.` });
    else if (mtLen > 0)                               push({ id: 'meta_title_kw_ok', type: 'success', category: 'mots-cles', message: 'Mot-clé présent dans le meta titre', detail: '' });
    if (mdLen > 0 && !hasKeyword(meta_description, focus_keyword)) push({ id: 'meta_desc_kw',   type: 'warning', category: 'mots-cles', _needsFix: true, _aiKey: 'new_meta_description', message: 'Mot-clé absent de la meta description', detail: `Google met "${focus_keyword}" en gras si présent.` });
    else if (mdLen > 0)                               push({ id: 'meta_desc_kw_ok', type: 'success', category: 'mots-cles', message: 'Mot-clé dans la meta description', detail: '' });
    if (p.firstH2Text && !hasKeyword(p.firstH2Text, focus_keyword))   push({ id: 'h2_kw',    type: 'warning', category: 'mots-cles', _needsFix: true, _aiKey: 'new_h2',    message: 'Mot-clé absent du premier H2',   detail: `Le premier H2 est lu tôt par Googlebot.` });
    else if (p.firstH2Text)                           push({ id: 'h2_kw_ok',   type: 'success', category: 'mots-cles', message: 'Mot-clé présent dans le premier H2', detail: '' });
    if (p.firstParaText && !hasKeyword(p.firstParaText, focus_keyword)) push({ id: 'intro_kw', type: 'warning', category: 'mots-cles', _needsFix: true, _aiKey: 'new_intro', message: "Mot-clé absent de l'introduction", detail: "Google lit l'intro en priorité." });
    else if (p.firstParaText)                         push({ id: 'intro_kw_ok', type: 'success', category: 'mots-cles', message: "Mot-clé présent dans l'introduction", detail: '' });
  }

  // ── Longueur du contenu ───────────────────────────────────────────────────────
  const wc = p.wordCount;
  if (wc < 800)        push({ id: 'wc_low',   type: 'blocking', category: 'contenu', message: `Contenu trop court (${wc} mots)`,  detail: 'Google positionne rarement les articles < 800 mots. Cible : 2000–2800.' });
  else if (wc < 1500)  push({ id: 'wc_short', type: 'warning',  category: 'contenu', message: `Contenu court (${wc} mots — cible 2000+)`, detail: 'Enrichis avec des exemples ou une méthode en étapes.' });
  else if (wc > 3500)  push({ id: 'wc_long',  type: 'warning',  category: 'contenu', message: `Contenu très long (${wc} mots)`,   detail: 'Envisage de scinder ou condenser certaines sections.' });
  else                 push({ id: 'wc_ok',    type: 'success',  category: 'contenu', message: `Longueur idéale (${wc.toLocaleString('fr-FR')} mots)`, detail: '' });

  // ── Structure H2 ─────────────────────────────────────────────────────────────
  if (p.h2Count === 0)      push({ id: 'h2_missing', type: 'blocking', category: 'structure', message: "Aucun titre H2", detail: 'Ajoute des H2 pour structurer le contenu.' });
  else if (p.h2Count < 3)   push({ id: 'h2_few',     type: 'warning',  category: 'structure', message: `Peu de H2 (${p.h2Count})`, detail: 'Vise 4 à 6 H2 pour un article de 2000+ mots.' });
  else                      push({ id: 'h2_ok',      type: 'success',  category: 'structure', message: `Structure H2 solide (${p.h2Count} titres)`, detail: '' });

  // ── Images ───────────────────────────────────────────────────────────────────
  if (p.imageCount > 0 && p.imgsWithoutAlt > 0) push({ id: 'img_alt', type: 'warning', category: 'structure', message: `${p.imgsWithoutAlt} image(s) sans alt`, detail: "L'attribut alt est crucial pour l'accessibilité et Google Images." });
  else if (p.imageCount > 0)                    push({ id: 'img_ok',  type: 'success', category: 'structure', message: 'Toutes les images ont un attribut alt', detail: '' });

  // ── Liens internes ────────────────────────────────────────────────────────────
  if (p.linkCount === 0)     push({ id: 'links_none', type: 'warning', category: 'structure', message: 'Aucun lien interne détecté', detail: 'Vise 2 à 5 liens internes.' });
  else if (p.linkCount < 2)  push({ id: 'links_few',  type: 'warning', category: 'structure', message: `Peu de liens internes (${p.linkCount})`, detail: 'Vise 2 à 5 liens internes.' });
  else                       push({ id: 'links_ok',   type: 'success', category: 'structure', message: `Maillage interne actif (${p.linkCount} lien(s))`, detail: '' });

  // ── Corrections IA ───────────────────────────────────────────────────────────
  const fixableIssues = issues.filter(i => i._needsFix && i._aiKey);
  const neededAiKeys  = [...new Set(fixableIssues.map(i => i._aiKey!))];

  if (neededAiKeys.length > 0) {
    const needs = (k: string) => neededAiKeys.includes(k);
    const requestedFields: string[] = [];
    if (needs('new_title'))            requestedFields.push(`  "new_title": "Titre H1 reformulé avec le mot-clé focus (même sens, max 80 car.)"`);
    if (needs('new_meta_title'))       requestedFields.push(`  "new_meta_title": "Meta titre idéal 50–60 car., mot-clé focus en début"`);
    if (needs('new_meta_description')) requestedFields.push(`  "new_meta_description": "Meta description 150–160 car., mot-clé focus présent, incitative au clic"`);
    if (needs('new_h2'))               requestedFields.push(`  "new_h2": "Premier H2 réécrit avec le mot-clé focus (style inchangé)"`);
    if (needs('new_intro'))            requestedFields.push(`  "new_intro": "Premier paragraphe réécrit avec le mot-clé focus, ton de voix de la marque préservé"`);

    const brand = await getSettingsServer([
      'site_activity_context',
      'site_tone_of_voice',
      'site_brand_tone',
    ]);

    const prompt = [
      `Tu es le rédacteur officiel du blog de ${SITE_CONFIG.name}.`,
      brand.site_activity_context ? `Activité : ${brand.site_activity_context}` : '',
      `Génère les corrections SEO demandées en respectant strictement le ton de voix de la marque.`,
      ``,
      `CONTEXTE :`,
      `- Titre H1 : "${title}"`,
      `- Mot-clé focus : "${focus_keyword || 'non défini'}"`,
      `- Meta titre actuel (${mtLen} car.) : "${meta_title}"`,
      `- Meta description actuelle (${mdLen} car.) : "${meta_description}"`,
      p.firstH2Text   ? `- Premier H2 : "${p.firstH2Text}"` : '',
      p.firstParaText ? `- Introduction : "${p.firstParaText.slice(0, 500)}"` : '',
      `- Extrait du corps : "${p.plain.slice(0, 1200)}"`,
      ``,
      `TON DE VOIX — RÈGLES NON NÉGOCIABLES :`,
      brand.site_tone_of_voice || `Conversationnel, direct et concret. "ça" plutôt que "cela", virgules-pauses.`,
      brand.site_brand_tone ? `CHARTE DE MARQUE & VOCABULAIRE :\n${brand.site_brand_tone}` : '',
      `N'invente jamais le nom d'une offre, d'un produit ou d'un service.`,
      `Mots INTERDITS : crucial, fondamental, essentiel, clé, optimiser, booster, transformer, naviguer (métaphorique), cela, constitue, s'avère, néanmoins, synergies, "dans un monde où", "déclic magique", jargon ésotérique.`,
      ``,
      `CORRECTIONS (JSON valide uniquement, sans markdown) :`,
      `{`,
      requestedFields.join(',\n'),
      `}`,
    ].filter(Boolean).join('\n');

    try {
      // maxRetries bas + timeout borné : évite que les retries du SDK fassent dépasser
      // le timeout des fonctions Netlify (10s) et tuent la réponse (corps vide).
      const resp = await callClaude({
        feature: 'seo-analyze',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        timeout: 25000
      });
      const raw = ((resp.content[0] as { text: string }).text).trim();
      try {
        const ai = extractJson(raw) as Record<string, string>;
        for (const issue of issues) {
          if (!issue._needsFix || !issue._aiKey) continue;
          if (issue._aiKey === 'new_title'            && ai.new_title)            issue.fix = { field: 'title',            value: ai.new_title.trim() };
          if (issue._aiKey === 'new_meta_title'       && ai.new_meta_title)       issue.fix = { field: 'meta_title',       value: ai.new_meta_title.trim().slice(0, 60) };
          if (issue._aiKey === 'new_meta_description' && ai.new_meta_description) issue.fix = { field: 'meta_description', value: ai.new_meta_description.trim().slice(0, 160) };
          if (issue._aiKey === 'new_h2'    && ai.new_h2    && p.firstH2Html && p.firstH2Text)     issue.fix = { field: 'content', value: p.firstH2Html.replace(p.firstH2Text, ai.new_h2.trim()),         original: p.firstH2Html };
          if (issue._aiKey === 'new_intro' && ai.new_intro && p.firstParaHtml && p.firstParaText) issue.fix = { field: 'content', value: p.firstParaHtml.replace(p.firstParaText, ai.new_intro.trim()), original: p.firstParaHtml };
        }
      } catch (parseErr) {
        console.error('[analyze-seo] JSON parsing failed:', parseErr, 'raw:', raw);
      }
    } catch (err) {
      console.warn('[analyze-seo] AI corrections failed:', err);
    }
  }

  // ── Score ─────────────────────────────────────────────────────────────────────
  const blockingCount = issues.filter(i => i.type === 'blocking').length;
  const warningCount  = issues.filter(i => i.type === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - blockingCount * 20 - warningCount * 7));

  const cleanIssues: SeoIssue[] = issues.map(({ _needsFix: _n, _aiKey: _a, ...rest }) => rest);
  return NextResponse.json({ score, issues: cleanIssues });
 } catch (e: any) {
   console.error('[analyze-seo] error:', e);
   return NextResponse.json({ error: e?.message || 'Erreur serveur lors de l\'analyse SEO' }, { status: 500 });
 }
}
