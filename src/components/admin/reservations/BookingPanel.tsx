"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Banknote, CalendarClock, Check, ExternalLink, Loader2, MessageCircle, PhoneCall, Trash2, UserRound } from 'lucide-react';
import type {
  Booking,
  BookingConflict,
  BookingDetail,
  BookingOption,
  BookingPatch,
  BookingPeriode,
  BookingSettings,
} from '../../../types/booking';
import { PERIODE_LABEL, STATUT_LABEL } from '../../../types/booking';
import { Button, Field, Input, LinkButton, Textarea } from '../ui';
import { ClientBadge, ContactButtons, StatusPill } from './Bits';
import { useFeedback } from './Feedback';
import { ApiError, DEFAULT_COUPURE, cap, adminFetch, announceBookingsChanged, errorMessage, formatDateLong, formatDateNumeric, formatInstant, fullName, relativeAgo, requestedDate, requestedPeriode, waHref } from './lib';
import type { Catalog } from './hooks';
import Overlay from './Overlay';
import { ConflictsBox, EventsLog, Section } from './PanelParts';
import { ServicePicker, TotalsBar, UpsellBlock, optionsTotals } from './ServiceFields';
import SlotPicker from './SlotPicker';

interface Draft {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  serviceId: string | null;
  serviceNom: string;
  servicePrix: number;
  /** Durée du soin seul (sans options). */
  soinDuree: number;
  serviceChanged: boolean;
  options: BookingOption[];
  date: string;
  heure: string | null;
  /** Garder une simple demande « matin / après-midi » (sans heure précise). */
  soft: boolean;
  periode: BookingPeriode;
  notes: string;
}

function initDraft(b: Booking, coupure: string): Draft {
  const opts = b.options ?? [];
  const optDuree = optionsTotals(opts).duree;
  return {
    prenom: b.prenom ?? '',
    nom: b.nom ?? '',
    telephone: b.telephone ?? '',
    email: b.email ?? '',
    serviceId: b.service_id,
    serviceNom: b.service_nom,
    servicePrix: Number(b.service_prix_chf) || 0,
    soinDuree: Math.max(0, (b.service_duree_minutes || 0) - optDuree),
    serviceChanged: false,
    options: opts,
    date: b.date_rdv,
    heure: b.horaire_fixe ? b.heure_rdv : null,
    soft: false,
    periode: b.periode ?? requestedPeriode(b, coupure),
    notes: b.notes_admin ?? '',
  };
}

/** Ne garde que ce qui a changé : le serveur n'écrit (et ne notifie) que le nécessaire. */
function buildPatch(d: Draft, o: Booking): BookingPatch {
  const p: BookingPatch = {};
  if (d.prenom.trim() !== (o.prenom ?? '')) p.prenom = d.prenom.trim();
  if (d.nom.trim() !== (o.nom ?? '')) p.nom = d.nom.trim();
  if (d.telephone.trim() !== (o.telephone ?? '')) p.telephone = d.telephone.trim();
  if ((d.email.trim() || null) !== (o.email || null)) p.email = d.email.trim() || null;
  if (d.notes.trim() !== (o.notes_admin ?? '').trim()) p.notes_admin = d.notes.trim() || null;

  if (d.serviceChanged) {
    p.service_id = d.serviceId;
    p.service_nom = d.serviceNom;
    p.service_prix_chf = d.servicePrix;
    p.service_duree_soin_minutes = d.soinDuree;
  }
  if (JSON.stringify(d.options) !== JSON.stringify(o.options ?? [])) p.options = d.options;

  const fixed = !d.soft && d.heure !== null;
  if (fixed) {
    if (d.date !== o.date_rdv || d.heure !== o.heure_rdv || !o.horaire_fixe) {
      p.date_rdv = d.date;
      p.heure_rdv = d.heure as string;
      p.horaire_fixe = true;
    }
  } else {
    if (d.date !== o.date_rdv) p.date_rdv = d.date;
    if (d.soft && o.statut === 'en_attente') {
      if (o.horaire_fixe) p.horaire_fixe = false;
      if (d.periode !== o.periode || o.horaire_fixe) p.periode = d.periode;
    }
  }
  return p;
}

function ActionButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={`h-12 text-[15px] ${props.className ?? ''}`} />;
}

