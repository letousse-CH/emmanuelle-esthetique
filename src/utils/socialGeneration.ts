/**
 * Génération de contenu réseaux sociaux (Instagram carrousel + Stories 9:16,
 * Facebook, Google Business Profile local, LinkedIn) à partir d'un article,
 * d'un brief de suggestion, d'une entrée RSS ou de l'Assistant Beauté IA.
 *
 * Logique partagée entre la route interactive (/api/generate-social),
 * l'assistant social (/api/social-assistant) et l'automatisation en tâche de
 * fond (cron + déclenchement manuel), pour ne maintenir qu'un seul prompt et
 * un seul contrat de sortie 100 % rétrocompatible.
 */
import { callClaude, extractJson } from './ai';
import { getSettingsServer } from '../services/settingsServer';
import { getAnthropicKey } from '../services/secrets';

export type SocialVisualTheme = 'creme' | 'marin' | 'sauge' | 'photo' | 'citation';

export interface SocialSlide {
  number: number;
  text: string;
  highlight?: string;
}

export interface SocialCaption {
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
}

/** Slide de Story verticale 9:16 (séquence de 3 stories prêtes à télécharger). */
export interface SocialStorySlide {
  number: number;
  label: string;
  text: string;
  highlight?: string;
  cta?: string;
}

/** Texte du visuel unique (LinkedIn / Facebook / Google Business). */
export interface SocialVisual {
  text: string;
  highlight?: string;
}

/** Fiche Google Business Profile locale (Palézieux-Gare / Oron / Châtel-St-Denis). */
export interface SocialGoogleBusiness {
  title: string;
  post: string;
  cta_label: string;
  cta_url: string;
  visual?: SocialVisual;
}

export interface SocialGenerationResult {
  pillar?: string;
  theme?: SocialVisualTheme;
  instagram: {
    slides: SocialSlide[];
    caption: SocialCaption;
    hook_variants?: string[];
    stories?: SocialStorySlide[];
  };
  facebook: {
    post: string;
    visual?: SocialVisual;
  };
  google_business?: SocialGoogleBusiness;
  linkedin: {
    hook_variants: string[];
    post: string;
    hashtags?: string;
    visual?: SocialVisual;
  };
}

/**
 * Repli éditorial complet et fidèle à Emmanuelle Esthétique (https://emmanuelle-esthetique.ch/)
 * utilisé lorsque les réglages en base (`settings`) ne sont pas encore renseignés.
 */
