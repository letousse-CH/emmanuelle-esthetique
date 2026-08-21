import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'evaluate_step') {
      const { stepIndex, topicTitle, question, transcript, currentFollowUpCount, stepHistory } = body;

      if (!transcript || transcript.trim().length === 0) {
        return NextResponse.json({
          status: 'incomplete',
          feedback: 'Aucune réponse vocale détectée.',
          followUpQuestion: 'Pourriez-vous répéter votre réponse à voix haute ?',
          summary: '',
        });
      }

      // If user has already answered 2 follow-up questions for this step, don't keep asking forever
      if (currentFollowUpCount >= 2) {
        const fullTranscript = [...(stepHistory || []), transcript].join(' | ');
        return NextResponse.json({
          status: 'sufficient',
          feedback: 'Merci pour ces précisions !',
          followUpQuestion: null,
          summary: fullTranscript,
        });
      }

      const systemPrompt = `Tu es l'assistant éditorial IA de la plateforme. Tu mènes une interview vocale en direct avec le client pour collecter la ligne éditoriale de son site internet.
Ton objectif est de vérifier si la réponse à la question posée est SUFFISAMMENT CLAIRE et PRÉCISE pour alimenter plus tard la rédaction d'articles, le ton et le branding du site.

Critères d'évaluation :
- Si la réponse est très courte (moins de 4-5 mots), vague ou évasive (ex: "je fais de l'esthétique"), renvoie status: "incomplete" et pose UNE SEULE question de relance courte, bienveillante et pertinente.
- Si la réponse apporte des détails concrets et utiles, renvoie status: "sufficient", sans question de relance.

Format de réponse OBLIGATOIRE (JSON strict uniquement) :
{
  "status": "sufficient" | "incomplete",
  "feedback": "Phrase courte d'encouragement ou d'explication",
  "followUpQuestion": "Question de relance si incomplete, sinon null",
  "summary": "Résumé fluide et structuré de la réponse donnée"
}`;

      const userPrompt = `Thème : ${topicTitle}
Question principale : ${question}
${stepHistory?.length ? `Historique de la discussion sur cette question :\n${stepHistory.join('\n')}\n` : ''}
Dernière réponse vocale du client : "${transcript}"

Évalue cette réponse et renvoie le JSON.`;

      const aiResponse = await callClaude({
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        max_tokens: 1000,
        feature: 'editorial-interview',
      });

      const result = extractJson(aiResponse.content[0].text);
      return NextResponse.json(result);
    }

    if (action === 'synthesize_all') {
      const { answers } = body;

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
        max_tokens: 4000,
        feature: 'editorial-interview-synthesis',
      });

      const result = extractJson(aiResponse.content[0].text);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (error: any) {
    console.error('[editorial-interview] Erreur API :', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l’analyse par Claude.' },
      { status: 500 }
    );
  }
}
