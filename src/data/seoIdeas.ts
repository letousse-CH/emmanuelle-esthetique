/**
 * Base de données d'idées d'articles SEO pour Matthieu Le Tousse,
 * Coach Relation Toxique & Pervers Narcissique (audeladeschaines.com).
 * Requêtes réelles tapées sur Google + stratégie de contenu (entonnoir TOFU/MOFU/BOFU).
 *
 * Les 6 catégories couvrent le parcours de la persona (25-45 ans), de la prise de
 * conscience brute à la reconstruction totale, en s'appuyant sur l'Arsenal Tactique.
 */

export type SeoCategory =
  | 'Profils toxiques'      // Décodage clinique des PN, manipulateurs, structures psychotiques
  | 'Brouillard mental'     // Gaslighting, inversion de culpabilité, confusion, dissonance
  | 'Trauma & addiction'    // Sevrage neuro-émotionnel, lien de trauma, dépendance affective
  | 'Protocole de défense'  // Communication de crise, limites fermes, rupture sécurisée
  | 'Sphère familiale'      // Parent toxique, hérédité de la manipulation, enfants
  | 'Reconstruction';       // Reconstruction identitaire post-trauma, estime, immunisation

export type Difficulty = 'faible' | 'moyen' | 'élevé';
export type Volume     = 'faible' | 'moyen' | 'élevé';
export type Intent     = 'informationnel' | 'transactionnel' | 'navigationnel';

export interface SeoIdea {
  id: string;
  category: SeoCategory;
  keyword: string;           // Requête exacte que les gens tapent
  question: string;          // Reformulation question
  difficulty: Difficulty;    // Difficulté SEO estimée
  volume: Volume;            // Volume de recherche estimé
  intent: Intent;
  suggestedTitle: string;    // Titre H1 recommandé (mot-clé dans les 4 premiers mots)
  suggestedSlug: string;     // URL optimisée
  suggestedIntro: string;    // Accroche d'introduction suggérée (Problème / Empathie / Solution)
  relatedQuestions: string[];// "People Also Ask" de Google
  secondaryKeywords?: string[];// Cluster sémantique — variations et termes associés
  contentTips: string[];     // Conseils de rédaction
  cta: string;               // CTA de fin d'article (vers l'Arsenal Tactique / entretien stratégique)
  opportunity: string;       // Pourquoi cette requête est intéressante
}

