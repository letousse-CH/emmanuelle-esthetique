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
import { useAiJob } from '../../../hooks/useAiJob';
import AiJobProgress from '../../../components/admin/AiJobProgress';

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

/** Valeur pour un champ datetime-local, à l'heure locale (toISOString donnerait l'heure UTC). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Empêche la touche Entrée d'enregistrer (ou de publier) tout le formulaire depuis un champ court. */
const blockEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.preventDefault();
};

function normalizeForSeo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, "'");
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'ia',           label: "Écrire avec l'IA", icon: Cpu     },
  { id: 'redaction',     label: 'Rédaction',    icon: PenLine      },
  { id: 'seo',          label: 'Référencement', icon: Search       },
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
  const [metaError, setMetaError]           = useState('');
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
  /*
    La rédaction (environ 2 400 mots) dépasse les 60 s d'une fonction Netlify :
    elle passe par une tâche de fond, suivie ici. L'identifiant de la tâche est
    gardé le temps de la session du navigateur : après un rechargement, le
    texte rédigé s'affiche quand même.
  */
  const articleJob = useAiJob<{ content?: string }>(`article:${id ?? 'new'}`);

  const [seoFoundKws, setSeoFoundKws]   = useState<string[]>([]);
  const analysisTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quillRef                        = React.useRef<any>(null);

  // Un nouvel article part en brouillon : rien n'est mis en ligne sans le choisir.
  const [publishMode, setPublishMode] = useState<PublishMode>(isEditing ? 'published' : 'draft');
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
    published:        false,
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
        setScheduledAt(toLocalInputValue(new Date(data.scheduled_at)));
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
    // Le résultat (ou l'erreur) est reporté par l'effet qui suit l'état de la tâche.
    await articleJob.start('article', { idea });
  };

  // Report de l'état de la tâche de rédaction dans l'écran (y compris après
  // un rechargement de la page).
  useEffect(() => {
    if (articleJob.status === 'pending' || articleJob.status === 'running') {
      setAiStatus('generating');
      return;
    }
    if (articleJob.status === 'done') {
      const content = String(articleJob.result?.content ?? '');
      if (!content.trim()) {
        setAiError("Aucun texte n'a été reçu.");
        setAiStatus('error');
        return;
      }
      aiAccRef.current = content;
      setAiPreview(content);
      setAiStatus('done');
      return;
    }
    if (articleJob.status === 'error') {
      setAiError(articleJob.error || "La rédaction automatique s'est interrompue.");
      setAiStatus('error');
    }
  }, [articleJob.status, articleJob.result, articleJob.error]);

  const insertGeneratedContent = (): boolean => {
    if (!aiAccRef.current) return false;
    const hasText = (formData.content || '').replace(/<[^>]*>/g, '').trim().length > 0;
    if (hasText && !window.confirm("Remplacer le texte actuel de l'article par le texte généré ? Le texte actuel sera perdu.")) {
      return false;
    }
    setFormData(prev => ({ ...prev, content: aiAccRef.current }));
    setAiStatus('idle');
    setAiPreview('');
    articleJob.reset();
    return true;
  };

  const generateMeta = async (overrides?: { content?: string }) => {
    if (!formData.title) return;
    setGeneratingMeta(true);
    setMetaError('');
    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ title: formData.title, content: overrides?.content ?? formData.content ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      if (data.meta_title || data.meta_description || data.meta_keywords) {
        setFormData(prev => ({
          ...prev,
          ...(data.meta_title       ? { meta_title: data.meta_title }             : {}),
          ...(data.meta_description ? { meta_description: data.meta_description } : {}),
          ...(data.meta_keywords    ? { meta_keywords: data.meta_keywords }       : {}),
        }));
      } else {
        throw new Error();
      }
    } catch {
      setMetaError("Les suggestions n'ont pas pu être générées. Réessayez dans un instant, ou remplissez les champs vous-même.");
    }
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

  const saveButtonClass = 'bg-accent text-accent-fg hover:bg-accent-hover';

  const saveButtonLabel = saving ? 'Enregistrement…'
    : publishMode === 'published' ? 'Publier'
    : publishMode === 'scheduled' ? 'Programmer'
    : 'Enregistrer le brouillon';

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 min-h-64 text-[14px] text-stone-700" role="status">
        <div className="w-5 h-5 rounded-full border-2 border-stone-200 border-t-accent animate-spin" />
        Chargement de l'article…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-screen">

      {/* ── Topbar sticky ─────────────────────────────── */}
      <div className="sticky top-16 z-10 bg-white border-b border-stone-200 shadow-sm">
        <div className="flex items-center gap-3 px-6 h-14">
          <Link href="/admin/blog" aria-label="Retour à la liste des articles" title="Retour aux articles" className="shrink-0 p-1.5 -ml-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors">
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
              onKeyDown={blockEnterSubmit}
              aria-label="Titre de l'article"
              placeholder="Titre de l'article…"
              className="w-full text-base font-medium text-stone-900 bg-transparent border-none outline-none placeholder:text-stone-500 truncate"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${
              publishMode === 'published' ? 'bg-emerald-50 text-emerald-700'
              : publishMode === 'scheduled' ? 'bg-amber-50 text-amber-800'
              : 'bg-stone-100 text-stone-700'
            }`}>
              {publishMode === 'published' ? <Globe size={10} /> : publishMode === 'scheduled' ? <Clock size={10} /> : <FileText size={10} />}
              {publishMode === 'published' ? 'Publié' : publishMode === 'scheduled' ? 'Programmé' : 'Brouillon'}
            </span>

            {seoBrief && (
              <Link
                href="/admin/seo"
                className="hidden md:flex items-center gap-1.5 text-[13px] bg-stone-100 text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-200 transition-colors font-semibold"
              >
                Idées de sujets
              </Link>
            )}

            <button
              type="submit"
              disabled={saving}
              aria-label={saveButtonLabel}
              className="bg-accent hover:bg-accent-hover flex items-center gap-2 px-5 py-2 text-[14px] font-semibold rounded-lg text-accent-fg transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span className="hidden sm:inline">{saveButtonLabel}</span>
            </button>
          </div>
        </div>

        {/* Slug row */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <label htmlFor="article-slug" className="text-[13px] text-stone-600">
            <span className="sr-only">Adresse de l'article : </span>{SITE_CONFIG.url.replace(/^https?:\/\//i, '')}/blog/
          </label>
          <input
            id="article-slug"
            type="text"
            name="slug"
            required
            value={formData.slug || ''}
            onChange={handleChange}
            onKeyDown={blockEnterSubmit}
            className="flex-1 min-w-0 text-[13px] px-2 py-1 border border-stone-200 focus:border-stone-900 rounded-md outline-none bg-stone-50 focus:bg-white lowercase max-w-xs"
          />
          <button type="button" onClick={generateSlug} title="Recalculer l'adresse à partir du titre" className="text-[13px] text-accent hover:underline font-semibold">
            Depuis le titre
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-stone-200 overflow-x-auto" role="tablist" aria-label="Sections de l'article">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-accent text-stone-950'
                    : 'border-transparent text-stone-700 hover:text-stone-950 hover:bg-stone-50'
                }`}
              >
                <Icon size={14} />
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
              <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                <h3 className="text-[13px] font-medium text-stone-800">Image de couverture</h3>
                {formData.cover_image ? (
                  <div className="relative group">
                    <img src={formData.cover_image} alt="Couverture" className="w-full aspect-video object-cover rounded-xl border border-stone-200" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cover_image: '' }))}
                      aria-label="Retirer l'image de couverture"
                      title="Retirer l'image"
                      className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md text-stone-700 hover:text-red-700 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center">
                    <ImageIcon size={24} className="text-stone-600" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="url"
                    name="cover_image"
                    value={formData.cover_image || ''}
                    onChange={handleChange}
                    onKeyDown={blockEnterSubmit}
                    aria-label="Adresse de l'image de couverture"
                    placeholder="https://…"
                    className="flex-1 min-w-0 px-3 py-2 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-lg outline-none bg-stone-50 focus:bg-white text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors"
                  >
                    <ImageIcon size={14} /> Choisir
                  </button>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                <label htmlFor="article-category" className="block text-[13px] font-medium text-stone-800">Catégorie</label>
                <select
                  id="article-category"
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
                    <span className={`text-xs font-semibold tabular-nums ${
                      wordCount === 0 ? 'text-stone-600'
                      : wordCount >= 2000 && wordCount <= 2800 ? 'text-emerald-600'
                      : wordCount >= 1500 ? 'text-amber-700'
                      : 'text-red-700'
                    }`}>
                      {wordCount.toLocaleString('fr-FR')} mots
                    </span>
                    <span className="text-[13px] text-stone-600">Longueur conseillée : 2000 à 2800 mots</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        wordCount >= 2000 && wordCount <= 2800 ? 'bg-emerald-400'
                        : wordCount >= 1500 ? 'bg-amber-400'
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
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
                <h2 className="text-[13px] font-medium text-stone-800">Contenu</h2>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={insertYouTubeVideo}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800 hover:text-stone-950 transition-colors"
                  >
                    <Youtube size={14} /> Vidéo YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMediaTarget('content'); setShowMediaLibrary(true); }}
                    className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800 hover:text-stone-950 transition-colors"
                  >
                    <ImageIcon size={14} /> Insérer une image
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
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <Search size={15} className="text-accent" /> Apparence dans Google
                </h2>
                <button
                  type="button"
                  onClick={() => generateMeta()}
                  disabled={generatingMeta || !formData.title}
                  title={!formData.title ? "Saisissez d'abord un titre" : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold text-[13px] rounded-lg transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} />
                  {generatingMeta ? 'Rédaction…' : "Proposer avec l'IA"}
                </button>
              </div>
              {metaError && <p role="alert" className="text-[13px] text-red-700">{metaError}</p>}

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="meta_title" className="text-[13px] font-medium text-stone-800">Titre affiché dans Google</label>
                  {(() => {
                    const len = (formData.meta_title || '').length;
                    return <span className={`text-xs font-semibold tabular-nums ${len === 0 ? 'text-stone-600' : len <= 60 ? 'text-emerald-700' : 'text-red-700'}`}>{len}/60</span>;
                  })()}
                </div>
                <input
                  id="meta_title" type="text" name="meta_title" maxLength={70}
                  value={formData.meta_title || ''} onChange={handleChange}
                  onKeyDown={blockEnterSubmit}
                  placeholder="Titre qui apparaîtra dans les résultats de recherche"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm"
                />
                <div className="w-full bg-stone-100 rounded-full h-0.5">
                  <div className={`h-0.5 rounded-full transition-all ${(formData.meta_title || '').length <= 60 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(((formData.meta_title || '').length / 60) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="meta_description" className="text-[13px] font-medium text-stone-800">Description affichée dans Google</label>
                  {(() => {
                    const len = (formData.meta_description || '').length;
                    return <span className={`text-xs font-semibold tabular-nums ${
                      len === 0 ? 'text-stone-600' : len >= 150 && len <= 160 ? 'text-emerald-700' : len > 160 ? 'text-red-700' : 'text-amber-700'
                    }`}>{len}/160</span>;
                  })()}
                </div>
                <textarea
                  id="meta_description" name="meta_description" rows={3} maxLength={170}
                  value={formData.meta_description || ''} onChange={handleChange}
                  placeholder="Deux phrases qui donnent envie de lire l'article (Google et réseaux sociaux)"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm resize-none"
                />
                <div className="w-full bg-stone-100 rounded-full h-0.5">
                  <div className={`h-0.5 rounded-full transition-all ${
                    (formData.meta_description || '').length > 160 ? 'bg-red-400'
                    : (formData.meta_description || '').length >= 150 ? 'bg-emerald-400'
                    : 'bg-amber-300'
                  }`} style={{ width: `${Math.min(((formData.meta_description || '').length / 160) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="meta_keywords" className="text-[13px] font-medium text-stone-800">Mots-clés</label>
                <textarea
                  id="meta_keywords" name="meta_keywords" rows={2}
                  value={formData.meta_keywords || ''} onChange={handleChange}
                  placeholder="ex : soin du visage, peau sèche, hydratation…"
                  className="w-full px-3 py-2.5 border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 rounded-xl outline-none bg-stone-50 focus:bg-white text-sm resize-none"
                />
                <p className="text-[13px] text-stone-600">Séparés par des virgules. Laissez vide pour utiliser la catégorie par défaut.</p>
              </div>
            </div>

            {/* SEO Cluster Checklist */}
            {seoTotalKws > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <Target size={15} className="text-accent" /> Mots-clés du sujet présents dans le texte
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold tabular-nums ${seoScore >= 75 ? 'text-emerald-700' : seoScore >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                      {seoFoundKws.length}/{seoTotalKws}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ${seoScore >= 75 ? 'bg-emerald-400' : seoScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${seoScore}%` }} />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-stone-700 mb-1">Recherche principale visée</p>
                  <p className="font-mono text-xs bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg text-stone-700">{seoBrief!.keyword}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-stone-700 mb-2">Mots-clés associés</p>
                  <div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                    {seoKeywords.map((kw, i) => {
                      const found = seoFoundKws.includes(kw);
                      return (
                        <div key={i} className={`flex items-center gap-2 text-[13px] px-3 py-2 rounded-lg transition-colors ${found ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-50 text-stone-700'}`}>
                          <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${found ? 'bg-emerald-600 text-white' : 'bg-stone-200'}`}>
                            {found && <CheckCircle2 size={12} aria-hidden="true" />}
                          </span>
                          <span className="truncate">{kw}</span>
                          <span className="sr-only">{found ? ' (présent)' : ' (absent)'}</span>
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
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Target size={15} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">Fiche du sujet</p>
                      <p className="text-[12.5px] text-stone-600 font-mono">{seoBrief.keyword}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBrief(b => !b)}
                    aria-expanded={showBrief}
                    className="flex items-center gap-1 text-[13px] font-medium text-stone-700 hover:text-stone-950 transition-colors"
                  >
                    {showBrief ? <><ChevronUp size={14} /> Masquer</> : <><ChevronDown size={14} /> Voir la fiche</>}
                  </button>
                </div>

                {showBrief && (
                  <div className="px-6 py-5 space-y-4 text-sm">

                    {/* Ligne 1 — keyword + catégorie */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Requête cible</p>
                        <p className="font-mono bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700">{seoBrief.keyword}</p>
                      </div>
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Catégorie et intention</p>
                        <p className="text-stone-700">{seoBrief.category} — <span className="text-stone-600">{seoBrief.intent}</span>
                          {seoBrief.difficulty && <span className="ml-2 text-[12px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">{seoBrief.difficulty}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Question reformulée */}
                    {seoBrief.question && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Question reformulée (possible intertitre)</p>
                        <p className="text-stone-700 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 italic">{seoBrief.question}</p>
                      </div>
                    )}

                    {/* Opportunité éditoriale */}
                    {seoBrief.opportunity && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Pourquoi ce sujet</p>
                        <p className="text-stone-700 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-[13px]">{seoBrief.opportunity}</p>
                      </div>
                    )}

                    {/* Accroche suggérée */}
                    {seoBrief.suggestedIntro && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Accroche suggérée</p>
                        <p className="text-stone-700 italic bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 text-xs leading-relaxed">"{seoBrief.suggestedIntro}"</p>
                      </div>
                    )}

                    {/* Cluster sémantique */}
                    {seoBrief.secondaryKeywords?.length ? (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-2">Mots-clés associés ({seoBrief.secondaryKeywords.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {seoBrief.secondaryKeywords.map((kw, i) => (
                            <span key={i} className="text-[12px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">{kw}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* PAA */}
                    {seoBrief.relatedQuestions.length > 0 && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-2">Questions souvent posées sur Google</p>
                        <ul className="space-y-1">
                          {seoBrief.relatedQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-stone-700 text-xs"><span className="text-accent mt-0.5">›</span> {q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conseils de rédaction */}
                    <div>
                      <p className="text-[12.5px] font-medium text-stone-700 mb-2">Conseils de rédaction</p>
                      <ul className="space-y-1">
                        {seoBrief.contentTips.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-stone-700 text-xs"><span className="text-accent mt-0.5">•</span> {t}</li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    {seoBrief.cta && (
                      <div>
                        <p className="text-[12.5px] font-medium text-stone-700 mb-1">Invitation finale suggérée</p>
                        <p className="text-stone-700 italic bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 text-[13px]">{seoBrief.cta}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Génération article */}
            {moduleFlags.ai_generation && (
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                    <Wand2 size={15} className="text-stone-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {seoBrief ? "Rédiger l'article avec l'IA" : isEditing ? "Réécrire l'article avec l'IA" : "Rédiger l'article avec l'IA"}
                    </p>
                    <p className="text-[12.5px] text-stone-600">
                      {seoBrief ? `À partir de la fiche du sujet : ${seoBrief.keyword}` : "À partir du titre et de la catégorie. Vous relirez le texte avant de l'utiliser."}
                    </p>
                  </div>
                </div>

              <div className="px-6 py-5">
                {aiStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={generateArticle}
                    disabled={!formData.title && !seoBrief}
                    title={!formData.title && !seoBrief ? "Saisissez d'abord un titre" : undefined}
                    className="flex items-center gap-3 bg-accent hover:bg-accent-hover text-accent-fg px-6 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Wand2 size={16} />
                    {isEditing ? 'Régénérer l\'article (~2400 mots)' : 'Générer l\'article complet (~2400 mots)'}
                  </button>
                )}

                {aiStatus === 'generating' && (
                  <AiJobProgress label="Rédaction en cours…" elapsedSeconds={articleJob.elapsedSeconds} />
                )}

                {aiStatus === 'done' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                      <CheckCircle2 size={16} />
                      Article généré — {Math.round(aiAccRef.current.length / 5)} mots environ
                    </div>

                    <div
                      className="max-h-80 overflow-y-auto bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm text-stone-700 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: safeSanitize(aiPreview) }}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { if (insertGeneratedContent()) setActiveTab('redaction'); }}
                        className="flex items-center gap-2 bg-accent text-accent-fg px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        Utiliser ce texte
                      </button>
                      <button
                        type="button"
                        onClick={generateArticle}
                        className="flex items-center gap-2 bg-stone-100 text-stone-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-stone-200 transition-colors"
                      >
                        <Wand2 size={14} />
                        Proposer un autre texte
                      </button>
                    </div>
                  </div>
                )}

                {aiStatus === 'error' && (
                  <div className="space-y-3">
                    <div role="alert" className="flex items-start gap-2 text-red-700 text-sm">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span><span className="font-semibold">La rédaction n'a pas abouti.</span> {aiError} Vérifiez votre connexion puis réessayez.</span>
                    </div>
                    <button type="button" onClick={generateArticle} className="flex items-center gap-2 bg-stone-100 text-stone-900 px-4 py-2 rounded-lg font-semibold text-[13px] hover:bg-stone-200 transition-colors">
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
                <div className="bg-white border border-dashed border-stone-200 rounded-xl p-8 text-center">
                  <p className="text-stone-700 text-sm">Quand l'article aura du texte, vous pourrez en tirer ici des publications pour les réseaux sociaux.</p>
                </div>
              )
            )}
          </div>
        )}

        {/* ════ ONGLET PROGRAMMATION ════ */}
        {activeTab === 'programmation' && (
          <div className="space-y-6 max-w-lg">
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2 pb-3 border-b border-stone-200">
                <CalendarClock size={15} className="text-accent" /> Mode de publication
              </h2>

              <div className="flex flex-col gap-3">
                {([
                  { mode: 'draft',     icon: FileText,      label: 'Brouillon',  desc: 'Invisible sur le site',   color: 'text-stone-900', activeBg: 'bg-stone-100 border-stone-400'  },
                  { mode: 'scheduled', icon: Clock,         label: 'Programmé',  desc: 'Mis en ligne automatiquement à la date choisie', color: 'text-amber-900', activeBg: 'bg-amber-50 border-amber-400'   },
                  { mode: 'published', icon: Globe,         label: 'Publié',     desc: 'En ligne dès l\'enregistrement',  color: 'text-stone-950',      activeBg: 'bg-accent-soft border-accent'          },
                ] as const).map(({ mode, icon: Icon, label, desc, color, activeBg }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPublishMode(mode)}
                    aria-pressed={publishMode === mode}
                    className={`flex items-center gap-4 px-5 py-4 border-2 rounded-xl transition-colors text-left ${
                      publishMode === mode ? `${activeBg} ${color}` : 'border-stone-200 text-stone-700 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-none mb-1">{label}</p>
                      <p className="text-[13px] text-stone-700">{desc}</p>
                    </div>
                    {publishMode === mode && <CheckCircle2 size={16} className="shrink-0" />}
                  </button>
                ))}
              </div>

              {publishMode === 'scheduled' && (
                <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <label htmlFor="article-scheduled-at" className="text-[13px] font-medium text-amber-900 flex items-center gap-1.5">
                    <Clock size={13} /> Date et heure de publication
                  </label>
                  <input
                    id="article-scheduled-at"
                    type="datetime-local"
                    value={scheduledAt}
                    min={toLocalInputValue(new Date(Date.now() + 60_000))}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2.5 border border-amber-300 focus:border-amber-500 rounded-lg outline-none bg-white text-stone-800 text-sm"
                  />
                  <p className="text-[13px] text-amber-900">L'article sera mis en ligne automatiquement, à dix minutes près.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 py-3.5 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 ${saveButtonClass}`}
              >
                {publishMode === 'published' ? <Globe size={15} /> : publishMode === 'scheduled' ? <Clock size={15} /> : <FileText size={15} />}
                {saveButtonLabel}
              </button>
            </div>

            {publishMode === 'published' && formData.slug && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                <p className="text-[13px] font-semibold text-emerald-800 flex items-center gap-1.5">
                  <Globe size={13} /> Signalé aux moteurs de recherche
                </p>
                <p className="text-[13px] text-emerald-800">
                  Bing sera prévenu de la nouvelle page dès l'enregistrement : <span className="font-mono">{SITE_CONFIG.url.replace(/^https?:\/\//i, '')}/blog/{formData.slug}</span>
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
            className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="youtube-modal-title" className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Youtube size={16} className="text-stone-700" /> Insérer une vidéo YouTube
              </h3>
              <button
                type="button"
                onClick={() => setShowYoutubeModal(false)}
                aria-label="Fermer"
                className="text-stone-600 hover:text-stone-700 transition-colors cursor-pointer"
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
              <p className="text-[12.5px] text-stone-600">Collez un lien YouTube ou le code d'intégration &lt;iframe&gt; fourni par YouTube.</p>
              {youtubeError && (
                <p role="alert" className="text-[13px] text-red-700 flex items-start gap-1.5 pt-1">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {youtubeError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowYoutubeModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-stone-800 hover:bg-stone-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmYoutubeInsert}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-fg text-[13px] font-semibold rounded-lg transition-colors"
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
