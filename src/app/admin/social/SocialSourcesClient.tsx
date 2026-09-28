"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Rss, Loader2, Sparkles, AlertCircle, CheckCircle2, CalendarDays } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Toggle } from '../../../components/admin/ui';
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
      setAddError("Cette adresse n'est pas valide. Copiez l'adresse complète du flux, qui commence par https://");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('rss_feeds').insert({ url, label: newLabel.trim() || null, active: true });
    if (error) {
      setAddError(error.code === '23505' ? 'Ce flux est déjà dans la liste.' : `Le flux n'a pas pu être ajouté. Réessayez. (Détail : ${error.message})`);
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
    if (!window.confirm(`Retirer le flux « ${feed.label || feed.url} » de vos sources ? Les posts déjà créés à partir de ce flux sont conservés.`)) return;
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
      setGenError(e.message || 'Erreur inconnue.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Génération automatique */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-[18px] font-semibold text-stone-950">Préparation automatique</h2>
          <p className="text-[14px] text-stone-700 mt-1 leading-relaxed">
            Chaque jour, le site repère vos nouveaux articles publiés, les nouveautés des flux actifs ci-dessous
            et les idées de sujets que vous avez gardées, puis prépare des posts à relire dans le{' '}
            <span className="font-medium text-stone-900">Calendrier</span>. Vous pouvez aussi lancer la préparation tout de suite.
          </p>
        </div>
        <button
          type="button"
          onClick={generateNow}
          disabled={generating}
          className="bg-accent hover:bg-accent-hover flex items-center gap-2 text-accent-fg px-4 h-10 rounded-lg font-semibold text-[14px] transition-colors disabled:opacity-45 cursor-pointer"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {generating ? 'Préparation en cours… (une à deux minutes)' : 'Préparer les posts maintenant'}
        </button>
        {genError && (
          <p role="alert" className="text-[13px] text-red-700 flex items-start gap-1.5"><AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>La préparation n&apos;a pas abouti : {genError}</span></p>
        )}
        {summary && (
          <div role="status" className="text-[14px] bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 space-y-2">
            {summary.generated > 0 ? (
              <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <CheckCircle2 size={15} /> {summary.generated} post{summary.generated !== 1 ? 's' : ''} généré{summary.generated !== 1 ? 's' : ''}
                {summary.skipped > 0 && ` · ${summary.skipped} déjà traité${summary.skipped !== 1 ? 's' : ''}`}
              </p>
            ) : (
              <p className="text-stone-700">
                Rien de nouveau à préparer : chaque source a déjà son post.
              </p>
            )}

            {summary.plannedDates && summary.plannedDates.length > 0 && (
              <>
                <p className="text-stone-700">
                  Planifié{summary.plannedDates.length > 1 ? 's' : ''} le{' '}
                  <span className="font-medium text-stone-900">
                    {summary.plannedDates.map((d) => DAY_LABEL.format(fromDateKey(d))).join(', ')}
                  </span>.
                </p>
                {onGenerated && (
                  <button
                    type="button"
                    onClick={onGenerated}
                    className="flex items-center gap-1.5 text-accent hover:underline font-semibold cursor-pointer"
                  >
                    <CalendarDays size={15} /> Voir dans le calendrier
                  </button>
                )}
              </>
            )}

            {summary.errors.length > 0 && (
              <ul className="text-red-700 text-[13px] space-y-0.5 pt-1">
                {summary.errors.map((err, i) => <li key={i}>· {err}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Flux RSS */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-[18px] font-semibold text-stone-950 flex items-center gap-2"><Rss size={16} className="text-stone-700" /> Flux d&apos;actualités (RSS)</h2>
          <p className="text-[14px] text-stone-700 mt-1">Les sites que vous suivez (magazines beauté, marques…). Chaque nouvel article d&apos;un flux actif peut devenir un post. Un à trois flux suffisent.</p>
        </div>

        {loadError && (
          <p role="alert" className="flex items-start gap-1.5 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="shrink-0 mt-px" /> {loadError}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-stone-700">Chargement…</p>
        ) : (
          <div className="space-y-2">
            {feeds.length === 0 && <p className="text-sm text-stone-700">Aucun flux pour l&apos;instant. Ajoutez-en un ci-dessous.</p>}
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                <Toggle
                  checked={feed.active}
                  onChange={() => toggleActive(feed)}
                  label={`Flux ${feed.label || feed.url} actif`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{feed.label || feed.url}</p>
                  {feed.label && <p className="truncate text-[13px] text-stone-600">{feed.url}</p>}
                  {!feed.active && <p className="text-[13px] text-stone-600">En pause : ce flux n&apos;est pas lu.</p>}
                </div>
                <button type="button" onClick={() => deleteFeed(feed)} aria-label={`Supprimer le flux ${feed.label || feed.url}`} title="Supprimer" className="p-1.5 text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addFeed} className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-stone-200">
          <label htmlFor="rss-new-label" className="sr-only">Libellé du flux (facultatif)</label>
          <input
            id="rss-new-label"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nom (facultatif)"
            className="sm:w-48 h-10 border border-stone-300 rounded-lg px-3 text-sm focus:outline-none focus:border-stone-900"
          />
          <label htmlFor="rss-new-url" className="sr-only">Adresse du flux</label>
          <input
            id="rss-new-url"
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://exemple.com/flux.xml"
            required
            className="flex-1 min-w-0 h-10 border border-stone-300 rounded-lg px-3 text-sm focus:outline-none focus:border-stone-900"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center justify-center gap-1.5 bg-stone-100 text-stone-900 px-4 h-10 rounded-lg text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer shrink-0"
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Ajouter le flux
          </button>
        </form>
        {addError && <p role="alert" className="text-[13px] text-red-700">{addError}</p>}
      </div>
    </div>
  );
}
