/**
 * Route API — ADN de Marque & Scanner du site Emmanuelle Esthétique (/api/social-brand-dna)
 *
 * - GET : Retourne l'ADN éditorial et visuel d'Emmanuelle Esthétique (avec repli
 *   riche Palézieux-Gare / Phytomer si non encore enregistré en base), les offres
 *   du moment (`monthly_offers`), les articles publiés récents (`articles`), ainsi
 *   que le catalogue structuré des soins signatures et la galerie photo officielle
 *   d'Emmanuelle Esthétique (visuels Pexels/R2 de `seederEmmanuelle.ts`).
 * - POST :
 *   - `action === 'scan'` : Scanne les pages publiées dans `dynamic_pages` et/ou
 *     l'URL fournie (`extractSite`), combinées aux offres en base, puis synthétise
 *     via Claude (`feature: 'social-dna'`) les 5 piliers d'ADN de marque et les
 *     enregistre dans `settings` (upsert sur `key`).
 *   - `action === 'save'` : Sauvegarde directement dans `settings` (upsert sur `key`)
 *     les champs d'ADN modifiés par Emmanuelle depuis l'interface.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { getSettingsServer } from '../../../services/settingsServer';
import type { SettingKey } from '../../../constants/settings';
import { supabase } from '../../../services/supabase';
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';
import { callClaude, extractJson } from '../../../utils/ai';
import { extractSite, toPromptDigest } from '../../../services/siteExtract';
import { fetchPublicPage } from '../../../utils/safeFetch';
import { EMMANUELLE_FALLBACK_DNA, stripHtml } from '../../../utils/socialGeneration';
import {
  IMG_MARINE_MER,
  IMG_MARINE_ECUME,
  IMG_MARINE_GALETS,
  IMG_MARINE_BRUME,
  IMG_MARINE_HORIZON,
  IMG_MARINE_GOUTTES,
  IMG_MARINE_LITTORAL,
} from '../../../services/seederEmmanuelle';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DNA_SETTING_KEYS = [
  'business_name',
  'business_owner',
  'business_address_street',
  'business_address_postal',
  'business_address_city',
  'business_phone',
  'site_activity_context',
  'site_target_persona',
  'site_tone_of_voice',
  'site_brand_tone',
  'site_blog_topics',
  'style_color_primary',
  'style_color_text',
  'style_font_headings',
  'style_font_body',
  'social_instagram',
  'social_linkedin',
] as const;

export interface BrandPhotoItem {
  id: string;
  label: string;
  category: 'soins' | 'cabine' | 'marin';
  url: string;
  alt: string;
  suggestedTheme: 'creme' | 'marin' | 'sauge' | 'photo' | 'citation';
}

export interface BrandTreatmentItem {
  id: string;
  category: 'Visage Phytomer' | 'Corps & Massages' | 'Beauté du Regard' | 'Épilation Douce & Sucre' | 'Ateliers & Bons Cadeaux';
  title: string;
  duration: string;
  priceChf: string;
  description: string;
  slug: string;
  image: string;
  suggestedTheme: 'creme' | 'marin' | 'sauge' | 'photo' | 'citation';
}

/** Galerie photo officielle d'Emmanuelle Esthétique (visuels de seederEmmanuelle.ts). */
export const EMMANUELLE_PHOTO_GALLERY: BrandPhotoItem[] = [
  {
    id: 'visage-phytomer',
    label: 'Soin du visage Phytomer',
    category: 'soins',
    url: 'https://images.pexels.com/photos/5659016/pexels-photo-5659016.jpeg',
    alt: "Soin du visage Phytomer prodigué à l'institut Emmanuelle Esthétique à Palézieux-Gare",
    suggestedTheme: 'marin',
  },
  {
    id: 'anti-age-liftant',
    label: 'Soin Expert Jeunesse & Anti-âge',
    category: 'soins',
    url: 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg',
    alt: 'Manœuvres liftantes manuelles visage chez Emmanuelle Esthétique',
    suggestedTheme: 'creme',
  },
  {
    id: 'head-spa',
    label: 'Head Spa & Massage crânien',
    category: 'soins',
    url: 'https://images.pexels.com/photos/6663371/pexels-photo-6663371.jpeg',
    alt: 'Head Spa massage du cuir chevelu à Palézieux-Gare',
    suggestedTheme: 'sauge',
  },
  {
    id: 'massage-relaxant',
    label: 'Massage relaxant aux huiles chaudes',
    category: 'soins',
    url: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg',
    alt: 'Massage relaxant du corps aux huiles chaudes à Palézieux-Gare',
    suggestedTheme: 'sauge',
  },
  {
    id: 'beaute-regard',
    label: 'Beauté du regard & Rehaussement de cils',
    category: 'soins',
    url: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg',
    alt: 'Beauté du regard, cils et sourcils à Palézieux-Gare',
    suggestedTheme: 'photo',
  },
  {
    id: 'epilation-sucre',
    label: 'Épilation cire douce & pâte de sucre',
    category: 'soins',
    url: 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/1789998853978-e-pilation.jpg',
    alt: 'Épilation douce et orientale au sucre à Palézieux-Gare',
    suggestedTheme: 'creme',
  },
  {
    id: 'cocon-cabine',
    label: 'Le cocon privé à Palézieux-Gare',
    category: 'cabine',
    url: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg',
    alt: 'Cabine de soin privée Emmanuelle Esthétique à Palézieux-Gare',
    suggestedTheme: 'creme',
  },
  {
    id: 'accueil-institut',
    label: 'Espace d’accueil lumineux',
    category: 'cabine',
    url: 'https://images.pexels.com/photos/8633977/pexels-photo-8633977.jpeg',
    alt: 'Accueil de l’institut Emmanuelle Esthétique à 2 min de la gare CFF de Palézieux',
    suggestedTheme: 'creme',
  },
  {
    id: 'atelier-guasha',
    label: 'Ateliers Gua Sha & Auto-soin',
    category: 'soins',
    url: 'https://images.pexels.com/photos/6621462/pexels-photo-6621462.jpeg',
    alt: 'Atelier auto-massage Gua Sha et Glowing Face à Palézieux-Gare',
    suggestedTheme: 'sauge',
  },
  {
    id: 'marine-mer',
    label: 'Mer profonde — Univers Phytomer',
    category: 'marin',
    url: IMG_MARINE_MER,
    alt: 'Mer d’un bleu profond, actifs marins Phytomer',
    suggestedTheme: 'marin',
  },
  {
    id: 'marine-ecume',
    label: 'Écume marine sur granit',
    category: 'marin',
    url: IMG_MARINE_ECUME,
    alt: 'Écume marine et oligo-éléments Phytomer',
    suggestedTheme: 'marin',
  },
  {
    id: 'marine-gouttes',
    label: 'Gouttes d’eau & Hydratation Originelle',
    category: 'marin',
    url: IMG_MARINE_GOUTTES,
    alt: 'Hydratation marine intense Phytomer',
    suggestedTheme: 'marin',
  },
  {
    id: 'marine-galets',
    label: 'Galets minéraux & Boue marine',
    category: 'marin',
    url: IMG_MARINE_GALETS,
    alt: 'Galets minéraux et soin boue marine auto-chauffante',
    suggestedTheme: 'sauge',
  },
  {
    id: 'marine-brume',
    label: 'Brume marine apaisante',
    category: 'marin',
    url: IMG_MARINE_BRUME,
    alt: 'Brume marine douce Phytomer',
    suggestedTheme: 'marin',
  },
  {
    id: 'marine-horizon',
    label: 'Horizon marin & Lâcher-prise',
    category: 'marin',
    url: IMG_MARINE_HORIZON,
    alt: 'Horizon marin apaisant',
    suggestedTheme: 'marin',
  },
  {
    id: 'marine-littoral',
    label: 'Littoral sauvage breton',
    category: 'marin',
    url: IMG_MARINE_LITTORAL,
    alt: 'Littoral breton berceau des actifs Phytomer',
    suggestedTheme: 'marin',
  },
];

