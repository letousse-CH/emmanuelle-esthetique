/**
 * Service de Publication Native Réseaux Sociaux (Directement depuis Studio sans tiers)
 * Connecteurs natifs : LinkedIn API v2 & Meta Graph API (Instagram / Facebook)
 */
import { supabase } from './supabase';
import { getSettingsServer } from './settingsServer';
import { SettingKey } from '../constants/settings';

export interface SocialPublishPayload {
  postId?: string;
  platform: 'linkedin' | 'instagram' | 'facebook' | 'all';
  title: string;
  caption: string;
  imageUrl?: string | null;
}

export interface PublishResult {
  success: boolean;
  publishedAt?: string;
  message?: string;
  channelsPublished?: string[];
}

/**
 * Publie NATIVEMENT un post sur les réseaux sociaux du client directement depuis le serveur Studio
 */
export async function publishSocialPost(payload: SocialPublishPayload): Promise<PublishResult> {
  try {
    const keys: SettingKey[] = [
      'social_linkedin',
      'social_instagram',
      'social_linkedin_token' as any,
      'social_linkedin_page_id' as any,
      'social_meta_token' as any,
      'social_instagram_account_id' as any,
    ];
    const settings = await getSettingsServer(keys);

    const linkedinToken = ((settings as any).social_linkedin_token || process.env.LINKEDIN_ACCESS_TOKEN || '').trim();
    const linkedinPageId = ((settings as any).social_linkedin_page_id || process.env.LINKEDIN_PAGE_ID || '').trim();
    const metaToken = ((settings as any).social_meta_token || process.env.META_ACCESS_TOKEN || '').trim();
    const igAccountId = ((settings as any).social_instagram_account_id || process.env.INSTAGRAM_ACCOUNT_ID || '').trim();

    const channels: string[] = [];
    const errors: string[] = [];

    // 1. Publication Native LinkedIn
    if (payload.platform === 'linkedin' || payload.platform === 'all') {
      if (!linkedinToken) {
        errors.push("Le jeton d'accès LinkedIn (Token) n'est pas encore enregistré dans Paramètres ➔ Réseaux.");
      } else {
        try {
          let authorUrn = '';
          if (linkedinPageId) {
            authorUrn = linkedinPageId.startsWith('urn:')
              ? linkedinPageId
              : `urn:li:organization:${linkedinPageId}`;
          } else {
            // Récupérer le URN du profil utilisateur via /v2/me
            const meRes = await fetch('https://api.linkedin.com/v2/me', {
              headers: { Authorization: `Bearer ${linkedinToken}` },
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              if (meData.id) authorUrn = `urn:li:person:${meData.id}`;
            }
          }

          if (!authorUrn) {
            authorUrn = 'urn:li:organization:self';
          }

          const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${linkedinToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify({
              author: authorUrn,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: payload.caption },
                  shareMediaCategory: 'NONE',
                },
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            }),
          });

          if (res.ok) {
            channels.push('LinkedIn');
          } else {
            const errBody = await res.text();
            console.warn('[socialPublisher] Erreur API LinkedIn:', res.status, errBody);
            let userMsg = `Erreur API LinkedIn (${res.status})`;
            if (res.status === 401) userMsg = "Jeton d'accès LinkedIn expiré ou invalide. Générez un nouveau Token dans Paramètres.";
            if (res.status === 403) userMsg = "Autorisations insuffisantes sur le Token LinkedIn (Permissions requises : w_member_social ou w_organization_social).";
            errors.push(userMsg);
          }
        } catch (e: any) {
          console.warn('[socialPublisher] Exception LinkedIn:', e);
          errors.push(`Erreur réseau LinkedIn : ${e.message}`);
        }
      }
    }

    // 2. Publication Native Instagram (Meta Graph API)
    if (payload.platform === 'instagram' || payload.platform === 'all') {
      if (!metaToken || !igAccountId) {
        errors.push("Le jeton d'accès Meta ou l'ID Compte Instagram n'est pas encore enregistré dans Paramètres.");
      } else if (!payload.imageUrl) {
        errors.push("Instagram requiert un visuel (image) pour publier.");
      } else {
        try {
          const createRes = await fetch(
            `https://graph.facebook.com/v18.0/${igAccountId}/media?image_url=${encodeURIComponent(payload.imageUrl)}&caption=${encodeURIComponent(payload.caption)}&access_token=${metaToken}`,
            { method: 'POST' }
          );
          const createData = await createRes.json();

          if (createData.id) {
            const containerId = createData.id;
            let isReady = false;
            let attempts = 0;

            // Polling de statut du conteneur avant publication (max 30 secondes)
            while (!isReady && attempts < 10) {
              attempts++;
              await new Promise((resolve) => setTimeout(resolve, 3000));

              const statusRes = await fetch(
                `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${metaToken}`
              );
              const statusData = await statusRes.json();

              if (statusData.status_code === 'FINISHED') {
                isReady = true;
              } else if (statusData.status_code === 'ERROR') {
                throw new Error("Échec du traitement de l'image par Instagram.");
              }
            }

            if (!isReady) {
              errors.push("Le traitement de l'image par Instagram prend trop de temps.");
            } else {
              const pubRes = await fetch(
                `https://graph.facebook.com/v18.0/${igAccountId}/media_publish?creation_id=${containerId}&access_token=${metaToken}`,
                { method: 'POST' }
              );
              if (pubRes.ok) {
                channels.push('Instagram');
              } else {
                errors.push("Erreur lors de la validation finale du post Instagram.");
              }
            }
          } else {
            errors.push(`Erreur Instagram Meta API : ${createData.error?.message || 'Identifiants invalides'}`);
          }
        } catch (e: any) {
          errors.push(`Erreur réseau Instagram : ${e.message}`);
        }
      }
    }

    if (channels.length === 0) {
      return {
        success: false,
        message: errors.join(' | ') || 'Aucun canal disponible pour la publication.',
      };
    }

    // Mettre à jour le statut du post en base si réussi
    if (payload.postId) {
      await supabase
        .from('social_posts')
        .update({ status: 'posted', updated_at: new Date().toISOString() })
        .eq('id', payload.postId);
    }

    return {
      success: true,
      publishedAt: new Date().toISOString(),
      message: `Post publié avec succès sur : ${channels.join(', ')} !`,
      channelsPublished: channels,
    };
  } catch (err: any) {
    console.error('[socialPublisher] Erreur de publication native:', err);
    return {
      success: false,
      message: err.message || 'Erreur lors de la publication directe',
    };
  }
}
