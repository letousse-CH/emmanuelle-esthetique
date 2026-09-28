/**
 * Synthèse de l'entretien éditorial : transforme les réponses de l'interview
 * vocale en cinq réglages « Éditorial & Marque ». Extrait de la route
 * `/api/admin/editorial-interview` (action `synthesize_all`) pour être
 * exécutable en tâche de fond (`services/aiJobs`, type `editorial-synthesis`).
 */
import { callClaude, extractJson } from '../../utils/ai';
import type { AiTaskMode } from './shared';

export async function synthesizeEditorialInterview(
  input: { answers?: unknown },
  mode: AiTaskMode = 'long',
): Promise<Record<string, unknown>> {
    const { answers } = input;

      const systemPrompt = `Tu es un expert en stratégie de marque, copywriting et ligne éditoriale web.
On te fournit les retranscriptions complètes d'une interview vocale menée avec un professionnel/client.

Ton rôle est d'analyser l'ensemble des échanges et de rédiger un dossier éditorial parfait, structuré et professionnel composé de 5 éléments distincts.

Consignes pour chaque champ :
1. "site_activity_context" : Présentation complète de l'activité, du secteur, des spécialisations et de l'offre (2-4 paragraphes fluides).
2. "site_target_persona" : Description précise de la clientèle cible (profils, tranche d'âge, problématiques, attentes et désirs) (2-3 paragraphes).
3. "site_tone_of_voice" : Style et registre de communication (ex: tutoiement/vouvoiement, chaleureux, rassurant, expert, conversationnel) avec des exemples d'expressions (2-3 paragraphes).
4. "site_brand_tone" : Valeurs fondamentales, promesse phare de la marque, mots clés à privilégier et termes à éviter (2-3 paragraphes).
5. "site_blog_topics" : Liste numérotée et détaillée de 4 à 6 piliers thématiques majeurs pour la création de contenu et le blog.

Format de réponse OBLIGATOIRE (JSON strict uniquement) :
{
  "site_activity_context": "...",
  "site_target_persona": "...",
  "site_tone_of_voice": "...",
  "site_brand_tone": "...",
  "site_blog_topics": "..."
}`;

      const userPrompt = `Voici les données de l'interview vocale du client :

${JSON.stringify(answers, null, 2)}

Génère la synthèse éditoriale complète sous forme de JSON strict.`;

      const aiResponse = await callClaude({
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        // En synchrone (mode quick), budget réduit pour tenir sous 60 s.
        max_tokens: mode === 'long' ? 4000 : 3000,
        feature: 'editorial-interview-synthesis',
        mode,
      });

      return extractJson(aiResponse.content[0].text);
}
