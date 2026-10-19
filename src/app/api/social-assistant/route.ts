/**
 * Route API — Assistant d'Inspiration Beauté IA (/api/social-assistant)
 *
 * Le Chat IA Social façon TryHolo, 100 % adapté à Emmanuelle Esthétique
 * (Palézieux-Gare, soins Phytomer, Head Spa, massages, beauté du regard,
 * épilation douce & au sucre, bons cadeaux).
 *
 * Modes supportés :
 *  - `mode === 'single'` : Génère immédiatement un post multi-réseaux complet
 *    (Instagram Carrousel + 3 Stories 9:16 + Facebook + Google Business Palézieux
 *    + LinkedIn) via `generateSocialContent`. Retourne `{ type: 'single', title, content }`.
 *  - `mode === 'plan'` : Génère un plan de 3 à 4 publications cohérentes et datées
 *    autour de la demande d'Emmanuelle. Retourne `{ type: 'plan', summary, topics }`.
 *  - `mode === 'ideas'` (défaut) : Répond avec un conseil éditorial chaleureux +
 *    4 idées de publications concrètes et saisonnières pour l'institut.
 *    Retourne `{ type: 'ideas', reply, suggestions }`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import {
  generateSocialContent,
  EMMANUELLE_FALLBACK_DNA,
  type SocialVisualTheme,
} from '../../../utils/socialGeneration';
import { getSettingsServer } from '../../../services/settingsServer';
import { supabase } from '../../../services/supabase';
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';
import { addDaysToKey, todayKey } from '../../../utils/dateKey';

export const runtime = 'nodejs';
export const maxDuration = 60;

export type SocialAssistantMode = 'single' | 'plan' | 'ideas';

export interface SocialAssistantPlanTopic {
  date: string;
  pillar: string;
  title: string;
  angle: string;
  suggestedTheme: SocialVisualTheme;
}

export interface SocialAssistantIdeaSuggestion {
  title: string;
  angle: string;
  pillar: string;
  theme: SocialVisualTheme;
  formatLabel: string;
}

const VALID_THEMES: SocialVisualTheme[] = ['creme', 'marin', 'sauge', 'photo', 'citation'];

function normalizeTheme(raw: unknown, fallback: SocialVisualTheme = 'creme'): SocialVisualTheme {
  const val = String(raw || '').toLowerCase().trim() as SocialVisualTheme;
  return VALID_THEMES.includes(val) ? val : fallback;
}

async function loadBrandContextWithOffers() {
  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  const activityContext = settings.site_activity_context?.trim() || EMMANUELLE_FALLBACK_DNA.site_activity_context;
  const targetPersona   = settings.site_target_persona?.trim()   || EMMANUELLE_FALLBACK_DNA.site_target_persona;
  const toneOfVoice     = settings.site_tone_of_voice?.trim()     || EMMANUELLE_FALLBACK_DNA.site_tone_of_voice;
  const brandTone       = settings.site_brand_tone?.trim()        || EMMANUELLE_FALLBACK_DNA.site_brand_tone;
  const blogTopics      = settings.site_blog_topics?.trim()       || EMMANUELLE_FALLBACK_DNA.site_blog_topics;

  const db = getSupabaseAdmin() || supabase;
  const { data: activeOffers } = await db
    .from('monthly_offers')
    .select('titre, sous_titre, description, prix_chf, duree_minutes, date_fin')
    .eq('active', true)
    .is('archived_at', null)
    .limit(5);

  const offersBlock = ((activeOffers || []) as any[])
    .map(
      (o) =>
        `- Offre en cours : "${o.titre}" (${o.duree_minutes} min, CHF ${o.prix_chf}${o.date_fin ? `, jusqu'au ${o.date_fin}` : ''}) — ${o.sous_titre || ''} ${o.description || ''}`
    )
    .join('\n');

  return {
    activityContext,
    targetPersona,
    toneOfVoice,
    brandTone,
    blogTopics,
    offersBlock,
  };
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let prompt = '';
  let mode: SocialAssistantMode = 'ideas';
  let targetDate = '';
  let theme = '';

  try {
    const body = await req.json();
    prompt = String(body?.prompt || '').trim();
    const rawMode = String(body?.mode || 'ideas').trim();
    if (rawMode === 'single' || rawMode === 'plan' || rawMode === 'ideas') {
      mode = rawMode;
    }
    targetDate = String(body?.targetDate || '').trim();
    theme = String(body?.theme || '').trim();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json(
      { error: "Veuillez saisir une question, un soin ou une envie de publication." },
      { status: 400 }
    );
  }

  try {
    const ctx = await loadBrandContextWithOffers();

    // ── MODE 1 : SINGLE (Génération directe d'un post multi-réseaux complet) ──
    if (mode === 'single') {
      const enrichedIntro = ctx.offersBlock
        ? `${prompt}\n\nOffres actives à l'institut en ce moment (à mentionner uniquement si pertinent avec la demande) :\n${ctx.offersBlock}`
        : prompt;

      const content = await generateSocialContent({
        title: prompt,
        intro: enrichedIntro,
        customInstruction: prompt,
        preferredTheme: theme || undefined,
      });

      const cleanTitle =
        content.google_business?.title ||
        content.instagram.slides[0]?.text?.slice(0, 90) ||
        prompt.slice(0, 90);

      return NextResponse.json({
        type: 'single' as const,
        title: cleanTitle,
        content,
      });
    }

    // ── MODE 2 : PLAN (Plan de 3 ou 4 publications cohérentes autour du thème) ──
    if (mode === 'plan') {
      const startDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : addDaysToKey(todayKey(), 1);
      const slotDates = [
        startDate,
        addDaysToKey(startDate, 2),
        addDaysToKey(startDate, 4),
        addDaysToKey(startDate, 6),
      ];

      const systemPrompt = `Tu es le Directeur Éditorial & Stratège Social Media d'Emmanuelle Esthétique à Palézieux-Gare (https://emmanuelle-esthetique.ch/).
Emmanuelle te demande de préparer une mini-campagne ou une semaine de 4 publications cohérentes et complémentaires autour de son idée.

━━━ CONTEXTE & ACTIVITÉ ━━━
${ctx.activityContext}

━━━ CLIENTES CIBLES ━━━
${ctx.targetPersona}

━━━ CARTE DES SOINS (TARIFS EN CHF) ━━━
${ctx.brandTone}

${ctx.offersBlock ? `━━━ OFFRES DU MOMENT ━━━\n${ctx.offersBlock}\n` : ''}━━━ RÈGLES DU PLAN ━━━
- Propose exactement 4 publications progressives aux dates fournies :
  1. Post 1 ("Reconnaître") : partir d'une sensation concrète ou d'un moment vécu par les clientes de Palézieux, Oron ou Châtel-St-Denis.
  2. Post 2 ("Comprendre") : expliquer avec douceur le mécanisme cutané, l'actif marin Phytomer ou le geste manuel en cabine.
  3. Post 3 ("Comprendre" ou "Reconnaître") : coulisse du cocon à Palézieux-Gare, rituel sensoriel ou conseil à refaire chez soi.
  4. Post 4 ("Passer à l'action") : invitation chaleureuse à réserver son créneau (à 2 min de la gare CFF de Palézieux, parking gratuit) ou à offrir un bon cadeau.
- Pour chaque post, choisis le "suggestedTheme" le plus adapté parmi : "marin" | "sauge" | "creme" | "photo" | "citation".
- Vouvoiement systématique, tarifs en CHF uniquement, ton apaisant et incarné.

Réponds UNIQUEMENT avec un objet JSON strict :
{
  "summary": "2-3 phrases chaleureuses adressées directement à Emmanuelle pour lui présenter la logique de cette séquence de 4 posts.",
  "topics": [
    {
      "date": "YYYY-MM-DD",
      "pillar": "Reconnaître" | "Comprendre" | "Passer à l'action",
      "title": "Titre concret et accrocheur du post",
      "angle": "Brief de rédaction en 2-3 phrases (scène d'ouverture, soin/actif mis en avant, message final).",
      "suggestedTheme": "marin" | "sauge" | "creme" | "photo" | "citation"
    }
  ]
}`;

      const userPrompt = `Demande d'Emmanuelle : "${prompt}"
${theme ? `Thème visuel privilégié : ${theme}\n` : ''}Dates à utiliser dans l'ordre :
${slotDates.map((d) => `- ${d}`).join('\n')}

Génère le JSON du plan de 4 publications.`;

      const response = await callClaude({
        feature: 'social-assistant-plan',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const parsed = extractJson(response.content[0].text);
      const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics : [];

      const topics: SocialAssistantPlanTopic[] = rawTopics
        .filter((t: any) => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 4)
        .map((t: any, idx: number) => ({
          date: slotDates[idx] || slotDates[slotDates.length - 1],
          pillar: String(t.pillar || (idx === 0 ? 'Reconnaître' : idx === 3 ? "Passer à l'action" : 'Comprendre')).trim(),
          title: String(t.title).trim(),
          angle: String(t.angle || '').trim(),
          suggestedTheme: normalizeTheme(t.suggestedTheme, normalizeTheme(theme, 'marin')),
        }));

      if (topics.length === 0) {
        throw new Error("L'IA n'a pas pu construire le plan demandé, réessayez.");
      }

      return NextResponse.json({
        type: 'plan' as const,
        summary: String(
          parsed?.summary ||
            "Voici une séquence de publications complémentaires pensée pour accompagner vos clientes de la prise de conscience jusqu'à la prise de rendez-vous à Palézieux-Gare."
        ).trim(),
        topics,
      });
    }

    // ── MODE 3 : IDEAS (Conseil éditorial + 4 idées de posts saisonnières) ──
    const systemPrompt = `Tu es l'Assistant d'Inspiration Beauté d'Emmanuelle Esthétique à Palézieux-Gare (https://emmanuelle-esthetique.ch/), façon TryHolo Social Studio.
Tu t'adresses directement à Emmanuelle avec bienveillance, clarté et expertise esthétique.

━━━ CONTEXTE & ACTIVITÉ ━━━
${ctx.activityContext}

━━━ CLIENTES CIBLES ━━━
${ctx.targetPersona}

━━━ CARTE DES SOINS & TARIFS (EN CHF) ━━━
${ctx.brandTone}

━━━ TON DE VOIX ━━━
${ctx.toneOfVoice}

${ctx.offersBlock ? `━━━ OFFRES DU MOMENT ━━━\n${ctx.offersBlock}\n` : ''}━━━ TA MISSION ━━━
1. Dans "reply" : réponds chaleureusement à la question ou à l'envie d'Emmanuelle (3 à 5 phrases fluides, concrètes, avec un vrai conseil éditorial ou saisonnier adapté à ses clientes de Palézieux-Gare, Oron et Châtel-St-Denis).
2. Dans "suggestions" : propose exactement 4 idées de publications prêtes à être générées en 1 clic, variées dans leurs angles et formats :
   - "title" : le sujet ou hook concret du post (ex: "Quand le chauffage rallumé fait tirailler vos joues dès 10h du matin")
   - "angle" : le déroulé en 2 phrases (quel soin Phytomer / Head Spa / massage / regard / épilation au sucre mettre en lumière et pourquoi)
   - "pillar" : "Reconnaître" | "Comprendre" | "Passer à l'action"
   - "theme" : "marin" | "sauge" | "creme" | "photo" | "citation"
   - "formatLabel" : ex. "Carrousel 8 slides + 3 Stories" ou "Focus Soin Phytomer + Fiche Google Palézieux" ou "Storytelling Cabine + Post Local"

Réponds UNIQUEMENT avec un objet JSON strict :
{
  "reply": "...",
  "suggestions": [
    {
      "title": "...",
      "angle": "...",
      "pillar": "Reconnaître" | "Comprendre" | "Passer à l'action",
      "theme": "marin" | "sauge" | "creme" | "photo" | "citation",
      "formatLabel": "..."
    }
  ]
}`;

    const userPrompt = `Message d'Emmanuelle : "${prompt}"
${theme ? `Thème visuel préféré : ${theme}\n` : ''}
Réponds en JSON strict avec ton conseil ("reply") et 4 propositions ("suggestions").`;

    const response = await callClaude({
      feature: 'social-assistant-ideas',
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const parsed = extractJson(response.content[0].text);
    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const suggestions: SocialAssistantIdeaSuggestion[] = rawSuggestions
      .filter((s: any) => s && typeof s.title === 'string' && s.title.trim())
      .slice(0, 4)
      .map((s: any) => ({
        title: String(s.title).trim(),
        angle: String(s.angle || '').trim(),
        pillar: String(s.pillar || 'Reconnaître').trim(),
        theme: normalizeTheme(s.theme, normalizeTheme(theme, 'creme')),
        formatLabel: String(s.formatLabel || 'Carrousel + Stories 9:16 + Google').trim(),
      }));

    return NextResponse.json({
      type: 'ideas' as const,
      reply: String(
        parsed?.reply ||
          "Voici 4 pistes éditoriales pensées pour parler directement à vos clientes de Palézieux-Gare, Oron et Châtel-St-Denis."
      ).trim(),
      suggestions,
    });
  } catch (err: any) {
    const message = err?.message || "Erreur lors de l'appel à l'Assistant Beauté IA.";
    const status = message === 'not_configured' ? 503 : 500;
    console.error('[social-assistant] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
