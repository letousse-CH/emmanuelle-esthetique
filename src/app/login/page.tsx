"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { Lock, Mail, ArrowLeft, KeyRound, CheckCircle } from 'lucide-react';

type Mode = 'login' | 'forgot' | 'reset';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data?.session) {
      router.push('/admin');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Un e-mail de réinitialisation a été envoyé. Veuillez vérifier votre boîte de réception.");
      setMode('login');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.");
      setMode('login');
      // Clear hash parameters
      if (typeof window !== 'undefined') {
        window.location.hash = '';
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-[#FAF9FB] px-4 pt-24 pb-16 font-sans">
      <div className="bg-white p-8 md:p-12 shadow-2xl border border-stone-100 max-w-md w-full rounded-3xl relative overflow-hidden">
        
        {/* Decorative corner glow */}
        <div className="absolute right-[-10%] top-[-10%] w-32 h-32 rounded-full bg-sage/5 blur-xl pointer-events-none" />

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#3A3730]/5 rounded-2xl flex items-center justify-center text-[#3A3730]">
            {mode === 'login' && <Lock size={28} />}
            {mode === 'forgot' && <Mail size={28} />}
            {mode === 'reset' && <KeyRound size={28} />}
          </div>
        </div>
        
        <h1 className="text-2xl text-center font-serif font-black text-[#3A3730] mb-2 uppercase tracking-widest">
          {mode === 'login' && 'Administration'}
          {mode === 'forgot' && 'Mot de passe oublié'}
          {mode === 'reset' && 'Nouveau mot de passe'}
        </h1>
        
        <p className="text-stone-500 text-center mb-8 text-xs font-light">
          {mode === 'login' && 'Connectez-vous pour gérer votre site'}
          {mode === 'forgot' && "Entrez votre email pour recevoir un lien de réinitialisation"}
          {mode === 'reset' && 'Définissez votre nouveau mot de passe administrateur'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 text-xs border border-red-100 rounded-xl font-medium">
            {error === 'Invalid login credentials' ? 'Identifiants incorrects. Veuillez réessayer.' : error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-700 p-4 mb-6 text-xs border border-green-100 rounded-xl font-medium flex gap-2 items-start">
            <CheckCircle size={16} className="shrink-0 text-green-600 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[10px] uppercase tracking-widest text-[#3A3730] mb-2 font-bold">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:border-[#8A9A7B] focus:ring-1 focus:ring-[#8A9A7B] outline-none rounded-xl transition-all bg-[#FAF9FB] focus:bg-white text-stone-900 placeholder:text-stone-400 text-sm"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-[10px] uppercase tracking-widest text-[#3A3730] font-bold">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[10px] text-[#8A9A7B] hover:text-[#3A3730] font-bold uppercase tracking-wider transition-colors"
                >
                  Oublié ?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:border-[#8A9A7B] focus:ring-1 focus:ring-[#8A9A7B] outline-none rounded-xl transition-all bg-[#FAF9FB] focus:bg-white text-stone-900 placeholder:text-stone-400 text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3A3730] text-white py-4 rounded-xl uppercase tracking-[0.2em] text-[11px] font-bold hover:bg-[#8A9A7B] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#3A3730]/10"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[10px] uppercase tracking-widest text-[#3A3730] mb-2 font-bold">
                Votre email administrateur
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:border-[#8A9A7B] focus:ring-1 focus:ring-[#8A9A7B] outline-none rounded-xl transition-all bg-[#FAF9FB] focus:bg-white text-stone-900 placeholder:text-stone-400 text-sm"
                placeholder="votre@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3A3730] text-white py-4 rounded-xl uppercase tracking-[0.2em] text-[11px] font-bold hover:bg-[#8A9A7B] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#3A3730]/10"
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full flex items-center justify-center gap-2 text-stone-400 hover:text-[#3A3730] text-xs transition-colors pt-2 cursor-pointer font-medium"
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          </form>
        )}

        {/* 3. RESET PASSWORD FORM */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label htmlFor="new-password" className="block text-[10px] uppercase tracking-widest text-[#3A3730] mb-2 font-bold">
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 focus:border-[#8A9A7B] focus:ring-1 focus:ring-[#8A9A7B] outline-none rounded-xl transition-all bg-[#FAF9FB] focus:bg-white text-stone-900 placeholder:text-stone-400 text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3A3730] text-white py-4 rounded-xl uppercase tracking-[0.2em] text-[11px] font-bold hover:bg-[#8A9A7B] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#3A3730]/10"
            >
              {loading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
