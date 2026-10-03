# Admin mobile — application métier (2026-10-04)

Sous 1024 px (`lg`), l'admin se comporte comme une **application mobile** pour
Emmanuelle (esthéticienne, pas technicienne, surtout sur téléphone). Au-delà, le
bureau (sidebar + topbar) ne change pas.

## 1. Socle livré (ne pas refaire)

- `src/app/admin/layout.tsx` (serveur : metadata, viewport, manifeste `/admin/manifest`) → `AdminShell.tsx` (client).
- **Barre d'onglets** : Accueil · Agenda (pastille « à rappeler ») · **Caisse** (centre) · Clientes · Plus. Écran `/admin/plus` = toutes les sections en tuiles.
- **En-tête mobile** : titre + retour automatiques (table `TITLES` de `src/components/admin/mobile/nav.ts`), recherche, état système. `PageHeader` masque son `<h1>` sous `lg` (reste lu par les lecteurs d'écran) : **ne pas redoubler le titre** ; pour un titre dynamique, `useMobilePageTitle(titre)` (`mobile/shellContext.tsx`).
- **Sous-navigation Caisse** (`CaisseSubNav`) rendue par le shell sur `/admin/caisse/**`.
- Variables CSS : `--admin-tabbar-h`, `--caisse-tabbar-h` ; `.admin-main` ajoute déjà le padding bas (barre d'onglets + safe-area) : ne pas le recompter.
- **Kit UI** `src/components/admin/mobile/ui.tsx` (lire l'en-tête du fichier) : `PageSection`, `ActionTile`, `StatTile`, `ListGroup`/`ListRow`, `Chip`/`ChipBar`, `BottomSheet`, `Fab`, `StickyActionBar`, `SegmentedControl`, `EmptyState`, `Skeleton`. `useAdminShell()` : `openSearch`, `toCallCount`, `appMode`, `logout`…

## 2. Principes de conception (tous les écrans)

1. **Une main, le pouce** : actions principales en bas (`StickyActionBar`, `Fab`), jamais en haut à droite seulement. Cibles ≥ 44 px, espacements ≥ 8 px.
2. **Le moins d'étapes possible** : la tâche la plus fréquente de l'écran en un tap ; le reste dans une feuille du bas (`BottomSheet`), pas dans une nouvelle page quand c'est évitable.
3. **Cartes et listes, pas de tableaux** : une ligne = une carte lisible (titre, sous-titre, valeur clé à droite). Pas de scroll horizontal de la page (un tableau doit devenir une liste de cartes sous `lg`).
4. **Les chiffres qui comptent en grand** (montants `CHF 1'234.50` en `de-CH`, `tabular-nums`), les libellés en français simple, sans jargon.
5. **États complets** : chargement (`Skeleton`), vide (`EmptyState` avec une action), erreur (message + « Réessayer »), succès (confirmation brève). Jamais d'écran blanc ni d'`alert()`/`confirm()` natifs.
6. **Texte ≥ 15 px**, champs à 16 px (anti-zoom iOS), contrastes AA, `aria-*` et focus corrects.
7. **Bureau intact** : toute modification mobile est protégée par `lg:` (mobile par défaut, `lg:` restitue l'existant) ou rendue sous un `lg:hidden` / `hidden lg:block`. Comparer le rendu à 1280 px avant/après.
8. Charte : sauge `accent`, pierre/crème, coins 16–20 px, ombres très douces (cf. kit).

## 3. Contrats entre chantiers

- **Agenda → Caisse** : un rendez-vous confirmé/terminé a un bouton « Encaisser » vers `/admin/caisse?rdv=<bookingId>`. La caisse lit `GET /api/admin/bookings/[id]` (`BookingDetail`, `src/types/booking.ts`), **pré-remplit le panier seulement** (jamais de montant calculé côté navigateur : la facture passe toujours par `caisse_create_transaction`, voir CLAUDE.md), associe `client_id`, puis, **après encaissement réussi**, `PATCH /api/admin/bookings/[id]` `{statut:'termine', notify_client:false}`.
- **Accueil → Agenda** : liens `/admin/reservations?id=<id>` (ouvre le rendez-vous), `?nouveau=1` (nouveau rendez-vous), `?vue=a-traiter` (file des demandes), `?date=YYYY-MM-DD` (agenda sur un jour).
- **Accueil/Agenda → Clientes** : `/admin/caisse/clients?client=<id>` ouvre la fiche (à implémenter par le chantier Caisse-clientes).

## 4. Répartition des fichiers (propriété exclusive)

| Chantier | Fichiers |
|---|---|
| Accueil | `src/app/admin/page.tsx`, `src/components/admin/mobile/home/**` |
| Caisse — encaisser & clientes | `src/app/admin/caisse/CaisseClient.tsx`, `src/app/admin/caisse/page.tsx`, `src/app/admin/caisse/clients/**`, `src/utils/caissePrefill.ts` (ajouts) |
| Caisse — gestion | `src/app/admin/caisse/{journal,bons,prestations,produits,depenses,bilan,cockpit,cabine}/**`, `src/components/admin/CaisseCatalogNav.tsx` |
| Agenda | `src/app/admin/reservations/**`, `src/components/admin/reservations/**`, `src/app/admin/settings/BookingSettingsPanel.tsx` |
| Autres pages | `src/app/admin/{settings,promotions,medias,subscribers,newsletter,blog,events,pages,menu,social,seo,analytics,autopilot,agents,automations,entete-pied}/**` (hors éditeur de pages et contenus déjà adaptés) |
| Socle (figé) | `AdminShell.tsx`, `mobile/ui.tsx`, `nav.ts`, `admin.css`, `components/admin/ui.tsx` — si un besoin manque, crée ton composant dans ton propre dossier ; ne modifie pas le socle. |

## 5. Vérifier (tous)

`npx tsc --noEmit` propre. Aperçu 375×812 (`?screenshot=true` contourne l'auth en test ; les appels API échouent en 401 → fetch bouchonné). **Aucune écriture réelle** (le `.env` pointe sur le vrai projet Supabase), aucun e-mail. Le serveur de dev et le volet navigateur sont **partagés** avec d'autres agents : ouvre ton propre onglet (`tabs_create`), ne ferme pas ceux des autres, n'arrête pas le serveur, ignore le bruit de rechargement à chaud. **Regarde réellement tes captures** avant d'affirmer que c'est bon, et dis honnêtement ce qui n'est pas vérifié.
