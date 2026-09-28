import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { synthesizeEditorialInterview } from '../../../../services/aiTasks/editorial';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Route ouverte jusqu'ici : n'importe qui pouvait faire travailler l'IA aux
  // frais du site. Réservée désormais à une session admin valide.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous puis réessayez.' }, { status: 401 });
  }

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
        mode: 'quick',
      });

      const result = extractJson(aiResponse.content[0].text);
      return NextResponse.json(result);
    }

    if (action === 'synthesize_all') {
      // Synchrone, en mode rapide : l'écran d'entretien passe désormais par une
      // tâche de fond (/api/admin/ai-jobs, type « editorial-synthesis »).
      const result = await synthesizeEditorialInterview({ answers: body.answers }, 'quick');
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
