import { NextResponse } from 'next/server';
import { supabase } from '../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { parseDurationMinutes } from '../../../../services/booking';

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

      // ── Options privilèges d'upselling ──
      if (
        nomLower.includes('option') ||
        nomLower.includes('teinture') ||
        nomLower.includes('duo regard')
      ) {
        let dur = parseDurationMinutes(desc, 15);
        if (nomLower.includes('duo regard')) dur = 20;

        options.push({
          id: s.id,
          nom,
          duree_minutes: dur,
          prix_chf: prix,
          description: desc || 'Soin complémentaire sur-mesure pendant votre séance.',
        });
        continue;
      }

      // ── Catégorie 1 : Rituels et massages du corps (>= 90 CHF) ──
      if (catNom.includes('corps') || (nomLower.includes('corps') && !catNom.includes('visage')) || nomLower.includes('massage') || nomLower.includes('voile') || nomLower.includes('bulle') || nomLower.includes('echappée')) {
        if (prix >= 90) {
          const dur = parseDurationMinutes(desc, nomLower.includes('echappée') ? 105 : nomLower.includes('90') ? 90 : 60);
          services.push({
            id: s.id,
            category: 'corps',
            name: nom,
            durationMinutes: dur,
            durationLabel: dur >= 60 ? (dur === 105 ? '1h45' : `${dur} min`) : `${dur} min`,
            priceChf: prix,
            description: desc && !desc.match(/^\d+\s*min$/) ? desc : 'La rencontre entre le magnétisme marin et une gestuelle manuelle précise, enveloppante et décontractante.',
            tag: nomLower.includes('relaxant') ? 'Lâcher-prise' : nomLower.includes('echappée') ? 'Visage & Corps' : undefined,
          });
        }
        continue;
      }

      // ── Catégorie 2 : Soins du visage (>= 90 CHF) ──
      if (catNom.includes('visage') || nomLower.includes('visage')) {
        if (prix >= 90) {
          const dur = parseDurationMinutes(desc, 60);
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
        }
        continue;
      }

      // ── Catégorie 3 : Épilations (Uniquement les forfaits) ──
      if (catNom.includes('epilation') || nomLower.includes('epilation')) {
        if (nomLower.includes('forfait') || s.type === 'forfait') {
          const dur = parseDurationMinutes(desc, nomLower.includes('integral') ? 60 : 45);
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
        }
        continue;
      }

      // ── Catégorie 4 : Services (Mains, pieds, réhaussement de cils) ──
      if (
        nomLower.includes('mains') ||
        nomLower.includes('pieds') ||
        nomLower.includes('rehaussement') ||
        nomLower.includes('réhaussement')
      ) {
        let dur = parseDurationMinutes(desc, nomLower.includes('pieds') ? 70 : 60);
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
        continue;
      }
    }

    // Ajout de l'Option Boue Marine Dos si absente de la table services
    if (!options.some((o) => o.nom.toLowerCase().includes('boue marine'))) {
      options.unshift({
        id: 'option-boue-marine-dos',
        nom: 'Option Boue Marine Auto-Chauffante Dos',
        duree_minutes: 15,
        prix_chf: 30,
        description: 'Application d’une boue marine effervescente le long de la colonne. Dénoue le dos.',
      });
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
