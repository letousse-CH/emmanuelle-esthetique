"use client";

/**
 * Bons cadeaux commandés sur le site, payés par TWINT.
 *
 * Le compte TWINT de l'institut ne prévient pas le site : l'exploitante
 * rapproche chaque commande (référence, montant, nom) de son relevé TWINT,
 * puis clique « Paiement reçu ». La facture et le bon sont alors émis par
 * Postgres, et le bon part à l'acheteuse en PDF.
 */
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Check, Download, ExternalLink, Image as ImageIcon, Mail, Settings2, X,
} from 'lucide-react';
import { supabase } from '../../../../services/supabase';
import { adminFetch, errorMessage } from '../../../../components/admin/reservations/lib';
import { downloadBonCadeau } from '../../../../utils/factureDownload';
import { formatCHF } from '../../../../types/caisse';
import {
  GIFT_SETTING_KEYS, giftLineLabel, giftOrderOpen, giftOrderStatusLabel, isHttpUrl, joursDepuis,
  parseGiftOrderSettings,
  type GiftOrder, type GiftOrderSettings,
} from '../../../../types/giftOrders';
import { SETTINGS_DEFAULTS } from '../../../../constants/settings';
import {
  Badge, Button, Callout, Field, Input, SectionHeading, ToggleRow,
} from '../../../../components/admin/ui';

const MediaPickerModal = dynamic(() => import('../../../../components/pagebuilder/MediaPickerModal'), { ssr: false });

const PUBLIC_PATH = '/bon-cadeau/commander';

type Pending = { kind: 'confirmer' | 'annuler'; order: GiftOrder } | null;

