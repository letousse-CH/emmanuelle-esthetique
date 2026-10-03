import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GONE = () =>
  NextResponse.json(
    { error: 'Route supprimée : utilisez /api/admin/booking-settings.' },
    { status: 410 },
  );

/** OBSOLÈTE (410) : remplacée par GET /api/admin/booking-settings. */
export async function GET() {
  return GONE();
}

/** OBSOLÈTE (410) : remplacée par PUT /api/admin/booking-settings. */
export async function PATCH() {
  return GONE();
}