export const seoIdeas: SeoIdea[] = [

  // ─── PROFILS TOXIQUES ──────────────────────────────────────────────────────

  {
    id: 'profil-001',
    category: 'Profils toxiques',
    keyword: 'comment reconnaître un pervers narcissique',
    question: 'Comment reconnaître un pervers narcissique au quotidien ?',
    difficulty: 'élevé',
    volume: 'élevé',
    intent: 'informationnel',
    suggestedTitle: 'Reconnaître un pervers narcissique : 9 signes qui ne trompent pas',
    suggestedSlug: 'reconnaitre-pervers-narcissique-signes',
    suggestedIntro: 'Tu sens que quelque chose cloche, mais tu n\'arrives pas à mettre un mot dessus. C\'est exactement ce que recherche un pervers narcissique : te garder dans le flou. Voici les signes cliniques qui permettent de nommer ce que tu vis.',
    relatedQuestions: [
      'Quels sont les premiers signes d\'un pervers narcissique ?',
      'Comment se comporte un pervers narcissique en couple ?',
      'Un pervers narcissique sait-il qu\'il manipule ?',
      'Quelle est la différence entre narcissique et pervers narcissique ?',
    ],
    secondaryKeywords: [
      'perversion narcissique', 'absence d\'empathie', 'manipulateur destructeur',
      'besoin d\'admiration', 'structure perverse', 'bourreau psychologique',
      'profil toxique', 'vampire énergétique', 'manipulation psychologique',
    ],
    contentTips: [
      'Lister 9 signes cliniques concrets et observables (pas de généralités)',
      'Distinguer narcissisme ordinaire et perversion narcissique structurée',
      'Réponse directe en première phrase après le H2 interrogatif (rich snippet)',
      'Insérer un exemple de cas impersonnel ("Prenons une situation fréquente...")',
      'Article pilier — viser 2400 mots',
    ],
    cta: 'Mettre un mot sur ce que tu vis est la première étape. Activer une contre-stratégie est la seconde. Postule pour ton entretien stratégique privé.',
    opportunity: 'Requête pilier à très fort volume et forte intention. Article fondamental qui capte la persona au moment de l\'éveil et alimente tout le maillage interne.',
  },

  {
    id: 'profil-002',
    category: 'Profils toxiques',
    keyword: 'différence narcissique et pervers narcissique',
    question: 'Quelle est la différence entre un narcissique et un pervers narcissique ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Narcissique ou pervers narcissique : la différence qui change tout',
    suggestedSlug: 'difference-narcissique-pervers-narcissique',
    suggestedIntro: 'On utilise "narcissique" à toutes les sauces. Mais entre une personne imbue d\'elle-même et un pervers narcissique structuré, l\'écart est immense — et il détermine ta stratégie de défense. Voici comment les distinguer.',
    relatedQuestions: [
      'Un narcissique peut-il changer ?',
      'Le pervers narcissique a-t-il conscience du mal qu\'il fait ?',
      'Trouble de la personnalité narcissique : c\'est quoi ?',
      'Peut-on aimer un narcissique sans danger ?',
    ],
    secondaryKeywords: [
      'trouble personnalité narcissique', 'personnalité complexe', 'structure psychotique',
      'narcissisme pathologique', 'absence d\'empathie', 'manipulateur',
      'perversion narcissique', 'profil clinique',
    ],
    contentTips: [
      'Tableau comparatif clair narcissique / pervers narcissique',
      'Citer une source clinique reconnue (APA, DSM-5) pour le GEO',
      'Expliquer pourquoi la distinction change la contre-stratégie',
      'Ne pas diaboliser — rester chirurgical et lucide',
    ],
    cta: 'Comprendre à qui tu as affaire est décisif. Mon Arsenal Tactique t\'apprend à adapter ta défense au profil exact. Découvre comment.',
    opportunity: 'Requête de clarification très recherchée. Positionne le site comme référence clinique et désamorce la confusion sémantique de la persona.',
  },

  {
    id: 'profil-003',
    category: 'Profils toxiques',
    keyword: 'love bombing c\'est quoi',
    question: 'C\'est quoi le love bombing et pourquoi c\'est dangereux ?',
    difficulty: 'faible',
    volume: 'élevé',
    intent: 'informationnel',
    suggestedTitle: 'Love bombing : la phase de séduction qui cache un piège',
    suggestedSlug: 'love-bombing-definition-piege',
    suggestedIntro: 'Au début, c\'était trop beau. Des messages constants, des déclarations rapides, le sentiment d\'avoir trouvé l\'âme sœur. Et si cette intensité n\'était pas de l\'amour, mais la première phase d\'une stratégie d\'emprise ?',
    relatedQuestions: [
      'Combien de temps dure le love bombing ?',
      'Comment reconnaître le love bombing au début d\'une relation ?',
      'Que se passe-t-il après le love bombing ?',
      'Le love bombing est-il toujours intentionnel ?',
    ],
    secondaryKeywords: [
      'phase de séduction', 'stratégie d\'emprise', 'cycle de la manipulation',
      'idéalisation dévalorisation', 'bombardement amoureux', 'manipulation affective',
      'début relation toxique',
    ],
    contentTips: [
      'Décrire le cycle idéalisation → dévalorisation → rejet',
      'Donner des exemples concrets de messages/comportements love bombing',
      'Expliquer le mécanisme neurochimique de l\'attachement précoce',
      'Lier vers l\'article sevrage neuro-émotionnel',
    ],
    cta: 'Si tu reconnais ce cycle, tu n\'es pas naïf(ve) — tu as été ciblé(e). Apprends à désamorcer l\'emprise dès maintenant avec l\'Arsenal Tactique.',
    opportunity: 'Terme anglophone à fort volume et faible concurrence en français. Excellente porte d\'entrée TOFU pour une audience large.',
  },

  // ─── BROUILLARD MENTAL ─────────────────────────────────────────────────────

  {
    id: 'brouillard-001',
    category: 'Brouillard mental',
    keyword: 'c\'est quoi le gaslighting',
    question: 'C\'est quoi le gaslighting et comment le repérer ?',
    difficulty: 'moyen',
    volume: 'élevé',
    intent: 'informationnel',
    suggestedTitle: 'Gaslighting : 5 exemples de manipulation qui te font douter de toi',
    suggestedSlug: 'gaslighting-exemples-manipulation',
    suggestedIntro: 'Tu te demandes parfois si tu n\'inventes pas tout, si tu n\'exagères pas. Ce doute permanent sur ta propre réalité porte un nom : le gaslighting. C\'est le cœur du brouillard mental — et ça se déconstruit.',
    relatedQuestions: [
      'Quelles sont les phrases typiques d\'un gaslighter ?',
      'Comment sortir du gaslighting ?',
      'Le gaslighting est-il volontaire ?',
      'Quels sont les effets du gaslighting sur le cerveau ?',
    ],
    secondaryKeywords: [
      'gaslighting france', 'distorsion de la réalité', 'confusion mentale couple',
      'perdre confiance en ses souvenirs', 'dissonance cognitive amoureuse',
      'manipulation psychologique', 'brouillard mental', 'douter de sa réalité',
    ],
    contentTips: [
      '5 exemples concrets de phrases de gaslighting décortiquées',
      'Réponse autonome de 60-80 mots après le H2 interrogatif (snippet)',
      'Expliquer l\'effet du gaslighting sur la mémoire et la confiance en soi',
      'Citer une source (étude psychologique reconnue) pour le GEO',
    ],
    cta: 'Le simple fait de chercher ce mot prouve que ta réalité est valide. Reprends le contrôle : découvre le module "Sortir du brouillard" de l\'Arsenal Tactique.',
    opportunity: 'Mot-clé "éveil" à très fort volume. La persona tape ses symptômes pour savoir si elle devient folle — conversion émotionnelle élevée.',
  },

  {
    id: 'brouillard-002',
    category: 'Brouillard mental',
    keyword: 'inversion de la culpabilité manipulateur',
    question: 'Pourquoi le manipulateur se fait-il passer pour la victime ?',
    difficulty: 'faible',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Inversion de la culpabilité : quand le bourreau joue la victime',
    suggestedSlug: 'inversion-culpabilite-manipulateur',
    suggestedIntro: 'À chaque conflit, tu finis par t\'excuser — même quand c\'est lui qui a blessé. Ce renversement n\'est pas un hasard. C\'est une technique précise : l\'inversion de la culpabilité. Voici comment elle fonctionne et comment l\'arrêter.',
    relatedQuestions: [
      'Comment répondre à l\'inversion de la culpabilité ?',
      'Pourquoi je me sens toujours coupable dans ma relation ?',
      'Qu\'est-ce que le retournement de victime ?',
      'Le manipulateur croit-il vraiment être la victime ?',
    ],
    secondaryKeywords: [
      'inversion des rôles', 'culpabilisation morbide', 'retournement de victime',
      'projection psychologique', 'victimisation manipulateur', 'chantage affectif',
      'se sentir coupable couple', 'DARVO',
    ],
    contentTips: [
      'Décrire le mécanisme DARVO (déni, attaque, inversion victime-agresseur)',
      'Démontrer cliniquement que se poser la question prouve l\'innocence',
      'Donner une contre-réponse concrète et actionnable',
      'Exemple de dialogue type pour illustrer',
    ],
    cta: 'Tu n\'es pas le problème — tu es la cible d\'un mécanisme. Apprends à le neutraliser avec le protocole de défense de l\'Arsenal Tactique.',
    opportunity: 'Levier direct sur l\'objection n°1 de la persona ("le problème vient peut-être de moi"). Article à très forte charge émotionnelle et conversion.',
  },

  {
    id: 'brouillard-003',
    category: 'Brouillard mental',
    keyword: 'marcher sur des œufs relation',
    question: 'Pourquoi j\'ai l\'impression de marcher sur des œufs en permanence ?',
    difficulty: 'faible',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Marcher sur des œufs : le signe d\'une relation sous contrôle',
    suggestedSlug: 'marcher-sur-des-oeufs-relation-toxique',
    suggestedIntro: 'Tu calcules chaque mot, chaque geste, pour éviter la prochaine crise. Cet état d\'alerte permanent t\'épuise sans que tu saches vraiment pourquoi. Le syndrome de la marche sur des œufs est un signal clinique — pas une hypersensibilité.',
    relatedQuestions: [
      'Pourquoi je suis tendu(e) en permanence avec mon conjoint ?',
      'L\'hypervigilance est-elle un signe de relation toxique ?',
      'Comment arrêter d\'avoir peur de la réaction de l\'autre ?',
      'Marcher sur des œufs : est-ce du contrôle coercitif ?',
    ],
    secondaryKeywords: [
      'syndrome de la marche sur des œufs', 'hypervigilance constante',
      'épuisement psychologique', 'contrôle coercitif', 'peur de la crise',
      'tension permanente couple', 'anticiper les réactions', 'climat anxiogène',
    ],
    contentTips: [
      'Relier l\'hypervigilance au système nerveux (biologie du stress, cortisol)',
      'Distinguer hypersensibilité et réponse adaptative à un danger réel',
      'Donner 3 signaux corporels concrets de l\'épuisement',
      'Valider l\'expérience sans victimiser sur le long terme',
    ],
    cta: 'Cet épuisement n\'est pas dans ta tête : ton corps réagit à un danger réel. Apprends à rétablir ta sécurité intérieure avec l\'Arsenal Tactique.',
    opportunity: 'Symptôme TOFU très recherché et peu nommé cliniquement en français. Capte la persona avant même qu\'elle identifie la manipulation.',
  },

  // ─── TRAUMA & ADDICTION ────────────────────────────────────────────────────

  {
    id: 'trauma-001',
    category: 'Trauma & addiction',
    keyword: 'pourquoi je n\'arrive pas à quitter une relation toxique',
    question: 'Pourquoi je n\'arrive pas à quitter alors que je souffre ?',
    difficulty: 'moyen',
    volume: 'élevé',
    intent: 'informationnel',
    suggestedTitle: 'Pourquoi le cerveau s\'attache au bourreau : le lien de trauma',
    suggestedSlug: 'lien-de-trauma-cerveau-attache-bourreau',
    suggestedIntro: 'Tu sais qu\'il faut partir. Tu l\'as dit cent fois. Et pourtant tu restes, ou tu reviens. Ce n\'est pas de la faiblesse — c\'est de la neurobiologie. Le lien de trauma transforme la souffrance en addiction chimique.',
    relatedQuestions: [
      'Qu\'est-ce que le lien de trauma (trauma bonding) ?',
      'Pourquoi le manque ressemble-t-il à un sevrage de drogue ?',
      'Comment briser une dépendance affective ?',
      'Le cortisol joue-t-il un rôle dans l\'attachement toxique ?',
    ],
    secondaryKeywords: [
      'addiction affective', 'dépendance neurobiologique couple', 'cortisol et emprise',
      'traumatisme relationnel', 'hormone du stress rupture', 'lien de trauma',
      'sevrage neuro-émotionnel', 'attachement toxique', 'dépendance affective',
    ],
    contentTips: [
      'Expliquer le prisme neurobiologique (dopamine, cortisol, ocytocine)',
      'Valider l\'impuissance sans culpabiliser — c\'est chimique',
      'Citer une source scientifique (PubMed, étude sur le trauma bonding) pour le GEO',
      'Introduire le sevrage neuro-émotionnel comme solution méthodique',
    ],
    cta: 'Le manque est une réaction chimique, pas un signe d\'amour. Le module "Sevrage neuro-émotionnel" de l\'Arsenal Tactique le nettoie méthodiquement. Découvre comment.',
    opportunity: 'Requête à très fort volume et forte douleur. Le prisme neurobiologique est un angle différenciant et déculpabilisant unique sur le marché.',
  },

  {
    id: 'trauma-002',
    category: 'Trauma & addiction',
    keyword: 'sevrage émotionnel après rupture toxique',
    question: 'Comment gérer le manque après une rupture toxique ?',
    difficulty: 'faible',
    volume: 'moyen',
    intent: 'transactionnel',
    suggestedTitle: 'Sevrage neuro-émotionnel : briser l\'addiction à ton ex toxique',
    suggestedSlug: 'sevrage-neuro-emotionnel-rupture-toxique',
    suggestedIntro: 'Tu as coupé les ponts, et pourtant le manque te dévore comme une descente. Cette douleur physique n\'est pas une rechute sentimentale : c\'est un sevrage. Et comme tout sevrage, il se traverse avec une méthode.',
    relatedQuestions: [
      'Combien de temps dure le sevrage après une relation toxique ?',
      'Pourquoi je pense à mon ex toxique tout le temps ?',
      'Comment résister à l\'envie de reprendre contact ?',
      'Le sevrage émotionnel est-il physique ?',
    ],
    secondaryKeywords: [
      'sevrage neuro-émotionnel', 'manque après rupture', 'addiction affective',
      'couper les ponts en sécurité', 'rechute relationnelle', 'no contact',
      'dépendance neurobiologique couple', 'reprendre le contrôle de sa vie',
    ],
    contentTips: [
      'Présenter le sevrage en étapes concrètes (liste numérotée actionnable)',
      'Aborder la peur de la rechute sous l\'angle biologique et rassurant',
      'Donner des outils anti-reprise de contact immédiats',
      'Forte intention transactionnelle — ancrage de conversion appuyé',
    ],
    cta: 'Traverser le sevrage seul(e) est risqué. Le programme nettoie le manque étape par étape. Active ton Arsenal Tactique : postule pour ton entretien stratégique.',
    opportunity: 'Forte intention d\'aide et de conversion. La persona en phase de rupture est prête à agir — article BOFU à fort taux de conversion.',
  },

  {
    id: 'trauma-003',
    category: 'Trauma & addiction',
    keyword: 'stress post traumatique après relation toxique',
    question: 'Peut-on avoir un stress post-traumatique après une relation ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Stress post-traumatique amoureux : reconnaître les symptômes',
    suggestedSlug: 'stress-post-traumatique-relation-toxique',
    suggestedIntro: 'Flashbacks, sursauts, cauchemars, impossibilité de faire confiance à nouveau. Tu as quitté la relation mais elle continue de te hanter. Le trauma post-relationnel est réel — et il se soigne.',
    relatedQuestions: [
      'Quels sont les symptômes du SSPT après une relation toxique ?',
      'Combien de temps pour se remettre psychologiquement ?',
      'Le trauma relationnel s\'inscrit-il dans le corps ?',
      'Faut-il un accompagnement pour le stress post-traumatique amoureux ?',
    ],
    secondaryKeywords: [
      'SSPT complexe', 'trauma post-relationnel', 'hypervigilance constante',
      'flashbacks relation toxique', 'trauma dans le corps', 'guérir le trauma',
      'reconstruction post-traumatique', 'mémoire traumatique',
    ],
    contentTips: [
      'Distinguer SSPT classique et SSPT complexe (relation prolongée)',
      'Lister les symptômes concrets et reconnaissables',
      'Expliquer que le trauma vit dans le corps, pas seulement la tête',
      'Citer une source clinique reconnue pour le GEO',
    ],
    cta: 'Le trauma post-relationnel n\'est pas une fatalité. Le module "Reconstruction" t\'aide à le traiter en profondeur. Découvre l\'Arsenal Tactique.',
    opportunity: 'Sujet en croissance, angle clinique crédibilisant. Relie naturellement la douleur présente à l\'offre de reconstruction.',
  },

  // ─── PROTOCOLE DE DÉFENSE ──────────────────────────────────────────────────

  {
    id: 'defense-001',
    category: 'Protocole de défense',
    keyword: 'comment répondre à un pervers narcissique',
    question: 'Comment répondre à un pervers narcissique sans alimenter le conflit ?',
    difficulty: 'moyen',
    volume: 'élevé',
    intent: 'informationnel',
    suggestedTitle: 'Comment répondre à un pervers narcissique : scripts de défense',
    suggestedSlug: 'comment-repondre-pervers-narcissique-scripts',
    suggestedIntro: 'Chaque échange devient un piège : si tu réponds, tu nourris le conflit ; si tu te tais, ça empire. Il existe une troisième voie, faite de phrases précises qui neutralisent la manipulation. Voici tes scripts de communication de crise.',
    relatedQuestions: [
      'Que dire pour désarmer un manipulateur ?',
      'Faut-il ignorer un pervers narcissique ?',
      'Comment garder son calme face à la provocation ?',
      'Quelles phrases éviter avec un pervers narcissique ?',
    ],
    secondaryKeywords: [
      'contre-communication', 'scripts de crise', 'neutraliser un manipulateur',
      'indifférence communicationnelle', 'réponse grise', 'désamorcer le conflit',
      'poser des limites fermes', 'communication de crise',
    ],
    contentTips: [
      'Fournir des scripts concrets et copiables (liste actionnable)',
      'Expliquer pourquoi la neutralité émotionnelle désarme le manipulateur',
      'Donner des exemples de dialogues avant/après',
      'Relier au module "Protocole de défense" de l\'Arsenal Tactique',
    ],
    cta: 'Ces scripts sont un avant-goût. Le protocole de défense complet te donne une réponse pour chaque situation. Active ton Arsenal Tactique.',
    opportunity: 'Requête à forte intention pratique. Vise les personnes encore dans la relation cherchant des clés de survie immédiates — fort potentiel de partage.',
  },

  {
    id: 'defense-002',
    category: 'Protocole de défense',
    keyword: 'méthode de la roche grise',
    question: 'Qu\'est-ce que la méthode de la roche grise (grey rock) ?',
    difficulty: 'faible',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Méthode de la roche grise : devenir inintéressant pour un toxique',
    suggestedSlug: 'methode-roche-grise-grey-rock',
    suggestedIntro: 'Un manipulateur se nourrit de tes réactions. Et s\'il n\'y avait plus rien à manger ? La méthode de la roche grise consiste à devenir aussi terne et prévisible qu\'un caillou — pour qu\'il se détourne de toi. Voici comment l\'appliquer.',
    relatedQuestions: [
      'Comment appliquer la technique grey rock au quotidien ?',
      'La roche grise fonctionne-t-elle avec un pervers narcissique ?',
      'Quels sont les risques de la méthode de la roche grise ?',
      'Roche grise ou no contact : que choisir ?',
    ],
    secondaryKeywords: [
      'grey rock', 'technique roche grise', 'indifférence communicationnelle',
      'neutraliser un manipulateur', 'se protéger d\'un profil psychotique',
      'contact obligatoire toxique', 'no contact', 'protocole de défense',
    ],
    contentTips: [
      'Décrire la méthode en étapes concrètes et applicables',
      'Préciser les cas d\'usage (co-parentalité, collègue, contact forcé)',
      'Avertir des limites et risques (escalade possible)',
      'Distinguer roche grise et no contact total',
    ],
    cta: 'La roche grise est une arme parmi d\'autres. L\'Arsenal Tactique t\'apprend à choisir la bonne défense selon le contexte. Découvre le programme.',
    opportunity: 'Technique très recherchée, faible concurrence francophone de qualité. Excellent contenu MOFU qui démontre l\'expertise terrain.',
  },

  {
    id: 'defense-003',
    category: 'Protocole de défense',
    keyword: 'comment couper les ponts avec un pervers narcissique',
    question: 'Comment couper les ponts avec un pervers narcissique en sécurité ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'transactionnel',
    suggestedTitle: 'Couper les ponts avec un pervers narcissique sans danger',
    suggestedSlug: 'couper-les-ponts-pervers-narcissique-securite',
    suggestedIntro: 'Partir, ce n\'est pas claquer la porte sur un coup de tête. Face à un profil toxique, une rupture mal préparée peut tout aggraver. La sortie se planifie comme une opération — méthodiquement, en sécurité. Voici la logistique.',
    relatedQuestions: [
      'Comment quitter un pervers narcissique sans représailles ?',
      'Faut-il prévenir un manipulateur qu\'on le quitte ?',
      'Comment se protéger juridiquement d\'un ex toxique ?',
      'Quelle est la réaction d\'un pervers narcissique abandonné ?',
    ],
    secondaryKeywords: [
      'couper les ponts en sécurité', 'rupture sécurisée', 'no contact',
      'logistique de rupture', 'se protéger d\'un ex toxique', 'plan de sortie',
      'représailles manipulateur', 'poser des verrous émotionnels',
    ],
    contentTips: [
      'Présenter un plan de sortie en étapes (liste numérotée)',
      'Aborder la peur de ne pas avoir la force (levier biologique)',
      'Inclure la dimension logistique et sécuritaire concrète',
      'Forte intention — ancrage de conversion vers l\'entretien stratégique',
    ],
    cta: 'Une rupture sécurisée se prépare. Si tu es prêt(e) à organiser ta sortie, postule pour ton entretien stratégique privé et active ton Arsenal Tactique.',
    opportunity: 'Requête BOFU à forte intention d\'action. La persona prête à partir cherche un accompagnement structuré — conversion élevée.',
  },

  // ─── SPHÈRE FAMILIALE ──────────────────────────────────────────────────────

  {
    id: 'famille-001',
    category: 'Sphère familiale',
    keyword: 'grandir avec un parent toxique conséquences',
    question: 'Quelles conséquences à l\'âge adulte quand on a grandi avec un parent toxique ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Grandir avec un parent toxique : l\'impact sur tes relations adultes',
    suggestedSlug: 'grandir-parent-toxique-consequences-adultes',
    suggestedIntro: 'Tu réalises, des années plus tard, que ce que tu vivais comme "normal" ne l\'était pas. Grandir avec un parent toxique ou psychotique laisse des empreintes précises — qui expliquent souvent pourquoi tu attires les mêmes profils aujourd\'hui.',
    relatedQuestions: [
      'Comment un parent manipulateur affecte-t-il l\'enfant devenu adulte ?',
      'Pourquoi je reproduis les schémas de mon enfance ?',
      'Qu\'est-ce qu\'un parent pervers narcissique ?',
      'Peut-on guérir d\'une enfance avec un parent toxique ?',
    ],
    secondaryKeywords: [
      'parent toxique famille', 'enfant de pervers narcissique', 'répétition des schémas relationnels',
      'structure psychotique hérédité', 'parent dysfonctionnel', 'guérir son enfant intérieur',
      'reprogrammer ses schémas inconscients', 'loyauté familiale toxique',
    ],
    contentTips: [
      'Relier l\'enfance aux schémas relationnels adultes (angle terrain unique)',
      'Expliquer la répétition inconsciente sans culpabiliser',
      'Mobiliser ton expertise terrain (immersion familles complexes)',
      'Introduire le module "Immunisation" comme voie de sortie',
    ],
    cta: 'Comprendre l\'origine de tes schémas, c\'est pouvoir les reprogrammer. Le module "Immunisation" de l\'Arsenal Tactique t\'y conduit. Découvre comment.',
    opportunity: 'Sujet ultra-porteur et moins concurrentiel. Angle d\'expertise terrain unique de Matthieu — fort potentiel d\'autorité.',
  },

  {
    id: 'famille-002',
    category: 'Sphère familiale',
    keyword: 'protéger ses enfants d\'un parent manipulateur divorce',
    question: 'Comment protéger ses enfants d\'un parent manipulateur après un divorce ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Protéger ses enfants d\'un parent manipulateur après le divorce',
    suggestedSlug: 'proteger-enfants-parent-manipulateur-divorce',
    suggestedIntro: 'Le divorce est prononcé, mais le danger n\'est pas écarté : il reste co-parent. Comment empêcher qu\'il instrumentalise les enfants, sans les mettre au milieu du conflit ? Voici une stratégie de protection concrète.',
    relatedQuestions: [
      'Qu\'est-ce que l\'aliénation parentale ?',
      'Comment réagir si mon ex manipule nos enfants ?',
      'Co-parentalité avec un pervers narcissique : est-ce possible ?',
      'Comment parler aux enfants sans dénigrer l\'autre parent ?',
    ],
    secondaryKeywords: [
      'aliénation parentale', 'co-parentalité toxique', 'instrumentalisation des enfants',
      'parent manipulateur divorce', 'protéger ses enfants', 'communication parentale crise',
      'pension émotionnelle', 'rupture sécurisée famille',
    ],
    contentTips: [
      'Donner une stratégie de protection en étapes concrètes',
      'Aborder l\'aliénation parentale avec lucidité',
      'Appliquer le protocole de défense à la co-parentalité',
      'Rester factuel, éviter le registre vengeur',
    ],
    cta: 'Protéger tes enfants demande une stratégie, pas seulement de l\'amour. L\'Arsenal Tactique t\'aide à la bâtir. Postule pour ton entretien stratégique.',
    opportunity: 'Niche émotionnellement forte (parents protecteurs) et peu couverte avec rigueur. Public très engagé et reconnaissant.',
  },

  // ─── RECONSTRUCTION ────────────────────────────────────────────────────────

  {
    id: 'reconstruction-001',
    category: 'Reconstruction',
    keyword: 'se reconstruire après une relation toxique',
    question: 'Comment se reconstruire après une relation toxique ?',
    difficulty: 'élevé',
    volume: 'élevé',
    intent: 'transactionnel',
    suggestedTitle: 'Se reconstruire après une relation toxique : les 3 étapes clés',
    suggestedSlug: 'se-reconstruire-apres-relation-toxique',
    suggestedIntro: 'La relation est finie, mais tu te sens vidé(e) de ta substance, sans savoir qui tu es en dehors d\'elle. Se reconstruire n\'est pas un retour à l\'avant — c\'est bâtir une identité plus solide. Voici les 3 étapes pour y arriver.',
    relatedQuestions: [
      'Combien de temps pour se reconstruire après un pervers narcissique ?',
      'Comment retrouver confiance en soi après une relation toxique ?',
      'Comment ne plus attirer les profils toxiques ?',
      'Par où commencer pour se reconstruire ?',
    ],
    secondaryKeywords: [
      'estime de soi détruite', 'retrouver sa souveraineté', 'immunisation relationnelle',
      'reprogrammer ses schémas inconscients', 'reprendre le contrôle de sa vie',
      'reconstruction identitaire', 'guérir trauma amoureux', 'perte d\'identité',
    ],
    contentTips: [
      'Structurer en 3 étapes claires (lucidité → sevrage → reconstruction)',
      'Mot-clé principal dans les 4 premiers mots du H1',
      'Relier chaque étape à un module de l\'Arsenal Tactique',
      'Article pilier transactionnel — viser 2400 mots, ancrage de conversion fort',
    ],
    cta: 'Se reconstruire seul(e) est long et incertain. L\'Arsenal Tactique en fait une feuille de route. Si tu es prêt(e), postule pour ton entretien stratégique privé.',
    opportunity: 'Requête pilier à très fort volume et forte intention. Transition parfaite vers le programme — un des meilleurs articles de conversion du site.',
  },

  {
    id: 'reconstruction-002',
    category: 'Reconstruction',
    keyword: 'retrouver confiance en soi après manipulation',
    question: 'Comment retrouver confiance en soi après une manipulation ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Retrouver confiance en soi après un pervers narcissique',
    suggestedSlug: 'retrouver-confiance-en-soi-apres-manipulation',
    suggestedIntro: 'Des mois de dévalorisation subtile ont fini par te convaincre que tu ne valais rien. Cette voix dans ta tête qui te rabaisse n\'est pas la tienne — c\'est la sienne. La reconquête de ton estime commence par la débrancher.',
    relatedQuestions: [
      'Pourquoi ai-je perdu toute confiance en moi dans cette relation ?',
      'Comment faire taire la voix critique intériorisée ?',
      'Combien de temps pour retrouver son estime de soi ?',
      'Quels exercices pour reconstruire sa confiance ?',
    ],
    secondaryKeywords: [
      'estime de soi détruite', 'dévalorisation subtile', 'reconstruire sa confiance',
      'voix critique intériorisée', 'perte d\'identité', 'reprendre le contrôle de sa vie',
      'guérir son enfant intérieur', 'souveraineté personnelle',
    ],
    contentTips: [
      'Expliquer le mécanisme de la dévalorisation intériorisée',
      'Donner des exercices concrets et actionnables (liste)',
      'Distinguer la voix du manipulateur de sa propre voix',
      'Ton bienveillant mais sans victimisation longue durée',
    ],
    cta: 'Reconstruire ton estime, ça s\'apprend méthodiquement. Le module "Reconstruction" de l\'Arsenal Tactique t\'accompagne pas à pas. Découvre-le.',
    opportunity: 'Requête à forte charge émotionnelle, étape naturelle après la rupture. Bon pont vers le programme de reconstruction.',
  },

  {
    id: 'reconstruction-003',
    category: 'Reconstruction',
    keyword: 'comment ne plus attirer les personnes toxiques',
    question: 'Comment faire pour ne plus attirer de personnes toxiques ?',
    difficulty: 'moyen',
    volume: 'moyen',
    intent: 'informationnel',
    suggestedTitle: 'Ne plus attirer les personnes toxiques : s\'immuniser durablement',
    suggestedSlug: 'ne-plus-attirer-personnes-toxiques-immunisation',
    suggestedIntro: 'Tu te demandes si tu portes une pancarte invisible : encore et encore, les mêmes profils te trouvent. Ce n\'est pas de la malchance, c\'est un schéma inconscient. Et un schéma, ça se reprogramme. Voici comment t\'immuniser.',
    relatedQuestions: [
      'Pourquoi j\'attire toujours le même type de personne toxique ?',
      'Comment reconnaître un manipulateur dès le début ?',
      'Qu\'est-ce que l\'immunisation relationnelle ?',
      'Peut-on vraiment changer ses schémas amoureux ?',
    ],
    secondaryKeywords: [
      'immunisation relationnelle', 'répétition des schémas relationnels',
      'reprogrammer ses schémas inconscients', 'reconnaître un manipulateur',
      'poser des verrous émotionnels', 'red flags relation', 'patterns relationnels',
      'guérir son enfant intérieur',
    ],
    contentTips: [
      'Expliquer la répétition des schémas (lien avec l\'enfance)',
      'Lister les red flags à repérer dès les premières semaines',
      'Présenter l\'immunisation comme reprogrammation concrète',
      'Boucler le parcours : de la victime au statut souverain',
    ],
    cta: 'S\'immuniser, c\'est ne plus jamais revivre ça. Le module "Immunisation" clôture l\'Arsenal Tactique. Découvre le programme complet.',
    opportunity: 'Requête de fin de parcours, forte valeur de fidélisation. Démontre la promesse d\'immunisation définitive et boucle l\'entonnoir.',
  },
];

export const CATEGORIES: SeoCategory[] = [
  'Profils toxiques',
  'Brouillard mental',
  'Trauma & addiction',
  'Protocole de défense',
  'Sphère familiale',
  'Reconstruction',
];

export const CATEGORY_COLORS: Record<SeoCategory, string> = {
  'Profils toxiques':     'bg-purple-50 text-purple-700 border-purple-200',
  'Brouillard mental':    'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Trauma & addiction':   'bg-orange-50 text-orange-700 border-orange-200',
  'Protocole de défense': 'bg-sage/10 text-sage border-sage/30',
  'Sphère familiale':     'bg-amber-50 text-amber-700 border-amber-200',
  'Reconstruction':       'bg-teal-50 text-teal-700 border-teal-200',
};

export const CATEGORY_EMOJIS: Record<SeoCategory, string> = {
  'Profils toxiques':     '🎭',
  'Brouillard mental':    '🌫️',
  'Trauma & addiction':   '🧠',
  'Protocole de défense': '🛡️',
  'Sphère familiale':     '👥',
  'Reconstruction':       '🌅',
};
