/**
 * IA du page builder v2 (blocs).
 * - mode "section" : réécrit une section selon l'instruction (rapide).
 * - mode "page" : modifie ou crée la page entière (long : jusqu'à 16 000
 *   tokens, au-delà des 60 s d'une fonction Netlify synchrone).
 * La réponse est normalisée (types inconnus retirés, identifiants posés) :
 * elle est toujours rendable, et l'éditeur permet d'annuler.
 *
 * Extrait de la route `/api/admin/blocks-ai` pour être exécutable aussi en
 * tâche de fond (`services/aiJobs`, type `blocks-ai`).
 */
import { callClaude, extractJson } from '../../utils/ai';
import { blocksSchemaForAi } from '../../components/blocks/aiSchema';
import { normalizeContent } from '../../components/blocks/validate';
import { AiTaskError, getSettingsPlain, type AiTaskMode } from './shared';

const WRITING_RULES = `Règles d'écriture :
- Français de Suisse romande, vouvoiement, première personne pour l'esthéticienne (« je vous reçois »).
- Phrases complètes avec un verbe conjugué ; ton chaleureux, concret, sans emphase publicitaire.
- Interdits : formules creuses (« dans un monde où… », « plongez dans… »), conclusions mécaniques (« en résumé »), mots gonflés (crucial, essentiel, incontournable, unique, révolutionnaire, sublimer, magique), tournures « ce n'est pas X, c'est Y » et « non seulement… mais aussi… », tirets cadratins en série.
- Aucune promesse de résultat médical ou miracle. Aucun faux avis, aucun chiffre inventé : si une information manque, laisse un texte générique à compléter.
- Conserve les prix, durées, adresses et coordonnées existants tels quels.`;

export interface BlocksAiInput {
  mode?: string;
  instruction?: string;
  section?: unknown;
  content?: unknown;
  pageTitle?: string;
}

export async function runBlocksAi(body: BlocksAiInput, callMode: AiTaskMode = 'quick') {
  const instruction = String(body.instruction || '').trim();
  if (!instruction) throw new AiTaskError('Décrivez ce que vous voulez obtenir.', 400);
  const mode = body.mode === 'section' ? 'section' : 'page';

  const settings = await getSettingsPlain(['site_activity_context', 'site_target_persona', 'site_tone_of_voice', 'business_name']);
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

  const res = await callClaude({
    system,
    messages: [{ role: 'user', content: user }],
    max_tokens: mode === 'section' ? 4000 : 16000,
    feature: mode === 'section' ? 'blocks-ai-section' : 'blocks-ai-page',
    mode: callMode,
  });
  const text = res.content.map((c) => ('text' in c ? c.text : '')).join('');
  const raw = extractJson(text);
  const content = normalizeContent(mode === 'section' ? (Array.isArray(raw) ? raw.slice(0, 1) : [raw]) : raw);
  if (!content.length) {
    throw new AiTaskError("L'IA n'a pas renvoyé de contenu utilisable. Reformulez la demande.", 502);
  }
  return mode === 'section' ? { section: content[0] } : { content };
}
