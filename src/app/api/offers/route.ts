import { NextResponse } from 'next/server';
import { getPublicOffers } from '../../../services/offersServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/offers
 * Offres du moment affichables aujourd'hui (publiées, dans leur période, non
 * complètes), avec les places restantes. Sert au formulaire de réservation et à
 * l'aperçu du bloc « Offre du moment » dans l'éditeur de pages. Jamais d'erreur :
 * une base injoignable donne une liste vide.
 */
export async function GET() {
  const offers = await getPublicOffers();
  return NextResponse.json({ offers }, { headers: { 'Cache-Control': 'no-store' } });
}
