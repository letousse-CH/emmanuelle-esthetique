"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../../services/supabase';
import {
  CalendarDays,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  MessageCircle,
  Mail,
  User,
  Plus,
  RefreshCw,
  Sparkles,
  Calendar,
  ChevronRight,
  MoreVertical,
  Check,
  X,
  FileText,
  Trash2,
  CalendarCheck,
} from 'lucide-react';
import { PRESTATIONS_CATALOG, type PrestationItem } from '../../(public)/reservation/ReservationClient';

export type BookingStatus = 'en_attente' | 'confirme' | 'refuse' | 'annule' | 'termine';

export interface Booking {
  id: string;
  client_id: string | null;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  code_postal: string | null;
  ville: string | null;
  service_id: string | null;
  service_nom: string;
  service_prix_chf: number;
  service_duree_minutes: number;
  options: { id: string; nom: string; prix_chf: number; duree_minutes?: number }[];
  offer_of_month_id: string | null;
  date_rdv: string; // YYYY-MM-DD
  heure_rdv: string; // HH:mm
  statut: BookingStatus;
  notes_cliente: string | null;
  notes_admin: string | null;
  gcal_event_id: string | null;
  rappel_effectue: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string; border: string }> = {
  en_attente: {
    label: 'À confirmer',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  confirme: {
    label: 'Confirmé',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  termine: {
    label: 'Terminé',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
  },
  annule: {
    label: 'Annulé',
    bg: 'bg-stone-100',
    text: 'text-stone-500',
    border: 'border-stone-200',
  },
  refuse: {
    label: 'Refusé',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
};

export default function ReservationsAdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [activeTab, setActiveTab] = useState<'tous' | 'aujourdhui' | 'en_attente' | 'confirmes' | 'historique'>('en_attente');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Note admin en cours d'édition
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Modal Nouveau RDV manuel
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRdv, setNewRdv] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    service_nom: 'Soin Hydra Originel — Désaltérant & Repulpant',
    service_prix_chf: 140,
    service_duree_minutes: 60,
    date_rdv: new Date().toISOString().split('T')[0],
    heure_rdv: '10:00',
    notes_admin: '',
  });
  const [creatingRdv, setCreatingRdv] = useState(false);

  // Date du jour YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ── Chargement des réservations ──
  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err: any) {
      console.error('[ReservationsAdmin] Erreur:', err);
      setError("Impossible de charger les réservations. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // ── Mise à jour du statut en 1 clic ──
  const handleUpdateStatus = async (id: string, newStatut: BookingStatus) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: newStatut }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erreur mise à jour statut');
      }

      // Mise à jour locale optimiste
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, statut: newStatut, updated_at: new Date().toISOString() } : b))
      );
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // ── Enregistrement des notes administrateur ──
  const handleSaveNotes = async (id: string) => {
    setSavingNotes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes_admin: notesDraft }),
      });

      if (!res.ok) throw new Error('Erreur enregistrement notes');

      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, notes_admin: notesDraft } : b))
      );
      setEditingNotesId(null);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Création manuelle d'un RDV ──
  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRdv.nom || !newRdv.prenom || !newRdv.telephone) {
      alert('Veuillez remplir le nom, prénom et téléphone.');
      return;
    }

    setCreatingRdv(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const payload = {
        nom: newRdv.nom.trim(),
        prenom: newRdv.prenom.trim(),
        telephone: newRdv.telephone.trim(),
        email: newRdv.email.trim() || null,
        service_nom: newRdv.service_nom,
        service_prix_chf: Number(newRdv.service_prix_chf),
        service_duree_minutes: Number(newRdv.service_duree_minutes),
        date_rdv: newRdv.date_rdv,
        heure_rdv: newRdv.heure_rdv,
        notes_cliente: newRdv.notes_admin ? `[Prise manuelle admin] : ${newRdv.notes_admin}` : null,
        bypass_availability_check: true,
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur création');

      // Si créé, mettre immédiatement son statut à "confirme"
      if (json.booking?.id) {
        await handleUpdateStatus(json.booking.id, 'confirme');
      }

      setShowNewModal(false);
      fetchBookings();
    } catch (err: any) {
      alert(`Erreur lors de la création : ${err.message}`);
    } finally {
      setCreatingRdv(false);
    }
  };

  // ── Filtrage et Recherche ──
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Filtre onglet
      if (activeTab === 'aujourdhui' && b.date_rdv !== todayStr) return false;
      if (activeTab === 'en_attente' && b.statut !== 'en_attente') return false;
      if (activeTab === 'confirmes' && b.statut !== 'confirme') return false;
      if (activeTab === 'historique' && !['termine', 'annule', 'refuse'].includes(b.statut)) return false;

      // Filtre date spécifique
      if (dateFilter && b.date_rdv !== dateFilter) return false;

      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${b.prenom} ${b.nom}`.toLowerCase();
        const phone = (b.telephone || '').toLowerCase();
        const email = (b.email || '').toLowerCase();
        const service = (b.service_nom || '').toLowerCase();
        const city = (b.ville || '').toLowerCase();
        if (!fullName.includes(q) && !phone.includes(q) && !email.includes(q) && !service.includes(q) && !city.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, activeTab, searchQuery, dateFilter, todayStr]);

  // ── Compteurs pour les badges ──
  const counts = useMemo(() => {
    return {
      tous: bookings.length,
      aujourdhui: bookings.filter((b) => b.date_rdv === todayStr).length,
      en_attente: bookings.filter((b) => b.statut === 'en_attente').length,
      confirmes: bookings.filter((b) => b.statut === 'confirme').length,
      historique: bookings.filter((b) => ['termine', 'annule', 'refuse'].includes(b.statut)).length,
    };
  }, [bookings, todayStr]);

  return (
    <div className="space-y-8 animate-fadein p-2 sm:p-4 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              Réservations & Planning
            </h1>
            {counts.en_attente > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                {counts.en_attente} à confirmer
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Gérez les demandes de rendez-vous en ligne, confirmez vos clientes et organisez vos soins en cabine privée.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold tracking-wide transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau rendez-vous
          </button>
        </div>
      </div>

      {/* Barre d'onglets de filtrage */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-stone-100 rounded-xl">
          {[
            { id: 'en_attente', label: 'À confirmer', count: counts.en_attente, badgeColor: 'bg-amber-500 text-white' },
            { id: 'aujourdhui', label: "Aujourd'hui", count: counts.aujourdhui, badgeColor: 'bg-stone-800 text-white' },
            { id: 'confirmes', label: 'Confirmés', count: counts.confirmes, badgeColor: 'bg-emerald-600 text-white' },
            { id: 'tous', label: 'Tous', count: counts.tous, badgeColor: 'bg-stone-400 text-white' },
            { id: 'historique', label: 'Historique', count: counts.historique, badgeColor: 'bg-stone-300 text-stone-700' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.badgeColor}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Barre de recherche & Filtre date */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nom, téléphone, soin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-200 text-xs bg-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-stone-900 text-xs"
              title="Effacer la date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grille / Liste des réservations */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-stone-400" />
          <p className="text-sm text-stone-500">Chargement de votre planning...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-stone-200 p-8 space-y-3">
          <CalendarDays className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="text-base font-semibold text-stone-800">Aucune réservation trouvée</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {activeTab === 'en_attente'
              ? 'Toutes les demandes ont été traitées ! Vous n’avez aucune réservation en attente.'
              : 'Aucun rendez-vous ne correspond à vos critères de recherche actuels.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const statusCfg = STATUS_CONFIG[b.statut] || STATUS_CONFIG.en_attente;
            const isToday = b.date_rdv === todayStr;
            const formattedDate = new Date(`${b.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });

            // Message WhatsApp pré-rempli
            const cleanPhone = b.telephone.replace(/[^\d]/g, '');
            const waMessage = encodeURIComponent(
              `Bonjour ${b.prenom}, c'est Emmanuelle d'Emmanuelle Esthétique au sujet de votre réservation pour le soin ${b.service_nom} le ${b.date_rdv} à ${b.heure_rdv}.`
            );

            return (
              <div
                key={b.id}
                className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-xs ${
                  b.statut === 'en_attente'
                    ? 'border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Colonne 1 : Date, Heure & Statut */}
                  <div className="space-y-2 lg:w-48 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                        {statusCfg.label}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white">
                          Aujourd'hui
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-lg font-serif font-bold text-stone-900 capitalize">
                        {formattedDate}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                        <Clock className="w-4 h-4 text-stone-400" />
                        <span>{b.heure_rdv}</span>
                        <span className="text-xs text-stone-400 font-normal">({b.service_duree_minutes} min)</span>
                      </div>
                    </div>
                  </div>

                  {/* Colonne 2 : Prestation & Tarifs */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-serif font-semibold text-stone-900 truncate">
                        {b.service_nom}
                      </h3>
                      <span className="text-sm font-serif font-bold text-stone-900">
                        CHF {b.service_prix_chf}
                      </span>
                    </div>

                    {b.options && b.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.options.map((opt) => (
                          <span
                            key={opt.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-accent/10 text-accent border border-accent/20"
                          >
                            <Sparkles className="w-3 h-3 text-accent" />
                            {opt.nom} (+ CHF {opt.prix_chf})
                          </span>
                        ))}
                      </div>
                    )}

                    {b.notes_cliente && (
                      <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/60 text-xs text-stone-600 font-light flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                        <p className="line-clamp-2 italic">« {b.notes_cliente} »</p>
                      </div>
                    )}
                  </div>

                  {/* Colonne 3 : Contact Cliente */}
                  <div className="space-y-1.5 lg:w-56 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-stone-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs shrink-0">
                        {b.prenom.charAt(0)}{b.nom.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {b.prenom} {b.nom}
                        </p>
                        {b.ville && (
                          <p className="text-[11px] text-stone-400 truncate">
                            {b.code_postal} {b.ville}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions d'appel et WhatsApp directs */}
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`tel:${b.telephone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
                        title="Appeler la cliente"
                      >
                        <Phone className="w-3 h-3 text-stone-600" />
                        <span className="truncate max-w-[90px]">{b.telephone}</span>
                      </a>

                      <a
                        href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors"
                        title="Ouvrir WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>

                      {b.email && (
                        <a
                          href={`mailto:${b.email}`}
                          className="p-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
                          title="Envoyer un e-mail"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Colonne 4 : Changement de Statut en 1 clic */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-stone-100 shrink-0">
                    {b.statut === 'en_attente' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(b.id, 'confirme')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirmer le RDV
                      </button>
                    )}

                    {b.statut === 'confirme' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(b.id, 'termine')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Marquer terminé
                      </button>
                    )}

                    {b.statut !== 'annule' && b.statut !== 'refuse' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Confirmez-vous l'annulation du rendez-vous de ${b.prenom} ${b.nom} ?`)) {
                            handleUpdateStatus(b.id, 'annule');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Annuler / Refuser
                      </button>
                    )}

                    {/* Éditeur de notes administratives */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotesId(editingNotesId === b.id ? null : b.id);
                        setNotesDraft(b.notes_admin || '');
                      }}
                      className="text-[11px] text-stone-500 hover:text-stone-800 underline underline-offset-2"
                    >
                      {b.notes_admin ? 'Modifier notes internes' : '+ Note interne'}
                    </button>
                  </div>
                </div>

                {/* Panneau dépliant pour les notes internes */}
                {editingNotesId === b.id && (
                  <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row gap-2 items-start">
                    <textarea
                      rows={2}
                      placeholder="Notes privées (préférences d'huiles, historique de peau, arrangement horaire)..."
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                    <div className="flex sm:flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSaveNotes(b.id)}
                        disabled={savingNotes}
                        className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                      >
                        {savingNotes ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNotesId(null)}
                        className="px-2.5 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-100"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Nouveau Rendez-vous Manuel ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 animate-fadein space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-lg font-bold text-stone-900">Enregistrer un rendez-vous au salon</h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualBooking} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={newRdv.prenom}
                    onChange={(e) => setNewRdv({ ...newRdv, prenom: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={newRdv.nom}
                    onChange={(e) => setNewRdv({ ...newRdv, nom: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+41 79 ..."
                    value={newRdv.telephone}
                    onChange={(e) => setNewRdv({ ...newRdv, telephone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newRdv.email}
                    onChange={(e) => setNewRdv({ ...newRdv, email: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Prestation choisie</label>
                <select
                  value={newRdv.service_nom}
                  onChange={(e) => {
                    const found = PRESTATIONS_CATALOG.find((p) => p.name === e.target.value);
                    setNewRdv({
                      ...newRdv,
                      service_nom: e.target.value,
                      service_prix_chf: found?.priceChf || 100,
                      service_duree_minutes: found?.durationMinutes || 60,
                    });
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-200 bg-white"
                >
                  {PRESTATIONS_CATALOG.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} — CHF {p.priceChf} ({p.durationLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newRdv.date_rdv}
                    onChange={(e) => setNewRdv({ ...newRdv, date_rdv: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Heure de début</label>
                  <input
                    type="time"
                    required
                    value={newRdv.heure_rdv}
                    onChange={(e) => setNewRdv({ ...newRdv, heure_rdv: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Notes internes</label>
                <textarea
                  rows={2}
                  placeholder="Remarques particulières..."
                  value={newRdv.notes_admin}
                  onChange={(e) => setNewRdv({ ...newRdv, notes_admin: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingRdv}
                  className="px-5 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-all shadow-xs"
                >
                  {creatingRdv ? 'Création...' : 'Confirmer et bloquer le créneau'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
