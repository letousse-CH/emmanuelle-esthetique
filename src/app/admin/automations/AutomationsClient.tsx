'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarClock, Check, ChevronDown, Clock, Hand, Loader2, Pencil,
  Play, Plus, Sparkles, Trash2, Workflow, X, XCircle, Zap,
} from 'lucide-react';

import {
  DEFAULT_SCHEDULE, WEEKDAYS, cronToSchedule, deleteAutomation, describeCron, describeNextRun,
  fetchAutomations, fetchRuns, runAutomation, saveAutomation, scheduleToCron, toggleAutomation,
  type Schedule,
} from '../../../services/automations';
import {
  ACTION_CATALOG, AUTOMATION_RECIPES, EVENT_CATALOG, TRIGGER_CATALOG,
  type ActionType, type Automation, type AutomationRecipe, type AutomationRun, type TriggerType,
} from '../../../types/automations';
import {
  Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  Field, FormMessage, Input, Select, Spinner, Toggle,
} from '../../../components/admin/ui';

const TRIGGER_ICON: Record<TriggerType, React.ElementType> = {
  schedule: CalendarClock,
  event: Zap,
  manual: Hand,
};

interface Draft {
  id?: string;
  name: string;
  trigger_type: TriggerType;
  schedule: Schedule;
  event: string;
  action_type: ActionType;
  config: Record<string, string>;
  enabled: boolean;
}

function emptyDraft(): Draft {
  return {
    name: '',
    trigger_type: 'schedule',
    schedule: { ...DEFAULT_SCHEDULE },
    event: EVENT_CATALOG[0].key,
    action_type: 'publish_scheduled',
    config: {},
    enabled: true,
  };
}

function draftFromAutomation(automation: Automation): Draft {
  return {
    id: automation.id,
    name: automation.name,
    trigger_type: automation.trigger_type,
    schedule: cronToSchedule(automation.trigger_config?.cron),
    event: automation.trigger_config?.event ?? EVENT_CATALOG[0].key,
    action_type: automation.action_type,
    config: (automation.action_config ?? {}) as Record<string, string>,
    enabled: automation.enabled,
  };
}

function draftFromRecipe(recipe: AutomationRecipe): Draft {
  return {
    name: recipe.name,
    trigger_type: recipe.trigger_type,
    schedule: cronToSchedule(recipe.trigger_config.cron),
    event: recipe.trigger_config.event ?? EVENT_CATALOG[0].key,
    action_type: recipe.action_type,
    config: { ...recipe.action_config },
    enabled: true,
  };
}

/** Résumé d'une automatisation en une phrase : « Quand X → Y ». */
function summarize(automation: Automation): string {
  const when =
    automation.trigger_type === 'schedule'
      ? describeCron(automation.trigger_config?.cron)
      : automation.trigger_type === 'event'
        ? EVENT_CATALOG.find((e) => e.key === automation.trigger_config?.event)?.label ??
          automation.trigger_config?.event ?? 'Événement inconnu'
        : 'À la demande';
  return `${when} → ${ACTION_CATALOG[automation.action_type]?.label ?? automation.action_type}`;
}

