import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { supabase } from '../../../services/supabase';

/**
 * Récupération DYNAMIQUE des identifiants Cloudflare R2 :
 * 1. Essaie d'abord les variables d'environnement process.env
 * 2. Bascule automatiquement sur la table Supabase `settings` (modifiable depuis l'Admin > Paramètres > Clés API)
 */
async function getR2Config() {
  let accountId = process.env.R2_ACCOUNT_ID || '';
  let accessKey = process.env.R2_ACCESS_KEY_ID || '';
  let secretKey = process.env.R2_SECRET_ACCESS_KEY || '';
  let bucket = process.env.R2_BUCKET_NAME || '';
  let publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '';

  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    try {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'r2_account_id',
        'r2_access_key_id',
        'r2_secret_access_key',
        'r2_bucket_name',
        'r2_public_url',
      ]);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
      accountId = accountId || map.r2_account_id || '';
      accessKey = accessKey || map.r2_access_key_id || '';
      secretKey = secretKey || map.r2_secret_access_key || '';
      bucket = bucket || map.r2_bucket_name || '';
      publicUrl = publicUrl || map.r2_public_url || '';
    } catch (e) {
      console.error("Erreur lecture settings R2 Supabase:", e);
    }
  }

  return { accountId, accessKey, secretKey, bucket, publicUrl };
}

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
      !accountId && 'R2_ACCOUNT_ID / r2_account_id',
      !accessKey && 'R2_ACCESS_KEY_ID / r2_access_key_id',
      !secretKey && 'R2_SECRET_ACCESS_KEY / r2_secret_access_key',
      !bucket && 'R2_BUCKET_NAME / r2_bucket_name',
      !publicUrl && 'NEXT_PUBLIC_R2_PUBLIC_URL / r2_public_url',
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
