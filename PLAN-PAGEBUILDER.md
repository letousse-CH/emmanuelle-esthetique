# Page builder Emmanuelle Esthétique — plan de fusion (v1, à valider)

Base retenue : le moteur d'édition de MatthieuLeTousse-Therapeute (MLT), greffé dans EmmanuelleEsthetique, avec les fonctions de Studio (moteur commun à Audeladeschaines et EmmanuelleEsthetique) que tu as choisi de garder : IA, gabarits et bibliothèque, édition inline, médias et dictée. Les pages existantes d'Emmanuelle sont converties automatiquement.

Rien n'est codé tant que ce plan n'est pas validé.

---

## 1. Ce que j'ai trouvé

| | MLT | Studio (ADC / Emmanuelle) |
|---|---|---|
| Modèle de données | `sections > colonnes > blocs` (18 types de blocs), JSONB `pages.blocks` | liste plate `{ type, data: any }`, ~52 types de sections, JSONB `dynamic_pages.sections` |
| Mise en page | 6 gabarits de colonnes (1, 2 égales, 30/70, 70/30, 3, pleine largeur), fond et ton de texte par section et par colonne | aucune colonne : la mise en page est figée dans chaque section ; réglages communs `density / width / align / theme / animation / motif` |
| Édition | aperçu réel cliquable (`EditableCanvas`), sélection section/colonne/bloc, glisser-déposer natif des blocs et des colonnes, éditeurs par bloc, Tiptap pour le texte riche | formulaires par champ (`FieldEditor`, 1928 lignes), édition inline sur la page publique (`EditableText` en contentEditable), panneau flottant ou ancré |
| Annuler / rétablir | absent | présent, avec regroupement des frappes |
| Sauvegarde auto | absente | présente (éditeur inline) |
| Typage | strict, union discriminée | `data: any` partout |
| Couleurs | jetons fixes MLT (mint, teal, sky) écrits dans les types | palette lue dans les réglages du site (`useThemePalette`) |
| IA | optimisation meta + alt, génération d'article et de couverture | génération de page, génération de structure de site, réécriture d'une section (mode 1 section rapide), optimisation du style, dictée vocale |
| Bibliothèque | 6 gabarits de pages MLT codés en dur | catalogue rangé par intention (Ouverture, Offre, Preuve, Conversion…) avec recherche par synonymes et vignettes |
| Rendu public | `force-dynamic` | ISR 60 s + revalidation à la demande (plus rapide) |
| Poids côté visiteur | léger | ADC a un portillon (`UniversalPageEditorGate`) qui n'envoie le code de l'éditeur qu'à l'admin connectée ; Emmanuelle ne l'a pas encore |

Trois autres constats qui pèsent sur le plan :

1. Emmanuelle n'utilise que 13 types de sections sur les 52 (d'après le seeder) : `features_2` (7 fois), `text_image_1` (6), `intro_1` (3), puis une fois chacun `text_1`, `steps_1`, `stats_1`, `pricing_1`, `marquee_1`, `hero_1`, `hero_2`, `faq_1`, `cta_1`, `contact_1`. Une vingtaine de sections Studio (`turnkey_*`, `admin_mockups_gallery`, `voice_showcase_1`, `pricing_2` en euros par mois…) viennent d'un site vitrine de SaaS et n'ont rien à faire chez une esthéticienne.
2. Dans MLT, `SectionList.tsx`, `SectionItem.tsx`, `ColumnContainer.tsx` et `dnd/BlockDndContext.tsx` ne sont plus appelés par l'éditeur actuel (ancien éditeur en liste). Je ne les porte pas.
3. Le `CLAUDE.md` d'Emmanuelle signale que son `.env` peut encore pointer vers une autre base Supabase. Avant toute écriture (migration, seeder), je vérifie `NEXT_PUBLIC_SUPABASE_URL` avec toi.

---

## 2. Architecture cible

### 2.1 Modèle de données

Je reprends le modèle MLT tel quel (`ContentSection > ContentColumn > ContentBlock`, imbrication limitée à un niveau), avec quatre changements.

**Couleurs sémantiques.** Les valeurs `mint / teal / sky / teal-solid / dark` deviennent `surface / soft / accent / accent-solid / dark`, résolues depuis la palette d'Emmanuelle (réglages « Design & Style »). Le même builder pourra ainsi resservir sur n'importe quel site sans toucher aux types.

**Réglages de section repris de Studio** : `width` (étroit, contenu, large, plein), `animation` (aucune, fondu, montée, cascade) et un fond image optionnel avec opacité. Les motifs de fond (points, hexagones…) sont laissés de côté : ils compliquent l'interface pour un gain faible.

**Bloc `legacy_section`** qui encapsule une section Studio `{ type, data }` et la rend avec son composant d'origine. La migration ne perd ainsi jamais rien : ce qui n'a pas d'équivalent propre reste affiché à l'identique et reste modifiable par formulaire.

**Versionnage** : colonne `content` (JSONB) + `content_version` (int) ajoutées à `dynamic_pages`. L'ancienne colonne `sections` n'est pas touchée, ce qui permet un retour arrière immédiat.

