"use client";

import React, { useState } from 'react';
import { UsersRound } from 'lucide-react';
import { Button } from '../ui';
import { adminFetch, announceBookingsChanged, errorMessage } from './lib';

interface SyncResult {
  rattaches: number;
  crees: number;
  ignores: number;
}

/**
 * Rattache à la clientèle les réservations qui n'ont pas encore de fiche
 * (anciennes demandes en ligne). Aucun consentement publicitaire n'est accordé
 * par ce geste : les fiches créées gardent leurs accords à « non ».
 */
export default function SyncClientsButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminFetch<SyncResult>('/api/admin/bookings/sync-clients', { method: 'POST' });
      setResult(res);
      announceBookingsChanged();
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[14.5px] text-stone-800">
        Les anciennes réservations qui ne sont pas encore reliées à une fiche cliente peuvent y être rattachées en un clic. Les clientes déjà connues sont retrouvées par leur téléphone ou leur e-mail ; les autres reçoivent une nouvelle fiche.
      </p>
      <Button onClick={run} loading={busy} icon={UsersRound} className="h-12 w-full sm:w-auto">
        Rattacher les réservations à la clientèle
      </Button>
      <div aria-live="polite">
        {result && (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[14.5px] text-emerald-950">
            Terminé : <strong>{result.rattaches}</strong> rattachée{result.rattaches > 1 ? 's' : ''} à une fiche existante,{' '}
            <strong>{result.crees}</strong> nouvelle{result.crees > 1 ? 's' : ''} fiche{result.crees > 1 ? 's' : ''} créée{result.crees > 1 ? 's' : ''},{' '}
            <strong>{result.ignores}</strong> ignorée{result.ignores > 1 ? 's' : ''}.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
