import { NextResponse, NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { extractJson } from '../../../utils/ai';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { recordAiUsage } from '../../../services/aiUsage';

/**
 * Les balises méta sont une micro-tâche : elles restent volontairement sur le
 * modèle le moins cher, quel que soit le modèle choisi dans /admin/settings.
 * La consommation est tout de même comptabilisée dans le budget.
 */
const META_MODEL = 'claude-haiku-4-5';

export async function POST(req: NextRequest) {
  // ── Vérification JWT ──
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 });
  }

  let title = '';
  let content = '';
  let mode: 'article' | 'page' = 'article';
  try {
    const body = await req.json();
    title   = String(body.title   || '').trim();
    content = String(body.content || '').trim();
    if (body.mode === 'page') mode = 'page';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: 'missing_title' }, { status: 400 });
  }

  // Strip HTML tags and collapse whitespace
  const plainContent = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500);

  const client = new Anthropic({ apiKey });

  try {
    if (mode === 'page') {
      // ── Mode page statique : génère tous les champs SEO ──────────────────
      const response = await client.messages.create({
        model: META_MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Tu es un expert SEO francophone spécialisé dans l'accompagnement des victimes de relations toxiques, de pervers narcissiques et de manipulation psychologique (site de Matthieu Le Tousse, Coach Relation Toxique & Pervers Narcissique).

Génère toutes les balises SEO pour cette page web :

Titre actuel : "${title}"
${plainContent ? `Contexte / description : "${plainContent}"` : ''}

Règles absolues :
- title : 50-60 caractères, mot-clé principal en tête, différenciant
- description : 140-160 caractères exactement, incite au clic, résume la valeur
- og_title : peut être légèrement différent du title, plus accrocheur pour les réseaux sociaux (50-60 car.)
- og_description : 1-2 phrases percutantes pour les réseaux sociaux (120-150 car.)
- keywords : 5 à 8 mots-clés séparés par des virgules, pertinents et longue traîne

Réponds UNIQUEMENT avec du JSON valide, sans markdown :
{"title":"...","description":"...","og_title":"...","og_description":"...","keywords":"..."}`,
          },
        ],
      });

      await recordAiUsage({ model: META_MODEL, feature: 'meta', usage: response.usage });

      const raw = (response.content[0] as { type: string; text: string }).text.trim();
      let parsed: any;
      try {
        parsed = extractJson(raw);
      } catch (parseErr: any) {
        console.error('[generate-meta] JSON parsing failed:', parseErr, 'for string:', raw);
        return NextResponse.json({ error: `Format JSON invalide dans la réponse de l'IA : "${raw.slice(0, 100)}..."` }, { status: 500 });
      }

      // Extraction résiliente des clés
      const finalTitle = parsed.title || parsed.meta_title || parsed.metaTitle || parsed['meta-title'] || '';
      const finalDesc = parsed.description || parsed.meta_description || parsed.metaDescription || parsed['meta-description'] || '';
      const finalOgTitle = parsed.og_title || parsed.ogTitle || parsed['og-title'] || finalTitle;
      const finalOgDesc = parsed.og_description || parsed.ogDescription || parsed['og-description'] || finalDesc;
      const finalKeywords = parsed.keywords || parsed.keyword || parsed.mots_cles || parsed.motsCles || '';

      const cleaned = {
        title: String(finalTitle).slice(0, 60),
        description: String(finalDesc).slice(0, 160),
        og_title: String(finalOgTitle).slice(0, 60),
        og_description: String(finalOgDesc).slice(0, 200),
        keywords: String(finalKeywords).slice(0, 300),
      };

      return NextResponse.json(cleaned);

    } else {
      // ── Mode article ──────────────────────────────────────────────────────
      const response = await client.messages.create({
        model: META_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Tu es un expert SEO francophone. Génère une balise meta title et une meta description optimisées pour cet article de blog sur les relations toxiques, les pervers narcissiques et la reconstruction après l'emprise.

Titre de l'article : "${title}"
${plainContent ? `Extrait du contenu : "${plainContent}"` : ''}

Règles absolues :
- meta_title : 50 à 60 caractères maximum, accrocheur, mot-clé principal en tête
- meta_description : EXACTEMENT entre 140 et 160 caractères. Compte précisément. Incite au clic, résume la valeur de l'article, phrase complète sans coupure. Si trop courte, enrichis-la.
- meta_keywords : 5 à 8 mots-clés séparés par des virgules, pertinents et longue traîne, en lien avec les relations toxiques, la manipulation, le pervers narcissique ou la reconstruction

Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans commentaire :
{"meta_title": "...", "meta_description": "...", "meta_keywords": "..."}`,
          },
        ],
      });

      await recordAiUsage({ model: META_MODEL, feature: 'meta', usage: response.usage });

      const raw = (response.content[0] as { type: string; text: string }).text.trim();
      let parsed: any;
      try {
        parsed = extractJson(raw);
      } catch (parseErr: any) {
        console.error('[generate-meta] JSON parsing failed (article):', parseErr, 'for string:', raw);
        return NextResponse.json({ error: `Format JSON invalide dans la réponse de l'IA (article) : "${raw.slice(0, 100)}..."` }, { status: 500 });
      }

      const meta_title = parsed.meta_title || parsed.title || parsed.metaTitle || parsed['meta-title'] || '';
      const meta_description = parsed.meta_description || parsed.description || parsed.metaDescription || parsed['meta-description'] || '';
      const meta_keywords = parsed.meta_keywords || parsed.keywords || parsed.keyword || parsed.mots_cles || '';

      const cleaned = {
        meta_title: String(meta_title).slice(0, 60),
        meta_description: String(meta_description).slice(0, 160),
        meta_keywords: String(meta_keywords).slice(0, 300),
      };

      return NextResponse.json(cleaned);
    }
  } catch (err: any) {
    console.error('[generate-meta] error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
