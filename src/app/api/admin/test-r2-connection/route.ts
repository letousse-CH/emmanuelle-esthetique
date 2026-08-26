import { NextResponse, NextRequest } from 'next/server';
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { supabase } from '../../../../services/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let accountId = body.r2AccountId;
    let accessKeyId = body.r2AccessKeyId;
    let secretAccessKey = body.r2SecretAccessKey;
    let bucketName = body.r2BucketName;
    let publicUrl = body.r2PublicUrl;

    // Fallback on DB settings if not passed in body
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'r2_account_id',
        'r2_access_key_id',
        'r2_secret_access_key',
        'r2_bucket_name',
        'r2_public_url',
      ]);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
      accountId = accountId || map.r2_account_id;
      accessKeyId = accessKeyId || map.r2_access_key_id;
      secretAccessKey = secretAccessKey || map.r2_secret_access_key;
      bucketName = bucketName || map.r2_bucket_name;
      publicUrl = publicUrl || map.r2_public_url;
    }

    // Détecter si l'utilisateur a confondu l'URL S3 API et l'URL Publique Web
    if (publicUrl && publicUrl.includes('cloudflarestorage.com')) {
      return NextResponse.json(
        {
          success: false,
          error: "Attention : vous avez renseigné l'URL API S3 (cloudflarestorage.com) dans l'URL Publique. Cette adresse renvoie du XML dans les navigateurs. Dans Cloudflare R2 > Bucket > Paramètres > Accès public, copiez l'URL du domaine R2.dev (ex: https://pub-xxxxxx.r2.dev) ou votre domaine personnalisé.",
        },
        { status: 400 }
      );
    }

    const missing = [
      !accountId && 'R2_ACCOUNT_ID',
      !accessKeyId && 'R2_ACCESS_KEY_ID',
      !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
      !bucketName && 'R2_BUCKET_NAME',
    ].filter(Boolean);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Paramètres manquants : ${missing.join(', ')}. Veuillez remplir tous les champs Cloudflare R2.`,
        },
        { status: 400 }
      );
    }

    // Instancier S3 Client vers Cloudflare R2
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    // Test 1 : Lister les objets du compartiment
    await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));

    // Test 2 : Écriture/Suppression d'un petit fichier de test ping
    const testKey = `_test-ping-${Date.now()}.txt`;
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: Buffer.from("Cloudflare R2 ping connection test OK"),
      ContentType: "text/plain",
    }));

    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));

    return NextResponse.json({
      success: true,
      message: `Connexion Cloudflare R2 100% opérationnelle ! Le compartiment "${bucketName}" est accessible en lecture et écriture.`,
      bucketName,
      publicUrl,
    });
  } catch (err: any) {
    console.error("[Test R2 Connection Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: `Échec du test R2 : ${err?.message || 'Erreur d\'accès au compartiment. Vérifiez votre Account ID, vos clés et le nom du bucket.'}`,
      },
      { status: 500 }
    );
  }
}
