"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { Mail, Trash2, Download, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Send, Check, XCircle, Search } from 'lucide-react';
import { Badge, Button, Callout, EmptyState, Input, PageHeader, Spinner } from '../../../components/admin/ui';

interface Subscriber { id: string; email: string; created_at: string; active: boolean; welcome_sent?: boolean; welcome_sent_at?: string; }
type SortCol = 'email' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDown size={13} className="text-stone-600" />;
  return sortDir === 'asc' ? <ArrowUp size={13} className="text-accent" /> : <ArrowDown size={13} className="text-accent" />;
}

export default function Subscribers() {
  const [subscribers, setSubscribers]       = useState<Subscriber[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [deleting, setDeleting]             = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null);
  const [welcomeResult, setWelcomeResult]   = useState<Record<string, 'ok' | 'err'>>({});
  const [actionError, setActionError]       = useState<string | null>(null);
  const [sortBy, setSortBy]                 = useState<SortCol>('date');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setLoadError(null);
    let { data, error } = await supabase.from('subscribers').select('id, email, created_at, active, welcome_sent, welcome_sent_at').order('created_at', { ascending: false }).limit(1000);
    if (error?.message?.includes('welcome_sent')) {
      const fb = await supabase.from('subscribers').select('id, email, created_at, active').order('created_at', { ascending: false }).limit(1000);
      data = (fb.data as typeof data) ?? null; error = fb.error;
    }
    if (error) { console.error(error); setLoadError(error.message); }
    else setSubscribers(data || []);
    setLoading(false);
  };

  const toggleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  };

  const handleDelete = async (sub: Subscriber) => {
    if (!confirm(`Supprimer définitivement ${sub.email} de la liste des abonnés ?\n\nCette personne ne recevra plus aucun e-mail. Cette action est irréversible.`)) return;
    setDeleting(sub.id); setActionError(null);
    const { error } = await supabase.from('subscribers').delete().eq('id', sub.id);
    if (error) {
      console.error(error);
      setActionError(`${sub.email} n'a pas pu être supprimé (${error.message}). Réessayez ou actualisez la page.`);
    } else {
      setSubscribers(prev => prev.filter(s => s.id !== sub.id));
    }
    setDeleting(null);
  };

  const WELCOME_ERRORS: Record<string, string> = {
    not_found: "cette adresse n'est plus dans la liste",
    invalid_email: "l'adresse e-mail n'est pas valide",
    smtp_error: "le service d'envoi d'e-mails a refusé l'envoi ; vérifiez la configuration dans Réglages, onglet « Clés des services »",
  };

  const sendWelcome = async (sub: Subscriber) => {
    if (sendingWelcome) return;
    if (!confirm(`Envoyer l'e-mail de bienvenue à ${sub.email} ?`)) return;
    setSendingWelcome(sub.id); setActionError(null);
    try {
      const { data: sd } = await supabase.auth.getSession();
      if (!sd.session?.access_token) throw new Error('votre session a expiré, reconnectez-vous');
      const res = await fetch('/api/welcome-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session.access_token}` }, body: JSON.stringify({ email: sub.email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sent) throw new Error(WELCOME_ERRORS[data.error] || data.error || `le serveur a répondu ${res.status}`);
      setWelcomeResult(prev => ({ ...prev, [sub.id]: 'ok' }));
      setSubscribers(prev => prev.map(s => s.id === sub.id ? { ...s, welcome_sent: true, welcome_sent_at: new Date().toISOString() } : s));
    } catch (e: any) {
      setWelcomeResult(prev => ({ ...prev, [sub.id]: 'err' }));
      setActionError(`L'e-mail de bienvenue n'a pas été envoyé à ${sub.email} : ${e?.message || 'erreur inconnue'}.`);
    }
    finally { setSendingWelcome(null); setTimeout(() => setWelcomeResult(prev => { const n = { ...prev }; delete n[sub.id]; return n; }), 4000); }
  };

  const exportCSV = () => {
    const rows = [['Email','Date inscription','Statut','Bienvenue envoyé','Date envoi bienvenue'], ...sorted.map(s => [s.email, new Date(s.created_at).toLocaleDateString('fr-FR'), s.active ? 'Abonné' : 'Désinscrit', s.welcome_sent ? 'Oui' : 'Non', s.welcome_sent_at ? new Date(s.welcome_sent_at).toLocaleDateString('fr-FR') : ''])];
    // Point-virgule et guillemets : Excel en français ouvre alors chaque valeur dans sa colonne.
    const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const blob = new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `abonnes-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtered = subscribers.filter(s => s.email.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'email') cmp = a.email.localeCompare(b.email);
    if (sortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'status') cmp = Number(b.active) - Number(a.active);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const activeCount = subscribers.filter(s => s.active).length;
  const inactiveCount = subscribers.filter(s => !s.active).length;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnés"
        description={
          loading && subscribers.length === 0
            ? 'Les personnes inscrites à votre lettre d\u2019information.'
            : <>
                {activeCount} abonné{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}
                {inactiveCount > 0 && <> · {inactiveCount} désinscrit{inactiveCount !== 1 ? 's' : ''}</>}
              </>
        }
        actions={
          <>
            <Button variant="ghost" icon={RefreshCw} loading={loading} onClick={load}>Actualiser</Button>
            <Button variant="secondary" icon={Download} onClick={exportCSV} disabled={sorted.length === 0}
              title="Télécharge la liste affichée (filtrée et triée) au format tableur">
              Exporter la liste
            </Button>
          </>
        }
      />

      {actionError && (
        <Callout tone="danger" actions={<Button variant="ghost" size="sm" onClick={() => setActionError(null)}>Fermer</Button>}>
          {actionError}
        </Callout>
      )}

      <div className="relative">
        <label htmlFor="subscribers-search" className="sr-only">Rechercher une adresse e-mail</label>
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
        <Input id="subscribers-search" type="search" placeholder="Rechercher une adresse e-mail…" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loadError ? (
        <Callout tone="danger" title="La liste n'a pas pu être chargée"
          actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Réessayer</Button>}>
          Vérifiez votre connexion puis réessayez. Détail technique : {loadError}
        </Callout>
      ) : loading && subscribers.length === 0 ? (
        <Spinner label="Chargement des abonnés…" />
      ) : sorted.length === 0 ? (
        search
          ? <EmptyState icon={Search} title="Aucune adresse ne correspond" description={`Aucun abonné ne contient « ${search} ».`}
              action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Effacer la recherche</Button>} />
          : <EmptyState icon={Mail} title="Aucun abonné pour le moment"
              description="Les personnes qui s'inscrivent à votre lettre d'information depuis le site apparaîtront ici." />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {([['email', 'Adresse e-mail'], ['date', 'Inscription'], ['status', 'Statut']] as [SortCol, string][]).map(([col, lbl]) => (
                    <th key={col} scope="col" aria-sort={sortBy === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="px-6 py-3 text-left text-[13px] font-semibold text-stone-700">
                      <button type="button" onClick={() => toggleSort(col)}
                        className="inline-flex items-center gap-1.5 rounded hover:text-stone-950 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                        {lbl} <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-6 py-3 text-left text-[13px] font-semibold text-stone-700">E-mail de bienvenue</th>
                  <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {sorted.map(sub => (
                  <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                    <td className={`px-6 py-3.5 font-medium ${sub.active ? 'text-stone-900' : 'text-stone-600'}`}>{sub.email}</td>
                    <td className="px-6 py-3.5 text-stone-600 whitespace-nowrap">{fmtDate(sub.created_at)}</td>
                    <td className="px-6 py-3.5"><SubStatusBadge active={sub.active} /></td>
                    <td className="px-6 py-3.5">
                      <WelcomeStatus sub={sub} result={welcomeResult[sub.id]} sending={sendingWelcome === sub.id} onSend={() => sendWelcome(sub)} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button onClick={() => handleDelete(sub)} disabled={deleting === sub.id}
                        aria-label={`Supprimer l'abonné ${sub.email}`} title="Supprimer cet abonné"
                        className="p-1.5 text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes — mobile */}
          <div className="sm:hidden divide-y divide-stone-200">
            {sorted.map(sub => {
              const showSend = !sub.welcome_sent && sub.active && welcomeResult[sub.id] === undefined;
              return (
                <div key={sub.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`font-medium text-[14px] break-all ${sub.active ? 'text-stone-900' : 'text-stone-600'}`}>{sub.email}</p>
                    <span className="shrink-0"><SubStatusBadge active={sub.active} /></span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[13px] text-stone-600">
                    <span>Inscrit le {fmtDate(sub.created_at)}</span>
                    {!showSend && <WelcomeStatus sub={sub} result={welcomeResult[sub.id]} sending={sendingWelcome === sub.id} onSend={() => sendWelcome(sub)} />}
                  </div>
                  <div className={`grid gap-2 pt-1 ${showSend ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {showSend && (
                      <Button variant="secondary" size="sm" icon={Send} loading={sendingWelcome === sub.id}
                        onClick={() => sendWelcome(sub)} aria-label={`Envoyer l'e-mail de bienvenue à ${sub.email}`}>
                        Envoyer la bienvenue
                      </Button>
                    )}
                    <Button variant="danger" size="sm" icon={Trash2} disabled={deleting === sub.id}
                      onClick={() => handleDelete(sub)} aria-label={`Supprimer l'abonné ${sub.email}`}>
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subscribers.length >= 1000 && (
        <p className="text-[13px] text-stone-600">Seuls les 1 000 abonnés les plus récents sont affichés.</p>
      )}
    </div>
  );
}

function SubStatusBadge({ active }: { active: boolean }) {
  return active
    ? <Badge tone="success">Abonné</Badge>
    : <Badge tone="neutral">Désinscrit</Badge>;
}

function WelcomeStatus({ sub, result, sending, onSend }: {
  sub: Subscriber; result: 'ok' | 'err' | undefined; sending: boolean; onSend: () => void;
}) {
  if (result === 'ok') return <span className="inline-flex items-center gap-1 text-[13px] text-emerald-700 font-semibold whitespace-nowrap"><Check size={14} /> Envoyé</span>;
  if (result === 'err') return <span className="inline-flex items-center gap-1 text-[13px] text-red-700 font-semibold whitespace-nowrap"><XCircle size={14} /> Échec</span>;
  if (sub.welcome_sent) return <span className="text-[13px] text-stone-600 whitespace-nowrap">{sub.welcome_sent_at ? `Envoyé le ${new Date(sub.welcome_sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'Déjà envoyé'}</span>;
  if (!sub.active) return <span className="text-[13px] text-stone-600">—</span>;
  return (
    <Button variant="ghost" size="sm" icon={Send} loading={sending} onClick={onSend}
      aria-label={`Envoyer l'e-mail de bienvenue à ${sub.email}`}>
      Envoyer
    </Button>
  );
}
