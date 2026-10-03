'use client';

import React, { useCallback, useRef, useState } from 'react';
import { BottomSheet } from '../mobile/ui';
import { Button } from '../ui';

/**
 * Confirmation sans `confirm()` natif sur téléphone : une feuille du bas, avec
 * deux gros boutons. Sur ordinateur (≥ lg) on garde le `confirm()` d'origine,
 * pour que le bureau reste strictement identique.
 *
 *   const [confirmer, confirmNode] = useConfirm();
 *   if (!(await confirmer({ title: 'Supprimer ?', message: '…', confirmLabel: 'Supprimer', danger: true }))) return;
 *   …
 *   return <>{…}{confirmNode}</>;
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm(): [(o: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmer = useCallback((o: ConfirmOptions) => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      return Promise.resolve(window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
    }
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const node = (
    <BottomSheet
      open={!!opts}
      onClose={() => close(false)}
      title={opts?.title ?? ''}
      description={opts?.message}
      zIndex={1000}
      footer={
        <div className="flex w-full gap-2">
          <Button className="flex-1" onClick={() => close(false)}>
            {opts?.cancelLabel ?? 'Annuler'}
          </Button>
          <Button className="flex-1" variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {opts?.confirmLabel ?? 'Confirmer'}
          </Button>
        </div>
      }
    >
      <span className="sr-only">Confirmation requise</span>
    </BottomSheet>
  );
  return [confirmer, node];
}
