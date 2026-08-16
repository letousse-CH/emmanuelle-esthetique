"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Search, UserPlus, Trash2, Pencil, X, Check, Loader2, AlertCircle, Archive, Download,
  TriangleAlert, Mail, MessageCircle, Cake,
} from 'lucide-react';
import {
  createClient, deleteOrArchiveClient, listClientStats, listClients, matchClient, updateClient,
} from '../../../../services/caisse';
import type { ClientInput } from '../../../../services/caisse';
import { clientFullName, formatCHF } from '../../../../types/caisse';
import type { Client, ClientStats } from '../../../../types/caisse';
import { toWhatsAppNumber } from '../../../../types/promotions';
import ClientDetail from './ClientDetail';

const EMPTY: ClientInput = {
  nom: '', prenom: '', telephone: '', email: '', notes: '',
  date_naissance: null, allergies: '',
  // Jamais `true` par défaut : un consentement qui s'accorde par omission n'en
  // est pas un (LCD art. 3 al. 1 let. o).
  consent_email: false, consent_whatsapp: false, consent_source: null,
};

const dateCH = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CH') : '—';

export default function ClientsClient() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing]     = useState<Client | 'new' | null>(null);
  const [detail, setDetail]       = useState<Client | null>(null);
  const [stats, setStats]         = useState<Map<string, ClientStats>>(new Map());
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [flash, setFlash]         = useState<string | null>(null);

  useEffect(() => { load(); }, [showArchived]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setClients(await listClients(showArchived));
      // Les agrégats sont un confort d'affichage : leur absence — vue
      // `client_stats` pas encore créée — ne doit pas priver du fichier clientes.
      setStats(await listClientStats().catch(() => new Map<string, ClientStats>()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => clients.filter(c => matchClient(c, search)),
    [clients, search],
  );

  const handleDelete = async (c: Client) => {
    if (!confirm(`Supprimer la fiche de ${clientFullName(c)} ?\n\nSi elle apparaît sur une facture, elle sera archivée plutôt que supprimée (conservation comptable de 10 ans).`)) return;
    setBusyId(c.id);
    try {
      const outcome = await deleteOrArchiveClient(c.id);
      setFlash(outcome === 'archived'
        ? `${clientFullName(c)} a été archivée : ses factures la citent, elle doit rester consultable.`
        : `${clientFullName(c)} a été supprimée.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
      setTimeout(() => setFlash(null), 6000);
    }
  };

  const handleUnarchive = async (c: Client) => {
    setBusyId(c.id);
    try {
      await updateClient(c.id, { archived: false });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const exportCSV = () => {
    const rows = [
      [
        'Nom', 'Prénom', 'Téléphone', 'E-mail', 'Date de naissance', 'Allergies', 'Notes',
        'Accord e-mail', 'Accord WhatsApp', 'Visites', 'Dernière visite', 'Encaissé (CHF)', 'Créée le',
      ],
      ...filtered.map(c => {
        const st = stats.get(c.id);
        return [
          c.nom, c.prenom, c.telephone ?? '', c.email ?? '',
          c.date_naissance ? dateCH(`${c.date_naissance}T00:00:00`) : '',
          (c.allergies ?? '').replace(/[\r\n]+/g, ' '),
          (c.notes ?? '').replace(/[\r\n]+/g, ' '),
          c.consent_email ? 'oui' : 'non',
          c.consent_whatsapp ? 'oui' : 'non',
          String(st?.nb_visites ?? 0),
          st?.derniere_visite ? dateCH(st.derniere_visite) : '',
          Number(st?.total_encaisse ?? 0).toFixed(2),
          new Date(c.created_at).toLocaleDateString('fr-CH'),
        ];
      }),
    ];
    const csv = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <Users size={20} className="text-sage" /> Clientes
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {filtered.length} fiche{filtered.length !== 1 ? 's' : ''}
            {search && ` sur ${clients.length}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg text-sm transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all cursor-pointer shadow-sm"
          >
            <UserPlus size={14} /> Nouvelle cliente
          </button>
        </div>
      </div>

      {flash && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sage/30 bg-sage/5 px-4 py-3 text-sm text-stone-700">
          <Check size={15} className="shrink-0 mt-0.5 text-sage" /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
          <label htmlFor="clients-search" className="sr-only">Rechercher une cliente</label>
          <input
            id="clients-search"
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, prénom, téléphone ou e-mail…"
            className="w-full pl-11 pr-4 py-3 border border-stone-200 bg-white rounded-xl text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all shadow-sm"
          />
        </div>
        <button
          onClick={() => setShowArchived(v => !v)}
          aria-pressed={showArchived}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border transition-all cursor-pointer shadow-sm ${
            showArchived ? 'border-sage bg-sage/5 text-sage' : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800'
          }`}
        >
          <Archive size={14} /> Archivées
        </button>
      </div>

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-stone-400 text-sm italic">
            {search ? 'Aucun résultat.' : 'Aucune cliente enregistrée.'}
          </p>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/50">
                    {['Cliente', 'Contact', 'Dernière visite', 'Accords'].map(h => (
                      <th key={h} className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">{h}</th>
                    ))}
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className={`border-b border-stone-50 hover:bg-stone-50/50 transition-colors group ${c.archived ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 font-medium text-stone-900">
                        <button
                          onClick={() => setDetail(c)}
                          className="text-left hover:text-sage transition-colors cursor-pointer"
                        >
                          {clientFullName(c)}
                        </button>
                        {c.allergies?.trim() && (
                          <TriangleAlert
                            size={13}
                            className="inline ml-1.5 -mt-0.5 text-amber-500"
                            aria-label="Allergies signalées"
                          />
                        )}
                        {c.archived && <span className="ml-2 text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Archivée</span>}
                      </td>
                      <td className="px-6 py-4 text-stone-500 text-xs">
                        {c.telephone && <span className="block whitespace-nowrap">{c.telephone}</span>}
                        {c.email && <span className="block truncate max-w-[13rem]">{c.email}</span>}
                        {!c.telephone && !c.email && <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-stone-500 text-xs whitespace-nowrap tabular-nums">
                        {stats.get(c.id)?.derniere_visite
                          ? <>
                              {dateCH(stats.get(c.id)!.derniere_visite)}
                              <span className="block text-stone-300">
                                {stats.get(c.id)!.nb_visites} visite{Number(stats.get(c.id)!.nb_visites) > 1 ? 's' : ''}
                                {' · '}{formatCHF(stats.get(c.id)!.total_encaisse)}
                              </span>
                            </>
                          : <span className="text-stone-300">Jamais venue</span>}
                      </td>
                      <td className="px-6 py-4">
                        <ConsentBadges client={c} />
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <RowActions
                          client={c} busy={busyId === c.id}
                          onEdit={() => setEditing(c)}
                          onDelete={() => handleDelete(c)}
                          onUnarchive={() => handleUnarchive(c)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-stone-100">
              {filtered.map(c => (
                <div key={c.id} className={`p-4 space-y-2 ${c.archived ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setDetail(c)}
                      className="font-medium text-stone-900 text-sm text-left flex items-center gap-1.5 cursor-pointer"
                    >
                      {clientFullName(c)}
                      {c.allergies?.trim() && <TriangleAlert size={13} className="text-amber-500 shrink-0" aria-label="Allergies signalées" />}
                    </button>
                    <RowActions
                      client={c} busy={busyId === c.id}
                      onEdit={() => setEditing(c)}
                      onDelete={() => handleDelete(c)}
                      onUnarchive={() => handleUnarchive(c)}
                    />
                  </div>
                  <p className="text-xs text-stone-400">
                    {[c.telephone, c.email].filter(Boolean).join(' · ') || 'Aucun contact'}
                  </p>
                  <div className="flex items-center gap-2">
                    <ConsentBadges client={c} />
                    <span className="text-[11px] text-stone-300 tabular-nums">
                      {stats.get(c.id)?.derniere_visite ? dateCH(stats.get(c.id)!.derniere_visite) : 'Jamais venue'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editing && (
        <ClientDialog
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {detail && (
        <ClientDetail
          client={detail}
          stats={stats.get(detail.id)}
          onClose={() => { setDetail(null); load(); }}
          onChanged={c => {
            setDetail(c);
            setClients(prev => prev.map(x => (x.id === c.id ? c : x)));
          }}
        />
      )}
    </div>
  );
}

/** Accords publicitaires en un coup d'œil — c'est ce qui décide si une cliente
 *  entre ou non dans une audience de promotion. */
function ConsentBadges({ client }: { client: Client }) {
  if (!client.consent_email && !client.consent_whatsapp) {
    return <span className="text-[11px] text-stone-300">Aucun</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {client.consent_email && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium text-sage bg-sage/10 px-1.5 py-0.5 rounded"
          title="Accepte les offres par e-mail"
        >
          <Mail size={9} /> E-mail
        </span>
      )}
      {client.consent_whatsapp && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium text-sage bg-sage/10 px-1.5 py-0.5 rounded"
          title="Accepte les offres par WhatsApp"
        >
          <MessageCircle size={9} /> WhatsApp
        </span>
      )}
    </span>
  );
}

function RowActions({ client, busy, onEdit, onDelete, onUnarchive }: {
  client: Client; busy: boolean;
  onEdit: () => void; onDelete: () => void; onUnarchive: () => void;
}) {
  if (busy) return <Loader2 size={14} className="animate-spin text-stone-300 inline" />;
  return (
    <span className="inline-flex items-center gap-1">
      {client.archived ? (
        <button
          onClick={onUnarchive}
          className="text-[11px] text-sage hover:underline font-medium cursor-pointer px-1.5"
        >
          Réactiver
        </button>
      ) : (
        <>
          <button
            onClick={onEdit}
            aria-label={`Modifier ${clientFullName(client)}`} title="Modifier"
            className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-all cursor-pointer"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Supprimer ${clientFullName(client)}`} title="Supprimer"
            className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </span>
  );
}

function ClientDialog({ client, onClose, onSaved }: {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]     = useState<ClientInput>(client
    ? {
        nom: client.nom, prenom: client.prenom,
        telephone: client.telephone ?? '', email: client.email ?? '',
        notes: client.notes ?? '', allergies: client.allergies ?? '',
        date_naissance: client.date_naissance ?? null,
        consent_email: client.consent_email,
        consent_whatsapp: client.consent_whatsapp,
        consent_source: client.consent_source,
      }
    : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof ClientInput) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const waNumber = toWhatsAppNumber(form.telephone);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom?.trim()) return;
    setSaving(true); setError(null);
    const email = (form.email ?? '').trim() || null;
    const payload: ClientInput = {
      nom: form.nom.trim(),
      prenom: (form.prenom ?? '').trim(),
      telephone: (form.telephone ?? '').trim() || null,
      email,
      notes: (form.notes ?? '').trim() || null,
      allergies: (form.allergies ?? '').trim() || null,
      date_naissance: form.date_naissance || null,
      // Un accord sans moyen de l'honorer n'a pas de sens : retirer l'adresse
      // ou le numéro retire le consentement correspondant.
      consent_email: Boolean(form.consent_email && email),
      consent_whatsapp: Boolean(form.consent_whatsapp && waNumber),
      consent_source: (form.consent_email || form.consent_whatsapp)
        ? (form.consent_source ?? 'Fiche cliente')
        : null,
    };
    try {
      if (client) await updateClient(client.id, payload);
      else await createClient(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={client ? 'Modifier la fiche cliente' : 'Nouvelle fiche cliente'}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{client ? 'Modifier la fiche' : 'Nouvelle cliente'}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={form.prenom ?? ''} onChange={set('prenom')} />
            <Input label="Nom *" value={form.nom} onChange={set('nom')} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" value={form.telephone ?? ''} onChange={set('telephone')} type="tel" />
            <Input label="E-mail" value={form.email ?? ''} onChange={set('email')} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="client-naissance" className="text-[11px] font-medium text-stone-500 mb-1 flex items-center gap-1.5">
                <Cake size={11} className="text-stone-300" /> Date de naissance
              </label>
              <input
                id="client-naissance" type="date" value={form.date_naissance ?? ''}
                onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value || null }))}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
              />
              <p className="text-[10px] text-stone-400 mt-1">Sert au segment « anniversaires du mois ».</p>
            </div>
          </div>

          {/* Champ à part, jamais noyé dans les notes : c'est la seule
              information de la fiche qui peut faire mal si on l'oublie. */}
          <div>
            <label htmlFor="client-allergies" className="text-[11px] font-medium text-amber-700 mb-1 flex items-center gap-1.5">
              <TriangleAlert size={11} /> Allergies &amp; contre-indications
            </label>
            <textarea
              id="client-allergies" rows={2} value={form.allergies ?? ''}
              onChange={e => set('allergies')(e.target.value)}
              placeholder="Huiles essentielles, latex, peau réactive…"
              className="w-full px-3 py-2 border border-amber-200 bg-amber-50/40 rounded-lg text-sm text-stone-700 placeholder:text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 outline-none transition-all resize-y"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Signalé en évidence sur la fiche et dans la liste.
            </p>
          </div>

          <div>
            <label htmlFor="client-notes" className="block text-[11px] font-medium text-stone-500 mb-1">
              Notes générales <span className="text-stone-300">(préférences, habitudes…)</span>
            </label>
            <textarea
              id="client-notes" rows={3} value={form.notes ?? ''}
              onChange={e => set('notes')(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all resize-y"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Ce qui se passe pendant un soin se note dans le journal de suivi, sur la fiche.
            </p>
          </div>

          {/* ── Accords publicitaires ─────────────────────────────────── */}
          <fieldset className="rounded-xl border border-stone-200 p-3.5 space-y-2.5">
            <legend className="text-[11px] font-medium text-stone-500 px-1">Accords publicitaires</legend>
            <p className="text-[10px] text-stone-400 leading-relaxed">
              À cocher seulement si elle l&apos;a dit. Encaisser quelqu&apos;un ne vaut pas accord
              (LCD art. 3 al. 1 let. o) : sans ces cases, elle ne recevra aucune promotion.
            </p>
            <Consent
              id="consent-email" icon={Mail} label="Offres par e-mail"
              detail={(form.email ?? '').trim() || 'Renseigne une adresse pour l’activer'}
              checked={Boolean(form.consent_email)}
              disabled={!(form.email ?? '').trim()}
              onToggle={() => setForm(f => ({ ...f, consent_email: !f.consent_email }))}
            />
            <Consent
              id="consent-wa" icon={MessageCircle} label="Offres par WhatsApp"
              detail={waNumber
                ? `+${waNumber}`
                : (form.telephone ?? '').trim() ? 'Numéro non exploitable' : 'Renseigne un numéro pour l’activer'}
              checked={Boolean(form.consent_whatsapp)}
              disabled={!waNumber}
              onToggle={() => setForm(f => ({ ...f, consent_whatsapp: !f.consent_whatsapp }))}
            />
          </fieldset>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm hover:border-stone-300 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={saving || !form.nom?.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-sage transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoFocus?: boolean;
}) {
  const id = `ci-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-stone-500 mb-1">{label}</label>
      <input
        id={id} type={type} value={value} required={required} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
      />
    </div>
  );
}

function Consent({ id, icon: Icon, label, detail, checked, disabled, onToggle }: {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; detail: string; checked: boolean; disabled: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon size={13} className="text-stone-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm text-stone-700 cursor-pointer">{label}</label>
          <p className="text-[11px] text-stone-400 truncate">{detail}</p>
        </div>
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} aria-label={label}
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
