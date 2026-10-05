"use client";

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ImageIcon, Save, X } from 'lucide-react';
import { Button, Callout, Field, Input, Textarea, ToggleRow } from '../../../components/admin/ui';
import { createOffer, updateOffer } from '../../../services/offers';
import type { Offer, OfferErrors, OfferInput, OfferStats } from '../../../types/offers';
import {
  OFFER_STATUS_LABEL, formatOfferPeriod, offerDescriptionHtml, offerStatus, placesPrises, validateOffer,
} from '../../../types/offers';
import { addDays, todayZurich } from '../../(public)/reservation/dates';

const MediaPickerModal = dynamic(() => import('../../../components/pagebuilder/MediaPickerModal'), { ssr: false });
// Même éditeur que les blocs texte du page builder : gras, intertitres, listes à puces (l'algue sur le site), liens.
const RichTextEditor = dynamic(() => import('../../../components/blocks/editor/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="min-h-[140px] rounded-lg border border-stone-200 bg-stone-50" />,
});

/** Formulaire vierge : une offre de quinze jours qui commence aujourd'hui. */
export function blankOffer(): OfferInput {
  const today = todayZurich();
  return {
    titre: '',
    description: '',
    prix_chf: 0,
    prix_normal_chf: null,
    duree_minutes: 60,
    conditions: '',
    image_url: '',
    date_debut: today,
    date_fin: addDays(today, 14),
    places_max: null,
    reservable_en_ligne: true,
    active: true,
  };
}

/** Copie d'une ancienne offre pour la relancer : nouvelles dates, compteurs repartis de zéro. */
export function relaunchFrom(o: Offer): OfferInput {
  const today = todayZurich();
  const span = Math.max(0, Math.round((new Date(`${o.date_fin}T12:00:00Z`).getTime() - new Date(`${o.date_debut}T12:00:00Z`).getTime()) / 86_400_000));
  return {
    titre: o.titre,
    description: offerDescriptionHtml(o.description),
    prix_chf: o.prix_chf,
    prix_normal_chf: o.prix_normal_chf,
    duree_minutes: o.duree_minutes,
    conditions: o.conditions ?? '',
    image_url: o.image_url ?? '',
    date_debut: today,
    date_fin: addDays(today, span),
    places_max: o.places_max,
    reservable_en_ligne: o.reservable_en_ligne,
    active: true,
  };
}

function toInput(o: Offer): OfferInput {
  return {
    titre: o.titre,
    // Une ancienne description en texte brut arrive en paragraphes dans l'éditeur.
    description: offerDescriptionHtml(o.description),
    prix_chf: o.prix_chf,
    prix_normal_chf: o.prix_normal_chf,
    duree_minutes: o.duree_minutes,
    conditions: o.conditions ?? '',
    image_url: o.image_url ?? '',
    date_debut: o.date_debut,
    date_fin: o.date_fin,
    places_max: o.places_max,
    reservable_en_ligne: o.reservable_en_ligne,
    active: o.active,
  };
}

