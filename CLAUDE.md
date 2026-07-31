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
- `@react-pdf/renderer` (quittances PDF du module Caisse, rendu serveur Node)
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
  migrations/     # Migrations SQL versionnées — seule source de vérité du schéma
scripts/
  setup.mjs       # Assistant d'installation (npm run setup)
```

`supabase/migrations/` couvre **toutes** les tables utilisées par le code. Les
scripts SQL ad-hoc qui traînaient à la racine de `supabase/` (dont ceux du site
précédent : `quiz_*`) ont été supprimés — pour vérifier qu'aucune table
n'échappe aux migrations :

```bash
comm -23 <(grep -rhoE "\.from\('[a-z_]+'\)" src | sed "s/\.from('//;s/')//" | sort -u) <(grep -rhoiE "CREATE TABLE (IF NOT EXISTS )?[a-z_]+" supabase/migrations/ | sed -E 's/.* //' | sort -u)
```

Il n'y a plus de `server.ts` Express ni de prerender Puppeteer : Next.js gère le
SSR/SSG/ISR nativement. `vite_legacy_backup/` (gitignoré, local) est l'ancienne
stack Vite/Express conservée pour référence historique — pas utilisée par l'app.

## Modules & template

Le site a un système de modules activables/désactivables depuis
`/admin/settings` (onglet **Modules**) : Blog/Articles, Génération IA d'article,
Événements/Ateliers, Newsletter, Réseaux sociaux, Caisse & facturation. Un
module désactivé disparaît des pages publiques, de la nav et du sitemap, mais
reste modifiable dans l'admin. Voir `src/config/modules.ts`.

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

## Caisse, clientèle & facturation

Module **interne** (rien n'est exposé au rôle `anon`), sous `/admin/caisse` :
encaissement, fichier clientes, catalogue de prestations, journal des recettes
et export pour la fiducie. Migration : `supabase/migrations/20260731_caisse.sql`.

Ce qui n'est **pas** négociable, parce que le Code des obligations suisse
l'impose (art. 957a « intégralité, chronologie, traçabilité » et art. 958f
« conservation 10 ans ») :

- **Les montants ne se calculent jamais dans le navigateur.** Créer un
  encaissement passe par la fonction Postgres `caisse_create_transaction`, qui
  alloue le numéro de facture et calcule HT/TVA/TTC à partir des lignes. Le
  client n'a ni policy INSERT ni GRANT INSERT sur `transactions`.
- **Numérotation continue par année civile** (`FAC-2026-0001`), allouée par
  `caisse_next_invoice_seq` avec un verrou de ligne — pas une séquence
  Postgres, qui laisserait des trous en cas de rollback.
- **Aucune écriture ne se supprime ni ne se recalcule.** Des triggers
  (`caisse_transactions_guard`, `caisse_items_guard`) refusent le DELETE et
  toute modification du numéro, de la date et des montants. Une erreur se
  corrige par une annulation (`caisse_cancel_transaction`), qui laisse la trace.
- **Les libellés sont figés au moment de la vente** : le nom de la cliente est
  recopié sur la transaction, le libellé et le prix de la prestation sur la
  ligne. Renommer une cliente ou retirer un soin du catalogue ne réécrit donc
  aucune facture déjà émise. C'est aussi pourquoi une fiche cliente citée sur
  une facture est *archivée* et non supprimée.

**TVA.** 0 % par défaut : l'activité n'est pas assujettie tant que le chiffre
d'affaires reste sous CHF 100'000/an (LTVA art. 10). La structure gère déjà un
taux par ligne — le jour de l'assujettissement, il suffit d'activer la TVA et de
choisir le taux (8.1 / 3.8 / 2.6 %) dans `/admin/settings` → onglet **Caisse**.
Les factures antérieures gardent le leur, elles ne sont jamais recalculées.

**Formatage des montants.** Toujours `de-CH`, jamais `fr-CH` : seul `de-CH`
produit la convention suisse `CHF 1'234.50` (point décimal). `fr-CH` écrirait
`1'234,50 CHF`, avec une virgule qu'aucune fiduciaire n'attend. Les dates, elles,
restent en `fr-CH`. Voir `formatCHF` dans `src/types/caisse.ts`.