export const EMMANUELLE_FALLBACK_DNA = {
  business_name: 'Emmanuelle Esthétique',
  business_owner: 'Emmanuelle Le Tousse',
  business_address_street: 'Chemin de la Marouette 19 (quartier de la Gare)',
  business_address_postal: '1607',
  business_address_city: 'Palézieux-Gare',
  business_phone: '+41 78 823 66 12',
  site_activity_context:
    "Emmanuelle Esthétique est un institut de beauté et de bien-être intimiste en cabine privée à Palézieux-Gare (Chemin de la Marouette 19 / secteur Route de la Gare, 1607 Palézieux, canton de Vaud, Suisse), à 2 minutes à pied de la gare CFF de Palézieux avec place de parking gratuite devant l'institut. Fondé par Emmanuelle, esthéticienne diplômée avec plus de 20 ans d'expérience, l'institut accueille les femmes sur rendez-vous du lundi au samedi dans un cocon calme, loin de l'agitation des grandes enseignes, au carrefour d'Oron, Châtel-St-Denis, Chexbres, Lavaux, Romont, Bulle et la Haute-Broye.",
  site_target_persona:
    "Femmes de Palézieux-Gare, Palézieux-Village, Oron-la-Ville, Châtel-St-Denis, Chexbres, Puidoux, Vevey, Bulle et de la Broye vaudoise/fribourgeoise (25 à 65+ ans) qui cherchent une parenthèse de douceur authentique, des soins du visage aux résultats visibles sans procédures invasives, un moment pour souffler et lâcher prise, et une esthéticienne de confiance qui prend vraiment le temps sans jamais forcer la vente.",
  site_tone_of_voice:
    "Chaleureux, apaisant, expert, sensoriel et bienveillant. Vouvoiement systématique. Français de Suisse romande naturel (tarifs exclusivement en CHF, jamais en €). Vocabulaire sensoriel lié à la mer, aux embruns, à la chaleur des serviettes, au toucher manuel et au calme du cocon. Jamais de jargon agressif, ni d'injonctions culpabilisantes, ni de promesses médicales miraculeuses.",
  site_brand_tone:
    "Spécialités & Carte des soins (tarifs en CHF) :\n" +
    "1. Soins du visage Phytomer (actifs marins naturels, oligo-éléments, algues bretonnes) : Soin Peau Nette & Coup d'Éclat Express (40 min, CHF 90), Soin Visage Signature Phytomer (60 min, CHF 130), Soin Hydra Originel désaltérant & repulpant (60 min, CHF 140), Soin Peau Sensible apaisant (75 min, CHF 150), Soin Expert Jeunesse / Anti-âge & manœuvres liftantes (75-90 min, CHF 165-170). Options Privilèges : Boue Marine Auto-Chauffante sur le dos (+CHF 30), Massage du cuir chevelu & nuque (+CHF 25).\n" +
    "2. Massages & Rituels du corps : Head Spa massage crânien japonais du cuir chevelu, nuque et trapèzes (30 min CHF 70 / 45 min CHF 95), Massage relaxant aux huiles chaudes (60 min CHF 120 / 90 min CHF 165), Grand Massage Relaxant Marine Signature Spa (60 min CHF 145 / 90 min CHF 210), Soin Voile de Satin gommage aux cristaux de sels marins (45 min CHF 110), Soin Bulles des Mers détox du dos à la boue marine (45 min CHF 110), Rituel Échappée Belle Visage & Corps (1h45, CHF 230).\n" +
    "3. Épilation douce à la cire, au fil et à la pâte de sucre orientale 100 % naturelle : Sourcils (CHF 22), Lèvre (CHF 15), Visage complet (CHF 45), Aisselles (CHF 22), Demi-jambes (CHF 42), Jambes complètes (CHF 68), Maillot oriental à la pâte de sucre (CHF 55), Forfait Douceur (Demi-jambes + aisselles + maillot au choix, CHF 95), Forfait Intégral (Jambes complètes + aisselles + maillot au choix, CHF 125).\n" +
    "4. Beauté du regard : Mise en forme des sourcils sur-mesure (30 min, CHF 35), Teinture végétale cils & sourcils (dès CHF 30, combo CHF 60), Rehaussement de cils / Lash Lift avec soin kératine (60 min, CHF 85 / avec teinture CHF 105), Cours de maquillage individuel sur-mesure (1h30, CHF 110).\n" +
    "5. Manucure, beauté des pieds, Ateliers d'auto-soin en petit comité (Gua Sha, Glowing Face) et Bons cadeaux personnalisés (valables 60 mois, paiement TWINT, espèces ou carte).",
  site_blog_topics:
    "1. Rituels marins Phytomer & santé de la peau au fil des saisons en Suisse romande (hydratation, éclat, barrière cutanée, sensibilité, anti-âge manuel).\n" +
    "2. Lâcher-prise, sommeil et détente nerveuse par le toucher (Head Spa crânien, boue marine auto-chauffante, massage aux huiles chaudes).\n" +
    "3. Gestes beauté doux et durables (épilation orientale au sucre pour peaux sensibles, rehaussement de cils naturel, auto-massage Gua Sha à la maison).\n" +
    "4. Vie locale à Palézieux-Gare, Oron et Châtel-St-Denis : s'offrir une pause accessible à 2 min du train, idées de bons cadeaux bien-être.",
};

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const SYSTEM_PROMPT = `Règles de rédaction pour Emmanuelle Esthétique à Palézieux-Gare (le contexte de marque est fourni plus haut). Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

═══ VOIX — RÈGLES NON NÉGOCIABLES ═══
- Vouvoiement systématique, sans exception, sur tous les formats.
- Ton chaleureux, apaisant, sensoriel, expert et bienveillant, ancré en Suisse romande (Palézieux-Gare, canton de Vaud ; tarifs toujours en CHF, jamais en €).
- Narrateur direct (Emmanuelle dans sa cabine à Palézieux-Gare) : scènes concrètes et sensorielles (la chaleur d'une serviette, le crépitement de la boue marine Phytomer sur le dos, le silence de la cabine à 2 minutes de la gare), jamais de généralités abstraites en ouverture.
- L'émotion se montre par le fait, la sensation cutanée ou le geste, jamais par un adjectif abstrait ("crucial", "essentiel", "profondément", "un vecteur de", "dans un monde où...").
- Rythme alterné : phrases courtes qui claquent + phrases longues qui respirent. Jamais 3 phrases de suite de même longueur.
- Interdits : listes à puces qui remplacent une vraie phrase, jargon corporate (synergie, écosystème, optimiser, booster), "3 leçons que j'ai apprises", "Unpopular opinion:", "Agree or disagree?".

═══ MÉTHODE DE HOOK (C.L.A.C.) — pour la 1ère ligne / 1er slide ═══
Contexte (territoire mental ou sensation concrète en une phrase) → Lean In (bénéfice, tiraillement, fatigue ou croyance partagée) → Arrêt (rupture douce avec "mais / sauf que / ce qu'on oublie souvent") → Contredirection (angle éclairant d'esthéticienne).
Fournis également 3 variantes de phrases d'accroche dans "instagram.hook_variants" pour qu'Emmanuelle puisse choisir son angle préféré en un clic.

═══ PILIER & THÈME VISUEL (à déterminer selon le sujet fourni) ═══
- "pillar" :
  - "Reconnaître" (la lectrice se reconnaît dans une sensation ou un moment du quotidien) → CTA de fin : question douce ou invitation à enregistrer le post.
  - "Comprendre" (un mécanisme de la peau, un actif marin Phytomer ou un geste expliqué simplement) → CTA de fin : mention discrète du soin correspondant à l'institut de Palézieux-Gare.
  - "Passer à l'action" → CTA de fin : invitation chaleureuse à réserver son créneau ou son bon cadeau (lien en bio / /reservation / /contact).
- "theme" (thème visuel recommandé pour le Studio Holo) :
  - "marin" : soins visage/corps Phytomer, hydratation, actifs marins, oligo-éléments, boue marine.
  - "sauge" : massages relaxants, Head Spa crânien, lâcher-prise, détente nerveuse, saisonnalité.
  - "creme" : épilation douce/sucre, conseils routine maison, douceur peaux sensibles, accueil cocon.
  - "photo" : beauté du regard (rehaussement de cils, sourcils), mise en avant cabine ou offre du moment.
  - "citation" : réflexion d'experte, philosophie du soin sans jugement, mot d'Emmanuelle.

═══ INSTAGRAM — CARROUSEL (8 à 10 slides) + CAPTION + 3 STORIES 9:16 ═══
1. Carrousel ("slides", 8 à 10 slides) :
   - Structure fixe : Slide 1 = hook (2 lignes max, texte seul) · Slide 2 = ouverture de la boucle · Slides 3 à 7/8 = une seule idée par slide, micro-récompense sensorielle ou conseil concret qui donne envie de swiper · avant-dernière slide = bascule qui referme la boucle · dernière slide = CTA calibré par pilier (avec mention discrète de Palézieux-Gare si pertinent).
   - Maximum 25-30 mots par slide. Pour chaque slide, identifie 2 à 4 mots consécutifs qui portent le twist de la phrase (le "highlight") — ils doivent être un extrait EXACT du texte de la slide.
2. Caption ("caption") : hook, body, cta, hashtags (12 à 18 hashtags pertinents en français et locaux : #EmmanuelleEsthetique #Palezieux #PalezieuxGare #Oron #ChatelStDenis #PhytomerSuisse #SoinVisageVaud #InstitutBeauteVaud etc.).
3. Variantes de hook ("hook_variants") : tableau de 3 phrases d'accroche alternatives courtes et percutantes pour la slide 1.
4. Stories verticales 9:16 ("stories", exactement 3 slides séquentielles) :
   - Story 1 (number: 1, label: "Accroche & Ambiance") : phrase courte immersive qui capte l'attention en story (15-25 mots max), avec "highlight" (2-4 mots exacts).
   - Story 2 (number: 2, label: "Le Cœur du Soin / Conseil") : le secret beauté, le geste en cabine ou le bénéfice concret du soin Phytomer / massage / regard (20-30 mots max), avec "highlight".
   - Story 3 (number: 3, label: "Invitation & Rendez-vous") : phrase chaleureuse d'invitation à l'institut de Palézieux-Gare + champ "cta" court pour le sticker de lien (ex: "Réserver votre créneau à Palézieux-Gare →").

═══ FACEBOOK — POST & VISUEL ═══
Reprends la substance de la caption Instagram en l'adaptant aux clientes locales sur Facebook (ton proche, chaleureux, lisible directement sans jargon, 2 à 4 hashtags maximum). Fournis "visual" : { "text": "... (12 à 20 mots max)", "highlight": "... (2 à 4 mots exacts)" }.

═══ GOOGLE BUSINESS PROFILE — FICHE LOCALE PALÉZIEUX-GARE ═══
Génère "google_business" pour la fiche Google d'Emmanuelle Esthétique :
- "title" : Titre clair et localisé (ex: "Soin du visage Phytomer à Palézieux-Gare" ou "Votre pause Head Spa près d'Oron et Châtel-St-Denis").
- "post" : Texte chaleureux et informatif de 80 à 140 mots, optimisé pour le référencement local (mention naturelle de Palézieux-Gare, de la proximité d'Oron / Châtel-St-Denis / Haute-Broye, de l'accès à 2 minutes à pied de la gare CFF ou de la place de parking gratuite devant l'institut). Aucun hashtag sur Google Business.
- "cta_label" : "Réserver en ligne" ou "Prendre rendez-vous" ou "Découvrir l'offre".
- "cta_url" : "/reservation" ou "/contact".
- "visual" : { "text": "...", "highlight": "..." } (accroche courte pour le visuel Google).

═══ LINKEDIN — POST & VISUEL ═══
3 variantes de hook ("hook_variants") + "post" complet (regard d'artisane esthéticienne depuis plus de 20 ans sur le bien-être, le soin manuel, l'écoute des femmes actives en Suisse romande) + "hashtags" (0 à 2 max) + "visual" : { "text": "...", "highlight": "..." }.

═══ FORMAT DE SORTIE (JSON strict) ═══
{
  "pillar": "Reconnaître" | "Comprendre" | "Passer à l'action",
  "theme": "creme" | "marin" | "sauge" | "photo" | "citation",
  "instagram": {
    "hook_variants": ["...", "...", "..."],
    "slides": [ { "number": 1, "text": "...", "highlight": "..." } ],
    "caption": { "hook": "...", "body": "...", "cta": "...", "hashtags": "#... #..." },
    "stories": [
      { "number": 1, "label": "Accroche & Ambiance", "text": "...", "highlight": "..." },
      { "number": 2, "label": "Le Cœur du Soin", "text": "...", "highlight": "..." },
      { "number": 3, "label": "Invitation & Rendez-vous", "text": "...", "highlight": "...", "cta": "Réserver à Palézieux-Gare →" }
    ]
  },
  "facebook": {
    "post": "...",
    "visual": { "text": "...", "highlight": "..." }
  },
  "google_business": {
    "title": "...",
    "post": "...",
    "cta_label": "Prendre rendez-vous",
    "cta_url": "/reservation",
    "visual": { "text": "...", "highlight": "..." }
  },
  "linkedin": {
    "hook_variants": ["...", "...", "..."],
    "post": "...",
    "hashtags": "",
    "visual": { "text": "...", "highlight": "..." }
  }
}`;

