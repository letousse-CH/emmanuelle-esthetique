"use client";

import { useEffect, useState } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface SequenceStepRow {
  step_order: number;
  delay_hours: number;
  subject: string;
  body: string;
  active: boolean;
}

function formatDelay(hours: number): string {
  if (hours === 0) return 'Immédiat';
  if (hours % 24 === 0) return `J+${hours / 24}`;
  return `${hours} h`;
}

export default function SequenceAdminClient() {
  const [steps, setSteps] = useState<SequenceStepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, { type: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('quiz_sequence_emails')
        .select('*')
        .order('step_order', { ascending: true });
      if (!error && data) setSteps(data as SequenceStepRow[]);
      setLoading(false);
    })();
  }, []);

  const updateField = (stepOrder: number, field: keyof SequenceStepRow, value: string | boolean | number) => {
    setSteps(prev => prev.map(s => (s.step_order === stepOrder ? { ...s, [field]: value } : s)));
  };

  const handleSave = async (step: SequenceStepRow) => {
    setSavingStep(step.step_order);
    const { error } = await supabase
      .from('quiz_sequence_emails')
      .update({
        subject: step.subject,
        body: step.body,
        active: step.active,
        delay_hours: step.delay_hours,
      })
      .eq('step_order', step.step_order);
    setSavingStep(null);
    setMessages(prev => ({
      ...prev,
      [step.step_order]: error
        ? { type: 'error', text: `Erreur : ${error.message}` }
        : { type: 'success', text: 'Enregistré.' },
    }));
  };

  if (loading) {
    return <p className="text-stone-400 text-sm italic">Chargement de la séquence…</p>;
  }

  if (steps.length === 0) {
    return (
      <div className="max-w-2xl bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
        Aucune étape trouvée. La table <code className="bg-amber-100 px-1 rounded">quiz_sequence_emails</code> doit être
        créée et initialisée avec <code className="bg-amber-100 px-1 rounded">supabase/quiz-sequence.sql</code> (SQL editor Supabase).
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-800">Séquence email post-quiz</h2>
        <p className="text-sm text-stone-500 mt-1">
          Envoyée automatiquement à chaque inscrit ayant reçu un profil, à partir du moment où il a débloqué son résultat.
          Utilisez <code className="bg-stone-100 px-1 rounded text-xs">{'{{cta_url}}'}</code> pour le lien vers l'appel découverte,
          et <code className="bg-stone-100 px-1 rounded text-xs">{'{{resultat_url}}'}</code> pour renvoyer vers la page de résultat exacte de l'inscrit.
        </p>
      </div>

      {steps.map(step => {
        const message = messages[step.step_order];
        return (
          <div key={step.step_order} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-sage bg-sage/10 px-2.5 py-1 rounded-full">
                  Étape {step.step_order}
                </span>
                <span className="text-xs text-stone-400">{formatDelay(step.delay_hours)} après le profil</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-stone-500">
                <input
                  type="checkbox"
                  checked={step.active}
                  onChange={e => updateField(step.step_order, 'active', e.target.checked)}
                  className="accent-sage"
                />
                Actif
              </label>
            </div>

            <div>
              <label htmlFor={`seq-delay-${step.step_order}`} className="block text-xs font-medium text-stone-500 mb-1">Délai d'envoi (en heures depuis le profil)</label>
              <input
                id={`seq-delay-${step.step_order}`}
                type="number"
                min={0}
                value={step.delay_hours}
                onChange={e => updateField(step.step_order, 'delay_hours', Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div>
              <label htmlFor={`seq-subject-${step.step_order}`} className="block text-xs font-medium text-stone-500 mb-1">Objet de l'email</label>
              <input
                id={`seq-subject-${step.step_order}`}
                value={step.subject}
                onChange={e => updateField(step.step_order, 'subject', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div>
              <label htmlFor={`seq-body-${step.step_order}`} className="block text-xs font-medium text-stone-500 mb-1">
                Corps de l'email (texte brut, laissez une ligne vide entre les paragraphes)
              </label>
              <textarea
                id={`seq-body-${step.step_order}`}
                value={step.body}
                onChange={e => updateField(step.step_order, 'body', e.target.value)}
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm leading-relaxed font-mono focus:outline-none focus:border-sage"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleSave(step)}
                disabled={savingStep === step.step_order}
                className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-stone-deep transition-colors disabled:opacity-60"
              >
                <Save size={13} /> {savingStep === step.step_order ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {message && (
                <span className={`flex items-center gap-1.5 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {message.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {message.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
