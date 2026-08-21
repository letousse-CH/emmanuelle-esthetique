import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { targetUrl, buildWebhookUrl, action } = await req.json();

    if (!targetUrl) {
      return NextResponse.json({ error: "L'URL du site cible est requise." }, { status: 400 });
    }

    const cleanUrl = targetUrl.replace(/\/+$/, '');
    const logs: string[] = [];

    // 1. Déclenchement facultatif du build à distance (Webhooks Netlify/Vercel)
    if (action === 'build' || action === 'all') {
      if (buildWebhookUrl) {
        try {
          const webhookRes = await fetch(buildWebhookUrl, { method: 'POST' });
          if (webhookRes.ok) {
            logs.push('✓ Webhook de build déclenché avec succès sur le serveur d\'hébergement.');
          } else {
            logs.push(`⚠️ Échec du Webhook de build : code HTTP ${webhookRes.status}`);
          }
        } catch (e: any) {
          logs.push(`⚠️ Erreur Webhook de build : ${e.message}`);
        }
      } else {
        logs.push('ℹ Aucun Webhook de build renseigné pour ce site (synchronisation base seule).');
      }
    }

    // 2. Ordre de migration de la base de données distante
    if (action === 'migrate' || action === 'all' || action === 'ping') {
      const migrateEndpoint = `${cleanUrl}/api/admin/auto-migrate`;
      try {
        const pingRes = await fetch(migrateEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (pingRes.ok) {
          const pingData = await pingRes.json();
          logs.push(`✓ Synchronisation réussie avec ${cleanUrl}`);
          if (pingData.logs && Array.isArray(pingData.logs)) {
            logs.push(...pingData.logs);
          }
        } else if (pingRes.status === 404) {
          logs.push(`⚠️ HTTP 404 : Le code actuellement déployé sur ${cleanUrl} est l'ancienne version. Cliquez d'abord sur "Reconstruire le code" (ou poussez le code sur Git) pour que Netlify déploie la nouvelle version, puis réessayez la synchronisation.`);
        } else {
          logs.push(`⚠️ Connexion établie avec ${cleanUrl}, mais l'API a répondu HTTP ${pingRes.status}.`);
        }
      } catch (e: any) {
        logs.push(`⚠️ Impossible de joindre ${migrateEndpoint} (${e.message}). Assurez-vous que le site est en ligne.`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Opération terminée pour ${cleanUrl}`,
      logs,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || 'Erreur lors de la mise à jour à distance',
    }, { status: 500 });
  }
}