### 2.2 Catalogue de blocs pour Emmanuelle

Les blocs MLT existants, rendus génériques (les textes par défaut « hypnose / 120 CHF » sont remplacés par des valeurs neutres ou lues dans les réglages) :
texte riche, image, bouton, citation, vidéo, espace, séparateur, en-tête de page, cartes à icônes, FAQ, étapes (intro + liste), grille d'offres, liste cochée, bandeau d'appel, avis Google, bande de chiffres.

Blocs ajoutés, repris de Studio parce qu'Emmanuelle en a l'usage :

| Nouveau bloc | Origine Studio | Pourquoi |
|---|---|---|
| `gallery` (variantes grille, carrousel, cascade) | `gallery_*` | photos de soins et d'ateliers |
| `marquee` | `marquee_1` | déjà utilisé sur l'accueil |
| `contact_card` | `contact_1` | coordonnées lues dans les réglages, jamais en dur |
| `testimonials` (saisie manuelle) | `testimonial_2`, `reviews_1` | complément aux avis Google |
| `blog_grid` | `blog_grid_1` | derniers articles, si le module Blog est actif |
| `newsletter` | `newsletter_1` | si le module Newsletter est actif |

Deux évolutions de blocs existants : `hero_header` gagne une variante « image de fond » (pour `hero_1`), `icon_cards` accepte « sans icône » ou une petite image (pour `features_2`).

Les blocs liés à un module (Blog, Newsletter) disparaissent de la bibliothèque quand le module est désactivé, comme le fait déjà `src/config/modules.ts`.

### 2.3 Table de conversion des 13 sections utilisées

| Section Studio | Devient |
|---|---|
| `hero_1` | section pleine largeur + `hero_header` variante image |
| `hero_2` | section 1 colonne + `hero_header` centré |
| `intro_1` | section 1 colonne : `quote` + `text_wysiwyg` + `cta_button` |
| `text_1` | `text_wysiwyg` |
| `text_image_1` | section 2 colonnes (`ratio` → égale ou 30/70, `image_position` → ordre des colonnes) : `image` + `text_wysiwyg` (titre converti en `<h2>`) |
| `features_2` | `icon_cards` sans icône (titre de section repris) |
| `steps_1` | 2 colonnes : `steps_intro` + `steps_list` |
| `stats_1` | `stat_strip` |
| `pricing_1` | `offers_grid` à une offre |
| `marquee_1` | `marquee` |
| `faq_1` | `faq_accordion` |
| `cta_1` | `callout_band` |
| `contact_1` | `contact_card` |
| tout autre type trouvé en base | `legacy_section` (affichage identique) |

Les réglages Studio de chaque section (`theme`, `density`, `width`, `animation`) sont reportés sur la section MLT : `theme: dark` → fond `dark`, `surface` → `surface`, `primary` → `accent-solid` ; `density` → `paddingY` (`compact` → `small`, `normal` → `medium`, `airy` → `large`).

### 2.4 L'éditeur

Deux points d'entrée, un seul moteur :

- **Admin** (`/admin/pages/[id]`) : le canvas MLT (aperçu réel, clic pour sélectionner, glisser-déposer) avec un inspecteur ancré à droite au lieu des modales MLT. L'aperçu reste visible pendant qu'on modifie, ce qui compte pour quelqu'un qui n'est pas du métier. Sur mobile, l'inspecteur passe en panneau bas.
- **Sur le site** (mode Édition, admin connectée) : les textes se modifient directement sur la page, comme aujourd'hui chez Emmanuelle, mais branchés sur les chemins de blocs (`sectionId / columnId / blockId / champ`) plutôt que sur les index de sections. Le code de l'éditeur ne part chez le visiteur que si une session est ouverte (portillon ADC).

Ce que l'éditeur fusionné reprend de chaque côté :

| Fonction | Source |
|---|---|
| Sélection sur aperçu réel, DnD blocs et colonnes, ligne d'insertion | MLT |
| Éditeurs typés par bloc | MLT |
| Texte riche Tiptap, nettoyé par DOMPurify | MLT |
| Score SEO/GEO en direct + optimisation IA des meta et des alt | MLT |
| Aperçu bureau / mobile | MLT |
| Annuler / rétablir (Cmd+Z / Cmd+Shift+Z), frappes regroupées | Studio (`usePageEditor`) |
| Sauvegarde automatique + alerte en quittant avec des changements | Studio |
| Bibliothèque par intention, recherche par synonymes, vignettes | Studio (`sectionCatalog`, `sectionPreviews`) |
| Mode « contenu seul » par défaut, réglages de style derrière un bouton « Mise en page » | ADC (`ContentOnlyEditor`) |
| Gabarits de pages (soin, atelier, page de contact…) | Studio (`TemplatePicker`) réécrit en blocs |
| Médiathèque, recherche d'images libres, envoi R2 | Studio (`MediaPickerModal`, `StockImageSearch`) |
| Dictée vocale dans les champs texte | Studio (`VoiceInputButton`) |
| IA : générer une page, réécrire une section, améliorer le style | Studio, prompts réécrits pour le format blocs |

