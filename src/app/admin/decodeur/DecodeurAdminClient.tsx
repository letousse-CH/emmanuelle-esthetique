"use client";

import { useEffect, useState } from 'react';
import { Save, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface ProfileRow {
  id: string;
  tag: string;
  zone: string;
  min_score: number;
  max_score: number;
  title: string;
  tagline: string;
  body: string;
  cta_type: string;
  cta_label: string;
  cta_href: string;
}

const ZONE_LABELS: Record<string, string> = {
  vert: 'Vert',
  attention: 'Attention',
  alerte: 'Alerte',
  danger: 'Danger',
};

export default function DecodeurAdminClient() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('quiz_profiles')
        .select('*')
        .order('min_score', { ascending: true });
      if (!error && data) setProfiles(data as ProfileRow[]);
      setLoading(false);
    })();
  }, []);

  const updateField = (id: string, field: keyof ProfileRow, value: string) => {
    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async (profile: ProfileRow) => {
    setSavingId(profile.id);
    setMessages(prev => ({ ...prev, [profile.id]: undefined as any }));
    const { error } = await supabase
      .from('quiz_profiles')
      .update({
        title: profile.title,
        tagline: profile.tagline,
        body: profile.body,
        cta_label: profile.cta_label,
        cta_href: profile.cta_href,
      })
      .eq('id', profile.id);
    setSavingId(null);
    setMessages(prev => ({
      ...prev,
      [profile.id]: error
        ? { type: 'error', text: `Erreur : ${error.message}` }
        : { type: 'success', text: 'Enregistré.' },
    }));
  };

  if (loading) {
    return <p className="text-stone-400 text-sm italic">Chargement des profils…</p>;
  }

  if (profiles.length === 0) {
    return (
      <div className="max-w-2xl bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm">
        Aucun profil trouvé. La table <code className="bg-amber-100 px-1 rounded">quiz_profiles</code> doit être créée et
        initialisée avec <code className="bg-amber-100 px-1 rounded">supabase/quiz-profiles.sql</code> (SQL editor Supabase).
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Le Décodeur de Relations — Profils</h1>
          <p className="text-sm text-stone-500 mt-1">
            Modifiez les textes affichés en fin de test, par zone de score. Les questions restent dans le code.
          </p>
        </div>
        <a
          href="/decodeur"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-sage transition-colors shrink-0"
        >
          Voir le quiz <ExternalLink size={13} />
        </a>
      </div>

      {profiles.map(profile => {
        const message = messages[profile.id];
        return (
          <div key={profile.id} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-sage bg-sage/10 px-2.5 py-1 rounded-full">
                {ZONE_LABELS[profile.zone] || profile.zone}
              </span>
              <span className="text-xs text-stone-400">Score {profile.min_score}–{profile.max_score} / 105</span>
            </div>

            <div>
              <label htmlFor={`profile-title-${profile.id}`} className="block text-xs font-medium text-stone-500 mb-1">Titre du profil</label>
              <input
                id={`profile-title-${profile.id}`}
                value={profile.title}
                onChange={e => updateField(profile.id, 'title', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div>
              <label htmlFor={`profile-tagline-${profile.id}`} className="block text-xs font-medium text-stone-500 mb-1">Accroche (sous le titre)</label>
              <input
                id={`profile-tagline-${profile.id}`}
                value={profile.tagline}
                onChange={e => updateField(profile.id, 'tagline', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
              />
            </div>

            <div>
              <label htmlFor={`profile-body-${profile.id}`} className="block text-xs font-medium text-stone-500 mb-1">
                Texte du résultat (laissez une ligne vide entre les paragraphes)
              </label>
              <textarea
                id={`profile-body-${profile.id}`}
                value={profile.body}
                onChange={e => updateField(profile.id, 'body', e.target.value)}
                rows={10}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm leading-relaxed focus:outline-none focus:border-sage"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={`profile-cta-label-${profile.id}`} className="block text-xs font-medium text-stone-500 mb-1">Libellé du bouton CTA</label>
                <input
                  id={`profile-cta-label-${profile.id}`}
                  value={profile.cta_label}
                  onChange={e => updateField(profile.id, 'cta_label', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
                />
              </div>
              <div>
                <label htmlFor={`profile-cta-href-${profile.id}`} className="block text-xs font-medium text-stone-500 mb-1">Lien du bouton CTA</label>
                <input
                  id={`profile-cta-href-${profile.id}`}
                  value={profile.cta_href}
                  onChange={e => updateField(profile.id, 'cta_href', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-sage"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleSave(profile)}
                disabled={savingId === profile.id}
                className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-stone-deep transition-colors disabled:opacity-60"
              >
                <Save size={13} /> {savingId === profile.id ? 'Enregistrement…' : 'Enregistrer'}
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
