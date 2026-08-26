"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import { supabase } from '../../../services/supabase';
import { sanitizeEditorHtml } from '../../../utils/sanitizeHtml';
import { SdeEvent, EventCategory, EventStatus, CATEGORY_LABELS } from '../../../types/events';
import { Save, ArrowLeft, Eye, EyeOff, PauseCircle, Users, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

const EMPTY: Omit<SdeEvent, 'id' | 'created_at' | 'updated_at'> = {
  title: '',
  slug: '',
  category: 'atelier_groupe',
  excerpt: '',
  description: '',
  date_start: '',
  date_end: '',
  time_start: '',
  time_end: '',
  location: '',
  address: '',
  price_chf: 0,
  max_participants: null,
  image_url: '',
  status: 'draft',
  is_online: false,
  visio_url: '',
  is_recurring: false,
  recurrence_sessions: null,
  recurrence_day: '',
  recurrence_description: '',
  discount_label: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
};

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = !id;

  const [form, setForm] = useState(EMPTY);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [generatingMeta, setGeneratingMeta] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!id) return;
    supabase.from('events').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) {
        setError("Impossible de charger l'événement. Vérifiez l'identifiant.");
        console.error('Event fetch error:', error.message);
      } else if (data) {
        setForm(data);
      }
      setLoading(false);
    });
    supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRegistrations(data || []));
  }, [id]);

  const set = (field: string) => (val: any) => {
    setIsDirty(true);
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const setInput = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setIsDirty(true);
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      title,
      slug: slugEdited ? prev.slug : slugify(title),
    }));
  };

  const generateMeta = async () => {
    if (!form.title.trim()) { setError('Renseignez le titre avant de générer les métas.'); return; }
    setGeneratingMeta(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const content = (form.excerpt || '') + ' ' + (form.description || '');
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: form.title, content, mode: 'article' }),
      });
      const data = await res.json();
      if (data.meta_title || data.meta_description || data.meta_keywords) {
        setIsDirty(true);
        setForm(prev => ({
          ...prev,
          ...(data.meta_title       ? { meta_title: data.meta_title }             : {}),
          ...(data.meta_description ? { meta_description: data.meta_description } : {}),
          ...(data.meta_keywords    ? { meta_keywords: data.meta_keywords }       : {}),
        }));
      } else {
        setError(data.error || 'Erreur lors de la génération des métas.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingMeta(false);
    }
  };

  const handleSave = async (status?: EventStatus) => {
    if (!form.title.trim()) { setError('Le titre est obligatoire.'); return; }
    if (!form.slug.trim())  { setError('Le slug est obligatoire.'); return; }
    if (Number(form.price_chf) < 0) { setError('Le prix (CHF) ne peut pas être négatif.'); return; }
    if (form.date_start && form.date_end && new Date(form.date_end) < new Date(form.date_start)) {
      setError('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      ...form,
      description: sanitizeEditorHtml(form.description || ''),
      status: status || form.status,
      price_chf: Number(form.price_chf) || 0,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      date_start: form.date_start || null,
      date_end: form.date_end || null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      updated_at: new Date().toISOString(),
    };

    if (isNew) {
      const { error: err } = await supabase.from('events').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('events').update(payload).eq('id', id!);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setIsDirty(false);
    setSuccessMsg('Événement enregistré avec succès !');
    setTimeout(() => {
      router.push('/admin/events');
    }, 800);
  };

  if (loading) return <div className="text-stone-600 p-6">Chargement…</div>;

  const paidCount = registrations.filter(r => r.payment_status === 'paid').length;
  const pendingCount = registrations.filter(r => r.payment_status === 'pending').length;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/events" className="text-stone-500 hover:text-stone-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900">
            {isNew ? 'Nouvel événement' : 'Modifier l\'événement'}
          </h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!isNew && form.status !== 'paused' && (
            <button
              onClick={() => handleSave('paused')}
              className="flex items-center gap-2 border border-amber-200 text-amber-600 px-4 py-2 text-xs hover:bg-amber-50 transition-colors"
            >
              <PauseCircle size={15} /> Mettre en pause
            </button>
          )}
          <button
            onClick={() => handleSave('draft')}
            className="flex items-center gap-2 border border-stone-200 text-stone-600 px-4 py-2 text-xs hover:bg-stone-50 transition-colors"
          >
            <EyeOff size={15} /> Brouillon
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 text-xs hover:bg-stone-700 transition-colors disabled:opacity-60"
          >
            <Eye size={15} /> {saving ? 'Enregistrement…' : 'Publier'}
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 bg-sage text-white px-4 py-2 text-xs hover:bg-stone-700 transition-colors disabled:opacity-60"
          >
            <Save size={15} /> Sauvegarder
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-semibold rounded-lg shadow-2xs animate-fadein">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">

        {/* ── Colonne principale ── */}
        <div className="space-y-6">

          {/* Titre + Slug */}
          <div className="bg-white border border-stone-200 p-6 space-y-4">
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1.5">Titre *</label>
              <input
                type="text"
                value={form.title}
                onChange={handleTitleChange}
                placeholder="Atelier Méditation & Rêves…"
                className="w-full border border-stone-200 px-4 py-3 text-stone-900 font-medium text-lg focus:outline-none focus:border-stone-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1.5">Slug URL *</label>
              <div className="flex items-center border border-stone-200 focus-within:border-sage transition-colors">
                <span className="px-3 py-2.5 bg-stone-50 text-stone-500 text-sm border-r border-stone-200 whitespace-nowrap">/ateliers/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => { setSlugEdited(true); setInput('slug')(e); }}
                  className="flex-1 px-3 py-2.5 text-sm text-stone-700 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1.5">Résumé (accroche)</label>
              <textarea
                value={form.excerpt || ''}
                onChange={setInput('excerpt')}
                rows={2}
                placeholder="Une courte phrase affichée dans la liste des événements…"
                className="w-full border border-stone-200 px-4 py-3 text-sm text-stone-700 focus:outline-none focus:border-stone-900 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Description riche */}
          <div className="bg-white border border-stone-200 p-6">
            <label className="block text-[12.5px] font-medium text-stone-700 mb-3">Description complète</label>
            <ReactQuill
              theme="snow"
              value={form.description || ''}
              onChange={set('description')}
              className="min-h-[320px]"
              modules={{
                toolbar: [
                  [{ header: [2, 3, false] }],
                  ['bold', 'italic'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  ['link'],
                  ['clean'],
                ],
              }}
            />
          </div>

          {/* Image */}
          <div className="bg-white border border-stone-200 p-6 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Image (URL)</label>
            <input
              type="url"
              value={form.image_url || ''}
              onChange={setInput('image_url')}
              placeholder="https://…"
              className="w-full border border-stone-200 px-4 py-3 text-sm text-stone-700 focus:outline-none focus:border-stone-900 transition-colors"
            />
            {form.image_url && (
              <img src={form.image_url} alt="" className="w-full h-40 object-cover rounded-sm border border-stone-100" />
            )}
          </div>

          {/* SEO */}
          <div className="bg-white border border-stone-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[12.5px] font-medium text-stone-700">SEO — Balises méta</label>
              <button
                type="button"
                onClick={generateMeta}
                disabled={generatingMeta || !form.title.trim()}
                className="flex items-center gap-1.5 text-xs bg-sage text-white px-3 py-1.5 hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                {generatingMeta ? 'Génération…' : 'Générer par IA'}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[13px] font-medium text-stone-800">Meta Title</label>
                <span className={`text-[12px] ${(form.meta_title || '').length > 60 ? 'text-red-400' : (form.meta_title || '').length >= 50 ? 'text-green-500' : 'text-stone-500'}`}>
                  {(form.meta_title || '').length}/60
                </span>
              </div>
              <input
                type="text"
                maxLength={70}
                value={form.meta_title || ''}
                onChange={e => setForm(prev => ({ ...prev, meta_title: e.target.value }))}
                placeholder="Titre SEO optimisé (50-60 car.)"
                className="w-full border border-stone-200 px-4 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-stone-900 transition-colors"
              />
              <div className="mt-1 h-0.5 bg-stone-100 rounded-full">
                <div className={`h-0.5 rounded-full transition-all ${(form.meta_title || '').length > 60 ? 'bg-red-400' : 'bg-sage'}`}
                  style={{ width: `${Math.min(((form.meta_title || '').length / 60) * 100, 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[13px] font-medium text-stone-800">Meta Description</label>
                <span className={`text-[12px] ${(form.meta_description || '').length > 160 ? 'text-red-400' : (form.meta_description || '').length >= 140 ? 'text-green-500' : 'text-stone-500'}`}>
                  {(form.meta_description || '').length}/160
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={170}
                value={form.meta_description || ''}
                onChange={e => setForm(prev => ({ ...prev, meta_description: e.target.value }))}
                placeholder="Description SEO (140-160 car.)"
                className="w-full border border-stone-200 px-4 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-stone-900 transition-colors resize-none"
              />
              <div className="mt-1 h-0.5 bg-stone-100 rounded-full">
                <div className={`h-0.5 rounded-full transition-all ${(form.meta_description || '').length > 160 ? 'bg-red-400' : (form.meta_description || '').length >= 140 ? 'bg-green-400' : 'bg-sage'}`}
                  style={{ width: `${Math.min(((form.meta_description || '').length / 160) * 100, 100)}%` }} />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-stone-800 mb-1">Keywords</label>
              <textarea
                rows={2}
                value={form.meta_keywords || ''}
                onChange={e => setForm(prev => ({ ...prev, meta_keywords: e.target.value }))}
                placeholder="mot-clé 1, mot-clé 2, mot-clé 3…"
                className="w-full border border-stone-200 px-4 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-stone-900 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Inscriptions (mode édition) */}
          {!isNew && registrations.length > 0 && (
            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[12.5px] font-medium text-stone-700">
                  Inscriptions
                </label>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 font-bold">{paidCount} payé{paidCount > 1 ? 's' : ''}</span>
                  {pendingCount > 0 && <span className="text-amber-500 font-bold">{pendingCount} en attente</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-stone-500">
                  <thead className="text-[12px] text-stone-500 border-b border-stone-100">
                    <tr>
                      <th className="text-left py-2 pr-4">Nom</th>
                      <th className="text-left py-2 pr-4">E-mail</th>
                      <th className="text-left py-2 pr-4">Paiement</th>
                      <th className="text-left py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(r => (
                      <tr key={r.id} className="border-b border-stone-50">
                        <td className="py-2 pr-4 font-medium text-stone-700">{r.first_name} {r.last_name}</td>
                        <td className="py-2 pr-4">{r.email}</td>
                        <td className="py-2 pr-4">
                          <span className={`font-bold ${r.payment_status === 'paid' ? 'text-green-600' : r.payment_status === 'pending' ? 'text-amber-500' : 'text-red-400'}`}>
                            {r.payment_status === 'paid' ? 'Payé' : r.payment_status === 'pending' ? 'En attente' : r.payment_status}
                          </span>
                          {r.payment_type === 'installment' && <span className="text-stone-500 ml-1">(3×)</span>}
                        </td>
                        <td className="py-2">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne latérale ── */}
        <div className="space-y-4">

          {/* Statut */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Statut</label>
            <select
              value={form.status}
              onChange={setInput('status')}
              className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-stone-900"
            >
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
              <option value="paused">En pause (reprogrammation)</option>
            </select>
            {form.status === 'paused' && (
              <p className="text-xs text-amber-600 italic">
                L'événement est masqué du site mais conservé — vous pouvez le republier avec une nouvelle date.
              </p>
            )}
          </div>

          {/* Catégorie */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Catégorie</label>
            <select
              value={form.category}
              onChange={setInput('category')}
              className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-stone-900"
            >
              {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date & Horaires */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Date & Horaires</label>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Date de début</label>
              <input
                type="date"
                value={form.date_start || ''}
                onChange={setInput('date_start')}
                className="w-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Date de fin <span className="text-stone-500">(facultatif — pour retraites multi-jours)</span></label>
              <input
                type="date"
                value={form.date_end || ''}
                onChange={setInput('date_end')}
                min={form.date_start || undefined}
                className="w-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Début</label>
                <input
                  type="time"
                  value={form.time_start || ''}
                  onChange={setInput('time_start')}
                  className="w-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Fin</label>
                <input
                  type="time"
                  value={form.time_end || ''}
                  onChange={setInput('time_end')}
                  className="w-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Lieu */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Lieu</label>
            <input
              type="text"
              value={form.location}
              onChange={setInput('location')}
              placeholder="Ville, canton — pays"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
            <textarea
              value={form.address || ''}
              onChange={setInput('address')}
              rows={2}
              placeholder="Adresse précise (communiquée après inscription)"
              className="w-full border border-stone-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-stone-900"
            />
          </div>

          {/* Tarif & Places */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="block text-[12.5px] font-medium text-stone-700">Tarif & Places</label>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Prix (CHF) — mettre 0 pour gratuit</label>
              <input
                type="number"
                min={0}
                value={form.price_chf}
                onChange={setInput('price_chf')}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
              {Number(form.price_chf) === 0 && (
                <p className="text-xs text-emerald-600 mt-1 font-bold">✓ Événement gratuit</p>
              )}
              {Number(form.price_chf) > 250 && (
                <p className="text-xs text-sage mt-1 italic">Paiement en 3× proposé automatiquement</p>
              )}
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Texte de ristourne (optionnel)</label>
              <input
                type="text"
                value={form.discount_label || ''}
                onChange={setInput('discount_label')}
                placeholder="ex : dont une séance offerte"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
              <p className="text-[12.5px] text-stone-500 mt-1 italic">Affiché en vert sous le prix dans les cartes événement.</p>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-stone-700 mb-1">
                <Users size={11} className="inline mr-1" />
                Places max. (vide = illimité)
              </label>
              <input
                type="number"
                min={1}
                value={form.max_participants ?? ''}
                onChange={e => setForm(prev => ({
                  ...prev,
                  max_participants: e.target.value ? Number(e.target.value) : null,
                }))}
                placeholder="12"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* Visio */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_online}
                onChange={e => setForm(prev => ({ ...prev, is_online: e.target.checked }))}
                className="accent-sage w-4 h-4"
              />
              <span className="text-[12.5px] font-medium text-stone-700">Événement en ligne (visio)</span>
            </label>
            {form.is_online && (
              <div>
                <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Lien de connexion</label>
                <input
                  type="url"
                  value={form.visio_url || ''}
                  onChange={setInput('visio_url')}
                  placeholder="https://meet.google.com/… ou https://zoom.us/j/…"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <p className="text-[12.5px] text-stone-500 mt-1 italic">
                  Visible sur le site et envoyé par e-mail la veille de l'événement.
                </p>
              </div>
            )}
          </div>

          {/* Récurrence */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => setForm(prev => ({ ...prev, is_recurring: e.target.checked }))}
                className="accent-sage w-4 h-4"
              />
              <span className="text-[12.5px] font-medium text-stone-700">Événement récurrent</span>
            </label>
            {form.is_recurring && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Nombre de séances incluses</label>
                  <input
                    type="number"
                    min={2}
                    value={form.recurrence_sessions ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, recurrence_sessions: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="8"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Jour de la semaine</label>
                  <select
                    value={form.recurrence_day || ''}
                    onChange={setInput('recurrence_day')}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="">— Sélectionner —</option>
                    {DAYS.map(d => <option key={d} value={d.toLowerCase()}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-stone-700 mb-1">Description de la récurrence (libre)</label>
                  <input
                    type="text"
                    value={form.recurrence_description || ''}
                    onChange={setInput('recurrence_description')}
                    placeholder="ex : tous les lundis de septembre à décembre"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
