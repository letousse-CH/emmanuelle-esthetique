"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, RotateCcw, Save } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Button, Callout, FormMessage } from '../ui';
import type { Booking } from '../../../types/booking';
import {
  BODY_MAX,
  CLIENT_MAILS,
  DEFAULT_MAIL_TEXTS,
  MAIL_VARIABLES,
  SUBJECT_MAX,
  mailTextFor,
  parseMailOverrides,
  renderClientMail,
  unknownVariables,
  type Biz,
  type ClientMailKind,
  type MailText,
  type MailTextOverrides,
} from '../../../utils/bookingEmails';

/**
 * Textes des e-mails envoyés aux clientes (accusé, confirmation, rappel…).
 * Enregistrés dans le réglage `booking_email_templates` ; l'envoi et l'aperçu
 * passent par le même rendu (utils/bookingEmails.ts).
 */

const SETTING_KEY = 'booking_email_templates';
const BIZ_KEYS = ['business_name', 'business_owner', 'business_phone', 'business_email', 'business_address_street', 'business_address_postal', 'business_address_city'];

type Msg = { type: 'success' | 'error'; text: string } | null;

function zurichDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

/** Rendez-vous fictif pour l'aperçu. */
function sampleBooking(): { b: Booking; previous: Booking } {
  const b = {
    id: 'apercu',
    prenom: 'Marie',
    nom: 'Dupont',
    telephone: '079 123 45 67',
    email: 'marie.dupont@example.ch',
    service_nom: 'Soin visage Phytomer',
    service_prix_chf: 120,
    service_duree_minutes: 60,
    total_chf: 120,
    options: [],
    date_rdv: zurichDate(1),
    heure_rdv: '14:30',
    horaire_fixe: true,
    periode: 'apres_midi',
    statut: 'confirme',
  } as unknown as Booking;
  return { b, previous: { ...b, date_rdv: zurichDate(-1), heure_rdv: '09:00' } as Booking };
}

const same = (a: MailText, b: MailText) => a.subject === b.subject && a.body === b.body;

