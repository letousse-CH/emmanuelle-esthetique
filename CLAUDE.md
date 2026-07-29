# Emmanuelle Esthétique — Projet Dev

Site web d'Emmanuelle : institut de beauté et bien-être **à domicile** à
Palézieux (Vaud, Suisse). Soins du visage, Head Spa, massages relaxants, beauté
du regard, ateliers d'auto-soin (Gua Sha, Glowing Face) et bons cadeaux.

⚠️ Le `.env` de ce dépôt a été copié depuis le projet d'origine et peut encore
pointer sur **une autre base Supabase**. Vérifier `NEXT_PUBLIC_SUPABASE_URL`
avant toute écriture (seeder, admin) : le bouton « Pages par défaut » de
`/admin/pages` fait un upsert par slug et écraserait les pages du projet visé.

Ce dépôt est aussi la base d'un **template réutilisable** pour de futurs sites
(module system, coordonnées d'entreprise et branding pilotables depuis l'admin —
voir "Modules & template" ci-dessous).

## Stack technique

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (config via `@theme` dans `src/index.css`, pas de `tailwind.config.*`)
- Supabase (base de données + auth)
- Stripe (paiement des inscriptions événements)
- Cloudflare R2 (stockage médias) + Resend (e-mails transactionnels)
- Anthropic Claude / Google Gemini (génération IA d'article, SEO)
- Déploiement Netlify (`@netlify/plugin-nextjs`)

## Commandes clés

```bash
npm run dev       # Serveur local (next dev)
npm run build     # Build prod Next.js
npm run start     # Serveur prod (après build)
npm run lint      # tsc --noEmit
npm run setup     # Assistant d'installation (coordonnées, modules, .env.local)
```

## Structure

```
src/
  app/            # Routes Next.js App Router
    (public)/     # Pages publiques (layout avec Navbar/Footer)
    admin/        # Back-office (auth Supabase, layout partagé)
    api/          # Route handlers (remplace l'ancien server.ts Express)
  components/     # Composants réutilisables
  services/       # Appels Supabase, Stripe, API
  hooks/          # Custom hooks
  types/          # Types TypeScript
  utils/          # Fonctions utilitaires
  config/         # SITE_CONFIG, modules.ts (feature flags)
  constants/      # SETTINGS_DEFAULTS (valeurs par défaut de la table settings)
supabase/
  migrations/     # Migrations SQL versionnées (settings, articles, events)
scripts/
  setup.mjs       # Assistant d'installation (npm run setup)
```

Il n'y a plus de `server.ts` Express ni de prerender Puppeteer : Next.js gère le
SSR/SSG/ISR nativement. `vite_legacy_backup/` (gitignoré, local) est l'ancienne
stack Vite/Express conservée pour référence historique — pas utilisée par l'app.

## Modules & template

Le site a un système de modules activables/désactivables depuis
`/admin/settings` (onglet **Modules**) : Blog/Articles, Génération IA d'article,
Événements/Ateliers, Newsletter, Réseaux sociaux. Un module désactivé disparaît
des pages publiques, de la nav et du sitemap, mais reste modifiable dans
l'admin. Voir `src/config/modules.ts`.

Le modèle Claude utilisé par toutes les générations, le niveau de réflexion et
le budget mensuel se règlent dans `/admin/settings` (onglet **IA & Budget**) —
catalogue des modèles et tarifs dans `src/constants/aiModels.ts`.
La consommation est journalisée dans la table `ai_usage` (Anthropic n'expose pas
le solde du compte) et une bannière d'alerte s'affiche dans l'admin dès que le
seuil du budget est atteint.

Les coordonnées d'entreprise (nom, adresse, téléphone, e-mail, gamme de prix), la ligne éditoriale (activité, persona cible, ton de voix, ton de marque, piliers du blog) et le branding (couleurs, polices, logos) sont éditables depuis `/admin/settings` (onglets **Entreprise**, **Éditorial & Marque** et **Design & Style**) — stockés dans la table Supabase `settings`, avec repli sur `src/constants/settings.ts` si absents.

Pour démarrer un nouveau site à partir de ce template : `npm run setup` (coordonnées,
modules, clés de service), puis appliquer `supabase/migrations/*.sql` sur le
nouveau projet Supabase.

## Nom de domaine & stockage des médias

**Domaine.** Pas encore de domaine définitif : le site tourne sur
`emmanuelle-esthetique.netlify.app`. `SITE_CONFIG.url` (`src/config/site.ts`)
résout dans cet ordre : `NEXT_PUBLIC_SITE_URL` → `URL` (injecté par Netlify,
**serveur uniquement**) → repli sur l'URL Netlify.

Seul `NEXT_PUBLIC_SITE_URL` est injecté aussi dans le bundle navigateur — c'est
donc lui qu'il faut définir. Le jour où le domaine est choisi :

```bash
netlify env:set NEXT_PUBLIC_SITE_URL "https://le-vrai-domaine.ch"
```

Rien d'autre à changer : canonicals, sitemap, robots.txt, `@id` Schema.org,
Open Graph et liens de partage en découlent tous.

**Médias.** Aucun stockage n'est requis pour faire tourner le site. Les images
s'ajoutent **par URL** depuis la bibliothèque médias de l'admin (bouton
« Ajouter » à côté du champ URL) — utile tant que R2 n'est pas configuré, et
sans rapport avec le nom de domaine.

Pour activer l'upload de fichiers, renseigner les cinq variables R2
(`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`NEXT_PUBLIC_R2_PUBLIC_URL`) en local et sur Netlify. Tant qu'il en manque une,
`/api/upload-media` répond `501` avec la liste des variables absentes au lieu
d'une erreur S3 opaque. Le sous-domaine public `pub-xxxx.r2.dev` d'un bucket
suffit : pas besoin de domaine personnalisé.

## Contenu des pages

Les pages publiques ne sont **pas** des composants React : elles vivent dans la
table Supabase `dynamic_pages` et sont rendues par le page builder
(`src/components/pagebuilder/`). `src/app/(public)/page.tsx` lit la page de slug
`home` ; `(public)/[slug]/page.tsx` sert toutes les autres.

Le contenu de départ des pages (accueil, à propos, soins, bon cadeau, mentions
légales) est défini dans `src/services/seeder.ts` et s'importe en base via
`/admin/pages` → bouton **Pages par défaut**. Les sections disponibles et leur
schéma de données sont listés dans
`src/components/pagebuilder/wireframes.config.ts`.

## Ton éditorial & prompts IA

Aucun prompt IA ne code en dur l'activité ni le positionnement du site : tous
lisent les réglages **Éditorial & Marque** de `/admin/settings`
(`site_activity_context`, `site_target_persona`, `site_tone_of_voice`,
`site_brand_tone`, `site_blog_topics`), avec repli sur
`src/constants/settings.ts`. Pour changer la voix du site, modifier ces
réglages — pas les fichiers `src/app/api/*` ni `src/utils/*Generation.ts`.

Règle appliquée dans tous les prompts : ne jamais inventer un nom d'offre, un
tarif, un horaire, un diplôme ou une certification qui ne figure pas dans les
réglages.
