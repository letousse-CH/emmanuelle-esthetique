"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../services/supabase';
import { Article } from '../../../types/blog';
import {
  ArrowLeft, Save, Image as ImageIcon, Sparkles, Wand2, X,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, FileText,
  Clock, Globe, Target, PenLine, Search, Cpu, CalendarClock, Youtube,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as any;
import { SITE_CONFIG } from '../../../config/site';
import MediaLibrary from '../../../components/MediaLibrary';
import SeoAnalyzer from '../../../components/SeoAnalyzer';
import { SeoIdea, CATEGORIES } from '../../../data/seoIdeas';
import { injectInternalLinks } from '../../../utils/internalLinks';
import { sanitizeEditorHtml } from '../../../utils/sanitizeHtml';
import SocialContentGenerator from '../../../components/admin/SocialContentGenerator';
import { useModuleFlags } from '../../../hooks/useModuleFlags';

const safeSanitize = (html: string): string => {
  if (typeof window !== 'undefined') {
    const DOMPurifyInstance = typeof DOMPurify === 'function' ? (DOMPurify as any)(window) : DOMPurify;
    return DOMPurifyInstance?.sanitize ? DOMPurifyInstance.sanitize(html) : html;
  }
  return html;
};

type PublishMode = 'draft' | 'scheduled' | 'published';
type TabId = 'redaction' | 'seo' | 'ia' | 'programmation';

function extractYouTubeEmbedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Si l'utilisateur colle un code d'intégration <iframe>, on récupère son src
  const iframeMatch = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  const raw = iframeMatch ? iframeMatch[1] : trimmed;

  let url: URL;
  try {
    url = new URL(raw, 'https://www.youtube.com');
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) return null;

  let videoId = '';
  if (url.hostname.includes('youtu.be')) {
    videoId = url.pathname.slice(1);
  } else if (url.pathname.startsWith('/embed/')) {
    videoId = url.pathname.replace('/embed/', '');
  } else if (url.pathname.startsWith('/shorts/')) {
    videoId = url.pathname.replace('/shorts/', '');
  } else {
    videoId = url.searchParams.get('v') || '';
  }
  videoId = videoId.split('/')[0];
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

  const start = url.searchParams.get('start') || url.searchParams.get('t');
  const startSeconds = start ? parseInt(start.replace(/\D/g, ''), 10) : 0;

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  return startSeconds ? `${embedUrl}?start=${startSeconds}` : embedUrl;
}

function normalizeForSeo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, "'");
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'ia',           label: 'Génération IA', icon: Cpu          },
  { id: 'redaction',     label: 'Rédaction',    icon: PenLine      },
  { id: 'seo',          label: 'SEO',           icon: Search       },
  { id: 'programmation', label: 'Publication',  icon: CalendarClock },
];

