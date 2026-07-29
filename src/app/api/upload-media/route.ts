import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken } from '../../../utils/apiAuth';

const ACCOUNT_ID  = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET      = process.env.R2_BUCKET_NAME || '';
const PUBLIC_URL  = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '';

/**
 * Le stockage n'est pas obligatoire pour faire tourner le site : tant qu'il
 * n'est pas configuré, les images peuvent être renseignées par URL depuis la
 * bibliothèque médias. On vérifie donc la configuration avant d'instancier le
 * client S3, pour renvoyer un message actionnable plutôt qu'une erreur AWS.
 */
function missingConfig(): string[] {
  return [
    !ACCOUNT_ID && 'R2_ACCOUNT_ID',
    !ACCESS_KEY && 'R2_ACCESS_KEY_ID',
    !SECRET_KEY && 'R2_SECRET_ACCESS_KEY',
    !BUCKET && 'R2_BUCKET_NAME',
    !PUBLIC_URL && 'NEXT_PUBLIC_R2_PUBLIC_URL',
  ].filter(Boolean) as string[];
}

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const missing = missingConfig();
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Stockage des médias non configuré : l'upload de fichiers est indisponible. " +
            "En attendant, ajoutez vos images par URL depuis la bibliothèque médias. " +
            `Variables manquantes : ${missing.join(', ')}.`,
          missing,
        },
        { status: 501 }
      );
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

    await getS3Client().send(command);

    const publicUrl = `${PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
    return NextResponse.json({ url: publicUrl, key });
  } catch (err: any) {
    console.error("Erreur S3:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
