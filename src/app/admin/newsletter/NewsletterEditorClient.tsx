"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import { supabase } from '../../../services/supabase';
import { Send, Eye, EyeOff, Users } from 'lucide-react';
import { Button, Callout, Card, CardBody, CardHeader, Field, Input, PageHeader } from '../../../components/admin/ui';

import { SITE_CONFIG } from '../../../config/site';

interface Newsletter { id: string; subject: string; sent_count: number; failed_count: number; created_at: string; }
type SendStatus = 'idle' | 'sending' | 'done' | 'error';

function EmailPreview({ subject, html }: { subject: string; html: string }) {
  const full = `
    <style>
      body{margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.7;color:#1c1917}
      .container{max-width:600px;margin:0 auto;padding:24px 20px}
      p{margin:0 0 18px 0}
      a{color:#2563eb;text-decoration:underline}
      .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5}
      .footer a{color:#6b7280;text-decoration:underline}
    </style>
    <div class="container">
      <div>${html || '<p style="color:#9ca3af;font-style:italic">Le contenu apparaîtra ici…</p>'}</div>
      <div class="footer">
        Vous recevez cet email car vous êtes inscrit à la newsletter de ${SITE_CONFIG.url.replace(/^https?:\/\//i, '')}.<br/>
        <a href="#">Se désinscrire</a>
      </div>
    </div>`;
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-200 bg-stone-50/50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-stone-800 shrink-0">Aperçu</span>
        {subject && <span className="truncate text-[13px] text-stone-700">{subject}</span>}
      </div>
      <div className="overflow-auto max-h-[600px] bg-white">
        <iframe srcDoc={full} title="Aperçu newsletter" className="w-full border-none" style={{ height: 600 }} />
      </div>
    </div>
  );
}

/** Texte visible d'un contenu HTML : un éditeur vide renvoie « <p><br></p> », qui n'est pas vide pour autant. */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}

