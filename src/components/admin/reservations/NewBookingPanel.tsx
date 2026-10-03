"use client";

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Search, UserPlus, UserRound, X } from 'lucide-react';
import { listClients, matchClient } from '../../../services/caisse';
import { clientFullName } from '../../../types/caisse';
import type { Client } from '../../../types/caisse';
import type { BookingConflict, BookingOption, BookingPatch } from '../../../types/booking';
import { Button, Field, Input, Textarea } from '../ui';
import { useFeedback } from './Feedback';
import type { Catalog } from './hooks';
import { ApiError, adminFetch, announceBookingsChanged, errorMessage, formatDateLong, todayZurich } from './lib';
import Overlay from './Overlay';
import { ConflictsBox, Section } from './PanelParts';
import { ServicePicker, TotalsBar, UpsellBlock, optionsTotals } from './ServiceFields';
import SlotPicker from './SlotPicker';

type Source = 'telephone' | 'admin';

/**
 * Nouveau rendez-vous pris par téléphone ou sur place.
 * La cliente se choisit dans la clientèle existante ; sinon on saisit ses
 * coordonnées et le serveur crée la fiche.
 */
export default function NewBookingPanel({
  catalog,
  initialDate,
  initialTime,
  initialClientId,
  onClose,
  onCreated,
}: {
  catalog: Catalog;
  initialDate?: string;
  initialTime?: string | null;
  /** Cliente pré-sélectionnée (lien `?nouveau=1&client=<id>` depuis sa fiche). */
  initialClientId?: string;
  onClose: () => void;
  onCreated: (id: string | null) => void;
}) {
  const fb = useFeedback();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientsError, setClientsError] = useState(false);
  const [mode, setMode] = useState<'existante' | 'nouvelle'>('existante');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Client | null>(null);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  const [freeService, setFreeService] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [freeNom, setFreeNom] = useState('');
  const [freePrix, setFreePrix] = useState('');
  const [freeDuree, setFreeDuree] = useState('');
  const [options, setOptions] = useState<BookingOption[]>([]);

  const [date, setDate] = useState(initialDate || todayZurich());
  const [heure, setHeure] = useState<string | null>(initialTime ?? null);
  const [source, setSource] = useState<Source>('telephone');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(false);

  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<BookingConflict[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const searchId = useId();
  const notesId = useId();

  useEffect(() => {
    let active = true;
    listClients(false)
      .then((c) => {
        if (!active) return;
        setClients(c);
        const known = initialClientId ? c.find((x) => x.id === initialClientId) : undefined;
        if (known) {
          setMode('existante');
          setPicked(known);
          setPrenom(known.prenom ?? '');
          setNom(known.nom ?? '');
          setTelephone(known.telephone ?? '');
          setEmail(known.email ?? '');
        }
      })
      .catch(() => active && (setClients([]), setClientsError(true), setMode('nouvelle')));
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    if (!clients || !search.trim()) return [];
    return clients.filter((c) => matchClient(c, search)).slice(0, 6);
  }, [clients, search]);

  const pickClient = (c: Client) => {
    setPicked(c);
    setPrenom(c.prenom ?? '');
    setNom(c.nom ?? '');
    setTelephone(c.telephone ?? '');
    setEmail(c.email ?? '');
    setSearch('');
  };

  const service = catalog.services.find((s) => s.id === serviceId) ?? null;
  const optTot = optionsTotals(options);
  const soinPrix = freeService ? parseFloat(freePrix.replace(',', '.')) || 0 : (service?.priceChf ?? 0);
  const soinDuree = freeService ? parseInt(freeDuree, 10) || 0 : (service?.durationMinutes ?? 0);
  const totalPrix = Math.round((soinPrix + optTot.prix) * 100) / 100;
  const totalDuree = soinDuree + optTot.duree;
  const hasEmail = email.trim().length > 0;

  const validate = (): string | null => {
    if (!prenom.trim() || !nom.trim()) return 'Indiquez le prénom et le nom de la cliente.';
    if (!telephone.trim()) return 'Le numéro de téléphone est nécessaire.';
    if (freeService) {
      if (!freeNom.trim()) return 'Indiquez le nom du soin.';
      if (!(parseFloat(freePrix.replace(',', '.')) >= 0) || freePrix.trim() === '') return 'Indiquez le prix du soin.';
      if (!(parseInt(freeDuree, 10) > 0)) return 'Indiquez la durée du soin en minutes.';
    } else if (!service) {
      return 'Choisissez un soin.';
    }
    if (!date) return 'Choisissez le jour.';
    if (!heure) return 'Choisissez l’heure du rendez-vous.';
    return null;
  };

  const submit = async (force = false) => {
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setBusy(true);
    setConflicts(null);
    const body: BookingPatch & { service_nom: string } = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone: telephone.trim(),
      email: email.trim() || null,
      client_id: picked?.id ?? null,
      service_id: freeService ? null : serviceId,
      service_nom: freeService ? freeNom.trim() : (service?.name ?? ''),
      service_prix_chf: soinPrix,
      service_duree_soin_minutes: soinDuree,
      options,
      date_rdv: date,
      heure_rdv: heure as string,
      statut: 'confirme',
      horaire_fixe: true,
      notes_admin: notes.trim() || null,
      notify_client: hasEmail && notify,
      ...(force ? { force: true } : {}),
    };
    try {
      const res = await adminFetch<{ booking?: { id: string } }>('/api/admin/bookings', {
        method: 'POST',
        body: JSON.stringify({ ...body, source }),
      });
      fb.success(`Rendez-vous ajouté le ${formatDateLong(date)} à ${heure}.`);
      announceBookingsChanged();
      onCreated(res.booking?.id ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.conflicts?.length) setConflicts(e.conflicts);
      else fb.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      title="Nouveau rendez-vous"
      subtitle="Pris par téléphone ou sur place. Il sera confirmé tout de suite."
      onClose={onClose}
      footer={
        <div className="flex gap-2 sm:justify-end">
          <Button className="h-12 sm:h-11" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" className="h-12 flex-1 sm:h-11 sm:flex-none" loading={busy} onClick={() => submit(false)} icon={Check}>
            Ajouter au planning
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        {formError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[14.5px] font-medium text-red-900">
            {formError}
          </p>
        )}
        {conflicts && (
          <ConflictsBox
            conflicts={conflicts}
            busy={busy}
            onForce={() => submit(true)}
            onDismiss={() => setConflicts(null)}
            forceLabel="Ajouter quand même"
          />
        )}

        <Section title="La cliente">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de cliente">
            {(
              [
                { id: 'existante', label: 'Déjà cliente', icon: UserRound },
                { id: 'nouvelle', label: 'Nouvelle cliente', icon: UserPlus },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                disabled={m.id === 'existante' && clientsError}
                onClick={() => {
                  setMode(m.id);
                  if (m.id === 'nouvelle') setPicked(null);
                }}
                className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 ${
                  mode === m.id ? 'border-accent bg-accent text-accent-fg' : 'border-stone-300 bg-white text-stone-900 hover:bg-accent-soft'
                }`}
              >
                <m.icon size={17} aria-hidden="true" /> {m.label}
              </button>
            ))}
          </div>

          {mode === 'existante' && !picked && (
            <div className="space-y-2">
              <label htmlFor={searchId} className="block text-[14px] font-semibold text-stone-900">
                Chercher dans la clientèle
              </label>
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-stone-500" aria-hidden="true" />
                <Input
                  id={searchId}
                  data-autofocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, prénom, téléphone ou e-mail"
                  className="!h-12 pl-10 text-[16px]"
                  autoComplete="off"
                />
              </div>
              {clients === null && <p className="text-[14px] text-stone-700">Chargement de la clientèle…</p>}
              {search.trim() && results.length === 0 && clients !== null && (
                <p className="text-[14px] text-stone-700">
                  Aucune cliente trouvée.{' '}
                  <button type="button" className="font-semibold text-accent underline" onClick={() => setMode('nouvelle')}>
                    Saisir une nouvelle cliente
                  </button>
                </p>
              )}
              {results.length > 0 && (
                <ul className="divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickClient(c)}
                        className="flex min-h-14 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
                      >
                        <span className="text-[16px] font-semibold text-stone-950">{clientFullName(c)}</span>
                        <span className="text-[13.5px] text-stone-700">{[c.telephone, c.email].filter(Boolean).join(' · ') || 'Pas de coordonnées'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {clientsError && <p className="text-[14px] text-amber-900">La clientèle n’a pas pu être chargée : saisissez la cliente à la main.</p>}
            </div>
          )}

          {mode === 'existante' && picked && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-emerald-950">{clientFullName(picked)}</p>
                <p className="truncate text-[14px] text-emerald-900">{[picked.telephone, picked.email].filter(Boolean).join(' · ')}</p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="Choisir une autre cliente"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {(mode === 'nouvelle' || picked) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="nb-prenom" required>
                <Input id="nb-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} className="!h-12 text-[16px]" autoComplete="off" />
              </Field>
              <Field label="Nom" htmlFor="nb-nom" required>
                <Input id="nb-nom" value={nom} onChange={(e) => setNom(e.target.value)} className="!h-12 text-[16px]" autoComplete="off" />
              </Field>
              <Field label="Téléphone" htmlFor="nb-tel" required>
                <Input id="nb-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="!h-12 text-[16px]" />
              </Field>
              <Field label="E-mail (facultatif)" htmlFor="nb-mail">
                <Input id="nb-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="!h-12 text-[16px]" />
              </Field>
              {mode === 'nouvelle' && (
                <p className="text-[13.5px] text-stone-700 sm:col-span-2">Sa fiche sera créée automatiquement dans la clientèle.</p>
              )}
            </div>
          )}
        </Section>

        <Section title="Le soin">
          {!freeService ? (
            <>
              <div>
                <label htmlFor="nb-service" className="mb-1.5 block text-[14px] font-semibold text-stone-900">
                  Soin principal
                </label>
                <ServicePicker
                  id="nb-service"
                  catalog={catalog}
                  value={serviceId}
                  currentLabel="Choisir un soin…"
                  onPick={(id) => {
                    setServiceId(id || null);
                    setHeure(null);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setFreeService(true)}
                className="min-h-11 text-left text-[14px] font-semibold text-accent underline underline-offset-2 hover:no-underline"
              >
                Le soin n’est pas dans la liste : le saisir à la main
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-3">
              <Field label="Nom du soin" htmlFor="nb-free-nom">
                <Input id="nb-free-nom" value={freeNom} onChange={(e) => setFreeNom(e.target.value)} className="!h-12 text-[16px]" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix (CHF)" htmlFor="nb-free-prix">
                  <Input id="nb-free-prix" inputMode="decimal" value={freePrix} onChange={(e) => setFreePrix(e.target.value)} className="!h-12 text-[16px]" />
                </Field>
                <Field label="Durée (min)" htmlFor="nb-free-duree">
                  <Input id="nb-free-duree" inputMode="numeric" value={freeDuree} onChange={(e) => setFreeDuree(e.target.value)} className="!h-12 text-[16px]" />
                </Field>
              </div>
              <button type="button" onClick={() => setFreeService(false)} className="min-h-11 text-[14px] font-semibold text-accent underline underline-offset-2 hover:no-underline">
                Revenir à la liste des soins
              </button>
            </div>
          )}
          <UpsellBlock options={options} onChange={setOptions} catalogOptions={catalog.options} catalogServices={catalog.services} />
          <TotalsBar prix={totalPrix} duree={totalDuree} />
        </Section>

        <Section title="Le jour et l’heure">
          <SlotPicker date={date} onDate={setDate} duration={totalDuree} value={heure} onChange={setHeure} />
        </Section>

        <Section title="Pour finir">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Comment le rendez-vous a été pris">
            {(
              [
                { id: 'telephone', label: 'Par téléphone' },
                { id: 'admin', label: 'Sur place' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={source === s.id}
                onClick={() => setSource(s.id)}
                className={`h-12 rounded-lg border text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  source === s.id ? 'border-accent bg-accent text-accent-fg' : 'border-stone-300 bg-white text-stone-900 hover:bg-accent-soft'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor={notesId} className="mb-1.5 block text-[14px] font-semibold text-stone-900">
              Notes pour vous
            </label>
            <Textarea id={notesId} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-[16px]" />
          </div>
          <label className={`flex min-h-11 items-center gap-3 text-[15px] font-semibold ${hasEmail ? 'cursor-pointer text-stone-950' : 'cursor-not-allowed text-stone-500'}`}>
            <input
              type="checkbox"
              className="size-5 accent-[var(--admin-accent)]"
              checked={hasEmail && notify}
              disabled={!hasEmail}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Envoyer un e-mail de confirmation à la cliente
          </label>
          {!hasEmail && <p className="text-[13.5px] text-stone-700">Pas d’adresse e-mail : aucun message ne partira.</p>}
        </Section>
      </div>
    </Overlay>
  );
}
