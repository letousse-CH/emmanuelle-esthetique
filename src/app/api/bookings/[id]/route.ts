import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GONE = () =>
  NextResponse.json(
    { error: 'Route supprimée : utilisez /api/admin/bookings/[id].' },
    { status: 410 },
  );

/** OBSOLÈTE (410) : remplacée par PATCH /api/admin/bookings/[id]. */
export async function PATCH() {
  return GONE();
}

/** OBSOLÈTE (410) : remplacée par GET /api/admin/bookings/[id]. */
export async function GET() {
  return GONE();
}
