/**
 * Cache partagé du diagnostic IA (bandeau et pastille de l'admin).
 *
 * Module à part pour que l'enregistrement d'une clé puisse le vider : sans
 * cela, l'admin affichait « IA indisponible » jusqu'à dix minutes après
 * qu'une clé valide avait été collée.
 */
export interface AiStatusSnapshot {
  checkedAt: number;
  keyTail: string | null;
  [k: string]: unknown;
}

let snapshot: AiStatusSnapshot | null = null;

export function getAiStatus(): AiStatusSnapshot | null {
  return snapshot;
}

export function setAiStatus(value: AiStatusSnapshot): void {
  snapshot = value;
}

export function invalidateAiStatus(): void {
  snapshot = null;
}
