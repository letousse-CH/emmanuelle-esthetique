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

const SYSTEM_PROMPT = `Tu construis le calendrier éditorial réseaux sociaux de "Au-delà des Chaînes / L'Arsenal Tactique", la marque de Matthieu Le Tousse, Coach Relation Toxique & Pervers Narcissique (Suisse). Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

═══ AUDIENCE ═══
Hommes et femmes de 25 à 45 ans, en couple toxique, en séparation, ou en reconstruction après une rupture d'emprise. Ils ne se décrivent pas comme "victimes" : ils se décrivent comme fatigués, confus, en train de perdre confiance en leur propre jugement.

═══ LIGNE ÉDITORIALE — 3 PILIERS ═══
- Reconnaître : le lecteur se reconnaît dans une situation précise. Aucune mention d'offre.
- Comprendre : un mécanisme psychologique expliqué (emprise, gaslighting, sevrage neuro-émotionnel, dissonance). Mention discrète du Décodeur de Relations.
- Sortir : mise en action concrète. Mention explicite de L'Arsenal Tactique.

═══ OFFRES (à ne jamais survendre) ═══
- Le Décodeur de Relations : test qui situe la relation sur une échelle d'emprise. Porte d'entrée douce, pilier Comprendre.
- L'Arsenal Tactique : programme complet (Mindset, Sortir du brouillard, Protocole de défense, Sevrage neuro-émotionnel, Reconstruction, Immunisation). Pilier Sortir.

═══ RÈGLES DE CONSTRUCTION DU PLAN ═══
- Alterne les piliers : jamais deux fois le même pilier d'affilée, et sur l'ensemble du plan vise une répartition proche de 40% Reconnaître, 35% Comprendre, 25% Sortir.
- Un sujet = une situation concrète et reconnaissable, jamais un thème abstrait. "Il vous reproche d'être trop sensible juste après vous avoir blessé" est un sujet ; "la manipulation émotionnelle" n'en est pas un.
- Varie les moments du parcours : encore dedans, en train de partir, parti mais en manque, en reconstruction, plusieurs mois après.
- Varie les configurations : couple, ex, parent, collègue ou associé, ami. Ne reste pas uniquement sur le couple.
- Aucun doublon avec les sujets déjà traités qui te seront fournis, et aucune redite entre les sujets du plan.
- "angle" (2 à 4 phrases) : la scène concrète d'ouverture, le mécanisme à faire comprendre, et ce que le lecteur doit avoir compris à la fin. C'est un brief de rédaction, pas un résumé promotionnel.
- Vouvoiement systématique. Pas de jargon corporate, pas d'adjectifs abstraits ("crucial", "essentiel", "profondément").

═══ FORMAT DE SORTIE (JSON strict) ═══
{
  "topics": [
    { "date": "YYYY-MM-DD", "pillar": "Reconnaître" | "Comprendre" | "Sortir", "title": "...", "angle": "..." }
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
