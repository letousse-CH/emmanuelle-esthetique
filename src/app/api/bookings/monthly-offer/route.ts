import { NextResponse, type NextRequest } from 'next/server';
import {
  getActiveMonthlyOffer,
  getAllMonthlyOffers,
  createMonthlyOffer,
  updateMonthlyOffer,
  setActiveMonthlyOffer,
  type MonthlyOfferInput,
} from '../../../../services/booking';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export const runtime = 'nodejs';

/**
 * GET /api/bookings/monthly-offer
 * - Si appelé publiquement : renvoie l'offre active du mois.
 * - Si `?all=true` avec jeton admin : renvoie toutes les offres pour l'administration.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const getAll = searchParams.get('all') === 'true';

  if (getAll) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const isAdmin = await validateSupabaseToken(token);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
    try {
      const offers = await getAllMonthlyOffers();
      return NextResponse.json({ offers });
    } catch (err: any) {
      console.error('[/api/bookings/monthly-offer GET all] Erreur:', err);
      return NextResponse.json({ error: 'Erreur lecture offres.' }, { status: 500 });
    }
  }

  try {
    const offer = await getActiveMonthlyOffer();
    return NextResponse.json({ offer });
  } catch (err: any) {
    console.error('[/api/bookings/monthly-offer] Erreur:', err);
    return NextResponse.json(
      { error: 'Impossible de récupérer l’offre du mois.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/monthly-offer
 * Création ou mise à jour de l'offre du mois (Admin).
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { id, titre, description, prix_chf, image_url, active } = body || {};

  if (!titre || typeof prix_chf !== 'number') {
    return NextResponse.json(
      { error: 'Titre et tarif CHF sont obligatoires.' },
      { status: 400 }
    );
  }

  const input: MonthlyOfferInput = {
    titre: String(titre).trim(),
    description: description ? String(description).trim() : null,
    prix_chf: Number(prix_chf),
    image_url: image_url ? String(image_url).trim() : null,
    active: active !== undefined ? Boolean(active) : true,
  };

  try {
    if (id) {
      const updated = await updateMonthlyOffer(id, input);
      if (input.active) {
        await setActiveMonthlyOffer(id);
      }
      return NextResponse.json({ success: true, offer: updated });
    } else {
      const created = await createMonthlyOffer(input);
      if (input.active) {
        await setActiveMonthlyOffer(created.id);
      }
      return NextResponse.json({ success: true, offer: created });
    }
  } catch (err: any) {
    console.error('[/api/bookings/monthly-offer POST] Erreur:', err);
    return NextResponse.json({ error: err?.message || 'Erreur enregistrement offre.' }, { status: 500 });
  }
}
