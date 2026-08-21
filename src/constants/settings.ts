export const SETTINGS_DEFAULTS: Record<string, string> = {
  // ── Modules (activables/désactivables depuis l'admin) ───
  module_blog_enabled:          'true',
  module_ai_generation_enabled: 'true',
  module_events_enabled:        'true',
  module_newsletter_enabled:    'true',
  module_social_enabled:        'true',
  module_caisse_enabled:        'true',
  module_keywords_enabled:      'true',
  module_agents_enabled:        'true',
  module_automations_enabled:   'true',

  // ── Caisse & facturation (admin > Paramètres > Caisse) ──
  // Taux de TVA appliqué par défaut aux nouvelles prestations. '0' tant que
  // l'activité n'est pas assujettie (LTVA art. 10 : seuil de CHF 100'000 de
  // chiffre d'affaires annuel). Le jour du passage à 8.1 %, changer ce réglage
  // suffit : le taux est stocké ligne par ligne, donc les factures déjà émises
  // gardent le leur.
  caisse_tva_assujetti:   'false',
  caisse_tva_taux_defaut: '0',
  // N° TVA suisse (format CHE-123.456.789 TVA) — obligatoire sur les factures
  // dès l'assujettissement (OTVA art. 26).
  caisse_tva_numero:      '',
  // IBAN affiché sur la facture lorsque le paiement est un virement.
  caisse_iban:            '',
  // Mention libre en pied de facture (conditions, remerciement…).
  caisse_facture_mentions: 'Merci de votre confiance et à bientôt.',

  // Durée de validité des bons cadeaux, en mois. Aucun minimum n'est fixé par
  // le droit suisse : un bon est une créance ordinaire, donc prescrite par
  // 10 ans (CO art. 127) à défaut d'accord contraire. Les organisations de
  // consommateurs contestent les validités très courtes ; 60 mois (5 ans) est
  // un compromis usuel dans la branche. La date d'échéance est figée sur chaque
  // bon à l'émission — modifier ce réglage n'affecte jamais un bon déjà vendu.
  caisse_bon_validite_mois: '60',
  // Conditions imprimées au dos du bon cadeau.
  caisse_bon_mentions:
    "Ce bon est nominatif, non remboursable et non échangeable contre des espèces. Il peut être utilisé en une ou plusieurs fois jusqu'à la date d'échéance indiquée.",

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
  site_activity_context: "",
  site_target_persona:      "",
  site_tone_of_voice:        "",
  site_brand_tone:           "",
  site_blog_topics:          "",

  // ── Page de contact ─────────────────────────────────────
  // Le gabarit de la page /contact n'affiche que ce qui est renseigné : sans
  // ces deux textes, il ne reste que le titre, les coordonnées et le
  // formulaire. Pour une page de contact entièrement mise en page, créer une
  // page « contact » dans le constructeur — elle prend alors le dessus.
  contact_intro: '',
  contact_address_note: '',
  // Motifs proposés dans le formulaire, un par ligne. « Information sur le
  // programme » — l'offre du site d'origine — figurait en dur dans la liste.
  contact_subjects: 'Demande de renseignement\nPrise de rendez-vous\nAutre demande',

  /*
    Slug de la page servie à la racine du site.

    La racine cherchait « home », puis « accueil », et rien d'autre : une page
    d'accueil importée ou renommée — « accueil-importe », par exemple —
    laissait le site afficher « Page introuvable » sans que rien ne l'explique.
    Le slug se choisit maintenant depuis /admin/pages. Vide, les deux anciens
    noms restent essayés, dans cet ordre : les sites déjà en place ne bougent pas.
  */
  home_page_slug: '',

  // ── Coordonnées d'entreprise (admin > Paramètres > Entreprise) ──
  // ⚠️ À remplacer par les vraies coordonnées depuis /admin/settings (onglet
  // Entreprise) avant la mise en ligne : e-mail, téléphone, rue, et surtout
  // `business_price_range` — cette fourchette est une estimation, or elle est
  // publiée telle quelle dans le Schema.org `BeautySalon` (voir app/layout.tsx).
  business_name: '',
  business_owner: '',
  // Intitulé de métier (Person.jobTitle du graphe Schema.org).
  business_job_title: '',
  // Vide tant qu'il n'y a pas de domaine : le footer et la page contact
  // masquent l'e-mail s'il est absent, plutôt que d'afficher une adresse morte.
  business_email: '',
  business_phone: '',
  business_address_street:  '',
  business_address_postal:  '',
  business_address_city: '',
  business_address_region:  '',
  business_address_country: 'CH',
  business_price_range:     '',

  // ── En-tête & pied de page (admin > En-tête & pied) ─────
  // Modèles d'habillage. Voir src/constants/chromeVariants.ts.
  header_variant: 'classique',
  footer_variant: 'complet',
  // Ambiance du pied de page : 'dark' (le rendu d'origine) ou 'light'.
  footer_theme: 'dark',
  // Fond du pied. Vide = la couleur par défaut de l'ambiance choisie.
  footer_bg_color: '',

  // ── Identité visuelle globale ───────────────────────────
  global_logo:      '',
  favicon_url:      '',
  // Logo propre au pied de page ; vide = on reprend `global_logo`.
  footer_logo:      '',

  // ── Visuel d'en-tête par défaut (onglet Entreprise) ─────
  hero_image:       '',
  hero_text_color:  '',

  // ── Footer ──────────────────────────────────────────────
  // ⚠️ Tout part vide, comme la palette. Une photo Unsplash et une accroche
  // écrites en dur ici s'affichaient sur **tous** les sites issus du template :
  // le pied de page d'un nouveau client montrait la photo d'inconnus et le
  // slogan du client précédent. Ces valeurs se saisissent depuis
  // /admin/settings → Identité visuelle.
  footer_image: '',
  footer_tagline_line1: '',
  footer_tagline_line2: '',
  footer_tagline_text:
    "",

  // ── Réseaux sociaux ─────────────────────────────────────
  social_instagram: '',
  social_linkedin: '',
  social_youtube: '',
  social_spotify: '',

  // ── Auteur (blog) ────────────────────────────────────────
  author_bio:  "",
  // Vide : `/a-propos` était la page du site d'origine et n'existe pas
  // forcément ici. La signature d'article ne devient un lien que si une
  // adresse est saisie.
  author_link: '',

  // Liens de bas de page (mentions légales, CGV, confidentialité…). Vide à
  // l'installation, pour la même raison que `navigation_menu` : trois liens
  // codés en dur renvoyaient vers des pages que ce site n'a pas forcément.
  // S'édite depuis /admin/menu.
  footer_legal_links: '[]',

  navigation_menu: JSON.stringify([
    // Vide à l'installation : les entrées de menu se créent depuis
    // Paramètres > Menu, une fois les pages du site réellement en place.
    // Des liens par défaut pointeraient vers des pages inexistantes et
    // donneraient des 404 dès la première visite.
  ]),

  // Cible du bouton d'action principal de la navbar ("Prendre rendez-vous").
  // À remplacer par l'URL du module de réservation (Fresha, SimplyBook,
  // Calendly…) dès qu'il est ouvert.
  header_register_link: '',
};

// Keys whose values are image URLs — passed through proxyUrl on overrides
export const IMAGE_KEYS = new Set([
  'global_logo',
  'footer_logo',
  'footer_image',
  'favicon_url',
]);

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;