**Bons cadeaux.** Vendus soit à un montant libre, soit contre un ou plusieurs
soins de la carte, puis présentés en paiement par leur code `BON-2026-0001`.
Migration : `supabase/migrations/20260801_caisse_bons_cadeaux.sql` — à appliquer
**après** celle de la caisse, dont elle remplace `caisse_create_transaction`.

⚠️ **Un bon ne produit de recette qu'une fois : à sa vente.** Le jour où la
cliente l'utilise, aucun argent n'entre. D'où `transactions.montant_bon`, et la
règle qui gouverne tout le module :

```
recette encaissée = total_ttc - montant_bon      (0 si la facture est annulée)
```

C'est `recetteEncaissee()` dans `src/types/caisse.ts`. **Ne jamais sommer
`total_ttc` pour calculer un CA** — journal, tableau de bord, graphiques et
export passent tous par cette fonction. Le modèle couvre aussi le bon partiel :
bon de CHF 150 sur un soin à CHF 200 → `montant_bon` = 150, mode = twint pour
les 50 restants.

Vendre un bon n'est pas une prestation : en TVA suisse l'impôt est dû à
l'utilisation, pas à la vente, donc la ligne est toujours à 0 %. L'échéance est
figée sur chaque bon à l'émission — changer `caisse_bon_validite_mois` (60 mois
par défaut) n'affecte jamais un bon déjà vendu. Aucune durée minimale n'existe
en droit suisse : un bon est une créance ordinaire, prescrite par 10 ans
(CO art. 127) à défaut d'accord contraire.

**Corriger une erreur de caisse.** Bouton « Corriger » du journal : la facture
fautive est annulée (elle reste au journal avec son numéro), et l'écran de
caisse rouvre avec son panier pré-rempli via `src/utils/caissePrefill.ts`. La
nouvelle facture porte `corrige_transaction_id` vers l'ancienne. C'est la seule
correction légale — le CO interdit de réécrire une écriture, il exige que
l'erreur *et* sa correction restent visibles.

**Web app (PWA).** La caisse s'installe sur l'écran d'accueil du téléphone :
manifeste servi par `src/app/admin/caisse/manifest/route.ts`, déclaré **par le
seul** `src/app/admin/caisse/layout.tsx`. Le site public ne référence aucun
manifeste et ne proposera donc jamais d'être installé — c'est ce qui garde les
deux mondes séparés ; ne pas remonter cette déclaration dans `app/layout.tsx`.

Le `scope` du manifeste s'écrit `/admin/caisse` **sans slash final** : la
correspondance se fait par préfixe de chaîne, et `/admin/caisse/` exclurait
`start_url` lui-même, ce qui rouvrirait l'app dans un onglet ordinaire.

Lancée depuis le raccourci, `useAppMode()` (`src/hooks/useAppMode.ts`) détecte
le mode autonome et `admin/layout.tsx` efface alors la barre latérale et la
topbar ; la navigation passe par `CaisseTabBar`. Icônes générées dans
`public/icons/` (monogramme sauge, plus une variante `maskable` réduite pour le
rognage Android).

**Export fiducie.** Journal filtrable par mois ou par année, exporté en CSV
(séparateur `;`, BOM UTF-8 — double-clic et ça s'ouvre dans Excel), une ligne
par prestation. Les factures annulées y figurent avec des montants à 0.00 :
la somme de la colonne TTC donne le CA net, et la numérotation reste continue
sous les yeux du comptable.

## E-mails & désinscription

Tous les liens de désinscription sont signés en HMAC-SHA256 avec `UNSUB_SECRET`
(`src/utils/unsubToken.ts`). Ce secret **n'a pas de repli** : signer avec une
clé vide rendrait le lien reproductible, donc n'importe qui pourrait désinscrire
l'adresse d'un tiers. Tant qu'il n'est pas défini, `/api/send-newsletter` et
`/api/welcome-email` répondent `501` au lieu d'envoyer.

Le générer une fois (`npm run setup` le fait automatiquement) :

```bash
openssl rand -hex 32
```

Ne jamais le faire tourner ensuite : cela invaliderait les liens des e-mails
déjà partis.

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
