import { NextResponse } from 'next/server';
import { supabase } from '../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { FALLBACK_OPTIONS, classifyCatalogRow, stripAccents } from '../../../../services/booking';

export const runtime = 'nodejs';
export const revalidate = 60; // Cache 1 minute

export interface PrestationItemDto {
  id: string; // Real DB UUID
  category: 'visage' | 'corps' | 'epilation' | 'services';
  name: string;
  durationMinutes: number;
  durationLabel: string;
  priceChf: number;
  description: string;
  tag?: string;
}

export interface PrivilegeOptionDto {
  id: string; // Real DB UUID
  nom: string;
  duree_minutes: number;
  prix_chf: number;
  description: string;
}

/**
 * GET /api/bookings/services
 * Renvoie les prestations et privilèges éligibles à la réservation en ligne,
 * lus directement depuis le catalogue Caisse en base de données Supabase.
 * Extrait automatiquement la durée depuis la description du soin.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  try {
    const [categoriesRes, servicesRes] = await Promise.all([
      client.from('service_categories').select('*').order('ordre', { ascending: true }),
      client.from('services').select('*').eq('active', true).order('ordre', { ascending: true }),
    ]);

    const categories = categoriesRes.data || [];
    const dbServices = servicesRes.data || [];

    const catMap = new Map<string, string>();
    for (const c of categories) {
      catMap.set(c.id, (c.nom || '').toLowerCase());
    }

    const services: PrestationItemDto[] = [];
    const options: PrivilegeOptionDto[] = [];

    for (const s of dbServices) {
      const nom = s.nom || '';
      const nomLower = nom.toLowerCase();
      const desc = s.description || '';
      const prix = Number(s.prix_chf) || 0;
      const catNom = s.category_id ? catMap.get(s.category_id) || '' : '';

      // Classement partagé avec la création côté serveur (services/booking.ts) :
      // ce qui n'est pas listé ici ne peut pas non plus être réservé en ligne.
      const c = classifyCatalogRow(s, catNom);
      if (c.kind === 'hors_ligne') continue;
      const dur = c.durationMinutes;

      // ── Options privilèges d'upselling ──
      if (c.kind === 'option') {
        options.push({
          id: s.id,
          nom,
          duree_minutes: dur,
          prix_chf: prix,
          description: desc || 'Soin complémentaire sur-mesure pendant votre séance.',
        });
        continue;
      }

      if (c.category === 'corps') {
        services.push({
          id: s.id,
          category: 'corps',
          name: nom,
          durationMinutes: dur,
          durationLabel: dur === 105 ? '1h45' : `${dur} min`,
          priceChf: prix,
          description: desc && !desc.match(/^\d+\s*min$/) ? desc : 'La rencontre entre le magnétisme marin et une gestuelle manuelle précise, enveloppante et décontractante.',
          tag: nomLower.includes('relaxant') ? 'Lâcher-prise' : stripAccents(nomLower).includes('echappee') ? 'Visage & Corps' : undefined,
        });
      } else if (c.category === 'visage') {
        services.push({
          id: s.id,
          category: 'visage',
          name: nom,
          durationMinutes: dur,
          durationLabel: `${dur} min`,
          priceChf: prix,
          description: desc && !desc.match(/^\d+\s*min$/) ? desc : 'Protocole marin d’exception Phytomer associant manœuvres expertes et éclat visible.',
          tag: nomLower.includes('jeunesse') ? 'Haute technicité' : nomLower.includes('hydra') ? 'Soin signature' : 'Éclat express',
        });
      } else if (c.category === 'epilation') {
        services.push({
          id: s.id,
          category: 'epilation',
          name: nom,
          durationMinutes: dur,
          durationLabel: `${dur} min`,
          priceChf: prix,
          description: desc && desc !== `${dur} min` ? desc : 'Forfait complet tout compris avec cires douces haute tolérance.',
          tag: 'Forfait tout compris',
        });
      } else if (c.category === 'services') {
        services.push({
          id: s.id,
          category: 'services',
          name: nom,
          durationMinutes: dur,
          durationLabel: `${dur} min`,
          priceChf: prix,
          description: desc && desc !== `${dur} min` ? desc : 'Mise en beauté experte et soin cocooning.',
          tag: nomLower.includes('pieds') ? 'Détente absolue' : undefined,
        });
      }
    }

    // Option de repli (aussi connue du serveur à la création) si absente de la table services
    const fallbackId = 'option-boue-marine-dos';
    if (!options.some((o) => o.nom.toLowerCase().includes('boue marine'))) {
      const f = FALLBACK_OPTIONS[fallbackId];
      options.unshift({ id: fallbackId, nom: f.nom, duree_minutes: f.duree_minutes, prix_chf: f.prix_chf, description: f.description });
    }

    return NextResponse.json({
      success: true,
      services,
      options,
    });
  } catch (err: any) {
    console.error('[/api/bookings/services] Erreur:', err);
    return NextResponse.json(
      { error: 'Erreur chargement catalogue services', details: err.message },
      { status: 500 }
    );
  }
}
