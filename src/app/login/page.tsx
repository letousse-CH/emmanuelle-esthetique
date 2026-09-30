"use client";

import React, { useState, useEffect } from 'react';
import '../admin/admin.css';
import { useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { Lock, Mail, ArrowLeft, KeyRound, CheckCircle, Loader2 } from 'lucide-react';

type Mode = 'login' | 'forgot' | 'reset';

/**
 * Supabase renvoie ses erreurs en anglais. On traduit les cas courants en
 * disant ce qui s'est passé et quoi faire ; le reste garde le texte d'origine.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect. Vérifiez votre saisie, ou utilisez « Mot de passe oublié ».';
  if (m.includes('email not confirmed')) return "Cette adresse n'a pas encore été confirmée. Ouvrez le lien reçu par e-mail, puis réessayez.";
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives en peu de temps. Patientez quelques minutes avant de réessayer.';
  if (m.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (m.includes('same password') || m.includes('different from the old')) return "Choisissez un mot de passe différent de l'ancien.";
  if (m.includes('session') && (m.includes('missing') || m.includes('expired'))) return 'Le lien de réinitialisation a expiré. Demandez-en un nouveau avec « Mot de passe oublié ».';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion au serveur impossible. Vérifiez votre accès à Internet, puis réessayez.';
  return message;
}

const inputClass =
  'w-full h-11 px-3.5 rounded-lg border border-stone-300 bg-white text-[15px] text-stone-900 placeholder:text-stone-500 ' +
  'transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900';
const labelClass = 'block text-[14px] font-medium text-stone-800 mb-1.5';
const primaryClass =
  'w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-accent-fg text-[15px] font-semibold ' +
  'transition-colors hover:bg-accent-hover disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  // Detect Supabase recovery hash on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
        setMode('reset');
      }
    }
  }, []);

  const switchMode = (next: Mode) => {
    setError(null);
    setMessage(null);
    setMode(next);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(translateAuthError(error.message));
        setLoading(false);
      } else if (data?.session) {
        // Le bouton reste en « Connexion… » jusqu'à l'arrivée sur l'admin.
        router.push('/admin');
      } else {
        setError("La connexion n'a pas abouti. Réessayez dans un instant.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(translateAuthError(err?.message || 'network'));
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/login',
      });

      if (error) {
        setError(translateAuthError(error.message));
      } else {
        setMessage("Si cette adresse correspond à un compte, un e-mail de réinitialisation vient d'être envoyé. Pensez à regarder dans les indésirables.");
        setMode('login');
      }
    } catch (err: any) {
      setError(translateAuthError(err?.message || 'network'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne sont pas identiques. Saisissez-les à nouveau.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setError(translateAuthError(error.message));
      } else {
        setMessage('Mot de passe modifié. Vous pouvez maintenant vous connecter.');
        setNewPassword('');
        setConfirmPassword('');
        setMode('login');
        // Clear hash parameters
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    } catch (err: any) {
      setError(translateAuthError(err?.message || 'network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-16 font-sans">
      <div className="bg-white p-8 md:p-10 border border-stone-200 max-w-md w-full rounded-xl">

        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center text-stone-700">
            {mode === 'login' && <Lock size={22} />}
            {mode === 'forgot' && <Mail size={22} />}
            {mode === 'reset' && <KeyRound size={22} />}
          </div>
        </div>

        <h1 className="text-[24px] text-center font-semibold text-stone-950 mb-1.5">
          {mode === 'login' && 'Connexion à l’administration'}
          {mode === 'forgot' && 'Mot de passe oublié'}
          {mode === 'reset' && 'Nouveau mot de passe'}
        </h1>

        <p className="text-stone-700 text-center mb-7 text-[15px]">
          {mode === 'login' && 'Connectez-vous pour gérer votre site.'}
          {mode === 'forgot' && 'Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.'}
          {mode === 'reset' && 'Choisissez votre nouveau mot de passe.'}
        </p>

        {error && (
          <div role="alert" className="bg-red-50 text-red-800 p-3.5 mb-5 text-[14px] border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="bg-emerald-50 text-emerald-900 p-3.5 mb-5 text-[14px] border border-emerald-200 rounded-lg flex gap-2 items-start">
            <CheckCircle size={16} className="shrink-0 text-emerald-600 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className={labelClass}>
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="votre@email.ch"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-[14px] font-medium text-stone-800">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[14px] text-stone-700 underline-offset-4 hover:text-stone-950 hover:underline transition-colors cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className={primaryClass}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div>
              <label htmlFor="email" className={labelClass}>
                Adresse e-mail du compte
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="votre@email.ch"
              />
            </div>

            <button type="submit" disabled={loading} className={primaryClass}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Envoi…' : 'Recevoir le lien'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full flex items-center justify-center gap-2 text-stone-700 hover:text-stone-950 text-[14px] transition-colors pt-1 cursor-pointer font-medium"
            >
              <ArrowLeft size={15} /> Retour à la connexion
            </button>
          </form>
        )}

        {/* 3. RESET PASSWORD FORM */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label htmlFor="new-password" className={labelClass}>
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-[13px] text-stone-600">8 caractères au minimum.</p>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className={labelClass}>
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-new-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className={primaryClass}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
