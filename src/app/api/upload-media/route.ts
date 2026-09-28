import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { supabase } from '../../../services/supabase';
import { getR2Config } from '../../../utils/r2Config';

// Identifiants R2 : app_secrets (admin) puis variables R2_* ; voir utils/r2Config.

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { accountId, accessKey, secretKey, bucket, publicUrl } = await getR2Config();

    const missing = [
      !accountId && 'R2_ACCOUNT_ID',
      !accessKey && 'R2_ACCESS_KEY_ID',
      !secretKey && 'R2_SECRET_ACCESS_KEY',
      !bucket && 'R2_BUCKET_NAME',
      !publicUrl && 'NEXT_PUBLIC_R2_PUBLIC_URL',
    ].filter(Boolean) as string[];

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Stockage des médias non configuré : l'upload de fichiers est indisponible. " +
            "Veuillez renseigner vos clés Cloudflare R2 dans Admin > Paramètres > Clés API & Services. " +
            `Paramètres manquants : ${missing.join(', ')}.`,
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
    
    // Nettoyer le nom de fichier
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const key = `${Date.now()}-${safeFileName}`;

    // Client S3 instancié dynamiquement
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBytes,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const finalUrl = `${publicUrl.replace(/\/+$/, '')}/${key}`;

    // Enregistrer l'asset dans la bibliothèque médias Supabase (table media_library ou media_assets)
    try {
      await supabase.from('media_library').insert({
        url: finalUrl,
        alt_text: safeFileName,
        filename: safeFileName,
        file_size: fileBytes.length,
        mime_type: contentType,
      });
    } catch (dbErr) {
      // Ignorer si la table utilise une structure alternative
    }

    return NextResponse.json({ url: finalUrl, key });
  } catch (err: any) {
    console.error("Erreur S3 R2 Upload:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
