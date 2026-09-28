"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Loader2, Mail, MessageCircle,
  Users, Check, Pencil,
} from 'lucide-react';
import {
  createPromotion, deletePromotion, listPromotionSends, listPromotions,
} from '../../../services/promotions';
import { CANAL_LABELS, segmentLabel } from '../../../types/promotions';
import type { Promotion, PromotionSend } from '../../../types/promotions';
import PromotionEditor from './PromotionEditor';
import { Button, Callout, PageHeader } from '../../../components/admin/ui';

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
      setError(`Les promotions n'ont pas pu être chargées${err instanceof Error ? ` (${err.message})` : ''}. Vérifiez la connexion puis rechargez la page.`);
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
      setError(`La promotion n'a pas été créée${err instanceof Error ? ` (${err.message})` : ''}. Réessayez.`);
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
      setError(`La promotion n'a pas été supprimée${err instanceof Error ? ` (${err.message})` : ''}. Réessayez.`);
    } finally {
      setBusyId(null);
    }
  };

  const total = useMemo(
    () => [...counts.values()].reduce((acc, c) => acc + c.email + c.whatsapp, 0),
    [counts],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions"
        description={`Offres envoyées par e-mail ou WhatsApp aux clientes et aux abonnés du site.${total > 0 ? ` ${total} envoi${total > 1 ? 's' : ''} au total.` : ''}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={creer} loading={busyId === 'new'}>
            Créer une promotion
          </Button>
        }
      />

      {/* Le consentement n'est pas un détail de conformité : c'est ce qui
          décide qui reçoit. Autant le dire là où on crée les envois. */}
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-[13px] text-stone-600 leading-relaxed">
        Une promotion ne part qu&apos;aux personnes qui ont donné leur accord : les cases
        <strong className="text-stone-700"> Accords publicitaires </strong> de chaque
        <Link href="/admin/caisse/clients" className="text-accent hover:underline mx-1">fiche cliente</Link>
        et les abonnés de la <Link href="/admin/subscribers" className="text-accent hover:underline">newsletter du site</Link>.
        Encaisser quelqu&apos;un ne vaut pas accord — la LCD (art. 3 al. 1 let. o) l&apos;exige au préalable.
      </div>

      {error && (
        <Callout
          tone="danger"
          actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}
        >
          {error}
        </Callout>
      )}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-600 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-stone-700">Aucune promotion pour l&apos;instant.</p>
            <p className="text-stone-600 text-[13px] max-w-md mx-auto">
              Une remise de saison, un mot aux clientes qu&apos;on n&apos;a pas vues depuis six mois,
              une attention pour les anniversaires du mois.
            </p>
            <Button size="sm" icon={Plus} onClick={creer} loading={busyId === 'new'}>
              Créer une promotion
            </Button>
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
                    <p className="text-sm font-medium text-stone-900 truncate hover:underline underline-offset-2">
                      {p.nom}
                    </p>
                    <p className="truncate text-[12.5px] text-stone-600">
                      {CANAL_LABELS[p.canal]} · {segmentLabel(p.segment)} · {dateCH(p.created_at)}
                    </p>
                  </button>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {(n?.email ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[13px] text-stone-600 tabular-nums" title="E-mails envoyés">
                        <Mail size={13} className="text-stone-600" /> {n!.email}
                      </span>
                    )}
                    {(n?.whatsapp ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[13px] text-stone-600 tabular-nums" title="Conversations WhatsApp ouvertes">
                        <MessageCircle size={13} className="text-stone-600" /> {n!.whatsapp}
                      </span>
                    )}
                    {!n?.email && !n?.whatsapp && (
                      <span className="inline-flex items-center gap-1 text-[13px] text-stone-600">
                        <Users size={13} /> aucun envoi
                      </span>
                    )}
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded ${
                      p.status === 'envoyee' ? 'text-emerald-700 bg-emerald-50'
                      : p.status === 'en_cours' ? 'text-amber-700 bg-amber-50'
                      : 'text-stone-700 bg-stone-100'
                    }`}
                  >
                    {p.status === 'envoyee' && <Check size={11} />}
                    {STATUS_LABELS[p.status]}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {busyId === p.id ? (
                      <Loader2 size={14} className="animate-spin text-stone-500 mx-2" />
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(p)}
                          aria-label={`Ouvrir ${p.nom}`} title="Ouvrir"
                          className="p-1.5 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => supprimer(p)}
                          aria-label={`Supprimer ${p.nom}`} title="Supprimer"
                          className="p-1.5 text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-all cursor-pointer"
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
