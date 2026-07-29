export const SETTINGS_DEFAULTS: Record<string, string> = {
  // ── Modules (activables/désactivables depuis l'admin) ───
  module_blog_enabled:          'true',
  module_ai_generation_enabled: 'true',
  module_events_enabled:        'true',
  module_newsletter_enabled:    'true',
  module_social_enabled:        'true',

  // ── IA & Budget (admin > Paramètres > IA & Budget) ──────
  // Modèle Claude utilisé par toutes les générations ; voir src/constants/aiModels.ts.
  ai_model:                 'claude-opus-5',
  // Niveau de réflexion : low | medium | high (levier de coût principal).
  ai_effort:                'medium',
  // Budget mensuel indicatif en USD ; '0' désactive l'alerte.
  ai_budget_monthly_usd:    '0',
  // Pourcentage du budget à partir duquel l'admin affiche une alerte.
  ai_budget_alert_percent:  '80',

  // ── Activité, Ligne Éditoriale & Marque (admin > Paramètres > Éditorial & Marque) ──
  site_activity_context: "Emmanuelle Esthétique — Institut de beauté et bien-être à domicile à Palézieux (Vaud, Suisse). Soins du visage doux et naturels, Head Spa, massages relaxants, beauté du regard, ateliers d'auto-soin (Gua Sha, auto-massage, Glowing Face) et bons cadeaux.",
  site_target_persona:      "Femmes de 30 à 60 ans vivant à Palézieux et dans la région (Lavaux-Oron, Broye, Riviera), souvent actives et sollicitées (travail, famille), qui cherchent un vrai moment pour elles. Elles préfèrent un cadre intime et chaleureux aux grandes chaînes d'instituts, sont attentives au naturel des produits et veulent aussi apprendre à prendre soin de leur peau au quotidien. Attentes : douceur, écoute, absence de jugement, discrétion, résultats visibles sur la peau et détente profonde.",
  site_tone_of_voice:        "Voix chaleureuse, douce et posée, comme une esthéticienne qui accueille chez elle. Vouvoiement bienveillant. Phrases courtes et sensorielles (lumière, chaleur, parfum, textures). Jamais de survente ni de promesse miracle : on décrit ce que la cliente va ressentir et ce que le soin apporte concrètement. On rassure celles qui n'osent pas franchir la porte d'un institut.",
  site_brand_tone:           "Promesse centrale : 'Une parenthèse de douceur et de beauté, dans un cocon à domicile à Palézieux.' Vocabulaire privilégié : parenthèse, cocon, douceur, rituel, naturel, sur-mesure, éclat, respiration, bienveillance, prendre soin de soi. Mots à éviter : jargon marketing (booster, optimiser, révolutionnaire), promesses médicales ou anti-âge exagérées, superlatifs creux.",
  site_blog_topics:          "1. Rituels de soin du visage à la maison (routine simple, gestes du quotidien)\n2. Gua Sha & auto-massage (technique, bénéfices, erreurs fréquentes)\n3. Head Spa & détente du cuir chevelu\n4. Cosmétique naturelle (ingrédients, lecture d'étiquettes, choix des produits)\n5. Peau et saisons (adapter sa routine au froid, au soleil, à la fatigue)\n6. Bien-être & prendre du temps pour soi (respiration, sommeil, charge mentale)",

  // ── Coordonnées d'entreprise (admin > Paramètres > Entreprise) ──
  // ⚠️ À remplacer par les vraies coordonnées depuis /admin/settings (onglet
  // Entreprise) avant la mise en ligne : e-mail, téléphone, rue, et surtout
  // `business_price_range` — cette fourchette est une estimation, or elle est
  // publiée telle quelle dans le Schema.org `BeautySalon` (voir app/layout.tsx).
  business_name: 'Emmanuelle Esthétique',
  business_owner: 'Emmanuelle',
  business_email: 'contact@emmanuelle-esthetique.ch',
  business_phone: '',
  business_address_street:  '',
  business_address_postal:  '1607',
  business_address_city: 'Palézieux',
  business_address_region:  'Vaud',
  business_address_country: 'CH',
  business_price_range:     'CHF 60–CHF 180',

  // ── Identité visuelle globale ───────────────────────────
  global_logo:      '',
  favicon_url:      '',

  // ── Footer ──────────────────────────────────────────────
  // Visuel d'ambiance du footer — à remplacer par une photo de l'institut.
  footer_image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=900',
  footer_tagline_line1: 'Prendre soin de vous.',
  footer_tagline_line2: 'Tout simplement.',
  footer_tagline_text:
    "Institut de beauté et bien-être à domicile à Palézieux. Soins du visage, Head Spa, massages et ateliers d'auto-soin, dans un cocon chaleureux.",

  // ── Réseaux sociaux ─────────────────────────────────────
  social_instagram: '',
  social_linkedin: '',
  social_youtube: '',
  social_spotify: '',

  // ── Auteur (blog) ────────────────────────────────────────
  author_bio:  "Emmanuelle est esthéticienne à Palézieux, où elle reçoit dans son institut à domicile. Elle propose des soins du visage doux et naturels, des Head Spa, des massages relaxants et des ateliers pour apprendre à prendre soin de sa peau au quotidien.",
  author_link: '/a-propos',

  navigation_menu: JSON.stringify([
    { name: "Accueil", path: "/" },
    { name: "À propos", path: "/a-propos" },
    { name: "Soins", path: "/soins" },
    { name: "Ateliers", path: "/ateliers" },
    { name: "Bon cadeau", path: "/bon-cadeau" },
    { name: "Contact", path: "/contact" }
  ]),

  // Cible du bouton d'action principal de la navbar ("Prendre rendez-vous").
  // À remplacer par l'URL du module de réservation (Fresha, SimplyBook,
  // Calendly…) dès qu'il est ouvert.
  header_register_link: '/contact',
};

// Keys whose values are image URLs — passed through proxyUrl on overrides
export const IMAGE_KEYS = new Set([
  'global_logo',
  'footer_logo',
  'footer_image',
  'favicon_url',
]);

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;

