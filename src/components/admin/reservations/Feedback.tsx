"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, Info, XCircle } from 'lucide-react';
import Overlay from './Overlay';
import { Button } from '../ui';

/**
 * Remplace `alert()` et `confirm()` natifs : messages courts qui s'effacent
 * (`toast`) et boîte de confirmation (`ask`) avec, au besoin, une case à cocher
 * (par exemple « Prévenir la cliente par e-mail »).
 */

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

export interface AskOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  checkbox?: { label: string; defaultChecked: boolean; disabled?: boolean; hint?: string };
}
export interface AskResult {
  ok: boolean;
  checked: boolean;
}

interface FeedbackApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
  ask: (opts: AskOptions) => Promise<AskResult>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback doit être utilisé dans <FeedbackProvider>.');
  return v;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<{ opts: AskOptions; resolve: (r: AskResult) => void } | null>(null);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 5000);
  }, []);

  const api = useRef<FeedbackApi>({
    success: (t) => push('success', t),
    error: (t) => push('error', t),
    info: (t) => push('info', t),
    ask: (opts) => new Promise<AskResult>((resolve) => setDialog({ opts, resolve })),
  }).current;

  const close = (r: AskResult) => {
    dialog?.resolve(r);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-[15px] shadow-lg ${
              t.kind === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : t.kind === 'error'
                  ? 'border-red-300 bg-red-50 text-red-950'
                  : 'border-stone-300 bg-white text-stone-900'
            }`}
          >
            {t.kind === 'success' ? (
              <Check size={18} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : t.kind === 'error' ? (
              <XCircle size={18} className="mt-0.5 shrink-0 text-red-700" />
            ) : (
              <Info size={18} className="mt-0.5 shrink-0 text-stone-600" />
            )}
            <span className="min-w-0 flex-1">{t.text}</span>
          </div>
        ))}
      </div>

      {dialog && <ConfirmDialog opts={dialog.opts} onDone={close} />}
    </Ctx.Provider>
  );
}

function ConfirmDialog({ opts, onDone }: { opts: AskOptions; onDone: (r: AskResult) => void }) {
  const [checked, setChecked] = useState(opts.checkbox?.defaultChecked ?? false);
  useEffect(() => setChecked(opts.checkbox?.defaultChecked ?? false), [opts]);
  const cbId = React.useId();

  return (
    <Overlay
      variant="modal"
      zIndex={150}
      title={opts.title}
      onClose={() => onDone({ ok: false, checked })}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="md" data-autofocus={opts.tone === 'danger' ? '' : undefined} className="h-12 sm:h-10" onClick={() => onDone({ ok: false, checked })}>
            {opts.cancelLabel ?? 'Retour'}
          </Button>
          <Button
            data-autofocus={opts.tone === 'danger' ? undefined : ''}
            variant={opts.tone === 'danger' ? 'danger' : 'primary'}
            className="h-12 sm:h-10"
            onClick={() => onDone({ ok: true, checked })}
          >
            {opts.confirmLabel ?? 'Confirmer'}
          </Button>
        </div>
      }
    >
      {opts.message && <div className="text-[15px] leading-relaxed text-stone-800">{opts.message}</div>}
      {opts.checkbox && (
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <label htmlFor={cbId} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium text-stone-900">
            <input
              id={cbId}
              type="checkbox"
              className="size-5 accent-[var(--admin-accent)]"
              checked={checked && !opts.checkbox.disabled}
              disabled={opts.checkbox.disabled}
              onChange={(e) => setChecked(e.target.checked)}
            />
            {opts.checkbox.label}
          </label>
          {opts.checkbox.hint && <p className="mt-1 text-[13px] text-stone-600">{opts.checkbox.hint}</p>}
        </div>
      )}
    </Overlay>
  );
}
