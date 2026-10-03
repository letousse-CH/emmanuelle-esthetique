"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Check, Loader2, AlertCircle, Mail, MessageCircle, Send, Users, ExternalLink,
  RotateCcw, Save, TriangleAlert,
} from 'lucide-react';
import { listClientStats, listClients } from '../../../services/caisse';
import {
  clearFailedSends, listPromotionSends, listSubscribers, recordPromotionSend,
  sendPromotionBatch, sendPromotionEmailsAll, unrecordPromotionSend, updatePromotion,
} from '../../../services/promotions';
import {
  CANAL_LABELS, SEGMENTS, VARIABLES_DISPONIBLES, buildAudience, renderMessage,
  whatsappLink,
} from '../../../types/promotions';
import type {
  AudienceEntry, Promotion, PromotionCanal, PromotionSend, SegmentKey, Subscriber,
} from '../../../types/promotions';
import type { Client, ClientStats } from '../../../types/caisse';
import { useConfirm } from '../../../components/admin/mobile-pages/useConfirm';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function PromotionEditor({ promotion, onClose, onChanged }: {
  promotion: Promotion;
  onClose: () => void;
  onChanged: (p: Promotion) => void;
}) {
  const [nom, setNom] = useState(promotion.nom);
  const [canal, setCanal] = useState<PromotionCanal>(promotion.canal);
  const [segment, setSegment] = useState<SegmentKey>(promotion.segment);
  const [params, setParams] = useState(promotion.segment_params ?? {});
  const [objet, setObjet] = useState(promotion.objet ?? '');
  const [messageEmail, setMessageEmail] = useState(promotion.message_email ?? '');
  const [messageWa, setMessageWa] = useState(promotion.message_whatsapp ?? '');

  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Map<string, ClientStats>>(new Map());
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [sends, setSends] = useState<PromotionSend[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [testEmail, setTestEmail] = useState('');

  const [confirmer, confirmNode] = useConfirm();
  const confirming = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, st, s, sn] = await Promise.all([
        listClients(false),
        listClientStats().catch(() => new Map<string, ClientStats>()),
        listSubscribers().catch(() => [] as Subscriber[]),
        listPromotionSends(promotion.id),
      ]);
      setClients(c); setStats(st); setSubscribers(s); setSends(sn);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [promotion.id]);

  useEffect(() => { load(); }, [load]);

  const audience = useMemo(
    () => buildAudience({ clients, stats, subscribers, segment, params }),
    [clients, stats, subscribers, segment, params],
  );

  const parEmail = useMemo(() => audience.filter(a => a.joignableEmail && a.email), [audience]);
  const parWa = useMemo(() => audience.filter(a => a.joignableWhatsapp && a.waNumber), [audience]);

  /** Destinataires déjà servis, par canal — la contrainte d'unicité en base
   *  fait foi, on ne fait que la refléter à l'écran. */
  const servis = useMemo(() => {
    const map = { email: new Set<string>(), whatsapp: new Set<string>() };
    for (const s of sends) map[s.canal].add(s.destinataire.toLowerCase());
    return map;
  }, [sends]);

  // Les échecs comptent comme « servis » — sans quoi la boucle d'envoi
  // s'acharnerait sur une adresse invalide. Ils se reprennent à la main.
  const echecsEmail = useMemo(
    () => sends.filter(s => s.canal === 'email' && s.status === 'echec').length,
    [sends],
  );

  const segmentDef = SEGMENTS.find(s => s.key === segment)!;
  const utiliseEmail = canal === 'email' || canal === 'les_deux';
  const utiliseWa = canal === 'whatsapp' || canal === 'les_deux';

  const mark = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const save = async (): Promise<Promotion | null> => {
    setSaving(true); setError(null);
    try {
      const saved = await updatePromotion(promotion.id, {
        nom: nom.trim() || 'Promotion sans nom',
        canal, segment, segment_params: params,
        objet: objet.trim() || null,
        message_email: messageEmail.trim() || null,
        message_whatsapp: messageWa.trim() || null,
      });
      onChanged(saved);
      setDirty(false);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.includes('@')) { setError('Adresse d’essai invalide : vérifiez qu’elle contient un @.'); return; }
    setSending(true); setError(null); setNotice(null);
    try {
      // Enregistrer d'abord : la route relit la promotion en base, elle ne
      // verrait pas un texte encore dans le navigateur.
      if (dirty && !(await save())) return;
      await sendPromotionBatch(promotion.id, testEmail.trim());
      setNotice(`Essai envoyé à ${testEmail.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'essai a échoué.");
    } finally {
      setSending(false);
    }
  };

  const sendAll = async () => {
    const restants = parEmail.filter(e => !servis.email.has(e.email!.toLowerCase()));
    if (restants.length === 0) { setNotice('Tout le monde a déjà reçu cet e-mail.'); return; }
    confirming.current = true;
    const ok = await confirmer({
      title: `Envoyer à ${restants.length} adresse${restants.length > 1 ? 's' : ''} ?`,
      message: `« ${nom} » partira par e-mail. Ceux qui l'ont déjà reçu sont ignorés.`,
      confirmLabel: 'Envoyer',
    });
    confirming.current = false;
    if (!ok) return;

    setSending(true); setError(null); setNotice(null);
    setProgress({ done: 0, total: restants.length });
    try {
      if (dirty && !(await save())) return;
      const res = await sendPromotionEmailsAll(promotion.id, (done, total) => setProgress({ done, total }));
      setSends(await listPromotionSends(promotion.id));
      setNotice(res.failed > 0
        ? `${res.sent} envoyé${res.sent > 1 ? 's' : ''}, ${res.failed} en échec.`
        : `${res.sent} e-mail${res.sent > 1 ? 's' : ''} envoyé${res.sent > 1 ? 's' : ''}.`);
      if (res.errors.length > 0) {
        setError(res.errors.slice(0, 3).map(e => `${e.destinataire} : ${e.error}`).join(' · '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'envoi a échoué.");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const retryEchecs = async () => {
    setSending(true); setError(null); setNotice(null);
    try {
      await clearFailedSends(promotion.id, 'email');
      setSends(await listPromotionSends(promotion.id));
      setNotice('Les adresses en échec sont remises dans la liste d’envoi. Cliquez de nouveau sur « Envoyer ».');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprise impossible.');
    } finally {
      setSending(false);
    }
  };

  /**
   * WhatsApp : on ouvre la conversation avec le message déjà rédigé, c'est
   * elle qui appuie sur envoyer. On ne peut donc consigner que l'ouverture —
   * d'où le bouton « annuler » sur chaque ligne, pour rattraper une
   * conversation ouverte mais pas envoyée.
   */
  const openWhatsApp = async (entry: AudienceEntry) => {
    const texte = renderMessage(messageWa, entry);
    // L'ouverture doit rester synchrone (sinon le navigateur bloque la
    // fenêtre) ; le texte est enregistré juste après s'il a changé.
    window.open(whatsappLink(entry.waNumber!, texte), '_blank', 'noopener');
    if (dirty && !saving) void save();
    try {
      await recordPromotionSend({
        promotionId: promotion.id,
        clientId: entry.clientId,
        subscriberId: entry.subscriberId,
        canal: 'whatsapp',
        destinataire: entry.waNumber!,
      });
      setSends(await listPromotionSends(promotion.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Marquage impossible.');
    }
  };

  const undoWhatsApp = async (entry: AudienceEntry) => {
    try {
      await unrecordPromotionSend(promotion.id, 'whatsapp', entry.waNumber!);
      setSends(await listPromotionSends(promotion.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annulation impossible.');
    }
  };

  const waFaits = parWa.filter(e => servis.whatsapp.has(e.waNumber!.toLowerCase())).length;
  const emailsRestants = parEmail.filter(e => !servis.email.has(e.email!.toLowerCase())).length;

  // Fermer ne doit ni perdre un texte en cours de rédaction, ni laisser croire
  // qu'un envoi groupé est interrompu (il continue tant que la page est ouverte).
  const requestClose = async () => {
    if (confirming.current) return;
    if (sending) {
      setNotice('Un envoi est en cours : attendez qu’il se termine avant de fermer.');
      return;
    }
    if (dirty) {
      confirming.current = true;
      const ok = await confirmer({
        title: 'Fermer sans enregistrer ?',
        message: 'Des modifications ne sont pas enregistrées : elles seraient perdues.',
        confirmLabel: 'Fermer et perdre',
        cancelLabel: 'Continuer à modifier',
        danger: true,
      });
      confirming.current = false;
      if (!ok) return;
    }
    onClose();
  };

  // Échap ferme le panneau, avec les mêmes garde-fous que la croix.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={requestClose}>
      <aside
        role="dialog" aria-modal="true" aria-label={`Promotion ${promotion.nom}`}
        onClick={e => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl h-full overflow-y-auto shadow-2xl max-lg:overscroll-contain"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-4 max-lg:px-3 max-lg:pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="promo-nom" className="sr-only">Nom de la promotion</label>
            <input
              id="promo-nom" type="text" value={nom} onChange={e => mark(setNom)(e.target.value)}
              placeholder="Nom de la promotion"
              className="w-full text-lg font-semibold text-stone-900 bg-transparent border-0 outline-none placeholder:text-stone-500"
            />
            <p className="text-[12.5px] text-stone-600">
              {CANAL_LABELS[canal]} · {segmentDef.label}
              {dirty && <span className="text-amber-700"> · modifications non enregistrées</span>}
            </p>
          </div>
          <button
            onClick={save} disabled={saving || !dirty}
            className={`shrink-0 flex items-center gap-1.5 h-8 max-lg:h-11 px-3 rounded-lg text-[13px] max-lg:text-[14px] font-semibold transition-colors disabled:opacity-45 cursor-pointer ${
              dirty ? 'bg-accent text-accent-fg hover:bg-accent-hover' : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {dirty ? 'Enregistrer' : 'Enregistré'}
          </button>
          <button onClick={requestClose} aria-label="Fermer" className="shrink-0 p-1.5 max-lg:grid max-lg:size-11 max-lg:place-items-center max-lg:p-0 text-stone-600 hover:text-stone-900 cursor-pointer">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Masquer" className="shrink-0 cursor-pointer max-lg:-m-2.5 max-lg:grid max-lg:size-11 max-lg:place-items-center"><X size={14} /></button>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-stone-700">
              <Check size={15} className="shrink-0 mt-0.5 text-accent" />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice(null)} aria-label="Masquer" className="shrink-0 cursor-pointer max-lg:-m-2.5 max-lg:grid max-lg:size-11 max-lg:place-items-center"><X size={14} /></button>
            </div>
          )}

          {/* ── Canal ───────────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <p className="text-[12.5px] font-medium text-stone-700">Canal</p>
            <div className="grid grid-cols-3 gap-2">
              {(['email', 'whatsapp', 'les_deux'] as PromotionCanal[]).map(c => (
                <button
                  key={c} onClick={() => mark(setCanal)(c)} aria-pressed={canal === c}
                  className={`px-2 py-2 max-lg:min-h-12 rounded-lg text-[13px] max-lg:text-[14px] font-medium border transition-colors cursor-pointer ${
                    canal === c ? 'border-accent bg-accent-soft text-accent font-semibold' : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  {CANAL_LABELS[c]}
                </button>
              ))}
            </div>
          </section>

          {/* ── Segment ─────────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <p className="text-[12.5px] font-medium text-stone-700">Destinataires</p>
            <div>
              <label htmlFor="promo-segment" className="sr-only">Segment</label>
              <select
                id="promo-segment" value={segment}
                onChange={e => {
                  const key = e.target.value as SegmentKey;
                  const def = SEGMENTS.find(s => s.key === key);
                  mark(setSegment)(key);
                  setParams(def?.param ? { [def.param.name]: def.param.default } : {});
                }}
                className="w-full px-3 py-2 max-lg:min-h-11 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 outline-none cursor-pointer"
              >
                {SEGMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <p className="text-[12.5px] text-stone-600 mt-1.5">{segmentDef.help}</p>
            </div>

            {segmentDef.param && (
              <div>
                <label htmlFor="promo-param" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                  {segmentDef.param.label}
                </label>
                {segment === 'anniversaires' ? (
                  <select
                    id="promo-param"
                    value={params.mois ?? 0}
                    onChange={e => { setParams({ mois: Number(e.target.value) }); setDirty(true); }}
                    className="w-full px-3 py-2 max-lg:min-h-11 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 outline-none cursor-pointer"
                  >
                    <option value={0}>Mois en cours</option>
                    {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    id="promo-param" type="number" min={1}
                    value={params[segmentDef.param.name] ?? segmentDef.param.default}
                    onChange={e => {
                      setParams({ [segmentDef.param!.name]: Math.max(1, Number(e.target.value) || 1) });
                      setDirty(true);
                    }}
                    className="w-full px-3 py-2 max-lg:min-h-11 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 outline-none tabular-nums"
                  />
                )}
              </div>
            )}

            {loading ? (
              <p className="text-[13px] text-stone-600">Calcul des destinataires…</p>
            ) : (
              <div className="space-y-2 pt-1">
                {/* Les deux compteurs s'affichent quel que soit le canal choisi :
                    masquer « 12 par WhatsApp » parce que la promotion est réglée
                    sur e-mail donnait l'impression qu'aucune cliente n'était
                    joignable, alors qu'il suffisait de changer de canal. */}
                <div className="flex flex-wrap gap-2">
                  <Chip icon={Users} label={`${audience.length} destinataire${audience.length > 1 ? 's' : ''}`} />
                  <Chip icon={Mail} label={`${parEmail.length} par e-mail`} muted={!utiliseEmail} />
                  <Chip icon={MessageCircle} label={`${parWa.length} par WhatsApp`} muted={!utiliseWa} />
                </div>
                {!utiliseWa && parWa.length > 0 && (
                  <p className="text-[13px] text-stone-600">
                    {parWa.length} cliente{parWa.length > 1 ? 's sont joignables' : ' est joignable'} par
                    WhatsApp mais ne recevr{parWa.length > 1 ? 'ont' : 'a'} rien :
                    {' '}<button
                      onClick={() => mark(setCanal)(utiliseEmail ? 'les_deux' : 'whatsapp')}
                      className="font-semibold text-accent hover:underline cursor-pointer max-lg:py-2.5"
                    >
                      ajouter le canal WhatsApp
                    </button>.
                  </p>
                )}
                {!utiliseEmail && parEmail.length > 0 && (
                  <p className="text-[13px] text-stone-600">
                    {parEmail.length} adresse{parEmail.length > 1 ? 's' : ''} e-mail dans cette audience —
                    {' '}<button
                      onClick={() => mark(setCanal)('les_deux')}
                      className="font-semibold text-accent hover:underline cursor-pointer max-lg:py-2.5"
                    >
                      ajouter le canal e-mail
                    </button>.
                  </p>
                )}
              </div>
            )}

            {!loading && audience.length === 0 && (
              <p className="flex items-start gap-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                Personne ne correspond. Les accords publicitaires se cochent sur chaque
                fiche cliente — sans eux, une cliente n&apos;entre dans aucune audience.
              </p>
            )}
          </section>

          {/* ── Rédaction e-mail ────────────────────────────────────────── */}
          {utiliseEmail && (
            <section className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <p className="text-[12.5px] font-medium text-stone-700 flex items-center gap-1.5">
                <Mail size={12} /> Message e-mail
              </p>
              <div>
                <label htmlFor="promo-objet" className="block text-[12.5px] font-medium text-stone-700 mb-1">Objet *</label>
                <input
                  id="promo-objet" type="text" value={objet} onChange={e => mark(setObjet)(e.target.value)}
                  placeholder="−20 % sur les soins du visage en septembre"
                  className="w-full px-3 py-2 max-lg:min-h-11 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 outline-none"
                />
              </div>
              <div>
                <label htmlFor="promo-corps" className="block text-[12.5px] font-medium text-stone-700 mb-1">Message *</label>
                <textarea
                  id="promo-corps" rows={8} value={messageEmail} onChange={e => mark(setMessageEmail)(e.target.value)}
                  placeholder={"Bonjour {{prenom}},\n\nCe mois-ci, …"}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 outline-none resize-y"
                />
                <p className="text-[12px] text-stone-600 mt-1 leading-relaxed">
                  Texte simple : une ligne vide sépare deux paragraphes. Le lien de désinscription
                  est ajouté automatiquement — il est obligatoire.
                </p>
              </div>
              <Variables />

              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-stone-50">
                <label htmlFor="promo-test" className="sr-only">Adresse d&apos;essai</label>
                <input
                  id="promo-test" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="Adresse pour un essai"
                  className="flex-1 px-3 py-2 max-lg:min-h-11 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 outline-none"
                />
                <button
                  onClick={sendTest} disabled={sending || !testEmail.trim() || !objet.trim() || !messageEmail.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 max-lg:min-h-11 rounded-lg bg-stone-100 text-stone-900 font-semibold hover:bg-stone-200 text-sm transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer un essai
                </button>
              </div>

              <button
                onClick={sendAll}
                disabled={sending || emailsRestants === 0 || !objet.trim() || !messageEmail.trim()}
                className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 max-lg:min-h-12 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
              >
                {sending && progress
                  ? <><Loader2 size={14} className="animate-spin" /> Envoi en cours : {progress.done} / {progress.total}…</>
                  : emailsRestants === 0
                    ? <><Check size={14} /> {parEmail.length === 0 ? 'Aucune adresse à qui envoyer' : 'Toutes les adresses ont reçu cet e-mail'}</>
                    : <><Send size={14} /> Envoyer à {emailsRestants} adresse{emailsRestants > 1 ? 's' : ''}</>}
              </button>
              {servis.email.size > 0 && (
                <p className="text-[12px] text-stone-600 text-center">
                  {servis.email.size} adresse{servis.email.size > 1 ? 's ont' : ' a'} déjà reçu cette promotion —
                  {' '}elle{servis.email.size > 1 ? 's' : ''} ne {servis.email.size > 1 ? 'seront' : 'sera'} pas resollicité{servis.email.size > 1 ? 'es' : 'e'}.
                </p>
              )}
              {echecsEmail > 0 && (
                <div className="flex items-center justify-center gap-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <TriangleAlert size={12} className="shrink-0" />
                  <span>{echecsEmail} envoi{echecsEmail > 1 ? 's' : ''} en échec.</span>
                  <button
                    onClick={retryEchecs} disabled={sending}
                    className="font-semibold underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-40 max-lg:min-h-11 max-lg:px-2"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Rédaction WhatsApp ──────────────────────────────────────── */}
          {utiliseWa && (
            <section className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <p className="text-[12.5px] font-medium text-stone-700 flex items-center gap-1.5">
                <MessageCircle size={12} /> Message WhatsApp
              </p>
              <div>
                <label htmlFor="promo-wa" className="sr-only">Message WhatsApp</label>
                <textarea
                  id="promo-wa" rows={5} value={messageWa} onChange={e => mark(setMessageWa)(e.target.value)}
                  placeholder={"Bonjour {{prenom}} ! Ce mois-ci, …"}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 outline-none resize-y"
                />
                <p className="text-[12px] text-stone-600 mt-1 leading-relaxed">
                  Court et direct : ce n&apos;est pas un e-mail. Un clic ouvre la conversation
                  avec le message déjà écrit ; il reste à appuyer sur « Envoyer » dans WhatsApp.
                </p>
              </div>
              <Variables />

              {parWa.length === 0 ? (
                <p className="text-[12.5px] text-stone-600 italic">
                  Aucune destinataire joignable : il faut un numéro exploitable et l&apos;accord WhatsApp coché.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 text-[12.5px] text-stone-600">
                    <span>{waFaits} / {parWa.length} contactées</span>
                    {waFaits > 0 && <span className="text-stone-600">Une ligne est cochée dès que sa conversation a été ouverte</span>}
                  </div>
                  <ul className="space-y-1.5 max-h-80 max-lg:max-h-none overflow-y-auto max-lg:overflow-visible pr-1">
                    {parWa.map(entry => {
                      const fait = servis.whatsapp.has(entry.waNumber!.toLowerCase());
                      return (
                        <li
                          key={entry.key}
                          className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 transition-colors ${
                            fait ? 'border-emerald-200 bg-emerald-50/60' : 'border-stone-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700 truncate">{entry.nom}</p>
                            <p className="text-[12.5px] text-stone-600 tabular-nums">+{entry.waNumber}</p>
                          </div>
                          {fait ? (
                            <button
                              onClick={() => undoWhatsApp(entry)}
                              className="shrink-0 flex items-center gap-1 text-[12.5px] max-lg:text-[14px] max-lg:min-h-11 max-lg:px-2 text-stone-600 hover:text-stone-700 cursor-pointer"
                              title="Remettre dans la liste (si le message n'a finalement pas été envoyé)"
                            >
                              <RotateCcw size={12} /> Pas envoyé
                            </button>
                          ) : (
                            <button
                              onClick={() => openWhatsApp(entry)}
                              disabled={!messageWa.trim()}
                              className="shrink-0 flex items-center gap-1.5 h-8 max-lg:h-11 px-3 rounded-lg bg-stone-100 text-stone-900 font-semibold hover:bg-stone-200 text-[13px] max-lg:text-[14px] transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <ExternalLink size={13} /> Ouvrir WhatsApp
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] lg:hidden" aria-hidden="true" />
      </aside>
    </div>
    {/* Hors du fond cliquable : un clic dans la feuille remonterait sinon jusqu'à lui. */}
    {confirmNode}
    </>
  );
}

function Chip({ icon: Icon, label, muted }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Canal non retenu par la promotion : le chiffre reste lisible, mais en
   *  retrait — il informe sans laisser croire que l'envoi partira. */
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1 rounded-lg ${
        muted ? 'text-stone-600 bg-stone-50 border border-dashed border-stone-200' : 'text-stone-700 bg-stone-100'
      }`}
      title={muted ? 'Canal non sélectionné pour cette promotion' : undefined}
    >
      <Icon size={13} className={muted ? 'text-stone-500' : 'text-stone-700'} /> {label}
    </span>
  );
}

function Variables() {
  return (
    <p className="text-[12px] text-stone-600">
      Variables :{' '}
      {VARIABLES_DISPONIBLES.map((v, i) => (
        <span key={v.token}>
          {i > 0 && ', '}
          <code className="px-1 bg-stone-100 rounded text-stone-600">{v.token}</code> {v.help.toLowerCase()}
        </span>
      ))}
    </p>
  );
}
