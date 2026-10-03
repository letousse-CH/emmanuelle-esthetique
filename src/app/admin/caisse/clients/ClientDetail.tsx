"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  X, Cake, Receipt, Loader2, Mail, MessageCircle, Package, Sparkles, AlertCircle, Pencil,
  Phone, CalendarPlus, CreditCard, CalendarDays,
} from 'lucide-react';
import { BottomSheet, ListGroup, ListRow } from '../../../../components/admin/mobile/ui';
import { supabase } from '../../../../services/supabase';
import { PERIODE_LABEL, STATUT_LABEL } from '../../../../types/booking';
import type { Booking } from '../../../../types/booking';
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

/** `true` à partir de 1024 px (le panneau latéral ; en dessous, une feuille plein écran). */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 1024px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true,
  );
}

export default function ClientDetail({ client, stats, onClose, onChanged, onEdit }: {
  client: Client;
  stats: ClientStats | undefined;
  onClose: () => void;
  onChanged: (c: Client) => void;
  /** Ouvre le formulaire de modification (nom, contact, notes…). */
  onEdit?: () => void;
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

  const moisInactif = moisDepuis(stats?.derniere_visite ?? null);

  /** Produits emportés, tous passages confondus — la mémoire commerciale de
   *  l'institut, reconstruite depuis les factures. */
  const produitsAchetes = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; quantite: number; dernier: string }>();
    for (const t of transactions) {
      if (t.status !== 'payee') continue;
      for (const item of t.transaction_items) {
        if (!item.product_id) continue;
        const prev = map.get(item.product_id);
        map.set(item.product_id, {
          id: item.product_id,
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
    <ClientDetailView
      client={client} stats={stats} transactions={transactions} subscriber={subscriber}
      loading={loading} busy={busy} error={error} onDismissError={() => setError(null)}
      moisInactif={moisInactif} produitsAchetes={produitsAchetes}
      onClose={onClose} onEdit={onEdit}
      onToggleConsent={toggleConsent} onToggleNewsletter={toggleNewsletter}
    />
  );
}

export interface ClientDetailViewProps {
  client: Client;
  stats: ClientStats | undefined;
  transactions: TransactionWithItems[];
  subscriber: Subscriber | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
  moisInactif: number | null;
  produitsAchetes: { id: string; nom: string; quantite: number; dernier: string }[];
  onClose: () => void;
  onEdit?: () => void;
  onToggleConsent: (field: 'consent_email' | 'consent_whatsapp') => void;
  onToggleNewsletter: () => void;
  /** Rendez-vous à venir fournis d'avance (aperçu) : évite l'appel réseau. */
  upcomingPreset?: Booking[];
}

/** Présentation de la fiche : panneau latéral sur ordinateur, feuille plein écran sur téléphone. */
export function ClientDetailView({
  client, stats, transactions, subscriber, loading, busy, error, onDismissError, moisInactif,
  produitsAchetes, onClose, onEdit, onToggleConsent, onToggleNewsletter, upcomingPreset,
}: ClientDetailViewProps) {
  const desktop = useIsDesktop();
  const age = clientAge(client);
  const waNumber = toWhatsAppNumber(client.telephone);

  // Fermer à l'échappement : ce panneau se consulte entre deux gestes, il doit
  // se refermer sans viser la croix. (La feuille mobile gère déjà Échap.)
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, desktop]);

  const content = (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={onDismissError} aria-label="Masquer" className="shrink-0 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {!desktop && (
        <div className="grid grid-cols-4 gap-2">
          <QuickAction
            icon={Phone} label="Appeler"
            href={client.telephone ? `tel:${client.telephone.replace(/[^\d+]/g, '')}` : undefined}
          />
          <QuickAction
            icon={MessageCircle} label="WhatsApp" external
            href={waNumber ? `https://wa.me/${waNumber}` : undefined}
          />
          <QuickAction icon={CalendarPlus} label="Rendez-vous" href={`/admin/reservations?nouveau=1&client=${client.id}`} />
          <QuickAction icon={CreditCard} label="Encaisser" tone="accent" href={`/admin/caisse?client=${client.id}`} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="Visites" value={String(stats?.nb_visites ?? 0)} />
        <Metric
          label="Dernière visite"
          value={stats?.derniere_visite ? dateCH(stats.derniere_visite) : '—'}
          hint={moisInactif !== null && moisInactif >= 6 ? `il y a ${moisInactif} mois` : undefined}
          tone={moisInactif !== null && moisInactif >= 6 ? 'warn' : undefined}
        />
        <Metric label="Encaissé" value={formatCHF(stats?.total_encaisse ?? 0)} />
      </div>

      {!desktop && <UpcomingBookings clientId={client.id} preset={upcomingPreset} />}

      {(client.date_naissance || client.notes) && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2.5 text-sm">
          {client.date_naissance && (
            <p className="flex items-center gap-2 text-stone-700">
              <Cake size={14} className="text-accent shrink-0" />
              {new Date(`${client.date_naissance}T00:00:00`).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
              {age !== null && <span className="text-stone-600">· {age} ans</span>}
            </p>
          )}
          {client.notes && (
            <p className="text-stone-600 text-[14px] lg:text-xs whitespace-pre-line leading-relaxed">{client.notes}</p>
          )}
        </div>
      )}

      {/* ── Consentements ───────────────────────────────────────────── */}
      <section className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-[14px] lg:text-[12.5px] font-medium text-stone-700">Accords publicitaires</p>
          <p className="text-[13px] lg:text-[12px] text-stone-600 mt-1 leading-relaxed">
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
          onToggle={() => onToggleConsent('consent_email')}
        />
        <ConsentRow
          icon={MessageCircle}
          label="Offres par WhatsApp"
          detail={waNumber
            ? `+${waNumber}`
            : client.telephone ? 'Numéro non exploitable' : 'Aucun numéro sur la fiche'}
          checked={client.consent_whatsapp}
          disabled={busy || !waNumber}
          onToggle={() => onToggleConsent('consent_whatsapp')}
        />

        {client.email && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-50">
            <div className="min-w-0">
              <p className="text-sm text-stone-700">Newsletter du site</p>
              <p className="text-[13px] lg:text-[12.5px] text-stone-600">
                {subscriber?.active ? 'Inscrite' : subscriber ? 'Désinscrite' : 'Pas inscrite'}
              </p>
            </div>
            <button
              onClick={onToggleNewsletter} disabled={busy}
              className="shrink-0 min-h-11 lg:min-h-0 px-1 text-[14px] lg:text-[13px] font-semibold text-accent hover:underline disabled:opacity-40 cursor-pointer"
            >
              {subscriber?.active ? 'Désinscrire' : 'Inscrire'}
            </button>
          </div>
        )}
      </section>

      {/* ── Historique ──────────────────────────────────────────────── */}
      <p className="text-[14px] lg:text-[12.5px] font-medium text-stone-700 flex items-center gap-1.5 pt-1">
        <Receipt size={12} /> Passages
      </p>

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 flex items-center justify-center gap-2 text-stone-600 text-sm">
          <Loader2 size={15} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <section className="space-y-3">
          {produitsAchetes.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-[14px] lg:text-[12.5px] font-medium text-stone-700 flex items-center gap-1.5 mb-2.5">
                <Package size={12} /> Produits emportés
              </p>
              <ul className="space-y-1.5">
                {produitsAchetes.map(p => (
                  <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-stone-700 truncate">{p.nom}</span>
                    <span className="text-[13px] lg:text-[12.5px] text-stone-600 shrink-0 tabular-nums">
                      ×{p.quantite} · {dateCH(p.dernier)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
              <p className="text-sm text-stone-700">Aucun passage enregistré.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {transactions.map(t => (
                <li
                  key={t.id}
                  className={`bg-white border border-stone-200 rounded-xl p-4 ${t.status === 'annulee' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-stone-800">
                      {dateCH(t.created_at)}
                      <span className="ml-2 text-[13px] lg:text-[12.5px] font-normal text-stone-600 tabular-nums">{t.numero}</span>
                    </p>
                    <p className="text-sm font-medium text-stone-900 tabular-nums shrink-0">
                      {t.status === 'annulee'
                        ? <span className="text-[13px] lg:text-[12.5px] font-semibold text-stone-600">Annulée</span>
                        : formatCHF(recetteEncaissee(t))}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {t.transaction_items.map(item => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 text-[14px] lg:text-xs">
                        <span className="text-stone-600 truncate flex items-center gap-1.5">
                          {item.product_id
                            ? <Package size={10} className="text-stone-600 shrink-0" />
                            : <Sparkles size={10} className="text-stone-600 shrink-0" />}
                          {Number(item.quantite) > 1 && `${Number(item.quantite)}× `}{item.description}
                        </span>
                        <span className="text-stone-600 tabular-nums shrink-0">{formatCHF(item.total_ttc)}</span>
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
  );

  if (!desktop) {
    return (
      <BottomSheet
        open onClose={onClose} size="full"
        title={clientFullName(client)}
        description={[client.telephone, client.email].filter(Boolean).join(' · ') || 'Aucun contact'}
        footer={onEdit && !client.archived ? (
          <button
            type="button" onClick={onEdit}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-[15px] font-semibold text-stone-900 cursor-pointer active:bg-stone-50"
          >
            <Pencil size={16} aria-hidden="true" /> Modifier la fiche
          </button>
        ) : undefined}
      >
        {content}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <aside
        role="dialog" aria-modal="true" aria-label={`Fiche de ${clientFullName(client)}`}
        onClick={e => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-xl h-full overflow-y-auto shadow-2xl"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-stone-900 truncate">{clientFullName(client)}</h2>
              <p className="text-[12.5px] text-stone-600 mt-0.5 truncate">
                {[client.telephone, client.email].filter(Boolean).join(' · ') || 'Aucun contact'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && !client.archived && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <Pencil size={13} /> Modifier
                </button>
              )}
              <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-5">{content}</div>
      </aside>
    </div>
  );
}

/** Raccourci d'action de la fiche mobile : icône au-dessus du libellé, cible de 76 px. */
function QuickAction({ icon: Icon, label, href, external, tone }: {
  icon: React.ElementType; label: string; href?: string; external?: boolean; tone?: 'accent';
}) {
  const cls = `flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-[13px] font-semibold ${
    tone === 'accent' ? 'border-transparent bg-accent text-accent-fg' : 'border-stone-200 bg-white text-stone-900'
  } ${href ? 'cursor-pointer active:scale-[0.97]' : 'opacity-40'}`;
  const body = <><Icon size={22} aria-hidden="true" />{label}</>;
  if (!href) return <span className={cls} aria-disabled="true">{body}</span>;
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  if (href.startsWith('tel:')) return <a href={href} className={cls}>{body}</a>;
  return <Link href={href} className={cls}>{body}</Link>;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Rendez-vous à venir de la cliente (lecture seule, depuis l'API de l'agenda). */
function UpcomingBookings({ clientId, preset }: { clientId: string; preset?: Booking[] }) {
  const [items, setItems] = useState<Booking[] | null>(preset ?? null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false); setItems(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/bookings?clientId=${encodeURIComponent(clientId)}&from=${todayISO()}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { bookings?: Booking[] };
      setItems(
        (json.bookings ?? [])
          .filter(b => (b.statut === 'en_attente' || b.statut === 'confirme') && b.date_rdv >= todayISO())
          .sort((a, b) => `${a.date_rdv} ${a.heure_rdv}`.localeCompare(`${b.date_rdv} ${b.heure_rdv}`)),
      );
    } catch {
      setFailed(true);
    }
  }, [clientId]);

  useEffect(() => { if (!preset) void load(); }, [load, preset]);

  const when = (b: Booking) => {
    const day = new Date(`${b.date_rdv}T00:00:00`).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'long' });
    const hour = b.horaire_fixe && b.heure_rdv
      ? b.heure_rdv.slice(0, 5).replace(':', 'h')
      : (PERIODE_LABEL[(b.periode ?? b.periode_demandee) as keyof typeof PERIODE_LABEL] ?? '').toLowerCase();
    return hour ? `${day} · ${hour}` : day;
  };

  return (
    <section aria-label="Rendez-vous à venir" className="space-y-2">
      <p className="flex items-center gap-1.5 text-[14px] font-medium text-stone-700">
        <CalendarDays size={14} aria-hidden="true" /> Rendez-vous à venir
      </p>
      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-700">
          Les rendez-vous n&apos;ont pas pu être chargés.
          <button type="button" onClick={() => void load()} className="min-h-11 shrink-0 px-2 font-semibold text-accent cursor-pointer">Réessayer</button>
        </div>
      ) : items === null ? (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-4 text-[14px] text-stone-600">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-700">
          Aucun rendez-vous à venir.{' '}
          <Link href={`/admin/reservations?nouveau=1&client=${clientId}`} className="font-semibold text-accent">En fixer un</Link>
        </div>
      ) : (
        <ListGroup label="Rendez-vous à venir">
          {items.map(b => (
            <ListRow
              key={b.id}
              href={`/admin/reservations?id=${b.id}`}
              title={when(b)}
              subtitle={b.service_nom}
              trailing={<span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                b.statut === 'confirme' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
              }`}>{STATUT_LABEL[b.statut]}</span>}
            />
          ))}
        </ListGroup>
      )}
    </section>
  );
}

function Metric({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'warn';
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-3 py-2.5">
      <p className="text-[12.5px] font-semibold text-stone-600">{label}</p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${tone === 'warn' ? 'text-amber-700' : 'text-stone-900'}`}>{value}</p>
      {hint && <p className="text-[12.5px] text-amber-700 mt-0.5">{hint}</p>}
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
        <Icon size={14} className="text-stone-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm text-stone-700">{label}</p>
          <p className="text-[12.5px] text-stone-600 truncate">{detail}</p>
        </div>
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={onToggle} disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed before:absolute before:-inset-3 before:content-[''] ${
          checked ? 'bg-accent' : 'bg-stone-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
