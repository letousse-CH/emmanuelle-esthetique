/**
 * Connexion Facebook + Instagram (serveur uniquement).
 *
 * Où vit quoi :
 *  - `app_secrets` (jamais lisible hors clé de service) : App Secret, jeton
 *    utilisateur longue durée, jeton de Page. Avant le 2026-10-20 ils étaient
 *    dans `settings`, lisible par n'importe quel visiteur.
 *  - `settings` (non secret) : App ID, identifiants et noms de la Page et du
 *    compte Instagram, nom de la personne connectée — de quoi afficher l'état.
 *
 * Le jeton de Page, obtenu à partir d'un jeton utilisateur longue durée,
 * n'expire pas : c'est lui qui publie, sur Facebook comme sur Instagram. Le
 * jeton utilisateur (60 jours) ne sert qu'à relister les Pages.
 */
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { getSecret, invalidateSecret } from './secrets';
import { graphGet, MetaError } from './metaGraph';

export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  // Pages rangées dans un portefeuille Business (Meta Business Suite).
  'business_management',
];

/** Autorisations sans lesquelles on ne peut pas publier. */
const REQUIRED_SCOPES = ['pages_show_list', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'];

const SCOPE_LABEL: Record<string, string> = {
  pages_show_list: 'voir vos Pages',
  pages_read_engagement: 'lire le contenu de la Page',
  pages_manage_posts: 'publier sur la Page',
  instagram_basic: 'voir le compte Instagram',
  instagram_content_publish: 'publier sur Instagram',
  business_management: 'accéder au portefeuille Business',
};

const SETTING_KEYS = [
  'social_meta_app_id',
  'social_meta_config_id',
  'social_meta_user_name',
  'social_facebook_page_id',
  'social_facebook_page_name',
  'social_instagram_account_id',
  'social_instagram_username',
] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('La clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) manque sur le serveur.');
  return admin;
}

async function readSettings(): Promise<Record<SettingKey, string>> {
  const { data, error } = await db().from('settings').select('key, value').in('key', SETTING_KEYS as unknown as string[]);
  if (error) throw new Error(`Réglages illisibles : ${error.message}`);
  const map = Object.fromEntries(SETTING_KEYS.map((k) => [k, ''])) as Record<SettingKey, string>;
  for (const row of data ?? []) map[row.key as SettingKey] = String(row.value ?? '').trim();
  return map;
}

async function writeSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: value ?? '' }));
  if (!rows.length) return;
  const { error } = await db().from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(`Réglages non enregistrés : ${error.message}`);
}

type SecretKey = 'meta_app_secret' | 'meta_user_token' | 'meta_page_token';

async function writeSecret(key: SecretKey, value: string): Promise<void> {
  const v = value.trim();
  const q = v
    ? db().from('app_secrets').upsert({ key, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    : db().from('app_secrets').delete().eq('key', key);
  const { error } = await q;
  invalidateSecret(key);
  if (error) throw new Error(`Jeton non enregistré : ${error.message}`);
}

// ── Application Meta ─────────────────────────────────────────────────────────

export interface MetaApp {
  appId: string;
  appSecret: string;
  configId: string;
}

export async function getMetaApp(): Promise<MetaApp> {
  const s = await readSettings();
  return {
    appId: s.social_meta_app_id || process.env.META_APP_ID?.trim() || '',
    appSecret: (await getSecret('meta_app_secret')) || process.env.META_APP_SECRET?.trim() || '',
    configId: s.social_meta_config_id || process.env.META_CONFIG_ID?.trim() || '',
  };
}

/** Vérifie l'App ID et l'App Secret auprès de Meta avant de les enregistrer. */
export async function saveMetaApp(input: { appId: string; appSecret?: string; configId?: string }): Promise<{ name: string }> {
  const appId = input.appId.replace(/\s/g, '');
  if (!/^\d{6,20}$/.test(appId)) throw new Error('L’App ID est un nombre (developers.facebook.com › votre app › Paramètres › Général).');
  const current = await getMetaApp();
  const appSecret = (input.appSecret || '').replace(/\s/g, '') || current.appSecret;
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) {
    throw new Error('L’App Secret compte 32 caractères (0-9, a-f). Cliquez « Afficher » à côté de « Clé secrète » dans Meta.');
  }

  let name = '';
  try {
    const app = await graphGet<{ name?: string }>(appId, { fields: 'name', access_token: `${appId}|${appSecret}` });
    name = app.name || '';
  } catch (err) {
    if (err instanceof MetaError && !err.uncertain) {
      throw new Error('Meta refuse cet App ID et cet App Secret ensemble : vérifiez qu’ils viennent de la même application, ou réinitialisez la clé secrète.');
    }
    throw err;
  }

  await writeSettings({ social_meta_app_id: appId, social_meta_config_id: (input.configId || '').trim() });
  await writeSecret('meta_app_secret', appSecret);
  return { name };
}

// ── Pages et comptes ─────────────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagram: { id: string; username: string } | null;
}

