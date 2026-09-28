'use client';

import React, { useEffect, useState } from 'react';
import {
  Check, Sparkles, X,
} from 'lucide-react';
import {
  fetchEditorialSettings,
  saveEditorialSettings,
  type EditorialBriefSettings,
} from '../../../services/agents';
import {
  Button,
  Field,
  FormMessage,
  Input,
  Spinner,
  Textarea,
} from '../../../components/admin/ui';

interface EditorialBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditorialBriefModal({
  isOpen,
  onClose,
  onSaved,
}: EditorialBriefModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditorialBriefSettings>({
    site_activity_context: '',
    site_target_persona: '',
    site_tone_of_voice: '',
    site_brand_tone: '',
    site_blog_topics: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Tant que le brief n'a pas été lu, l'enregistrer écraserait l'existant par des champs vides.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setMessage(null);
      setLoadFailed(false);
      fetchEditorialSettings()
        .then((data) => setForm(data))
        .catch(() => { setLoadFailed(true); setMessage({ type: 'error', text: 'Le brief n’a pas pu être chargé. Fermez puis rouvrez cette fenêtre.' }); })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSave() {
    if (loadFailed || loading) return;
    setSaving(true);
    setMessage(null);
    const res = await saveEditorialSettings(form);
    setSaving(false);

    if (res.success) {
      setMessage({ type: 'success', text: 'Brief enregistré. L’agent relit maintenant le site…' });
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } else {
      setMessage({ type: 'error', text: `Le brief n’a pas été enregistré${res.error ? ` (${res.error})` : ''}. Réessayez.` });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div role="dialog" aria-modal="true" aria-label="Brief éditorial" className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-stone-950">Brief éditorial</h2>
              <p className="text-[13px] text-stone-600">
                Votre activité, votre clientèle et votre ton : l’agent s’en sert pour répondre comme vous le feriez.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer disabled:opacity-45"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {message && <FormMessage message={message} />}

          {loading ? (
            <div className="py-12 text-center">
              <Spinner label="Chargement du brief éditorial…" />
            </div>
          ) : (
            <div className="space-y-4">
              <Field
                label="Votre activité"
                htmlFor="brief-activity"
                hint="Votre métier et ce que vous proposez, en quelques phrases."
              >
                <Textarea
                  id="brief-activity"
                  rows={3}
                  value={form.site_activity_context}
                  onChange={(e) => setForm({ ...form, site_activity_context: e.target.value })}
                  placeholder="Ex. Institut de beauté à domicile : soins du visage, Head Spa, massages relaxants…"
                />
              </Field>

              <Field
                label="Votre clientèle"
                htmlFor="brief-persona"
                hint="Qui vient vous voir, et ce que ces personnes attendent."
              >
                <Textarea
                  id="brief-persona"
                  rows={3}
                  value={form.site_target_persona}
                  onChange={(e) => setForm({ ...form, site_target_persona: e.target.value })}
                  placeholder="Ex. Femmes de la région qui cherchent un moment de détente sans se déplacer…"
                />
              </Field>

              <Field
                label="Tutoiement ou vouvoiement"
                hint="Définit comment l'agent, le blog et les rédacteurs s'adressent à vos visiteurs sur l'ensemble du site."
              >
                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      (form.site_address_mode || 'vouvoiement') === 'vouvoiement'
                        ? 'border-accent bg-accent-soft text-stone-900'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="site_address_mode"
                      value="vouvoiement"
                      checked={(form.site_address_mode || 'vouvoiement') === 'vouvoiement'}
                      onChange={() => setForm({ ...form, site_address_mode: 'vouvoiement' })}
                      className="accent-[var(--color-accent)]"
                    />
                    <div>
                      <p className="text-sm font-semibold">Vouvoiement</p>
                      <p className="text-[13px] font-normal text-stone-600">Courtois et professionnel.</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      form.site_address_mode === 'tutoiement'
                        ? 'border-accent bg-accent-soft text-stone-900'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="site_address_mode"
                      value="tutoiement"
                      checked={form.site_address_mode === 'tutoiement'}
                      onChange={() => setForm({ ...form, site_address_mode: 'tutoiement' })}
                      className="accent-[var(--color-accent)]"
                    />
                    <div>
                      <p className="text-sm font-semibold">Tutoiement</p>
                      <p className="text-[13px] font-normal text-stone-600">Proche et décontracté.</p>
                    </div>
                  </label>
                </div>
              </Field>

              <Field
                label="Ton"
                htmlFor="brief-tone"
                hint="Comment vous parlez à vos clientes. Ex. chaleureux, simple, sans jargon."
              >
                <Input
                  id="brief-tone"
                  value={form.site_tone_of_voice}
                  onChange={(e) => setForm({ ...form, site_tone_of_voice: e.target.value })}
                  placeholder="Chaleureux, simple et rassurant."
                />
              </Field>

              <Field
                label="Vos valeurs et engagements"
                htmlFor="brief-brand"
                hint="Ce à quoi vous tenez, et ce que l’agent doit toujours respecter."
              >
                <Textarea
                  id="brief-brand"
                  rows={3}
                  value={form.site_brand_tone}
                  onChange={(e) => setForm({ ...form, site_brand_tone: e.target.value })}
                  placeholder="Ex. Produits naturels, tarifs clairs, écoute."
                />
              </Field>

              <Field
                label="Sujets que vous maîtrisez"
                htmlFor="brief-topics"
                hint="Les thèmes sur lesquels l’agent peut répondre avec assurance."
              >
                <Input
                  id="brief-topics"
                  value={form.site_blog_topics}
                  onChange={(e) => setForm({ ...form, site_blog_topics: e.target.value })}
                  placeholder="Ex. Soins du visage, routine beauté, bien-être."
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-6 py-4">
          <p className="text-[13px] text-stone-600">
            Ces réglages servent aussi à la rédaction des articles.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" icon={Check} loading={saving} disabled={loading || loadFailed} onClick={() => void handleSave()}>
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
