"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import {
  CalendarDays,
  Sparkles,
  Smartphone,
  Mail,
  Clock,
  ShieldCheck,
  Check,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Save,
  CalendarCheck,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import { Button, Callout, FormMessage } from '../../../components/admin/ui';
import type { BookingSettings } from '../../../types/booking';
import { timeToMinutes } from '../../../types/booking';
import BlocksSection from '../../../components/admin/reservations/BlocksSection';
import { FeedbackProvider, useFeedback } from '../../../components/admin/reservations/Feedback';
import { useIsLgSync } from '../../../components/admin/reservations/hooks';
import SyncClientsButton from '../../../components/admin/reservations/SyncClientsButton';
import WeeklyHoursEditor, { normalizeHours, validateHours } from '../../../components/admin/reservations/WeeklyHoursEditor';
import type { WeeklyHours } from '../../../components/admin/reservations/WeeklyHoursEditor';
import { adminFetch, unwrap } from '../../../components/admin/reservations/lib';

interface MonthlyOfferForm {
  id?: string;
  titre: string;
  description: string;
  prix_chf: number;
  image_url: string;
  active: boolean;
}

interface BookingSettingsForm {
  buffer_minutes: number;
  anticipation_min_heures: number;
  anticipation_max_jours: number;
  gcal_sync_enabled: boolean;
  gcal_calendar_id: string;
  notification_email: string;
  smartphone_phone: string;
  pas_creneau_minutes: number;
  heure_coupure_periode: string;
}

const PAS_OPTIONS = [5, 10, 15, 20, 30, 60];

/**
 * Barre d'enregistrement : sur téléphone elle reste collée en bas de l'écran
 * (au-dessus de la barre d'onglets) tant que le formulaire est à l'écran ;
 * sur ordinateur, bouton à droite en fin de formulaire, comme avant.
 */
const SAVE_BAR =
  'sticky z-20 -mx-4 mt-2 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur ' +
  'bottom-[calc(var(--admin-tabbar-h,0px)+env(safe-area-inset-bottom))] ' +
  'lg:static lg:mx-0 lg:mt-0 lg:flex lg:justify-end lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-3 lg:backdrop-blur-none';

export default function BookingSettingsPanel() {
  return (
    <FeedbackProvider>
      <BookingSettingsContent />
    </FeedbackProvider>
  );
}