interface RawPage {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
}

const PAGE_FIELDS = 'id,name,access_token,instagram_business_account{id,username}';

function toPage(p: RawPage): MetaPage | null {
  if (!p?.id || !p.access_token) return null;
  return {
    id: p.id,
    name: p.name || p.id,
    accessToken: p.access_token,
    instagram: p.instagram_business_account?.id
      ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || '' }
      : null,
  };
}

/**
 * Pages que ce jeton peut gérer : d'abord celles de la personne, puis celles
 * de ses portefeuilles Business (une Page rangée dans Meta Business Suite
 * n'apparaît pas toujours dans la première liste).
 */
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const found = new Map<string, MetaPage>();
  const mine = await graphGet<{ data: RawPage[] }>('me/accounts', { fields: PAGE_FIELDS, limit: 100, access_token: userToken });
  for (const p of mine.data ?? []) {
    const page = toPage(p);
    if (page) found.set(page.id, page);
  }

  try {
    const businesses = await graphGet<{ data: { id: string }[] }>('me/businesses', { fields: 'id', limit: 25, access_token: userToken });
    for (const b of businesses.data ?? []) {
      for (const edge of ['owned_pages', 'client_pages']) {
        const res = await graphGet<{ data: RawPage[] }>(`${b.id}/${edge}`, { fields: PAGE_FIELDS, limit: 100, access_token: userToken })
          .catch(() => ({ data: [] as RawPage[] }));
        for (const p of res.data ?? []) {
          const page = toPage(p);
          if (page && !found.has(page.id)) found.set(page.id, page);
        }
      }
    }
  } catch {
    // Pas de portefeuille Business, ou autorisation business_management refusée.
  }

  return [...found.values()];
}

/** Autorisations refusées, dites en français (liste vide = tout est accordé). */
export async function missingPermissions(userToken: string): Promise<string[]> {
  const res = await graphGet<{ data: { permission: string; status: string }[] }>('me/permissions', { access_token: userToken });
  const granted = new Set((res.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission));
  return REQUIRED_SCOPES.filter((s) => !granted.has(s)).map((s) => SCOPE_LABEL[s] || s);
}

async function selectPageFrom(page: MetaPage): Promise<void> {
  await writeSecret('meta_page_token', page.accessToken);
  await writeSettings({
    social_facebook_page_id: page.id,
    social_facebook_page_name: page.name,
    social_instagram_account_id: page.instagram?.id || '',
    social_instagram_username: page.instagram?.username || '',
  });
}

export type ConnectOutcome =
  | { kind: 'connected'; page: MetaPage }
  | { kind: 'choose'; pages: MetaPage[] };

/**
 * Fin de la connexion OAuth : échange du code, jeton longue durée, choix de
 * la Page. Lève une erreur en français si quelque chose manque.
 */
