"use client";

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail } from 'lucide-react';
import { supabase } from '../services/supabase';
import EditableImage from './pagebuilder/EditableImage';
import { useModuleFlags } from '../hooks/useModuleFlags';

/*
  Aucune image de repli. Le bandeau affichait une photo de montagne Unsplash
  tant qu'aucun visuel n'était choisi : sans rapport avec l'activité, et
  identique sur tous les sites issus du template. Sans image, le bandeau garde
  simplement son fond de couleur.
*/

function useNewsletter() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const { error } = await supabase.from('subscribers').insert([{ email }]);
      if (!error) { setStatus('success'); setEmail(''); }
      else if (error.code === '23505') setStatus('duplicate');
      else setStatus('error');
    } catch { setStatus('error'); }
  };

  return { email, setEmail, status, setStatus, submit };
}

function hexToRgba(hex: string, alpha: number) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex === 'transparent' || !/^[0-9A-Fa-f]{3,8}$/.test(cleanHex)) {
    return hex;
  }
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── Version complète ───────────────────────────────────────── */
export function NewsletterBanner({ bgImage, bg, theme }: { bgImage?: string; bg?: string; theme?: 'dark' | 'light' }) {
  const { email, setEmail, status, setStatus, submit } = useNewsletter();
  const moduleFlags = useModuleFlags();
  if (!moduleFlags.newsletter) return null;

  return (
    <section 
      style={bg ? { backgroundColor: bg } : undefined}
      className={`relative py-28 px-6 overflow-hidden ${bg ? 'border-t' : ''} ${
        theme === 'light' ? 'border-stone-200/60' : 'border-white/5'
      }`}
    >
      <div className="absolute inset-0">
        {bgImage && (
          <EditableImage
            settingKey="newsletter_bg"
            src={bgImage}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        )}
        {bg ? (
          <div 
            style={{ backgroundColor: hexToRgba(bg === 'transparent' ? '#0A0A0A' : bg, 0.7) }}
            className="absolute inset-0 pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/70 via-stone-900/60 to-stone-900/80 pointer-events-none" />
        )}
      </div>

      <div className="relative z-10 max-w-lg mx-auto text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-white leading-tight">
            Rejoignez la communauté
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <NewsletterForm email={email} setEmail={setEmail} status={status} setStatus={setStatus} submit={submit} />
        </motion.div>
      </div>
    </section>
  );
}

/* ── Formulaire partagé ─────────────────────────────────────── */
function NewsletterForm({ email, setEmail, status, setStatus, submit, dark }: {
  email: string;
  setEmail: (v: string) => void;
  status: string;
  setStatus: (v: any) => void;
  submit: (e: React.FormEvent) => void;
  dark?: boolean;
}) {
  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-3 bg-sage/20 border border-sage/30 text-sage px-6 py-4 rounded-2xl text-base font-medium"
      >
        <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.5 }}>✦</motion.span>
        Inscription confirmée — à très bientôt !
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">Adresse email</label>
        <input
          id="newsletter-email"
          type="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setStatus('idle'); }}
          className={`flex-1 px-4 py-3 outline-none text-sm transition-all rounded-xl ${
            dark
              ? 'bg-white/8 border border-white/15 text-white placeholder:text-stone-500 focus:border-sage/60 focus:bg-white/12'
              : 'bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-sage focus:ring-1 focus:ring-sage/20'
          }`}
        />
        <motion.button
          type="submit"
          disabled={status === 'loading'}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-sage text-white px-5 py-3 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-60 whitespace-nowrap rounded-xl"
        >
          {status === 'loading' ? '…' : "S'abonner"}
        </motion.button>
      </form>
      {status === 'duplicate' && <p className={`text-xs italic ${dark ? 'text-stone-400' : 'text-stone-500'}`}>Cette adresse est déjà inscrite.</p>}
      {status === 'error'     && <p className="text-red-400 text-xs italic">Une erreur s'est produite. Réessayez.</p>}
      <p className={`text-xs ${dark ? 'text-stone-600' : 'text-stone-400'}`}>Pas de spam. Désabonnement en un clic.</p>
    </div>
  );
}
