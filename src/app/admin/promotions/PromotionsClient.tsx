"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone, Plus, Trash2, AlertCircle, X, Loader2, Mail, MessageCircle,
  Users, Check, Pencil,
} from 'lucide-react';
import {
  createPromotion, deletePromotion, listPromotionSends, listPromotions,
} from '../../../services/promotions';
import { CANAL_LABELS, segmentLabel } from '../../../types/promotions';
import type { Promotion, PromotionSend } from '../../../types/promotions';
import PromotionEditor from './PromotionEditor';

const dateCH = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CH') : '—';

const STATUS_LABELS: Record<Promotion['status'], string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  envoyee: 'Envoyée',
};

export default function PromotionsClient() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [counts, setCounts] = useState<Map<string, { email: number; whatsapp: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const list = await listPromotions();
      setPromotions(list);

      // Comptages d'envoi, en parallèle. Une promotion dont le journal ne
      // répond pas s'affiche à zéro plutôt que de faire tomber la page.
      const entries = await Promise.all(list.map(async p => {
        const sends = await listPromotionSends(p.id).catch(() => [] as PromotionSend[]);
        return [p.id, {
          email: sends.filter(s => s.canal === 'email' && s.status === 'envoye').length,
          whatsapp: sends.filter(s => s.canal === 'whatsapp' && s.status === 'envoye').length,
        }] as const;
      }));
      setCounts(new Map(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const creer = async () => {
    setBusyId('new');
    try {
      const p = await createPromotion({
        nom: 'Nouvelle promotion',
        canal: 'email',
        segment: 'toutes',
        segment_params: {},
        objet: null,
        message_email: null,
        message_whatsapp: null,
      });
      setPromotions(prev => [p, ...prev]);
      setEditing(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const supprimer = async (p: Promotion) => {
    const n = counts.get(p.id);
    const envoyes = (n?.email ?? 0) + (n?.whatsapp ?? 0);
    const suite = envoyes > 0
      ? `\n\nSon journal d'envoi (${envoyes} destinataire${envoyes > 1 ? 's' : ''}) part avec elle : recréer la même promotion la renverrait à tout le monde.`
      : '';
    if (!confirm(`Supprimer « ${p.nom} » ?${suite}`)) return;
    setBusyId(p.id);
    try {
      await deletePromotion(p.id);
      setPromotions(prev => prev.filter(x => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const total = useMemo(
    () => [...counts.values()].reduce((acc, c) => acc + c.email + c.whatsapp, 0),
    [counts],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Audience</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <Megaphone size={20} className="text-sage" /> Promotions
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Offres envoyées par e-mail ou WhatsApp aux clientes et aux abonnés du site.
            {total > 0 && ` ${total} envoi${total > 1 ? 's' : ''} au total.`}
          </p>
        </div>
        <button
          onClick={creer} disabled={busyId === 'new'}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all cursor-pointer shadow-sm self-start disabled:opacity-40"
        >
          {busyId === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Nouvelle promotion
        </button>
      </div>

      {/* Le consentement n'est pas un détail de conformité : c'est ce qui
          décide qui reçoit. Autant le dire là où on crée les envois. */}
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500 leading-relaxed">
        Une promotion ne part qu&apos;aux personnes qui ont donné leur accord : les cases
        <strong className="text-stone-700"> Accords publicitaires </strong> de chaque
        <Link href="/admin/caisse/clients" className="text-sage hover:underline mx-1">fiche cliente</Link>
        et les abonnés de la <Link href="/admin/subscribers" className="text-sage hover:underline">newsletter du site</Link>.
        Encaisser quelqu&apos;un ne vaut pas accord — la LCD (art. 3 al. 1 let. o) l&apos;exige au préalable.
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            <p className="text-xs mt-1">
              Si l&apos;erreur mentionne une table manquante, applique la migration
              <code className="mx-1 px-1 bg-red-100 rounded">supabase/migrations/20260803_crm_clients_promotions.sql</code>
              sur ton projet Supabase.
            </p>
          </div>
          <button onClick={() => setError(null)} aria-label="Masquer" className="shrink-0 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-stone-400 text-sm italic">Aucune promotion.</p>
            <p className="text-stone-400 text-xs">
              Une remise de saison, un mot aux clientes qu&apos;on n&apos;a pas vues depuis six mois,
              une attention pour les anniversaires du mois.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-50">
            {promotions.map(p => {
              const n = counts.get(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50/50 transition-colors">
                  <button
                    onClick={() => setEditing(p)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <p className="text-sm font-medium text-stone-900 truncate hover:text-sage transition-colors">
                      {p.nom}
                    </p>
                    <p className="text-xs text-stone-400 truncate">
                      {CANAL_LABELS[p.canal]} · {segmentLabel(p.segment)} · {dateCH(p.created_at)}
                    </p>
                  </button>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {(n?.email ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 tabular-nums" title="E-mails envoyés">
                        <Mail size={11} className="text-stone-300" /> {n!.email}
                      </span>
                    )}
                    {(n?.whatsapp ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 tabular-nums" title="Conversations WhatsApp ouvertes">
                        <MessageCircle size={11} className="text-stone-300" /> {n!.whatsapp}
                      </span>
                    )}
                    {!n?.email && !n?.whatsapp && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-stone-300">
                        <Users size={11} /> aucun envoi
                      </span>
                    )}
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ${
                      p.status === 'envoyee' ? 'text-sage bg-sage/10'
                      : p.status === 'en_cours' ? 'text-amber-700 bg-amber-50'
                      : 'text-stone-400 bg-stone-100'
                    }`}
                  >
                    {p.status === 'envoyee' && <Check size={9} />}
                    {STATUS_LABELS[p.status]}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {busyId === p.id ? (
                      <Loader2 size={14} className="animate-spin text-stone-300 mx-2" />
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(p)}
                          aria-label={`Ouvrir ${p.nom}`} title="Ouvrir"
                          className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-all cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => supprimer(p)}
                          aria-label={`Supprimer ${p.nom}`} title="Supprimer"
                          className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <PromotionEditor
          promotion={editing}
          onClose={() => { setEditing(null); load(); }}
          onChanged={p => {
            setEditing(p);
            setPromotions(prev => prev.map(x => (x.id === p.id ? p : x)));
          }}
        />
      )}
    </div>
  );
}
