/**
 * Plan éditorial réseaux sociaux : propose une série de sujets datés, adossés
 * à la ligne éditoriale de la marque, avant toute rédaction.
 *
 * La génération se fait en deux temps volontairement séparés : ce module ne
 * produit que le *plan* (un seul appel IA, rapide), puis l'admin fait générer
 * le contenu sujet par sujet. Enchaîner 12 rédactions dans une seule requête
 * dépasserait le budget d'exécution d'une fonction serverless.
 */
import { callClaude, extractJson } from './ai';
import type { EditorialPeriod, EditorialTopic } from '../types/editorial';
import { getSettingsServer } from '../services/settingsServer';

export type { EditorialPeriod, EditorialTopic };

const SYSTEM_PROMPT = `Règles de construction du plan (le contexte de marque, la persona et les offres sont fournis plus haut). Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

═══ LIGNE ÉDITORIALE — 3 PILIERS ═══
- Reconnaître : le lecteur se reconnaît dans une situation précise de son quotidien. Aucune mention d'offre.
- Comprendre : un mécanisme, un geste ou une notion expliqués concrètement. Mention discrète d'une offre.
- Passer à l'action : mise en pratique concrète. Mention explicite de l'offre principale.

═══ OFFRES ═══
N'utilise que les offres nommées dans la charte de marque ci-dessus. N'invente jamais un nom de programme, de produit ou de service. Ne survends jamais.

═══ RÈGLES DE CONSTRUCTION DU PLAN ═══
- Alterne les piliers : jamais deux fois le même pilier d'affilée, et sur l'ensemble du plan vise une répartition proche de 40% Reconnaître, 35% Comprendre, 25% Sortir.
- Un sujet = une situation concrète et reconnaissable, jamais un thème abstrait. "Votre peau tiraille dès que le chauffage se rallume" est un sujet ; "l'hydratation" n'en est pas un.
- Varie les moments du parcours : celle qui n'ose pas franchir la porte, la première visite, celle qui revient, celle qui veut refaire les gestes chez elle.
- Varie les angles : le soin en cabine, le geste à reproduire à la maison, l'ingrédient, la saison, le moment pour soi.
- Aucun doublon avec les sujets déjà traités qui te seront fournis, et aucune redite entre les sujets du plan.
- "angle" (2 à 4 phrases) : la scène concrète d'ouverture, le mécanisme à faire comprendre, et ce que le lecteur doit avoir compris à la fin. C'est un brief de rédaction, pas un résumé promotionnel.
- Vouvoiement systématique. Pas de jargon corporate, pas d'adjectifs abstraits ("crucial", "essentiel", "profondément"). Aucune promesse médicale ou anti-âge exagérée.

═══ FORMAT DE SORTIE (JSON strict) ═══
{
  "topics": [
    { "date": "YYYY-MM-DD", "pillar": "Reconnaître" | "Comprendre" | "Passer à l'action", "title": "...", "angle": "..." }
  ]
}`;

export interface EditorialPlanInput {
  period: EditorialPeriod;
  /** Dates de publication à couvrir, dans l'ordre. */
  dates: string[];
  /** Titres déjà planifiés ou publiés, pour éviter les doublons. */
  existingTitles?: string[];
}

/** Demande un plan éditorial à l'IA. Lève une erreur si la réponse est inexploitable. */
export async function generateEditorialPlan(input: EditorialPlanInput): Promise<EditorialTopic[]> {
  const dates = input.dates.filter(Boolean);
  if (dates.length === 0) throw new Error('Aucune date de publication fournie.');

  const existing = (input.existingTitles || []).filter(Boolean).slice(0, 60);

  const userPrompt = `Construis un plan de ${dates.length} publication${dates.length > 1 ? 's' : ''} pour la période à venir.

Utilise EXACTEMENT ces dates de publication, dans cet ordre, une par sujet :
${dates.map((d) => `- ${d}`).join('\n')}
${existing.length ? `\nSujets déjà traités — n'en propose aucun équivalent :\n${existing.map((t) => `- ${t}`).join('\n')}` : ''}

Génère le JSON demandé.`;

  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  const activityContext = settings.site_activity_context || "";
  const targetPersona   = settings.site_target_persona || "";
  const brandTone       = settings.site_brand_tone || "";
  const blogTopics      = settings.site_blog_topics || "";

  const dynamicSystemPrompt = `Tu construis le calendrier éditorial réseaux sociaux pour la marque et le site. Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

━━━ CONTEXTE ÉDITORIAL & ACTIVITÉ ━━━
${activityContext}

${targetPersona ? `━━━ AUDIENCE & PERSONA CIBLE ━━━\n${targetPersona}\n` : ''}
${brandTone ? `━━━ MARQUE & OFFRES ━━━\n${brandTone}\n` : ''}
${blogTopics ? `━━━ PILIERS & THÉMATIQUES ━━━\n${blogTopics}\n` : ''}

${SYSTEM_PROMPT}`;

  const response = await callClaude({
    feature: 'plan-editorial',
    max_tokens: 4000,
    system: dynamicSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const parsed = extractJson(response.content[0].text);
  const topics: EditorialTopic[] = Array.isArray(parsed?.topics) ? parsed.topics : [];

  const clean = topics
    .filter((t) => t && typeof t.title === 'string' && t.title.trim())
    .map((t, i) => ({
      // La date de l'IA n'est pas source de vérité : on réaligne sur la
      // séquence demandée pour garantir un post par créneau prévu.
      date: dates[i] ?? dates[dates.length - 1],
      pillar: String(t.pillar || '').trim() || 'Reconnaître',
      title: String(t.title).trim(),
      angle: String(t.angle || '').trim(),
    }))
    .slice(0, dates.length);

  if (clean.length === 0) {
    console.error('[editorialPlan] Réponse IA inexploitable:', response.content[0].text);
    throw new Error('Plan éditorial vide, réessayez.');
  }

  return clean;
}
