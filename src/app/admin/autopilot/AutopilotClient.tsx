"use client";

import React, { useEffect, useState } from 'react';
import { BarChart2, Play, Workflow } from 'lucide-react';
import {
  Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  FormMessage, LinkButton, PageHeader, Spinner, ToggleRow,
} from '../../../components/admin/ui';
import { supabase } from '../../../services/supabase';

type Frequency = 'weekly_1' | 'weekly_2' | 'monthly_1';
type Mode = 'autonomous' | 'review_required';
type Message = { type: 'success' | 'error'; text: string } | null;

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  cover_image: string | null;
}

const FREQUENCIES: { id: Frequency; label: string; desc: string }[] = [
  { id: 'weekly_1', label: 'Un article par semaine', desc: 'Rythme conseillé.' },
  { id: 'weekly_2', label: 'Deux articles par semaine', desc: 'Tous les trois à quatre jours.' },
  { id: 'monthly_1', label: 'Un article par mois', desc: 'Pour garder le blog vivant sans effort.' },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  {
    id: 'review_required',
    label: 'Brouillon à relire',
    desc: "L'article est déposé en brouillon dans le Blog. Vous le relisez et le publiez vous-même.",
  },
  {
    id: 'autonomous',
    label: 'Publication directe',
    desc: "L'article est mis en ligne sans relecture, puis annoncé sur les réseaux sociaux connectés.",
  },
];

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

const SESSION_EXPIRED = 'Votre session a expiré. Reconnectez-vous puis réessayez.';