export default function BookingPanel({
  bookingId,
  catalog,
  settings,
  onClose,
  onChanged,
  onOpenOther,
}: {
  bookingId: string;
  catalog: Catalog;
  settings: BookingSettings | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenOther: (id: string) => void;
}) {
  const fb = useFeedback();
  const coupure = settings?.heure_coupure_periode || DEFAULT_COUPURE;
  const coupureRef = useRef(coupure);
  coupureRef.current = coupure;
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notify, setNotify] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ list: BookingConflict[]; retry: () => void } | null>(null);
  const [slotKey, setSlotKey] = useState(0);
  const notifyId = useId();
  const notesId = useId();
  const serviceId = useId();

  const load = useCallback(async () => {
    try {
      const json = await adminFetch<BookingDetail>(`/api/admin/bookings/${bookingId}`);
      setDetail(json);
      setDraft(initDraft(json.booking, coupureRef.current));
      setNotify(null);
      setConflicts(null);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [bookingId]);

  useEffect(() => {
    setDetail(null);
    setDraft(null);
    load();
  }, [load]);

  const original = detail?.booking ?? null;
  const patch = useMemo(() => (draft && original ? buildPatch(draft, original) : {}), [draft, original]);
  const dirty = Object.keys(patch).length > 0;

  const set = (changes: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...changes } : d));
    setConflicts(null);
  };

  const guard = async (): Promise<boolean> => {
    if (!dirty) return true;
    const r = await fb.ask({
      title: 'Fermer sans enregistrer ?',
      message: 'Vos modifications ne sont pas enregistrées. Elles seront perdues.',
      confirmLabel: 'Fermer quand même',
      cancelLabel: 'Continuer à modifier',
      tone: 'danger',
    });
    return r.ok;
  };
  const requestClose = async () => {
    if (await guard()) onClose();
  };

  if (loadError || !detail || !draft || !original) {
    return (
      <Overlay title="Rendez-vous" onClose={onClose}>
        {loadError ? (
          <div className="space-y-3">
            <p role="alert" className="text-[15px] font-medium text-red-700">
              {loadError}
            </p>
            <Button onClick={load} className="h-11">
              Réessayer
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[15px] text-stone-700">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </p>
        )}
      </Overlay>
    );
  }

  const b = original;
  const statut = b.statut;
  const editableSchedule = statut === 'en_attente' || statut === 'confirme';
  const hasEmail = draft.email.trim().length > 0;
  const opt = optionsTotals(draft.options);
  const totalPrix = Math.round((draft.servicePrix + opt.prix) * 100) / 100;
  const totalDuree = draft.soinDuree + opt.duree;
  const fixedNow = !draft.soft && draft.heure !== null;
  const moved = statut === 'confirme' && (draft.date !== b.date_rdv || (draft.heure !== null && draft.heure !== b.heure_rdv));
  // Un rendez-vous à horaire fixe dont on a changé le jour mais pas encore choisi l'heure :
  // on ne laisse ni enregistrer (le serveur garderait l'ancienne heure) ni prévenir la cliente.
  const timeChosen = draft.heure !== null;
  const needsTime = !draft.soft && !timeChosen && (b.horaire_fixe || statut === 'confirme');
  const notifyShown = hasEmail && timeChosen && (notify ?? (statut === 'en_attente' || moved));
  const canConfirm = Boolean(draft.heure) && !draft.soft && draft.prenom.trim() !== '' && draft.telephone.trim() !== '';
  const waOther = waHref(
    draft.telephone,
    `Bonjour ${draft.prenom}, c’est Emmanuelle. Pour votre « ${draft.serviceNom} », ` +
      (fixedNow
        ? `je peux vous proposer le ${formatDateLong(draft.date)} à ${draft.heure}. `
        : `je peux vous proposer un autre horaire. `) +
      `Est-ce que cela vous convient ?`,
  );
  const waFirst = `Bonjour ${draft.prenom}, c’est Emmanuelle de l’institut. Je vous contacte au sujet de votre demande de rendez-vous pour « ${draft.serviceNom} ».`;

  // ── Envoi au serveur ──────────────────────────────────────────────────────

  const submit = async (
    body: BookingPatch,
    label: string,
    opts: { success: string; closeAfter?: boolean },
  ) => {
    setBusy(label);
    setConflicts(null);
    try {
      const res = await adminFetch<{ warnings?: string[] }>(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      (res.warnings ?? []).forEach((w) => fb.info(w));
      fb.success(opts.success);
      announceBookingsChanged();
      onChanged();
      if (opts.closeAfter) {
        onClose();
      } else {
        await load();
        setSlotKey((k) => k + 1);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.conflicts?.length) {
        const list = e.conflicts;
        setConflicts({ list, retry: () => submit({ ...body, force: true }, label, opts) });
      } else {
        fb.error(errorMessage(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (needsTime) return;
    const sendMail = statut === 'en_attente' ? false : moved ? hasEmail && (notify ?? true) : hasEmail && notify === true;
    return submit({ ...patch, notify_client: sendMail }, 'save', { success: 'Modifications enregistrées.' });
  };

  const confirm = () =>
    submit(
      {
        ...patch,
        statut: 'confirme',
        horaire_fixe: true,
        date_rdv: draft.date,
        heure_rdv: draft.heure as string,
        notify_client: hasEmail && (notify ?? true),
      },
      'confirm',
      {
        success: `Rendez-vous confirmé le ${formatDateLong(draft.date)} à ${draft.heure}.`,
        closeAfter: true,
      },
    );

  const closeWith = async (
    next: 'refuse' | 'annule' | 'termine',
    opts: { title: string; message: string; confirmLabel: string; success: string; mail?: boolean },
  ) => {
    const r = await fb.ask({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel,
      tone: next === 'termine' ? 'default' : 'danger',
      checkbox: opts.mail
        ? {
            label: 'Prévenir la cliente par e-mail',
            defaultChecked: hasEmail,
            disabled: !hasEmail,
            hint: hasEmail ? undefined : 'Pas d’adresse e-mail pour cette cliente.',
          }
        : undefined,
    });
    if (!r.ok) return;
    await submit({ statut: next, notify_client: Boolean(opts.mail && r.checked && hasEmail) }, next, {
      success: opts.success,
      closeAfter: true,
    });
  };

  const markCalled = () => submit({ contacte_at: new Date().toISOString(), notify_client: false }, 'called', { success: 'C’est noté : appelée.' });

  const remove = async () => {
    const r = await fb.ask({
      title: 'Supprimer ce rendez-vous ?',
      message: `La demande de ${fullName(b)} sera effacée définitivement. À utiliser pour les doublons, essais ou messages indésirables.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    });
    if (!r.ok) return;
    setBusy('delete');
    try {
      await adminFetch(`/api/admin/bookings/${bookingId}`, { method: 'DELETE' });
      fb.success('Rendez-vous supprimé.');
      announceBookingsChanged();
      onChanged();
      onClose();
    } catch (e) {
      fb.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pickService = (id: string) => {
    const s = catalog.services.find((x) => x.id === id);
    if (!s) return;
    set({ serviceId: s.id, serviceNom: s.name, servicePrix: s.priceChf, soinDuree: s.durationMinutes, serviceChanged: true });
  };

  const switchBooking = async (id: string) => {
    if (await guard()) onOpenOther(id);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const canDelete = statut === 'en_attente' || statut === 'refuse' || statut === 'annule';
  const demandedDate = requestedDate(b);
  const demandedPer = requestedPeriode(b, coupure);

  const footer = (
    <div className="space-y-2">
      {needsTime && (
        <p role="status" className="text-[14px] font-semibold text-amber-900">
          Choisissez une heure (dans « L’horaire ») avant d’enregistrer.
        </p>
      )}
      {statut === 'en_attente' && !needsTime && !canConfirm && (
        <p role="status" className="text-[14px] font-semibold text-amber-900">
          {draft.soft ? 'Choisissez une heure précise pour confirmer.' : !draft.heure ? 'Choisissez une heure pour pouvoir confirmer.' : 'Renseignez le prénom et le téléphone.'}
        </p>
      )}
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      {dirty && (
        <ActionButton loading={busy === 'save'} disabled={busy !== null || needsTime} onClick={save} className="sm:order-1" icon={Check}>
          Enregistrer
        </ActionButton>
      )}
      {statut === 'en_attente' && (
        <ActionButton
          variant="primary"
          loading={busy === 'confirm'}
          disabled={!canConfirm || (busy !== null && busy !== 'confirm')}
          onClick={confirm}
          className="sm:order-2"
          icon={CalendarClock}
        >
          Confirmer avec cet horaire
        </ActionButton>
      )}
      {!dirty && statut !== 'en_attente' && (
        <ActionButton onClick={requestClose}>Fermer</ActionButton>
      )}
      {!dirty && (statut === 'confirme' || statut === 'termine') && (
        <LinkButton href={`/admin/caisse?rdv=${b.id}`} variant="primary" icon={Banknote} className="h-12 text-[15px] sm:order-3">
          Encaisser
        </LinkButton>
      )}
    </div>
    </div>
  );

  return (
    <Overlay
      title={fullName(b) || 'Rendez-vous'}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill statut={statut} />
          <span className="text-[13.5px]">Demande reçue {relativeAgo(b.created_at)}</span>
        </span>
      }
      onClose={requestClose}
      footer={footer}
    >
      <div className="space-y-7">
        {/* Contact rapide : collé en haut de la feuille sur téléphone, toujours à portée du pouce. */}
        <div className="sticky top-0 z-10 -mx-5 -mt-2 border-b border-stone-100 bg-white/95 px-5 pb-3 pt-2 backdrop-blur lg:static lg:mx-0 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <ContactButtons booking={{ ...b, telephone: draft.telephone, prenom: draft.prenom }} whatsappMessage={waFirst} />
        </div>
        {statut === 'en_attente' && (
            <div className="-mt-4 flex flex-wrap items-center gap-3">
              {b.contacte_at ? (
                <p className="flex items-center gap-1.5 text-[14px] font-medium text-emerald-800">
                  <PhoneCall size={15} aria-hidden="true" /> Appelée {relativeAgo(b.contacte_at)}
                </p>
              ) : (
                <>
                  <Button onClick={markCalled} loading={busy === 'called'} disabled={busy !== null || dirty} icon={PhoneCall} className="h-11">
                    Je l’ai appelée
                  </Button>
                  {dirty && <p className="text-[13.5px] text-stone-700">Enregistrez d’abord vos modifications.</p>}
                </>
              )}
            </div>
        )}

        {/* Demande d'origine */}
        <div className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-[15px] text-stone-800">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-stone-600">Ce que la cliente a demandé</p>
          <p className="mt-1">
            <span className="font-semibold text-stone-950">{cap(formatDateLong(demandedDate))}</span> · {PERIODE_LABEL[demandedPer]}
          </p>
          {b.notes_cliente && <p className="mt-1 italic text-stone-700">« {b.notes_cliente} »</p>}
          {b.offer_of_month_id && <p className="mt-1 text-[14px] text-stone-700">Elle a choisi l’offre du mois.</p>}
        </div>

        {conflicts && (
          <ConflictsBox
            conflicts={conflicts.list}
            busy={busy !== null}
            onForce={conflicts.retry}
            onDismiss={() => setConflicts(null)}
          />
        )}

        {/* Cliente */}
        <Section title="La cliente">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="bp-prenom">
              <Input id="bp-prenom" value={draft.prenom} onChange={(e) => set({ prenom: e.target.value })} className="!h-12 text-[16px]" autoComplete="off" />
            </Field>
            <Field label="Nom" htmlFor="bp-nom">
              <Input id="bp-nom" value={draft.nom} onChange={(e) => set({ nom: e.target.value })} className="!h-12 text-[16px]" autoComplete="off" />
            </Field>
            <Field label="Téléphone" htmlFor="bp-tel">
              <Input id="bp-tel" type="tel" value={draft.telephone} onChange={(e) => set({ telephone: e.target.value })} className="!h-12 text-[16px]" />
            </Field>
            <Field label="E-mail" htmlFor="bp-mail">
              <Input id="bp-mail" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} className="!h-12 text-[16px]" />
            </Field>
          </div>

          <div className="rounded-xl border border-stone-300 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-stone-950">
                <UserRound size={17} aria-hidden="true" /> Fiche cliente
              </p>
              <ClientBadge clientId={b.client_id} visites={detail.client?.visites ?? 0} />
            </div>
            {detail.client ? (
              <div className="mt-2 space-y-2 text-[14.5px] text-stone-800">
                <p>
                  <strong>{detail.client.visites}</strong> passage{detail.client.visites > 1 ? 's' : ''} en caisse
                  {detail.client.derniere_visite ? ` · dernier le ${formatDateNumeric(detail.client.derniere_visite.slice(0, 10))}` : ''}
                </p>
                {detail.client.notes ? (
                  <p className="whitespace-pre-line rounded-lg bg-stone-50 px-3 py-2 text-stone-800">
                    <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-stone-600">Notes de la fiche</span>
                    {detail.client.notes}
                  </p>
                ) : (
                  <p className="text-stone-600">Pas de note sur la fiche.</p>
                )}
                <Link
                  href={`/admin/caisse/clients?client=${detail.client.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-[14.5px] font-semibold text-accent underline underline-offset-2 hover:no-underline"
                >
                  Voir la fiche <ExternalLink size={14} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-stone-700">
                Cette demande n’est pas encore rattachée à la clientèle. Le bouton « Rattacher les réservations à la clientèle » (en bas de la page Réservations) s’en charge.
              </p>
            )}

            {detail.historique.length > 0 && (
              <div className="mt-3 border-t border-stone-200 pt-3">
                <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-stone-600">Rendez-vous précédents</p>
                <ul className="divide-y divide-stone-100">
                  {detail.historique.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => switchBooking(h.id)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-[14px] hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-stone-950">{formatDateNumeric(h.date_rdv)}</span>
                          <span className="block truncate text-stone-700">{h.service_nom}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-medium text-stone-700">{STATUT_LABEL[h.statut]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* Soin + upsell */}
        <Section title="Le soin" hint="Changez le soin ou proposez une option : le total se met à jour tout de suite.">
          <div>
            <label htmlFor={serviceId} className="mb-1.5 block text-[14px] font-semibold text-stone-900">
              Soin principal
            </label>
            <ServicePicker id={serviceId} catalog={catalog} value={draft.serviceId} currentLabel={draft.serviceNom} onPick={pickService} />
          </div>
          <UpsellBlock options={draft.options} onChange={(o) => set({ options: o })} catalogOptions={catalog.options} catalogServices={catalog.services} />
          <TotalsBar prix={totalPrix} duree={totalDuree} />
          {totalDuree <= 0 && (
            <p className="text-[13.5px] text-amber-900">La durée du soin n’est pas connue : vérifiez-la avant de choisir l’heure.</p>
          )}
        </Section>

        {/* Horaire */}
        <Section
          title="L’horaire"
          hint={
            editableSchedule
              ? statut === 'en_attente'
                ? 'Après avoir appelé la cliente, choisissez l’heure exacte. Elle sera bloquée dans votre agenda.'
                : 'Pour déplacer le rendez-vous, choisissez un autre jour ou une autre heure.'
              : undefined
          }
        >
          {editableSchedule ? (
            <>
              {!draft.soft ? (
                <SlotPicker
                  date={draft.date}
                  onDate={(d) => set({ date: d })}
                  duration={totalDuree}
                  excludeId={bookingId}
                  value={draft.heure}
                  onChange={(h) => set({ heure: h })}
                  refreshKey={slotKey}
                />
              ) : (
                <div className="space-y-3">
                  <Field label="Jour" htmlFor="bp-date-soft">
                    <Input id="bp-date-soft" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className="!h-12 text-[16px]" />
                  </Field>
                  <fieldset>
                    <legend className="mb-1.5 text-[14px] font-semibold text-stone-900">Période</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(['matin', 'apres_midi'] as BookingPeriode[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={draft.periode === p}
                          onClick={() => set({ periode: p })}
                          className={`h-12 rounded-lg border text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                            draft.periode === p ? 'border-accent bg-accent text-accent-fg' : 'border-stone-300 bg-white text-stone-900 hover:bg-accent-soft'
                          }`}
                        >
                          {PERIODE_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
              {statut === 'en_attente' && (
                <button
                  type="button"
                  onClick={() => set({ soft: !draft.soft })}
                  className="min-h-11 text-left text-[14px] font-semibold text-accent underline underline-offset-2 hover:no-underline"
                >
                  {draft.soft ? 'Choisir une heure précise' : 'Garder une simple demande (matin ou après-midi, sans heure)'}
                </button>
              )}
              {statut === 'en_attente' && !draft.soft && !draft.heure && (
                <p className="text-[14px] text-stone-700">Choisissez une heure ci-dessus pour pouvoir confirmer.</p>
              )}
            </>
          ) : (
            <p className="text-[15px] text-stone-800">
              <span className="font-semibold">{cap(formatDateLong(b.date_rdv))}</span>
              {b.horaire_fixe ? ` à ${b.heure_rdv}` : ` · ${PERIODE_LABEL[requestedPeriode(b, coupure)]}`}
            </p>
          )}
          {statut === 'confirme' && b.confirmation_envoyee_at && (
            <p className="text-[13.5px] text-stone-600">E-mail de confirmation envoyé le {formatInstant(b.confirmation_envoyee_at)}.</p>
          )}
          {waOther && (
            <a
              href={waOther}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 text-[15px] font-semibold text-emerald-900 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:w-auto"
            >
              <MessageCircle size={18} aria-hidden="true" /> Proposer un autre horaire par WhatsApp
            </a>
          )}
        </Section>

        {/* Notes + e-mail */}
        <Section title="Notes et prévenir la cliente">
          <div>
            <label htmlFor={notesId} className="mb-1.5 block text-[14px] font-semibold text-stone-900">
              Notes pour vous (la cliente ne les voit pas)
            </label>
            <Textarea id={notesId} rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} className="text-[16px]" placeholder="Ex. : préfère les rendez-vous tôt, peau sensible…" />
          </div>
          <div className="rounded-xl border border-stone-300 bg-white p-3">
            <label htmlFor={notifyId} className={`flex min-h-11 items-center gap-3 text-[15px] font-semibold ${hasEmail ? 'cursor-pointer text-stone-950' : 'cursor-not-allowed text-stone-500'}`}>
              <input
                id={notifyId}
                type="checkbox"
                className="size-5 accent-[var(--admin-accent)]"
                checked={notifyShown}
                disabled={!hasEmail}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Prévenir la cliente par e-mail
            </label>
            <p className="mt-1 text-[13.5px] text-stone-700">
              {!hasEmail
                ? 'Pas d’adresse e-mail pour cette cliente : appelez-la ou écrivez-lui sur WhatsApp.'
                : statut === 'en_attente'
                  ? 'Elle recevra un e-mail avec l’horaire choisi quand vous cliquerez sur « Confirmer avec cet horaire ».'
                  : moved
                    ? 'Le rendez-vous change de jour ou d’heure : il vaut mieux la prévenir.'
                    : 'Aucun e-mail n’est envoyé si rien d’important ne change.'}
            </p>
          </div>
        </Section>

        {/* Autres actions */}
        <Section title="Autres actions">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {statut === 'confirme' && (
              <ActionButton
                disabled={busy !== null || dirty}
                loading={busy === 'termine'}
                icon={Check}
                onClick={() =>
                  closeWith('termine', {
                    title: 'Marquer comme terminé ?',
                    message: `Le soin de ${fullName(b)} a bien eu lieu.`,
                    confirmLabel: 'Oui, terminé',
                    success: 'Rendez-vous marqué comme terminé.',
                  })
                }
              >
                Marquer terminé
              </ActionButton>
            )}
            {statut === 'en_attente' && (
              <ActionButton
                variant="danger"
                disabled={busy !== null}
                onClick={() =>
                  closeWith('refuse', {
                    title: 'Refuser cette demande ?',
                    message: `La demande de ${fullName(b)} sera refusée et le créneau libéré.`,
                    confirmLabel: 'Refuser la demande',
                    success: 'Demande refusée.',
                    mail: true,
                  })
                }
              >
                Refuser la demande
              </ActionButton>
            )}
            {statut === 'confirme' && (
              <ActionButton
                variant="danger"
                disabled={busy !== null}
                onClick={() =>
                  closeWith('annule', {
                    title: 'Annuler ce rendez-vous ?',
                    message: `Le rendez-vous du ${formatDateLong(b.date_rdv)} à ${b.heure_rdv} sera annulé et le créneau libéré.`,
                    confirmLabel: 'Annuler le rendez-vous',
                    success: 'Rendez-vous annulé.',
                    mail: true,
                  })
                }
              >
                Annuler le rendez-vous
              </ActionButton>
            )}
            {canDelete && (
              <ActionButton variant="danger" disabled={busy !== null} loading={busy === 'delete'} icon={Trash2} onClick={remove}>
                Supprimer
              </ActionButton>
            )}
          </div>
          {dirty && statut === 'confirme' && <p className="text-[13.5px] text-stone-700">Enregistrez d’abord vos modifications pour terminer le rendez-vous.</p>}
        </Section>

        <EventsLog events={detail.events} />
      </div>
    </Overlay>
  );
}
