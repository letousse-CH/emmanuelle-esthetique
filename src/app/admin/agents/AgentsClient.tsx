'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Bot, Brain, Check, CheckCircle2, Eye, FileText, Globe,
  Loader2, MessageSquare, Plus, RefreshCw, Send, Sparkles, Trash2, X, Zap,
  BookOpen, UserCheck, ShieldCheck, Smile, Database
} from 'lucide-react';

import {
  deleteAgentDocument, fetchAgentDocuments, fetchAgents,
  reindexAgentKnowledge, saveAgent, saveAgentDocument, ensureSuperAgent,
} from '../../../services/agents';
import {
  type Agent, type AgentCollectField, type AgentDocument,
} from '../../../types/agents';
import {
  Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  Field, FormMessage, Input, Select, Spinner, Textarea, Toggle,
} from '../../../components/admin/ui';
import EditorialBriefModal from './EditorialBriefModal';
import DocumentViewerModal from './DocumentViewerModal';

const AVATARS = ['🤖', '⚡', '🎯', '🚀', '💬', '🧙‍♂️', '✨', '💼'];

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type Fields = AgentCollectField[];

export default function AgentsClient() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Étape courante (1, 2 ou 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Modaux interactifs
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<AgentDocument | null>(null);

  // Formulaire du Super Agent
  const [form, setForm] = useState<{
    name: string;
    greeting: string;
    system_prompt: string;
    avatar: string;
    max_turns: number;
    enabled: boolean;
    collect: Fields;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const superAgent = await ensureSuperAgent();
    setAgent(superAgent);
    setForm({
      name: superAgent.name || 'Super Agent du Site',
      greeting: superAgent.greeting || 'Bonjour ! Je suis l’assistant IA du site. Comment puis-je vous aider ?',
      system_prompt: superAgent.system_prompt || '',
      avatar: superAgent.avatar || '🤖',
      max_turns: superAgent.max_turns ?? 12,
      enabled: superAgent.enabled ?? true,
      collect: (superAgent.collect_fields ?? []) as Fields,
    });

    // Chargement garanti des documents via l'API serveur
    const d = await fetchAgentDocuments(superAgent.id);
    setDocs(d);
    setLoading(false);

    // Auto-réindexation au chargement pour garantir que le savoir et le décompte des pages sont à jour
    void reindexAgentKnowledge(superAgent.id).then(async (res) => {
      if (res.success) {
        setDocs(await fetchAgentDocuments(superAgent.id));
      }
    });

    return superAgent;
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Metric du savoir du Super Agent
  const knowledgeMetrics = useMemo(() => {
    const briefDoc = docs.find((d) => d.source_ref === 'brief-editorial' || d.source_type === 'brief');
    const pageDocs = docs.filter((d) => d.source_type === 'page');
    const articleDocs = docs.filter((d) => d.source_type === 'article');
    const customDocs = docs.filter((d) => d.source_type === 'texte' && d.source_ref !== 'brief-editorial');

    let score = 0;
    if (briefDoc) score += 35;
    if (pageDocs.length > 0) score += 30;
    if (articleDocs.length > 0) score += 20;
    if (customDocs.length > 0) score += 15;

    return {
      score,
      hasBrief: Boolean(briefDoc),
      briefDoc,
      pageCount: pageDocs.length,
      articleCount: articleDocs.length,
      customCount: customDocs.length,
    };
  }, [docs]);

  async function handleSaveForm() {
    if (!agent || !form) return;
    if (!form.name.trim()) return setMessage({ type: 'error', text: "Le Super Agent a besoin d'un nom." });
    setSaving(true);
    const result = await saveAgent({
      ...agent,
      name: form.name.trim(),
      greeting: form.greeting.trim(),
      system_prompt: form.system_prompt.trim(),
      avatar: form.avatar,
      max_turns: Math.min(30, Math.max(2, form.max_turns)),
      enabled: form.enabled,
      collect_fields: form.collect.filter((field) => field.key.trim() && field.label.trim()),
    });
    setSaving(false);
    if (!result.success) return setMessage({ type: 'error', text: result.error ?? 'Enregistrement impossible.' });
    setMessage({ type: 'success', text: 'Réglages du Super Agent enregistrés !' });
    await load();
  }

  async function handleReindex() {
    if (!agent) return;
    setBusy(true);
    const result = await reindexAgentKnowledge(agent.id);
    setBusy(false);
    setMessage(
      result.success
        ? { type: 'success', text: `Bravo ! ${result.count} source(s) (Brief Éditorial, pages web et articles) réindexées avec succès.` }
        : { type: 'error', text: result.error ?? 'Indexation impossible.' },
    );
    setDocs(await fetchAgentDocuments(agent.id));
  }

  async function addDocument(formEl: HTMLFormElement) {
    if (!agent) return;
    const data = new FormData(formEl);
    const title = String(data.get('title') ?? '').trim();
    const content = String(data.get('content') ?? '').trim();
    if (!title || !content) {
      setMessage({ type: 'error', text: 'Un titre et un texte sont nécessaires.' });
      return;
    }
    const result = await saveAgentDocument({
      agent_id: agent.id, title, content, source_type: 'texte', source_ref: slugify(title),
    });
    if (!result.success) return setMessage({ type: 'error', text: result.error ?? 'Enregistrement impossible.' });
    formEl.reset();
    setDocs(await fetchAgentDocuments(agent.id));
    setMessage({ type: 'success', text: 'Ajouté au savoir du Super Agent.' });
  }

  if (loading) return <Spinner label="Préparation du Super Agent IA…" />;

  return (
    <div className="space-y-6">
      {/* ── En-tête du Super Agent ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner backdrop-blur-md">
              {form?.avatar || '🤖'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{form?.name || 'Super Agent IA'}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 border border-emerald-400/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Agent du Site
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">
                Configurez votre assistant unique en 3 étapes simples (1 ➔ 2 ➔ 3).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBriefModalOpen(true)}
            className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border border-amber-300 flex items-center gap-2 text-sm"
          >
            <Sparkles size={16} className="text-amber-950" /> Brief Éditorial & Marque
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center justify-between gap-4">
          <FormMessage message={message} />
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Masquer le message"
            className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── PARCOURS SIMPLIFIÉ EN 3 ÉTAPES (NAV INTUITIVE) ─────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Étape 1 */}
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            step === 1
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/30 scale-[1.02]'
              : 'border-emerald-300 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-xs ${
            step === 1 ? 'bg-white text-indigo-700' : 'bg-emerald-600 text-white'
          }`}>
            {step > 1 ? <Check size={18} /> : '1'}
          </div>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${step === 1 ? 'text-indigo-200' : 'text-emerald-700'}`}>Étape 1</p>
            <p className="text-sm font-bold truncate">Identité & Apparence</p>
          </div>
        </button>

        {/* Étape 2 */}
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            step === 2
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/30 scale-[1.02]'
              : step > 2
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100'
              : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-xs ${
            step === 2 ? 'bg-white text-indigo-700' : step > 2 ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700'
          }`}>
            {step > 2 ? <Check size={18} /> : '2'}
          </div>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${step === 2 ? 'text-indigo-200' : step > 2 ? 'text-emerald-700' : 'text-stone-400'}`}>Étape 2</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold truncate">Savoir & Cerveau</p>
              <span className={`rounded-full px-2 py-0.2 text-[10.5px] font-extrabold ${
                step === 2 ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900'
              }`}>
                {knowledgeMetrics.score}%
              </span>
            </div>
          </div>
        </button>

        {/* Étape 3 */}
        <button
          type="button"
          onClick={() => setStep(3)}
          className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            step === 3
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/30 scale-[1.02]'
              : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-xs ${
            step === 3 ? 'bg-white text-indigo-700' : 'bg-stone-100 text-stone-700'
          }`}>
            3
          </div>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${step === 3 ? 'text-indigo-200' : 'text-stone-400'}`}>Étape 3</p>
            <p className="text-sm font-bold truncate">Test & En Ligne</p>
          </div>
        </button>
      </div>

      {/* ── CONTENU DE L'ÉTAPE 1 : IDENTITÉ & APPARENCE ──────────────── */}
      {step === 1 && agent && form && (
        <Card className="border-stone-200 shadow-xs">
          <CardHeader
            title="Étape 1 : Choisissez l'identité de votre Super Agent"
            description="Définissez son avatar emoji, son prénom et son message d'accueil pour vos visiteurs."
          />
          <CardBody className="space-y-6">
            {/* Choix d'avatar */}
            <Field label="1. Choix du visage / Avatar" hint="Cliquez sur l'avatar que vous préférez pour votre assistant.">
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, avatar: emoji })}
                    className={`h-14 w-14 rounded-2xl text-2xl flex items-center justify-center transition-all cursor-pointer ${
                      form.avatar === emoji
                        ? 'bg-indigo-600 text-white scale-110 shadow-lg ring-4 ring-indigo-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="2. Nom du Super Agent" htmlFor="agent-name" hint="Visible en haut du widget de chat." required>
                <Input id="agent-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>

              <Field label="3. Première phrase d'accueil" htmlFor="agent-greeting" hint="Ce qu'il dit dès l'ouverture du chat.">
                <Input
                  id="agent-greeting"
                  value={form.greeting}
                  onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                  placeholder="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="4. Plafond d'échanges par conversation"
                htmlFor="agent-turns"
                hint="Limite le nombre de messages (Max 15, conseillé : 10) pour éviter les échanges sans fin."
              >
                <Input
                  id="agent-turns"
                  type="number"
                  min={2}
                  max={15}
                  value={form.max_turns}
                  onChange={(e) => setForm({ ...form, max_turns: Math.min(15, Math.max(2, Number(e.target.value) || 10)) })}
                />
              </Field>

              <Field
                label="5. Consigne générale de style"
                htmlFor="agent-prompt"
                hint="Indiquez son attitude globale (ex: Sois poli, concis et invite naturellement le visiteur à laisser ses coordonnées)."
              >
                <Input
                  id="agent-prompt"
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  placeholder="Sois accueillant, concis et professionnel."
                />
              </Field>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex items-center justify-between w-full gap-3">
              <Button variant="ghost" icon={Check} loading={saving} onClick={() => void handleSaveForm()}>
                Enregistrer la fiche
              </Button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveForm();
                  setStep(2);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95 text-sm"
              >
                Continuer vers l'Étape 2 : Savoir <ArrowRight size={16} />
              </button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ── CONTENU DE L'ÉTAPE 2 : SAVOIR & CERVEAU (REFONTE DIDACTIQUE) ─ */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="overflow-hidden border-stone-200 shadow-xs">
            <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-stone-950 font-bold shadow-md">
                    <Brain size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        Étape 2 : Le Cerveau du Super Agent
                      </h3>
                      <Badge tone={knowledgeMetrics.score >= 80 ? 'success' : knowledgeMetrics.score >= 50 ? 'info' : 'warning'}>
                        {knowledgeMetrics.score}% Formé
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-300 mt-1">
                      Le Super Agent lit votre site web pour pouvoir répondre de façon exacte et professionnelle.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReindex()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold px-6 py-3 rounded-2xl shadow-lg cursor-pointer flex items-center gap-2.5 text-sm transition-all active:scale-95 border-none disabled:opacity-50"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} ⚡ Remplir le cerveau (Indexation 1-Clic)
                </button>
              </div>

              {/* Barre de progression du savoir */}
              <div className="mt-5 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-stone-300">
                  <span>Niveau d'apprentissage : {knowledgeMetrics.score}%</span>
                  <span>{docs.length} source(s) enregistrée(s)</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-stone-800 border border-stone-700">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400 transition-all duration-700 shadow-sm"
                    style={{ width: `${knowledgeMetrics.score}%` }}
                  />
                </div>
              </div>

              {/* 4 Cartes Piliers du Savoir */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Brief */}
                <div
                  onClick={() => setIsBriefModalOpen(true)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                    knowledgeMetrics.hasBrief
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      : 'border-stone-700 bg-stone-800/80 text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>🎯 Brief Éditorial</span>
                    {knowledgeMetrics.hasBrief ? <CheckCircle2 size={16} className="text-amber-400" /> : <AlertCircle size={16} className="text-stone-400" />}
                  </div>
                  <p className="mt-2 text-sm font-bold text-white truncate">
                    {knowledgeMetrics.hasBrief ? 'Positionnement & Ton' : 'À configurer'}
                  </p>
                  <span className="mt-2.5 inline-flex items-center text-xs font-bold text-amber-300 underline">
                    Éditer le brief →
                  </span>
                </div>

                {/* 2. Pages Web */}
                <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sky-200">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>🌐 Pages Web du Site</span>
                    <Globe size={16} className="text-sky-400" />
                  </div>
                  <p className="mt-2 text-base font-extrabold text-white">
                    {knowledgeMetrics.pageCount} page(s) web
                  </p>
                  <span className="mt-1 block text-xs text-sky-300 font-medium">Pages et blocs lusa</span>
                </div>

                {/* 3. Articles Blog */}
                <div className="rounded-2xl border border-purple-500/40 bg-purple-500/10 p-4 text-purple-200">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>📰 Articles du Blog</span>
                    <BookOpen size={16} className="text-purple-400" />
                  </div>
                  <p className="mt-2 text-base font-extrabold text-white">
                    {knowledgeMetrics.articleCount} article(s)
                  </p>
                  <span className="mt-1 block text-xs text-purple-300 font-medium">Savoir du blog</span>
                </div>

                {/* 4. Tarifs & FAQ */}
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>💡 Tarifs & FAQ</span>
                    <FileText size={16} className="text-emerald-400" />
                  </div>
                  <p className="mt-2 text-base font-extrabold text-white">
                    {knowledgeMetrics.customCount} document(s)
                  </p>
                  <span className="mt-1 block text-xs text-emerald-300 font-medium">Savoirs sur-mesure</span>
                </div>
              </div>
            </div>

            {/* Note explicative sur le stockage Supabase */}
            <div className="bg-indigo-50/60 border-b border-indigo-100 p-4 px-6 flex items-start gap-3">
              <Database size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-950 space-y-1">
                <p className="font-bold">Où sont stockés les savoirs de votre Super Agent ?</p>
                <p className="text-stone-600 leading-relaxed">
                  Toutes les informations (Brief Éditorial, pages du site, articles et tarifs) sont conservées en sécurité dans la table <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-900 font-mono text-[11px]">agent_documents</code> de votre base de données Supabase. Cliquez sur <strong>« Inspecter »</strong> ci-dessous pour voir le texte exact que l'agent a retenu pour chaque document.
                </p>
              </div>
            </div>

            {/* Liste des documents appris par le Super Agent */}
            <CardBody className="space-y-4 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
                <span>Contenus mémorisés dans son cerveau ({docs.length})</span>
                <span className="text-[11px] font-normal text-stone-600">Stockés dans table Supabase agent_documents</span>
              </h4>

              {docs.length === 0 ? (
                <Callout tone="warning">
                  Aucun savoir mémorisé pour le moment. Cliquez sur le grand bouton vert « ⚡ Remplir le cerveau (Indexation 1-Clic) » ci-dessus pour lire vos pages web.
                </Callout>
              ) : (
                <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {docs.map((doc) => {
                    const isBrief = doc.source_ref === 'brief-editorial' || doc.source_type === 'brief';
                    return (
                      <li
                        key={doc.id}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                          isBrief
                            ? 'border-amber-200 bg-amber-50/70 shadow-2xs'
                            : doc.source_type === 'page'
                            ? 'border-sky-200 bg-sky-50/50 shadow-2xs'
                            : doc.source_type === 'article'
                            ? 'border-purple-200 bg-purple-50/50 shadow-2xs'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {isBrief ? (
                            <Sparkles size={18} className="shrink-0 text-amber-600" />
                          ) : doc.source_type === 'page' ? (
                            <Globe size={18} className="shrink-0 text-sky-600" />
                          ) : doc.source_type === 'article' ? (
                            <BookOpen size={18} className="shrink-0 text-purple-600" />
                          ) : (
                            <FileText size={18} className="shrink-0 text-stone-500" />
                          )}
                          <span className="truncate text-sm font-bold text-stone-900">
                            {doc.title}
                          </span>
                          {isBrief ? (
                            <Badge tone="warning">Brief Éditorial</Badge>
                          ) : doc.source_type === 'page' ? (
                            <Badge tone="info">Page Web</Badge>
                          ) : doc.source_type === 'article' ? (
                            <Badge tone="neutral">Article</Badge>
                          ) : (
                            <Badge>Texte libre</Badge>
                          )}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingDoc(doc)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100 cursor-pointer shadow-xs transition-all"
                            title="Inspecter le texte retenu par l'agent"
                          >
                            <Eye size={14} className="text-indigo-600" /> Inspecter le texte
                          </button>
                          {!isBrief && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!agent) return;
                                await deleteAgentDocument(doc.id);
                                setDocs(await fetchAgentDocuments(agent.id));
                              }}
                              className="rounded-xl p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                              aria-label={`Retirer ${doc.title}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Formulaire d'ajout rapide */}
              <form
                onSubmit={(event) => { event.preventDefault(); void addDocument(event.currentTarget); }}
                className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
              >
                <p className="text-[13px] font-bold text-stone-900 flex items-center gap-1.5">
                  <Plus size={16} className="text-emerald-600" /> Ajouter un tarif ou une condition spécifique
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Titre" htmlFor="doc-title" className="sm:col-span-1">
                    <Input id="doc-title" name="title" placeholder="Ex: Délais d'intervention" />
                  </Field>
                  <Field label="Texte explicatif" htmlFor="doc-content" className="sm:col-span-2">
                    <Input id="doc-content" name="content" placeholder="Interventions sous 24h à 48h sur le canton de Genève..." />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" icon={Plus}>Ajouter au savoir</Button>
                </div>
              </form>
            </CardBody>

            <CardFooter>
              <div className="flex items-center justify-between w-full gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} className="mr-1 inline" /> Étape 1 : Identité
                </Button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95 text-sm"
                >
                  Continuer vers l'Étape 3 : Test & Activation <ArrowRight size={16} />
                </button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ── CONTENU DE L'ÉTAPE 3 : TEST & MISE EN LIGNE ──────────────── */}
      {step === 3 && agent && form && (
        <div className="space-y-6">
          {/* Récolte d'informations & Activation */}
          <Card className="border-stone-200 shadow-xs">
            <CardHeader
              title="Étape 3 : Coordonnées à récolter & Activation sur le site"
              description="Définissez quelles coordonnées le Super Agent doit demander aux visiteurs."
            />
            <CardBody className="space-y-5">
              <div className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">Champs demandés aux visiteurs</h4>
                    <p className="text-[12px] text-stone-600">L'agent les demande une par une, sans jamais forcer.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Plus}
                    onClick={() => setForm({ ...form, collect: [...form.collect, { key: '', label: '', required: false }] })}
                  >
                    Ajouter un champ
                  </Button>
                </div>

                <ul className="space-y-2">
                  {form.collect.map((field, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
                      <Input
                        value={field.label}
                        placeholder="Ex: Téléphone"
                        className="min-w-[10rem] flex-1 h-9 text-[13px]"
                        onChange={(e) => {
                          const collect = [...form.collect];
                          collect[index] = { ...field, label: e.target.value, key: field.key || slugify(e.target.value) };
                          setForm({ ...form, collect });
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={field.required}
                          onChange={(next) => {
                            const collect = [...form.collect];
                            collect[index] = { ...field, required: next };
                            setForm({ ...form, collect });
                          }}
                          label="Obligatoire"
                        />
                        <span className="text-[12px] font-medium text-stone-600">Obligatoire</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setForm({ ...form, collect: form.collect.filter((_, i) => i !== index) })}
                      >
                        <Trash2 size={14} className="text-stone-400 hover:text-red-600" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Interrupteur Activation */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                    <Globe size={16} className="text-emerald-600" /> Activer le Super Agent sur le site
                  </p>
                  <p className="text-[12.5px] text-emerald-800">
                    Lorsqu'il est activé, le widget apparaît en bas du site pour répondre à vos visiteurs.
                  </p>
                </div>
                <Toggle
                  checked={form.enabled}
                  onChange={(next) => setForm({ ...form, enabled: next })}
                  label="Afficher le Super Agent sur le site"
                />
              </div>
            </CardBody>
            <CardFooter>
              <div className="flex items-center justify-between w-full gap-3">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} className="mr-1 inline" /> Étape 2 : Savoir
                </Button>
                <button
                  type="button"
                  onClick={() => void handleSaveForm()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95 text-sm"
                >
                  <Check size={16} /> Valider & Activer le Super Agent
                </button>
              </div>
            </CardFooter>
          </Card>

          {/* Banc d'essai en direct */}
          <AgentTester agent={agent} />
        </div>
      )}

      {/* Modaux interactifs */}
      <EditorialBriefModal
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        onSaved={() => {
          if (agent) void handleReindex();
        }}
      />

      <DocumentViewerModal
        doc={viewingDoc}
        onClose={() => setViewingDoc(null)}
      />
    </div>
  );
}

/**
 * Banc d'essai ludique pour tester le Super Agent.
 */
function AgentTester({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visitorRef = useRef(`apercu-admin-${Date.now().toString(36)}`);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(agent.greeting ? [{ role: 'assistant', content: agent.greeting }] : []);
    setError('');
    visitorRef.current = `apercu-admin-${Date.now().toString(36)}`;
  }, [agent.id, agent.greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (customText?: string) => {
    const text = (customText ?? draft).trim();
    if (!text || busy) return;
    setDraft('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug: agent.slug, visitorRef: visitorRef.current, message: text }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.reply) throw new Error(payload?.error || "L'agent n'a pas répondu.");
      setMessages((prev) => [...prev, { role: 'assistant', content: payload.reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <Card className="border-stone-200 shadow-xs">
      <CardHeader
        title="Banc d'essai en direct : Testez votre Super Agent"
        description="Essayez une vraie conversation pour vérifier ses réponses et son apprentissage."
        actions={
          messages.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMessages(agent.greeting ? [{ role: 'assistant', content: agent.greeting }] : []);
                visitorRef.current = `apercu-admin-${Date.now().toString(36)}`;
              }}
            >
              Recommencer le test
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {/* Puces de test rapides colorées */}
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <span className="text-[12px] font-bold text-stone-700 flex items-center gap-1 mr-1">
            <Zap size={14} className="text-amber-500" /> Tests rapides 1-clic :
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Présentez-moi votre entreprise, vos offres et vos valeurs.")}
            className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 font-semibold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all"
          >
            🎯 Ton & Positionnement
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Quels sont vos tarifs et vos prestations ?")}
            className="bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 font-semibold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all"
          >
            💰 Tarifs & Offres
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Je souhaite prendre un rendez-vous rapide.")}
            className="bg-indigo-100 text-indigo-900 border border-indigo-300 hover:bg-indigo-200 font-semibold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all"
          >
            📅 Prise de RDV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Quel temps fait-il sur Mars ?")}
            className="bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 font-semibold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 transition-all"
          >
            ❓ Question piège
          </button>
        </div>

        {/* Zone de chat */}
        <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-900/95 p-4 text-stone-100 shadow-inner">
          {messages.length === 0 && (
            <p className="text-[13px] text-stone-400">Écrivez un message ou cliquez sur une puce de test ci-dessus.</p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-sm border border-indigo-500/30">
                  {agent.avatar || '🤖'}
                </div>
              )}
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-xs'
                    : 'bg-stone-800 text-stone-100 border border-stone-700 rounded-tl-xs'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-[12.5px] text-indigo-300">
              <Loader2 size={14} className="animate-spin text-indigo-400" /> {agent.name} consulte son cerveau…
            </p>
          )}
          {error && <p className="text-[12.5px] text-red-400">{error}</p>}
        </div>

        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Posez une question comme si vous étiez un visiteur…"
            aria-label="Message de test"
            disabled={busy}
            className="h-10 text-sm"
          />
          <Button type="submit" variant="primary" icon={busy ? undefined : Send} loading={busy} disabled={!draft.trim()} className="h-10">
            <span className="sr-only sm:not-sr-only">Envoyer</span>
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
