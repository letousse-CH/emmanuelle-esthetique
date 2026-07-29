# Au-delà des Chaînes — Projet Dev

Site web de Matthieu Le Tousse : Coach Relation Toxique & Pervers Narcissique.
URL : audeladeschaines.com

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
Événements. Un module désactivé disparaît des pages publiques, de la nav et du
sitemap, mais reste modifiable dans l'admin. Voir `src/config/modules.ts`.

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

## Rédaction d'articles

Pour rédiger des articles blog, charge le prompt de rédaction en début de session :

```
/load CLAUDE-redaction.md
```

Ce fichier contient : voix de Matthieu, structure SEO/GEO, checklist complète.
