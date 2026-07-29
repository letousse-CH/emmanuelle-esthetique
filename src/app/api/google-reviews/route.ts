import { NextResponse } from 'next/server';
import { getGoogleReviews } from '../../../services/googleReviews';

// Toujours évalué au runtime (lecture des variables d'env Netlify) — jamais figé
// en réponse statique au build, sinon un changement d'env ne serait pas pris en
// compte sans rebuild.
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getGoogleReviews();

  if (!data) {
    return NextResponse.json({ error: 'not_configured' });
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
