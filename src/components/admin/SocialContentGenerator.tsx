"use client";

import React, { useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { SITE_CONFIG } from '../../config/site';
import { fetchBrandTokens, BrandTokens } from '../../utils/socialCards';
import type { SocialGenerationResult } from '../../utils/socialGeneration';
import SocialResultDisplay from './SocialResultDisplay';

interface Props {
  title: string;
  content?: string;
  intro?: string;
  keyword?: string;
  coverImage?: string;
}

export default function SocialContentGenerator({ title, content, intro, keyword, coverImage }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SocialGenerationResult | null>(null);
  const [error, setError] = useState('');
  const [brand, setBrand] = useState<BrandTokens | null>(null);

  const generate = async () => {
    setStatus('loading');
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const [res, brandTokens] = await Promise.all([
        fetch('/api/generate-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ title, content, intro, keyword }),
        }),
        fetchBrandTokens(SITE_CONFIG.name),
      ]);
      const data = await res.json();
      if (data.error) throw new Error(data.error === 'not_configured' ? "Clé API IA non configurée." : data.error);
      setBrand(brandTokens);
      setResult(data);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
      setStatus('error');
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-indigo-100 bg-indigo-50/40">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
          📱
        </div>
        <div>
          <p className="text-sm font-bold text-stone-900">Contenu Réseaux Sociaux</p>
          <p className="text-xs text-stone-400">Instagram, LinkedIn & Facebook — {content ? "généré depuis l'article" : "généré depuis la suggestion"}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {(status === 'idle' || status === 'error') && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-sm cursor-pointer"
            >
              <Sparkles size={16} />
              Générer le contenu réseaux sociaux
            </button>
            {status === 'error' && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle size={12} /> {error}
              </p>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-3 text-sm text-stone-500 py-4">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            Génération en cours… (Instagram, LinkedIn, Facebook)
          </div>
        )}

        {status === 'done' && result && brand && (
          <SocialResultDisplay result={result} brand={brand} coverImage={coverImage} onRegenerate={generate} />
        )}
      </div>
    </div>
  );
}
