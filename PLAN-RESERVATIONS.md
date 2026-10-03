# Réservations v2 — audit, modèle et contrat (2026-10-03)

Source de vérité partagée par les trois chantiers (service/API, admin, formulaire
public). Types : `src/types/booking.ts`. Migration : `supabase/migrations/20261004_reservations_v2.sql`.

## 1. Le modèle métier

Emmanuelle **valide chaque rendez-vous un par un** : elle rappelle la cliente pour
faire de l'upselling (soin complémentaire, option, forfait) et c'est **elle qui
fixe l'horaire définitif**. Le formulaire public ne réserve donc pas une heure :
il dépose une **demande = date + période (matin / après-midi)**.

| État | `statut` | `horaire_fixe` | Effet sur l'agenda |
|---|---|---|---|
| Demande reçue, pas encore appelée | `en_attente` | false | **Demande souple** : occupe de la capacité dans sa période, pas d'heure précise |
| Appelée, horaire arrêté | `confirme` | true | **Bloque** `[heure, heure + durée + buffer]` |
| Refusée / annulée | `refuse` / `annule` | — | Libère tout |
| Réalisée | `termine` | true | Historique |

`heure_rdv` reste NOT NULL : tant que `horaire_fixe = false` c'est une heure
*indicative* (premier créneau libre de la période à la création).
`date_demandee` / `periode_demandee` gardent la demande d'origine si le rdv est déplacé.

## 2. Audit — défauts constatés (priorité décroissante)

