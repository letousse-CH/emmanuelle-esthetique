/**
 * Validation des coordonnées côté navigateur.
 *
 * Alignée sur le serveur (qui normalise ensuite en E.164) : le formulaire doit
 * accepter tout ce que la cliente tape naturellement — `079 123 45 67`,
 * `+41 79 123 45 67`, `0041 79 123 45 67`, `079.123.45.67`, `+41 (0)79 123 45 67` —
 * et refuser ce qui ne peut pas être un numéro joignable.
 */

/**
 * Retourne le numéro au format international (`+41791234567`) ou `null`
 * s'il n'est pas plausible. Un numéro étranger (`+33…`) est accepté tel quel.
 */
export function normalizePhone(raw: string): string | null {
  let s = (raw || '').trim();
  if (!s) return null;

  // `+41 (0)79 …` : le (0) du préfixe national n'a pas de sens en international.
  s = s.replace(/\(\s*0\s*\)/g, '');

  // Seuls ces séparateurs sont tolérés ; toute autre lettre/symbole = invalide.
  if (/[^\d\s+().\-/]/.test(s)) return null;
  const hasPlus = s.startsWith('+');
  if (s.slice(1).includes('+')) return null;

  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (hasPlus) {
    // +41…
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    // National : 0 + 9 chiffres (079 123 45 67, 021 907 12 34).
    if (digits.length !== 10) return null;
    digits = `41${digits.slice(1)}`;
  } else {
    return null;
  }

  if (digits.startsWith('41')) {
    // Suisse : indicatif + 9 chiffres exactement.
    if (digits.length !== 11) return null;
  } else if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  return `+${digits}`;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/** Même exigence que le serveur : une adresse « raisonnable », rien de plus. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((raw || '').trim());
}

export interface ContactFields {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
}

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export function validateContact(f: ContactFields): ContactErrors {
  const errors: ContactErrors = {};
  if (!f.prenom.trim()) errors.prenom = 'Votre prénom est requis.';
  if (!f.nom.trim()) errors.nom = 'Votre nom est requis.';
  if (!f.telephone.trim()) {
    errors.telephone = 'Le numéro de téléphone est indispensable pour que nous puissions vous rappeler.';
  } else if (!isValidPhone(f.telephone)) {
    errors.telephone = 'Numéro invalide. Exemples : 079 123 45 67 ou +41 79 123 45 67.';
  }
  if (f.email.trim() && !isValidEmail(f.email)) {
    errors.email = 'Adresse e-mail invalide (ex. sophie.dufour@exemple.ch).';
  }
  return errors;
}