export default function BlogEdit() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const searchParams = useSearchParams();
  const router = useRouter();
  const isEditing = Boolean(id);
  const moduleFlags = useModuleFlags();

  const preTitle = searchParams.get('title') || '';
  const preSlug  = searchParams.get('slug')  || '';

  const [seoBrief] = useState<SeoIdea | null>(() => {
    if (isEditing) return null;
    try {
      const raw = sessionStorage.getItem('seoBrief');
      if (!raw) return null;
      sessionStorage.removeItem('seoBrief');
      return JSON.parse(raw) as SeoIdea;
    } catch { return null; }
  });

  const [loading, setLoading]               = useState(isEditing);
  const [saving, setSaving]                 = useState(false);
  const [otherArticles, setOtherArticles]   = useState<Array<{ title: string; slug: string }>>([]);
  const [activeTab, setActiveTab]           = useState<TabId>(isEditing ? 'redaction' : 'ia');
  const [generatingMeta, setGeneratingMeta] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaTarget, setMediaTarget]       = useState<'content' | 'cover'>('content');
  const [showBrief, setShowBrief]           = useState(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeInput, setYoutubeInput]     = useState('');
  const [youtubeError, setYoutubeError]     = useState('');

  const [aiStatus, setAiStatus]   = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [aiPreview, setAiPreview] = useState('');
  const [aiError, setAiError]     = useState('');
  const aiAccRef                  = useRef('');

  const [seoFoundKws, setSeoFoundKws]   = useState<string[]>([]);
  const analysisTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quillRef                        = React.useRef<any>(null);

  const [publishMode, setPublishMode] = useState<PublishMode>('published');
  const [scheduledAt, setScheduledAt] = useState('');

  const [formData, setFormData] = useState<Partial<Article>>({
    title:            preTitle || seoBrief?.suggestedTitle || '',
    slug:             preSlug  || seoBrief?.suggestedSlug  || '',
    content:          '',
    cover_image:      '',
    meta_title:       preTitle || seoBrief?.suggestedTitle || '',
    meta_description: '',
    meta_keywords:    '',
    category:         seoBrief?.category || '',
    published:        true,
    scheduled_at:     null,
  });

  useEffect(() => {
    supabase.from('articles').select('title, slug').eq('published', true)
      .then(({ data }) => { if (data) setOtherArticles(data); });
  }, []);

  useEffect(() => {
    if (isEditing) fetchArticle();
  }, [id]);

  useEffect(() => {
    if (!showYoutubeModal) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowYoutubeModal(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showYoutubeModal]);

  useEffect(() => {
    const keywords = seoBrief?.secondaryKeywords;
    if (!keywords?.length) return;
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    analysisTimerRef.current = setTimeout(() => {
      const plain = (formData.content || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ');
      const normalized = normalizeForSeo(plain);
      setSeoFoundKws(keywords.filter(kw => normalized.includes(normalizeForSeo(kw))));
    }, 500);
    return () => { if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current); };
  }, [formData.content, seoBrief?.secondaryKeywords]);

  const fetchArticle = async () => {
    const { data, error } = await supabase
      .from('articles').select('*').eq('id', id).single();
    if (data && !error) {
      setFormData(data);
      if (data.published) {
        setPublishMode('published');
      } else if (data.scheduled_at) {
        setPublishMode('scheduled');
        setScheduledAt(data.scheduled_at.slice(0, 16));
      } else {
        setPublishMode('draft');
      }
    } else {
      alert("Erreur lors du chargement de l'article.");
      router.push('/admin/blog');
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generateSlug = () => {
    if (formData.title) {
      const slug = formData.title
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setFormData(prev => ({ ...prev, slug }));
    }
  };

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const generateArticle = async () => {
    const kw = formData.slug?.replace(/-/g, ' ') || formData.title || '';
    const idea = seoBrief ?? {
      keyword: kw,
      question: '',
      suggestedTitle: formData.title || '',
      suggestedSlug: formData.slug || '',
      category: (formData.category || 'Rituels de soin') as any,
      intent: 'informationnel' as const,
      difficulty: 'moyen' as const,
      volume: 'moyen' as const,
      suggestedIntro: '',
      relatedQuestions: [],
      secondaryKeywords: [],
      /*
        Consignes volontairement génériques : « situations vécues en cabine »,
        « gestes, techniques et ingrédients » décrivaient le métier du site
        d'origine et orientaient la rédaction de n'importe quel autre site.
        L'activité réelle vient des réglages Éditorial & Marque, lus par la
        route de génération.
      */
      contentTips: [
        'Respecter scrupuleusement le ton de voix réglé dans Paramètres > Éditorial & Marque',
        'Ancrer le propos dans des situations concrètes vécues par le lecteur',
        'Inclure une méthode actionnable en étapes numérotées',
        'Nommer précisément les termes du métier, sans jargon inutile',
      ],
      cta: '',
      opportunity: '',
    };
    setAiStatus('generating');
    setAiPreview('');
    setAiError('');
    aiAccRef.current = '';

    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ idea }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'error') {
              throw new Error(parsed.message || 'Erreur de génération IA');
            }
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
              aiAccRef.current += parsed.delta.text;
              setAiPreview(aiAccRef.current);
            }
          } catch (parseErr: any) {
            if (parseErr?.message) throw parseErr; // rethrow errors, swallow parse failures
          }
        }
      }
      setAiStatus('done');
    } catch (err: any) {
      setAiError(err.message || 'Erreur inconnue');
      setAiStatus('error');
    }
  };

  const insertGeneratedContent = () => {
    if (!aiAccRef.current) return;
    setFormData(prev => ({ ...prev, content: aiAccRef.current }));
    setAiStatus('idle');
    setAiPreview('');
  };

  const generateMeta = async (overrides?: { content?: string }) => {
    if (!formData.title) return;
    setGeneratingMeta(true);
    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: formData.title, content: overrides?.content ?? formData.content ?? '' }),
      });
      const data = await res.json();
      if (data.meta_title || data.meta_description || data.meta_keywords) {
        setFormData(prev => ({
          ...prev,
          ...(data.meta_title       ? { meta_title: data.meta_title }             : {}),
          ...(data.meta_description ? { meta_description: data.meta_description } : {}),
          ...(data.meta_keywords    ? { meta_keywords: data.meta_keywords }       : {}),
        }));
      }
    } catch { /* silently ignore */ }
    finally { setGeneratingMeta(false); }
  };

  const pingIndexNow = async (slug: string) => {
    const url = `${SITE_CONFIG.url}/blog/${slug}`;
    try { await fetch(`https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${SITE_CONFIG.bingIndexNowKey}`); } catch { /* non-critical */ }
  };

  const revalidateBlog = async (slug?: string) => {
    try {
      const authHeaders = await getAuthHeader();
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ slug }),
      });
    } catch { /* non-critical */ }
  };

  const upsertSeoScore = async (articleId: string) => {
    if (!seoTotalKws || !seoBrief) return;
    await supabase.from('article_seo_scores').delete().eq('article_id', articleId);
    await supabase.from('article_seo_scores').insert({
      article_id:     articleId,
      focus_keyword:  seoBrief.keyword,
      keywords_found: seoFoundKws,
      keywords_total: seoTotalKws,
      score:          seoScore,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishMode === 'scheduled' && !scheduledAt) {
      alert('Veuillez choisir une date et heure de publication.'); return;
    }
    if (publishMode === 'scheduled' && new Date(scheduledAt) <= new Date()) {
      alert('La date de programmation doit être dans le futur.'); return;
    }
    setSaving(true);
    const linkedContent = sanitizeEditorHtml(injectInternalLinks(formData.content || '', otherArticles, formData.slug || ''));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = { ...formData, content: linkedContent } as Article;
    const payload = {
      ...rest,
      published:    publishMode === 'published',
      scheduled_at: publishMode === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
    };

    if (isEditing) {
      const { error } = await supabase.from('articles').update(payload).eq('id', id);
      if (error) { alert(`Erreur lors de l'enregistrement. Réessayez ou contactez le support.`); }
      else {
        await upsertSeoScore(id!);
        if (payload.published && payload.slug) pingIndexNow(payload.slug);
        await revalidateBlog(payload.slug);
        router.push('/admin/blog');
      }
    } else {
      const { data: newArticle, error } = await supabase.from('articles').insert([payload]).select('id').single();
      if (error) { alert(`Erreur lors de la création. Réessayez ou contactez le support.`); }
      else {
        await upsertSeoScore(newArticle.id);
        if (payload.published && payload.slug) pingIndexNow(payload.slug);
        await revalidateBlog(payload.slug);
        router.push('/admin/blog');
      }
    }
    setSaving(false);
  };

  const insertImage = (url: string, altText: string) => {
    setShowMediaLibrary(false);
    if (mediaTarget === 'cover') {
      setFormData(prev => ({ ...prev, cover_image: url }));
    } else if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection(true);
      editor.clipboard.dangerouslyPasteHTML(range.index, `<img src="${url}" alt="${altText}" />`);
      editor.setSelection(range.index + 1);
    }
  };

  const insertYouTubeVideo = () => {
    setYoutubeInput('');
    setYoutubeError('');
    setShowYoutubeModal(true);
  };

  const confirmYoutubeInsert = () => {
    const embedUrl = extractYouTubeEmbedUrl(youtubeInput);
    if (!embedUrl) {
      setYoutubeError("Vidéo YouTube non reconnue. Collez un lien YouTube (ex : https://youtu.be/xxxx) ou le code d'intégration <iframe> fourni par YouTube.");
      return;
    }
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection(true);
      editor.insertEmbed(range.index, 'video', embedUrl, 'user');
      editor.setSelection(range.index + 1, 0, 'user');
    }
    setShowYoutubeModal(false);
  };

  const modules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [2, 3, 4, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['blockquote', 'link'],
        ['clean'],
      ]
    }
  }), []);

  const seoKeywords = seoBrief?.secondaryKeywords ?? [];
  const seoTotalKws = seoKeywords.length;
  const seoScore    = seoTotalKws > 0 ? Math.round((seoFoundKws.length / seoTotalKws) * 100) : 0;

  const wordCount = (() => {
    const text = (formData.content || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  })();

  const saveButtonClass = publishMode === 'published'
    ? 'bg-sage text-white hover:bg-stone-900'
    : publishMode === 'scheduled'
    ? 'bg-amber-500 text-white hover:bg-amber-600'
    : 'bg-stone-700 text-white hover:bg-stone-900';

  const saveButtonLabel = saving ? 'Enregistrement…'
    : publishMode === 'published' ? 'Publier'
    : publishMode === 'scheduled' ? 'Programmer'
    : 'Sauvegarder';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-screen">

      {/* ── Topbar sticky ─────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-stone-100 shadow-sm">
        <div className="flex items-center gap-3 px-6 h-14">
          <Link href="/admin/blog" className="shrink-0 text-stone-500 hover:text-stone-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              name="title"
              required
              value={formData.title || ''}
              onChange={handleChange}
              onBlur={() => !isEditing && !formData.slug && generateSlug()}
              placeholder="Titre de l'article…"
              className="w-full text-base font-medium text-stone-900 bg-transparent border-none outline-none placeholder:text-stone-400 truncate"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full ${
              publishMode === 'published' ? 'bg-green-50 text-green-700'
              : publishMode === 'scheduled' ? 'bg-amber-50 text-amber-700'
              : 'bg-stone-100 text-stone-500'
            }`}>
              {publishMode === 'published' ? <Globe size={10} /> : publishMode === 'scheduled' ? <Clock size={10} /> : <FileText size={10} />}
              {publishMode === 'published' ? 'Publié' : publishMode === 'scheduled' ? 'Programmé' : 'Brouillon'}
            </span>

            {seoBrief && (
              <Link
                href="/admin/seo"
                className="hidden md:flex items-center gap-1.5 text-[12px] bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-bold"
              >
                💡 Brief SEO
              </Link>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-extrabold rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white shadow-[0_4px_14px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span className="hidden sm:inline">{saveButtonLabel}</span>
            </button>
          </div>
        </div>

        {/* Slug row */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <span className="text-[12.5px] text-stone-500">{SITE_CONFIG.url.replace(/^https?:\/\//i, '')}/blog/</span>
          <input
            type="text"
            name="slug"
            required
            value={formData.slug || ''}
            onChange={handleChange}
            className="flex-1 text-[11px] font-mono px-2 py-0.5 border border-stone-200 focus:border-stone-900 rounded outline-none bg-stone-50 focus:bg-white lowercase max-w-xs"
          />
          <button type="button" onClick={generateSlug} className="text-[12px] text-sage hover:underline font-bold">
            Générer
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-stone-100">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  isActive
                    ? 'border-stone-900 text-stone-900 bg-sage/5'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ════ ONGLET RÉDACTION ════ */}
        {activeTab === 'redaction' && (
          <div className="space-y-6">

            {/* Cover + catégorie */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 space-y-3">
                <h3 className="text-[13px] font-medium text-stone-800">Image de couverture</h3>
                {formData.cover_image ? (
                  <div className="relative group">
                    <img src={formData.cover_image} alt="Couverture" className="w-full aspect-video object-cover rounded-xl border border-stone-100" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cover_image: '' }))}
                      className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-white rounded-full p-1 shadow-md text-stone-500 hover:text-red-500 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center">
                    <ImageIcon size={24} className="text-stone-500" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="cover_image"
                    value={formData.cover_image || ''}
                    onChange={handleChange}
                    placeholder="https://…"
                    className="flex-1 px-3 py-2 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-lg outline-none bg-stone-50 focus:bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                    className="shrink-0 p-2 border border-stone-200 rounded-lg text-stone-500 hover:text-stone-900 hover:border-sage transition-colors"
                  >
                    <ImageIcon size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 space-y-3">
                <h3 className="text-[13px] font-medium text-stone-800">Catégorie</h3>
                <select
                  name="category"
                  value={formData.category || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-lg outline-none bg-stone-50 focus:bg-white text-sm"
                >
                  <option value="">— Choisir une catégorie —</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <div className="pt-2 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-xs font-bold tabular-nums ${
                      wordCount === 0 ? 'text-stone-500'
                      : wordCount >= 2000 && wordCount <= 2800 ? 'text-green-600'
                      : wordCount >= 1500 ? 'text-orange-500'
                      : 'text-red-500'
                    }`}>
                      {wordCount.toLocaleString('fr-FR')} mots
                    </span>
                    <span className="text-[12px] text-stone-500">Cible : 2000–2800</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        wordCount >= 2000 && wordCount <= 2800 ? 'bg-green-400'
                        : wordCount >= 1500 ? 'bg-orange-400'
                        : wordCount > 0 ? 'bg-red-400'
                        : 'bg-stone-200'
                      }`}
                      style={{ width: `${Math.min((wordCount / 2800) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Éditeur */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                <h2 className="text-[13px] font-medium text-stone-800">Contenu</h2>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={insertYouTubeVideo}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-stone-900 transition-colors"
                  >
                    <Youtube size={13} /> Vidéo YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMediaTarget('content'); setShowMediaLibrary(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-sage hover:text-stone-900 transition-colors"
                  >
                    <ImageIcon size={13} /> Insérer un média
                  </button>
                </div>
              </div>
              <div className="p-2">
                <ReactQuill
                  ref={(el: any) => { if (el) quillRef.current = el; }}
                  theme="snow"
                  value={formData.content || ''}
                  onChange={(val: string) => setFormData(prev => ({ ...prev, content: val }))}
                  modules={modules}
                  useSemanticHTML={false}
                  className="mb-12 font-sans"
                />
              </div>
            </div>
          </div>
        )}

        {/* ════ ONGLET SEO ════ */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Search size={15} className="text-sage" /> Balises méta
                </h2>
                <button
                  type="button"
                  onClick={() => generateMeta()}
                  disabled={generatingMeta || !formData.title}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sage/10 hover:bg-sage/20 text-sage font-bold text-[12px] rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={12} className={generatingMeta ? 'animate-spin' : ''} />
                  {generatingMeta ? 'Génération…' : 'Générer avec l\'IA'}
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="meta_title" className="text-[13px] font-medium text-stone-800">Meta Titre</label>
                  {(() => {
                    const len = (formData.meta_title || '').length;
                    return <span className={`text-xs font-bold tabular-nums ${len === 0 ? 'text-stone-500' : len <= 60 ? 'text-green-500' : 'text-red-500'}`}>{len}/60</span>;
                  })()}
                </div>
                <input
                  id="meta_title" type="text" name="meta_title" maxLength={70}
                  value={formData.meta_title || ''} onChange={handleChange}
                  placeholder="Titre Google…"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm"
                />
                <div className="w-full bg-stone-100 rounded-full h-0.5">
                  <div className={`h-0.5 rounded-full transition-all ${(formData.meta_title || '').length <= 60 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(((formData.meta_title || '').length / 60) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="meta_description" className="text-[13px] font-medium text-stone-800">Meta Description</label>
                  {(() => {
                    const len = (formData.meta_description || '').length;
                    return <span className={`text-xs font-bold tabular-nums ${
                      len === 0 ? 'text-stone-500' : len >= 150 && len <= 160 ? 'text-green-500' : len > 160 ? 'text-red-500' : 'text-orange-400'
                    }`}>{len}/160</span>;
                  })()}
                </div>
                <textarea
                  id="meta_description" name="meta_description" rows={3} maxLength={170}
                  value={formData.meta_description || ''} onChange={handleChange}
                  placeholder="Description Google & réseaux…"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm resize-none"
                />
                <div className="w-full bg-stone-100 rounded-full h-0.5">
                  <div className={`h-0.5 rounded-full transition-all ${
                    (formData.meta_description || '').length > 160 ? 'bg-red-400'
                    : (formData.meta_description || '').length >= 150 ? 'bg-green-400'
                    : 'bg-orange-300'
                  }`} style={{ width: `${Math.min(((formData.meta_description || '').length / 160) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="meta_keywords" className="text-[13px] font-medium text-stone-800">Mots-clés méta</label>
                <textarea
                  id="meta_keywords" name="meta_keywords" rows={2}
                  value={formData.meta_keywords || ''} onChange={handleChange}
                  placeholder="ex : rêve éveillé libre, alexithymie, empathie cognitive…"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm resize-none"
                />
                <p className="text-[12.5px] text-stone-500">Séparés par des virgules. Laissez vide pour utiliser la catégorie par défaut.</p>
              </div>
            </div>

            {/* SEO Cluster Checklist */}
            {seoTotalKws > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <Target size={15} className="text-sage" /> Cluster SEO
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold tabular-nums ${seoScore >= 75 ? 'text-green-600' : seoScore >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                      {seoScore}%
                    </span>
                    <span className="text-[12.5px] text-stone-500">{seoFoundKws.length}/{seoTotalKws}</span>
                  </div>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ${seoScore >= 75 ? 'bg-green-400' : seoScore >= 50 ? 'bg-orange-400' : 'bg-red-400'}`}
                    style={{ width: `${seoScore}%` }} />
                </div>
                <div>
                  <p className="text-[12.5px] font-medium text-stone-700 mb-1">Requête focus</p>
                  <p className="font-mono text-xs bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-lg text-stone-700">🔍 {seoBrief!.keyword}</p>
                </div>
                <div>
                  <p className="text-[12.5px] font-medium text-stone-700 mb-2">Mots-clés secondaires</p>
                  <div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                    {seoKeywords.map((kw, i) => {
                      const found = seoFoundKws.includes(kw);
                      return (
                        <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors ${found ? 'bg-green-50 text-green-700' : 'bg-stone-50 text-stone-500'}`}>
                          <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[11.5px] font-bold ${found ? 'bg-green-500 text-white' : 'bg-stone-200'}`}>
                            {found ? '✓' : ''}
                          </span>
                          <span className="font-mono truncate">{kw}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <SeoAnalyzer formData={formData} setFormData={setFormData} initialKeyword={seoBrief?.keyword} />
          </div>
        )}

        {/* ════ ONGLET GÉNÉRATION IA ════ */}
        {activeTab === 'ia' && (
          <div className="space-y-6">

            {/* Brief SEO */}
            {seoBrief && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Target size={15} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">Brief SEO</p>
                      <p className="text-[12.5px] text-stone-500 font-mono">{seoBrief.keyword}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBrief(b => !b)}
                    className="flex items-center gap-1 text-[12.5px] text-stone-500 hover:text-stone-700 transition-colors"
                  >
                    {showBrief ? <><ChevronUp size={13} /> Masquer</> : <><ChevronDown size={13} /> Voir le brief</>}
                  </button>
                </div>

                {showBrief && (
                  <div className="px-6 py-5 space-y-4 text-sm">

                    {/* Ligne 1 — keyword + catégorie */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Requête cible</p>
                        <p className="font-mono bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100 text-stone-700">🔍 {seoBrief.keyword}</p>
                      </div>
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Catégorie & intent</p>
                        <p className="text-stone-700">{seoBrief.category} — <span className="text-stone-500">{seoBrief.intent}</span>
                          {seoBrief.difficulty && <span className="ml-2 text-[12px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{seoBrief.difficulty}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Question reformulée */}
                    {seoBrief.question && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Question reformulée (H2 candidat)</p>
                        <p className="text-stone-700 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100 italic">{seoBrief.question}</p>
                      </div>
                    )}

                    {/* Opportunité éditoriale */}
                    {seoBrief.opportunity && (
                      <div>
                        <p className="text-[12px] font-bold text-amber-500 mb-1">Opportunité éditoriale</p>
                        <p className="text-stone-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl text-xs">{seoBrief.opportunity}</p>
                      </div>
                    )}

                    {/* Accroche suggérée */}
                    {seoBrief.suggestedIntro && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Accroche suggérée</p>
                        <p className="text-stone-600 italic bg-stone-50 px-3 py-2 rounded-xl border border-stone-100 text-xs leading-relaxed">"{seoBrief.suggestedIntro}"</p>
                      </div>
                    )}

                    {/* Cluster sémantique */}
                    {seoBrief.secondaryKeywords?.length ? (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-2">Cluster sémantique ({seoBrief.secondaryKeywords.length} termes)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {seoBrief.secondaryKeywords.map((kw, i) => (
                            <span key={i} className="text-[12px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{kw}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* PAA */}
                    {seoBrief.relatedQuestions.length > 0 && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-2">Questions Google (PAA)</p>
                        <ul className="space-y-1">
                          {seoBrief.relatedQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-stone-600 text-xs"><span className="text-sage mt-0.5">›</span> {q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conseils de rédaction */}
                    <div>
                      <p className="text-[12.5px] font-medium text-stone-700 mb-2">Conseils de rédaction</p>
                      <ul className="space-y-1">
                        {seoBrief.contentTips.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-stone-600 text-xs"><span className="text-wood mt-0.5">•</span> {t}</li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    <div>
                      <p className="text-[12.5px] font-medium text-stone-700 mb-1">CTA suggéré</p>
                      <p className="text-stone-600 italic bg-sage/5 px-3 py-2 rounded-xl border border-sage/10 text-xs">{seoBrief.cta}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Génération article */}
            {moduleFlags.ai_generation && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-100">
                  <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
                    <Wand2 size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      {seoBrief ? 'Rédaction IA — article complet' : 'Régénérer l\'article'}
                    </p>
                    <p className="text-[12.5px] text-stone-500">
                      {seoBrief ? `Basé sur le brief : ${seoBrief.keyword}` : 'Génère depuis le titre et la catégorie actuels'}
                    </p>
                  </div>
                </div>

              <div className="px-6 py-5">
                {aiStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={generateArticle}
                    className="flex items-center gap-3 bg-stone-900 hover:bg-stone-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
                  >
                    <Wand2 size={16} />
                    {isEditing ? 'Régénérer l\'article (~2400 mots)' : 'Générer l\'article complet (~2400 mots)'}
                  </button>
                )}

                {aiStatus === 'generating' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-stone-600">
                      <div className="w-4 h-4 rounded-full border-2 border-sage border-t-transparent animate-spin" />
                      <span>Rédaction en cours… <span className="text-stone-500 font-mono">{Math.round(aiPreview.length / 5)} mots</span></span>
                    </div>
                    {aiPreview && (
                      <div
                        className="max-h-80 overflow-y-auto bg-stone-50 border border-stone-100 rounded-xl p-4 text-sm text-stone-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: safeSanitize(aiPreview) }}
                      />
                    )}
                  </div>
                )}

                {aiStatus === 'done' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-bold">
                      <CheckCircle2 size={16} />
                      Article généré — {Math.round(aiAccRef.current.length / 5)} mots environ
                    </div>

                    <div
                      className="max-h-80 overflow-y-auto bg-stone-50 border border-stone-100 rounded-xl p-4 text-sm text-stone-700 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: safeSanitize(aiPreview) }}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { insertGeneratedContent(); setActiveTab('redaction'); }}
                        className="flex items-center gap-2 bg-sage text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-sage/90 transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        Insérer & aller à Rédaction
                      </button>
                      <button
                        type="button"
                        onClick={generateArticle}
                        className="flex items-center gap-2 bg-stone-100 text-stone-700 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors"
                      >
                        <Wand2 size={14} />
                        Régénérer
                      </button>
                    </div>
                  </div>
                )}

                {aiStatus === 'error' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600 text-sm font-bold">
                      <AlertCircle size={16} />
                      Erreur : {aiError}
                    </div>
                    <button type="button" onClick={generateArticle} className="text-xs text-stone-500 hover:text-stone-800 underline">
                      Réessayer
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Social Generator */}
            {moduleFlags.social && (
              formData.content ? (
                <SocialContentGenerator
                  title={formData.title || ''}
                  content={formData.content}
                  keyword={seoBrief?.keyword || ''}
                  coverImage={formData.cover_image || undefined}
                  sourceType="article"
                  sourceRef={id}
                />
              ) : (
                <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center">
                  <p className="text-stone-500 text-sm">Générez ou rédigez d'abord le contenu pour accéder à la génération de posts réseaux sociaux.</p>
                </div>
              )
            )}
          </div>
        )}

        {/* ════ ONGLET PROGRAMMATION ════ */}
        {activeTab === 'programmation' && (
          <div className="space-y-6 max-w-lg">
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 space-y-5">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 pb-3 border-b border-stone-100">
                <CalendarClock size={15} className="text-sage" /> Mode de publication
              </h2>

              <div className="flex flex-col gap-3">
                {([
                  { mode: 'draft',     icon: FileText,      label: 'Brouillon',  desc: 'Invisible sur le site',   color: 'text-stone-600', activeBg: 'bg-stone-100 border-stone-400'  },
                  { mode: 'scheduled', icon: Clock,         label: 'Programmé',  desc: 'Publication automatique', color: 'text-amber-600', activeBg: 'bg-amber-50 border-amber-400'   },
                  { mode: 'published', icon: Globe,         label: 'Publié',     desc: 'En ligne immédiatement',  color: 'text-sage',      activeBg: 'bg-sage/5 border-sage'          },
                ] as const).map(({ mode, icon: Icon, label, desc, color, activeBg }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPublishMode(mode)}
                    className={`flex items-center gap-4 px-5 py-4 border-2 rounded-xl transition-all text-left ${
                      publishMode === mode ? `${activeBg} ${color}` : 'border-stone-200 text-stone-600 hover:border-stone-200 bg-stone-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-none mb-1">{label}</p>
                      <p className="text-xs opacity-70">{desc}</p>
                    </div>
                    {publishMode === mode && <CheckCircle2 size={16} className="shrink-0" />}
                  </button>
                ))}
              </div>

              {publishMode === 'scheduled' && (
                <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <label className="text-[13px] font-medium text-amber-800 flex items-center gap-1.5">
                    <Clock size={12} /> Date et heure de publication
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2.5 border border-amber-300 focus:border-amber-500 rounded-lg outline-none bg-white text-stone-800 text-sm"
                  />
                  <p className="text-[11px] text-amber-600">Publication automatique (±10 min)</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 py-3.5 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 ${saveButtonClass}`}
              >
                {publishMode === 'published' ? <Globe size={15} /> : publishMode === 'scheduled' ? <Clock size={15} /> : <FileText size={15} />}
                {saveButtonLabel}
              </button>
            </div>

            {publishMode === 'published' && formData.slug && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
                <p className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                  <Globe size={12} /> IndexNow activé
                </p>
                <p className="text-xs text-green-600">
                  L'article sera soumis à Bing à la publication : <span className="font-mono">{SITE_CONFIG.url.replace(/^https?:\/\//i, '')}/blog/{formData.slug}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showMediaLibrary && (
        <MediaLibrary onClose={() => setShowMediaLibrary(false)} onSelect={insertImage} />
      )}

      {showYoutubeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowYoutubeModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="youtube-modal-title"
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="youtube-modal-title" className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Youtube size={16} className="text-red-600" /> Insérer une vidéo YouTube
              </h3>
              <button
                type="button"
                onClick={() => setShowYoutubeModal(false)}
                aria-label="Fermer"
                className="text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="youtube-url-input" className="sr-only">Lien ou code d'intégration YouTube</label>
              <input
                id="youtube-url-input"
                type="text"
                autoFocus
                value={youtubeInput}
                onChange={(e) => { setYoutubeInput(e.target.value); setYoutubeError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmYoutubeInsert(); } }}
                placeholder="https://www.youtube.com/watch?v=… ou code <iframe>"
                className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-lg outline-none bg-stone-50 focus:bg-white text-sm"
              />
              <p className="text-[12.5px] text-stone-500">Collez un lien YouTube ou le code d'intégration &lt;iframe&gt; fourni par YouTube.</p>
              {youtubeError && (
                <p className="text-xs text-red-500 flex items-center gap-1.5 pt-1">
                  <AlertCircle size={12} /> {youtubeError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowYoutubeModal(false)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmYoutubeInsert}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Insérer
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