**Critiques**
1. **INSERT anonyme ouvert** sur `bookings` (`WITH CHECK (true)` + GRANT à `anon`) : avec la clé publique n'importe qui écrit un rdv `confirme`, au prix et à l'heure voulus, sans contrôle ni limite. → migration §6 + création serveur obligatoire (échec si pas de client admin).
2. **Prix et durée pris du navigateur** (`service_prix_chf`, `service_duree_minutes`, `options[].prix_chf`) : une cliente peut s'inscrire un soin à CHF 0. → le serveur retrouve tout depuis le catalogue par identifiant.
3. **Faux « anti-race »** : le contrôle de disponibilité précède l'INSERT sans verrou. → insertion puis re-vérification déterministe (ordre `created_at, id`), annulation de la perdante.
4. **Disponibilité fail-open** : si le client admin est nul, `getAvailableSlots` lit via `anon`, ne voit aucune réservation (pas de SELECT anon) et déclare tout libre. → fail-closed (503).
5. **Fuseau horaire** : `new Date()` côté Netlify est en UTC. « Aujourd'hui », le délai d'anticipation, la fenêtre Google FreeBusy (`T00:00:00Z`) et le `min` du champ date du formulaire sont décalés de 1–2 h. → tout en `Europe/Zurich`.
6. **La 2ᵉ cliente du matin échoue** : le formulaire envoie toujours `09:00` (ou `14:00`) ; après une première demande à 09:00, ce créneau est occupé et la 2ᵉ reçoit « créneau plus disponible » alors que la période a de la place. → modèle période (§1).
7. **Fiche cliente créée avec `consent_whatsapp: true`** (et `consent_email` dès qu'il y a une adresse) sans case cochée : contraire à la règle du dépôt « encaisser/réserver n'est pas un consentement publicitaire » (LCD art. 3 al. 1 let. o). → consentements à `false` sauf case explicite.

**Majeurs**
8. **Rapprochement CRM cassé** : le téléphone est cherché par suffixe de 7 chiffres avec `ilike '%…%'` alors que les fiches stockent `+41 79 123 45 67` (espaces) → la même cliente est dupliquée. À l'inverse, le rapprochement **par nom seul** fusionne des homonymes (fuite de données entre clientes). → normalisation E.164 côté JS, pas de rapprochement par nom seul.
9. **Enregistrer une note sur un rdv confirmé renvoie l'e-mail de confirmation** (`PATCH` réutilise le statut existant → `updateBookingStatus` renvoie le mail). 
10. **Aucune édition d'un rendez-vous** : ni date, ni heure, ni soin, ni coordonnées, ni suppression ; pas de déplacement ; pas de vue agenda ; l'upselling (ajouter un soin au téléphone) est impossible.
11. **Aucune indisponibilité** : `fermetures_exceptionnelles` existe en base mais **aucune interface** ; les horaires hebdomadaires ne sont pas éditables non plus (le panneau n'expose que buffer / anticipation / GCal). Pas de plage horaire ni de période de vacances.
12. **Horaires par défaut incohérents** : migration (13:30–18:30, samedi fermé) ≠ code (14:00–18:00, samedi ouvert).
13. **Dates non bornées côté serveur** : un rdv dans le passé ou à 5 ans est accepté (`anticipation_max_jours` n'est jamais appliqué hors « aujourd'hui »). Pas d'honeypot, limite de débit en mémoire d'instance (inefficace en serverless), un robot peut bloquer l'agenda avec des demandes bidon.
14. **Injection HTML dans les e-mails** : nom, notes, soin interpolés sans échappement dans le mail envoyé à l'institut.
15. **E-mail de refus** : « contacter au `${SITE_CONFIG.owner}` » (c'est le nom, pas le numéro). Aucun e-mail d'annulation ni de déplacement.
16. **Doublons d'e-mails à la saisie manuelle** : `createBooking` envoie accusé + notification à l'institut, puis le passage en `confirme` renvoie la confirmation.

**Mineurs**
17. Admin : « aujourd'hui » calculé en UTC (`toISOString().split('T')`), `alert()`/`confirm()` natifs, catalogue des soins codé en dur importé depuis un composant client (`PRESTATIONS_CATALOG`), aucun lien vers la fiche cliente, le total (soin + options) n'est pas affiché.
18. Deux jeux de routes en doublon (`/api/bookings/[id]` ≈ `/api/admin/bookings/[id]`, `/api/bookings/settings` ≈ `/api/admin/booking-settings`).
19. Pas de rappel automatique (`rappel_effectue` n'est jamais écrit), pas de passage « Encaisser » vers la caisse.

## 3. Algorithme de disponibilité (moteur pur)

Fichier `src/services/bookingEngine.ts`, **fonctions pures** (aucun accès base) pour
être testables. Entrées : `settings`, `blocks`, `bookings` du jour, `durée`,
`maintenant` (Zurich). Pas de grille = `settings.pas_creneau_minutes`.

1. Fenêtres libres du jour = plages d'ouverture du jour de semaine − blocages du jour
   (journée entière ⇒ vide ; plage horaire ⇒ soustraite, **sans** buffer).
2. Rdv à `horaire_fixe = true` (statuts `en_attente`/`confirme`/`termine`) :
   soustraire `[début, début + durée + buffer]`.
3. Demandes souples (`horaire_fixe = false`, `en_attente`) : classées par
   `(created_at, id)`, chacune est **placée au premier créneau de sa période** où
   `durée + buffer` tient (première place libre, pas de la grille). Une demande qui
   ne rentre plus (agenda modifié depuis) est ignorée par le calcul, signalée « en surcapacité » dans l'admin.
4. Une période est disponible pour une nouvelle demande s'il reste un créneau où
   `durée` (+ buffer) tient après ce placement. `premier_creneau` = ce créneau.
5. Bornes : date ≥ aujourd'hui (Zurich), `now + anticipation_min_heures` pour
   aujourd'hui, `≤ aujourd'hui + anticipation_max_jours`. Une période = créneaux
   qui commencent avant `heure_coupure_periode` (matin) ou à partir de (après-midi).
6. Google Calendar (si activé) : occupations FreeBusy converties en minutes
   Zurich **pour le bon jour** (fenêtre `T00:00` → `T24:00` Zurich).

Création publique : valider → calculer prix/durée depuis le catalogue → vérifier la
période → rapprocher la CRM → INSERT → **re-vérifier** (même calcul, en incluant la
ligne insérée, ordre `(created_at,id)`) → si la nouvelle demande n'est plus placée,
la supprimer et répondre 409. Côté admin, un conflit renvoie 409 avec `conflicts[]`
sauf `force: true` (l'admin a le dernier mot).

## 4. Contrat d'API

Toutes les routes `/api/admin/*` : `Authorization: Bearer <jeton Supabase>`,
`validateSupabaseToken`. Erreurs : `{ error: string }`. Pas de lecture `anon`.

### Public
- `GET /api/bookings/available-slots?date=YYYY-MM-DD&duration=MIN` → `AvailableDaySlots`.
  400 date invalide / hors bornes ; 503 si la base n'est pas joignable (jamais « tout libre »).
- `GET /api/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&duration=MIN` → `PublicCalendar`
  (≤ 60 jours). Sert à griser les jours fermés / complets dans le formulaire.
- `POST /api/bookings` ← `PublicBookingRequest` → `201 { success, booking: PublicBookingView }`.
  Erreurs : 400 validation, 409 période complète, 422 soin inconnu, 429 débit.
  Honeypot `website` rempli ⇒ répondre 200 factice sans rien écrire.
- `GET /api/bookings/services` (existant) : catalogue public, ids = UUID `services`.

### Admin
- `GET /api/admin/bookings?from&to&statut&clientId&q&limit` → `{ bookings: Booking[] }`
- `POST /api/admin/bookings` ← `BookingPatch` (+ `nom, prenom, telephone, service_nom|service_id, date_rdv, heure_rdv` requis) → `{ booking }`.
  Défauts : `statut='confirme'`, `horaire_fixe=true`, `source='admin'`, `notify_client=false`. Rapproche/crée la fiche CRM.
- `GET /api/admin/bookings/[id]` → `BookingDetail`
- `PATCH /api/admin/bookings/[id]` ← `BookingPatch` → `{ success, booking, warnings: string[] }` | `409 { error, conflicts: BookingConflict[] }`.
  Règles : le serveur **recalcule** `service_duree_minutes`, `total_chf` ; changer date/heure/période d'un rdv écrit un événement `deplacement` ; passer en `confirme` fixe `horaire_fixe=true` (sauf si explicitement false) et `contacte_at` s'il est nul.
  **E-mails** (`notify_client`) : défaut `true` seulement pour (a) 1ʳᵉ confirmation, (b) déplacement d'un rdv déjà confirmé, (c) annulation/refus d'un rdv avec e-mail ; sinon `false`. **Ne jamais renvoyer** l'e-mail si rien de pertinent n'a changé (note, tel., etc.). Chaque envoi ⇒ événement `email` + `confirmation_envoyee_at`.
- `DELETE /api/admin/bookings/[id]` : seulement `en_attente`/`refuse`/`annule` (spam, essais), sinon 409.
- `GET /api/admin/bookings/availability?date&duration&excludeId` → `{ date, ouvert, slots: TimeSlot[] }` créneaux **exacts** (rdv à `excludeId` ignoré), pour choisir l'horaire définitif.
- `GET /api/admin/bookings/agenda?from&to` → `AgendaData` (≤ 62 jours).
- `GET|POST /api/admin/booking-blocks` · `DELETE /api/admin/booking-blocks/[id]`.
  POST `{ date_debut, date_fin?, heure_debut?, heure_fin?, motif? }` → `{ block, impactes: Booking[] }` (rdv actifs touchés : à signaler, jamais annulés automatiquement).
- `GET|PUT /api/admin/booking-settings` : validation stricte (forme de `jours_ouverture`, `fin > debut`, bornes numériques).
- `POST /api/admin/bookings/sync-clients` → `{ rattaches, crees, ignores }` : rattache les rdv sans `client_id` à la CRM.
- Les anciennes routes `/api/bookings/[id]`, `/api/bookings/settings`, `GET /api/bookings` sont supprimées (aucun autre consommateur que l'ancien admin) ou réduites à une redirection 410.

## 5. CRM

Ordre : e-mail exact (insensible à la casse) → téléphone normalisé (`+41791234567`,
gérer `0041`, `0` initial, espaces, points, tirets) comparé en JS sur un lot de
candidats `telephone.ilike.%4 derniers chiffres%` → sinon création. **Jamais de
rapprochement par nom seul** (homonymes) : si nom+prénom correspondent à une fiche
dont le téléphone/e-mail diffèrent, créer quand même et consigner un événement
`crm` « doublon possible ». Consentements créés à `false` ; `true` uniquement si
case cochée (le trigger `clients_consent_stamp` date l'accord) ; ne jamais retirer
un consentement existant. Compléter téléphone/e-mail manquants sans écraser.
Source de consentement : `reservation_en_ligne`.

## 6. Répartition (propriété des fichiers)

- **Service/API** : `src/services/booking.ts`, `src/services/bookingEngine.ts`, `src/app/api/bookings/**`, `src/app/api/admin/bookings/**`, `src/app/api/admin/booking-*`, `scripts/test-booking-engine.ts`.
- **Admin** : `src/app/admin/reservations/**`, `src/app/admin/settings/BookingSettingsPanel.tsx`, composants `src/components/admin/reservations/**`, entrée de menu dans `src/app/admin/layout.tsx` (badge « à appeler »).
- **Public** : `src/app/(public)/reservation/**`.
- Les types vivent dans `src/types/booking.ts` : ajout seulement, jamais de renommage.