export default function AutopilotClient() {
  // Réglages tels qu'enregistrés : rien n'est affiché avant la réponse du
  // serveur (l'écran annonçait « actif » par défaut, même quand il ne l'était pas).
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('weekly_1');
  const [mode, setMode] = useState<Mode>('autonomous');
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<Message>(null);
  const [runMessage, setRunMessage] = useState<Message>(null);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);

  useEffect(() => {
    void loadAutopilotStatus();
    void loadRecentPublishedArticles();
  }, []);

  // `silent` : rafraîchit après un cycle sans remplacer l'écran par le spinner.
  const loadAutopilotStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setLoadError(SESSION_EXPIRED);
        return;
      }
      const res = await fetch('/api/admin/autopilot', { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setLoadError(
          res.status === 401
            ? SESSION_EXPIRED
            : `Les réglages n'ont pas pu être chargés${data?.error ? ` (${data.error})` : ''}. Rechargez la page.`,
        );
        return;
      }
      setEnabled(Boolean(data.enabled));
      setFrequency(data.frequency || 'weekly_1');
      setMode(data.mode || 'autonomous');
      setLastRunAt(data.lastRunAt || null);
    } catch {
      setLoadError('Le serveur ne répond pas. Vérifiez votre connexion puis rechargez la page.');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentPublishedArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('id, title, slug, created_at, cover_image')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentArticles((data as RecentArticle[] | null) || []);
  };

  /**
   * Enregistre un changement de réglage. L'affichage change tout de suite ; en
   * cas d'échec, il revient à la valeur précédente et l'erreur est affichée
   * (avant, un échec passait inaperçu et l'écran mentait).
   */
  const handleSaveSettings = async (patch: Partial<{ enabled: boolean; frequency: Frequency; mode: Mode }>) => {
    const previous = { enabled, frequency, mode };
    const next = { ...previous, ...patch };
    setEnabled(next.enabled);
    setFrequency(next.frequency);
    setMode(next.mode);
    setSaving(true);
    setSettingsMessage(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error(SESSION_EXPIRED);
      const res = await fetch('/api/admin/autopilot', {
        method: 'POST',
        headers,
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(res.status === 401 ? SESSION_EXPIRED : data?.error || 'Enregistrement impossible.');
      }
      if (data.config) {
        setEnabled(Boolean(data.config.enabled));
        setFrequency(data.config.frequency);
        setMode(data.config.mode);
      }
      setSettingsMessage({ type: 'success', text: 'Réglages enregistrés.' });
    } catch (e) {
      setEnabled(previous.enabled);
      setFrequency(previous.frequency);
      setMode(previous.mode);
      setSettingsMessage({ type: 'error', text: `Réglage non enregistré : ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    const effect = mode === 'autonomous'
      ? "L'article sera publié sur le blog sans relecture, puis annoncé sur les réseaux sociaux connectés."
      : "L'article sera déposé en brouillon dans le Blog, à relire avant publication.";
    if (!confirm(`Lancer un cycle maintenant ?\n\nL'IA va rédiger un article à partir du prochain sujet du Hub Mots-clés (génération facturée sur votre budget IA).\n${effect}`)) return;

    setRunningNow(true);
    setRunMessage(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error(SESSION_EXPIRED);
      const res = await fetch('/api/admin/autopilot', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'trigger_now' }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) throw new Error(SESSION_EXPIRED);
      // Netlify coupe une fonction trop longue et renvoie une page d'erreur
      // (502/504, sans JSON) : on l'explique au lieu d'un échec muet.
      if (!data && (res.status === 502 || res.status === 504)) {
        throw new Error("La rédaction a dépassé le temps de réponse autorisé par l'hébergeur. Vérifiez le Blog dans quelques minutes : si aucun nouvel article n'y figure, relancez le cycle.");
      }
      if (!data?.ok) throw new Error(data?.error || "Le cycle n'a pas abouti. Réessayez dans quelques minutes.");
      setRunMessage({
        type: 'success',
        text: data.published === false
          ? `Brouillon créé : « ${data.articleTitle} ». Relisez-le depuis le Blog avant de le publier.`
          : `Article publié : « ${data.articleTitle} ».`,
      });
      void loadRecentPublishedArticles();
      void loadAutopilotStatus(true);
    } catch (e) {
      setRunMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setRunningNow(false);
    }
  };

  const header = (
    <PageHeader
      title="Pilote automatique"
      description="Rédige un article de blog à partir des sujets en attente dans le Hub Mots-clés, puis le publie ou le dépose en brouillon, selon votre choix."
      actions={
        <LinkButton href="/admin/seo" icon={BarChart2}>
          Hub Mots-clés
        </LinkButton>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <Spinner label="Chargement des réglages…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <Callout tone="danger" title="Réglages indisponibles">
          {loadError}
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Aucune tâche planifiée n'appelle le pilote : on le dit plutôt que
          d'annoncer une « prochaine publication » qui n'aura pas lieu. */}
      <Callout
        tone="warning"
        title="Les cycles ne partent pas encore tout seuls"
        actions={
          <LinkButton href="/admin/automations" size="sm" icon={Workflow}>
            Automatisations
          </LinkButton>
        }
      >
        Pour l'instant, un article n'est rédigé que lorsque vous cliquez sur « Lancer un cycle maintenant ».
        Pour une rédaction régulière, créez plutôt une automatisation « Rédiger un brouillon d'article ».
      </Callout>

      <Card>
        <CardHeader
          title="Réglages"
          description="Chaque changement est enregistré aussitôt."
          actions={saving ? <Spinner label="Enregistrement…" /> : undefined}
        />
        <CardBody className="space-y-6">
          <ToggleRow
            title="Pilote automatique activé"
            description={enabled ? 'Les réglages ci-dessous seront appliqués aux prochains cycles.' : 'En pause : aucun cycle ne sera lancé.'}
            checked={enabled}
            disabled={saving}
            onChange={(next) => void handleSaveSettings({ enabled: next })}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[15px] font-semibold text-stone-900">Rythme</legend>
              {FREQUENCIES.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    frequency === item.id ? 'border-accent bg-accent-soft' : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="autopilot-frequency"
                    checked={frequency === item.id}
                    disabled={saving}
                    onChange={() => void handleSaveSettings({ frequency: item.id })}
                    className="mt-1 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold text-stone-900">{item.label}</span>
                    <span className="block text-[13px] text-stone-600">{item.desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-[15px] font-semibold text-stone-900">Après la rédaction</legend>
              {MODES.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    mode === item.id ? 'border-accent bg-accent-soft' : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="autopilot-mode"
                    checked={mode === item.id}
                    disabled={saving}
                    onChange={() => void handleSaveSettings({ mode: item.id })}
                    className="mt-1 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold text-stone-900">{item.label}</span>
                    <span className="block text-[13px] text-stone-600">{item.desc}</span>
                  </span>
                </label>
              ))}
              {mode === 'autonomous' && (
                <Callout tone="warning">
                  Un article rédigé par l'IA sera visible sur le site sans que vous l'ayez relu.
                </Callout>
              )}
            </fieldset>
          </div>

          <FormMessage message={settingsMessage} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Lancer un cycle"
          description="L'IA prend le prochain sujet du Hub Mots-clés et rédige l'article. Comptez jusqu'à une minute."
        />
        <CardBody className="space-y-3">
          <p className="text-[14px] text-stone-700">
            {lastRunAt
              ? `Dernier cycle : ${new Date(lastRunAt).toLocaleString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`
              : "Aucun cycle n'a encore été lancé."}
          </p>
          <FormMessage message={runMessage} />
        </CardBody>
        <CardFooter hint="Le sujet utilisé est retiré du Hub Mots-clés.">
          <Button variant="primary" icon={Play} loading={runningNow} onClick={() => void handleRunNow()}>
            {runningNow ? 'Rédaction en cours…' : 'Lancer un cycle maintenant'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Derniers articles en ligne"
          description="Les cinq derniers articles publiés sur le blog, quelle que soit leur origine."
          actions={
            <LinkButton href="/admin/blog" variant="ghost" size="sm">
              Voir le blog
            </LinkButton>
          }
        />
        {recentArticles.length === 0 ? (
          <CardBody>
            <EmptyState
              title="Aucun article publié pour l'instant"
              description="Les articles apparaîtront ici dès leur mise en ligne."
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-stone-200">
            {recentArticles.map((art) => (
              <li key={art.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {art.cover_image && (
                    <img src={art.cover_image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-stone-900">{art.title}</p>
                    <p className="text-[13px] text-stone-600">
                      Publié le {new Date(art.created_at).toLocaleDateString('fr-CH')} · /blog/{art.slug}
                    </p>
                  </div>
                </div>
                <Badge tone="success">En ligne</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