export default function CommandesEnLigne({ onSold }: { onSold: () => void }) {
  const params = useSearchParams();
  const focusId = params.get('commande');

  const [orders, setOrders] = useState<GiftOrder[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<GiftOrderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [motif, setMotif] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    const [ordersRes, settingsRes] = await Promise.all([
      supabase.from('gift_card_orders').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('settings').select('key, value').in('key', [...GIFT_SETTING_KEYS]),
    ]);
    if (ordersRes.error) {
      // Migration pas encore appliquée : la section se tait plutôt que d'alarmer.
      setError(/gift_card_orders/.test(ordersRes.error.message)
        ? 'La table des commandes en ligne n\'existe pas encore : appliquez la migration 20261024_bons_commande_en_ligne.sql.'
        : `Les commandes en ligne n'ont pas pu être chargées (${ordersRes.error.message}).`);
    }
    const list = (ordersRes.data ?? []).map((o: any) => ({ ...o, montant: Number(o.montant) })) as GiftOrder[];
    setOrders(list);
    const map = Object.fromEntries((settingsRes.data ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? '']));
    setSettings(parseGiftOrderSettings({ ...pickDefaults(), ...map }));

    const cardIds = list.map(o => o.gift_card_id).filter(Boolean) as string[];
    if (cardIds.length) {
      const { data } = await supabase.from('gift_cards').select('id, code').in('id', cardIds);
      setCodes(Object.fromEntries((data ?? []).map((c: { id: string; code: string }) => [c.id, c.code])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!focusId || loading) return;
    document.getElementById(`commande-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, loading]);

  const aVerifier = useMemo(() => orders.filter(o => o.status === 'en_attente'), [orders]);
  const traitees = useMemo(() => orders.filter(o => o.status !== 'en_attente').slice(0, 12), [orders]);

  const act = async (order: GiftOrder, action: 'paiement_recu' | 'renvoyer' | 'annuler', extra: Record<string, string> = {}) => {
    setBusy(order.id); setError(null); setNotice(null);
    try {
      const res = await adminFetch<{ order: GiftOrder; email?: { ok: boolean; error?: string } }>(
        `/api/admin/gift-orders/${order.id}`,
        { method: 'POST', body: JSON.stringify({ action, ...extra }) },
      );
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...res.order, montant: Number(res.order.montant) } : o)));
      if (action === 'annuler') {
        setNotice(`Commande ${order.reference} annulée.`);
      } else if (res.email && !res.email.ok) {
        setError(`${action === 'paiement_recu' ? 'Facture et bon émis, mais l' : 'L'}'e-mail à ${order.acheteur_email} n'est pas parti (${res.email.error}). Téléchargez le bon pour l'envoyer vous-même, ou réessayez « Renvoyer le bon ».`);
      } else {
        setNotice(`Bon envoyé à ${order.acheteur_email}${action === 'paiement_recu' ? ' ; la vente figure au journal (TWINT).' : '.'}`);
      }
      if (action === 'paiement_recu') {
        onSold();
        load();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      setPending(null);
      setMotif('');
    }
  };

  const handleDownload = async (order: GiftOrder) => {
    if (!order.gift_card_id) return;
    setBusy(order.id); setError(null);
    try {
      await downloadBonCadeau(order.gift_card_id, codes[order.gift_card_id] ?? order.reference);
    } catch (e) {
      setError(`Le bon n'a pas pu être téléchargé (${errorMessage(e)}).`);
    } finally {
      setBusy(null);
    }
  };

  const ouverte = settings ? giftOrderOpen(settings) : false;

  return (
    <section aria-labelledby="commandes-en-ligne" className="space-y-4">
      <SectionHeading
        id="commandes-en-ligne"
        title="Commandes en ligne"
        description={settings && (ouverte
          ? <>Vente en ligne ouverte · <a href={PUBLIC_PATH} target="_blank" rel="noreferrer" className="text-accent hover:underline">voir la page <ExternalLink size={12} className="inline -mt-0.5" /></a></>
          : 'Vente en ligne fermée : la page publique renvoie au formulaire de contact.')}
        actions={
          <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}>
            Réglages
          </Button>
        }
      />

      {showSettings && settings && (
        <VenteEnLigneSettings
          initial={settings}
          onSaved={(s) => { setSettings(s); setShowSettings(false); setNotice('Réglages enregistrés. La page publique est à jour dans la minute.'); }}
        />
      )}

      {error && (
        <Callout tone="danger" actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}>
          {error}
        </Callout>
      )}
      {notice && (
        <Callout tone="success" actions={<Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Masquer</Button>}>
          {notice}
        </Callout>
      )}

      {loading ? (
        <div className="h-20 rounded-xl bg-stone-50 animate-pulse" />
      ) : aVerifier.length === 0 ? (
        <div className="rounded-xl bg-stone-50 px-5 py-4 text-[14px] text-stone-600">
          Aucune commande en attente de paiement.
        </div>
      ) : (
        <ul className="data-frame zebra overflow-hidden rounded-xl">
          {aVerifier.map(o => {
            const jours = joursDepuis(o.created_at);
            return (
              <li
                key={o.id} id={`commande-${o.id}`}
                className={`flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center ${focusId === o.id ? 'ring-2 ring-inset ring-accent/40' : ''}`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-stone-950 tabular-nums">
                    {o.reference}
                    <Badge tone="warning">{giftOrderStatusLabel(o)}</Badge>
                    <span className="text-[12.5px] font-normal text-stone-600">
                      {new Date(o.created_at).toLocaleString('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {jours >= 3 && ` · depuis ${jours} jours`}
                    </span>
                  </p>
                  <p className="text-[14px] text-stone-800">
                    {o.type === 'soins' && o.lignes.length ? o.lignes.map(giftLineLabel).join(' + ') : 'Montant libre'}
                    {' · '}pour <strong className="font-semibold">{o.beneficiaire}</strong>
                  </p>
                  <p className="text-[13px] text-stone-600">
                    {o.acheteur_prenom} {o.acheteur_nom} · <a href={`mailto:${o.acheteur_email}`} className="hover:underline">{o.acheteur_email}</a>
                    {o.acheteur_telephone && <> · <a href={`tel:${o.acheteur_telephone.replace(/\s+/g, '')}`} className="hover:underline">{o.acheteur_telephone}</a></>}
                  </p>
                  {o.message && <p className="text-[13px] italic text-stone-600 whitespace-pre-line">« {o.message} »</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-[20px] font-semibold tabular-nums text-stone-950">{formatCHF(o.montant)}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" icon={X} disabled={busy === o.id} onClick={() => setPending({ kind: 'annuler', order: o })}>
                      Annuler
                    </Button>
                    <Button size="sm" variant="primary" icon={Check} loading={busy === o.id} onClick={() => setPending({ kind: 'confirmer', order: o })}>
                      Paiement reçu
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {traitees.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[13.5px] font-medium text-stone-600 hover:text-stone-900">
            Commandes traitées récemment ({traitees.length})
          </summary>
          <ul className="data-frame zebra mt-3 overflow-hidden rounded-xl">
            {traitees.map(o => (
              <li key={o.id} id={`commande-${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-stone-950 tabular-nums">
                    {o.reference}
                    <Badge tone={o.status === 'payee' ? 'success' : 'neutral'}>{giftOrderStatusLabel(o)}</Badge>
                    {o.gift_card_id && codes[o.gift_card_id] && <span className="font-normal text-stone-600">{codes[o.gift_card_id]}</span>}
                  </p>
                  <p className="text-[13px] text-stone-600">
                    {o.acheteur_prenom} {o.acheteur_nom} · pour {o.beneficiaire}
                    {o.status === 'payee' && o.email_envoye_le && ` · bon envoyé le ${new Date(o.email_envoye_le).toLocaleDateString('fr-CH')}`}
                    {o.status === 'annulee' && o.motif_annulation && ` · ${o.motif_annulation}`}
                  </p>
                  {o.status === 'payee' && !o.email_envoye_le && (
                    <p className="text-[13px] font-medium text-red-700">E-mail non parti{o.email_erreur ? ` : ${o.email_erreur}` : ''}</p>
                  )}
                </div>
                <span className="text-[15px] font-semibold tabular-nums text-stone-950">{formatCHF(o.montant)}</span>
                {o.status === 'payee' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={Mail} loading={busy === o.id} onClick={() => act(o, 'renvoyer')}>
                      Renvoyer le bon
                    </Button>
                    <Button size="sm" variant="ghost" icon={Download} disabled={busy === o.id} onClick={() => handleDownload(o)} aria-label="Télécharger le bon" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {pending && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/40 p-4" onClick={() => !busy && setPending(null)}>
          <div
            role="dialog" aria-modal="true" aria-labelledby="commande-dialog-title"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            {pending.kind === 'confirmer' ? (
              <>
                <h3 id="commande-dialog-title" className="text-[17px] font-semibold text-stone-950">
                  {formatCHF(pending.order.montant)} reçu sur TWINT ?
                </h3>
                <p className="text-[14px] leading-relaxed text-stone-700">
                  Vérifiez dans l&apos;app TWINT le paiement de <strong>{pending.order.acheteur_prenom} {pending.order.acheteur_nom}</strong> (commande {pending.order.reference}).
                  En confirmant, la facture (mode TWINT) et le bon sont émis, et le bon part à {pending.order.acheteur_email}.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPending(null)} disabled={busy === pending.order.id}>Pas encore</Button>
                  <Button variant="primary" icon={Check} loading={busy === pending.order.id} onClick={() => act(pending.order, 'paiement_recu')}>
                    Oui, émettre le bon
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 id="commande-dialog-title" className="text-[17px] font-semibold text-stone-950">
                  Annuler la commande {pending.order.reference} ?
                </h3>
                <p className="text-[14px] leading-relaxed text-stone-700">
                  À faire si le paiement n&apos;arrive pas. Aucun e-mail n&apos;est envoyé : prévenez l&apos;acheteuse si besoin.
                </p>
                <Field label="Motif (facultatif)" htmlFor="commande-motif">
                  <Input id="commande-motif" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Pas de paiement reçu" maxLength={300} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPending(null)} disabled={busy === pending.order.id}>Garder</Button>
                  <Button variant="danger" icon={X} loading={busy === pending.order.id} onClick={() => act(pending.order, 'annuler', { motif })}>
                    Annuler la commande
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function pickDefaults(): Record<string, string> {
  return Object.fromEntries(GIFT_SETTING_KEYS.map(k => [k, SETTINGS_DEFAULTS[k]]));
}

function VenteEnLigneSettings({ initial, onSaved }: { initial: GiftOrderSettings; onSaved: (s: GiftOrderSettings) => void }) {
  const [actif, setActif] = useState(initial.actif);
  const [min, setMin] = useState(String(initial.montantMin));
  const [qr, setQr] = useState(initial.twintQr);
  const [lien, setLien] = useState(initial.twintLien);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lienInvalide = lien.trim() !== '' && !isHttpUrl(lien.trim());
  const sansPaiement = actif && !qr.trim() && (!lien.trim() || lienInvalide);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (lienInvalide) { setError('Le lien TWINT doit commencer par https://'); return; }
    if (sansPaiement) { setError('Ajoutez le code QR TWINT ou un lien de paiement : sans eux, l\'acheteuse ne saurait pas où payer.'); return; }
    setSaving(true);
    const rows = [
      { key: 'bon_en_ligne_actif', value: String(actif) },
      { key: 'bon_en_ligne_montant_min', value: String(Math.max(1, Math.round(Number(min.replace(',', '.')) || 100))) },
      { key: 'bon_en_ligne_twint_qr', value: qr.trim() },
      { key: 'bon_en_ligne_twint_lien', value: lien.trim() },
    ];
    const { error: err } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (err) {
      setError(`Enregistrement impossible : ${err.message}`);
      setSaving(false);
      return;
    }
    // La page publique est en ISR : on la régénère tout de suite.
    adminFetch('/api/revalidate', { method: 'POST', body: JSON.stringify({ path: PUBLIC_PATH }) }).catch(() => {});
    setSaving(false);
    onSaved(parseGiftOrderSettings(Object.fromEntries(rows.map(r => [r.key, r.value]))));
  };

  return (
    <>
    <form onSubmit={save} className="space-y-4 rounded-xl bg-stone-50 px-5 py-5 lg:px-6">
      <ToggleRow
        title="Commande en ligne ouverte"
        description={<>Le bouton « Commander » de la page Bon cadeau mène au formulaire <code>{PUBLIC_PATH}</code>. Fermée, la page renvoie au contact.</>}
        checked={actif}
        onChange={setActif}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Montant libre minimal (CHF)" htmlFor="bon-min" hint="Les bons « soins » valent le prix des soins choisis.">
          <Input id="bon-min" inputMode="numeric" value={min} onChange={e => setMin(e.target.value)} />
        </Field>
        <Field
          label="Lien de paiement TWINT (facultatif)" htmlFor="bon-lien"
          error={lienInvalide ? 'Le lien doit commencer par https://' : undefined}
          hint="Sur téléphone, il ouvre l'app TWINT. Laissez vide si vous n'avez que le code QR."
        >
          <Input id="bon-lien" value={lien} onChange={e => setLien(e.target.value)} placeholder="https://…" />
        </Field>
      </div>
      <Field label="Code QR TWINT de l'institut" hint="Photo ou capture du code QR de votre compte TWINT, affiché à l'acheteuse après sa commande et dans l'e-mail.">
        <div className="flex flex-wrap items-center gap-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Code QR TWINT" className="size-28 rounded border border-stone-200 bg-white object-contain" />
          ) : (
            <span className="grid size-28 place-items-center rounded border border-dashed border-stone-300 bg-white text-stone-400">
              <ImageIcon size={22} />
            </span>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" icon={ImageIcon} onClick={() => setPicker(true)}>Choisir l&apos;image</Button>
            {qr && <Button type="button" size="sm" variant="ghost" onClick={() => setQr('')}>Retirer</Button>}
          </div>
        </div>
      </Field>
      {(error || sansPaiement) && <Callout tone={error ? 'danger' : 'warning'}>{error ?? 'Sans code QR ni lien TWINT, la vente reste fermée sur le site.'}</Callout>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving}>Enregistrer</Button>
      </div>
    </form>
    {/* Hors du formulaire : la médiathèque a ses propres boutons. */}
    <MediaPickerModal isOpen={picker} onClose={() => setPicker(false)} onSelect={(url: string) => { setQr(url); setPicker(false); }} />
    </>
  );
}
