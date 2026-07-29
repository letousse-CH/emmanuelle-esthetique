// Cache en mémoire locale (valable uniquement pour le conteneur serverless chaud actuel)
const inMemoryCache = new Map<string, number[]>();

export interface RateLimitOptions {
  windowMs?: number; // Par défaut 60 secondes
  maxRequests?: number; // Par défaut 5 requêtes
}

/**
 * Rate limiter modulaire et réutilisable.
 * Par défaut, il utilise un fallback en mémoire (Map global de l'instance de fonction).
 * Si REDIS_URL est configuré en production, on peut y brancher facilement une instance de cache partagée.
 */
export async function checkRateLimit(ip: string, options: RateLimitOptions = {}): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
}> {
  const windowMs = options.windowMs || 60_000;
  const maxRequests = options.maxRequests || 5;
  const now = Date.now();

  // 1. Fallback en mémoire locale
  const timestamps = (inMemoryCache.get(ip) ?? []).filter(t => now - t < windowMs);
  
  if (timestamps.length >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
    };
  }

  const newTimestamps = [...timestamps, now];
  inMemoryCache.set(ip, newTimestamps);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - newTimestamps.length,
  };
}