/** Catalogue structuré des soins signatures d'Emmanuelle Esthétique. */
export const EMMANUELLE_TREATMENTS_CATALOG: BrandTreatmentItem[] = [
  {
    id: 'soin-peau-nette',
    category: 'Visage Phytomer',
    title: "Soin Peau Nette & Coup d'Éclat Express",
    duration: '40 min',
    priceChf: 'CHF 90',
    description: "Nettoyage profond sous serviettes chaudes, gommage marin enzymatique, masque chauffant détoxifiant et hydratation sur-mesure.",
    slug: '/soins-visage-palezieux',
    image: 'https://images.pexels.com/photos/5659016/pexels-photo-5659016.jpeg',
    suggestedTheme: 'marin',
  },
  {
    id: 'soin-signature-phytomer',
    category: 'Visage Phytomer',
    title: 'Soin Visage Signature Phytomer',
    duration: '60 min',
    priceChf: 'CHF 130',
    description: 'Le rituel complet en 5 temps : diagnostic, double démaquillage, gommage enzymatique doux, massage manuel drainant et masque ciblé Phytomer.',
    slug: '/soin-visage-signature-palezieux',
    image: 'https://images.pexels.com/photos/5659016/pexels-photo-5659016.jpeg',
    suggestedTheme: 'marin',
  },
  {
    id: 'soin-hydra-originel',
    category: 'Visage Phytomer',
    title: 'Soin Hydra Originel — Désaltérant & Repulpant',
    duration: '60 min',
    priceChf: 'CHF 140',
    description: "Bain d'hydratation aux algues tissées bio, gommage velours, modelage visage & décolleté et masque crémeux à l'algue Nori.",
    slug: '/soins-visage-palezieux',
    image: IMG_MARINE_GOUTTES,
    suggestedTheme: 'marin',
  },
  {
    id: 'soin-peau-sensible',
    category: 'Visage Phytomer',
    title: 'Soin Visage Peau Sensible & Réactive',
    duration: '75 min',
    priceChf: 'CHF 150',
    description: 'Rituel apaisant sans parfum agressif, nettoyage doux, massage très lent anti-rougeurs et masque calmant aux algues brunes.',
    slug: '/soin-visage-peau-sensible-palezieux',
    image: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg',
    suggestedTheme: 'creme',
  },
  {
    id: 'soin-expert-jeunesse',
    category: 'Visage Phytomer',
    title: 'Soin Expert Jeunesse & Manœuvres Liftantes',
    duration: '75 à 90 min',
    priceChf: 'CHF 165 – 170',
    description: "Protocole anti-âge manuel inspiré du kobido et de la digito-pression avec masque tenseur aux actifs marins purs. Tonifie l'ovale et lisse les traits.",
    slug: '/soin-anti-age-palezieux',
    image: 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg',
    suggestedTheme: 'creme',
  },
  {
    id: 'head-spa',
    category: 'Corps & Massages',
    title: 'Head Spa — Massage Crânien Japonais',
    duration: '30 ou 45 min',
    priceChf: 'CHF 70 / CHF 95',
    description: 'Massage lent du cuir chevelu, de la nuque, des trapèzes et des tempes avec sérum végétal nourrissant. Calme le mental et facilite le sommeil.',
    slug: '/head-spa-palezieux',
    image: 'https://images.pexels.com/photos/6663371/pexels-photo-6663371.jpeg',
    suggestedTheme: 'sauge',
  },
  {
    id: 'massage-huiles-chaudes',
    category: 'Corps & Massages',
    title: 'Massage Relaxant aux Huiles Chaudes',
    duration: '60 ou 90 min',
    priceChf: 'CHF 120 / CHF 165',
    description: 'Massage enveloppant sur table chauffée aux huiles végétales tièdes (macadamia, amande douce, argan) pour dénouer le dos, les jambes et la nuque.',
    slug: '/massage-relaxant-huiles-chaudes-palezieux',
    image: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg',
    suggestedTheme: 'sauge',
  },
  {
    id: 'rituel-echappee-belle',
    category: 'Corps & Massages',
    title: 'Rituel Échappée Belle — Visage & Corps',
    duration: '1 h 45',
    priceChf: 'CHF 230',
    description: 'Gommage corps aux cristaux de sels marins Voile de Satin ou massage ciblé du dos à la boue marine, suivi du Soin Visage Hydra Originel complet.',
    slug: '/soins-corps-palezieux',
    image: IMG_MARINE_ECUME,
    suggestedTheme: 'marin',
  },
  {
    id: 'rehaussement-cils',
    category: 'Beauté du Regard',
    title: 'Rehaussement de Cils (Lash Lift) & Soin Kératine',
    duration: '60 min',
    priceChf: 'CHF 85 (CHF 105 avec teinture)',
    description: 'Recourbe vos cils naturels dès la racine pour un effet mascara permanent de 6 à 8 semaines, avec soin nourrissant à la kératine inclus.',
    slug: '/rehaussement-cils-palezieux',
    image: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg',
    suggestedTheme: 'photo',
  },
  {
    id: 'sourcils-teinture',
    category: 'Beauté du Regard',
    title: 'Mise en Forme des Sourcils & Teinture Végétale',
    duration: '30 à 45 min',
    priceChf: 'CHF 35 (Teinture dès CHF 30)',
    description: 'Tracé sur-mesure respectueux de la ligne naturelle de votre visage et teinture végétale douce pour un regard lumineux dès le réveil.',
    slug: '/beaute-du-regard-palezieux',
    image: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg',
    suggestedTheme: 'photo',
  },
  {
    id: 'epilation-sucre-cire',
    category: 'Épilation Douce & Sucre',
    title: 'Épilation Cire Douce & Pâte de Sucre Orientale',
    duration: '15 à 60 min',
    priceChf: 'Dès CHF 15 · Forfaits CHF 95 / 125',
    description: 'Épilation respectueuse des peaux réactives suivie d’une émulsion apaisante marine. Pâte de sucre 100 % naturelle réduisant les poils sous peau.',
    slug: '/epilation-sucre-palezieux',
    image: 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/1789998853978-e-pilation.jpg',
    suggestedTheme: 'creme',
  },
  {
    id: 'bons-cadeaux',
    category: 'Ateliers & Bons Cadeaux',
    title: 'Bons Cadeaux Bien-Être (Valables 60 mois)',
    duration: 'Au choix',
    priceChf: 'Montant ou soin libre',
    description: 'Offrez une parenthèse de douceur à Palézieux-Gare : bon cadeau personnalisé à télécharger ou recevoir par courrier, valable 5 ans.',
    slug: '/bon-cadeau',
    image: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg',
    suggestedTheme: 'creme',
  },
];

