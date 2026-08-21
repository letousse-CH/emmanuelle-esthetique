import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../config/modules';
import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig } from '../../../services/aiConfig';
import { recordAiUsage } from '../../../services/aiUsage';
import { resolveModelSpec } from '../../../constants/aiModels';
import { getSettingsServer } from '../../../services/settingsServer';
import { getAnthropicKey } from '../../../services/secrets';
import { buildPrompt } from '../../../utils/articleGeneration';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ error: 'Module de génération IA désactivé' }, { status: 403 });
  }

  const anthropicApiKey = await getAnthropicKey();
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY non configurée' },
      { status: 500 }
    );
  }

  let idea: any;
  try {
    const body = await req.json();
    idea = body.idea;
    if (!idea?.keyword) throw new Error('Brief incomplet');
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(': ping\n\n'));
      } catch (e) {
        console.error('[generate-article] Failed to send initial ping:', e);
      }

      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {}
      }, 5000);

      try {
        const client = new Anthropic({ apiKey: anthropicApiKey });
        const settings = await getSettingsServer([
          'site_activity_context',
          'site_target_persona',
          'site_tone_of_voice',
          'site_brand_tone',
        ]);
        const prompt = buildPrompt(idea, settings);

        // Modèle piloté depuis /admin/settings → IA & Budget.
        const { model } = await getAiConfig();
        const spec = resolveModelSpec(model);

        const claudeStream = await client.messages.stream({
          model: spec.id,
          max_tokens: 16000,
          // Réflexion explicitement coupée : sur les modèles récents elle est
          // active par défaut et partagerait `max_tokens` avec l'article, qui
          // serait tronqué en cours de rédaction. Les modèles plus anciens ne
          // connaissent pas le paramètre : on ne l'envoie pas.
          ...(spec.supportsAdaptiveThinking ? { thinking: { type: 'disabled' as const } } : {}),
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const payload = {
              type: 'content_block_delta',
              delta: {
                type: 'text_delta',
                text: event.delta.text,
              },
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        }

        // Comptabilise la consommation une fois le flux terminé (suivi du
        // budget dans /admin/settings → IA & Budget).
        const finalMessage = await claudeStream.finalMessage();
        await recordAiUsage({ model: spec.id, feature: 'article', usage: finalMessage.usage });

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        clearInterval(pingInterval);
        controller.close();
      } catch (streamErr: any) {
        clearInterval(pingInterval);
        console.error('[generate-article] stream error:', streamErr);
        const errPayload = {
          type: 'error',
          message: streamErr.message || String(streamErr),
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errPayload)}\n\n`));
        } catch (e) {}
        controller.error(streamErr);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
