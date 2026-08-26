"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { ShieldCheck, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import SystemHealthModal, { HealthData } from './SystemHealthModal';

export default function SystemHealthPill() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async (refresh = false) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      if (!token) {
        setLoading(false);
        return;
      }
      const url = refresh ? '/api/admin/ai-status?refresh=true' : '/api/admin/ai-status';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setHealth(json);
    } catch (err) {
      // Silencieusement ignoré si non authentifié ou en mode dev sans base
    } finally {
      setLoading(false);
    }
  };

  const isOk = health?.ok ?? true;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-extrabold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
          isOk
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200/90 shadow-2xs hover:bg-emerald-100'
            : 'bg-amber-50 text-amber-900 border-amber-200/90 shadow-2xs hover:bg-amber-100'
        }`}
        title="Cliquez pour inspecter l'état des services et des clés API"
      >
        <span className={`size-2 rounded-full ${isOk ? 'bg-emerald-500 shadow-2xs shadow-emerald-500/50 animate-pulse' : 'bg-amber-500 shadow-2xs shadow-amber-500/50 animate-bounce'}`} />
        <span>{isOk ? 'Services & IA prêts' : 'Check API requis'}</span>
        <Activity size={13} className={isOk ? 'text-emerald-600' : 'text-amber-600'} />
      </button>

      <SystemHealthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        healthData={health}
        loading={loading}
        onRefresh={() => fetchHealth(true)}
      />
    </>
  );
}
