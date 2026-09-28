"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAllEvents, fetchEventRegistrationCount, deleteEvent, toggleEventStatus } from '../../../services/events';
import { SdeEvent, CATEGORY_LABELS } from '../../../types/events';
import { Plus, Edit, Trash2, Eye, Calendar, Users, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge, EmptyState, FormMessage, LinkButton, PageHeader, Spinner } from '../../../components/admin/ui';

const STATUS_TONE = {
  published: 'success',
  draft:     'neutral',
  paused:    'warning',
} as const;
const STATUS_LABELS = { published: 'Publié', draft: 'Brouillon', paused: 'En pause' };

export default function EventList() {
  const [events, setEvents]   = useState<SdeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts]   = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const data = await fetchAllEvents();
    setEvents(data);
    if (data.length > 0) setCounts(await fetchEventRegistrationCount(data.map(e => e.id)));
    setLoading(false);
  };

  const handleDelete = async (ev: SdeEvent) => {
    const n = counts[ev.id] || 0;
    const extra = n > 0 ? ` Les ${n} inscription${n > 1 ? 's' : ''} seront supprimée${n > 1 ? 's' : ''} aussi.` : '';
    if (!window.confirm(`Supprimer définitivement l'événement « ${ev.title} » ?${extra} Cette action est irréversible.`)) return;
    setMessage(null);
    const { success } = await deleteEvent(ev.id);
    if (!success) {
      setMessage({ type: 'error', text: "La suppression a échoué. Rechargez la page et réessayez." });
      return;
    }
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    setMessage({ type: 'success', text: `« ${ev.title} » a été supprimé.` });
  };

  const handleToggleStatus = async (event: SdeEvent) => {
    setMessage(null);
    setBusyId(event.id);
    const { success, nextStatus } = await toggleEventStatus(event.id, event.status);
    setBusyId(null);
    if (success) {
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: nextStatus } : e));
    } else {
      setMessage({ type: 'error', text: "Le statut n'a pas pu être changé. Vérifiez votre connexion et réessayez." });
    }
  };

  const categoryLabel = (ev: SdeEvent) => CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS] || ev.category;
  const toggleLabel = (ev: SdeEvent) => (ev.status === 'published' ? 'Mettre en pause' : 'Publier');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Événements"
        description="Ateliers et rendez-vous collectifs, avec leurs inscriptions."
        actions={<LinkButton href="/admin/events/new" variant="primary" icon={Plus}>Nouvel événement</LinkButton>}
      />
      <FormMessage message={message} />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-12">
          <Spinner label="Chargement des événements" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucun événement pour l'instant"
          description="Créez un atelier ou une soirée : vous pourrez le garder en brouillon avant de le publier."
          action={<LinkButton href="/admin/events/new" variant="secondary" icon={Plus}>Créer un événement</LinkButton>}
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700">Événement</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700">Date</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700">Catégorie</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700 text-center">Inscrits</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700 text-center">Statut</th>
                  <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {events.map(ev => (
                  <tr key={ev.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <Link href={`/admin/events/edit/${ev.id}`} className="block font-medium text-stone-900 hover:text-accent truncate">{ev.title}</Link>
                      <p className="text-[13px] text-stone-600 mt-0.5">CHF {ev.price_chf}.-</p>
                    </td>
                    <td className="px-6 py-4 text-stone-700 text-[13px] whitespace-nowrap">
                      <EventDate ev={ev} />
                    </td>
                    <td className="px-6 py-4 text-stone-700 text-[13px]">
                      {categoryLabel(ev)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-stone-700 text-[13px]">
                        <Users size={14} className="text-stone-600" aria-hidden="true" />
                        {counts[ev.id] || 0}{ev.max_participants ? ` / ${ev.max_participants}` : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge tone={STATUS_TONE[ev.status]}>{STATUS_LABELS[ev.status]}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <a href={`/ateliers/${ev.slug}`} target="_blank" rel="noreferrer"
                          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors" title="Voir sur le site" aria-label={`Voir l'événement « ${ev.title} » sur le site`}>
                          <Eye size={16} />
                        </a>
                        <button type="button" onClick={() => handleToggleStatus(ev)} disabled={busyId === ev.id}
                          className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-45"
                          title={toggleLabel(ev)}
                          aria-label={`${toggleLabel(ev)} « ${ev.title} »`}>
                          {ev.status === 'published' ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        </button>
                        <Link href={`/admin/events/edit/${ev.id}`}
                          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors" title="Modifier" aria-label={`Modifier « ${ev.title} »`}>
                          <Edit size={16} />
                        </Link>
                        <button type="button" onClick={() => handleDelete(ev)}
                          className="p-2 text-stone-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer « ${ev.title} »`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes — mobile */}
          <div className="sm:hidden divide-y divide-stone-200">
            {events.map(ev => (
              <div key={ev.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 leading-snug">{ev.title}</p>
                    <p className="text-[13px] text-stone-600 mt-0.5">CHF {ev.price_chf}.-</p>
                  </div>
                  <span className="shrink-0"><Badge tone={STATUS_TONE[ev.status]}>{STATUS_LABELS[ev.status]}</Badge></span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-700">
                  <EventDate ev={ev} />
                  <span>{categoryLabel(ev)}</span>
                  <span className="flex items-center gap-1"><Users size={14} className="text-stone-600" aria-hidden="true" /> {counts[ev.id] || 0}{ev.max_participants ? ` / ${ev.max_participants}` : ''} inscrits</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a href={`/ateliers/${ev.slug}`} target="_blank" rel="noreferrer" aria-label={`Voir l'événement « ${ev.title} » sur le site`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors">
                    <Eye size={15} /> Voir
                  </a>
                  <button type="button" onClick={() => handleToggleStatus(ev)} disabled={busyId === ev.id} aria-label={`${toggleLabel(ev)} « ${ev.title} »`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45">
                    {ev.status === 'published' ? <><PauseCircle size={15} /> Mettre en pause</> : <><PlayCircle size={15} /> Publier</>}
                  </button>
                  <Link href={`/admin/events/edit/${ev.id}`} aria-label={`Modifier « ${ev.title} »`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors">
                    <Edit size={15} /> Modifier
                  </Link>
                  <button type="button" onClick={() => handleDelete(ev)} aria-label={`Supprimer « ${ev.title} »`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 bg-white text-red-700 text-[13px] font-semibold hover:bg-red-50 transition-colors cursor-pointer">
                    <Trash2 size={15} /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventDate({ ev }: { ev: SdeEvent }) {
  if (!ev.date_start) return <span className="text-stone-700">Date à définir</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Calendar size={14} className="text-stone-600 shrink-0" aria-hidden="true" />
      {new Date(ev.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
      {ev.date_end && ` → ${new Date(ev.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
    </span>
  );
}
