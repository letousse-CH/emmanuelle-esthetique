import { NextResponse, type NextRequest } from 'next/server';
import {
  getAllMonthlyOffers,
  createMonthlyOffer,
  updateMonthlyOffer,
  deleteMonthlyOffer,
  setActiveMonthlyOffer,
  type MonthlyOfferInput,
} from '../../../../services/booking';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export const runtime = 'nodejs';

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return validateSupabaseToken(token);
}

/**
 * GET /api/admin/monthly-offers
 * Liste l'ensemble des offres du mois (actives et archives).
 */
export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const offers = await getAllMonthlyOffers();
    return NextResponse.json({ offers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/monthly-offers
 * Crée une nouvelle offre du mois.
 */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { titre, description, prix_chf, image_url, active } = body || {};

  if (!titre || typeof prix_chf !== 'number') {
    return NextResponse.json(
      { error: 'Le titre et le prix en CHF sont obligatoires.' },
      { status: 400 }
    );
  }

  try {
    const input: MonthlyOfferInput = {
      titre: String(titre).trim(),
      description: description ? String(description).trim() : null,
      prix_chf: Number(prix_chf),
      image_url: image_url ? String(image_url).trim() : null,
      active: active !== undefined ? Boolean(active) : true,
    };

    const offer = await createMonthlyOffer(input);
    return NextResponse.json({ success: true, offer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/monthly-offers
 * Met à jour une offre existante ou active une offre spécifique.
 */
export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { id, action, ...updates } = body || {};
  if (!id) {
    return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  }

  try {
    if (action === 'activate') {
      await setActiveMonthlyOffer(id);
      return NextResponse.json({ success: true, message: 'Offre activée' });
    }

    const updated = await updateMonthlyOffer(id, updates);
    return NextResponse.json({ success: true, offer: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/monthly-offers?id=...
 * Supprime une offre du mois.
 */
export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  }

  try {
    await deleteMonthlyOffer(id);
    return NextResponse.json({ success: true, message: 'Offre supprimée' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
