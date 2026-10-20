import { NextResponse, type NextRequest } from 'next/server';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { getR2Config } from '../../../../../utils/r2Config';

/**
 * Dépôt de la vidéo MP4 d'un Reel sur R2, par morceaux.
 *
 * Netlify refuse un corps de requête de plus de 6 Mo : la vidéo (10 à 40 Mo)
 * monte donc en « multipart » S3, morceau par morceau (5 Mio, le minimum de
 * S3/R2 sauf pour le dernier). Instagram et Facebook téléchargent ensuite
 * l'adresse publique.
 *
 *   POST ?action=start                          → { key, uploadId }
 *   POST ?action=part&key&uploadId&n (corps brut) → { etag }
 *   POST ?action=complete { key, uploadId, parts:[{n, etag}] } → { url }
 *   POST ?action=abort { key, uploadId }
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const PART_MAX = 5.5 * 1024 * 1024;
const KEY_RE = /^social\/\d{4}-\d{2}-\d{2}\/[\w-]+\.mp4$/;

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  const { accountId, accessKey, secretKey, bucket, publicUrl } = await getR2Config();
  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    return NextResponse.json({ error: 'Stockage des médias (Cloudflare R2) non configuré : Réglages › Clés API.' }, { status: 501 });
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
  const params = req.nextUrl.searchParams;
  const action = params.get('action');

  try {
    if (action === 'start') {
      const key = `social/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp4`;
      const res = await s3.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return NextResponse.json({ key, uploadId: res.UploadId });
    }

    if (action === 'part') {
      const key = params.get('key') || '';
      const uploadId = params.get('uploadId') || '';
      const n = Number(params.get('n'));
      if (!KEY_RE.test(key) || !uploadId || !Number.isInteger(n) || n < 1 || n > 100) {
        return NextResponse.json({ error: 'Morceau invalide.' }, { status: 400 });
      }
      const body = Buffer.from(await req.arrayBuffer());
      if (!body.length || body.length > PART_MAX) return NextResponse.json({ error: 'Morceau de taille invalide.' }, { status: 413 });
      const res = await s3.send(new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: n, Body: body }));
      return NextResponse.json({ etag: res.ETag });
    }

    const json = await req.json().catch(() => ({}));
    const key = String(json?.key || '');
    const uploadId = String(json?.uploadId || '');
    if (!KEY_RE.test(key) || !uploadId) return NextResponse.json({ error: 'Envoi inconnu.' }, { status: 400 });

    if (action === 'complete') {
      const parts = (Array.isArray(json.parts) ? json.parts : [])
        .map((p: any) => ({ PartNumber: Number(p?.n), ETag: String(p?.etag || '') }))
        .filter((p: { PartNumber: number; ETag: string }) => Number.isInteger(p.PartNumber) && p.ETag)
        .sort((a: { PartNumber: number }, b: { PartNumber: number }) => a.PartNumber - b.PartNumber);
      if (!parts.length) return NextResponse.json({ error: 'Aucun morceau reçu.' }, { status: 400 });
      await s3.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
      return NextResponse.json({ url: `${publicUrl.replace(/\/+$/, '')}/${key}` });
    }

    if (action === 'abort') {
      await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err: any) {
    console.error('[social/video]', err);
    return NextResponse.json({ error: `Dépôt de la vidéo refusé par R2 : ${err?.message || 'erreur'}` }, { status: 502 });
  }
}
