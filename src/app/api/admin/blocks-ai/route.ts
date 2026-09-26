import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getSettingsServer } from '../../../../services/settingsServer';
import { isModuleEnabledServer } from '../../../../config/modules';
import { blocksSchemaForAi } from '../../../../components/blocks/aiSchema';
import { normalizeContent } from '../../../../components/blocks/validate';

export const runtime = 'nodejs';

const WRITING_RULES = `Règles d'écriture :
- Français de Suisse romande, vouvoiement, première personne pour l'esthéticienne (« je vous reçois »).
- Phrases complètes avec un verbe conjugué ; ton chaleureux, concret, sans emphase publicitaire.
- Interdits : formules creuses (« dans un monde où… », « plongez dans… »), conclusions mécaniques (« en résumé »), mots gonflés (crucial, essentiel, incontournable, unique, révolutionnaire, sublimer, magique), tournures « ce n'est pas X, c'est Y » et « non seulement… mais aussi… », tirets cadratins en série.
- Aucune promesse de résultat médical ou miracle. Aucun faux avis, aucun chiffre inventé : si une information manque, laisse un texte générique à compléter.
- Conserve les prix, durées, adresses et coordonnées existants tels quels.`;

/**
 * IA du page builder v2.
 * - mode "section" : réécrit une section selon l'instruction (rapide).
 * - mode "page" : modifie ou crée la page entière.
 * La réponse est normalisée (types inconnus retirés, identifiants posés) :
 * elle est toujours rendable, et l'éditeur permet d'annuler.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ error: "Le module « Génération IA » est désactivé dans les réglages." }, { status: 403 });
  }

  let body: { mode?: string; instruction?: string; section?: unknown; content?: unknown; pageTitle?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const instruction = String(body.instruction || '').trim();
  if (!instruction) return NextResponse.json({ error: 'Décrivez ce que vous voulez obtenir.' }, { status: 400 });
  const mode = body.mode === 'section' ? 'section' : 'page';

  const settings = await getSettingsServer(['site_activity_context', 'site_target_persona', 'site_tone_of_voice', 'business_name']);
  const context = [
    settings.business_name && `Entreprise : ${settings.business_name}`,
    settings.site_activity_context && `Activité : ${settings.site_activity_context}`,
    settings.site_target_persona && `Clientèle : ${settings.site_target_persona}`,
    settings.site_tone_of_voice && `Ton : ${settings.site_tone_of_voice}`,
  ].filter(Boolean).join('\n');

  const system = `Tu es le rédacteur et metteur en page du site d'un institut de beauté. Tu produis uniquement du JSON valide, sans commentaire ni balise Markdown.

${context}

${WRITING_RULES}

FORMAT :
${blocksSchemaForAi()}`;

  const strip = (v: unknown) => JSON.parse(JSON.stringify(v ?? null, (k, val) => (k === 'id' ? undefined : val)));
  const user = mode === 'section'
    ? `Section actuelle :\n${JSON.stringify(strip(body.section), null, 1)}\n\nInstruction : "${instruction}"\n\nRenvoie UNE section (un objet JSON) au même format.`
    : `Titre de la page : ${body.pageTitle || '(sans titre)'}\nPage actuelle :\n${JSON.stringify(strip(body.content), null, 1)}\n\nInstruction : "${instruction}"\n\nRenvoie la page complète : un tableau JSON de sections. Garde les sections qui ne sont pas concernées par l'instruction.`;

  try {
    const res = await callClaude({
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: mode === 'section' ? 4000 : 16000,
      feature: mode === 'section' ? 'blocks-ai-section' : 'blocks-ai-page',
      timeout: mode === 'section' ? 45000 : 120000,
    });
    const text = res.content.map((c) => ('text' in c ? c.text : '')).join('');
    const raw = extractJson(text);
    const content = normalizeContent(mode === 'section' ? (Array.isArray(raw) ? raw.slice(0, 1) : [raw]) : raw);
    if (!content.length) return NextResponse.json({ error: "L'IA n'a pas renvoyé de contenu utilisable. Reformulez la demande." }, { status: 502 });
    return NextResponse.json(mode === 'section' ? { section: content[0] } : { content });
  } catch (err) {
    console.error('[blocks-ai]', err);
    return NextResponse.json({ error: `Erreur IA : ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
