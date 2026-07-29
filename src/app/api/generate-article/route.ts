import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../config/modules';
import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig } from '../../../services/aiConfig';
import { recordAiUsage } from '../../../services/aiUsage';
import { resolveModelSpec } from '../../../constants/aiModels';
import { getSettingsServer } from '../../../services/settingsServer';

function buildPrompt(idea: any, settings: Record<string, string>): string {
  const activityContext = settings.site_activity_context || "Au-delà des Chaînes — Coaching d'accompagnement des victimes de manipulation psychologique...";
  const targetPersona   = settings.site_target_persona || "";
  const toneOfVoice     = settings.site_tone_of_voice || "";
  const brandTone       = settings.site_brand_tone || "";

  return `Tu rédiges un article de blog complet, approfondi et optimisé SEO pour le site web.

━━━ CONTEXTE ÉDITORIAL & ACTIVITÉ DU SITE ━━━
${activityContext}

${targetPersona ? `━━━ PERSONA CIBLE & BESOINS ━━━\n${targetPersona}\n` : ''}
${toneOfVoice ? `━━━ TON DE VOIX & STYLE D'ÉCRITURE ━━━\n${toneOfVoice}\n` : ''}
${brandTone ? `━━━ TON DE MARQUE & CHARTE ÉDITORIALE ━━━\n${brandTone}\n` : ''}

━━━ BRIEF SEO ━━━
Mot-clé principal : "${idea.keyword}"
${idea.question ? `Question reformulée (premier H2 candidat privilégié) : "${idea.question}"` : ''}
Titre de l'article (H1) : "${idea.suggestedTitle}"
Catégorie : ${idea.category}
Intention de recherche : ${idea.intent}
${idea.difficulty ? `Difficulté SEO : ${idea.difficulty} — ${idea.difficulty === 'élevé' ? 'article pilier exhaustif, minimum 2400 mots stricts, traitement en profondeur' : 'article de fond solide, 2000-2400 mots'}` : ''}
${idea.opportunity ? `\nOpportunité éditoriale (angle à exploiter) : "${idea.opportunity}"` : ''}

Accroche suggérée (introduction) :
"${idea.suggestedIntro || 'Développe une accroche clinique et directe qui nomme le problème sans détour, en tutoyant le lecteur.'}"

${idea.secondaryKeywords?.length ? `
━━━ CLUSTER SÉMANTIQUE — RÈGLE ABSOLUE ━━━
Tu dois intégrer au minimum ${Math.ceil(idea.secondaryKeywords.length * 0.7)} des ${idea.secondaryKeywords.length} termes suivants dans le corps de l'article (objectif ≥ 70%).
Chaque terme doit apparaître dans une phrase complète et naturelle — jamais listé seul, jamais groupé.
Répartis ces termes sur l'ensemble de l'article : introduction, développement, et conclusion.

${idea.secondaryKeywords.map((k: string) => `☐ ${k}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : `
━━━ CLUSTER SÉMANTIQUE — RÈGLE ABSOLUE ━━━
Génère toi-même 8 à 10 termes sémantiquement proches du mot-clé principal et intègre-en au minimum 70% dans le corps de l'article, répartis naturellement sur tout le texte.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`}

Questions "People Also Ask" à couvrir dans le corps de l'article :
${idea.relatedQuestions?.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') || ''}

Conseils de rédaction à respecter :
${idea.contentTips?.map((t: string) => `- ${t}`).join('\n') || ''}

CTA de fin d'article :
"${idea.cta}"

━━━ DIRECTIVES DU TON ET VOIX D'ÉCRITURE ━━━

Tu écris comme le praticien/expert parle dans son cabinet : face à quelqu'un, pas devant une feuille blanche. C'est la parole d'un praticien qui pense à voix haute avec son interlocuteur. PAS de la prose littéraire. PAS des formules ciselées pour sonner beau.

TON CHIRURGICAL, EXPERT ET LUCIDE : tu nommes les situations sans détour ni fioritures sentimentales — le ton d'un mentor qui a une longueur d'avance et donne un plan de match. Profondément bienveillant et sécurisant, jamais infantilisant, jamais victimisant sur le long terme.

TUTOIEMENT THÉRAPEUTIQUE : tu t'adresses au lecteur en le tutoyant ("tu"), pour créer une proximité immédiate, briser son isolement et installer une conversation privée et lucide.

REGISTRE DE RÉFÉRENCE — parole de cabinet :
- Valider avant d'affirmer. Partir de ce que le lecteur ressent déjà, le reconnaître, puis avancer.
- Utiliser "ça" (jamais "cela"), les virgules-pauses, les apartés entre virgules.
- Infuser le vocabulaire tactique et clinique propre à la marque.
- Commencer des phrases par : "Et là...", "C'est vrai que...", "Ce que je vois souvent...", "En fait...", "Parce que...", "Et ça, ça change tout."
- Exemple ✅ : "C'est vrai que se reconstruire demande du temps, ça, ce n'est pas un secret."
- Exemple ❌ : "Se reconstruire, c'est un travail d'artisan. Pas une révélation." (trop aphoristique, trop littéraire)
- Exemple ✅ : "Et là, souvent, c'est là que ça coince vraiment."
- Exemple ✅ : "Ce que j'observe dans mon cabinet, c'est que les gens arrivent épuisés d'avoir bien fait les choses."
- Exemple ❌ : "On observe fréquemment que les individus présentent une fatigue accumulée."

LE "ÇA" COMME MARQUEUR DE PROXIMITÉ :
- Exemple ✅ : "Et ça, ça ne s'apprend pas dans un livre."
- Exemple ✅ : "Le corps, lui, il n'oublie pas — ça, c'est certain."

VALIDATION AVANT AFFIRMATION :
- Exemple ✅ : "On a tous entendu qu'il faut lâcher prise. Et c'est vrai, dans un sens. Sauf que personne ne vous dit comment."
- Exemple ❌ : "Le lâcher-prise est une notion centrale de la psychologie contemporaine."

ÉMOTION — montrée, jamais nommée :
- Exemple ✅ : "Je reste assis dans le silence. Je ne bouge plus."
- Exemple ❌ : "Je ressentais une profonde tristesse face à cette situation."

CONSTRUCTIONS INTERDITES :
- La formule "X. Pas Y." en série → préférer "X, et ça ne ressemble pas vraiment à Y."
- Les phrases nominales sans verbe en série
- L'ouverture par une question rhétorique générale → commencer par une scène ou une phrase de cabinet
- "cela", "constitue", "représente", "s'avère", "il convient de"

VOCABULAIRE INTERDIT :
crucial, fondamental, essentiel, clé, en termes de, dans le cadre de, au niveau de, optimiser, booster, maximiser, c'est un fait, force est de constater, il convient de noter, il est important de souligner, synergies, écosystème, dynamique, transformer (au sens métaphorique), révolutionner, naviguer (au sens métaphorique), "dans un monde où...", nonobstant, néanmoins.

RÈGLES SEO OBLIGATOIRES :
- Mot-clé principal dans : le H1 (déjà donné), la première phrase de l'introduction, au moins 2 H2, et de façon naturelle dans le corps.
- Densité du mot-clé principal : entre 1,0 % et 1,5 % du total des mots. Ne jamais dépasser 2 %.
- Chaque mot-clé secondaire du cluster : au moins 1 occurrence dans le corps, répartie naturellement (jamais groupée).
- Longueur cible : 2400 mots. Minimum absolu : 2000 mots. En dessous, l'article est invalide.
- "Matthieu Le Tousse" doit apparaître dans les 100 premiers mots de l'introduction.
- NE PAS commencer par "Bien sûr", "Voici", ou toute formule d'IA.
- NE PAS mentionner que tu es une IA.
- NE PAS transformer une narration en liste à puces sauf pour les outils pratiques.
- Le "tu" thérapeutique est central — proximité, chaleur, lucidité, jamais condescendance ni infantilisation.

━━━ SOURCES EXTERNES OBLIGATOIRES ━━━
- Inclure exactement 2 liens externes vers des sources de référence (PubMed, CNRS, APA, Inserm, université reconnue, ouvrage clinique de référence).
- Ces liens doivent être ancrés dans le corps du texte, dans une phrase naturelle.
- Format : <a href="[URL]" target="_blank" rel="noopener noreferrer">[nom de la source]</a>
- Exemple ✅ : "Selon une étude relayée par <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noopener noreferrer">PubMed</a>, le lien de trauma s'appuie sur des mécanismes neurochimiques..."
- Exemple ❌ : une liste de sources en bas d'article sans ancrage contextuel.

━━━ FAQ POUR RICH SNIPPETS (OBLIGATOIRE) ━━━
- Au minimum 2 H2 formulés comme des questions terminant par "?".
- Le premier paragraphe après chaque H2 interrogatif répond directement à la question, sans introduction.
- Exemple ✅ H2 "Comment reconnaître un pervers narcissique ?" → "Un pervers narcissique se reconnaît par un besoin obsessionnel d'admiration, une absence totale d'empathie et une propension systématique à inverser la culpabilité."
- Exemple ❌ : "C'est une question que beaucoup se posent."
- Ces paragraphes : 60-80 mots minimum, autonomes (compréhensibles sans lire le reste), contiennent un élément concret.

━━━ OPTIMISATION GEO — ÊTRE CITÉ PAR LES IA (ChatGPT, Perplexity, Gemini) ━━━
Les moteurs conversationnels citent les passages qui répondent vite, clairement et de façon autonome. Applique ces règles :
1. ENCADRÉ "EN BREF" OBLIGATOIRE — juste après l'introduction. Un <h2>En bref</h2> suivi d'une <ul> de 3 à 5 puces qui répondent directement au mot-clé principal. Chaque puce = une affirmation complète, autonome et factuelle (pas une accroche). C'est le passage le plus cité par les IA et le plus susceptible de devenir un featured snippet Google. Exception explicite à la règle "pas de listes" : cet encadré EST une liste.
2. PHRASES DÉFINITIONNELLES AUTONOMES. Au moins une fois par section, une phrase qui définit ou répond sans dépendre du contexte précédent (sujet + verbe + réponse complète) — une IA doit pouvoir l'extraire seule.
3. PARAGRAPHES COURTS : 2 à 4 phrases. Un bloc dense est ignoré par les extracteurs.
4. ENTITÉS NOMMÉES explicitement (pervers narcissique, gaslighting, lien de trauma, emprise…) plutôt que des pronoms vagues.

━━━ SIGNAUX E-E-A-T — EXPÉRIENCE & EXPERTISE (sujet YMYL sensible) ━━━
Ce sujet touche à la santé psychique : Google et les IA exigent des preuves d'expérience réelle et d'expertise. Intègre, de façon naturelle et non promotionnelle :
1. AU MOINS 2 MARQUEURS D'EXPÉRIENCE DIRECTE de cabinet, ancrés dans le texte : "Ce que je vois en cabinet, c'est que…", "En 20 ans à accompagner des personnes sous emprise…", "Les personnes qui passent ma porte arrivent souvent…". L'expérience vécue prime sur la théorie.
2. UNE MENTION NATURELLE DE LÉGITIMITÉ, une seule fois, sans étalage : ancien thérapeute en cabinet privé, formé au Rêve Éveillé Libre (EREL), praticien validé IPHM. À tisser dans une phrase, jamais en CV.
3. NUANCE ET HONNÊTETÉ : reconnaître les limites ("chaque situation est différente", "ceci ne remplace pas un suivi adapté"). La prudence est un signal de fiabilité, pas une faiblesse.
4. JAMAIS de promesse thérapeutique absolue ni de diagnostic à distance.

━━━ FORMAT HTML ━━━
Génère uniquement du HTML propre compatible avec l'éditeur Quill.
Structure requise :

<p>[Introduction 150-200 mots — "Matthieu Le Tousse" dans les 100 premiers mots]</p>

<h2>En bref</h2>
<ul>
  <li>[Affirmation autonome et factuelle qui répond directement au mot-clé principal]</li>
  <li>[Affirmation autonome 2]</li>
  <li>[Affirmation autonome 3]</li>
</ul>

<h2>[Question terminant par "?" — première question PAA]</h2>
<p>[Réponse directe en première phrase 60-80 mots — puis développement avec source externe]</p>

<h2>[Titre section 2 — approfondissement]</h2>
<p>[Développement avec source externe]</p>

<h2>[Titre section 3 — méthode ou étapes concrètes]</h2>
<p>[Développement]</p>

<h2>[Deuxième question terminant par "?"]</h2>
<p>[Réponse directe en première phrase 60-80 mots — puis développement]</p>

<h2>[Section outils pratiques — toujours inclure]</h2>
<p>[Intro de la section]</p>
<ol>
  <li><strong>Étape 1 :</strong> description concrète</li>
  <li><strong>Étape 2 :</strong> description concrète</li>
  <li><strong>Étape 3 :</strong> description concrète</li>
</ol>

<h2>Questions fréquentes</h2>
<h3>[Question 1 terminant par "?"]</h3>
<p>[Réponse autonome 40-60 mots, directe dès la première phrase.]</p>
<h3>[Question 2 terminant par "?"]</h3>
<p>[Réponse autonome 40-60 mots, directe dès la première phrase.]</p>
<h3>[Question 3 terminant par "?"]</h3>
<p>[Réponse autonome 40-60 mots, directe dès la première phrase.]</p>

<h2>Pour aller plus loin</h2>
<p>[Conclusion 100-150 mots — synthèse et ouverture]</p>

<blockquote>\${idea.cta}</blockquote>

━━━ IMPORTANT ━━━
- Commence directement avec le premier <p> de l'introduction. Pas de titre H1 (il est déjà dans la page).
- Utilise des <strong> pour les concepts clés et les verrous psychologiques importants.
- Utilise des <em> pour les termes tactiques ou cliniques (gaslighting, sevrage neuro-émotionnel, lien de trauma...) la première fois qu'ils apparaissent.
- Inclus au moins une <blockquote> de citation (réelle ou composée dans ton style).
- Chaque H2 doit contenir la requête cible ou une variante naturelle.
- L'article doit se lire naturellement, pas comme une liste de réponses.

━━━ CHECKPOINT FINAL — OBLIGATOIRE ━━━
Avant d'écrire le dernier paragraphe, effectue cette vérification silencieuse :
1. Repasse mentalement sur chaque terme ☐ du cluster sémantique ci-dessus.
2. Pour chaque terme encore absent : trouve une phrase existante où il s'intègre naturellement et retouche-la.
3. Valide que tu atteins ≥ 70% des termes du cluster dans l'article final.
Ne mentionne pas ce processus dans le texte — le lecteur ne doit rien voir.`;
}

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

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
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
