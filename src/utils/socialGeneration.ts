/**
 * Génération de contenu réseaux sociaux (Instagram carrousel, LinkedIn, Facebook)
 * à partir d'un article, d'un brief de suggestion ou d'une entrée RSS. Logique
 * partagée entre la route interactive (/api/generate-social) et l'automatisation
 * en tâche de fond (cron + déclenchement manuel), pour ne maintenir qu'un seul
 * prompt et un seul contrat de sortie.
 */
import { callClaude, extractJson } from './ai';
import { getSettingsServer } from '../services/settingsServer';

export interface SocialSlide { number: number; text: string; highlight?: string; }
export interface SocialCaption { hook: string; body: string; cta: string; hashtags: string; }
/** Texte du visuel unique (LinkedIn/Facebook). Absent sur les posts générés avant son introduction. */
export interface SocialVisual { text: string; highlight?: string; }
export interface SocialGenerationResult {
  pillar?: string;
  instagram: { slides: SocialSlide[]; caption: SocialCaption };
  linkedin: { hook_variants: string[]; post: string; hashtags?: string; visual?: SocialVisual };
  facebook: { post: string; visual?: SocialVisual };
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const SYSTEM_PROMPT = `Tu écris pour la marque "Au-delà des Chaînes / L'Arsenal Tactique" de Matthieu Le Tousse, Coach Relation Toxique & Pervers Narcissique (Suisse). Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

═══ VOIX — RÈGLES NON NÉGOCIABLES ═══
- Vouvoiement systématique, sans exception, sur tous les formats.
- Narrateur direct : scènes concrètes, jamais de généralités abstraites en ouverture.
- L'émotion se montre par le fait ou le geste, jamais par un adjectif abstrait ("crucial", "essentiel", "profondément", "un vecteur de", "dans un monde où...").
- Rythme alterné : phrases courtes qui claquent + phrases longues qui respirent. Jamais 3 phrases de suite de même longueur.
- Interdits : listes à puces qui remplacent une vraie phrase, jargon corporate (synergie, écosystème, optimiser, booster), "3 leçons que j'ai apprises", "Unpopular opinion:", "Agree or disagree?".

═══ MÉTHODE DE HOOK (C.L.A.C.) — pour la 1ère ligne / 1er slide ═══
Contexte (territoire mental en une phrase) → Lean In (bénéfice, douleur, croyance partagée ou image mentale) → Arrêt (rupture avec "mais / sauf que / le problème c'est que") → Contredirection (angle contre-intuitif).
Varie parmi ces frameworks selon le sujet : Fracture de Croyance ("Vous croyez que X, mais en réalité Y"), Coût Caché ("[Action], ce n'est pas [conséquence évidente], c'est [conséquence cachée]"), Erreur Intelligente, Phrase Impossible à Ignorer, Démonstration Immédiate.

═══ PILIER (à déterminer selon le sujet fourni) ═══
- Reconnaître (le lecteur se reconnaît dans une situation) → CTA de fin : aucune mention de l'offre, question ouverte ou invitation à sauvegarder.
- Comprendre (mécanisme psychologique expliqué) → CTA de fin : mention discrète du Décodeur de Relations.
- Sortir (mise en action) → CTA de fin : mention explicite de L'Arsenal Tactique, direction vers la bio / le lien.

═══ INSTAGRAM — CARROUSEL (8 à 10 slides) ═══
Structure fixe : Slide 1 = hook (2 lignes max, texte seul) · Slide 2 = ouverture de la boucle (promet une réponse sans la donner) · Slides 3 à 7/8 = une seule idée par slide, micro-récompense qui donne envie de swiper · avant-dernière slide = bascule qui referme la boucle du hook · dernière slide = CTA calibré par pilier.
Maximum 25-30 mots par slide. Pour chaque slide, identifie 2 à 4 mots consécutifs qui portent le twist de la phrase (le "highlight") — ils doivent être un extrait EXACT du texte de la slide.
Caption qui accompagne le post : hook, corps, cta, hashtags (15-20 hashtags pertinents en français, mélange marque/niche/large).

═══ LINKEDIN — POST ═══
La conversion se fait par la bio, pas par le texte : ne jamais forcer une vente dans les 3 dernières lignes sauf pilier Sortir.
3 variantes de hook pour la 1ère ligne (courte, visible avant "voir plus") : une scène in medias res, une phrase de rupture, une contradiction directe. "post" = version assemblée avec le meilleur des 3 hooks : hook → 3 à 5 moments courts (rythme alterné) → fin = une phrase personnelle qui ouvre, jamais un CTA générique. Aère avec des sauts de ligne fréquents (une idée = une ligne). Pas d'émoji sauf si le sujet s'y prête vraiment. hashtags : 0 à 2 maximum, jamais en bloc à la fin — laisse vide si aucun n'est vraiment pertinent.

═══ FACEBOOK — POST ═══
Facebook n'est pas un canal de création : ne produis JAMAIS un texte inventé de zéro. Reprends telle quelle la caption Instagram (hook + body + cta) en l'adaptant a minima : registre légèrement plus neutre, légèrement plus long si besoin, hashtags réduits à 2-4 maximum (au lieu des 15-20 d'Instagram). C'est une republication adaptée, pas une nouvelle création.

═══ VISUELS LINKEDIN & FACEBOOK ═══
Chacune de ces deux plateformes reçoit UN visuel unique (pas de carrousel) qui porte le hook en gros à l'écran. Pour chacune, fournis "visual" : { "text": ..., "highlight": ... }.
- "text" : le hook de la plateforme, resserré pour être lisible en une image. 12 à 22 mots maximum, une à deux phrases. Ce n'est pas un résumé du post : c'est la phrase qui arrête le défilement.
- "highlight" : 2 à 4 mots CONSÉCUTIFS extraits EXACTEMENT de "text", ceux qui portent le twist.
- Le visuel LinkedIn est carré, celui de Facebook est en paysage (donc plus court encore) : garde le texte Facebook au bas de la fourchette.

═══ FORMAT DE SORTIE (JSON strict) ═══
{
  "pillar": "Reconnaître" | "Comprendre" | "Sortir",
  "instagram": {
    "slides": [ { "number": 1, "text": "...", "highlight": "..." } ],
    "caption": { "hook": "...", "body": "...", "cta": "...", "hashtags": "#... #..." }
  },
  "linkedin": {
    "hook_variants": ["...", "...", "..."],
    "post": "...",
    "hashtags": "",
    "visual": { "text": "...", "highlight": "..." }
  },
  "facebook": {
    "post": "...",
    "visual": { "text": "...", "highlight": "..." }
  }
}`;

export interface SocialGenerationInput {
  title: string;
  /** Contenu complet (article existant, HTML ou texte) — prioritaire sur `intro`. */
  content?: string;
  /** Brief court (suggestion non encore rédigée, ou résumé de flux RSS). */
  intro?: string;
  keyword?: string;
}

/**
 * Appelle l'IA et retourne le contenu structuré pour les 3 plateformes.
 * Lève une erreur si la clé API est absente ou si la réponse IA est incomplète.
 */
export async function generateSocialContent(input: SocialGenerationInput): Promise<SocialGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    throw new Error('not_configured');
  }

  const title = input.title.trim();
  const content = (input.content || '').trim();
  const intro = (input.intro || '').trim();
  const keyword = (input.keyword || '').trim();

  if (!title) throw new Error('Le titre est obligatoire.');
  if (!content && !intro) throw new Error('Un contenu ou une accroche est nécessaire.');

  const material = content
    ? stripHtml(content).slice(0, 6000)
    : `${intro}\n\n(Article pas encore rédigé — base-toi sur ce brief et le titre pour extrapoler l'angle, sans inventer de faits ou de chiffres précis qui ne sont pas donnés.)`;

  const userPrompt = `Titre : "${title}"
${keyword ? `Mot-clé principal : ${keyword}\n` : ''}
Matière source :
"""
${material}
"""

Génère le JSON demandé pour ce contenu (Instagram carrousel, LinkedIn, Facebook).`;

  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
  ]);

  const activityContext = settings.site_activity_context || "";
  const targetPersona   = settings.site_target_persona || "";
  const toneOfVoice     = settings.site_tone_of_voice || "";
  const brandTone       = settings.site_brand_tone || "";

  const dynamicSystemPrompt = `Tu écris pour la marque et le site web. Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

━━━ CONTEXTE ÉDITORIAL & ACTIVITÉ ━━━
${activityContext}

${targetPersona ? `━━━ PERSONA CIBLE ━━━\n${targetPersona}\n` : ''}
${brandTone ? `━━━ CHARTE DE MARQUE & OFFRES ━━━\n${brandTone}\n` : ''}
${toneOfVoice ? `━━━ TON DE VOIX ━━━\n${toneOfVoice}\n` : ''}

${SYSTEM_PROMPT}`;

  const response = await callClaude({
    feature: 'social',
    max_tokens: 4000,
    system: dynamicSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  const parsed = extractJson(raw);

  if (!parsed?.instagram?.slides || !parsed?.linkedin?.post || !parsed?.facebook?.post) {
    console.error('[socialGeneration] Réponse IA incomplète:', raw);
    throw new Error('Réponse IA incomplète, réessayez.');
  }

  return parsed as SocialGenerationResult;
}
