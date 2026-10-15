"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Callout } from '../../../../components/admin/ui';
import { appliquerReclassement, listLignesFactures } from '../../../../services/financeService';
import { PRODUCT_USAGE_LABELS, planReclassement } from '../../../../types/finance';
import type { PlanReclassement, ProductUsageType } from '../../../../types/finance';
import type { Product } from '../../../../types/caisse';

const MASQUE_KEY = 'caisse:reclassement-masque';

function lireMasques(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MASQUE_KEY) ?? '[]')); } catch { return new Set(); }
}

/**
 * Signale les fiches classées autrement que sur leur facture d'achat et propose
 * de reprendre le classement de la facture (usage, contenance). Jusqu'au
 * 2026-10-15, la base refusait d'écrire l'usage d'une fiche : tous les produits
 * importés étaient restés « vente », flacons cabine et testeurs compris, et
 * apparaissaient en caisse à CHF 0.
 */
export default function ReclassementCallout({ products, onDone }: {
  /** Tous les produits, sans filtre. */
  products: Product[];
  onDone: () => Promise<void> | void;
}) {
  const [plan, setPlan] = useState<PlanReclassement | null>(null);
  const [masques, setMasques] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);

  useEffect(() => {
    setMasques(lireMasques());
    if (products.length === 0) return;
    let cancelled = false;
    listLignesFactures()
      .then(items => { if (!cancelled) setPlan(planReclassement(products, items)); })
      .catch(() => { /* Bannière de confort : sans lecture, rien à proposer. */ });
    return () => { cancelled = true; };
  }, [products]);

  const changements = useMemo(
    () => (plan?.produits ?? []).filter(p => p.de !== p.vers && !masques.has(`${p.id}:${p.vers}`)),
    [plan, masques],
  );
  if (!plan || changements.length === 0) return null;

  const parUsage = changements.reduce<Record<string, number>>((acc, c) => {
    acc[c.vers] = (acc[c.vers] ?? 0) + 1;
    return acc;
  }, {});

  const appliquer = async () => {
    setBusy(true); setError(null);
    try {
      await appliquerReclassement({
        produits: plan.produits.filter(p => p.de === p.vers || !masques.has(`${p.id}:${p.vers}`)),
        liens: plan.liens,
      });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reclassement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const masquer = () => {
    const next = new Set([...masques, ...changements.map(c => `${c.id}:${c.vers}`)]);
    try { localStorage.setItem(MASQUE_KEY, JSON.stringify([...next])); } catch { /* préférence locale */ }
    setMasques(next);
  };

  return (
    <Callout
      tone="warning"
      title={`${changements.length} produit${changements.length > 1 ? 's ne sont pas classés' : ' n\'est pas classé'} comme sur la facture d'achat`}
      actions={
        <>
          <Button size="sm" variant="primary" loading={busy} onClick={appliquer}>Reprendre le classement des factures</Button>
          <Button size="sm" variant="ghost" onClick={masquer}>Ignorer</Button>
        </>
      }
    >
      <p>
        Selon la facture :{' '}
        {Object.entries(parUsage)
          .map(([u, n]) => `${n} ${PRODUCT_USAGE_LABELS[u as ProductUsageType]?.badge.toLowerCase() ?? u}`)
          .join(', ')}
        . Un produit cabine, un testeur ou un échantillon classé « vente » apparaît en caisse (souvent à CHF 0) et manque au stock cabine.
      </p>
      <button type="button" onClick={() => setDetail(d => !d)} className="mt-1 text-[13px] font-semibold underline underline-offset-2 cursor-pointer">
        {detail ? 'Masquer le détail' : 'Voir le détail'}
      </button>
      {detail && (
        <ul className="mt-1.5 text-[13px] space-y-0.5 max-h-48 overflow-y-auto">
          {changements.map(c => (
            <li key={c.id}>
              {c.nom} : {PRODUCT_USAGE_LABELS[c.de].badge} → <strong>{PRODUCT_USAGE_LABELS[c.vers].badge}</strong>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1.5 text-[13px] text-red-800">{error}</p>}
    </Callout>
  );
}