async function loadCurrentDnaAndResources() {
  const db = getSupabaseAdmin() || supabase;

  // 1. Lecture via getSettingsServer + lecture directe de la table settings pour fraîcheur immédiate
  const serverSettings = await getSettingsServer(DNA_SETTING_KEYS as unknown as SettingKey[]);
  const { data: rawRows } = await db
    .from('settings')
    .select('key, value')
    .in('key', [...DNA_SETTING_KEYS]);

  const dbMap: Record<string, string> = {};
  for (const row of (rawRows || []) as { key: string; value: string | null }[]) {
    if (row.value != null) {
      dbMap[row.key] = String(row.value).trim();
    }
  }

  const pick = (key: (typeof DNA_SETTING_KEYS)[number], fallback: string): string => {
    return dbMap[key] || serverSettings[key as SettingKey] || fallback;
  };

  const settings: Record<string, string> = {
    business_name: pick('business_name', EMMANUELLE_FALLBACK_DNA.business_name),
    business_owner: pick('business_owner', EMMANUELLE_FALLBACK_DNA.business_owner),
    business_address_street: pick('business_address_street', EMMANUELLE_FALLBACK_DNA.business_address_street),
    business_address_postal: pick('business_address_postal', EMMANUELLE_FALLBACK_DNA.business_address_postal),
    business_address_city: pick('business_address_city', EMMANUELLE_FALLBACK_DNA.business_address_city),
    business_phone: pick('business_phone', EMMANUELLE_FALLBACK_DNA.business_phone),
    site_activity_context: pick('site_activity_context', EMMANUELLE_FALLBACK_DNA.site_activity_context),
    site_target_persona: pick('site_target_persona', EMMANUELLE_FALLBACK_DNA.site_target_persona),
    site_tone_of_voice: pick('site_tone_of_voice', EMMANUELLE_FALLBACK_DNA.site_tone_of_voice),
    site_brand_tone: pick('site_brand_tone', EMMANUELLE_FALLBACK_DNA.site_brand_tone),
    site_blog_topics: pick('site_blog_topics', EMMANUELLE_FALLBACK_DNA.site_blog_topics),
    style_color_primary: pick('style_color_primary', '#12283A'),
    style_color_text: pick('style_color_text', '#22252A'),
    style_font_headings: pick('style_font_headings', 'Cormorant Garamond'),
    style_font_body: pick('style_font_body', 'Inter'),
    social_instagram: pick('social_instagram', 'https://www.instagram.com/emmanuelle_esthetique/'),
    social_linkedin: pick('social_linkedin', ''),
  };

  const hasSavedDnaInDb = Boolean(
    dbMap.site_activity_context || dbMap.site_brand_tone || dbMap.site_tone_of_voice
  );

  // 2. Lecture des offres du moment dans monthly_offers
  const { data: offersData } = await db
    .from('monthly_offers')
    .select('id, titre, sous_titre, description, prix_chf, prix_normal_chf, duree_minutes, date_debut, date_fin, image_url, active')
    .eq('active', true)
    .is('archived_at', null)
    .order('date_fin', { ascending: false })
    .limit(10);

  // 3. Lecture des articles publiés récents dans articles
  const { data: articlesData } = await db
    .from('articles')
    .select('id, title, slug, cover_image, excerpt, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(12);

  return {
    settings,
    dna: {
      businessName: settings.business_name,
      businessOwner: settings.business_owner,
      address: `${settings.business_address_street}, ${settings.business_address_postal} ${settings.business_address_city}`.trim(),
      city: settings.business_address_city || 'Palézieux-Gare',
      phone: settings.business_phone,
      siteUrl: 'https://emmanuelle-esthetique.ch',
      activityContext: settings.site_activity_context,
      targetPersona: settings.site_target_persona,
      toneOfVoice: settings.site_tone_of_voice,
      brandTone: settings.site_brand_tone,
      blogTopics: settings.site_blog_topics,
      primaryColor: settings.style_color_primary,
      textColor: settings.style_color_text,
      headingFont: settings.style_font_headings,
      bodyFont: settings.style_font_body,
      instagramUrl: settings.social_instagram,
      linkedinUrl: settings.social_linkedin,
      hasSavedDnaInDb,
    },
    offers: offersData || [],
    articles: articlesData || [],
    treatments: EMMANUELLE_TREATMENTS_CATALOG,
    gallery: EMMANUELLE_PHOTO_GALLERY,
  };
}

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await loadCurrentDnaAndResources();
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[social-brand-dna][GET] error:', err);
    return NextResponse.json(
      { error: err?.message || "Erreur lors du chargement de l'ADN de marque." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const action = String(body?.action || 'save').trim();
  const db = getSupabaseAdmin() || supabase;

  if (action === 'save') {
    try {
      const incoming = body?.dna || body?.settings || body || {};
      const fieldMapping: Record<string, string> = {
        business_name: incoming.business_name ?? incoming.businessName,
        business_owner: incoming.business_owner ?? incoming.businessOwner,
        business_address_street: incoming.business_address_street,
        business_address_postal: incoming.business_address_postal,
        business_address_city: incoming.business_address_city ?? incoming.city,
        business_phone: incoming.business_phone ?? incoming.phone,
        site_activity_context: incoming.site_activity_context ?? incoming.activityContext,
        site_target_persona: incoming.site_target_persona ?? incoming.targetPersona,
        site_tone_of_voice: incoming.site_tone_of_voice ?? incoming.toneOfVoice,
        site_brand_tone: incoming.site_brand_tone ?? incoming.brandTone,
        site_blog_topics: incoming.site_blog_topics ?? incoming.blogTopics,
        style_color_primary: incoming.style_color_primary ?? incoming.primaryColor,
        style_color_text: incoming.style_color_text ?? incoming.textColor,
        style_font_headings: incoming.style_font_headings ?? incoming.headingFont,
        style_font_body: incoming.style_font_body ?? incoming.bodyFont,
        social_instagram: incoming.social_instagram ?? incoming.instagramUrl,
        social_linkedin: incoming.social_linkedin ?? incoming.linkedinUrl,
      };

      const rowsToUpsert = Object.entries(fieldMapping)
        .filter(([, val]) => typeof val === 'string')
        .map(([key, value]) => ({ key, value: String(value).trim() }));

      if (rowsToUpsert.length > 0) {
        const { error } = await db.from('settings').upsert(rowsToUpsert, { onConflict: 'key' });
        if (error) throw error;
      }

      const updated = await loadCurrentDnaAndResources();
      return NextResponse.json({ success: true, ...updated });
    } catch (err: any) {
      console.error('[social-brand-dna][POST save] error:', err);
      return NextResponse.json(
        { error: err?.message || "Impossible d'enregistrer l'ADN de marque." },
        { status: 500 }
      );
    }
  }

  if (action === 'scan') {
    try {
      const targetUrl = String(body?.url || 'https://emmanuelle-esthetique.ch').trim();

      // 1. Extraction optionnelle du site en ligne via extractSite (sans échouer si hors-ligne)
      let webDigest = '';
      try {
        const fetched = await fetchPublicPage(targetUrl);
        const extracted = extractSite(fetched.html, fetched.url);
        webDigest = toPromptDigest(extracted).slice(0, 4000);
      } catch (e: any) {
        console.warn('[social-brand-dna] Repli sur dynamic_pages (fetch URL ignoré):', e?.message);
      }

      // 2. Lecture des pages publiées dans dynamic_pages
      const { data: pagesData } = await db
        .from('dynamic_pages')
        .select('title, slug, sections')
        .eq('published', true)
        .limit(25);

      const pagesDigest = ((pagesData || []) as { title: string; slug: string; sections: any[] }[])
        .map((p) => {
          const sectionTexts = (Array.isArray(p.sections) ? p.sections : [])
            .map((s) => {
              const d = s?.data || {};
              return [
                d.title,
                d.description,
                d.quote,
                d.text ? stripHtml(String(d.text)) : '',
                d.content ? stripHtml(String(d.content)) : '',
                d.price ? `Tarif: ${d.price} ${d.price_note || ''}` : '',
                Array.isArray(d.cards)
                  ? d.cards.map((c: any) => `${c.title || c.question || ''}: ${c.description || c.answer || ''}`).join(' | ')
                  : '',
              ]
                .filter(Boolean)
                .join(' — ');
            })
            .filter(Boolean)
            .join('\n  ');
          return `Page /${p.slug} (${p.title}) :\n  ${sectionTexts.slice(0, 800)}`;
        })
        .join('\n\n')
        .slice(0, 7000);

      // 3. Lecture des offres actives
      const { data: activeOffers } = await db
        .from('monthly_offers')
        .select('titre, sous_titre, description, prix_chf, duree_minutes')
        .eq('active', true)
        .is('archived_at', null)
        .limit(8);

      const offersDigest = ((activeOffers || []) as any[])
        .map((o) => `- ${o.titre} (${o.duree_minutes} min, CHF ${o.prix_chf}) : ${o.sous_titre || ''} ${o.description || ''}`)
        .join('\n');

      const systemPrompt = `Tu es le Directeur de Marque & Stratège Social Media d'Emmanuelle Esthétique à Palézieux-Gare (https://emmanuelle-esthetique.ch/).
À partir du scan du site web, des pages de soins en base et du référentiel de l'institut, synthétise un ADN de marque complet, riche, chaleureux et chirurgicalement précis pour alimenter le Studio Social IA (façon TryHolo).

Règles impératives :
- Respecte scrupuleusement l'identité d'Emmanuelle Esthétique : institut de beauté & bien-être en cabine privée à Palézieux-Gare (Chemin de la Marouette 19, 1607 Palézieux, Vaud, Suisse, à 2 min à pied de la gare CFF et parking gratuit), +20 ans d'expérience, réservé aux femmes sur rendez-vous.
- Mentionne les soins signatures réels et leurs tarifs en CHF (jamais en €) : soins visage et corps Phytomer (Peau Nette CHF 90, Signature CHF 130, Hydra Originel CHF 140, Peau Sensible CHF 150, Expert Jeunesse / Anti-âge CHF 165-170, Boue marine auto-chauffante dos CHF 30), Head Spa massage crânien japonais (CHF 70 / 95), Massage relaxant aux huiles chaudes (CHF 120 / 165), Rituel Échappée Belle (CHF 230), Beauté du regard (Rehaussement de cils CHF 85, Sourcils CHF 35, Teinture végétale dès CHF 30, Cours de maquillage CHF 110), Épilation cire douce et pâte de sucre orientale (Forfaits CHF 95 / 125), Ateliers Gua Sha et Bons cadeaux (valables 60 mois).
- Vouvoiement systématique, ton doux, sensoriel, apaisant, expert, sans jugement, ancré en Suisse romande (Palézieux-Gare, Oron, Châtel-St-Denis, Lavaux, Haute-Broye).

Réponds UNIQUEMENT avec un objet JSON strict contenant exactement ces 5 clés :
{
  "site_activity_context": "...",
  "site_target_persona": "...",
  "site_tone_of_voice": "...",
  "site_brand_tone": "...",
  "site_blog_topics": "..."
}`;

      const userPrompt = `Voici la matière extraite du site Emmanuelle Esthétique (${targetUrl}) :

${webDigest ? `━━━ EXTRACTION WEB EN DIRECT ━━━\n${webDigest}\n\n` : ''}━━━ PAGES DE SOINS EN BASE ━━━
${pagesDigest || EMMANUELLE_FALLBACK_DNA.site_brand_tone}

${offersDigest ? `━━━ OFFRES DU MOMENT EN BASE ━━━\n${offersDigest}\n\n` : ''}━━━ RÉFÉRENTIEL INSTITUT EMMANUELLE ESTHÉTIQUE ━━━
Activité : ${EMMANUELLE_FALLBACK_DNA.site_activity_context}
Carte des soins : ${EMMANUELLE_FALLBACK_DNA.site_brand_tone}

Génère le JSON des 5 piliers d'ADN de marque d'Emmanuelle Esthétique.`;

      let synthesizedDna = {
        site_activity_context: EMMANUELLE_FALLBACK_DNA.site_activity_context,
        site_target_persona: EMMANUELLE_FALLBACK_DNA.site_target_persona,
        site_tone_of_voice: EMMANUELLE_FALLBACK_DNA.site_tone_of_voice,
        site_brand_tone: EMMANUELLE_FALLBACK_DNA.site_brand_tone,
        site_blog_topics: EMMANUELLE_FALLBACK_DNA.site_blog_topics,
      };

      try {
        const aiRes = await callClaude({
          feature: 'social-dna',
          max_tokens: 3500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const parsed = extractJson(aiRes.content[0].text);
        if (parsed && typeof parsed === 'object') {
          synthesizedDna = {
            site_activity_context: String(parsed.site_activity_context || synthesizedDna.site_activity_context).trim(),
            site_target_persona: String(parsed.site_target_persona || synthesizedDna.site_target_persona).trim(),
            site_tone_of_voice: String(parsed.site_tone_of_voice || synthesizedDna.site_tone_of_voice).trim(),
            site_brand_tone: String(parsed.site_brand_tone || synthesizedDna.site_brand_tone).trim(),
            site_blog_topics: String(parsed.site_blog_topics || synthesizedDna.site_blog_topics).trim(),
          };
        }
      } catch (aiErr: any) {
        console.warn('[social-brand-dna] Repli sur EMMANUELLE_FALLBACK_DNA suite à erreur IA:', aiErr?.message);
      }

      const upsertRows = [
        { key: 'business_name', value: EMMANUELLE_FALLBACK_DNA.business_name },
        { key: 'business_owner', value: EMMANUELLE_FALLBACK_DNA.business_owner },
        { key: 'business_address_city', value: EMMANUELLE_FALLBACK_DNA.business_address_city },
        { key: 'site_activity_context', value: synthesizedDna.site_activity_context },
        { key: 'site_target_persona', value: synthesizedDna.site_target_persona },
        { key: 'site_tone_of_voice', value: synthesizedDna.site_tone_of_voice },
        { key: 'site_brand_tone', value: synthesizedDna.site_brand_tone },
        { key: 'site_blog_topics', value: synthesizedDna.site_blog_topics },
      ];

      const { error: upsertError } = await db
        .from('settings')
        .upsert(upsertRows, { onConflict: 'key' });

      if (upsertError) {
        console.error('[social-brand-dna] Erreur upsert settings:', upsertError);
      }

      const updated = await loadCurrentDnaAndResources();
      return NextResponse.json({
        success: true,
        scannedUrl: targetUrl,
        ...updated,
      });
    } catch (err: any) {
      console.error('[social-brand-dna][POST scan] error:', err);
      return NextResponse.json(
        { error: err?.message || 'Erreur lors du scan ADN du site.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: `Action '${action}' non reconnue.` }, { status: 400 });
}
