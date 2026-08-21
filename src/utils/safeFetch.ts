import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Récupération d'une URL fournie par un tiers.
 *
 * Cette fonction existe pour une raison de sécurité précise. Une route qui
 * télécharge « l'URL que l'utilisateur a saisie » est une porte ouverte au
 * SSRF : on lui demande `http://169.254.169.254/` (métadonnées cloud) ou
 * `http://localhost:5432` et le serveur va chercher, depuis l'intérieur du
 * réseau, ce que l'attaquant ne peut pas atteindre lui-même.
 *
 * On refuse donc tout ce qui n'est pas du HTTP(S) public : schémas exotiques,
 * adresses privées, boucle locale, lien-local. La résolution DNS est faite
 * *avant* la requête, sinon un domaine public pointant vers 127.0.0.1
 * passerait au travers.
 */

const MAX_BYTES = 2_000_000; // 2 Mo : au-delà, ce n'est plus une page vitrine
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export class UnsafeUrlError extends Error {}

/** Plages réservées, non routables depuis l'internet public. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const v6 = address.toLowerCase();
    return (
      v6 === '::1' ||
      v6.startsWith('fc') || v6.startsWith('fd') || // uniques locales
      v6.startsWith('fe80') ||                       // lien-local
      v6.startsWith('::ffff:')                       // IPv4 déguisée
    );
  }

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||            // lien-local, dont métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||  // CGNAT
    a >= 224                                // multicast et réservé
  );
}

async function assertPublicHost(hostname: string): Promise<void> {
  const literal = isIP(hostname);
  if (literal) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError('Cette adresse IP est privée ou réservée.');
    }
    return;
  }

  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError('Ce nom de domaine est introuvable.');
  }

  // Un seul enregistrement privé suffit à refuser : un domaine peut résoudre
  // vers plusieurs adresses, et il ne faut pas pouvoir jouer sur l'ordre.
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new UnsafeUrlError('Ce domaine pointe vers une adresse privée.');
  }
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();

  // Un schéma explicite autre que http(s) doit être refusé pour ce qu'il est.
  // Sans ce contrôle, « file:///etc/passwd » se voyait préfixer d'un https://
  // et échouait plus loin sur une erreur DNS trompeuse.
  const declaredScheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (declaredScheme && declaredScheme !== 'http' && declaredScheme !== 'https') {
    throw new UnsafeUrlError(`Le schéma « ${declaredScheme}: » n'est pas autorisé.`);
  }

  const withScheme = declaredScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("Cette adresse n'est pas valide.");
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Seules les adresses http et https sont acceptées.');
  }
  return url;
}

export interface FetchedPage {
  url: string;
  html: string;
  truncated: boolean;
}

/**
 * Télécharge une page en suivant les redirections **une par une**, en
 * revalidant l'hôte à chaque saut : sans cela, une redirection vers
 * `http://127.0.0.1` contournerait tout le contrôle initial.
 */
export async function fetchPublicPage(rawUrl: string): Promise<FetchedPage> {
  let url = normalizeUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Un agent identifiable : on ne se fait pas passer pour un navigateur.
          'User-Agent': 'StudioSiteImporter/1.0 (+import de site, à la demande du propriétaire)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (error) {
      clearTimeout(timer);
      throw new UnsafeUrlError(
        (error as Error).name === 'AbortError'
          ? "Le site n'a pas répondu à temps."
          : 'Impossible de joindre ce site.',
      );
    }
    clearTimeout(timer);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new UnsafeUrlError('Redirection invalide.');
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) {
      throw new UnsafeUrlError(`Le site a répondu ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      throw new UnsafeUrlError("Cette adresse ne renvoie pas une page web.");
    }

    // Lecture bornée : un flux sans fin bloquerait le serveur.
    const reader = response.body?.getReader();
    if (!reader) throw new UnsafeUrlError('Réponse vide.');

    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { url: url.toString(), html: buffer.toString('utf8'), truncated };
  }

  throw new UnsafeUrlError('Trop de redirections.');
}
