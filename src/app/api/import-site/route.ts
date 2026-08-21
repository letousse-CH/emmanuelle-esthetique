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
 * Cette séparation compte : si le résultat déçoit, on sait immédiatement si le
 * problème vient de ce qu'on a lu ou de la façon dont on l'a interprété. Et
 * l'extraction reste consultable même sans clé d'API.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { validateSupabaseToken } from '../../../utils/apiAuth';
import { fetchPublicPage, UnsafeUrlError } from '../../../utils/safeFetch';
import { extractSite, toPromptDigest } from '../../../services/siteExtract';
import { callClaude } from '../../../utils/ai';
import {
  SECTION_META,
  type SectionTypeName,
} from '../../../components/pagebuilder/sectionMeta';
import { getAnthropicKey } from '../../../services/secrets';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawUrl = String(body?.url ?? '').trim();
  const mode = body?.mode === 'extract' ? 'extract' : 'full';

  if (!rawUrl) {
    return NextResponse.json({ error: 'Adresse manquante.' }, { status: 400 });
  }

  // ── 1 & 2. Récupération puis extraction ──────────────────────────────────
  let site;
  try {
    const page = await fetchPublicPage(rawUrl);
    site = extractSite(page.html, page.url);
  } catch (error) {
    const message =
      error instanceof UnsafeUrlError ? error.message : "Impossible de lire ce site.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Un site trop pauvre ne produira rien d'exploitable : autant le dire tout
  // de suite plutôt que de facturer un appel au modèle pour du vide.
  if (site.headings.length === 0 && site.paragraphs.length === 0) {
    return NextResponse.json(
      {
        error:
          "Ce site n'expose presque aucun texte — il est probablement construit entièrement en JavaScript. L'import automatique ne peut rien en tirer.",
        extracted: site,
      },
      { status: 422 },
    );
  }

  if (mode === 'extract') {
    return NextResponse.json({ extracted: site });
  }

  // ── 3. Cartographie vers les sections ────────────────────────────────────
  const apiKey = await getAnthropicKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Aucune clé Anthropic configurée — seule l’extraction est disponible.', extracted: site },
      { status: 503 },
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
      max_tokens: 8000,
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
      return NextResponse.json(
        { error: "La réponse du modèle n'était pas exploitable. Réessayez.", extracted: site },
        { status: 502 },
      );
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
      return NextResponse.json(
        { error: "Aucune section exploitable n'a pu être construite.", extracted: site },
        { status: 502 },
      );
    }

    return NextResponse.json({
      pageTitle: parsed.pageTitle || site.title || site.domain,
      summary: parsed.summary ?? '',
      sections,
      extracted: site,
    });
  } catch (error) {
    // Le message de `callClaude` est explicite (clé invalide, quota, refus) :
    // le masquer derrière « échec » rendrait le diagnostic impossible.
    console.error('[import-site]', error);
    return NextResponse.json(
      { error: (error as Error).message || 'La reconstruction a échoué.', extracted: site },
      { status: 502 },
    );
  }
}