export async function completeOAuth(code: string, redirectUri: string): Promise<ConnectOutcome> {
  const app = await getMetaApp();
  if (!app.appId || !app.appSecret) throw new Error('Renseignez d’abord l’App ID et l’App Secret de l’application Meta.');

  const short = await graphGet<{ access_token: string }>('oauth/access_token', {
    client_id: app.appId,
    client_secret: app.appSecret,
    redirect_uri: redirectUri,
    code,
  });
  // Jeton longue durée (60 jours) : les jetons de Page qui en découlent n'expirent pas.
  const long = await graphGet<{ access_token: string }>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: app.appId,
    client_secret: app.appSecret,
    fb_exchange_token: short.access_token,
  });
  const userToken = long.access_token;

  const me = await graphGet<{ id: string; name?: string }>('me', { fields: 'id,name', access_token: userToken });
  await writeSecret('meta_user_token', userToken);
  await writeSettings({ social_meta_user_name: me.name || '' });

  const missing = await missingPermissions(userToken);
  if (missing.length) {
    throw new Error(
      `Connecté en tant que ${me.name || 'vous'}, mais Meta n’a pas accordé : ${missing.join(', ')}. ` +
      'Relancez la connexion et laissez toutes les cases cochées.',
    );
  }

  const pages = await listPages(userToken);
  if (!pages.length) {
    throw new Error(
      `Connecté en tant que ${me.name || 'vous'}, mais aucune Page Facebook n’a été autorisée. ` +
      'Relancez la connexion et, à l’étape « Choisir les Pages », cochez la Page de l’institut. ' +
      'Ce compte Facebook doit être administrateur de la Page (accès Facebook avec contrôle total).',
    );
  }

  const current = (await readSettings()).social_facebook_page_id;
  const pick = pages.length === 1 ? pages[0] : pages.find((p) => p.id === current);
  if (pick) {
    await selectPageFrom(pick);
    return { kind: 'connected', page: pick };
  }
  return { kind: 'choose', pages };
}

/** Choix de la Page quand le compte en gère plusieurs. */
export async function choosePage(pageId: string): Promise<MetaPage> {
  const userToken = await getSecret('meta_user_token');
  if (!userToken) throw new Error('Reconnectez d’abord le compte Facebook.');
  const page = (await listPages(userToken)).find((p) => p.id === pageId);
  if (!page) throw new Error('Cette Page n’est plus accessible avec la connexion actuelle.');
  await selectPageFrom(page);
  return page;
}

export async function listChoosablePages(): Promise<Array<Omit<MetaPage, 'accessToken'>>> {
  const userToken = await getSecret('meta_user_token');
  if (!userToken) return [];
  return (await listPages(userToken)).map(({ accessToken: _t, ...p }) => p);
}

export async function disconnectMeta(): Promise<void> {
  await writeSecret('meta_user_token', '');
  await writeSecret('meta_page_token', '');
  await writeSettings({
    social_meta_user_name: '',
    social_facebook_page_id: '',
    social_facebook_page_name: '',
    social_instagram_account_id: '',
    social_instagram_username: '',
  });
}

// ── État et identifiants de publication ──────────────────────────────────────

export interface MetaPublishTarget {
  pageId: string;
  pageToken: string;
  instagramId: string | null;
}

export async function getPublishTarget(): Promise<MetaPublishTarget | null> {
  const [s, pageToken] = await Promise.all([readSettings(), getSecret('meta_page_token')]);
  if (!s.social_facebook_page_id || !pageToken) return null;
  return { pageId: s.social_facebook_page_id, pageToken, instagramId: s.social_instagram_account_id || null };
}