export default function NewsletterEditor() {
  const [subject, setSubject]             = useState('');
  const [html, setHtml]                   = useState('');
  const [testEmail, setTestEmail]         = useState('');
  const [showPreview, setShowPreview]     = useState(true);
  const [status, setStatus]               = useState<SendStatus>('idle');
  const [result, setResult]               = useState<{ sent: number; failed: number; total: number; isTest: boolean } | null>(null);
  const [errorText, setErrorText]         = useState('');
  const [confirm, setConfirm]             = useState(false);
  const [history, setHistory]             = useState<Newsletter[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => { fetchHistory(); fetchCount(); }, []);

  const fetchHistory = async () => { const { data } = await supabase.from('newsletters').select('*').order('created_at', { ascending: false }).limit(20); setHistory(data || []); };
  const fetchCount = async () => { const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('active', true); setSubscriberCount(count ?? 0); };
  const getToken = async () => { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ''; };

  const hasContent = subject.trim() !== '' && plainText(html) !== '';
  const alreadySent = history.find(n => n.subject.trim().toLowerCase() === subject.trim().toLowerCase() && subject.trim() !== '');
  const plural = (n: number | null) => (n !== null && n > 1 ? 's' : '');

  const send = async (isTest: boolean) => {
    if (!hasContent) return;
    if (isTest && !testEmail.trim()) return;
    setStatus('sending'); setResult(null); setErrorText(''); setConfirm(false);
    try {
      const token = await getToken();
      const res = await fetch('/api/send-newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subject, html, ...(isTest ? { testEmail } : {}) }) });
      const data = await res.json().catch(() => ({ error: "Le serveur a renvoyé une réponse illisible." }));
      if (!res.ok || data.error) throw new Error(data.error || `Erreur ${res.status}`);
      setResult({ sent: data.sent, failed: data.failed, total: data.total ?? data.sent, isTest });
      setStatus('done');
      if (!isTest) { fetchHistory(); fetchCount(); }
    } catch (e: any) {
      setErrorText(e?.message || '');
      setStatus('error');
    }
  };

  const modules = useMemo(() => ({ toolbar: { container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link'], ['clean']] } }), []);

  const sending = status === 'sending';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Newsletter"
        description={
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            <Users size={15} className="text-stone-600" aria-hidden="true" />
            {subscriberCount === null ? 'Comptage des abonnés…' : `${subscriberCount} abonné${plural(subscriberCount)} actif${plural(subscriberCount)}`}
            <span className="text-stone-400" aria-hidden="true">·</span>
            <Link href="/admin/subscribers" className="text-accent font-medium hover:underline">Gérer les abonnés</Link>
          </span>
        }
        actions={
          <Button variant="ghost" icon={showPreview ? EyeOff : Eye} onClick={() => setShowPreview(v => !v)} aria-pressed={showPreview}>
            {showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
          </Button>
        }
      />

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-5 min-w-0">
          <Field label="Objet de l'e-mail" htmlFor="nl-subject">
            <Input id="nl-subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="ex : Vos soins pour préparer la peau à l'hiver" />
          </Field>
          <div className="space-y-1.5">
            <p className="block text-[14px] font-semibold text-stone-900" id="nl-content-label">Contenu</p>
            <div aria-labelledby="nl-content-label" className="bg-white border border-stone-300 rounded-lg overflow-hidden [&_.ql-editor]:text-[16px] [&_.ql-editor]:leading-relaxed [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-stone-200 [&_.ql-container]:border-0">
              <ReactQuill theme="snow" value={html} onChange={setHtml} modules={modules} className="font-sans" placeholder="Écrivez votre newsletter…" />
            </div>
          </div>

          <Card>
            <CardBody className="space-y-5">
              <Field label="S'envoyer un e-mail de test" htmlFor="nl-test" hint="Recevez la newsletter dans votre boîte avant de l'envoyer à tout le monde.">
                <div className="flex gap-2">
                  <Input id="nl-test" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="votre@adresse.ch" className="flex-1 min-w-0" />
                  <Button variant="secondary" onClick={() => send(true)} disabled={sending || !hasContent || !testEmail.trim()}>
                    Envoyer le test
                  </Button>
                </div>
              </Field>

              <div className="border-t border-stone-200 pt-5">
                {!confirm ? (
                  <Button
                    variant="primary"
                    icon={Send}
                    loading={sending}
                    onClick={() => setConfirm(true)}
                    disabled={sending || !hasContent || !subscriberCount}
                    className="w-full"
                  >
                    {sending ? 'Envoi en cours…' : `Envoyer à ${subscriberCount ?? '…'} abonné${plural(subscriberCount)}`}
                  </Button>
                ) : (
                  <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3" role="alertdialog" aria-labelledby="nl-confirm-text">
                    <p id="nl-confirm-text" className="text-[14px] text-red-900">
                      Envoyer « {subject} » à <strong>{subscriberCount}</strong> abonné{plural(subscriberCount)} ? Un e-mail envoyé ne peut pas être rappelé.
                    </p>
                    {alreadySent && (
                      <p className="text-[13px] text-red-900">
                        Attention : une newsletter avec le même objet a déjà été envoyée le {new Date(alreadySent.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => send(false)} className="h-10 px-4 bg-red-700 text-white text-[14px] font-semibold rounded-lg hover:bg-red-800 transition-colors cursor-pointer">Oui, envoyer maintenant</button>
                      <Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button>
                    </div>
                  </div>
                )}
                {!hasContent && (
                  <p className="mt-2 text-[13px] text-stone-600">Renseignez l&apos;objet et le contenu pour pouvoir envoyer.</p>
                )}
                {hasContent && subscriberCount === 0 && (
                  <p className="mt-2 text-[13px] text-stone-600">Aucun abonné actif pour l&apos;instant : l&apos;envoi est désactivé.</p>
                )}
              </div>

              {status === 'done' && result && (
                <Callout tone={result.failed > 0 ? 'warning' : 'success'}>
                  {result.isTest
                    ? `E-mail de test envoyé à ${testEmail.trim()}.`
                    : `${result.sent} e-mail${result.sent > 1 ? 's' : ''} envoyé${result.sent > 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} non parvenu${result.failed > 1 ? 's' : ''} (adresses à vérifier dans la liste des abonnés)` : ''}.`}
                </Callout>
              )}
              {status === 'error' && (
                <div role="alert">
                  <Callout tone="danger">
                    L&apos;envoi n&apos;a pas abouti{errorText ? ` : ${errorText}` : '.'} Réessayez dans un instant ; si le problème continue, vérifiez les réglages d&apos;envoi d&apos;e-mails.
                  </Callout>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        {showPreview && <EmailPreview subject={subject} html={html} />}
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader title="Newsletters envoyées" description="Les 20 derniers envois." />
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead><tr className="border-b border-stone-200 bg-stone-50">
                <th scope="col" className="text-left px-6 py-3 text-[13px] font-semibold text-stone-700">Objet</th>
                <th scope="col" className="text-left px-6 py-3 text-[13px] font-semibold text-stone-700 hidden sm:table-cell">Date</th>
                <th scope="col" className="text-left px-6 py-3 text-[13px] font-semibold text-stone-700">Envoyés</th>
                <th scope="col" className="text-left px-6 py-3 text-[13px] font-semibold text-stone-700 hidden sm:table-cell">Échecs</th>
              </tr></thead>
              <tbody className="divide-y divide-stone-200">{history.map(n => (
                <tr key={n.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-stone-900 truncate max-w-xs">{n.subject}</td>
                  <td className="px-6 py-3.5 text-stone-700 text-[13px] hidden sm:table-cell whitespace-nowrap">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td className="px-6 py-3.5 text-stone-900 tabular-nums">{n.sent_count}</td>
                  <td className="px-6 py-3.5 hidden sm:table-cell tabular-nums">{n.failed_count > 0 ? <span className="text-red-700 font-semibold">{n.failed_count}</span> : <span className="text-stone-600">0</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
