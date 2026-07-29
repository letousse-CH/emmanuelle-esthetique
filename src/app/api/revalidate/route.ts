import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { validateSupabaseToken } from '../../../utils/apiAuth';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let slug = '';
  try {
    const body = await req.json();
    slug = String(body.slug || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ revalidated: true });
}
