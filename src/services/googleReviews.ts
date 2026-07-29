// Source unique des avis Google (Places API). Utilisée par l'API publique
// /api/google-reviews (widget d'avis affiché sur la page d'accueil).
// Retourne null si non configuré (GOOGLE_PLACE_ID / GOOGLE_PLACES_API_KEY absents)
// ou en cas d'erreur — aucune note n'est jamais inventée.

export interface GoogleReview {
  author: string;
  photo?: string;
  rating: number;
  text: string;
  time: string;
}

export interface GoogleReviewsData {
  rating: number;
  total: number;
  reviews: GoogleReview[];
}

export async function getGoogleReviews(): Promise<GoogleReviewsData | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) return null;

  try {
    // no-store : on ne met JAMAIS la réponse Google en cache de données Next.
    // Sinon une réponse d'erreur (ex. REQUEST_DENIED pendant une mauvaise config
    // de clé) resterait servie pendant 1 h. Le cache se fait au niveau supérieur :
    // ISR du layout (revalidate 3600) + en-tête Cache-Control de la route API.
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&language=fr&reviews_sort=newest&key=${apiKey}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.result) return null;

    const rating = data.result.rating;
    const total = data.result.user_ratings_total;
    // Pas de note ou aucun avis → on n'affiche rien.
    if (!rating || !total) return null;

    return {
      rating,
      total,
      reviews: (data.result.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.author_name,
        photo: r.profile_photo_url,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
      })),
    };
  } catch (err) {
    console.error('[googleReviews] error:', err);
    return null;
  }
}
