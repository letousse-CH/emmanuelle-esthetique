import crypto from 'crypto';

/**
 * Jeton de désinscription : `base64url(email).hmac_sha256(email)`.
 *
 * Le secret n'a **pas** de repli sur la chaîne vide : un HMAC signé avec une
 * clé vide est reproductible par n'importe qui, ce qui permettrait de
 * désinscrire l'adresse d'un tiers en forgeant le lien. Sans `UNSUB_SECRET`,
 * on refuse donc de signer comme de vérifier (fail closed).
 */
function getSecret(): string | null {
  const secret = process.env.UNSUB_SECRET;
  return secret && secret.trim().length > 0 ? secret : null;
}

/** Indique si la désinscription est utilisable (secret configuré). */
export function isUnsubConfigured(): boolean {
  return getSecret() !== null;
}

/**
 * Construit le jeton signé, ou `null` si `UNSUB_SECRET` est absent — l'appelant
 * doit alors refuser d'envoyer l'e-mail plutôt que d'y glisser un lien
 * de désinscription non vérifiable.
 */
export function buildUnsubToken(email: string): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const emailB64 = Buffer.from(email).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(email).digest('hex');
  return encodeURIComponent(`${emailB64}.${hmac}`);
}

/**
 * Vérifie un jeton et renvoie l'e-mail qu'il porte, ou `null` si le jeton est
 * malformé, mal signé, ou si le secret n'est pas configuré.
 */
export function verifyUnsubToken(encoded: string): string | null {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const decoded = decodeURIComponent(encoded);
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const email = Buffer.from(decoded.slice(0, dotIdx), 'base64url').toString('utf-8').trim();
    const receivedHmac = decoded.slice(dotIdx + 1);
    const expectedHmac = crypto.createHmac('sha256', secret).update(email).digest('hex');

    if (receivedHmac.length !== expectedHmac.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }

    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}
