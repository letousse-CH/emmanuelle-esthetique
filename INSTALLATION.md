# Studio — installation et réinstallation

Plateforme de gestion : Pages, Articles, Mots-clés, Réseaux, Newsletter,
Caisse, Agents IA, Automatisations. Ce document décrit la mise en route d'une
instance, et la duplication pour un nouveau client.

---

## 1. Choisir la base de données

Studio s'appuie sur Supabase (Postgres + authentification + stockage). Deux
manières de la faire tourner, au choix.

### A — Base locale, hors ligne (nécessite Docker)

Le plus fidèle et le plus reproductible : tout tourne sur la machine, la remise
à zéro est instantanée, aucune donnée ne sort.

```bash
# 1. Installer Docker Desktop — https://docker.com/products/docker-desktop
#    (installation à faire vous-même : elle demande votre mot de passe)

# 2. Depuis studio/, démarrer la pile locale
npx supabase start
```

La commande affiche `API URL`, `anon key` et `service_role key`. Reportez-les
dans `.env.local`, puis appliquez le schéma :

```bash
npx supabase db reset      # applique toutes les migrations à neuf
```

### B — Base hébergée, application locale

Aucune installation. Un projet Supabase gratuit sert de base ; **le site reste
sur `localhost`** — aucun nom de domaine, aucun dépôt public, rien de visible.

1. Créer un projet sur supabase.com
2. Copier `Project URL`, `anon key` et `service_role key` dans `.env.local`
3. Appliquer le schéma :

```bash
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

---

## 2. Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

`.env.local` est livré avec des valeurs de remplacement : le projet démarre et
se construit sans base, mais aucune donnée n'est lue ni écrite tant que les
deux premières lignes ne sont pas remplacées.

Créer ensuite le compte administrateur depuis l'interface Supabase
(Authentication → Add user), puis se connecter sur `/login`.

---

## 3. Clés de service

Chaque module dégrade proprement quand sa clé manque — l'écran reste
accessible et explique ce qui est absent, au lieu de planter.

| Variable | Module concerné | Sans elle |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Rédaction IA, Mots-clés, Réseaux, Agents | Génération indisponible |
| `RESEND_API_KEY` | Newsletter, formulaires, Automatisations | Aucun envoi d'e-mail |
| `R2_*` | Médiathèque | Envoi de fichiers désactivé |
| `STRIPE_SECRET_KEY` | Caisse, paiements | Encaissement en ligne désactivé |
| `CRON_SECRET` | Automatisations planifiées | Le déclencheur horaire refuse les appels |

---

## 4. Dupliquer et mettre à jour les sites clients (Multi-sites)

```bash
npm run duplicate      # clône le projet vers un nouveau dossier et réinitialise Git
npm run setup          # coordonnées, modules actifs, clés de service
npm run export-update  # déploie les mises à jour du code vers un site client existant
```

### ⚠️ Règle de sécurité Git & Multi-sites :
Chaque site client possède **son propre dossier et son propre dépôt GitHub distant (`origin`)**.
- Lors d'une mise à jour avec `npm run export-update`, l'outil affiche et vérifie automatiquement le dépôt distant du site cible (`git remote get-url origin`).
- Avant d'effectuer un `git push` sur un site mis à jour, assurez-vous toujours d'être positionné dans le dossier du site client (`cd "../nom-du-site-client"`) et de vérifier l'adresse du dépôt avec `git remote -v`.

Ne jamais faire pointer deux instances sur la même base Supabase ni pousser les modifications d'un client sur le dépôt d'un autre site.

---

## 5. Le schéma est la source de vérité

`supabase/migrations/` couvre toutes les tables utilisées par le code. Pour
vérifier qu'aucune table n'échappe aux migrations :

```bash
comm -23 \
  <(grep -rhoE "\.from\('[a-z_]+'\)" src | sed "s/\.from('//;s/')//" | sort -u) \
  <(grep -rhoiE "CREATE (TABLE (IF NOT EXISTS )?|(OR REPLACE )?VIEW )[a-z_]+" supabase/migrations/ \
    | sed -E 's/.* //' | sort -u)
```

La commande ne doit rien renvoyer. Elle couvre les tables **et les vues** :
`client_stats` en est une, et une recherche limitée à `CREATE TABLE` la
signalerait à tort comme manquante.

---

## 6. Les huit modules

Activables un par un depuis `/admin/settings` → onglet **Modules**. Un module
désactivé disparaît de la navigation et des pages publiques, mais ses écrans
restent joignables par URL directe.

| Module | Écran | Tables |
| --- | --- | --- |
| Pages | `/admin/pages` | `dynamic_pages` |
| Articles | `/admin/blog` | `articles` |
| Mots-clés | `/admin/seo` | `seo_*` |
| Réseaux | `/admin/social` | `social_posts`, `rss_feeds` |
| Newsletter | `/admin/newsletter` | `newsletter_*`, `subscribers` |
| Caisse | `/admin/caisse` | `caisse_*`, `clients` |
| **Agents** | `/admin/agents` | `agents`, `agent_documents`, `agent_conversations`, `agent_messages` |
| **Automatisations** | `/admin/automations` | `automations`, `automation_runs` |

### Agents IA

Un agent se crée à partir d'un gabarit (qualification, estimation, prise de
rendez-vous, réponse aux questions) qui apporte sa consigne et la liste des
informations à recueillir. Le bouton **Réindexer le site** aspire les pages et
articles publiés dans sa base de connaissances ; les textes ajoutés à la main
(tarifs, zone d'intervention) ne sont jamais écrasés par cette réindexation.

L'agent répond via `/api/agent-chat`, une route publique volontairement sans
authentification — c'est un visiteur anonyme qui écrit. En contrepartie elle ne
fait jamais confiance à ce qu'elle reçoit : l'agent est rechargé depuis la base
à chaque appel, la consigne système n'est jamais fournie par le client, et le
nombre de tours est plafonné pour borner la dépense.

### Automatisations

Un déclencheur (horaire, événement interne, manuel) relié à une action
(webhook, e-mail, génération de contenu, scan de mots-clés). Chaque exécution
est journalisée dans `automation_runs` : sans trace, une automatisation qui
échoue en silence est indétectable.

Trois actions — génération d'article, de posts sociaux, et digest newsletter —
sont déclarées dans l'interface mais refusent de s'exécuter automatiquement :
elles dépendent de routes qui exigent une session admin. Elles restent
lançables depuis leur propre module. Le relais serveur reste à écrire.