function BookingSettingsContent() {
  // Sur téléphone, le résultat d'un enregistrement apparaît aussi en bulle au-dessus de la barre d'onglets
  // (le message en haut de la section est hors de l'écran quand on vient d'appuyer sur « Enregistrer »).
  const fb = useFeedback();
  const isLg = useIsLgSync();
  const announce = (m: { type: 'success' | 'error'; text: string }) => {
    if (isLg) return;
    if (m.type === 'success') fb.success(m.text);
    else fb.error(m.text);
  };
  // ── État Offre du mois ──
  const [offer, setOffer] = useState<MonthlyOfferForm>({
    titre: '',
    description: '',
    prix_chf: 120,
    image_url: '',
    active: true,
  });
  const [offerLoading, setOfferLoading] = useState(true);
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerMsg, setOfferMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── État Paramètres & Synchronisation Google / Notifications ──
  const [settings, setSettings] = useState<BookingSettingsForm>({
    buffer_minutes: 30,
    anticipation_min_heures: 2,
    anticipation_max_jours: 60,
    gcal_sync_enabled: false,
    gcal_calendar_id: '',
    notification_email: '',
    smartphone_phone: '',
    pas_creneau_minutes: 15,
    heure_coupure_periode: '13:00',
  });
  const [hours, setHours] = useState<WeeklyHours>(() => normalizeHours(null));
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Chargement des données ──
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Offre du mois
      setOfferLoading(true);
      const resOffer = await fetch('/api/bookings/monthly-offer', { headers });
      if (resOffer.ok) {
        const jsonOffer = await resOffer.json();
        if (jsonOffer.offer) {
          setOffer({
            id: jsonOffer.offer.id,
            titre: jsonOffer.offer.titre || '',
            description: jsonOffer.offer.description || '',
            prix_chf: Number(jsonOffer.offer.prix_chf) || 0,
            image_url: jsonOffer.offer.image_url || '',
            active: Boolean(jsonOffer.offer.active),
          });
        }
      }
      setOfferLoading(false);

      // 2. Paramètres de réservation
      setSettingsLoading(true);
      try {
        const jsonSettings = await adminFetch('/api/admin/booking-settings');
        const s = unwrap<Partial<BookingSettings> | undefined>(jsonSettings, 'settings');
        if (s) {
          setSettings((prev) => ({
            ...prev,
            buffer_minutes: s.buffer_minutes ?? 30,
            anticipation_min_heures: s.anticipation_min_heures ?? 2,
            anticipation_max_jours: s.anticipation_max_jours ?? 60,
            gcal_sync_enabled: Boolean(s.gcal_sync_enabled),
            gcal_calendar_id: s.gcal_calendar_id || '',
            notification_email: s.notification_email || '',
            pas_creneau_minutes: s.pas_creneau_minutes ?? 15,
            heure_coupure_periode: s.heure_coupure_periode || '13:00',
          }));
          setHours(normalizeHours(s.jours_ouverture as WeeklyHours | undefined));
        }
      } catch (err) {
        setSettingsMsg({
          type: 'error',
          text: err instanceof Error ? err.message : 'Les paramètres de réservation n’ont pas pu être chargés.',
        });
      }

      // Téléphone de l'institut depuis table settings
      const { data: phoneRow } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'business_phone')
        .maybeSingle();

      if (phoneRow?.value) {
        setSettings((prev) => ({ ...prev, smartphone_phone: phoneRow.value }));
      }

      setSettingsLoading(false);
    } catch (err) {
      console.error('[BookingSettingsPanel] Erreur chargement:', err);
      setOfferLoading(false);
      setSettingsLoading(false);
    }
  };

  // ── Sauvegarde Offre du mois ──
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOffer(true);
    setOfferMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/bookings/monthly-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(offer),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur enregistrement');

      if (json.offer) {
        setOffer((prev) => ({ ...prev, id: json.offer.id }));
      }

      const m = { type: 'success' as const, text: 'Offre du mois enregistrée avec succès.' };
      setOfferMsg(m);
      announce(m);
    } catch (err: any) {
      const m = { type: 'error' as const, text: err.message || 'Erreur lors de la sauvegarde.' };
      setOfferMsg(m);
      announce(m);
    } finally {
      setSavingOffer(false);
    }
  };

  const hoursErrors = validateHours(hours);
  const hoursErrorList = Object.keys(hoursErrors);

  // ── Sauvegarde Paramètres & Google Sync ──
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);

    if (hoursErrorList.length > 0) {
      const m = { type: 'error' as const, text: 'Corrigez les horaires d’ouverture avant d’enregistrer.' };
      setSettingsMsg(m);
      announce(m);
      return;
    }
    if (!settings.heure_coupure_periode || timeToMinutes(settings.heure_coupure_periode) < 6 * 60) {
      const m = { type: 'error' as const, text: 'Indiquez l’heure à laquelle le matin se termine (par exemple 13:00).' };
      setSettingsMsg(m);
      announce(m);
      return;
    }

    setSavingSettings(true);
    try {
      // Mise à jour booking_settings (horaires, pas de la grille, coupure matin / après-midi inclus)
      await adminFetch('/api/admin/booking-settings', {
        method: 'PUT',
        body: JSON.stringify({
          buffer_minutes: Number(settings.buffer_minutes),
          anticipation_min_heures: Number(settings.anticipation_min_heures),
          anticipation_max_jours: Number(settings.anticipation_max_jours),
          // Un jour fermé part sans plage : rien d'invalide ne peut voyager avec lui.
          jours_ouverture: Object.fromEntries(
            Object.entries(hours).map(([k, v]) => [k, v.ouvert ? v : { ouvert: false, plages: [] }]),
          ),
          pas_creneau_minutes: Number(settings.pas_creneau_minutes),
          heure_coupure_periode: settings.heure_coupure_periode,
          gcal_sync_enabled: Boolean(settings.gcal_sync_enabled),
          gcal_calendar_id: settings.gcal_calendar_id || null,
          notification_email: settings.notification_email || null,
        }),
      });

      // Mise à jour téléphone dans settings si modifié
      if (settings.smartphone_phone) {
        await supabase
          .from('settings')
          .upsert({ key: 'business_phone', value: settings.smartphone_phone });
      }

      const m = { type: 'success' as const, text: 'Paramètres et synchronisation enregistrés avec succès.' };
      setSettingsMsg(m);
      announce(m);
    } catch (err: any) {
      const m = { type: 'error' as const, text: err.message || 'Erreur lors de la sauvegarde.' };
      setSettingsMsg(m);
      announce(m);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-12 animate-fadein">
      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1 : L'OFFRE DU MOIS
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </span>
              <h2 className="text-xl font-bold text-stone-900">L'Offre du Mois en ligne</h2>
            </div>
            <p className="text-[14px] sm:text-sm text-stone-600 sm:text-stone-500 font-light">
              Mettez en avant un soin d'exception ou un forfait saisonnier dans le module de réservation publique (Étape 2).
            </p>
          </div>

          <label className="relative inline-flex min-h-11 items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={offer.active}
              onChange={(e) => setOffer({ ...offer, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 shrink-0 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-3 text-[14px] lg:text-xs font-semibold text-stone-700">
              {offer.active ? 'Offre Active' : 'Offre Désactivée'}
            </span>
          </label>
        </div>

        {offerMsg && (
          <div
            className={`p-4 rounded-xl text-[14px] sm:text-sm flex items-center gap-3 ${
              offerMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {offerMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{offerMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveOffer} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                Titre de l'Offre du mois *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Rituel Échappée Belle & Gommage Satin"
                value={offer.titre}
                onChange={(e) => setOffer({ ...offer, titre: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                Tarif Préférentiel (CHF) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                placeholder="Ex: 140"
                value={offer.prix_chf || ''}
                onChange={(e) => setOffer({ ...offer, prix_chf: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
              Description & Avantages exclusifs
            </label>
            <textarea
              rows={3}
              placeholder="Décrivez les bienfaits marins, les étapes du soin et le privilège accordé ce mois-ci..."
              value={offer.description}
              onChange={(e) => setOffer({ ...offer, description: e.target.value })}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 font-light"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
              Visuel de l'Offre (URL de l'image)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://... ou chemin de l'image"
                value={offer.image_url}
                onChange={(e) => setOffer({ ...offer, image_url: e.target.value })}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
              />
            </div>
            {offer.image_url && (
              <div className="w-48 h-28 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 mt-2 shadow-inner">
                <img
                  src={offer.image_url}
                  alt={offer.titre}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className={SAVE_BAR}>
            <button
              type="submit"
              disabled={savingOffer}
              className="inline-flex w-full lg:w-auto min-h-12 lg:min-h-0 items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-[15px] lg:text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
            >
              {savingOffer ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Enregistrer l'offre du mois
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 2 : GOOGLE AGENDA & NOTIFICATIONS SMARTPHONE
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-1 border-b border-stone-100 pb-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CalendarCheck size={16} />
            </span>
            <h2 className="text-xl font-bold text-stone-900">Synchronisation Google Agenda & Notifications</h2>
          </div>
          <p className="text-[14px] sm:text-sm text-stone-600 sm:text-stone-500 font-light">
            Synchronisez vos réservations en temps réel avec votre calendrier personnel et recevez les alertes sur votre smartphone.
          </p>
        </div>

        {settingsMsg && (
          <div
            className={`p-4 rounded-xl text-[14px] sm:text-sm flex items-center gap-3 ${
              settingsMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {settingsMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{settingsMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Synchronisation Google Calendar */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-stone-900">Synchronisation Google Calendar</h3>
                <p className="text-[13.5px] lg:text-xs text-stone-600 font-light">
                  Chaque rendez-vous confirmé créera instantanément un événement dans l'agenda de votre téléphone.
                </p>
              </div>

              <label className="relative inline-flex min-h-11 items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.gcal_sync_enabled}
                  onChange={(e) => setSettings({ ...settings, gcal_sync_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 shrink-0 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.gcal_sync_enabled && (
              <div className="space-y-1 pt-2 border-t border-blue-100 animate-fadein">
                <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Identifiant de votre agenda Google (Calendar ID)
                </label>
                <input
                  type="text"
                  placeholder="Ex: emmanuelle.esthetique@gmail.com ou identifiant d'agenda"
                  value={settings.gcal_calendar_id}
                  onChange={(e) => setSettings({ ...settings, gcal_calendar_id: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                />
                <p className="text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 font-light">
                  Trouvable dans les paramètres de votre Google Agenda (Rubrique « Intégrer l'agenda »).
                </p>
              </div>
            )}
          </div>

          {/* Notifications Smartphone & E-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block flex items-center gap-1.5">
                <Smartphone size={14} className="text-stone-400" />
                Téléphone Smartphone pour alertes WhatsApp
              </label>
              <input
                type="tel"
                placeholder="+41 79 123 45 67"
                value={settings.smartphone_phone}
                onChange={(e) => setSettings({ ...settings, smartphone_phone: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <p className="text-[13px] lg:text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 lg:text-stone-400 font-light">
                Utilisé pour le contact direct avec les clientes depuis le tableau de bord.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block flex items-center gap-1.5">
                <Mail size={14} className="text-stone-400" />
                E-mail de notification administrateur
              </label>
              <input
                type="email"
                placeholder="contact@emmanuelle-esthetique.ch"
                value={settings.notification_email}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <p className="text-[13px] lg:text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 lg:text-stone-400 font-light">
                Reçoit instantanément l'e-mail de récapitulatif à chaque nouvelle demande.
              </p>
            </div>
          </div>

          {/* Règles de cabine & Battement */}
          <div className="border-t border-stone-100 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-stone-900">Règles d'exploitation de la Cabine</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1">
                <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Battement (buffer) entre deux soins
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={settings.buffer_minutes}
                    onChange={(e) => setSettings({ ...settings, buffer_minutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-24 text-sm px-3.5 py-2 rounded-xl border border-stone-200"
                  />
                  <span className="text-[14px] lg:text-xs text-stone-600 lg:text-stone-500">minutes</span>
                </div>
                <p className="text-[13px] lg:text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 lg:text-stone-400 font-light">30 min recommandées pour l'aération et la préparation.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Délai minimum d'anticipation
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={settings.anticipation_min_heures}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setSettings({ ...settings, anticipation_min_heures: Number.isFinite(n) && n >= 0 ? n : 0 });
                    }}
                    className="w-24 text-sm px-3.5 py-2 rounded-xl border border-stone-200"
                  />
                  <span className="text-[14px] lg:text-xs text-stone-600 lg:text-stone-500">heures</span>
                </div>
                <p className="text-[13px] lg:text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 lg:text-stone-400 font-light">Empêche les réservations de dernière minute imprévues.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Horizon d'ouverture du calendrier
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="7"
                    value={settings.anticipation_max_jours}
                    onChange={(e) => setSettings({ ...settings, anticipation_max_jours: parseInt(e.target.value, 10) || 30 })}
                    className="w-24 text-sm px-3.5 py-2 rounded-xl border border-stone-200"
                  />
                  <span className="text-[14px] lg:text-xs text-stone-600 lg:text-stone-500">jours</span>
                </div>
                <p className="text-[13px] lg:text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 lg:text-stone-400 font-light">Période maximale proposée aux clientes en ligne.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label htmlFor="bs-pas" className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Écart entre deux heures proposées
                </label>
                <select
                  id="bs-pas"
                  value={settings.pas_creneau_minutes}
                  onChange={(e) => setSettings({ ...settings, pas_creneau_minutes: parseInt(e.target.value, 10) })}
                  className="w-full sm:w-40 text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white"
                >
                  {PAS_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      Toutes les {m} min
                    </option>
                  ))}
                </select>
                <p className="text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 font-light">
                  Quand vous choisissez l’heure d’un rendez-vous, les créneaux sont proposés à ce rythme (15 min recommandées).
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="bs-coupure" className="text-[14px] lg:text-xs font-semibold text-stone-700 block">
                  Le matin se termine à
                </label>
                <input
                  id="bs-coupure"
                  type="time"
                  value={settings.heure_coupure_periode}
                  onChange={(e) => setSettings({ ...settings, heure_coupure_periode: e.target.value })}
                  className="w-full sm:w-40 text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white"
                />
                <p className="text-[13px] lg:text-[11px] text-stone-600 lg:text-stone-500 font-light">
                  Sépare « matin » et « après-midi » dans les demandes des clientes.
                </p>
              </div>
            </div>
          </div>

          {/* Horaires hebdomadaires */}
          <div className="border-t border-stone-100 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-stone-900">Horaires d’ouverture de la semaine</h3>
            </div>
            <WeeklyHoursEditor value={hours} onChange={setHours} errors={hoursErrors} />
          </div>

          <div className={SAVE_BAR}>
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex w-full lg:w-auto min-h-12 lg:min-h-0 items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-[15px] lg:text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Enregistrer les paramètres
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 3 : INDISPONIBILITÉS (congés, vacances, plages horaires)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-1 border-b border-stone-100 pb-5">
          <h2 className="text-xl font-bold text-stone-900">Congés et indisponibilités</h2>
          <p className="text-[14px] sm:text-sm text-stone-600 sm:text-stone-500 font-light">
            Bloquez une journée, des vacances ou quelques heures : ces horaires ne seront plus proposés aux clientes. Aucun rendez-vous déjà pris n’est annulé.
          </p>
        </div>
        <BlocksSection />
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 4 : RATTACHER LES RÉSERVATIONS À LA CLIENTÈLE
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-4">
        <div className="space-y-1 border-b border-stone-100 pb-5">
          <h2 className="text-xl font-bold text-stone-900">Clientèle</h2>
        </div>
        <SyncClientsButton />
      </section>
    </div>
  );
}
