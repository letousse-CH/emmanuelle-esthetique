"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Cake, TriangleAlert, Receipt, NotebookPen, Plus, Pencil, Trash2, Check,
  Loader2, Mail, MessageCircle, Package, Sparkles, AlertCircle,
} from 'lucide-react';
import {
  createClientNote, deleteClientNote, listClientNotes, listClientTransactions,
  updateClient, updateClientNote,
} from '../../../../services/caisse';
import {
  findSubscriberByEmail, subscribeEmail, unsubscribeEmail,
} from '../../../../services/promotions';
import {
  clientAge, clientFullName, formatCHF, moisDepuis, recetteEncaissee,
} from '../../../../types/caisse';
import type { Client, ClientNote, ClientStats, TransactionWithItems } from '../../../../types/caisse';
import type { Subscriber } from '../../../../types/promotions';
import { toWhatsAppNumber } from '../../../../types/promotions';

const dateCH = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CH') : '—';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ClientDetail({ client, stats, onClose, onChanged }: {
  client: Client;
  stats: ClientStats | undefined;
  onClose: () => void;
  onChanged: (c: Client) => void;
}) {
  const [tab, setTab] = useState<'suivi' | 'historique'>('suivi');
  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<ClientNote | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tx, n] = await Promise.all([
        listClientTransactions(client.id),
        listClientNotes(client.id),
      ]);
      setTransactions(tx); setNotes(n);
      // Le statut newsletter est un confort : son absence ne doit pas priver
      // la fiche de son historique de soins.
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

  /** Produits achetés, tous passages confondus — la mémoire d'un institut. */
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

  const removeNote = async (n: ClientNote) => {
    if (!confirm('Supprimer cette note de suivi ?')) return;
    setBusy(true);
    try {
      await deleteClientNote(n.id);
      setNotes(prev => prev.filter(x => x.id !== n.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
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
        {/* ── En-tête ────────────────────────────────────────────────── */}
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

          {/* ── Allergies : d'abord, en couleur, parce que c'est la seule
                information de la fiche qui peut faire mal si on l'oublie. ── */}
          {client.allergies?.trim() && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 flex items-center gap-1.5 mb-1">
                <TriangleAlert size={12} /> Allergies &amp; contre-indications
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{client.allergies}</p>
            </div>
          )}

          {/* ── Repères ─────────────────────────────────────────────────── */}
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

          {/* ── Onglets ─────────────────────────────────────────────────── */}
          <div className="flex gap-1.5">
            {([
              { id: 'suivi' as const, label: 'Journal de suivi', icon: NotebookPen },
              { id: 'historique' as const, label: 'Passages', icon: Receipt },
            ]).map(t => (
              <button
                key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  tab === t.id ? 'border-sage bg-sage/8 text-sage' : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white border border-stone-100 rounded-2xl p-8 flex items-center justify-center gap-2 text-stone-400 text-sm">
              <Loader2 size={15} className="animate-spin" /> Chargement…
            </div>
          ) : tab === 'suivi' ? (
            <section className="space-y-2.5">
              <button
                onClick={() => setEditingNote('new')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-stone-300 bg-white text-stone-500 hover:border-sage hover:text-sage text-sm transition-all cursor-pointer"
              >
                <Plus size={14} /> Ajouter une note de soin
              </button>

              {notes.length === 0 ? (
                <div className="bg-white border border-stone-100 rounded-2xl p-6 text-center">
                  <p className="text-stone-400 text-sm italic">Aucune note de suivi.</p>
                  <p className="text-stone-400 text-xs mt-1.5 leading-relaxed">
                    Ce que la facture ne dit pas : produits utilisés en cabine, réaction de
                    la peau, réglages, ce qu&apos;il faudra refaire la prochaine fois.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {notes.map(n => (
                    <li key={n.id} className="bg-white border border-stone-100 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold text-stone-400 tabular-nums">
                          {new Date(`${n.date_soin}T00:00:00`).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingNote(n)} disabled={busy}
                            aria-label="Modifier la note"
                            className="p-1 text-stone-300 hover:text-sage rounded cursor-pointer"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => removeNote(n)} disabled={busy}
                            aria-label="Supprimer la note"
                            className="p-1 text-stone-300 hover:text-red-500 rounded cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </div>
                      <p className="text-sm text-stone-700 whitespace-pre-line leading-relaxed mt-1.5">{n.contenu}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
                      className={`bg-white border rounded-2xl p-4 ${t.status === 'annulee' ? 'border-stone-100 opacity-60' : 'border-stone-100'}`}
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

        {editingNote && (
          <NoteDialog
            note={editingNote === 'new' ? null : editingNote}
            clientId={client.id}
            onClose={() => setEditingNote(null)}
            onSaved={saved => {
              setNotes(prev => {
                const next = prev.some(n => n.id === saved.id)
                  ? prev.map(n => (n.id === saved.id ? saved : n))
                  : [saved, ...prev];
                return next.sort((a, b) => b.date_soin.localeCompare(a.date_soin));
              });
              setEditingNote(null);
            }}
          />
        )}
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

function NoteDialog({ note, clientId, onClose, onSaved }: {
  note: ClientNote | null;
  clientId: string;
  onClose: () => void;
  onSaved: (n: ClientNote) => void;
}) {
  const [date, setDate] = useState(note?.date_soin ?? today());
  const [contenu, setContenu] = useState(note?.contenu ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contenu.trim()) return;
    setSaving(true); setError(null);
    try {
      onSaved(note
        ? await updateClientNote(note.id, { date_soin: date, contenu: contenu.trim() })
        : await createClientNote({
            client_id: clientId, transaction_id: null, date_soin: date, contenu: contenu.trim(),
          }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={note ? 'Modifier la note' : 'Nouvelle note de soin'}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <NotebookPen size={14} className="text-sage" /> {note ? 'Modifier la note' : 'Nouvelle note de soin'}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="note-date" className="block text-[11px] font-medium text-stone-500 mb-1">Date du soin</label>
            <input
              id="note-date" type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="note-contenu" className="block text-[11px] font-medium text-stone-500 mb-1">Observation *</label>
            <textarea
              id="note-contenu" rows={6} value={contenu} onChange={e => setContenu(e.target.value)} required autoFocus
              placeholder="Produits utilisés, réaction de la peau, réglages, ce qu'il faudra refaire…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all resize-y"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm hover:border-stone-300 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={saving || !contenu.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-sage transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
