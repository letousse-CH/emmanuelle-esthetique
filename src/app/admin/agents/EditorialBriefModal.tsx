'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Sparkles, X } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setMessage(null);
      fetchEditorialSettings().then((data) => {
        setForm(data);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await saveEditorialSettings(form);
    setSaving(false);

    if (res.success) {
      setMessage({ type: 'success', text: 'Brief Éditorial enregistré. Re-synchronisation du savoir...' });
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } else {
      setMessage({ type: 'error', text: res.error || 'Erreur lors de l’enregistrement.' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-200 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Brief Éditorial & Identité de Marque</h2>
              <p className="text-[12px] text-amber-100">
                La boussole de marque qui apprend à votre Super Agent votre ton, vos valeurs et votre métier.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-amber-100 hover:bg-white/10 hover:text-white cursor-pointer"
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
                label="1. Périmètre & Activité"
                htmlFor="brief-activity"
                hint="Présentez votre entreprise, votre métier et ce que vous proposez précisément."
              >
                <Textarea
                  id="brief-activity"
                  rows={3}
                  value={form.site_activity_context}
                  onChange={(e) => setForm({ ...form, site_activity_context: e.target.value })}
                  placeholder="Ex: Studio spécialisé dans la création de sites web haute performance pour PME et indépendants..."
                />
              </Field>

              <Field
                label="2. Clientèle Cible & Persona"
                htmlFor="brief-persona"
                hint="Qui s'adresse à vous ? Quels sont leurs besoins et leurs attentes principales ?"
              >
                <Textarea
                  id="brief-persona"
                  rows={3}
                  value={form.site_target_persona}
                  onChange={(e) => setForm({ ...form, site_target_persona: e.target.value })}
                  placeholder="Ex: Entrepreneurs, artisans et dirigeants de TPE/PME qui souhaitent une image professionnelle..."
                />
              </Field>

              <Field
                label="3. Formule d'adresse (Tutoiement / Vouvoiement)"
                hint="Définit comment l'agent, le blog et les rédacteurs s'adressent à vos visiteurs sur l'ensemble du site."
              >
                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      (form.site_address_mode || 'vouvoiement') === 'vouvoiement'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-400/30'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="site_address_mode"
                      value="vouvoiement"
                      checked={(form.site_address_mode || 'vouvoiement') === 'vouvoiement'}
                      onChange={() => setForm({ ...form, site_address_mode: 'vouvoiement' })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-bold">Vouvoiement ("Vous")</p>
                      <p className="text-[11px] font-normal text-stone-600">Style professionnel, courtois et respectueux.</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      form.site_address_mode === 'tutoiement'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-400/30'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="site_address_mode"
                      value="tutoiement"
                      checked={form.site_address_mode === 'tutoiement'}
                      onChange={() => setForm({ ...form, site_address_mode: 'tutoiement' })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-bold">Tutoiement ("Tu")</p>
                      <p className="text-[11px] font-normal text-stone-600">Style proche, dynamique et décontracté.</p>
                    </div>
                  </label>
                </div>
              </Field>

              <Field
                label="4. Ton de Voix & Style"
                htmlFor="brief-tone"
                hint="Comment s'exprime la marque ? (Ex: Chaleureux, direct, professionnel, sans jargon)"
              >
                <Input
                  id="brief-tone"
                  value={form.site_tone_of_voice}
                  onChange={(e) => setForm({ ...form, site_tone_of_voice: e.target.value })}
                  placeholder="Conversationnel, direct et accessible."
                />
              </Field>

              <Field
                label="4. Charte de Marque & Promesses"
                htmlFor="brief-brand"
                hint="Vos valeurs fondamentales, vos promesses clés et les principes à toujours respecter."
              >
                <Textarea
                  id="brief-brand"
                  rows={3}
                  value={form.site_brand_tone}
                  onChange={(e) => setForm({ ...form, site_brand_tone: e.target.value })}
                  placeholder="Ex: Réactivité, transparence totale sur les tarifs, qualité artisanale."
                />
              </Field>

              <Field
                label="5. Thématiques & Domaines d'Expertise"
                htmlFor="brief-topics"
                hint="Les grands sujets sur lesquels votre entreprise fait autorité."
              >
                <Input
                  id="brief-topics"
                  value={form.site_blog_topics}
                  onChange={(e) => setForm({ ...form, site_blog_topics: e.target.value })}
                  placeholder="Ex: Stratégie digitale, UX design, automatisation, référencement SEO."
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-6 py-4">
          <p className="text-[12px] text-stone-600">
            L'enregistrement réindexera la base de savoirs de l'agent.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" icon={Check} loading={saving} onClick={() => void handleSave()}>
              Enregistrer & Synchroniser
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
