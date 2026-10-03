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
}

export default function BookingSettingsPanel() {
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
  });
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
      const resSettings = await fetch('/api/bookings/settings', { headers });
      if (resSettings.ok) {
        const jsonSettings = await resSettings.json();
        if (jsonSettings.settings) {
          setSettings((prev) => ({
            ...prev,
            buffer_minutes: jsonSettings.settings.buffer_minutes ?? 30,
            anticipation_min_heures: jsonSettings.settings.anticipation_min_heures ?? 2,
            anticipation_max_jours: jsonSettings.settings.anticipation_max_jours ?? 60,
            gcal_sync_enabled: Boolean(jsonSettings.settings.gcal_sync_enabled),
            gcal_calendar_id: jsonSettings.settings.gcal_calendar_id || '',
            notification_email: jsonSettings.settings.notification_email || '',
          }));
        }
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

      setOfferMsg({ type: 'success', text: 'Offre du mois enregistrée avec succès.' });
    } catch (err: any) {
      setOfferMsg({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSavingOffer(false);
    }
  };

  // ── Sauvegarde Paramètres & Google Sync ──
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Mise à jour booking_settings
      const res = await fetch('/api/bookings/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          buffer_minutes: Number(settings.buffer_minutes),
          anticipation_min_heures: Number(settings.anticipation_min_heures),
          anticipation_max_jours: Number(settings.anticipation_max_jours),
          gcal_sync_enabled: Boolean(settings.gcal_sync_enabled),
          gcal_calendar_id: settings.gcal_calendar_id || null,
          notification_email: settings.notification_email || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur enregistrement paramètres');

      // Mise à jour téléphone dans settings si modifié
      if (settings.smartphone_phone) {
        await supabase
          .from('settings')
          .upsert({ key: 'business_phone', value: settings.smartphone_phone });
      }

      setSettingsMsg({
        type: 'success',
        text: 'Paramètres et synchronisation enregistrés avec succès.',
      });
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-12 animate-fadein">
      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1 : L'OFFRE DU MOIS
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </span>
              <h2 className="text-xl font-bold text-stone-900">L'Offre du Mois en ligne</h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 font-light">
              Mettez en avant un soin d'exception ou un forfait saisonnier dans le module de réservation publique (Étape 2).
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={offer.active}
              onChange={(e) => setOffer({ ...offer, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-3 text-xs font-semibold text-stone-700">
              {offer.active ? 'Offre Active' : 'Offre Désactivée'}
            </span>
          </label>
        </div>

        {offerMsg && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-3 ${
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
              <label className="text-xs font-semibold text-stone-700 block">
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
              <label className="text-xs font-semibold text-stone-700 block">
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
            <label className="text-xs font-semibold text-stone-700 block">
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
            <label className="text-xs font-semibold text-stone-700 block">
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

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingOffer}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
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
      <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-1 border-b border-stone-100 pb-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CalendarCheck size={16} />
            </span>
            <h2 className="text-xl font-bold text-stone-900">Synchronisation Google Agenda & Notifications</h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 font-light">
            Synchronisez vos réservations en temps réel avec votre calendrier personnel et recevez les alertes sur votre smartphone.
          </p>
        </div>

        {settingsMsg && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-3 ${
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
                <p className="text-xs text-stone-600 font-light">
                  Chaque rendez-vous confirmé créera instantanément un événement dans l'agenda de votre téléphone.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.gcal_sync_enabled}
                  onChange={(e) => setSettings({ ...settings, gcal_sync_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.gcal_sync_enabled && (
              <div className="space-y-1 pt-2 border-t border-blue-100 animate-fadein">
                <label className="text-xs font-semibold text-stone-700 block">
                  Identifiant de votre agenda Google (Calendar ID)
                </label>
                <input
                  type="text"
                  placeholder="Ex: emmanuelle.esthetique@gmail.com ou identifiant d'agenda"
                  value={settings.gcal_calendar_id}
                  onChange={(e) => setSettings({ ...settings, gcal_calendar_id: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                />
                <p className="text-[11px] text-stone-500 font-light">
                  Trouvable dans les paramètres de votre Google Agenda (Rubrique « Intégrer l'agenda »).
                </p>
              </div>
            )}
          </div>

          {/* Notifications Smartphone & E-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 block flex items-center gap-1.5">
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
              <p className="text-[11px] text-stone-400 font-light">
                Utilisé pour le contact direct avec les clientes depuis le tableau de bord.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 block flex items-center gap-1.5">
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
              <p className="text-[11px] text-stone-400 font-light">
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
                <label className="text-xs font-semibold text-stone-700 block">
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
                  <span className="text-xs text-stone-500">minutes</span>
                </div>
                <p className="text-[11px] text-stone-400 font-light">30 min recommandées pour l'aération et la préparation.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Délai minimum d'anticipation
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={settings.anticipation_min_heures}
                    onChange={(e) => setSettings({ ...settings, anticipation_min_heures: parseInt(e.target.value, 10) || 1 })}
                    className="w-24 text-sm px-3.5 py-2 rounded-xl border border-stone-200"
                  />
                  <span className="text-xs text-stone-500">heures</span>
                </div>
                <p className="text-[11px] text-stone-400 font-light">Empêche les réservations de dernière minute imprévues.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
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
                  <span className="text-xs text-stone-500">jours</span>
                </div>
                <p className="text-[11px] text-stone-400 font-light">Période maximale proposée aux clientes en ligne.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
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
    </div>
  );
}
