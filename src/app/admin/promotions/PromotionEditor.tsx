"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    if (!testEmail.includes('@')) { setError('Adresse de test invalide.'); return; }
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
    if (!confirm(`Envoyer « ${nom} » à ${restants.length} adresse${restants.length > 1 ? 's' : ''} ?\n\nCeux qui l'ont déjà reçu sont ignorés.`)) return;

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
      setNotice('Les échecs sont remis en file. Relance l’envoi.');
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
    window.open(whatsappLink(entry.waNumber!, texte), '_blank', 'noopener');
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <aside
        role="dialog" aria-modal="true" aria-label={`Promotion ${promotion.nom}`}
        onClick={e => e.stopPropagation()}
        className="bg-stone-50 w-full sm:max-w-2xl h-full overflow-y-auto shadow-2xl"
      >
        <header className="sticky top-0 z-10 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="promo-nom" className="sr-only">Nom de la promotion</label>
            <input
              id="promo-nom" type="text" value={nom} onChange={e => mark(setNom)(e.target.value)}
              placeholder="Nom de la promotion"
              className="w-full text-lg font-semibold text-stone-900 bg-transparent border-0 outline-none placeholder:text-stone-300"
            />
            <p className="text-[11px] text-stone-400">
              {CANAL_LABELS[canal]} · {segmentDef.label}
              {dirty && <span className="text-amber-600"> · modifications non enregistrées</span>}
            </p>
          </div>
          <button
            onClick={save} disabled={saving || !dirty}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-sage hover:text-sage text-xs transition-all disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
          </button>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 p-1.5 text-stone-400 hover:text-stone-800 cursor-pointer">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Masquer" className="shrink-0 cursor-pointer"><X size={14} /></button>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sage/30 bg-sage/5 px-4 py-3 text-sm text-stone-700">
              <Check size={15} className="shrink-0 mt-0.5 text-sage" />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice(null)} aria-label="Masquer" className="shrink-0 cursor-pointer"><X size={14} /></button>
            </div>
          )}

          {/* ── Canal ───────────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-100 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Canal</p>
            <div className="grid grid-cols-3 gap-2">
              {(['email', 'whatsapp', 'les_deux'] as PromotionCanal[]).map(c => (
                <button
                  key={c} onClick={() => mark(setCanal)(c)} aria-pressed={canal === c}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    canal === c ? 'border-sage bg-sage/8 text-sage' : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
                >
                  {CANAL_LABELS[c]}
                </button>
              ))}
            </div>
          </section>

          {/* ── Segment ─────────────────────────────────────────────────── */}
          <section className="bg-white border border-stone-100 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Destinataires</p>
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
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage outline-none cursor-pointer"
              >
                {SEGMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <p className="text-[11px] text-stone-400 mt-1.5">{segmentDef.help}</p>
            </div>

            {segmentDef.param && (
              <div>
                <label htmlFor="promo-param" className="block text-[11px] font-medium text-stone-500 mb-1">
                  {segmentDef.param.label}
                </label>
                {segment === 'anniversaires' ? (
                  <select
                    id="promo-param"
                    value={params.mois ?? 0}
                    onChange={e => { setParams({ mois: Number(e.target.value) }); setDirty(true); }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage outline-none cursor-pointer"
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
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage outline-none tabular-nums"
                  />
                )}
              </div>
            )}

            {loading ? (
              <p className="text-xs text-stone-300 italic">Calcul de l&apos;audience…</p>
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
                  <p className="text-[11px] text-stone-500">
                    {parWa.length} cliente{parWa.length > 1 ? 's sont joignables' : ' est joignable'} par
                    WhatsApp mais ne recevr{parWa.length > 1 ? 'ont' : 'a'} rien :
                    {' '}<button
                      onClick={() => mark(setCanal)(utiliseEmail ? 'les_deux' : 'whatsapp')}
                      className="font-semibold text-sage hover:underline cursor-pointer"
                    >
                      ajouter le canal WhatsApp
                    </button>.
                  </p>
                )}
                {!utiliseEmail && parEmail.length > 0 && (
                  <p className="text-[11px] text-stone-500">
                    {parEmail.length} adresse{parEmail.length > 1 ? 's' : ''} e-mail dans cette audience —
                    {' '}<button
                      onClick={() => mark(setCanal)('les_deux')}
                      className="font-semibold text-sage hover:underline cursor-pointer"
                    >
                      ajouter le canal e-mail
                    </button>.
                  </p>
                )}
              </div>
            )}

            {!loading && audience.length === 0 && (
              <p className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                Personne ne correspond. Les accords publicitaires se cochent sur chaque
                fiche cliente — sans eux, une cliente n&apos;entre dans aucune audience.
              </p>
            )}
          </section>

          {/* ── Rédaction e-mail ────────────────────────────────────────── */}
          {utiliseEmail && (
            <section className="bg-white border border-stone-100 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                <Mail size={12} /> Message e-mail
              </p>
              <div>
                <label htmlFor="promo-objet" className="block text-[11px] font-medium text-stone-500 mb-1">Objet *</label>
                <input
                  id="promo-objet" type="text" value={objet} onChange={e => mark(setObjet)(e.target.value)}
                  placeholder="−20 % sur les soins du visage en septembre"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage outline-none"
                />
              </div>
              <div>
                <label htmlFor="promo-corps" className="block text-[11px] font-medium text-stone-500 mb-1">Message *</label>
                <textarea
                  id="promo-corps" rows={8} value={messageEmail} onChange={e => mark(setMessageEmail)(e.target.value)}
                  placeholder={"Bonjour {{prenom}},\n\nCe mois-ci, …"}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage outline-none resize-y"
                />
                <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
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
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage outline-none"
                />
                <button
                  onClick={sendTest} disabled={sending || !testEmail.trim() || !objet.trim() || !messageEmail.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:border-sage hover:text-sage text-sm transition-all disabled:opacity-40 cursor-pointer"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Essai
                </button>
              </div>

              <button
                onClick={sendAll}
                disabled={sending || parEmail.length === 0 || !objet.trim() || !messageEmail.trim()}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-sage transition-colors disabled:opacity-40 cursor-pointer"
              >
                {sending && progress
                  ? <><Loader2 size={14} className="animate-spin" /> {progress.done} / {progress.total}…</>
                  : <><Send size={14} /> Envoyer aux {parEmail.filter(e => !servis.email.has(e.email!.toLowerCase())).length} adresses restantes</>}
              </button>
              {servis.email.size > 0 && (
                <p className="text-[10px] text-stone-400 text-center">
                  {servis.email.size} adresse{servis.email.size > 1 ? 's ont' : ' a'} déjà reçu cette promotion —
                  {' '}elle{servis.email.size > 1 ? 's' : ''} ne {servis.email.size > 1 ? 'seront' : 'sera'} pas resollicité{servis.email.size > 1 ? 'es' : 'e'}.
                </p>
              )}
              {echecsEmail > 0 && (
                <div className="flex items-center justify-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <TriangleAlert size={12} className="shrink-0" />
                  <span>{echecsEmail} envoi{echecsEmail > 1 ? 's' : ''} en échec.</span>
                  <button
                    onClick={retryEchecs} disabled={sending}
                    className="font-semibold underline underline-offset-2 hover:no-underline cursor-pointer disabled:opacity-40"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Rédaction WhatsApp ──────────────────────────────────────── */}
          {utiliseWa && (
            <section className="bg-white border border-stone-100 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                <MessageCircle size={12} /> Message WhatsApp
              </p>
              <div>
                <label htmlFor="promo-wa" className="sr-only">Message WhatsApp</label>
                <textarea
                  id="promo-wa" rows={5} value={messageWa} onChange={e => mark(setMessageWa)(e.target.value)}
                  placeholder={"Bonjour {{prenom}} ! Ce mois-ci, …"}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage outline-none resize-y"
                />
                <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                  Court et direct : ce n&apos;est pas un e-mail. Un clic ouvre la conversation
                  avec le message déjà écrit, tu appuies sur envoyer dans WhatsApp.
                </p>
              </div>
              <Variables />

              {parWa.length === 0 ? (
                <p className="text-xs text-stone-400 italic">
                  Aucune destinataire joignable : il faut un numéro exploitable et l&apos;accord WhatsApp coché.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{waFaits} / {parWa.length} contactées</span>
                    {waFaits > 0 && <span className="text-sage">Coché après ouverture de la conversation</span>}
                  </div>
                  <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {parWa.map(entry => {
                      const fait = servis.whatsapp.has(entry.waNumber!.toLowerCase());
                      return (
                        <li
                          key={entry.key}
                          className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 transition-colors ${
                            fait ? 'border-sage/30 bg-sage/5' : 'border-stone-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700 truncate">{entry.nom}</p>
                            <p className="text-[11px] text-stone-400 tabular-nums">+{entry.waNumber}</p>
                          </div>
                          {fait ? (
                            <button
                              onClick={() => undoWhatsApp(entry)}
                              className="shrink-0 flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer"
                              title="Marquer comme non envoyé"
                            >
                              <RotateCcw size={12} /> Annuler
                            </button>
                          ) : (
                            <button
                              onClick={() => openWhatsApp(entry)}
                              disabled={!messageWa.trim()}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-sage text-xs transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <ExternalLink size={12} /> Ouvrir
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
      </aside>
    </div>
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
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg ${
        muted ? 'text-stone-400 bg-stone-50 border border-dashed border-stone-200' : 'text-stone-600 bg-stone-100'
      }`}
      title={muted ? 'Canal non sélectionné pour cette promotion' : undefined}
    >
      <Icon size={11} className={muted ? 'text-stone-300' : 'text-stone-400'} /> {label}
    </span>
  );
}

function Variables() {
  return (
    <p className="text-[10px] text-stone-400">
      Variables :{' '}
      {VARIABLES_DISPONIBLES.map((v, i) => (
        <span key={v.token}>
          {i > 0 && ', '}
          <code className="px-1 bg-stone-100 rounded text-stone-500">{v.token}</code> {v.help.toLowerCase()}
        </span>
      ))}
    </p>
  );
}
