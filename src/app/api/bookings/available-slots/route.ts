import { NextResponse, type NextRequest } from 'next/server';
import { getAvailableSlots, resolveServiceDuration, parseDurationMinutes } from '../../../../services/booking';

export const runtime = 'nodejs';

/**
 * GET /api/bookings/available-slots?date=YYYY-MM-DD&serviceId=...&duration=...
 * Calcule et renvoie la grille des créneaux disponibles pour une date et une durée données.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');
  const durationParam = searchParams.get('duration');

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: 'Date invalide. Le format attendu est YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  // Résolution de la durée du soin : paramètre direct, ou consultation catalogue CARTE
  let durationMinutes = 60;
  if (durationParam) {
    durationMinutes = parseDurationMinutes(durationParam, 60);
  } else if (serviceId) {
    durationMinutes = resolveServiceDuration(serviceId, 60);
  }

  try {
    const result = await getAvailableSlots(dateStr, durationMinutes);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[/api/bookings/available-slots] Erreur:', err);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des créneaux disponibles.' },
      { status: 500 }
    );
  }
}