async function readOverrides(): Promise<MailTextOverrides> {
  const { data, error } = await supabase.from('settings').select('value').eq('key', SETTING_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return parseMailOverrides(data?.value as string | undefined);
}

export default function ClientEmailsSection() {
  const [saved, setSaved] = useState<MailTextOverrides>({});
  const [drafts, setDrafts] = useState<Record<ClientMailKind, MailText>>(DEFAULT_MAIL_TEXTS);
  const [biz, setBiz] = useState<Biz>({ name: '', phone: '', email: '', address: '' });
  const [open, setOpen] = useState<ClientMailKind | null>(null);
  const [preview, setPreview] = useState(true);
  const [saving, setSaving] = useState<ClientMailKind | null>(null);
  const [msg, setMsg] = useState<{ kind: ClientMailKind; msg: Msg } | null>(null);
  const [loadError, setLoadError] = useState('');

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<'subject' | 'body'>('body');
  const sample = useMemo(sampleBooking, []);

  useEffect(() => {
    (async () => {
      try {
        const [overrides, { data: rows }] = await Promise.all([
          readOverrides(),
          supabase.from('settings').select('key, value').in('key', BIZ_KEYS),
        ]);
        const s = Object.fromEntries((rows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? '']));
        setBiz({
          name: s.business_name || '',
          owner: s.business_owner || '',
          phone: s.business_phone || '',
          email: s.business_email || '',
          address: [s.business_address_street, [s.business_address_postal, s.business_address_city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        });
        setSaved(overrides);
        setDrafts(Object.fromEntries(CLIENT_MAILS.map(({ kind }) => [kind, mailTextFor(kind, overrides)])) as Record<ClientMailKind, MailText>);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Les textes n\'ont pas pu être chargés.');
      }
    })();
  }, []);

  function setDraft(kind: ClientMailKind, patch: Partial<MailText>) {
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }));
    if (msg?.kind === kind) setMsg(null);
  }

  function insertVariable(kind: ClientMailKind, key: string) {
    const token = `{${key}}`;
    const field = lastField.current;
    const el = field === 'subject' ? subjectRef.current : bodyRef.current;
    const value = drafts[kind][field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setDraft(kind, { [field]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(kind: ClientMailKind) {
    const draft = { subject: drafts[kind].subject.trim(), body: drafts[kind].body.trim() };
    if (!draft.subject || !draft.body) {
      setMsg({ kind, msg: { type: 'error', text: 'L\'objet et le message ne peuvent pas être vides.' } });
      return;
    }
    if (draft.subject.length > SUBJECT_MAX || draft.body.length > BODY_MAX) {
      setMsg({ kind, msg: { type: 'error', text: `Texte trop long (objet : ${SUBJECT_MAX} caractères, message : ${BODY_MAX}).` } });
      return;
    }
    setSaving(kind);
    try {
      // Relu juste avant l'écriture : un autre e-mail enregistré entre-temps n'est pas écrasé.
      const next = { ...(await readOverrides()) };
      if (same(draft, DEFAULT_MAIL_TEXTS[kind])) delete next[kind];
      else next[kind] = draft;
      const { error } = await supabase
        .from('settings')
        .upsert({ key: SETTING_KEY, value: JSON.stringify(next) }, { onConflict: 'key' });
      if (error) throw new Error(error.message);
      setSaved(next);
      setDrafts((d) => ({ ...d, [kind]: draft }));
      setMsg({ kind, msg: { type: 'success', text: 'Enregistré : les prochains e-mails utiliseront ce texte.' } });
    } catch (e) {
      setMsg({ kind, msg: { type: 'error', text: e instanceof Error ? e.message : 'Enregistrement impossible.' } });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {loadError && <Callout tone="danger">{loadError}</Callout>}

      <p className="text-[14px] sm:text-sm text-stone-600 font-light">
        Les mots entre accolades, comme <code className="text-stone-800">{'{prenom}'}</code>, sont remplacés
        automatiquement. <code className="text-stone-800">**texte**</code> met en gras, un <code className="text-stone-800"># </code> en
        début de paragraphe en fait un titre, et une ligne vide sépare deux paragraphes.
      </p>

      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200">
        {CLIENT_MAILS.map(({ kind, label, when }) => {
          const draft = drafts[kind];
          const isOpen = open === kind;
          const custom = !!saved[kind];
          const dirty = !same(draft, mailTextFor(kind, saved));
          const unknown = isOpen ? unknownVariables(`${draft.subject} ${draft.body}`) : [];
          const rendered = isOpen && preview ? renderClientMail(kind, draft, sample.b, biz, sample.previous) : null;

          return (
            <li key={kind}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : kind)}
                aria-expanded={isOpen}
                className="flex w-full min-h-12 items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] sm:text-sm font-semibold text-stone-900">
                    {label}
                    {custom && <span className="ml-2 bg-accent/10 px-2 py-0.5 text-[12px] font-medium text-accent rounded">Personnalisé</span>}
                    {dirty && <span className="ml-2 bg-amber-100 px-2 py-0.5 text-[12px] font-medium text-amber-800 rounded">Non enregistré</span>}
                  </span>
                  <span className="block text-[13px] text-stone-500">{when}</span>
                </span>
                <ChevronDown size={18} className={`shrink-0 text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-stone-100 px-4 pb-5 pt-4">
                  <div className="space-y-1">
                    <label htmlFor={`mail-subject-${kind}`} className="block text-[14px] lg:text-xs font-semibold text-stone-700">Objet</label>
                    <input
                      id={`mail-subject-${kind}`}
                      ref={subjectRef}
                      type="text"
                      maxLength={SUBJECT_MAX}
                      value={draft.subject}
                      onFocus={() => (lastField.current = 'subject')}
                      onChange={(e) => setDraft(kind, { subject: e.target.value })}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`mail-body-${kind}`} className="block text-[14px] lg:text-xs font-semibold text-stone-700">Message</label>
                    <textarea
                      id={`mail-body-${kind}`}
                      ref={bodyRef}
                      rows={14}
                      maxLength={BODY_MAX}
                      value={draft.body}
                      onFocus={() => (lastField.current = 'body')}
                      onChange={(e) => setDraft(kind, { body: e.target.value })}
                      className="w-full text-sm leading-relaxed px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[13px] lg:text-[11px] font-semibold text-stone-600">Insérer un mot-clé (à l&apos;endroit du curseur)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {MAIL_VARIABLES.filter((v) => !v.only || v.only.includes(kind)).map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          title={v.label}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertVariable(kind, v.key)}
                          className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[13px] lg:text-[11px] text-stone-700 hover:bg-stone-100"
                        >
                          {v.label} <span className="font-mono text-stone-500">{`{${v.key}}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {unknown.length > 0 && (
                    <Callout tone="warning" title="Mot-clé inconnu">
                      {`${unknown.join(', ')} ne ${unknown.length > 1 ? 'seront' : 'sera'} pas remplacé${unknown.length > 1 ? 's' : ''}. Vérifiez l'orthographe, ou choisissez un mot-clé dans la liste.`}
                    </Callout>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" icon={Save} loading={saving === kind} disabled={!!saving || !dirty} onClick={() => save(kind)}>
                      Enregistrer
                    </Button>
                    <Button
                      variant="ghost"
                      icon={RotateCcw}
                      disabled={!!saving || same(draft, DEFAULT_MAIL_TEXTS[kind])}
                      onClick={() => setDraft(kind, DEFAULT_MAIL_TEXTS[kind])}
                    >
                      Texte d&apos;origine
                    </Button>
                    <Button variant="ghost" icon={preview ? EyeOff : Eye} onClick={() => setPreview((p) => !p)}>
                      {preview ? 'Masquer l\'aperçu' : 'Voir l\'aperçu'}
                    </Button>
                  </div>
                  <FormMessage message={msg?.kind === kind ? msg.msg : null} />

                  {rendered && (
                    <div className="space-y-2">
                      <div className="text-[13px] lg:text-[11px] font-semibold text-stone-600">
                        Aperçu, avec une cliente fictive
                      </div>
                      <div className="rounded-xl bg-stone-50">
                        <div className="border-b border-stone-100 px-4 py-2.5 text-[14px] text-stone-800">
                          <span className="text-stone-500">Objet : </span>
                          {rendered.subject}
                        </div>
                        {/* Rendu maison : tout texte saisi y est échappé (utils/bookingEmails.ts). */}
                        <div className="px-4 py-4" dangerouslySetInnerHTML={{ __html: rendered.html }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
