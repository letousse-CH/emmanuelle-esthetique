"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Activity } from 'lucide-react';
import SystemHealthModal, { HealthData } from './SystemHealthModal';

// Le shell monte deux pastilles (bureau et téléphone, l'une masquée par CSS) :
// on partage la requête en cours pour ne pas interroger le diagnostic deux fois.
let inflight: Promise<HealthData> | null = null;

async function loadHealth(token: string, refresh: boolean): Promise<HealthData> {
  if (inflight && !refresh) return inflight;
  const url = refresh ? '/api/admin/ai-status?refresh=true' : '/api/admin/ai-status';
  const p = fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<HealthData>;
    })
    .finally(() => {
      window.setTimeout(() => { if (inflight === p) inflight = null; }, 3000);
    });
  inflight = p;
  return p;
}

/** `compact` : simple point d'état de 44 px, pour l'en-tête mobile. */
export default function SystemHealthPill({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchHealth();
    // Même diagnostic rafraîchi quand une clé Claude vient d'être enregistrée.
    const onKeyChange = () => { void fetchHealth(true); };
    window.addEventListener('admin:ai-key-changed', onKeyChange);
    return () => window.removeEventListener('admin:ai-key-changed', onKeyChange);
  }, []);

  const fetchHealth = async (refresh = false) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      if (!token) {
        setFetchError('Session expirée : reconnectez-vous pour vérifier les services.');
        return;
      }
      const json = await loadHealth(token, refresh);
      setHealth(json);
      setFetchError(null);
    } catch (err) {
      // Le diagnostic ne bloque rien : on garde le dernier état connu et on le signale.
      setFetchError("L'état des services n'a pas pu être vérifié. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  /*
    Tant que le diagnostic n'a pas répondu, on n'affirme rien : la pastille
    annonçait « prêts » même quand la vérification avait échoué.
  */
  const state: 'ok' | 'warning' | 'unknown' = !health ? 'unknown' : health.ok ? 'ok' : 'warning';
  const label = state === 'ok' ? 'Services prêts' : state === 'warning' ? 'Réglage à compléter' : 'État des services';
  const dot = state === 'ok' ? 'bg-emerald-500' : state === 'warning' ? 'bg-amber-500' : 'bg-stone-400';

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={`${label} : voir le détail`}
          className="relative grid size-11 cursor-pointer place-items-center rounded-full text-stone-700 transition-colors active:bg-stone-100"
        >
          <Activity size={21} strokeWidth={1.9} aria-hidden="true" />
          <span className={`absolute right-2.5 top-2.5 size-2.5 rounded-full ring-2 ring-white ${dot}`} aria-hidden="true" />
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 px-3 h-8 rounded-full border border-stone-200 bg-white text-[13px] font-medium text-stone-800 transition-colors cursor-pointer hover:bg-stone-100"
        title="Voir l'état des services du site"
      >
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        <span>{label}</span>
        <Activity size={13} className="text-stone-600" />
      </button>
      )}

      <SystemHealthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        healthData={health}
        loading={loading}
        fetchError={fetchError}
        onRefresh={() => fetchHealth(true)}
      />
    </>
  );
}
