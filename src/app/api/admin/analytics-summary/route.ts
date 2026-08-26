import { NextResponse } from 'next/server';
import { fetchAnalyticsSummary } from '../../../../services/analytics';

export async function GET() {
  try {
    const summary = await fetchAnalyticsSummary();
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur d’agrégation' }, { status: 500 });
  }
}
