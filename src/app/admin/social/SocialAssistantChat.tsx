"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Loader2, CalendarPlus, CheckCircle2, Eye,
  Palette, CalendarRange, Lightbulb, PenLine, AlertCircle, X, MapPin, Smartphone, Instagram
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { SITE_CONFIG } from '../../../config/site';
import {
  fetchBrandTokens, type BrandTokens,
  fetchMediaLibraryPhotos, pickBestLibraryPhoto, BRAND_PHOTOS, type MediaLibraryPhoto,
} from '../../../utils/socialCards';
import type { SocialGenerationResult } from '../../../utils/socialGeneration';
import SocialResultDisplay from '../../../components/admin/SocialResultDisplay';
import { toDateKey, fromDateKey, todayKey, addDaysToKey } from '../../../utils/dateKey';
import { VISUAL_THEMES, type VisualThemeId } from './SocialAutopilotQueue';

export type AssistantMode = 'single' | 'plan' | 'ideas';

export interface SocialAssistantChatProps {
  onPostCreated?: (plannedDate: string) => void;
  initialPrompt?: string;
}

interface IdeaItem {
  title: string;
  pillar: string;
  angle: string;
  recommendedCare?: string;
}

interface PlanTopicItem {
  date: string;
  pillar: string;
  title: string;
  angle: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: AssistantMode;
  visualTheme?: VisualThemeId;
  singleResult?: {
    title: string;
    coverImage: string;
    content: SocialGenerationResult & {
      visual_theme?: VisualThemeId;
      story?: { text?: string; highlight?: string; cta?: string };
      google_business?: { title?: string; post?: string; cta?: string };
    };
    plannedDate: string;
    saved?: boolean;
  };
  planResult?: {
    topics: PlanTopicItem[];
    saved?: boolean;
  };
  ideasResult?: {
    ideas: IdeaItem[];
    savedIndices: number[];
  };
}

const MODE_OPTIONS: {
  id: AssistantMode;
  label: string;
  description: string;
  icon: typeof PenLine;
}[] = [
  {
    id: 'single',
    label: 'Rédiger une publication complète',
    description: 'Crée le Carrousel Instagram, la Story, le post Facebook et l’actualité Google',
    icon: PenLine,
  },
  {
    id: 'plan',
    label: 'Préparer une série sur plusieurs jours',
    description: 'Propose 3 à 4 publications cohérentes prêtes à planifier',
    icon: CalendarRange,
  },
  {
    id: 'ideas',
    label: 'Trouver des idées & conseils',
    description: 'Propose 4 angles doux et concrets pour vos clientes',
    icon: Lightbulb,
  },
];

