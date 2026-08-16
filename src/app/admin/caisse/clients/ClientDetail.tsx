"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Cake, Receipt, Loader2, Mail, MessageCircle, Package, Sparkles, AlertCircle,
} from 'lucide-react';
import { listClientTransactions, updateClient } from '../../../../services/caisse';
import {
  findSubscriberByEmail, subscribeEmail, unsubscribeEmail,
} from '../../../../services/promotions';
import {
  clientAge, clientFullName, formatCHF, moisDepuis, recetteEncaissee,
} from '../../../../types/caisse';
import type { Client, ClientStats, TransactionWithItems } from '../../../../types/caisse';
import type { Subscriber } from '../../../../types/promotions';
import { toWhatsAppNumber } from '../../../../types/promotions';

/*
 * Aucune donnée de santé n'apparaît sur cette fiche : ni allergies, ni
 * observation après soin. Décision de l'exploitante, appliquée en base par
 * `20260804_retrait_donnees_sante.sql`. Ne pas en réintroduire sans elle.
 */

const dateCH = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CH') : '—';

export default function ClientDetail({ client, stats, onClose, onChanged }: {
  client: Client;
  stats: ClientStats | undefined;
  onClose: () => void;
  onChanged: (c: Client) => void;
}) {
  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setTransactions(await listClientTransactions(client.id));
      // Le statut newsletter est un confort : son absence ne doit pas priver
      // la fiche de son historique.
      if (client.email) {
        setSubscriber(await findSubscriberByEmail(client.email).catch(() => null));
      } else {
        setSubscriber(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [client.id, client.email]);

  useEffect(() => { load(); }, [load]);

  // Fermer à l'échappement : ce panneau se consulte entre deux gestes, il doit
  // se refermer sans viser la croix.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const age = clientAge(client);
  const waNumber = toWhatsAppNumber(client.telephone);
  const moisInactif = moisDepuis(stats?.derniere_visite ?? null);

  /** Produits emportés, tous passages confondus — la mémoire commerciale de
   *  l'institut, reconstruite depuis les factures. */
  const produitsAchetes = useMemo(() => {
    const map = new Map<string, { nom: string; quantite: number; dernier: string }>();
    for (const t of transactions) {
      if (t.status !== 'payee') continue;
      for (const item of t.transaction_items) {
        if (!item.product_id) continue;
        const prev = map.get(item.product_id);
        map.set(item.product_id, {
          nom: item.description,
          quantite: (prev?.quantite ?? 0) + Number(item.quantite),
          dernier: prev?.dernier ?? t.created_at,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.dernier.localeCompare(a.dernier));
  }, [transactions]);

  const toggleConsent = async (field: 'consent_email' | 'consent_whatsapp') => {
    setBusy(true); setError(null);
    try {
      onChanged(await updateClient(client.id, {
        [field]: !client[field],
        // La source n'est renseignée qu'à l'octroi ; le trigger l'efface au retrait.
        consent_source: !client[field] ? 'Fiche cliente' : null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggleNewsletter = async () => {
    if (!client.email) return;
    setBusy(true); setError(null);
    try {
      if (subscriber?.active) {
        await unsubscribeEmail(client.email);
        setSubscriber({ ...subscriber, active: false });
      } else {
        setSubscriber(await subscribeEmail(client.email));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <aside
        role="dialog" aria-modal="true" aria-label={`Fiche de ${clientFullName(client)}`}
        onClick={e => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-xl h-full overflow-y-auto shadow-2xl"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-stone-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-stone-900 truncate">{clientFullName(client)}</h2>
              <p className="text-xs text-stone-400 mt-0.5 truncate">
                {[client.telephone, client.email].filter(Boolean).join(' · ') || 'Aucun contact'}
              </p>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="shrink-0 p-1.5 text-stone-400 hover:text-stone-800 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Masquer" className="shrink-0 cursor-pointer"><X size={14} /></button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <Metric label="Visites" value={String(stats?.nb_visites ?? 0)} />
            <Metric
              label="Dernière"
              value={stats?.derniere_visite ? dateCH(stats.derniere_visite) : '—'}
              hint={moisInactif !== null && moisInactif >= 6 ? `il y a ${moisInactif} mois` : undefined}
              tone={moisInactif !== null && moisInactif >= 6 ? 'warn' : undefined}
            />
            <Metric label="Encaissé" value={formatCHF(stats?.total_encaisse ?? 0)} />
          </div>

          {(client.date_naissance || client.notes) && (
            <div className="bg-white border border-stone-100 rounded-2xl p-4 space-y-2.5 text-sm">
              {client.date_naissance && (
                <p className="flex items-center gap-2 text-stone-600">
                  <Cake size={14} className="text-sage shrink-0" />
                  {new Date(`${client.date_naissance}T00:00:00`).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {age !== null && <span className="text-stone-400">· {age} ans</span>}
                </p>
              )}
              {client.notes && (
                <p className="text-stone-500 text-xs whitespace-pre-line leading-relaxed">{client.notes}</p>
              )}
            </div>
          )}

          {/* ── Consentements ───────────────────────────────────────────── */}
          <section className="bg-white border border-stone-100 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Accords publicitaires</p>
              <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                À cocher seulement si elle l&apos;a dit. Encaisser quelqu&apos;un ne vaut pas accord
                (LCD art. 3 al. 1 let. o).
                {client.consent_at && (
                  <> Accordé le {dateCH(client.consent_at)}
                  {client.consent_source ? ` — ${client.consent_source}` : ''}.</>
                )}
              </p>
            </div>

            <ConsentRow
              icon={Mail}
              label="Offres par e-mail"
              detail={client.email ?? 'Aucune adresse sur la fiche'}
              checked={client.consent_email}
              disabled={busy || !client.email}
              onToggle={() => toggleConsent('consent_email')}
            />
            <ConsentRow
              icon={MessageCircle}
              label="Offres par WhatsApp"
              detail={waNumber
                ? `+${waNumber}`
                : client.telephone ? 'Numéro non exploitable' : 'Aucun numéro sur la fiche'}
              checked={client.consent_whatsapp}
              disabled={busy || !waNumber}
              onToggle={() => toggleConsent('consent_whatsapp')}
            />

            {client.email && (
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-50">
                <div className="min-w-0">
                  <p className="text-sm text-stone-700">Newsletter du site</p>
                  <p className="text-[11px] text-stone-400">
                    {subscriber?.active ? 'Inscrite' : subscriber ? 'Désinscrite' : 'Pas inscrite'}
                  </p>
                </div>
                <button
                  onClick={toggleNewsletter} disabled={busy}
                  className="shrink-0 text-[11px] font-semibold text-sage hover:underline disabled:opacity-40 cursor-pointer"
                >
                  {subscriber?.active ? 'Désinscrire' : 'Inscrire'}
                </button>
              </div>
            )}
          </section>

          {/* ── Historique ──────────────────────────────────────────────── */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 flex items-center gap-1.5 pt-1">
            <Receipt size={12} /> Passages
          </p>

          {loading ? (
            <div className="bg-white border border-stone-100 rounded-2xl p-8 flex items-center justify-center gap-2 text-stone-400 text-sm">
              <Loader2 size={15} className="animate-spin" /> Chargement…
            </div>
          ) : (
            <section className="space-y-3">
              {produitsAchetes.length > 0 && (
                <div className="bg-white border border-stone-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 flex items-center gap-1.5 mb-2.5">
                    <Package size={12} /> Produits emportés
                  </p>
                  <ul className="space-y-1.5">
                    {produitsAchetes.map(p => (
                      <li key={p.nom} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-stone-700 truncate">{p.nom}</span>
                        <span className="text-xs text-stone-400 shrink-0 tabular-nums">
                          ×{p.quantite} · {dateCH(p.dernier)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {transactions.length === 0 ? (
                <div className="bg-white border border-stone-100 rounded-2xl p-6 text-center">
                  <p className="text-stone-400 text-sm italic">Aucun passage enregistré.</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {transactions.map(t => (
                    <li
                      key={t.id}
                      className={`bg-white border border-stone-100 rounded-2xl p-4 ${t.status === 'annulee' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium text-stone-800">
                          {dateCH(t.created_at)}
                          <span className="ml-2 text-[11px] font-normal text-stone-400 font-mono">{t.numero}</span>
                        </p>
                        <p className="text-sm font-medium text-stone-900 tabular-nums shrink-0">
                          {t.status === 'annulee'
                            ? <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Annulée</span>
                            : formatCHF(recetteEncaissee(t))}
                        </p>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {t.transaction_items.map(item => (
                          <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="text-stone-500 truncate flex items-center gap-1.5">
                              {item.product_id
                                ? <Package size={10} className="text-stone-300 shrink-0" />
                                : <Sparkles size={10} className="text-stone-300 shrink-0" />}
                              {Number(item.quantite) > 1 && `${Number(item.quantite)}× `}{item.description}
                            </span>
                            <span className="text-stone-400 tabular-nums shrink-0">{formatCHF(item.total_ttc)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'warn';
}) {
  return (
    <div className="bg-white border border-stone-100 rounded-2xl px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${tone === 'warn' ? 'text-amber-600' : 'text-stone-900'}`}>{value}</p>
      {hint && <p className="text-[9px] text-amber-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function ConsentRow({ icon: Icon, label, detail, checked, disabled, onToggle }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; detail: string; checked: boolean; disabled: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon size={14} className="text-stone-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm text-stone-700">{label}</p>
          <p className="text-[11px] text-stone-400 truncate">{detail}</p>
        </div>
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={onToggle} disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          checked ? 'bg-sage' : 'bg-stone-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
