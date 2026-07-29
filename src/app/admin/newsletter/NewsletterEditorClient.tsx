"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import { supabase } from '../../../services/supabase';
import { Send, Eye, EyeOff, Users, CheckCircle, XCircle, Loader } from 'lucide-react';

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
    <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Aperçu (mail normal)</span>
        {subject && <span className="text-xs text-stone-400 truncate">— {subject}</span>}
      </div>
      <div className="overflow-auto max-h-[600px] bg-white">
        <iframe srcDoc={full} title="Aperçu newsletter" className="w-full border-none" style={{ height: 600 }} />
      </div>
    </div>
  );
}

export default function NewsletterEditor() {
  const [subject, setSubject]             = useState('');
  const [html, setHtml]                   = useState('');
  const [testEmail, setTestEmail]         = useState('');
  const [showPreview, setShowPreview]     = useState(true);
  const [status, setStatus]               = useState<SendStatus>('idle');
  const [result, setResult]               = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [confirm, setConfirm]             = useState(false);
  const [history, setHistory]             = useState<Newsletter[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => { fetchHistory(); fetchCount(); }, []);

  const fetchHistory = async () => { const { data } = await supabase.from('newsletters').select('*').order('created_at', { ascending: false }).limit(20); setHistory(data || []); };
  const fetchCount = async () => { const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('active', true); setSubscriberCount(count ?? 0); };
  const getToken = async () => { const { data } = await supabase.auth.getSession(); return data.session?.access_token || ''; };

  const send = async (isTest: boolean) => {
    if (!subject.trim() || !html.trim()) return;
    if (isTest && !testEmail.trim()) return;
    setStatus('sending'); setResult(null); setConfirm(false);
    try {
      const token = await getToken();
      const res = await fetch('/api/send-newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subject, html, ...(isTest ? { testEmail } : {}) }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ sent: data.sent, failed: data.failed, total: data.total ?? data.sent });
      setStatus('done');
      if (!isTest) { fetchHistory(); fetchCount(); }
    } catch { setStatus('error'); }
  };

  const modules = useMemo(() => ({ toolbar: { container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link'], ['clean']] } }), []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Audience</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5"><Send size={20} className="text-sage" /> Composer une newsletter</h1>
          <p className="text-stone-400 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
            <Users size={12} />
            {subscriberCount === null ? '…' : `${subscriberCount} abonné${subscriberCount !== 1 ? 's' : ''} actif${subscriberCount !== 1 ? 's' : ''}`}
            <span className="text-stone-200">·</span>
            <Link href="/admin/subscribers" className="text-sage hover:text-sage/70 transition-colors">Gérer les abonnés</Link>
          </p>
        </div>
        <button onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-300 px-3 py-2 rounded-lg transition-all cursor-pointer shrink-0">
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPreview ? 'Masquer aperçu' : 'Voir aperçu'}
        </button>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-stone-400">Objet de l'email</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex : Une nouvelle réflexion sur le silence intérieur…"
              className="w-full px-4 py-3 border border-stone-200 bg-white rounded-xl text-sm text-stone-800 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all shadow-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-stone-400">Contenu</label>
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm [&_.ql-editor]:text-[17px] [&_.ql-editor]:leading-relaxed">
              <ReactQuill theme="snow" value={html} onChange={setHtml} modules={modules} className="mb-12 font-sans" placeholder="Écrivez votre newsletter…" />
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="votre@email.com (test)"
                className="flex-1 px-4 py-2.5 border border-stone-200 bg-white rounded-lg text-sm placeholder:text-stone-300 focus:border-sage outline-none transition-all" />
              <button onClick={() => send(true)} disabled={status === 'sending' || !subject || !html || !testEmail}
                className="px-4 py-2.5 border border-sage text-sage text-xs font-semibold rounded-lg hover:bg-sage hover:text-white transition-colors disabled:opacity-40 cursor-pointer">
                Test
              </button>
            </div>
            {!confirm ? (
              <button onClick={() => setConfirm(true)} disabled={status === 'sending' || !subject || !html}
                className="w-full flex items-center justify-center gap-2 bg-sage text-white py-3.5 text-sm font-medium rounded-xl hover:bg-sage/80 transition-colors disabled:opacity-40 cursor-pointer shadow-sm">
                {status === 'sending' ? <><Loader size={15} className="animate-spin" /> Envoi en cours…</> : <><Send size={15} /> Envoyer à {subscriberCount ?? '…'} abonnés</>}
              </button>
            ) : (
              <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-700">Confirmer l'envoi à <strong>{subscriberCount}</strong> abonné{subscriberCount !== 1 ? 's' : ''} ? Cette action est irréversible.</p>
                <div className="flex gap-2">
                  <button onClick={() => send(false)} className="flex-1 bg-red-600 text-white py-2.5 text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors cursor-pointer">Confirmer</button>
                  <button onClick={() => setConfirm(false)} className="flex-1 border border-stone-200 text-stone-600 py-2.5 text-xs font-semibold rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">Annuler</button>
                </div>
              </div>
            )}
            {status === 'done' && result && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                <CheckCircle size={15} className="shrink-0" />
                {result.sent} email{result.sent !== 1 ? 's' : ''} envoyé{result.sent !== 1 ? 's' : ''}{result.failed > 0 && `, ${result.failed} échec${result.failed !== 1 ? 's' : ''}`}.
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <XCircle size={15} className="shrink-0" /> Une erreur s'est produite. Vérifiez la configuration SMTP.
              </div>
            )}
          </div>
        </div>
        {showPreview && <EmailPreview subject={subject} html={html} />}
      </div>

      {history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 pb-2 border-b border-stone-100">Newsletters envoyées</h2>
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="text-left px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Objet</th>
                <th className="text-left px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 hidden sm:table-cell">Date</th>
                <th className="text-left px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Envoyés</th>
                <th className="text-left px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 hidden sm:table-cell">Échecs</th>
              </tr></thead>
              <tbody>{history.map(n => (
                <tr key={n.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-stone-900 truncate max-w-xs">{n.subject}</td>
                  <td className="px-6 py-4 text-stone-400 text-xs hidden sm:table-cell">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td className="px-6 py-4"><span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs"><CheckCircle size={12} /> {n.sent_count}</span></td>
                  <td className="px-6 py-4 hidden sm:table-cell">{n.failed_count > 0 ? <span className="text-red-400 font-semibold text-xs">{n.failed_count}</span> : <span className="text-stone-200 text-xs">0</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
