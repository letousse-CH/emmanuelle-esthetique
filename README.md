# Studio

Plateforme de gestion tout-en-un pour un site d'entreprise : **Pages,
Articles, Mots-clés, Réseaux, Newsletter, Caisse, Agents IA,
Automatisations**. Chaque module s'active ou se désactive depuis l'admin.

Ce dépôt est un **template** : il se duplique pour chaque nouveau client, avec
sa propre base Supabase et ses propres réglages.

## Mise en route

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés Supabase
npm run dev                  # http://localhost:5173
```

L'installation complète — base locale ou hébergée, application des migrations,
création du compte admin, duplication par client — est décrite dans
**[INSTALLATION.md](INSTALLATION.md)**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(base, auth) · Anthropic Claude (génération) · Stripe (paiements) · Resend
(e-mails) · Cloudflare R2 (médias) · Netlify (hébergement).

## Commandes

```bash
npm run dev        # développement
npm run build      # build de production
npm run lint       # tsc --noEmit
npm run setup      # assistant d'installation (coordonnées, modules, clés)
npm run duplicate  # dupliquer le projet pour un nouveau client
```

## Attention

Ce template descend d'un site en production (institut de beauté). Le code est
neutre, mais **les contenus de démonstration ne le sont pas encore** :
`src/config/SITE_CONFIG`, `src/constants/settings.ts` et `src/services/seeder.ts`
portent toujours des textes, prestations et coordonnées propres à ce métier.
`npm run setup` remplace les coordonnées et les réglages ; le seeder, lui,
reste à réécrire pour chaque activité.

Ne jamais faire pointer deux instances sur la même base Supabase : plusieurs
écrans font des `upsert` par slug et écraseraient les contenus de l'autre site.
