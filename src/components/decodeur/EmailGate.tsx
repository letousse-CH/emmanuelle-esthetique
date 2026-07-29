"use client";

import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGate({
  score,
  maxScore,
  onUnlock,
}: {
  score: number;
  maxScore: number;
  onUnlock: (email: string) => Promise<void> | void;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const percent = Math.round((score / maxScore) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setError('Merci d\'indiquer une adresse email valide.');
      return;
    }
    setError('');
    setLoading(true);
    await onUnlock(email);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 md:py-24 text-center">
      <p className="text-sage font-bold tracking-[0.3em] uppercase text-xs mb-4">Test terminé</p>
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 mb-6">Votre profil est prêt.</h1>

      <div className="rounded-3xl border border-stone-200 bg-white p-8 mb-8">
        <span className="block text-5xl font-bold text-stone-900 mb-1">{percent}%</span>
        <span className="block text-xs uppercase tracking-widest text-stone-400 mb-4">de signaux détectés</span>
        <div className="flex items-center justify-center gap-2 text-stone-300">
          <Lock className="w-4 h-4" />
          <span className="font-serif text-xl font-bold blur-sm select-none">Profil verrouillé</span>
        </div>
      </div>

      <p className="text-stone-500 leading-relaxed mb-6 font-light">
        Indiquez votre email pour recevoir votre profil détaillé et ce qu'il implique concrètement pour vous.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="decodeur-email" className="sr-only">Adresse email</label>
        <input
          id="decodeur-email"
          type="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          className="w-full px-5 py-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 outline-none focus:border-sage focus:ring-1 focus:ring-sage/20 text-center"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sage text-white py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-stone-deep transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recevoir mon profil par email'}
        </button>
      </form>
      <p className="text-xs text-stone-400 mt-4">Pas de spam. Désabonnement en un clic.</p>
    </div>
  );
}
