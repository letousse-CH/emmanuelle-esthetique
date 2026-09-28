/**
 * Reconstruction d'une page à partir d'un site existant.
 *
 * Trois étapes nettement séparées :
 *
 *  1. **Récupération** — bornée et protégée contre le SSRF (`safeFetch`).
 *  2. **Extraction** — déterministe, gratuite, vérifiable (`siteExtract`).
 *  3. **Cartographie** — la seule étape qui appelle le modèle : elle range la
 *     matière extraite dans les sections disponibles.
 *
 * Extrait de la route `/api/import-site` pour être exécutable aussi en tâche
 * de fond (`services/aiJobs`, type `import-site`).
 */
import { fetchPublicPage, UnsafeUrlError } from '../../utils/safeFetch';
import { extractSite, toPromptDigest, type ExtractedSite } from '../siteExtract';
import { callClaude } from '../../utils/ai';
import { SECTION_META, type SectionTypeName } from '../../components/pagebuilder/sectionMeta';
import { getAnthropicKey } from '../secrets';
import { AiTaskError, type AiTaskMode } from './shared';

/** Sections proposables au modèle, avec ce qu'elles savent recevoir. */
function sectionMenu(): string {
  return (Object.keys(SECTION_META) as SectionTypeName[])
    .map((type) => {
      const meta = SECTION_META[type];
      // Les réglages d'apparence ne sont pas proposés au modèle : ils relèvent
      // du design system, pas du contenu repris sur le site d'origine.
      const fields = Object.keys(meta.dataSchema).filter(
        (f) => !['theme', 'bg_image', 'bg_image_opacity', 'bg_image_position', 'bg_color'].includes(f),
      );
      return `- ${type} : ${meta.description}\n  champs : ${fields.join(', ')}`;
    })
    .join('\n');
}

/** Étapes 1 et 2 : récupération puis extraction. Lève une AiTaskError 422. */
export async function fetchAndExtractSite(rawUrl: string): Promise<ExtractedSite> {
  if (!rawUrl) throw new AiTaskError('Adresse manquante.', 400);

  let site: ExtractedSite;
  try {
    const page = await fetchPublicPage(rawUrl);
    site = extractSite(page.html, page.url);
  } catch (error) {
    const message =
      error instanceof UnsafeUrlError ? error.message : "Impossible de lire ce site.";
    throw new AiTaskError(message, 422);
  }

  // Un site trop pauvre ne produira rien d'exploitable : autant le dire tout
  // de suite plutôt que de facturer un appel au modèle pour du vide.
  if (site.headings.length === 0 && site.paragraphs.length === 0) {
    throw new AiTaskError(
      "Ce site n'expose presque aucun texte — il est probablement construit entièrement en JavaScript. L'import automatique ne peut rien en tirer.",
      422,
      { extracted: site },
    );
  }
  return site;
}

/** Étape 3 : cartographie vers les sections. */
export async function mapSiteToSections(site: ExtractedSite, mode: AiTaskMode = 'quick') {
  const apiKey = await getAnthropicKey();
  if (!apiKey) {
    throw new AiTaskError(
      'Aucune clé Anthropic configurée — seule l’extraction est disponible.',
      503,
      { extracted: site },
    );
  }

  const system = `Tu reconstruis la page d'accueil d'une entreprise à partir du contenu de son site actuel.

Sections disponibles :
${sectionMenu()}

Règles :
— N'utilise QUE les textes fournis. Tu peux les raccourcir, les reformuler pour la lisibilité, corriger la ponctuation. Tu n'inventes ni prestation, ni chiffre, ni témoignage, ni prix qui ne figure pas dans la source.
— Si une information manque pour un champ, laisse-le vide plutôt que de le combler.
— Commence par un hero, termine par un appel à l'action.
— Six à neuf sections. Alterne "theme": "dark" toutes les deux ou trois sections pour découper la page.
— Le premier titre doit dire ce que fait l'entreprise et pour qui, pas un slogan creux.

Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"pageTitle": "...", "summary": "une phrase sur ce que fait cette entreprise", "sections": [{"type": "hero_1", "data": {...}}]}`;

  try {
    /*
      Passage par `callClaude` plutôt qu'un appel direct au SDK : c'est lui qui
      sait quels paramètres chaque génération de modèle accepte. Un appel écrit
      à la main envoyait `temperature`, désormais refusé par Opus 5 et
      Sonnet 5 — et l'import échouait sur chaque page.
    */
    const completion = await callClaude({
      system,
      mode,
      // En synchrone (mode quick), budget réduit pour tenir sous 60 s.
      max_tokens: mode === 'long' ? 8000 : 3500,
      feature: 'import_site',
      messages: [{ role: 'user', content: toPromptDigest(site) }],
    });

    const text = completion.content.map((block) => block.text).join('').trim();

    // Le modèle encadre parfois sa réponse malgré la consigne.
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
    let parsed: { pageTitle?: string; summary?: string; sections?: unknown };
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new AiTaskError("La réponse du modèle n'était pas exploitable. Réessayez.", 502, { extracted: site });
    }

    // On ne fait jamais confiance aux types renvoyés : une section inconnue
    // ferait planter l'aperçu du constructeur.
    const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
      .filter(
        (s): s is { type: SectionTypeName; data: Record<string, unknown> } =>
          !!s &&
          typeof s === 'object' &&
          typeof (s as { type?: unknown }).type === 'string' &&
          (s as { type: string }).type in SECTION_META,
      )
      .map((s) => ({ type: s.type, data: s.data ?? {} }));

    if (sections.length === 0) {
      throw new AiTaskError("Aucune section exploitable n'a pu être construite.", 502, { extracted: site });
    }

    return {
      pageTitle: parsed.pageTitle || site.title || site.domain,
      summary: parsed.summary ?? '',
      sections,
      extracted: site,
    };
  } catch (error) {
    if (error instanceof AiTaskError) throw error;
    // Le message de `callClaude` est explicite (clé invalide, quota, refus) :
    // le masquer derrière « échec » rendrait le diagnostic impossible.
    console.error('[import-site]', error);
    throw new AiTaskError(
      (error as Error).message || 'La reconstruction a échoué.',
      502,
      { extracted: site },
    );
  }
}

/** Import complet (récupération, extraction, cartographie) : type de tâche `import-site`. */
export async function importSite(input: { url?: unknown }, mode: AiTaskMode = 'long') {
  const site = await fetchAndExtractSite(String(input?.url ?? '').trim());
  return mapSiteToSections(site, mode);
}