/** Champ montant / nombre saisi en texte : « 99 », « 99.50 », « 99,50 ». */
function parseNum(v: string): number | null {
  const t = v.trim().replace(',', '.').replace(/[’'\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export default function OfferEditor({ offer, initial, stats, onClose, onSaved }: {
  /** Offre modifiée, ou `null` pour une création. */
  offer: Offer | null;
  /** Valeurs de départ d'une création (formulaire vierge ou relance). */
  initial?: OfferInput;
  stats?: OfferStats;
  onClose: () => void;
  onSaved: (o: Offer) => void;
}) {
  const start = useMemo(() => (offer ? toInput(offer) : initial ?? blankOffer()), [offer, initial]);
  const [form, setForm] = useState<OfferInput>(start);
  // Champs numériques gardés en texte pendant la saisie (« 99, » ne doit pas sauter).
  const [prix, setPrix] = useState(start.prix_chf ? String(start.prix_chf) : '');
  const [prixNormal, setPrixNormal] = useState(start.prix_normal_chf != null ? String(start.prix_normal_chf) : '');
  const [duree, setDuree] = useState(String(start.duree_minutes));
  const [places, setPlaces] = useState(start.places_max != null ? String(start.places_max) : '');
  const [errors, setErrors] = useState<OfferErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgShape, setImgShape] = useState<'carre' | 'autre' | null>(null);

  const set = <K extends keyof OfferInput>(k: K, v: OfferInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Format de l'image : on prévient si elle n'est pas carrée (le site la recadre en 1:1).
  useEffect(() => {
    setImgShape(null);
    const url = form.image_url?.trim();
    if (!url) return;
    const img = new window.Image();
    img.onload = () => {
      const r = img.naturalWidth / Math.max(1, img.naturalHeight);
      setImgShape(r > 0.95 && r < 1.05 ? 'carre' : 'autre');
    };
    img.src = url;
  }, [form.image_url]);

  // Fermeture au clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pickerOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerOpen]);

  const current: OfferInput = {
    ...form,
    prix_chf: parseNum(prix) ?? NaN,
    prix_normal_chf: parseNum(prixNormal),
    duree_minutes: parseNum(duree) ?? NaN,
    places_max: parseNum(places),
  };
  const today = todayZurich();
  const prises = placesPrises(stats);
  const statusPreview = offerStatus(
    { ...current, archived_at: offer?.archived_at ?? null, places_max: Number.isFinite(current.places_max) ? current.places_max : null },
    stats,
    today,
  );

  const submit = async () => {
    const errs = validateOffer(current);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }
    setSaving(true); setSaveError(null);
    try {
      const saved = offer ? await updateOffer(offer.id, current) : await createOffer(current);
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(
        /column|colonne|schema|monthly_offer_stats/i.test(msg)
          ? 'La base n’a pas encore les colonnes des offres du moment : appliquez supabase/migrations/20261005_offres_du_moment.sql dans Supabase.'
          : `L’offre n’a pas été enregistrée (${msg}). Réessayez.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const insertPlacesCondition = () => {
    const n = parseNum(places);
    if (!n || !Number.isInteger(n)) return;
    const phrase = `Réservé aux ${n} premières clientes.`;
    set('conditions', form.conditions?.trim() ? `${form.conditions.trim()}\n${phrase}` : phrase);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={offer ? `Modifier l’offre ${offer.titre}` : 'Nouvelle offre du moment'}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl h-full overflow-y-auto shadow-2xl max-lg:overscroll-contain"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-4 max-lg:px-3 max-lg:pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-stone-900 truncate">{offer ? 'Modifier l’offre' : 'Nouvelle offre du moment'}</p>
            <p className="text-[12.5px] text-stone-600">
              {OFFER_STATUS_LABEL[statusPreview]}
              {current.date_debut && current.date_fin && current.date_fin >= current.date_debut
                ? ` · ${formatOfferPeriod(current.date_debut, current.date_fin)}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" icon={Save} loading={saving} onClick={submit}>
              Enregistrer
            </Button>
            <button onClick={onClose} aria-label="Fermer" className="shrink-0 p-1.5 max-lg:grid max-lg:size-11 max-lg:place-items-center max-lg:p-0 text-stone-600 hover:text-stone-900 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="p-5 max-lg:p-3 space-y-5 pb-24">
          {saveError && <Callout tone="danger">{saveError}</Callout>}

          {/* ── Image ─────────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
            <h2 className="text-[15px] font-semibold text-stone-900">Image</h2>
            <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-100">
              {form.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-center text-[13px] text-stone-600 px-6">
                  <span><ImageIcon size={22} className="mx-auto mb-2 text-stone-500" aria-hidden="true" />Visuel carré, par exemple 1200 × 1200 px.</span>
                </div>
              )}
            </div>
            {imgShape === 'autre' && (
              <p className="flex items-start gap-1.5 text-[13px] text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                Cette image n’est pas carrée : le site, la réservation et la caisse la recadreront en carré, et ses bords pourront être coupés.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" icon={ImageIcon} onClick={() => setPickerOpen(true)}>
                {form.image_url ? 'Changer d’image' : 'Choisir une image'}
              </Button>
              {form.image_url && (
                <Button type="button" size="sm" variant="ghost" onClick={() => set('image_url', '')}>Retirer</Button>
              )}
            </div>
            {errors.image_url && <p className="text-[12.5px] text-red-600">{errors.image_url}</p>}
          </section>

          {/* ── Contenu ──────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <h2 className="text-[15px] font-semibold text-stone-900">L’offre</h2>
            <Field label="Titre" htmlFor="of-titre" required error={errors.titre}>
              <Input
                id="of-titre" value={form.titre} maxLength={120} aria-invalid={!!errors.titre}
                onChange={(e) => set('titre', e.target.value)}
                placeholder="Rituel d’automne : soin visage + massage du dos"
              />
            </Field>
            <Field label="Description" hint="Ce que comprend le soin, ce qu’il apporte. Les listes à puces s’affichent avec l’algue sur le site.">
              <RichTextEditor value={form.description ?? ''} onChange={(html) => set('description', html)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Tarif de l’offre (CHF)" htmlFor="of-prix" required error={errors.prix_chf}>
                <Input id="of-prix" inputMode="decimal" value={prix} aria-invalid={!!errors.prix_chf} onChange={(e) => setPrix(e.target.value)} placeholder="99" />
              </Field>
              <Field label="Prix habituel (CHF)" htmlFor="of-prixn" hint="Facultatif, affiché barré." error={errors.prix_normal_chf}>
                <Input id="of-prixn" inputMode="decimal" value={prixNormal} aria-invalid={!!errors.prix_normal_chf} onChange={(e) => setPrixNormal(e.target.value)} placeholder="140" />
              </Field>
              <Field label="Durée (minutes)" htmlFor="of-duree" required hint="Pour placer le rendez-vous." error={errors.duree_minutes}>
                <Input id="of-duree" inputMode="numeric" value={duree} aria-invalid={!!errors.duree_minutes} onChange={(e) => setDuree(e.target.value)} />
              </Field>
            </div>
          </section>

          {/* ── Conditions ───────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <h2 className="text-[15px] font-semibold text-stone-900">Période et conditions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Du" htmlFor="of-debut" required error={errors.date_debut}>
                <Input id="of-debut" type="date" value={form.date_debut} aria-invalid={!!errors.date_debut} onChange={(e) => set('date_debut', e.target.value)} />
              </Field>
              <Field label="Au (inclus)" htmlFor="of-fin" required error={errors.date_fin}>
                <Input id="of-fin" type="date" value={form.date_fin} min={form.date_debut} aria-invalid={!!errors.date_fin} onChange={(e) => set('date_fin', e.target.value)} />
              </Field>
            </div>
            <p className="text-[12.5px] text-stone-600 -mt-2">
              Pendant ces dates, l’offre apparaît d’elle-même sur le site, dans la réservation en ligne et en caisse.
              C’est la date du soin qui compte : une cliente ne peut réserver qu’un jour compris dans la période.
            </p>
            <Field
              label="Nombre de places" htmlFor="of-places" error={errors.places_max}
              hint={<>Laissez vide pour ne pas limiter. Une fois toutes les places prises (réservations à venir + soins encaissés), l’offre disparaît du site.{offer && prises > 0 ? <> <strong>{prises}</strong> place{prises > 1 ? 's' : ''} déjà prise{prises > 1 ? 's' : ''}.</> : null}</>}
            >
              <div className="flex gap-2">
                <Input id="of-places" inputMode="numeric" value={places} aria-invalid={!!errors.places_max} onChange={(e) => setPlaces(e.target.value)} placeholder="Illimité" className="w-40" />
                {parseNum(places) ? (
                  <Button type="button" size="sm" variant="ghost" onClick={insertPlacesCondition}>
                    Ajouter « réservé aux {parseNum(places)} premières clientes »
                  </Button>
                ) : null}
              </div>
            </Field>
            {offer && Number.isFinite(current.places_max) && current.places_max != null && current.places_max < prises && (
              <Callout tone="warning">
                {prises} places sont déjà prises : avec {current.places_max} places, l’offre sera complète et quittera le site.
                Les rendez-vous existants ne sont pas annulés.
              </Callout>
            )}
            <Field label="Conditions" htmlFor="of-cond" hint="Affichées sous l’offre, telles quelles. Une condition par ligne.">
              <Textarea
                id="of-cond" rows={3} value={form.conditions ?? ''}
                onChange={(e) => set('conditions', e.target.value)}
                placeholder={'Réservé aux 20 premières clientes.\nNon cumulable avec un bon cadeau.'}
              />
            </Field>
          </section>

          {/* ── Diffusion ────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl px-5 py-2 divide-y divide-stone-100">
            <ToggleRow
              title="Réservable en ligne"
              description="La cliente peut choisir l’offre dans le formulaire de réservation. Sinon, le bouton du site mène à la page Contact."
              checked={form.reservable_en_ligne}
              onChange={(v) => set('reservable_en_ligne', v)}
            />
            <ToggleRow
              title="Publiée"
              description="Désactivé : brouillon, visible ici seulement — ni sur le site ni en caisse, même pendant la période."
              checked={form.active}
              onChange={(v) => set('active', v)}
            />
          </section>

          <div className="flex justify-end">
            <Button variant="primary" icon={Save} loading={saving} onClick={submit}>
              Enregistrer l’offre
            </Button>
          </div>
        </div>
      </div>
    </div>

    {/* Hors du voile : un clic dans la médiathèque (portail) remonterait sinon jusqu'à lui et fermerait l'éditeur. */}
    <MediaPickerModal
      isOpen={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={(url) => { set('image_url', url); setPickerOpen(false); }}
    />
    </>
  );
}