export interface MetaStatus {
  /** `problem` : Meta refuse l'App ID et l'App Secret ensemble (vérifié tant que rien n'est relié). */
  app: { configured: boolean; appId: string; configId: string; problem: string | null };
  connected: boolean;
  userName: string;
  page: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
  /** ok : Meta a répondu avec ce jeton à l'instant ; expired : à reconnecter. */
  health: 'ok' | 'expired' | 'error' | 'disconnected';
  healthMessage: string | null;
  /** Le compte gère plusieurs Pages et aucune n'est choisie. */
  needsPageChoice: boolean;
}

/**
 * État réel de la connexion : on interroge Meta avec le jeton de Page plutôt
 * que de croire les réglages (un jeton retiré côté Facebook ne prévient pas).
 * Met à jour le nom de la Page et le compte Instagram au passage.
 */
export async function getMetaStatus(): Promise<MetaStatus> {
  const [s, app, pageToken, userToken] = await Promise.all([
    readSettings(),
    getMetaApp(),
    getSecret('meta_page_token'),
    getSecret('meta_user_token'),
  ]);

  const base: MetaStatus = {
    app: { configured: Boolean(app.appId && app.appSecret), appId: app.appId, configId: app.configId, problem: null },
    connected: false,
    userName: s.social_meta_user_name,
    page: s.social_facebook_page_id ? { id: s.social_facebook_page_id, name: s.social_facebook_page_name } : null,
    instagram: s.social_instagram_account_id ? { id: s.social_instagram_account_id, username: s.social_instagram_username } : null,
    health: 'disconnected',
    healthMessage: null,
    needsPageChoice: Boolean(userToken && !s.social_facebook_page_id),
  };
  if (!pageToken || !s.social_facebook_page_id) {
    // Pas encore relié : on vérifie ce qui fera échouer la connexion, avant qu'elle échoue.
    if (base.app.configured) {
      try {
        await graphGet(app.appId, { fields: 'id', access_token: `${app.appId}|${app.appSecret}` }, 5000);
      } catch (err) {
        if (err instanceof MetaError && !err.uncertain) {
          base.app.problem = 'Meta refuse cet App ID et cet App Secret ensemble. Recopiez la clé secrète depuis developers.facebook.com › Paramètres › Général (ou réinitialisez-la).';
        }
      }
    }
    if (userToken) {
      // Connexion faite, Page pas encore choisie : n'en proposer le choix que s'il y en a.
      const pages = await listPages(userToken).catch(() => null);
      base.needsPageChoice = Boolean(pages?.length);
      if (pages && !pages.length) {
        base.healthMessage = `Le compte Facebook${s.social_meta_user_name ? ` de ${s.social_meta_user_name}` : ''} ne donne accès à aucune Page. Reconnectez-vous avec un compte administrateur de la Page, et cochez-la à l’étape « Choisir les Pages ».`;
      }
    }
    return base;
  }

  try {
    const page = await graphGet<{ id: string; name: string; instagram_business_account?: { id: string; username?: string } }>(
      s.social_facebook_page_id,
      { fields: 'id,name,instagram_business_account{id,username}', access_token: pageToken },
    );
    const instagram = page.instagram_business_account?.id
      ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || '' }
      : null;
    if (
      page.name !== s.social_facebook_page_name ||
      (instagram?.id || '') !== s.social_instagram_account_id ||
      (instagram?.username || '') !== s.social_instagram_username
    ) {
      await writeSettings({
        social_facebook_page_name: page.name,
        social_instagram_account_id: instagram?.id || '',
        social_instagram_username: instagram?.username || '',
      });
    }
    return {
      ...base,
      connected: true,
      page: { id: page.id, name: page.name },
      instagram,
      health: 'ok',
      healthMessage: instagram
        ? null
        : 'Aucun compte Instagram professionnel n’est relié à cette Page. Dans Instagram › Paramètres › Compte professionnel, reliez-le à la Page, puis cliquez « Vérifier ».',
    };
  } catch (err) {
    const expired = err instanceof MetaError && (err.code === 190 || err.code === 102);
    return {
      ...base,
      connected: !expired,
      health: expired ? 'expired' : 'error',
      healthMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