export interface SocialGenerationInput {
  title: string;
  /** Contenu complet (article existant, HTML ou texte) — prioritaire sur `intro`. */
  content?: string;
  /** Brief court (suggestion non encore rédigée, ou résumé de flux RSS). */
  intro?: string;
  keyword?: string;
  /** Instructions spécifiques ou demande libre d'Emmanuelle. */
  customInstruction?: string;
  /** Thème visuel souhaité ('creme' | 'marin' | 'sauge' | 'photo' | 'citation'). */
  preferredTheme?: string;
  /** Pilier éditorial souhaité ('Reconnaître' | 'Comprendre' | "Passer à l'action"). */
  preferredPillar?: string;
}

const VALID_THEMES: SocialVisualTheme[] = ['creme', 'marin', 'sauge', 'photo', 'citation'];

/**
 * Appelle l'IA et retourne le contenu structuré pour Instagram (Carrousel + Stories),
 * Facebook, Google Business Profile et LinkedIn.
 * Lève une erreur si la clé API est absente ou si la réponse IA est incomplète.
 */
export async function generateSocialContent(input: SocialGenerationInput): Promise<SocialGenerationResult> {
  const apiKey = await getAnthropicKey();
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    throw new Error('not_configured');
  }

  const title = input.title.trim();
  const content = (input.content || '').trim();
  const intro = (input.intro || '').trim();
  const keyword = (input.keyword || '').trim();
  const customInstruction = (input.customInstruction || '').trim();
  const preferredTheme = (input.preferredTheme || '').trim();
  const preferredPillar = (input.preferredPillar || '').trim();

  if (!title) throw new Error('Le titre est obligatoire.');
  if (!content && !intro && !customInstruction) {
    throw new Error('Un contenu ou une accroche est nécessaire.');
  }

  const material = content
    ? stripHtml(content).slice(0, 6000)
    : `${intro || customInstruction || title}\n\n(Base-toi sur ce sujet, les soins réels d'Emmanuelle Esthétique à Palézieux-Gare et la charte de marque pour développer un contenu incarné, sensoriel et exact.)`;

  const preferencesBlock = [
    preferredPillar ? `Pilier éditorial demandé : "${preferredPillar}"` : '',
    preferredTheme ? `Thème visuel demandé : "${preferredTheme}"` : '',
    customInstruction ? `Consigne particulière d'Emmanuelle : "${customInstruction}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `Titre / Sujet : "${title}"
${keyword ? `Mot-clé principal : ${keyword}\n` : ''}${preferencesBlock ? `${preferencesBlock}\n` : ''}
Matière source :
"""
${material}
"""

Génère le JSON complet demandé pour ce contenu (Instagram carrousel 8-10 slides + 3 hook_variants + 3 stories 9:16, Facebook, Google Business Profile Palézieux-Gare, LinkedIn).`;

  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  const activityContext = settings.site_activity_context?.trim() || EMMANUELLE_FALLBACK_DNA.site_activity_context;
  const targetPersona   = settings.site_target_persona?.trim()   || EMMANUELLE_FALLBACK_DNA.site_target_persona;
  const toneOfVoice     = settings.site_tone_of_voice?.trim()     || EMMANUELLE_FALLBACK_DNA.site_tone_of_voice;
  const brandTone       = settings.site_brand_tone?.trim()        || EMMANUELLE_FALLBACK_DNA.site_brand_tone;
  const blogTopics      = settings.site_blog_topics?.trim()       || EMMANUELLE_FALLBACK_DNA.site_blog_topics;

  const dynamicSystemPrompt = `Tu écris pour Emmanuelle Esthétique (https://emmanuelle-esthetique.ch/), institut de beauté et bien-être à Palézieux-Gare (Vaud, Suisse). Réponds UNIQUEMENT avec un objet JSON valide, aucun texte avant/après, pas de markdown.

━━━ CONTEXTE ÉDITORIAL & ACTIVITÉ ━━━
${activityContext}

━━━ PERSONA CIBLE ━━━
${targetPersona}

━━━ CHARTE DE MARQUE & CARTE DES SOINS ━━━
${brandTone}

━━━ TON DE VOIX ━━━
${toneOfVoice}

━━━ PILIERS ÉDITORIAUX ━━━
${blogTopics}

${SYSTEM_PROMPT}`;

  const response = await callClaude({
    feature: 'social',
    max_tokens: 5500,
    system: dynamicSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  const parsed = extractJson(raw);

  if (!parsed?.instagram?.slides || !parsed?.linkedin?.post || !parsed?.facebook?.post) {
    console.error('[socialGeneration] Réponse IA incomplète:', raw);
    throw new Error('Réponse IA incomplète, réessayez.');
  }

  // Normalisation défensive pour garantir une rétrocompatibilité et des valeurs propres
  const rawTheme = String(parsed.theme || preferredTheme || 'creme').toLowerCase() as SocialVisualTheme;
  const theme: SocialVisualTheme = VALID_THEMES.includes(rawTheme) ? rawTheme : 'creme';
  const pillar = String(parsed.pillar || preferredPillar || 'Reconnaître').trim();

  const firstSlideText = parsed.instagram.slides[0]?.text || title;
  const hookVariants: string[] = Array.isArray(parsed.instagram.hook_variants) && parsed.instagram.hook_variants.length > 0
    ? parsed.instagram.hook_variants.map((h: unknown) => String(h || '').trim()).filter(Boolean)
    : [
        firstSlideText,
        parsed.instagram.caption?.hook || firstSlideText,
        `À Palézieux-Gare, prenez enfin une heure rien que pour vous : ${title.toLowerCase()}.`,
      ];

  const stories: SocialStorySlide[] = Array.isArray(parsed.instagram.stories) && parsed.instagram.stories.length > 0
    ? parsed.instagram.stories.map((s: any, idx: number) => ({
        number: Number(s?.number) || idx + 1,
        label: String(s?.label || (idx === 0 ? 'Accroche & Ambiance' : idx === 1 ? 'Le Cœur du Soin' : 'Invitation & RDV')).trim(),
        text: String(s?.text || '').trim(),
        highlight: s?.highlight ? String(s.highlight).trim() : undefined,
        cta: s?.cta ? String(s.cta).trim() : idx === 2 ? 'Réserver à Palézieux-Gare →' : undefined,
      }))
    : [
        {
          number: 1,
          label: 'Accroche & Ambiance',
          text: firstSlideText,
          highlight: parsed.instagram.slides[0]?.highlight,
        },
        {
          number: 2,
          label: 'Le Cœur du Soin',
          text: parsed.instagram.slides[1]?.text || parsed.instagram.caption?.hook || '',
          highlight: parsed.instagram.slides[1]?.highlight,
        },
        {
          number: 3,
          label: 'Invitation & Rendez-vous',
          text: parsed.instagram.caption?.cta || 'Je vous accueille sur rendez-vous dans mon cocon à 2 minutes de la gare de Palézieux.',
          cta: 'Réserver à Palézieux-Gare →',
        },
      ];

  const googleBusiness: SocialGoogleBusiness = parsed.google_business && typeof parsed.google_business.post === 'string'
    ? {
        title: String(parsed.google_business.title || title).trim(),
        post: String(parsed.google_business.post).trim(),
        cta_label: String(parsed.google_business.cta_label || 'Prendre rendez-vous').trim(),
        cta_url: String(parsed.google_business.cta_url || '/reservation').trim(),
        visual: parsed.google_business.visual || parsed.facebook.visual || {
          text: firstSlideText,
          highlight: parsed.instagram.slides[0]?.highlight,
        },
      }
    : {
        title: `${title} · Institut à Palézieux-Gare`,
        post: `${parsed.instagram.caption?.hook || ''} ${parsed.instagram.caption?.body || ''}\n\nJe vous accueille sur rendez-vous dans mon institut à Palézieux-Gare (à 2 minutes à pied de la gare CFF, parking gratuit devant l'institut, proche d'Oron et Châtel-St-Denis).`.trim(),
        cta_label: 'Prendre rendez-vous',
        cta_url: '/reservation',
        visual: parsed.facebook.visual || {
          text: firstSlideText,
          highlight: parsed.instagram.slides[0]?.highlight,
        },
      };

  return {
    pillar,
    theme,
    instagram: {
      slides: parsed.instagram.slides,
      caption: parsed.instagram.caption,
      hook_variants: hookVariants,
      stories,
    },
    facebook: parsed.facebook,
    google_business: googleBusiness,
    linkedin: parsed.linkedin,
  };
}
