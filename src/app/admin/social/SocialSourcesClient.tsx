"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Rss, Loader2, Sparkles, AlertCircle, CheckCircle2, CalendarDays } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { fromDateKey } from '../../../utils/dateKey';

interface RssFeed {
  id: string;
  url: string;
  label: string | null;
  active: boolean;
  created_at: string;
}

interface GenerateSummary {
  generated: number;
  skipped: number;
  errors: string[];
  plannedDates?: string[];
}

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function SocialSourcesClient({ onGenerated }: { onGenerated?: () => void }) {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<GenerateSummary | null>(null);
  const [genError, setGenError] = useState('');

  useEffect(() => { loadFeeds(); }, []);

  const loadFeeds = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('rss_feeds').select('*').order('created_at', { ascending: true });
    if (error) setLoadError(`Chargement des flux impossible : ${error.message}`);
    setFeeds(data || []);
    setLoading(false);
  };

  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const url = newUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setAddError('URL invalide.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('rss_feeds').insert({ url, label: newLabel.trim() || null, active: true });
    if (error) {
      setAddError(error.code === '23505' ? 'Ce flux est déjà enregistré.' : error.message);
    } else {
      setNewUrl(''); setNewLabel('');
      loadFeeds();
    }
    setAdding(false);
  };

  const toggleActive = async (feed: RssFeed) => {
    const snapshot = feeds;
    setFeeds((prev) => prev.map((f) => (f.id === feed.id ? { ...f, active: !f.active } : f)));
    const { error } = await supabase.from('rss_feeds').update({ active: !feed.active }).eq('id', feed.id);
    if (error) { setFeeds(snapshot); setLoadError(`Modification non enregistrée : ${error.message}`); }
  };

  const deleteFeed = async (feed: RssFeed) => {
    if (!window.confirm(`Supprimer le flux "${feed.label || feed.url}" ?`)) return;
    const snapshot = feeds;
    setFeeds((prev) => prev.filter((f) => f.id !== feed.id));
    const { error } = await supabase.from('rss_feeds').delete().eq('id', feed.id);
    if (error) { setFeeds(snapshot); setLoadError(`Suppression impossible : ${error.message}`); }
  };

  const generateNow = async () => {
    setGenerating(true);
    setGenError('');
    setSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/social-generate-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          res.status === 504
            ? "La génération a dépassé le temps imparti côté serveur. Réessayez avec moins de sources actives à la fois."
            : `Réponse inattendue du serveur (HTTP ${res.status}).`
        );
      }
      if (data.error) throw new Error(data.error);
      setSummary(data);
    } catch (e: any) {
      setGenError(e.message || 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Génération automatique */}
      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-stone-900">Automatisation</h2>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">
            Une tâche planifiée détecte les nouveaux articles publiés, les nouvelles entrées des flux RSS actifs ci-dessous
            et les suggestions SEO sauvegardées, puis pré-génère du contenu prêt à relire dans le{' '}
            <span className="font-medium text-stone-600">Calendrier</span>. Vous pouvez aussi forcer un cycle immédiatement :
          </p>
        </div>
        <button
          type="button"
          onClick={generateNow}
          disabled={generating}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Générer maintenant
        </button>
        {genError && (
          <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle size={12} /> {genError}</p>
        )}
        {summary && (
          <div className="text-xs bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 space-y-2">
            {summary.generated > 0 ? (
              <p className="flex items-center gap-1.5 text-green-700 font-medium">
                <CheckCircle2 size={12} /> {summary.generated} post{summary.generated !== 1 ? 's' : ''} généré{summary.generated !== 1 ? 's' : ''}
                {summary.skipped > 0 && ` · ${summary.skipped} déjà traité${summary.skipped !== 1 ? 's' : ''}`}
              </p>
            ) : (
              <p className="text-stone-500 font-medium">
                Aucun nouveau contenu à générer — toutes les sources détectées ont déjà leur post.
              </p>
            )}

            {summary.plannedDates && summary.plannedDates.length > 0 && (
              <>
                <p className="text-stone-500">
                  Planifié{summary.plannedDates.length > 1 ? 's' : ''} au{' '}
                  <span className="font-medium text-stone-700">
                    {summary.plannedDates.map((d) => DAY_LABEL.format(fromDateKey(d))).join(', ')}
                  </span>.
                </p>
                {onGenerated && (
                  <button
                    type="button"
                    onClick={onGenerated}
                    className="flex items-center gap-1.5 text-sage hover:text-sage/70 font-bold transition-colors cursor-pointer"
                  >
                    <CalendarDays size={12} /> Voir dans le calendrier
                  </button>
                )}
              </>
            )}

            {summary.errors.length > 0 && (
              <ul className="text-red-500 space-y-0.5 pt-1">
                {summary.errors.map((err, i) => <li key={i}>· {err}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Flux RSS */}
      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2"><Rss size={15} className="text-sage" /> Flux RSS</h2>
          <p className="text-xs text-stone-400 mt-1">1 à 3 flux recommandés — chaque nouvelle entrée devient une source de contenu potentielle.</p>
        </div>

        {loadError && (
          <p className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="shrink-0 mt-px" /> {loadError}
          </p>
        )}

        {loading ? (
          <p className="text-stone-400 text-sm italic">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {feeds.length === 0 && <p className="text-stone-400 text-sm italic">Aucun flux configuré.</p>}
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-xl px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={feed.active}
                  aria-label={`${feed.active ? 'Désactiver' : 'Activer'} le flux ${feed.label || feed.url}`}
                  onClick={() => toggleActive(feed)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${feed.active ? 'bg-sage' : 'bg-stone-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${feed.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{feed.label || feed.url}</p>
                  {feed.label && <p className="text-xs text-stone-400 truncate font-mono">{feed.url}</p>}
                </div>
                <button onClick={() => deleteFeed(feed)} aria-label={`Supprimer le flux ${feed.label || feed.url}`} title="Supprimer" className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addFeed} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-stone-100">
          <label htmlFor="rss-new-label" className="sr-only">Libellé du flux (facultatif)</label>
          <input
            id="rss-new-label"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Libellé (facultatif)"
            className="sm:w-48 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
          <label htmlFor="rss-new-url" className="sr-only">URL du flux RSS</label>
          <input
            id="rss-new-url"
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://exemple.com/flux.xml"
            required
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center justify-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Ajouter
          </button>
        </form>
        {addError && <p className="text-xs text-red-500">{addError}</p>}
      </div>
    </div>
  );
}
