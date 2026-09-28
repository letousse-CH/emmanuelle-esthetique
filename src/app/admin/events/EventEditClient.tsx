"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import { supabase } from '../../../services/supabase';
import { sanitizeEditorHtml } from '../../../utils/sanitizeHtml';
import { SdeEvent, EventCategory, EventStatus, CATEGORY_LABELS } from '../../../types/events';
import { Save, Eye, EyeOff, PauseCircle, Sparkles } from 'lucide-react';
import { Button, Callout, Card, CardBody, CardHeader, Field, Input, PageHeader, Select, Textarea, ToggleRow } from '../../../components/admin/ui';

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
    if (!form.title.trim()) { setError('Saisissez d\'abord le titre de l\'événement.'); return; }
    setError('');
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
        setError("Les suggestions n'ont pas pu être générées. Réessayez dans un instant, ou remplissez les champs vous-même.");
      }
    } catch {
      setError("Les suggestions n'ont pas pu être générées. Vérifiez votre connexion et réessayez.");
    } finally {
      setGeneratingMeta(false);
    }
  };

  /** Met à jour plusieurs champs et note qu'il y a des modifications non enregistrées. */
  const update = (patch: Partial<typeof EMPTY>) => {
    setIsDirty(true);
    setForm(prev => ({ ...prev, ...patch }));
  };

  const showError = (msg: string) => {
    setError(msg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (status?: EventStatus) => {
    if (saving) return;
    if (!form.title.trim()) { showError('Le titre est obligatoire.'); return; }
    if (!form.slug.trim())  { showError("L'adresse de la page est obligatoire."); return; }
    if (Number(form.price_chf) < 0) { showError('Le prix ne peut pas être négatif.'); return; }
    if (form.date_start && form.date_end && new Date(form.date_end) < new Date(form.date_start)) {
      showError('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    // Retirer du site un événement qui a déjà des inscrits mérite une confirmation.
    const leavingSite = form.status === 'published' && (status === 'draft' || status === 'paused');
    if (leavingSite && registrations.length > 0) {
      const ok = window.confirm(
        `Cet événement a ${registrations.length} inscription${registrations.length > 1 ? 's' : ''}. ` +
        `Il ne sera plus visible sur le site, mais les inscriptions sont conservées. Continuer ?`
      );
      if (!ok) return;
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

    const friendly = (err: { message: string; code?: string }) =>
      err.code === '23505' || /duplicate key/i.test(err.message)
        ? `L'adresse « /ateliers/${form.slug} » est déjà utilisée par un autre événement. Modifiez-la puis enregistrez à nouveau.`
        : `L'enregistrement a échoué. Vérifiez votre connexion et réessayez. (Détail : ${err.message})`;

    if (isNew) {
      const { error: err } = await supabase.from('events').insert(payload);
      if (err) { showError(friendly(err)); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('events').update(payload).eq('id', id!);
      if (err) { showError(friendly(err)); setSaving(false); return; }
    }

    setIsDirty(false);
    setSuccessMsg('Événement enregistré. Retour à la liste…');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      router.push('/admin/events');
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[14px] text-stone-700" role="status">
        <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" />
        Chargement de l&apos;événement…
      </div>
    );
  }

  const paidCount = registrations.filter(r => r.payment_status === 'paid').length;
  const pendingCount = registrations.filter(r => r.payment_status === 'pending').length;
  const isPublished = form.status === 'published';
  const metaTitleLen = (form.meta_title || '').length;
  const metaDescLen = (form.meta_description || '').length;

  const PAYMENT_LABEL: Record<string, string> = {
    paid: 'Payé', pending: 'En attente', failed: 'Échoué', refunded: 'Remboursé',
  };
  const PAYMENT_CLASS: Record<string, string> = {
    paid: 'text-emerald-700', pending: 'text-amber-800', failed: 'text-red-700', refunded: 'text-stone-700',
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: 'Événements', href: '/admin/events' }, { label: isNew ? 'Nouvel événement' : 'Modifier' }]}
        title={isNew ? 'Nouvel événement' : form.title || "Modifier l'événement"}
        description={
          isPublished
            ? 'Cet événement est visible sur le site.'
            : form.status === 'paused'
            ? 'Cet événement est en pause : il est masqué du site.'
            : "Brouillon : l'événement n'apparaît pas encore sur le site."
        }
        actions={
          isPublished ? (
            <Button variant="primary" icon={Save} loading={saving} onClick={() => handleSave()}>
              Enregistrer
            </Button>
          ) : (
            <>
              <Button variant="secondary" icon={Save} disabled={saving} onClick={() => handleSave()}>
                Enregistrer sans publier
              </Button>
              <Button variant="primary" icon={Eye} loading={saving} onClick={() => handleSave('published')}>
                Publier
              </Button>
            </>
          )
        }
      />

      {successMsg && (
        <div className="mb-6"><Callout tone="success">{successMsg}</Callout></div>
      )}

      {error && (
        <div className="mb-6" role="alert"><Callout tone="danger">{error}</Callout></div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">

        {/* ── Colonne principale ── */}
        <div className="space-y-6 min-w-0">

          <Card>
            <CardBody className="space-y-5">
              <Field label="Titre" required htmlFor="ev-title">
                <Input
                  id="ev-title"
                  type="text"
                  value={form.title}
                  onChange={handleTitleChange}
                  placeholder="ex : Atelier soin du visage à deux"
                />
              </Field>
              <Field
                label="Adresse de la page"
                required
                htmlFor="ev-slug"
                hint="Remplie automatiquement à partir du titre. Évitez de la changer une fois l'événement partagé."
              >
                <div className="flex items-center rounded-lg border border-stone-300 bg-white focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 transition-colors overflow-hidden">
                  <span className="px-3 h-10 flex items-center bg-stone-50 text-stone-600 text-[14px] border-r border-stone-200 whitespace-nowrap">/ateliers/</span>
                  <input
                    id="ev-slug"
                    type="text"
                    value={form.slug}
                    onChange={e => { setSlugEdited(true); setInput('slug')(e); }}
                    className="flex-1 min-w-0 h-10 px-3 text-[14px] text-stone-900 focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Résumé" htmlFor="ev-excerpt" hint="Une ou deux phrases affichées dans la liste des événements.">
                <Textarea
                  id="ev-excerpt"
                  value={form.excerpt || ''}
                  onChange={setInput('excerpt')}
                  rows={2}
                  className="resize-none"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Description complète" description="Le texte de la page de l'événement." />
            <CardBody>
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Image" />
            <CardBody className="space-y-3">
              <Field label="Adresse de l'image" htmlFor="ev-image" hint="Collez le lien d'une image déjà en ligne (par exemple depuis la médiathèque).">
                <Input
                  id="ev-image"
                  type="url"
                  value={form.image_url || ''}
                  onChange={setInput('image_url')}
                  placeholder="https://…"
                />
              </Field>
              {form.image_url && (
                <img src={form.image_url} alt="Aperçu de l'image de l'événement" className="w-full h-40 object-cover rounded-lg border border-stone-200" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Apparence dans Google"
              description="Facultatif : si vous laissez vide, le titre et le résumé sont utilisés."
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Sparkles}
                  loading={generatingMeta}
                  disabled={!form.title.trim()}
                  onClick={generateMeta}
                  title={!form.title.trim() ? "Saisissez d'abord un titre" : undefined}
                >
                  {generatingMeta ? 'Rédaction…' : "Proposer avec l'IA"}
                </Button>
              }
            />
            <CardBody className="space-y-5">
              <Field
                label="Titre affiché dans Google"
                htmlFor="ev-meta-title"
                hint={
                  <span className={`tabular-nums ${metaTitleLen > 60 ? 'text-red-700' : metaTitleLen >= 50 ? 'text-emerald-700' : 'text-stone-600'}`}>
                    {metaTitleLen}/60 caractères (idéal : 50 à 60)
                  </span>
                }
              >
                <Input
                  id="ev-meta-title"
                  type="text"
                  maxLength={70}
                  value={form.meta_title || ''}
                  onChange={e => update({ meta_title: e.target.value })}
                />
              </Field>
              <Field
                label="Description affichée dans Google"
                htmlFor="ev-meta-desc"
                hint={
                  <span className={`tabular-nums ${metaDescLen > 160 ? 'text-red-700' : metaDescLen >= 140 ? 'text-emerald-700' : 'text-stone-600'}`}>
                    {metaDescLen}/160 caractères (idéal : 140 à 160)
                  </span>
                }
              >
                <Textarea
                  id="ev-meta-desc"
                  rows={3}
                  maxLength={170}
                  value={form.meta_description || ''}
                  onChange={e => update({ meta_description: e.target.value })}
                  className="resize-none"
                />
              </Field>
              <Field label="Mots-clés" htmlFor="ev-meta-kw" hint="Séparés par des virgules.">
                <Textarea
                  id="ev-meta-kw"
                  rows={2}
                  value={form.meta_keywords || ''}
                  onChange={e => update({ meta_keywords: e.target.value })}
                  placeholder="ex : atelier beauté, soin du visage, Lausanne"
                  className="resize-none"
                />
              </Field>
            </CardBody>
          </Card>

          {/* Inscriptions (mode édition) */}
          {!isNew && registrations.length > 0 && (
            <Card>
              <CardHeader
                title={`Inscriptions (${registrations.length})`}
                description={
                  <>
                    <span className="text-emerald-700 font-medium">{paidCount} payée{paidCount > 1 ? 's' : ''}</span>
                    {pendingCount > 0 && <> · <span className="text-amber-800 font-medium">{pendingCount} en attente de paiement</span></>}
                  </>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] text-stone-700">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th scope="col" className="text-left px-6 py-2.5 text-[13px] font-semibold text-stone-700">Nom</th>
                      <th scope="col" className="text-left px-6 py-2.5 text-[13px] font-semibold text-stone-700">E-mail</th>
                      <th scope="col" className="text-left px-6 py-2.5 text-[13px] font-semibold text-stone-700">Paiement</th>
                      <th scope="col" className="text-left px-6 py-2.5 text-[13px] font-semibold text-stone-700">Inscrite le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {registrations.map(r => (
                      <tr key={r.id}>
                        <td className="px-6 py-2.5 font-medium text-stone-900">{r.first_name} {r.last_name}</td>
                        <td className="px-6 py-2.5">{r.email}</td>
                        <td className="px-6 py-2.5">
                          <span className={`font-medium ${PAYMENT_CLASS[r.payment_status] ?? 'text-stone-700'}`}>
                            {PAYMENT_LABEL[r.payment_status] ?? r.payment_status}
                          </span>
                          {r.payment_type === 'installment' && <span className="text-stone-600 ml-1">(en 3 fois)</span>}
                        </td>
                        <td className="px-6 py-2.5 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* ── Colonne latérale ── */}
        <div className="space-y-6 min-w-0">

          <Card>
            <CardBody className="space-y-5">
              <Field label="Statut" htmlFor="ev-status" hint={form.status === 'paused' ? "Masqué du site mais conservé : vous pourrez le republier avec une nouvelle date." : 'Pris en compte au prochain enregistrement.'}>
                <Select id="ev-status" value={form.status} onChange={setInput('status')}>
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="paused">En pause (à reprogrammer)</option>
                </Select>
              </Field>
              {isPublished && !isNew && (
                <div className="flex flex-wrap gap-2 -mt-1">
                  <Button size="sm" variant="secondary" icon={PauseCircle} disabled={saving} onClick={() => handleSave('paused')}>
                    Mettre en pause
                  </Button>
                  <Button size="sm" variant="ghost" icon={EyeOff} disabled={saving} onClick={() => handleSave('draft')}>
                    Repasser en brouillon
                  </Button>
                </div>
              )}
              <Field label="Catégorie" htmlFor="ev-category">
                <Select id="ev-category" value={form.category} onChange={setInput('category')}>
                  {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Date et horaires" />
            <CardBody className="space-y-4">
              <Field label="Date de début" htmlFor="ev-date-start">
                <Input id="ev-date-start" type="date" value={form.date_start || ''} onChange={setInput('date_start')} />
              </Field>
              <Field label="Date de fin" htmlFor="ev-date-end" hint="Facultatif, pour un événement sur plusieurs jours.">
                <Input id="ev-date-end" type="date" value={form.date_end || ''} onChange={setInput('date_end')} min={form.date_start || undefined} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début" htmlFor="ev-time-start">
                  <Input id="ev-time-start" type="time" value={form.time_start || ''} onChange={setInput('time_start')} />
                </Field>
                <Field label="Fin" htmlFor="ev-time-end">
                  <Input id="ev-time-end" type="time" value={form.time_end || ''} onChange={setInput('time_end')} />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lieu" />
            <CardBody className="space-y-4">
              <Field label="Ville" htmlFor="ev-location">
                <Input id="ev-location" type="text" value={form.location} onChange={setInput('location')} placeholder="ex : Oron, Vaud" />
              </Field>
              <Field label="Adresse précise" htmlFor="ev-address" hint="Communiquée aux personnes inscrites.">
                <Textarea id="ev-address" value={form.address || ''} onChange={setInput('address')} rows={2} className="resize-none" />
              </Field>
              <div className="border-t border-stone-200 pt-1">
                <ToggleRow
                  title="Événement en ligne"
                  description="En visioconférence."
                  checked={form.is_online}
                  onChange={v => update({ is_online: v })}
                />
                {form.is_online && (
                  <Field label="Lien de connexion" htmlFor="ev-visio" hint="Visible sur le site et envoyé par e-mail la veille de l'événement.">
                    <Input id="ev-visio" type="url" value={form.visio_url || ''} onChange={setInput('visio_url')} placeholder="https://meet.google.com/… ou https://zoom.us/j/…" />
                  </Field>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Prix et places" />
            <CardBody className="space-y-4">
              <Field
                label="Prix (CHF)"
                htmlFor="ev-price"
                hint={
                  Number(form.price_chf) === 0
                    ? 'Événement gratuit.'
                    : Number(form.price_chf) > 250
                    ? 'Le paiement en 3 fois sera proposé automatiquement.'
                    : 'Mettez 0 pour un événement gratuit.'
                }
              >
                <Input id="ev-price" type="number" min={0} value={form.price_chf} onChange={setInput('price_chf')} />
              </Field>
              <Field label="Mention de réduction" htmlFor="ev-discount" hint="Facultatif. Affichée en vert sous le prix, sur les cartes des événements.">
                <Input id="ev-discount" type="text" value={form.discount_label || ''} onChange={setInput('discount_label')} placeholder="ex : dont une séance offerte" />
              </Field>
              <Field label="Nombre de places" htmlFor="ev-max" hint="Laissez vide si le nombre est illimité.">
                <Input
                  id="ev-max"
                  type="number"
                  min={1}
                  value={form.max_participants ?? ''}
                  onChange={e => update({ max_participants: e.target.value ? Number(e.target.value) : null })}
                  placeholder="ex : 12"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4 py-3">
              <ToggleRow
                title="Événement récurrent"
                description="Plusieurs séances comprises dans une même inscription."
                checked={form.is_recurring}
                onChange={v => update({ is_recurring: v })}
              />
              {form.is_recurring && (
                <div className="space-y-4 pb-3">
                  <Field label="Nombre de séances" htmlFor="ev-rec-sessions">
                    <Input
                      id="ev-rec-sessions"
                      type="number"
                      min={2}
                      value={form.recurrence_sessions ?? ''}
                      onChange={e => update({ recurrence_sessions: e.target.value ? Number(e.target.value) : null })}
                      placeholder="ex : 8"
                    />
                  </Field>
                  <Field label="Jour de la semaine" htmlFor="ev-rec-day">
                    <Select id="ev-rec-day" value={form.recurrence_day || ''} onChange={setInput('recurrence_day')}>
                      <option value="">Choisir un jour</option>
                      {DAYS.map(d => <option key={d} value={d.toLowerCase()}>{d}</option>)}
                    </Select>
                  </Field>
                  <Field label="Rythme, en toutes lettres" htmlFor="ev-rec-desc">
                    <Input
                      id="ev-rec-desc"
                      type="text"
                      value={form.recurrence_description || ''}
                      onChange={setInput('recurrence_description')}
                      placeholder="ex : tous les lundis de septembre à décembre"
                    />
                  </Field>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
