import { NextRequest, NextResponse } from 'next/server';
import { publishSocialPost } from '../../../../services/socialPublisher';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body invalide' }, { status: 400 });
  }

  const { postId, platform, title, caption, imageUrl } = body;

  if (!title || !caption) {
    return NextResponse.json({ error: 'Titre et légende requis.' }, { status: 400 });
  }

  const result = await publishSocialPost({
    postId,
    platform: platform || 'all',
    title,
    caption,
    imageUrl,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, result });
}
