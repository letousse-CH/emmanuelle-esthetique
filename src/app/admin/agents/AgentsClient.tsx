'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, FileText, Globe, Loader2, Plus, RefreshCw, Send, Sparkles, Trash2, X, BookOpen,
} from 'lucide-react';

import {
  deleteAgentDocument, fetchAgentDocuments, fetchAgents,
  reindexAgentKnowledge, saveAgent, saveAgentDocument, ensureSuperAgent, checkAgentsSetup,
} from '../../../services/agents';
import {
  type Agent, type AgentCollectField, type AgentDocument,
} from '../../../types/agents';
import {
  Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, Field, FormMessage, Input, Spinner, Textarea, Toggle, ToggleRow,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Étape courante (1, 2 ou 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Modaux interactifs
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<AgentDocument | null>(null);

  // Formulaire de l'agent
  const [form, setForm] = useState<{
    name: string;
    greeting: string;
    system_prompt: string;
    avatar: string;
    max_turns: number;
    enabled: boolean;
    collect: Fields;
  } | null>(null);

  /** Recopie l'agent enregistré dans le formulaire. */
  const applyAgent = useCallback((superAgent: Agent) => {
    setAgent(superAgent);
    setForm({
      name: superAgent.name || 'Assistant du site',
      greeting: superAgent.greeting || 'Bonjour ! Je suis l’assistant IA du site. Comment puis-je vous aider ?',
      system_prompt: superAgent.system_prompt || '',
      avatar: superAgent.avatar || '🤖',
      max_turns: superAgent.max_turns ?? 12,
      enabled: superAgent.enabled ?? true,
      collect: (superAgent.collect_fields ?? []) as Fields,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const setupError = await checkAgentsSetup();
    if (setupError) {
      setLoadError(setupError);
      setLoading(false);
      return;
    }
    let superAgent: Agent | undefined;
    try {
      superAgent = await ensureSuperAgent();
    } catch {
      superAgent = undefined;
    }
    if (!superAgent) {
      setLoadError("L'agent n'a pas pu être chargé. Vérifiez votre connexion, puis rechargez la page.");
      setLoading(false);
      return;
    }
    applyAgent(superAgent);

    const d = await fetchAgentDocuments(superAgent.id);
    setDocs(d);
    setLoading(false);

    // Relecture du site à l'ouverture, pour que le savoir suive les pages et
    // articles publiés depuis la dernière visite.
    const agentId = superAgent.id;
    void reindexAgentKnowledge(agentId).then(async (res) => {
      if (res.success) {
        setDocs(await fetchAgentDocuments(agentId));
      }
    });
  }, [applyAgent]);

  useEffect(() => { void load(); }, [load]);

  // Décompte des sources de l'agent
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

  /** Enregistre la fiche. Renvoie `true` si l'enregistrement a réussi. */
  async function handleSaveForm(): Promise<boolean> {
    if (!agent || !form || saving) return false;
    if (!form.name.trim()) {
      setMessage({ type: 'error', text: "Donnez un nom à l'agent (étape 1)." });
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = await saveAgent({
      ...agent,
      name: form.name.trim(),
      greeting: form.greeting.trim(),
      system_prompt: form.system_prompt.trim(),
      avatar: form.avatar,
      max_turns: Math.min(15, Math.max(2, form.max_turns || 10)),
      enabled: form.enabled,
      collect_fields: form.collect.filter((field) => field.key.trim() && field.label.trim()),
    });
    if (!result.success) {
      setSaving(false);
      setMessage({ type: 'error', text: `Réglages non enregistrés : ${result.error ?? 'erreur inconnue'}. Réessayez.` });
      return false;
    }
    // Relecture de la fiche enregistrée, sans recharger tout l'écran ni
    // relancer la lecture du site à chaque enregistrement.
    const rows = await fetchAgents();
    const saved = rows.find((a) => a.id === agent.id);
    if (saved) applyAgent(saved);
    setSaving(false);
    setMessage({
      type: 'success',
      text: form.enabled ? "Réglages enregistrés. L'agent est visible sur le site." : "Réglages enregistrés. L'agent n'est pas affiché sur le site.",
    });
    return true;
  }

  async function handleReindex() {
    if (!agent) return;
    setBusy(true);
    const result = await reindexAgentKnowledge(agent.id);
    setBusy(false);
    setMessage(
      result.success
        ? { type: 'success', text: `Site relu : ${result.count} source${result.count > 1 ? 's' : ''} (brief, pages et articles en ligne).` }
        : { type: 'error', text: `Le site n'a pas pu être relu : ${result.error ?? 'erreur inconnue'}. Réessayez dans un instant.` },
    );
    setDocs(await fetchAgentDocuments(agent.id));
  }

  async function removeDocument(doc: AgentDocument) {
    if (!agent) return;
    if (!confirm(`Retirer « ${doc.title} » du savoir de l'agent ?`)) return;
    const result = await deleteAgentDocument(doc.id);
    if (!result.success) {
      setMessage({ type: 'error', text: `Suppression impossible : ${result.error ?? 'erreur inconnue'}.` });
      return;
    }
    setDocs(await fetchAgentDocuments(agent.id));
    setMessage({ type: 'success', text: `« ${doc.title} » a été retiré.` });
  }

  async function addDocument(formEl: HTMLFormElement) {
    if (!agent || adding) return;
    const data = new FormData(formEl);
    const title = String(data.get('title') ?? '').trim();
    const content = String(data.get('content') ?? '').trim();
    if (!title || !content) {
      setMessage({ type: 'error', text: 'Un titre et un texte sont nécessaires.' });
      return;
    }
    setAdding(true);
    const result = await saveAgentDocument({
      agent_id: agent.id, title, content, source_type: 'texte', source_ref: slugify(title),
    });
    setAdding(false);
    if (!result.success) {
      setMessage({ type: 'error', text: `Texte non ajouté : ${result.error ?? 'erreur inconnue'}. Votre saisie est conservée, réessayez.` });
      return;
    }
    formEl.reset();
    setDocs(await fetchAgentDocuments(agent.id));
    setMessage({ type: 'success', text: `« ${title} » a été ajouté au savoir de l'agent.` });
  }

  if (loading) return <Spinner label="Chargement de l'agent…" />;
  if (loadError) return <Callout tone="danger" title="Agent indisponible">{loadError}</Callout>;

  return (
    <div className="space-y-6">
      {/* ── En-tête de l'agent ─────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-2xl">
              {form?.avatar || '🤖'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-stone-900 tracking-tight">{agent?.name || 'Agent IA'}</h2>
                {agent?.enabled
                  ? <Badge tone="success">Visible sur le site</Badge>
                  : <Badge>Non affiché sur le site</Badge>}
              </div>
              <p className="text-[14px] text-stone-600 mt-0.5">
                Réglez-le en trois étapes : son identité, ce qu'il sait, puis l'essai et la mise en ligne.
              </p>
            </div>
          </div>

          <Button icon={Sparkles} onClick={() => setIsBriefModalOpen(true)}>
            Brief éditorial
          </Button>
        </div>
      </div>

      {message && (
        <div className="flex items-center justify-between gap-4">
          <FormMessage message={message} />
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Masquer le message"
            className="rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
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
          aria-current={step === 1 ? 'step' : undefined}
          className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            step === 1
              ? 'border-accent bg-accent-soft text-stone-900'
              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            step === 1 ? 'bg-accent text-accent-fg' : 'bg-stone-100 text-stone-700'
          }`}>
            {step > 1 ? <Check size={18} /> : '1'}
          </div>
          <div>
            <p className="text-[13px] text-stone-600">Étape 1</p>
            <p className="text-sm font-semibold truncate">Identité</p>
          </div>
        </button>

        {/* Étape 2 */}
        <button
          type="button"
          onClick={() => setStep(2)}
          aria-current={step === 2 ? 'step' : undefined}
          className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            step === 2
              ? 'border-accent bg-accent-soft text-stone-900'
              : step > 2
              ? 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            step === 2 ? 'bg-accent text-accent-fg' : step > 2 ? 'bg-accent text-accent-fg' : 'bg-stone-100 text-stone-700'
          }`}>
            {step > 2 ? <Check size={18} /> : '2'}
          </div>
          <div>
            <p className="text-[13px] text-stone-600">Étape 2</p>
            <p className="text-sm font-semibold truncate">Ce qu'il sait</p>
          </div>
        </button>

        {/* Étape 3 */}
        <button
          type="button"
          onClick={() => setStep(3)}
          aria-current={step === 3 ? 'step' : undefined}
          className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            step === 3
              ? 'border-accent bg-accent-soft text-stone-900'
              : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            step === 3 ? 'bg-accent text-accent-fg' : 'bg-stone-100 text-stone-700'
          }`}>
            3
          </div>
          <div>
            <p className="text-[13px] text-stone-600">Étape 3</p>
            <p className="text-sm font-semibold truncate">Essai et mise en ligne</p>
          </div>
        </button>
      </div>

      {/* ── CONTENU DE L'ÉTAPE 1 : IDENTITÉ & APPARENCE ──────────────── */}
      {step === 1 && agent && form && (
        <Card className="border-stone-200 shadow-xs">
          <CardHeader
            title="Étape 1 : identité"
            description="Son avatar, son nom et la phrase qu'il dit à l'ouverture de la conversation."
          />
          <CardBody className="space-y-6">
            {/* Choix d'avatar */}
            <Field label="Avatar" hint="Affiché à côté de ses messages.">
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, avatar: emoji })}
                    aria-pressed={form.avatar === emoji}
                    aria-label={`Choisir l'avatar ${emoji}`}
                    className={`h-12 w-12 rounded-lg text-2xl flex items-center justify-center transition-colors cursor-pointer ${
                      form.avatar === emoji
                        ? 'bg-accent-soft ring-2 ring-accent'
                        : 'bg-stone-100 hover:bg-stone-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" htmlFor="agent-name" hint="Affiché en haut de la fenêtre de conversation." required>
                <Input id="agent-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>

              <Field label="Phrase d'accueil" htmlFor="agent-greeting" hint="Ce qu'il dit dès l'ouverture de la conversation.">
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
                label="Nombre d'échanges maximum"
                htmlFor="agent-turns"
                hint="Entre 2 et 15 (conseillé : 10). Au-delà, l'agent propose de laisser ses coordonnées."
              >
                <Input
                  id="agent-turns"
                  type="number"
                  min={2}
                  max={15}
                  value={form.max_turns || ''}
                  // Borné à la sortie du champ seulement : borner à chaque frappe
                  // transformait « 1 » en 2, et il était impossible de taper 12.
                  onChange={(e) => setForm({ ...form, max_turns: Number(e.target.value) || 0 })}
                  onBlur={() => setForm({ ...form, max_turns: Math.min(15, Math.max(2, form.max_turns || 10)) })}
                />
              </Field>

              <Field
                label="Consigne de style"
                htmlFor="agent-prompt"
                hint="Son attitude générale. Ex. poli, concis, invite à laisser ses coordonnées."
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
              <Button icon={Check} loading={saving} onClick={() => void handleSaveForm()}>
                Enregistrer
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  // On ne change d'étape qu'une fois la fiche enregistrée.
                  if (await handleSaveForm()) setStep(2);
                }}
              >
                Enregistrer et continuer <ArrowRight size={16} />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ── ÉTAPE 2 : CE QUE L'AGENT SAIT ─────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="Étape 2 : ce qu'il sait"
            description="L'agent répond uniquement à partir de votre brief, des pages et articles en ligne, et des textes que vous ajoutez ici. Le site est relu à chaque ouverture de cet écran."
            actions={
              <Button icon={RefreshCw} loading={busy} onClick={() => void handleReindex()}>
                Relire le site
              </Button>
            }
          />
          <CardBody className="space-y-6">
            {/* Résumé des sources */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setIsBriefModalOpen(true)}
                className="rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors hover:bg-stone-50 cursor-pointer"
              >
                <span className="flex items-center justify-between text-[13px] font-medium text-stone-600">
                  Brief éditorial
                  {knowledgeMetrics.hasBrief
                    ? <CheckCircle2 size={16} className="text-emerald-600" />
                    : <AlertCircle size={16} className="text-amber-600" />}
                </span>
                <span className="mt-2 block text-base font-semibold text-stone-900">
                  {knowledgeMetrics.hasBrief ? 'Renseigné' : 'À remplir'}
                </span>
                <span className="mt-1 block text-[13px] font-medium text-accent">Modifier le brief</span>
              </button>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <span className="flex items-center justify-between text-[13px] font-medium text-stone-600">
                  Pages du site <Globe size={16} className="text-stone-500" />
                </span>
                <span className="mt-2 block text-base font-semibold text-stone-900">
                  {knowledgeMetrics.pageCount} page{knowledgeMetrics.pageCount > 1 ? 's' : ''}
                </span>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <span className="flex items-center justify-between text-[13px] font-medium text-stone-600">
                  Articles du blog <BookOpen size={16} className="text-stone-500" />
                </span>
                <span className="mt-2 block text-base font-semibold text-stone-900">
                  {knowledgeMetrics.articleCount} article{knowledgeMetrics.articleCount > 1 ? 's' : ''}
                </span>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <span className="flex items-center justify-between text-[13px] font-medium text-stone-600">
                  Textes ajoutés <FileText size={16} className="text-stone-500" />
                </span>
                <span className="mt-2 block text-base font-semibold text-stone-900">
                  {knowledgeMetrics.customCount} texte{knowledgeMetrics.customCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Liste des sources */}
            <div className="space-y-3">
              <h3 className="text-[15px] font-semibold text-stone-900">
                Sources utilisées ({docs.length})
              </h3>

              {docs.length === 0 ? (
                <Callout tone="warning">
                  L'agent ne sait encore rien de votre site. Cliquez sur « Relire le site » ci-dessus, ou ajoutez un texte ci-dessous.
                </Callout>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {docs.map((doc) => {
                    const isBrief = doc.source_ref === 'brief-editorial' || doc.source_type === 'brief';
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {isBrief ? (
                            <Sparkles size={16} className="shrink-0 text-stone-500" />
                          ) : doc.source_type === 'page' ? (
                            <Globe size={16} className="shrink-0 text-stone-500" />
                          ) : doc.source_type === 'article' ? (
                            <BookOpen size={16} className="shrink-0 text-stone-500" />
                          ) : (
                            <FileText size={16} className="shrink-0 text-stone-500" />
                          )}
                          <span className="truncate text-[14px] font-medium text-stone-900">{doc.title}</span>
                          <span className="hidden shrink-0 sm:inline">
                            {isBrief ? (
                              <Badge>Brief</Badge>
                            ) : doc.source_type === 'page' ? (
                              <Badge>Page</Badge>
                            ) : doc.source_type === 'article' ? (
                              <Badge>Article</Badge>
                            ) : (
                              <Badge tone="info">Texte ajouté</Badge>
                            )}
                          </span>
                        </span>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewingDoc(doc)}>
                            {doc.source_type === 'texte' && !isBrief ? 'Voir / modifier' : 'Voir'}
                          </Button>
                          {doc.source_type === 'texte' && !isBrief && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Retirer ${doc.title}`}
                              onClick={() => void removeDocument(doc)}
                            >
                              <Trash2 size={15} className="text-stone-600" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Ajout d'un texte */}
            <form
              onSubmit={(event) => { event.preventDefault(); void addDocument(event.currentTarget); }}
              className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4"
            >
              <div>
                <p className="text-[15px] font-semibold text-stone-900">Ajouter un texte</p>
                <p className="text-[13px] text-stone-600">
                  Une information absente du site : tarif, zone de déplacement, condition d'annulation…
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Titre" htmlFor="doc-title" className="sm:col-span-1">
                  <Input id="doc-title" name="title" placeholder="Ex. Zone de déplacement" />
                </Field>
                <Field label="Texte" htmlFor="doc-content" className="sm:col-span-2">
                  <Textarea id="doc-content" name="content" rows={2} placeholder="Ex. Je me déplace à domicile dans un rayon de 20 km autour de Palézieux." />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" icon={Plus} loading={adding}>Ajouter</Button>
              </div>
            </form>
          </CardBody>

          <CardFooter>
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Étape 1
            </Button>
            <Button variant="primary" onClick={() => setStep(3)}>
              Continuer <ArrowRight size={16} />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── CONTENU DE L'ÉTAPE 3 : TEST & MISE EN LIGNE ──────────────── */}
      {step === 3 && agent && form && (
        <div className="space-y-6">
          {/* Récolte d'informations & Activation */}
          <Card>
            <CardHeader
              title="Étape 3 : coordonnées et mise en ligne"
              description="Ce que l'agent demande aux visiteurs, et son affichage sur le site."
            />
            <CardBody className="space-y-5">
              <div className="rounded-xl border border-stone-200 p-4 space-y-3 bg-stone-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[15px] font-semibold text-stone-900">Informations demandées aux visiteurs</h4>
                    <p className="text-[13px] text-stone-600">L'agent les demande une par une, sans insister.</p>
                  </div>
                  <Button
                    size="sm"
                    icon={Plus}
                    onClick={() => setForm({ ...form, collect: [...form.collect, { key: '', label: '', required: false }] })}
                  >
                    Ajouter un champ
                  </Button>
                </div>

                {form.collect.length === 0 && (
                  <p className="text-[14px] text-stone-600">Aucune information demandée : l'agent se contente de répondre.</p>
                )}
                <ul className="space-y-2">
                  {form.collect.map((field, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
                      <Input
                        value={field.label}
                        placeholder="Ex. Téléphone"
                        aria-label="Information demandée"
                        className="min-w-[10rem] flex-1"
                        onChange={(e) => {
                          const collect = [...form.collect];
                          // La clé suit le libellé tant qu'elle en dérive. Avant,
                          // elle se figeait sur la première lettre tapée (« t »).
                          const derived = !field.key || field.key === slugify(field.label);
                          collect[index] = { ...field, label: e.target.value, key: derived ? slugify(e.target.value) : field.key };
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
                        <span className="text-[13px] font-medium text-stone-700">Obligatoire</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Retirer ${field.label || 'ce champ'}`}
                        onClick={() => setForm({ ...form, collect: form.collect.filter((_, i) => i !== index) })}
                      >
                        <Trash2 size={14} className="text-stone-600" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Interrupteur Activation */}
              <div className="rounded-xl border border-stone-200 px-5">
                <ToggleRow
                  title="Afficher l'agent sur le site"
                  description="Une fois activé et enregistré, une fenêtre de conversation apparaît en bas des pages du site."
                  checked={form.enabled}
                  onChange={(next) => setForm({ ...form, enabled: next })}
                />
              </div>
            </CardBody>
            <CardFooter
              hint={form.enabled !== agent.enabled ? "Modification non enregistrée : pensez à enregistrer." : undefined}
            >
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> Étape 2
              </Button>
              <Button variant="primary" icon={Check} loading={saving} onClick={() => void handleSaveForm()}>
                Enregistrer
              </Button>
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
        onSaved={() => {
          if (agent) void fetchAgentDocuments(agent.id).then(setDocs);
        }}
      />
    </div>
  );
}

/**
 * Banc d'essai : une vraie conversation avec l'agent, enregistrée comme
 * « essai depuis l'administration » dans l'onglet Conversations.
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
      if (response.status === 404) {
        throw new Error("L'agent n'est pas encore affiché sur le site : activez-le, enregistrez, puis réessayez.");
      }
      // Netlify coupe une réponse trop lente et renvoie une page sans JSON.
      if (!payload && (response.status === 502 || response.status === 504)) {
        throw new Error("L'agent a mis trop de temps à répondre (délai de l'hébergeur dépassé). Réessayez ; si cela se répète, choisissez un modèle IA plus rapide dans Réglages.");
      }
      if (!response.ok || !payload?.reply) {
        throw new Error(payload?.error || "L'agent n'a pas répondu. Réessayez dans un instant.");
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: payload.reply }]);
    } catch (err) {
      const text = (err as Error).message;
      setError(text === 'Failed to fetch' ? 'Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.' : text);
    } finally {
      setBusy(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send();
  };

  return (
    <Card>
      <CardHeader
        title="Essayer l'agent"
        description="Posez-lui les questions de vos clientes pour vérifier ses réponses. Chaque essai utilise votre budget IA et apparaît dans l'onglet Conversations."
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
              Recommencer
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {!agent.enabled && (
          <Callout tone="warning">
            L'essai ne fonctionne que lorsque l'agent est affiché sur le site : activez-le ci-dessus et enregistrez.
          </Callout>
        )}

        {/* Questions d'essai */}
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <span className="mr-1 text-[13px] font-medium text-stone-700">Questions d'essai :</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Présentez-moi votre institut et vos soins.")}
            className="h-8 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 cursor-pointer disabled:opacity-45"
          >
            Présentation
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Quels sont vos tarifs et vos prestations ?")}
            className="h-8 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 cursor-pointer disabled:opacity-45"
          >
            Tarifs
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Je souhaite prendre un rendez-vous rapide.")}
            className="h-8 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 cursor-pointer disabled:opacity-45"
          >
            Rendez-vous
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send("Quel temps fait-il sur Mars ?")}
            className="h-8 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 cursor-pointer disabled:opacity-45"
          >
            Hors sujet
          </button>
        </div>

        {/* Zone de chat */}
        <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4">
          {messages.length === 0 && (
            <p className="text-[14px] text-stone-600">Écrivez un message ou choisissez une question d'essai ci-dessus.</p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-sm">
                  {agent.avatar || '🤖'}
                </div>
              )}
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-accent text-accent-fg'
                    : 'border border-stone-200 bg-white text-stone-800'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-[13px] text-stone-600">
              <Loader2 size={14} className="animate-spin" /> {agent.name} rédige sa réponse…
            </p>
          )}
          {error && <p className="text-[13px] text-red-700">{error}</p>}
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
