"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Facebook, Instagram, RefreshCw, Unplug } from 'lucide-react';
import { Button, Callout, Card, CardBody, CardFooter, CardHeader, Field, Input } from '../../../components/admin/ui';
import { api, type MetaStatus } from './api';
import ReelSettings from './ReelSettings';

interface Props {
  status: MetaStatus | null;
  loading: boolean;
  /** Message rapporté par le retour de Facebook (?comptes=…). */
  notice: { tone: 'success' | 'danger' | 'info'; text: string } | null;
  askPageChoice: boolean;
  onRefresh: () => Promise<void> | void;
  onBack: () => void;
}

interface ChoosablePage {
  id: string;
  name: string;
  instagram: { id: string; username: string } | null;
}

export default function AccountsPanel({ status, loading, notice, askPageChoice, onRefresh, onBack }: Props) {
  const [message, setMessage] = useState(notice);
  const [busy, setBusy] = useState<string | null>(null);
  const [pages, setPages] = useState<ChoosablePage[] | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => setMessage(notice), [notice]);
  useEffect(() => {
    if (status && (!status.app.configured || status.app.problem)) setShowSetup(true);
  }, [status]);

  const needsChoice = Boolean(status && (status.needsPageChoice || askPageChoice));
  useEffect(() => {
    if (!needsChoice) return;
    api<{ pages: ChoosablePage[] }>('/api/admin/meta/status', { action: 'list_pages' })
      .then((r) => setPages(r.pages))
      .catch((e) => setMessage({ tone: 'danger', text: e.message }));
  }, [needsChoice]);

  const connect = async () => {
    setBusy('connect');
    setMessage(null);
    try {
      const { url } = await api<{ url: string }>('/api/admin/meta/login', {});
      window.location.assign(url);
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e.message });
      setBusy(null);
    }
  };

  const choose = async (pageId: string) => {
    setBusy(pageId);
    try {
      await api('/api/admin/meta/status', { action: 'choose_page', pageId });
      setPages(null);
      setMessage({ tone: 'success', text: 'Page choisie : les publications partiront sur ce compte.' });
      await onRefresh();
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Déconnecter Facebook et Instagram ? Les publications programmées échoueront tant qu’ils ne seront pas reliés à nouveau.')) return;
    setBusy('disconnect');
    try {
      await api('/api/admin/meta/status', { action: 'disconnect' });
      setMessage({ tone: 'info', text: 'Comptes déconnectés.' });
      await onRefresh();
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy('verify');
    setMessage(null);
    await onRefresh();
    setBusy(null);
  };

  const healthy = status?.connected && status.health === 'ok';
  // Le cookie de connexion vit sur l'adresse ouverte : elle doit être celle que Facebook connaît.
  const siteOrigin = status ? new URL(status.redirectUri).origin : null;
  const wrongOrigin = Boolean(siteOrigin && typeof window !== 'undefined' && window.location.origin !== siteOrigin);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-stone-700 hover:text-stone-950 cursor-pointer">
        <ArrowLeft size={15} /> Retour aux publications
      </button>

      {message && <Callout tone={message.tone}>{message.text}</Callout>}
      {wrongOrigin && siteOrigin && !siteOrigin.includes('localhost') && (
        <Callout tone="warning" title="Ouvrez l’admin depuis l’adresse du site">
          Pour relier les comptes, passez par <a className="font-semibold underline" href={`${siteOrigin}/admin/social`}>{siteOrigin}/admin/social</a> :
          c’est la seule adresse déclarée dans l’application Meta.
        </Callout>
      )}

      <Card>
        <CardHeader
          title="Comptes Facebook et Instagram"
          description="Les publications partent sur la Page Facebook et sur le compte Instagram professionnel qui lui est relié."
        />
        <CardBody className="space-y-3">
          <AccountLine
            icon={Facebook}
            label="Facebook"
            value={status?.page ? status.page.name : null}
            ok={Boolean(healthy && status?.page)}
            loading={loading}
          />
          <AccountLine
            icon={Instagram}
            label="Instagram"
            value={status?.instagram ? `@${status.instagram.username || status.instagram.id}` : null}
            ok={Boolean(healthy && status?.instagram)}
            loading={loading}
          />
          {status?.userName && (
            <p className="text-[13px] text-stone-600">Connexion faite avec le compte Facebook de {status.userName}.</p>
          )}
          {status?.health === 'expired' && (
            <Callout tone="danger" title="La connexion a expiré">
              Facebook ne reconnaît plus l’autorisation donnée (mot de passe changé, accès retiré…). Cliquez « Reconnecter ».
            </Callout>
          )}
          {status?.health === 'error' && status.healthMessage && <Callout tone="warning">{status.healthMessage}</Callout>}
          {status?.health === 'ok' && status.healthMessage && <Callout tone="warning">{status.healthMessage}</Callout>}
          {status?.health === 'disconnected' && status.healthMessage && <Callout tone="warning">{status.healthMessage}</Callout>}
          {status?.app.problem && <Callout tone="danger" title="Application Meta">{status.app.problem}</Callout>}
        </CardBody>
        <CardFooter hint={status?.app.configured && !status.app.problem ? undefined : 'Commencez par l’étape « Application Meta » ci-dessous.'}>
          {status?.connected && (
            <>
              <Button variant="ghost" icon={Unplug} onClick={disconnect} loading={busy === 'disconnect'}>Déconnecter</Button>
              <Button icon={RefreshCw} onClick={verify} loading={busy === 'verify'}>Vérifier</Button>
            </>
          )}
          <Button variant="primary" icon={Facebook} onClick={connect} loading={busy === 'connect'} disabled={!status?.app.configured || Boolean(status?.app.problem)}>
            {status?.connected ? 'Reconnecter' : 'Relier Facebook et Instagram'}
          </Button>
        </CardFooter>
      </Card>

      {needsChoice && (
        <Card>
          <CardHeader title="Quelle Page utiliser ?" description="Ce compte Facebook gère plusieurs Pages. Choisissez celle de l’institut." />
          <CardBody className="space-y-2">
            {!pages && <p className="text-[14px] text-stone-600">Lecture des Pages…</p>}
            {pages?.length === 0 && <p className="text-[14px] text-stone-600">Aucune Page accessible. Reconnectez le compte en cochant la Page.</p>}
            {pages?.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{p.name}</p>
                  <p className="text-[13px] text-stone-600">{p.instagram ? `Instagram : @${p.instagram.username}` : 'Pas de compte Instagram relié'}</p>
                </div>
                <Button size="sm" variant={p.instagram ? 'primary' : 'secondary'} onClick={() => choose(p.id)} loading={busy === p.id}>
                  Utiliser cette Page
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Application Meta"
          description="À faire une seule fois : l’application Meta autorise ce site à publier pour vous."
          actions={
            status?.app.configured ? (
              <Button size="sm" variant="ghost" onClick={() => setShowSetup((v) => !v)}>
                {showSetup ? 'Masquer' : 'Modifier'}
              </Button>
            ) : undefined
          }
        />
        {status?.app.configured && !status.app.problem && !showSetup && (
          <CardBody>
            <p className="flex items-center gap-2 text-[14px] text-stone-700">
              <Check size={15} className="text-emerald-700" /> Application configurée (App ID {status.app.appId}).
            </p>
          </CardBody>
        )}
        {showSetup && status && <MetaAppSetup status={status} onSaved={async (text) => { setMessage({ tone: 'success', text }); setShowSetup(false); await onRefresh(); }} />}
      </Card>

      <ReelSettings />
    </div>
  );
}

function AccountLine({ icon: Icon, label, value, ok, loading }: { icon: React.ElementType; label: string; value: string | null; ok: boolean; loading: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3">
      <Icon size={18} className="shrink-0 text-stone-700" />
      <span className="w-24 shrink-0 text-[14px] font-semibold text-stone-900">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-stone-700">{loading ? 'Vérification…' : value || 'Non relié'}</span>
      {!loading && (ok
        ? <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700"><Check size={14} /> Relié</span>
        : <span className="text-[13px] text-stone-500">—</span>)}
    </div>
  );
}

function MetaAppSetup({ status, onSaved }: { status: MetaStatus; onSaved: (text: string) => void }) {
  const [appId, setAppId] = useState(status.app.appId);
  const [appSecret, setAppSecret] = useState('');
  const [configId, setConfigId] = useState(status.app.configId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await api<{ appName: string }>('/api/admin/meta/status', { action: 'save_app', appId, appSecret, configId });
      setAppSecret('');
      onSaved(`Application « ${r.appName || appId} » vérifiée auprès de Meta. Vous pouvez relier les comptes.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(status.redirectUri).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // autoComplete off : le navigateur proposait d'y enregistrer un mot de passe.
    <form onSubmit={save} autoComplete="off">
      <CardBody className="space-y-5">
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-stone-700">
          <li>
            Sur <a className="font-semibold text-accent underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com <ExternalLink size={12} className="inline" /></a>,
            ouvrez votre application (type « Entreprise »), puis <strong>Paramètres › Général</strong> : copiez l’<strong>ID de l’app</strong> et la <strong>Clé secrète</strong> ci-dessous.
          </li>
          <li>
            Toujours dans <strong>Paramètres › Général</strong> : inscrivez <strong>{new URL(status.redirectUri).hostname}</strong> dans
            « Domaines de l’app », et, tout en bas, « Ajouter une plateforme » › <strong>Site web</strong> avec l’adresse{' '}
            <strong>{new URL(status.redirectUri).origin}/</strong>. Enregistrez. Sans cela, Facebook répond « Impossible de charger cette URL ».
          </li>
          <li>
            Dans <strong>Facebook Login › Paramètres</strong>, collez cette adresse dans « URI de redirection OAuth valides » :
            <span className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2.5 py-1.5 text-[13px] text-stone-900">{status.redirectUri}</code>
              <Button type="button" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copiée' : 'Copier'}</Button>
            </span>
          </li>
          <li>
            Tant que l’app est en mode « Développement », la personne qui relie les comptes doit figurer dans <strong>Rôles de l’app</strong> (administratrice ou testeuse).
          </li>
          <li>
            Côté Facebook, ce compte doit gérer la Page avec un <strong>contrôle total</strong>, et le compte Instagram doit être <strong>professionnel</strong> et relié à la Page.
          </li>
        </ol>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ID de l’app (App ID)" htmlFor="meta-app-id">
            <Input id="meta-app-id" inputMode="numeric" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890123456" autoComplete="off" />
          </Field>
          <Field
            label="Clé secrète (App Secret)"
            htmlFor="meta-app-secret"
            hint={status.app.configured ? 'Laissez vide pour garder la clé enregistrée.' : '32 caractères. Elle reste sur le serveur, jamais dans le navigateur.'}
          >
            <Input
              id="meta-app-secret"
              type="text"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={status.app.configured ? '••••••••••••••••' : 'a1b2c3…'}
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              style={{ WebkitTextSecurity: appSecret ? 'disc' : 'none' } as React.CSSProperties}
            />
          </Field>
        </div>
        <details className="text-[14px] text-stone-700">
          <summary className="cursor-pointer font-semibold text-stone-800">Option avancée : Facebook Login for Business</summary>
          <div className="mt-3">
            <Field label="ID de configuration" htmlFor="meta-config-id" hint="Seulement si votre app utilise « Facebook Login for Business » : la configuration remplace la liste d’autorisations.">
              <Input id="meta-config-id" value={configId} onChange={(e) => setConfigId(e.target.value)} autoComplete="off" />
            </Field>
          </div>
        </details>
        {error && <Callout tone="danger">{error}</Callout>}
      </CardBody>
      <CardFooter>
        <Button type="submit" variant="primary" loading={saving} disabled={!appId.trim() || (!status.app.configured && !appSecret.trim())}>
          Vérifier et enregistrer
        </Button>
      </CardFooter>
    </form>
  );
}