export default function AutomationsClient() {
  const [items, setItems] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [automations, history] = await Promise.all([fetchAutomations(), fetchRuns(undefined, 40)]);
    setItems(automations);
    setRuns(history);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runsByAutomation = useMemo(() => {
    const map = new Map<string, AutomationRun[]>();
    for (const run of runs) {
      const list = map.get(run.automation_id) ?? [];
      list.push(run);
      map.set(run.automation_id, list);
    }
    return map;
  }, [runs]);

  const usedRecipes = useMemo(
    () => new Set(items.map((item) => `${item.trigger_type}:${item.action_type}`)),
    [items],
  );

  async function handleSave() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setMessage({ type: 'error', text: "Donnez un nom à l'automatisation." });
      return;
    }
    const spec = ACTION_CATALOG[draft.action_type];
    const missing = spec.fields.find((field) => field.required && !draft.config[field.key]?.trim());
    if (missing) {
      setMessage({ type: 'error', text: `« ${missing.label} » est nécessaire pour cette action.` });
      return;
    }

    setSaving(true);
    const result = await saveAutomation({
      ...(draft.id ? { id: draft.id } : {}),
      name: draft.name.trim(),
      trigger_type: draft.trigger_type,
      trigger_config:
        draft.trigger_type === 'schedule'
          ? { cron: scheduleToCron(draft.schedule) }
          : draft.trigger_type === 'event'
            ? { event: draft.event }
            : {},
      action_type: draft.action_type,
      action_config: draft.config,
      enabled: draft.enabled,
    });
    setSaving(false);

    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Enregistrement impossible.' });
      return;
    }
    setMessage({ type: 'success', text: draft.id ? 'Automatisation mise à jour.' : 'Automatisation créée.' });
    setDraft(null);
    await load();
  }

  async function handleRun(automation: Automation) {
    setBusy(automation.id);
    setMessage(null);
    const result = await runAutomation(automation.id);
    setBusy(null);
    setMessage(
      result.success
        ? { type: 'success', text: `« ${automation.name} » a été exécutée.` }
        : { type: 'error', text: result.error ?? "L'exécution a échoué." },
    );
    setOpenHistory(automation.id);
    await load();
  }

  if (loading) return <Spinner label="Chargement des automatisations…" />;

  const spec = draft ? ACTION_CATALOG[draft.action_type] : null;

  return (
    <div className="space-y-6">
      {/* ── Comment ça marche ─────────────────────────────────────────── */}
      <Callout tone="info" title="Une automatisation, c'est une phrase en deux temps.">
        <p className="mt-1">
          <strong>Quand</strong> quelque chose arrive — une date, une demande, une vente —{' '}
          <strong>alors</strong> le site fait une action à votre place. Rien n'est publié ni envoyé
          sans votre relecture&nbsp;: les actions qui produisent du contenu déposent toujours un
          brouillon.
        </p>
      </Callout>

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

      {/* ── Éditeur ───────────────────────────────────────────────────── */}
      {draft && (
        <Card>
          <CardHeader
            title={draft.id ? "Modifier l'automatisation" : 'Nouvelle automatisation'}
            description="Choisissez d'abord quand elle se déclenche, puis ce qu'elle doit faire."
            actions={
              <Button variant="ghost" size="sm" icon={X} onClick={() => setDraft(null)}>
                Annuler
              </Button>
            }
          />
          <CardBody className="space-y-7">
            <Field
              label="Nom"
              htmlFor="automation-name"
              hint="Pour vous y retrouver dans la liste. Ex. « Publier le blog chaque matin »."
              required
            >
              <Input
                id="automation-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Publier le blog chaque matin"
              />
            </Field>

            {/* Étape 1 — le déclencheur */}
            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-stone-900">1. Quand faut-il agir ?</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {TRIGGER_CATALOG.map((trigger) => {
                  const Icon = TRIGGER_ICON[trigger.key];
                  const isActive = draft.trigger_type === trigger.key;
                  return (
                    <button
                      key={trigger.key}
                      type="button"
                      onClick={() => setDraft({ ...draft, trigger_type: trigger.key })}
                      aria-pressed={isActive}
                      className={`rounded-lg border p-3 text-left transition-colors cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                          isActive
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                    >
                      <span className="flex items-center gap-2 text-[13.5px] font-medium">
                        <Icon size={15} /> {trigger.label}
                      </span>
                      <span className={`mt-1 block text-[12.5px] leading-snug ${isActive ? 'text-stone-500' : 'text-stone-600'}`}>
                        {trigger.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {draft.trigger_type === 'schedule' && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Fréquence" htmlFor="automation-frequency">
                      <Select
                        id="automation-frequency"
                        value={draft.schedule.frequency}
                        onChange={(e) =>
                          setDraft({ ...draft, schedule: { ...draft.schedule, frequency: e.target.value as Schedule['frequency'] } })
                        }
                      >
                        <option value="hourly">Toutes les heures</option>
                        <option value="daily">Chaque jour</option>
                        <option value="weekly">Chaque semaine</option>
                        <option value="monthly">Chaque mois</option>
                        <option value="custom">Expression avancée (cron)</option>
                      </Select>
                    </Field>

                    {draft.schedule.frequency !== 'hourly' && draft.schedule.frequency !== 'custom' && (
                      <Field label="À quelle heure" htmlFor="automation-hour">
                        <Select
                          id="automation-hour"
                          value={String(draft.schedule.hour)}
                          onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, hour: Number(e.target.value) } })}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    {draft.schedule.frequency === 'weekly' && (
                      <Field label="Quel jour" htmlFor="automation-weekday">
                        <Select
                          id="automation-weekday"
                          value={String(draft.schedule.weekday)}
                          onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, weekday: Number(e.target.value) } })}
                        >
                          {WEEKDAYS.map((day) => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    {draft.schedule.frequency === 'monthly' && (
                      <Field label="Quel jour du mois" htmlFor="automation-monthday" hint="Limité à 28 : au-delà, certains mois sauteraient un passage.">
                        <Select
                          id="automation-monthday"
                          value={String(draft.schedule.monthday)}
                          onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, monthday: Number(e.target.value) } })}
                        >
                          {Array.from({ length: 28 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i === 0 ? '1er' : i + 1}</option>
                          ))}
                        </Select>
                      </Field>
                    )}

                    {draft.schedule.frequency === 'custom' && (
                      <Field label="Expression cron" htmlFor="automation-cron" hint="Cinq champs : minute, heure, jour du mois, mois, jour de la semaine." className="sm:col-span-2">
                        <Input
                          id="automation-cron"
                          value={draft.schedule.raw}
                          onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, raw: e.target.value } })}
                          placeholder="0 6 * * 1"
                          className="font-mono"
                        />
                      </Field>
                    )}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-stone-600">
                    <Clock size={13} className="text-stone-500" />
                    {describeCron(scheduleToCron(draft.schedule))}
                    {describeNextRun(scheduleToCron(draft.schedule)) && (
                      <> · prochaine fois {describeNextRun(scheduleToCron(draft.schedule))}</>
                    )}
                  </p>
                </div>
              )}

              {draft.trigger_type === 'event' && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <Field label="Quel événement" htmlFor="automation-event">
                    <Select
                      id="automation-event"
                      value={draft.event}
                      onChange={(e) => setDraft({ ...draft, event: e.target.value })}
                    >
                      {EVENT_CATALOG.map((event) => (
                        <option key={event.key} value={event.key}>{event.label}</option>
                      ))}
                    </Select>
                  </Field>
                  {(() => {
                    const event = EVENT_CATALOG.find((e) => e.key === draft.event);
                    return event ? (
                      <p className="mt-2 text-[12.5px] leading-relaxed text-stone-600">
                        {event.description} <span className="text-stone-500">{event.emitted}</span>
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            {/* Étape 2 — l'action */}
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-stone-900">2. Que faut-il faire ?</p>
              <Field htmlFor="automation-action">
                <Select
                  id="automation-action"
                  value={draft.action_type}
                  onChange={(e) => setDraft({ ...draft, action_type: e.target.value as ActionType, config: {} })}
                >
                  {(Object.keys(ACTION_CATALOG) as ActionType[]).map((key) => (
                    <option key={key} value={key}>{ACTION_CATALOG[key].label}</option>
                  ))}
                </Select>
              </Field>

              {spec && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
                  <p className="text-[13px] leading-relaxed text-stone-700">{spec.detail}</p>
                  {spec.requires && (
                    <p className="text-[12.5px] text-stone-600">
                      <span className="font-medium text-stone-800">Nécessite&nbsp;:</span> {spec.requires}
                    </p>
                  )}
                  {spec.publishes && (
                    <Callout tone="warning">
                      Cette action rend du contenu visible publiquement sans relecture.
                    </Callout>
                  )}
                  {spec.fields.length > 0 && (
                    <div className="grid gap-3 pt-1 sm:grid-cols-2">
                      {spec.fields.map((field) => (
                        <Field
                          key={field.key}
                          label={field.label}
                          htmlFor={`automation-field-${field.key}`}
                          hint={field.hint}
                          required={field.required}
                        >
                          <Input
                            id={`automation-field-${field.key}`}
                            type={field.type ?? 'text'}
                            value={draft.config[field.key] ?? ''}
                            placeholder={field.placeholder}
                            onChange={(e) => setDraft({ ...draft, config: { ...draft.config, [field.key]: e.target.value } })}
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">Activer tout de suite</p>
                <p className="text-[12.5px] text-stone-600">
                  En pause, l'automatisation reste enregistrée mais ne se déclenche jamais seule.
                </p>
              </div>
              <Toggle
                checked={draft.enabled}
                onChange={(next) => setDraft({ ...draft, enabled: next })}
                label="Activer l'automatisation"
              />
            </div>
          </CardBody>
          <CardFooter
            hint={
              draft.trigger_type === 'manual'
                ? 'Elle n’attendra que votre clic sur « Exécuter ».'
                : draft.trigger_type === 'schedule'
                  ? describeCron(scheduleToCron(draft.schedule))
                  : EVENT_CATALOG.find((e) => e.key === draft.event)?.label
            }
          >
            <Button variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
            <Button variant="primary" icon={Check} loading={saving} onClick={() => void handleSave()}>
              {draft.id ? 'Enregistrer' : "Créer l'automatisation"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Liste ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Vos automatisations"
          description={items.length > 0 ? `${items.length} configurée${items.length > 1 ? 's' : ''}.` : undefined}
          actions={
            !draft && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setDraft(emptyDraft())}>
                Nouvelle
              </Button>
            )
          }
        />
        {items.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Workflow}
              title="Aucune automatisation pour l'instant"
              description="Partez d'un modèle ci-dessous : c'est configuré, il ne reste qu'à vérifier le rythme."
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-stone-200">
            {items.map((automation) => {
              const history = runsByAutomation.get(automation.id) ?? [];
              const isOpen = openHistory === automation.id;
              const Icon = TRIGGER_ICON[automation.trigger_type];
              const nextRun =
                automation.enabled && automation.trigger_type === 'schedule'
                  ? describeNextRun(automation.trigger_config?.cron)
                  : null;
              return (
                <li key={automation.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-900">{automation.name}</span>
                        {!automation.enabled && <Badge>En pause</Badge>}
                        {automation.last_status === 'success' && <Badge tone="success"><Check size={11} /> Dernier passage réussi</Badge>}
                        {automation.last_status === 'error' && <Badge tone="danger"><XCircle size={11} /> Dernier passage en échec</Badge>}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-stone-600">
                        <Icon size={13} className="shrink-0 text-stone-500" />
                        {summarize(automation)}
                      </p>
                      {nextRun && (
                        <p className="mt-0.5 text-[12.5px] text-stone-500">Prochaine fois&nbsp;: {nextRun}</p>
                      )}
                      {!automation.enabled && (
                        <p className="mt-0.5 text-[12.5px] text-stone-500">
                          En pause — elle ne se déclenchera pas toute seule.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Toggle
                        checked={automation.enabled}
                        onChange={async (next) => { await toggleAutomation(automation.id, next); await load(); }}
                        label={`${automation.enabled ? 'Mettre en pause' : 'Activer'} ${automation.name}`}
                      />
                      <Button
                        size="sm"
                        icon={busy === automation.id ? undefined : Play}
                        loading={busy === automation.id}
                        onClick={() => void handleRun(automation)}
                      >
                        Exécuter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        aria-label={`Modifier ${automation.name}`}
                        onClick={() => { setDraft(draftFromAutomation(automation)); setMessage(null); }}
                      >
                        <span className="sr-only sm:not-sr-only">Modifier</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Supprimer ${automation.name}`}
                        onClick={async () => {
                          if (!confirm(`Supprimer « ${automation.name} » ? Son journal d'exécutions sera perdu.`)) return;
                          await deleteAutomation(automation.id);
                          await load();
                        }}
                      >
                        <Trash2 size={15} className="text-stone-500" />
                      </Button>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setOpenHistory(isOpen ? null : automation.id)}
                        aria-expanded={isOpen}
                        className="flex items-center gap-1 text-[12.5px] font-medium text-stone-600 transition-colors hover:text-stone-900 cursor-pointer"
                      >
                        <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        {history.length} passage{history.length > 1 ? 's' : ''} enregistré{history.length > 1 ? 's' : ''}
                      </button>
                      {isOpen && (
                        <ul className="mt-2 space-y-1 rounded-lg border border-stone-200 bg-stone-50 p-3">
                          {history.slice(0, 8).map((run) => (
                            <li key={run.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
                              {run.status === 'success' ? (
                                <Check size={12} className="shrink-0 translate-y-0.5 text-emerald-600" />
                              ) : run.status === 'error' ? (
                                <XCircle size={12} className="shrink-0 translate-y-0.5 text-red-600" />
                              ) : (
                                <Loader2 size={12} className="shrink-0 translate-y-0.5 animate-spin text-stone-500" />
                              )}
                              <span className="tabular-nums text-stone-700">
                                {new Date(run.started_at).toLocaleString('fr-CH')}
                              </span>
                              <span className="text-stone-500">
                                {run.triggered_by === 'manual' ? 'lancée à la main'
                                  : run.triggered_by === 'schedule' ? 'passage planifié'
                                  : run.triggered_by.startsWith('event:') ? 'déclenchée par un événement'
                                  : run.triggered_by}
                              </span>
                              {run.error && <span className="w-full text-red-700">{run.error}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Modèles ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Modèles prêts à l'emploi"
          description="Le plus dur n'est pas de remplir le formulaire, c'est de savoir quoi automatiser. Partez de là."
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2">
            {AUTOMATION_RECIPES.map((recipe) => {
              const already = usedRecipes.has(`${recipe.trigger_type}:${recipe.action_type}`);
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => { setDraft(draftFromRecipe(recipe)); setMessage(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="group flex h-full w-full flex-col items-start gap-1 rounded-lg border border-stone-200 bg-white p-4 text-left transition-colors hover:border-stone-400 hover:bg-stone-50 cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium text-stone-900">{recipe.name}</span>
                      {already ? (
                        <Badge tone="success"><Check size={11} /> en place</Badge>
                      ) : (
                        <ArrowRight size={14} className="shrink-0 text-stone-500 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </span>
                    <span className="text-[12.5px] leading-relaxed text-stone-600">{recipe.summary}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-stone-500">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-stone-500" />
            Un modèle ouvre le formulaire pré-rempli. Rien n'est enregistré tant que vous n'avez pas
            validé, et tout reste modifiable ensuite.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
