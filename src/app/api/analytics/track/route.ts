import { NextRequest, NextResponse } from 'next/server';
import { trackAnalyticsEvent, AnalyticsEventType } from '../../../../services/analytics';
import { checkRateLimit } from '../../../../utils/rateLimit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  const rateLimitStatus = await checkRateLimit(ip, { windowMs: 60_000, maxRequests: 60 });
  if (!rateLimitStatus.success) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalide' }, { status: 400 });
  }

  const { event_type, page_slug, page_title, metadata } = body;

  if (!event_type || !['page_view', 'cta_click', 'form_submit'].includes(event_type)) {
    return NextResponse.json({ error: 'event_type invalide' }, { status: 400 });
  }

  await trackAnalyticsEvent({
    event_type: event_type as AnalyticsEventType,
    page_slug: page_slug || 'home',
    page_title,
    metadata,
  });

  return NextResponse.json({ success: true });
}
