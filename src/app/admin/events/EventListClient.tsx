"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAllEvents, fetchEventRegistrationCount, deleteEvent, toggleEventStatus } from '../../../services/events';
import { SdeEvent, CATEGORY_LABELS } from '../../../types/events';
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Users, PauseCircle } from 'lucide-react';

const STATUS_STYLES = {
  published: 'bg-green-50 text-green-700',
  draft:     'bg-stone-100 text-stone-500',
  paused:    'bg-amber-50 text-amber-700',
};
const STATUS_LABELS = { published: 'Publié', draft: 'Brouillon', paused: 'En pause' };

export default function EventList() {
  const [events, setEvents]   = useState<SdeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts]   = useState<Record<string, number>>({});

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const data = await fetchAllEvents();
    setEvents(data);
    if (data.length > 0) setCounts(await fetchEventRegistrationCount(data.map(e => e.id)));
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet événement et toutes ses inscriptions ?')) return;
    const { success } = await deleteEvent(id);
    if (!success) { alert('Erreur lors de la suppression.'); return; }
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleToggleStatus = async (event: SdeEvent) => {
    const { success, nextStatus } = await toggleEventStatus(event.id, event.status);
    if (success) setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: nextStatus } : e));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Contenu</p>
          <h1 className="text-2xl font-semibold text-stone-900">Événements</h1>
        </div>
        <Link href="/admin/events/new" className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/80 transition-colors self-start">
          <Plus size={15} /> Nouvel événement
        </Link>
      </div>

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : events.length === 0 ? (
          <p className="py-16 text-center text-stone-400 text-sm italic">
            Aucun événement. <Link href="/admin/events/new" className="text-sage hover:underline">Créer le premier</Link>
          </p>
        ) : (
          <>
            {/* Tableau — écrans sm et plus */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/50">
                    <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Événement</th>
                    <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Date</th>
                    <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Catégorie</th>
                    <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-center">Inscrits</th>
                    <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-center">Statut</th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4 max-w-xs">
                        <p className="font-medium text-stone-900 truncate">{ev.title}</p>
                        <p className="text-xs text-stone-400 mt-0.5">CHF {ev.price_chf}.-</p>
                      </td>
                      <td className="px-6 py-4 text-stone-500 text-xs whitespace-nowrap">
                        <EventDate ev={ev} />
                      </td>
                      <td className="px-6 py-4 text-stone-500 text-xs">
                        {CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS] || ev.category}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users size={11} className="text-stone-300" />
                          <span className="text-stone-500 text-xs">{counts[ev.id] || 0}{ev.max_participants ? `/${ev.max_participants}` : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_STYLES[ev.status]}`}>
                          {STATUS_LABELS[ev.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                          <a href={`/ateliers/${ev.slug}`} target="_blank" rel="noreferrer"
                            className="p-1.5 text-stone-300 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors" title="Voir" aria-label={`Voir l'événement « ${ev.title} »`}>
                            <Eye size={14} />
                          </a>
                          <button onClick={() => handleToggleStatus(ev)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${ev.status === 'published' ? 'text-stone-300 hover:text-amber-500 hover:bg-amber-50' : 'text-stone-300 hover:text-green-500 hover:bg-green-50'}`}
                            title={ev.status === 'published' ? 'Mettre en pause' : 'Publier'}
                            aria-label={ev.status === 'published' ? `Mettre en pause « ${ev.title} »` : `Publier « ${ev.title} »`}>
                            {ev.status === 'published' ? <PauseCircle size={14} /> : <EyeOff size={14} />}
                          </button>
                          <Link href={`/admin/events/edit/${ev.id}`}
                            className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-colors" title="Modifier" aria-label={`Modifier « ${ev.title} »`}>
                            <Edit size={14} />
                          </Link>
                          <button onClick={() => handleDelete(ev.id)}
                            className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer « ${ev.title} »`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes — mobile */}
            <div className="sm:hidden divide-y divide-stone-100">
              {events.map(ev => (
                <div key={ev.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900 leading-snug truncate">{ev.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">CHF {ev.price_chf}.-</p>
                    </div>
                    <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${STATUS_STYLES[ev.status]}`}>
                      {STATUS_LABELS[ev.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span className="flex items-center gap-1.5"><EventDate ev={ev} /></span>
                    <span>{CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS] || ev.category}</span>
                    <span className="flex items-center gap-1"><Users size={11} className="text-stone-300" /> {counts[ev.id] || 0}{ev.max_participants ? `/${ev.max_participants}` : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a href={`/ateliers/${ev.slug}`} target="_blank" rel="noreferrer" aria-label={`Voir l'événement « ${ev.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium active:bg-stone-100 transition-colors">
                      <Eye size={14} /> Voir
                    </a>
                    <button onClick={() => handleToggleStatus(ev)} aria-label={ev.status === 'published' ? `Mettre en pause « ${ev.title} »` : `Publier « ${ev.title} »`}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-colors ${ev.status === 'published' ? 'border-amber-200 text-amber-600 active:bg-amber-50' : 'border-green-200 text-green-600 active:bg-green-50'}`}>
                      {ev.status === 'published' ? <><PauseCircle size={14} /> Pause</> : <><Eye size={14} /> Publier</>}
                    </button>
                    <Link href={`/admin/events/edit/${ev.id}`} aria-label={`Modifier « ${ev.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-sage/30 bg-sage/5 text-sage text-xs font-medium active:bg-sage/10 transition-colors">
                      <Edit size={14} /> Modifier
                    </Link>
                    <button onClick={() => handleDelete(ev.id)} aria-label={`Supprimer « ${ev.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium active:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 size={14} /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex gap-6 text-xs text-stone-400">
        <span className="flex items-center gap-1.5"><PauseCircle size={11} className="text-amber-400" /> Mettre en pause</span>
        <span className="flex items-center gap-1.5"><Eye size={11} className="text-green-500" /> Publier</span>
      </div>
    </div>
  );
}

function EventDate({ ev }: { ev: SdeEvent }) {
  if (!ev.date_start) return <span className="text-stone-400 italic">À définir</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Calendar size={11} className="text-sage shrink-0" />
      {new Date(ev.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
      {ev.date_end && ` → ${new Date(ev.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
    </span>
  );
}
