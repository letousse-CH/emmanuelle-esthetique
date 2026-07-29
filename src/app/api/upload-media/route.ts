import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken } from '../../../utils/apiAuth';

const ACCOUNT_ID  = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID!;
const SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET      = process.env.R2_BUCKET_NAME || 'audeladeschaines-medias';
const ENDPOINT    = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: true,
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { fileName, contentType, fileBase64 } = body;

    if (!fileName || !contentType || !fileBase64) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const fileBytes = Buffer.from(fileBase64, 'base64');
    
    // Nettoyer le nom de fichier (retirer espaces et caractères non sûrs pour éviter des bugs d'URL)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const key = `${Date.now()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBytes,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.VITE_R2_PUBLIC_URL ?? ''}/${key}`;
    return NextResponse.json({ url: publicUrl, key });
  } catch (err: any) {
    console.error("Erreur S3:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