const SEASONAL_SUGGESTIONS: {
  label: string;
  mode: AssistantMode;
  theme: VisualThemeId;
  prompt: string;
}[] = [
  {
    label: "Préparer 1 semaine de publications sur l'hydratation marine Phytomer pour l'automne/hiver",
    mode: 'plan',
    theme: 'marin',
    prompt: "Préparer 1 semaine de publications sur l'hydratation marine Phytomer pour l'automne/hiver (Soin Hydra Originel, barrière cutanée face au froid et au chauffage, gestes à la maison).",
  },
  {
    label: 'Créer un carrousel : 3 gestes simples pour apaiser sa peau face au froid',
    mode: 'single',
    theme: 'photo',
    prompt: '3 gestes simples pour apaiser sa peau qui tire face au froid et au vent, avec l’expertise marine Phytomer à la cabine de Palézieux-Gare.',
  },
  {
    label: "Rédiger une actualité Google pour promouvoir les bons cadeaux massages à l'institut de Palézieux-Gare",
    mode: 'single',
    theme: 'photo',
    prompt: "Promouvoir les bons cadeaux d'Emmanuelle Esthétique à Palézieux-Gare (Grand Massage Relaxant Marine, Rituel Échappée Belle) : une attention locale et apaisante à offrir.",
  },
  {
    label: 'Mettre en avant le rehaussement de cils pour un regard lumineux et naturel au quotidien',
    mode: 'single',
    theme: 'photo',
    prompt: 'Le rehaussement de cils à l’institut de Palézieux-Gare : ouvrir et illuminer le regard naturellement dès le réveil, sans mascara ni artifice.',
  },
  {
    label: 'Trouver 4 idées de publications douces pour inviter mes clientes à prendre un moment pour soi',
    mode: 'ideas',
    theme: 'photo',
    prompt: 'Trouver 4 idées de publications douces et bienveillantes pour inviter mes clientes de Palézieux, Oron et Châtel-St-Denis à s’accorder une vraie pause en cabine.',
  },
];

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function buildNextCadenceDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = fromDateKey(addDaysToKey(todayKey(), 1));
  for (let i = 0; i < 60 && dates.length < count; i++) {
    const day = cursor.getDay();
    if (day === 1 || day === 3 || day === 5) {
      dates.push(toDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function newSourceRef(prefix = 'assistant'): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

export default function SocialAssistantChat({ onPostCreated, initialPrompt }: SocialAssistantChatProps) {
  const [mode, setMode] = useState<AssistantMode>('single');
  const [visualTheme, setVisualTheme] = useState<VisualThemeId>('photo');
  const [input, setInput] = useState(initialPrompt || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandTokens | null>(null);
  const [libraryPhotos, setLibraryPhotos] = useState<MediaLibraryPhoto[]>(BRAND_PHOTOS);
  const [previewModalPost, setPreviewModalPost] = useState<{
    title: string;
    coverImage: string;
    content: SocialGenerationResult;
    theme: VisualThemeId;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ msgId: string; done: number; total: number } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Bonjour Emmanuelle. Je connais la carte de vos soins Phytomer, vos massages, la beauté du regard et les photos de votre bibliothèque. Que souhaitez-vous préparer aujourd'hui ?",
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBrandTokens(SITE_CONFIG.name || 'Emmanuelle Esthétique').then(setBrand);
    fetchMediaLibraryPhotos().then(setLibraryPhotos);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const sendPrompt = async (customPrompt?: string, customMode?: AssistantMode, customTheme?: VisualThemeId) => {
    const text = (customPrompt ?? input).trim();
    const activeMode = customMode ?? mode;
    const activeTheme = customTheme ?? visualTheme;
    if (!text || busy) return;

    setError(null);
    if (!customPrompt) setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      mode: activeMode,
      visualTheme: activeTheme,
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Appel via /api/social-assistant (moteur IA dédié Emmanuelle Esthétique)
      const chatRes = await fetch('/api/social-assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: text,
          mode: activeMode,
          visualTheme: activeTheme,
          theme: activeTheme,
        }),
      }).catch(() => null);

      if (chatRes && chatRes.ok) {
        const chatData = await chatRes.json().catch(() => null);
        if (chatData && !chatData.error) {
          if (activeMode === 'single' && (chatData.content || chatData.post || chatData.result || chatData.instagram)) {
            const rawContent = chatData.content || chatData.post || chatData.result || chatData;
            const nextDate = buildNextCadenceDates(1)[0] || addDaysToKey(todayKey(), 1);
            const postTitle = chatData.title || text.slice(0, 90);
            const coverImage = rawContent.cover_image || pickBestLibraryPhoto(`${postTitle} ${text}`, libraryPhotos);
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: chatData.reply || 'Voici votre publication complète avec son image de bibliothèque, prête à être ajoutée au calendrier :',
                visualTheme: activeTheme,
                singleResult: {
                  title: postTitle,
                  coverImage,
                  content: { ...rawContent, cover_image: coverImage, theme: activeTheme, visual_theme: activeTheme },
                  plannedDate: nextDate,
                },
              },
            ]);
            setBusy(false);
            return;
          }
          if (activeMode === 'plan' && Array.isArray(chatData.topics)) {
            const dates = buildNextCadenceDates(chatData.topics.length);
            const topics: PlanTopicItem[] = chatData.topics.map((t: any, idx: number) => ({
              date: t.date || dates[idx] || addDaysToKey(todayKey(), idx * 2 + 1),
              pillar: t.pillar || 'Comprendre',
              title: t.title || `Publication ${idx + 1}`,
              angle: t.angle || t.brief || '',
            }));
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: chatData.summary || chatData.reply || `Voici une série cohérente de ${topics.length} publications autour de votre demande :`,
                visualTheme: activeTheme,
                planResult: { topics },
              },
            ]);
            setBusy(false);
            return;
          }
          const rawIdeas = chatData.ideas || chatData.suggestions;
          if (activeMode === 'ideas' && Array.isArray(rawIdeas)) {
            const mappedIdeas: IdeaItem[] = rawIdeas.map((item: any) => ({
              title: item.title,
              pillar: item.pillar || 'Comprendre',
              angle: item.angle,
              recommendedCare: item.recommendedCare || item.formatLabel || 'Soin en cabine à Palézieux-Gare',
            }));
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: chatData.reply || 'Voici 4 angles concrets pensés pour vos clientes de Palézieux-Gare et de la région :',
                visualTheme: activeTheme,
                ideasResult: { ideas: mappedIdeas, savedIndices: [] },
              },
            ]);
            setBusy(false);
            return;
          }
        }
      }

      // Repli direct sur les routes de génération éprouvées (/api/generate-social et /api/social-editorial-plan)
      if (activeMode === 'single') {
        const res = await fetch('/api/generate-social', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: text.length > 95 ? `${text.slice(0, 92)}…` : text,
            intro: `${text}\n\nContexte local : Institut Emmanuelle Esthétique à Palézieux-Gare (Chemin de la Marouette 19, à 1 min à pied de la gare). Cosmétique marine Phytomer, massages relaxants, beauté du regard et épilation douce. Vouvoiement doux et chaleureux.`,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || 'La rédaction de la publication a échoué. Réessayez dans un instant.');
        }

        const nextDate = buildNextCadenceDates(1)[0] || addDaysToKey(todayKey(), 1);
        const postTitle = text.length > 90 ? `${text.slice(0, 87)}…` : text;
        const coverImage = data.cover_image || pickBestLibraryPhoto(`${postTitle} ${text}`, libraryPhotos);
        const enriched = {
          ...data,
          cover_image: coverImage,
          theme: activeTheme,
          visual_theme: activeTheme,
          story: data.story || {
            text: data.instagram?.slides?.[0]?.text || data.instagram?.caption?.hook || text,
            highlight: data.instagram?.slides?.[0]?.highlight,
            cta: 'Réserver votre créneau via le lien en bio',
          },
          google_business: data.google_business || {
            title: text.slice(0, 80),
            post: `${data.instagram?.caption?.hook || ''}\n\n${data.instagram?.caption?.body || ''}\n\n📍 Emmanuelle Esthétique — Chemin de la Marouette 19, 1607 Palézieux-Gare (sur rendez-vous).`.trim(),
            cta: 'Prendre rendez-vous',
          },
        };

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: 'J’ai rédigé votre publication complète avec une photo de votre bibliothèque (Carrousel Instagram, Story verticale, Facebook et actualité Google pour Palézieux-Gare). Vous pouvez l’ajouter au calendrier en 1 clic :',
            visualTheme: activeTheme,
            singleResult: {
              title: postTitle,
              coverImage,
              content: enriched,
              plannedDate: nextDate,
            },
          },
        ]);
      } else if (activeMode === 'plan') {
        const dates = buildNextCadenceDates(3);
        const res = await fetch('/api/social-editorial-plan', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            period: 'week',
            dates,
            existingTitles: [],
          }),
        });
        const data = await res.json().catch(() => null);
        let topics: PlanTopicItem[] = [];
        if (res.ok && Array.isArray(data?.topics) && data.topics.length > 0) {
          topics = data.topics;
        } else {
          topics = [
            {
              date: dates[0],
              pillar: 'Reconnaître',
              title: `Quand la peau tiraille : écouter les besoins de son épiderme (${text.slice(0, 45)})`,
              angle: `Scène concrète du quotidien et explication bienveillante autour de : ${text}.`,
            },
            {
              date: dates[1],
              pillar: 'Comprendre',
              title: 'Le secret des actifs marins Phytomer en cabine à Palézieux-Gare',
              angle: 'Expliquer simplement comment le protocole en cabine restaure le confort et l’éclat de la peau.',
            },
            {
              date: dates[2],
              pillar: 'Passer à l\'action',
              title: 'S’accorder une parenthèse de calme cette semaine à l’institut',
              angle: 'Invitation douce à réserver son créneau ou un bon cadeau chez Emmanuelle Esthétique à Palézieux-Gare.',
            },
          ];
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: `Voici une proposition de série sur ${topics.length} jours (Lundi · Mercredi · Vendredi). Cliquez sur « Rédiger et planifier toute la série » pour générer tous les textes et visuels dans votre calendrier :`,
            visualTheme: activeTheme,
            planResult: { topics },
          },
        ]);
      } else {
        // Mode 'ideas' : 4 angles concrets
        const dates = buildNextCadenceDates(4);
        const res = await fetch('/api/social-editorial-plan', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            period: 'week',
            dates: dates.slice(0, 3),
            existingTitles: [],
          }),
        }).catch(() => null);
        const data = res && res.ok ? await res.json().catch(() => null) : null;

        const ideas: IdeaItem[] = Array.isArray(data?.topics) && data.topics.length >= 3
          ? [
              ...data.topics.map((t: any) => ({
                title: t.title,
                pillar: t.pillar || 'Comprendre',
                angle: t.angle,
                recommendedCare: 'Soin en cabine à Palézieux-Gare',
              })),
              {
                title: 'Offrir (ou s’offrir) une pause loin du tumulte : le rituel en cabine privée',
                pillar: 'Passer à l\'action',
                angle: 'Mettre en valeur le calme de la cabine individuelle à 1 minute de la gare de Palézieux et les bons cadeaux.',
                recommendedCare: 'Grand Massage Relaxant Marine / Bons cadeaux',
              },
            ]
          : [
              {
                title: 'Pourquoi votre peau réclame plus que de l’eau quand l’air se rafraîchit',
                pillar: 'Reconnaître',
                angle: 'Parler de la sensation de tiraillement en fin de journée et de la différence entre hydrater et relipider.',
                recommendedCare: 'Soin Hydra Originel Phytomer (60 min)',
              },
              {
                title: 'Ce qui se passe pendant les 15 minutes du massage crânien & nuque',
                pillar: 'Comprendre',
                angle: 'Décrire le relâchement immédiat des trapèzes et de la nuque lors d’un soin du visage.',
                recommendedCare: 'Option Massage Relaxant Cuir Chevelu & Nuque',
              },
              {
                title: 'Un regard reposé dès le matin, sans maquillage',
                pillar: 'Comprendre',
                angle: 'Montrer l’effet naturel du rehaussement et de la teinture des cils pour gagner du temps chaque matin.',
                recommendedCare: 'Réhaussement de cils & Duo Regard',
              },
              {
                title: 'L’attention qui fait toujours plaisir : le bon cadeau bien-être à Palézieux-Gare',
                pillar: 'Passer à l\'action',
                angle: 'Rappeler qu’un bon cadeau pour un massage ou un rituel visage/corps se retire facilement à l’institut.',
                recommendedCare: 'Rituel Échappée Belle & Bons cadeaux',
              },
            ];

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: 'Voici 4 idées d’angles pensées pour vos clientes. Vous pouvez transformer chacune d’elles en publication complète en 1 clic :',
            visualTheme: activeTheme,
            ideasResult: { ideas, savedIndices: [] },
          },
        ]);
      }
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue lors de la génération.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSingleToCalendar = async (msg: ChatMessage) => {
    if (!msg.singleResult || msg.singleResult.saved) return;
    setSavingId(msg.id);
    setError(null);
    try {
      const { title, coverImage, content, plannedDate } = msg.singleResult;
      const finalCover = coverImage || content.cover_image || pickBestLibraryPhoto(title, libraryPhotos);
      const { error: insertErr } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef('chat-single'),
        title,
        cover_image: finalCover,
        content: { ...content, cover_image: finalCover },
        planned_date: plannedDate,
        status: 'ready',
      });
      if (insertErr) throw new Error(insertErr.message);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id && m.singleResult
            ? { ...m, singleResult: { ...m.singleResult, saved: true } }
            : m
        )
      );
      onPostCreated?.(plannedDate);
    } catch (e: any) {
      setError(`Impossible d'enregistrer dans le calendrier : ${e?.message || 'Erreur'}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleGenerateAndSavePlan = async (msg: ChatMessage) => {
    if (!msg.planResult || msg.planResult.saved) return;
    const topics = msg.planResult.topics;
    setBatchProgress({ msgId: msg.id, done: 0, total: topics.length });
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        const res = await fetch('/api/generate-social', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: topic.title,
            intro: `[Pilier : ${topic.pillar}] ${topic.angle}`,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || `Échec sur le sujet « ${topic.title} »`);
        }

        const coverImage = data.cover_image || pickBestLibraryPhoto(`${topic.title} ${topic.angle}`, libraryPhotos, i);
        const enriched = {
          ...data,
          cover_image: coverImage,
          pillar: topic.pillar || data.pillar,
          visual_theme: msg.visualTheme || visualTheme,
        };

        const { error: insertErr } = await supabase.from('social_posts').insert({
          source_type: 'manual',
          source_ref: newSourceRef('chat-plan'),
          title: topic.title,
          cover_image: coverImage,
          content: enriched,
          planned_date: topic.date,
          status: 'ready',
        });
        if (insertErr) throw new Error(insertErr.message);

        setBatchProgress({ msgId: msg.id, done: i + 1, total: topics.length });
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id && m.planResult
            ? { ...m, planResult: { ...m.planResult, saved: true } }
            : m
        )
      );
      if (topics[0]?.date) onPostCreated?.(topics[0].date);
    } catch (e: any) {
      setError(`Erreur lors de la création de la série : ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setBatchProgress(null);
    }
  };

  const handleTurnIdeaIntoPost = async (msg: ChatMessage, idea: IdeaItem, ideaIdx: number) => {
    const key = `${msg.id}-idea-${ideaIdx}`;
    setSavingId(key);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: idea.title,
          intro: `[Pilier : ${idea.pillar}] ${idea.angle}${idea.recommendedCare ? ` — Soin mis en avant : ${idea.recommendedCare}` : ''}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'La rédaction a échoué.');
      }

      const nextDate = buildNextCadenceDates(ideaIdx + 1).pop() || addDaysToKey(todayKey(), 1);
      const coverImage = data.cover_image || pickBestLibraryPhoto(`${idea.title} ${idea.angle}`, libraryPhotos, ideaIdx);
      const enriched = {
        ...data,
        cover_image: coverImage,
        pillar: idea.pillar || data.pillar,
        visual_theme: msg.visualTheme || visualTheme,
      };

      const { error: insertErr } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef('chat-idea'),
        title: idea.title,
        cover_image: coverImage,
        content: enriched,
        planned_date: nextDate,
        status: 'ready',
      });
      if (insertErr) throw new Error(insertErr.message);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id && m.ideasResult
            ? {
                ...m,
                ideasResult: {
                  ...m.ideasResult,
                  savedIndices: [...m.ideasResult.savedIndices, ideaIdx],
                },
              }
            : m
        )
      );
      onPostCreated?.(nextDate);
    } catch (e: any) {
      setError(`Impossible de transformer cette idée : ${e?.message || 'Erreur'}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de l'assistant */}
      <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 space-y-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
            <Sparkles size={14} /> Assistant d&apos;Inspiration Beauté
          </span>
          <h2 className="text-xl font-semibold text-[#3A3730]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '26px' }}>
            Que souhaitez-vous partager avec vos clientes ?
          </h2>
          <p className="text-[14px] text-stone-700">
            Demandez un post sur un soin Phytomer, une série pour la semaine ou des idées saisonnières pour l&apos;institut à Palézieux-Gare.
          </p>
        </div>

        {/* Suggestions saisonnières & locales en 1 clic */}
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-stone-600 uppercase tracking-wider">
            Suggestions rapides en 1 clic pour l&apos;institut :
          </p>
          <div className="flex flex-wrap gap-2">
            {SEASONAL_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode(s.mode);
                  setVisualTheme(s.theme);
                  sendPrompt(s.prompt, s.mode, s.theme);
                }}
                className="text-left px-3.5 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 hover:border-[#8A9A7B] text-[13px] text-[#3A3730] font-medium transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                ✦ {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <span className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="font-semibold underline cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {/* Fil de conversation */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-5 max-h-[620px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-3xl rounded-2xl px-5 py-4 space-y-4 ${
                msg.role === 'user'
                  ? 'bg-[#3A3730] text-[#FAF7F2]'
                  : 'bg-white border border-stone-200 text-stone-800 shadow-2xs w-full'
              }`}
            >
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{msg.text}</p>

              {/* Carte de résultat : Publication unique ('single') */}
              {msg.singleResult && (
                <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 space-y-4 text-stone-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
                      Publication complète prête · {msg.singleResult.content.instagram?.slides?.length || 8} slides
                    </span>
                    <span className="text-[12px] text-stone-600">
                      Créneau proposé : <strong>{DAY_LABEL.format(fromDateKey(msg.singleResult.plannedDate))}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {msg.singleResult.coverImage && (
                      <img
                        src={msg.singleResult.coverImage}
                        alt={msg.singleResult.title}
                        className="w-14 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
                      />
                    )}
                    <h4 className="text-[16px] font-semibold text-[#3A3730]">{msg.singleResult.title}</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-stone-200 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A9A7B]">
                        <Instagram size={12} /> Accroche Instagram
                      </span>
                      <p className="text-[13px] text-[#3A3730] font-medium line-clamp-3">
                        {msg.singleResult.content.instagram?.caption?.hook}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-stone-200 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60B9C2]">
                        <Smartphone size={12} /> Story 9:16
                      </span>
                      <p className="text-[13px] text-[#3A3730] line-clamp-3">
                        {msg.singleResult.content.story?.text || msg.singleResult.content.instagram?.slides?.[0]?.text}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-3 border border-stone-200 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700">
                        <MapPin size={12} /> Actualité Google (Palézieux)
                      </span>
                      <p className="text-[13px] text-stone-700 line-clamp-3">
                        {msg.singleResult.content.google_business?.post || msg.singleResult.content.facebook?.post}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    {msg.singleResult.saved ? (
                      <span className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-semibold">
                        <CheckCircle2 size={15} /> Ajouté au calendrier (Prêt à publier)
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={savingId === msg.id}
                        onClick={() => handleSaveSingleToCalendar(msg)}
                        className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#8A9A7B] hover:bg-[#788869] text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {savingId === msg.id ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />}
                        Ajouter au calendrier (Prêt à publier)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModalPost({
                          title: msg.singleResult!.title,
                          coverImage: msg.singleResult!.coverImage,
                          content: msg.singleResult!.content,
                          theme: msg.visualTheme || visualTheme,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl bg-white hover:bg-stone-100 text-[#3A3730] border border-stone-300 text-[13px] font-semibold transition-colors cursor-pointer"
                    >
                      <Eye size={15} /> Voir tous les visuels &amp; textes
                    </button>
                  </div>
                </div>
              )}

              {/* Carte de résultat : Plan sur plusieurs jours ('plan') */}
              {msg.planResult && (
                <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 space-y-4 text-stone-800">
                  <div className="space-y-2.5">
                    {msg.planResult.topics.map((t, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-3.5 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-800">
                              {DAY_LABEL.format(fromDateKey(t.date))}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#8A9A7B]/15 text-[#3A3730]">
                              {t.pillar}
                            </span>
                          </div>
                          <p className="text-[14px] font-semibold text-[#3A3730]">{t.title}</p>
                          <p className="text-[12px] text-stone-600">{t.angle}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1">
                    {msg.planResult.saved ? (
                      <span className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-semibold">
                        <CheckCircle2 size={15} /> Toute la série a été rédigée et ajoutée au calendrier
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={batchProgress !== null}
                        onClick={() => handleGenerateAndSavePlan(msg)}
                        className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {batchProgress?.msgId === msg.id ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            Rédaction en cours ({batchProgress.done}/{batchProgress.total})…
                          </>
                        ) : (
                          <>
                            <Sparkles size={15} /> Rédiger et planifier toute la série
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Carte de résultat : 4 idées ('ideas') */}
              {msg.ideasResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {msg.ideasResult.ideas.map((idea, idx) => {
                    const isSaved = msg.ideasResult!.savedIndices.includes(idx);
                    const key = `${msg.id}-idea-${idx}`;
                    return (
                      <div key={idx} className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-4 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#8A9A7B]/15 text-[#3A3730]">
                            {idea.pillar}
                          </span>
                          <h5 className="text-[14px] font-semibold text-[#3A3730] leading-snug">{idea.title}</h5>
                          <p className="text-[12px] text-stone-700 leading-relaxed">{idea.angle}</p>
                        </div>

                        <div>
                          {isSaved ? (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800">
                              <CheckCircle2 size={14} /> Ajouté au calendrier
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={savingId === key}
                              onClick={() => handleTurnIdeaIntoPost(msg, idea, idx)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-[#3A3730] border border-stone-300 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {savingId === key ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-[#8A9A7B]" />}
                              {savingId === key ? 'Rédaction en cours…' : 'Transformer en publication'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5 text-[13px] text-stone-700 bg-white border border-stone-200 rounded-2xl px-4 py-3 w-fit">
            <Loader2 size={15} className="animate-spin text-[#8A9A7B]" />
            Préparation de votre contenu avec le ton d&apos;Emmanuelle Esthétique…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Zone de saisie + Sélecteurs de mode et d'habillage visuel */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-4">
        {/* 1. Choix du mode */}
        <div className="space-y-2">
          <label className="block text-[12px] font-semibold text-stone-700 uppercase tracking-wider">
            Mode de création
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'border-[#3A3730] bg-[#FAF7F2] ring-2 ring-[#3A3730]/10'
                      : 'border-stone-200 bg-white hover:bg-stone-100/60'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-[13px] text-[#3A3730]">
                    <opt.icon size={14} className={active ? 'text-[#8A9A7B]' : 'text-stone-500'} />
                    {opt.label}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1 leading-snug">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Sélecteur d'habillage visuel souhaité */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-stone-700 uppercase tracking-wider">
            <Palette size={13} /> Habillage visuel souhaité
          </label>
          <div className="flex flex-wrap gap-2">
            {VISUAL_THEMES.map((theme) => {
              const active = visualTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setVisualTheme(theme.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-[#3A3730] bg-[#3A3730] text-[#FAF7F2]'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/40"
                    style={{ backgroundColor: theme.accent }}
                  />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Zone de texte & envoi */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex. : Crée un post sur le Soin Hydra Originel Phytomer pour les peaux fatiguées par le froid…"
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-[14px] text-stone-900 placeholder:text-stone-400 focus:border-[#3A3730] focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 h-auto py-3 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[14px] font-semibold transition-colors disabled:opacity-45 cursor-pointer shrink-0"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span>Demander à l&apos;assistant</span>
          </button>
        </form>
      </div>

      {/* Modale d'aperçu complet des visuels */}
      {previewModalPost && brand && (
        <div
          className="fixed inset-0 z-[9998] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModalPost(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-stone-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FAF7F2]">
              <h3 className="text-base font-semibold text-[#3A3730]">{previewModalPost.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewModalPost(null)}
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <SocialResultDisplay
                result={previewModalPost.content}
                coverImage={previewModalPost.coverImage}
                brand={{
                  ...brand,
                  accent: VISUAL_THEMES.find((t) => t.id === previewModalPost.theme)?.accent || brand.accent,
                  dark: VISUAL_THEMES.find((t) => t.id === previewModalPost.theme)?.dark || brand.dark,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
