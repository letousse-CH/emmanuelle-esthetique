import { NextResponse, type NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { getR2Config } from '../../../../../utils/r2Config';

/**
 * Dépôt du visuel d'une publication (JPEG rendu dans le navigateur) sur R2.
 *
 * C'est cette adresse publique qu'Instagram et Facebook téléchargent : le
 * visuel publié est donc exactement celui de l'aperçu. Corps de la requête :
 * le JPEG brut (`image/jpeg`). Instagram n'accepte que le JPEG, et refuse les
 * images de plus de 8 Mo.
 */
export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length < 1000) return NextResponse.json({ error: 'Visuel vide.' }, { status: 400 });
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'Visuel trop lourd (8 Mo au plus).' }, { status: 413 });
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return NextResponse.json({ error: 'Le visuel doit être un JPEG.' }, { status: 415 });
  }

  const { accountId, accessKey, secretKey, bucket, publicUrl } = await getR2Config();
  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    return NextResponse.json(
      { error: 'Stockage des médias (Cloudflare R2) non configuré : Réglages › Clés API. Sans lui, Instagram ne peut pas télécharger le visuel.' },
      { status: 501 },
    );
  }

  const day = new Date().toISOString().slice(0, 10);
  const key = `social/${day}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (err: any) {
    console.error('[social/visual] Dépôt R2 refusé :', err);
    return NextResponse.json({ error: `Le visuel n’a pas pu être déposé : ${err?.message || 'erreur R2'}` }, { status: 502 });
  }

  return NextResponse.json({ url: `${publicUrl.replace(/\/+$/, '')}/${key}` });
}