Le mode « contenu seul » est la pièce qui rend l'outil simple pour Emmanuelle : par défaut, elle ne voit que les textes, les images et les boutons. Colonnes, fonds et espacements sont dans un second onglet.

### 2.5 IA adaptée au nouveau format

Les routes `generate-page`, `modify-page-with-ai` et `optimize-page-style` décrivent aujourd'hui le dictionnaire des sections Studio à Claude. Je les réécris avec :

- un schéma JSON des blocs généré depuis les types TypeScript (source unique, pas de liste à maintenir à la main) ;
- une validation stricte de la réponse (tout bloc inconnu ou mal formé est rejeté, sans casser la page) ;
- le mode « une section » conservé pour la réécriture rapide ;
- le modèle, le niveau de réflexion et le budget toujours pilotés par `/admin/settings`.

### 2.6 Performance

- Rendu public : ISR conservé, revalidation à la demande à chaque enregistrement (route `/api/revalidate` déjà présente).
- Blocs rendus côté serveur ; seuls l'accordéon FAQ, le carrousel et les animations sont des composants client, chargés à la demande.
- `motion` n'est chargé que si une section a une animation.
- Images via `next/image` avec dimensions ; vignettes de la bibliothèque en SVG légers (déjà le cas dans Studio).
- Éditeur exclu du bundle visiteur (portillon).

Objectif mesurable : Lighthouse mobile ≥ 95 en performance sur l'accueil et une page soin, avant et après, mesuré dans la même session.

---

## 3. Lots de travail

Chaque lot se termine par un commit et un point de validation avec toi.

| Lot | Contenu | Validation |
|---|---|---|
| 0. Sécurité | branche dédiée, vérification de la base Supabase visée, export JSON de `dynamic_pages` | tu confirmes l'URL Supabase |
| 1. Moteur de rendu | types, `BlockRenderer` porté et rendu générique (couleurs sémantiques), nouveaux blocs, `legacy_section`, lecture `content_version` avec repli sur l'ancien rendu | une page test rendue en blocs |
| 2. Migration | script de conversion avec mode « essai » (rapport page par page : sections converties, sections passées en `legacy_section`), captures avant/après de chaque page | tu valides le rapport et les captures, puis j'écris en base |
| 3. Éditeur admin | canvas, inspecteur ancré, DnD, annuler/rétablir, sauvegarde auto, bibliothèque, gabarits, médias, dictée, mode contenu seul, score SEO | test sur 3 pages réelles |
| 4. Édition inline | mode Édition sur le site branché sur les blocs, portillon de chargement | test en conditions réelles, idéalement par Emmanuelle |
| 5. IA | génération de page, réécriture de section, optimisation du style, prompts en format blocs | 3 générations de test |
| 6. Nettoyage | retrait des sections Studio devenues inutiles, mise à jour du `CLAUDE.md`, mesure Lighthouse | rapport final |

Ordre retenu : le rendu et la migration passent avant l'éditeur, pour que le site public ne soit jamais dans un état intermédiaire.

---

## 4. Risques et parades

| Risque | Parade |
|---|---|
| `.env` pointant sur une autre base | vérification au lot 0, aucune écriture avant ton accord |
| Rendu différent après conversion (espacements, couleurs) | captures avant/après page par page ; `legacy_section` pour tout cas douteux |
| Retour arrière nécessaire | colonne `sections` intacte ; repasser `content_version` à 1 suffit |
| Textes stockés avec la convention `\n` de Studio | conversion en paragraphes HTML dans le script, vérifiée dans le rapport |
| SEO (titres, FAQ en données structurées) | le bloc FAQ produit le JSON-LD FAQPage ; contrôle de la hiérarchie H1/H2 dans le score SEO |
| Dérive entre les trois sites ensuite | voir la suggestion en fin de document |

---

## 5. Points à trancher avant de coder

1. Inspecteur ancré à droite (ma recommandation) ou modales comme dans MLT ?
2. Je retire définitivement de la bibliothèque d'Emmanuelle les sections de type SaaS (`turnkey_*`, maquettes d'admin, tarifs mensuels en euros) : d'accord ?
3. Veux-tu un « mode avancé » pour toi (colonnes, fonds, animations toujours visibles), activé par un réglage, pendant qu'Emmanuelle reste en mode contenu seul ?
4. Le texte riche des articles de blog, de la newsletter et des événements reste sur Quill pour l'instant (hors du périmètre page builder). On le passe à Tiptap plus tard ou pas du tout ?

---

## 6. Suite possible

Une fois ce builder stabilisé, il gagnerait à vivre dans un dossier partagé (ou un petit paquet npm local) importé par les trois sites, plutôt que recopié. Aujourd'hui ADC et Emmanuelle ont déjà divergé sur 17 fichiers du même moteur : chaque correction faite d'un côté est perdue de l'autre.
