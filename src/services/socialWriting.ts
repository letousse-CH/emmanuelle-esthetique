/**
 * Rédaction d'une publication Instagram / Facebook par l'IA (serveur).
 *
 * Un seul appel court : une phrase de visuel, un surtitre, une légende et des
 * hashtags. La carte des soins (`carteFactsForPrompt`) est la seule source de
 * noms, de durées et de prix ; le ton vient des réglages « Éditorial & Marque ».
 * Rien n'est codé en dur sur l'activité (voir CLAUDE.md, « Ton éditorial »).
 */
import { callClaude, extractJson } from '../utils/ai';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { supabase } from './supabase';
import { carteFactsForPrompt } from '../utils/blogSilo';
import { flatCarte, itemPriceLabel } from '../constants/carteSoins';
import { normalizeReelDraft, normalizeWriting, type SocialKind, type SocialSourceType, type SocialWriting } from '../types/social';
import { offerDescriptionText, offerPagePath, formatOfferPeriod, formatOfferPrice } from '../types/offers';

export type WritingSource =
  | { kind: 'idee'; text: string }
  | { kind: 'soin'; id: string }
  | { kind: 'article'; id: string }
  | { kind: 'offre'; id: string };

export interface ResolvedSource {
  kind: SocialSourceType;
  ref: string;
  title: string;
  /** Ce que l'IA doit raconter. */
  material: string;
  linkPath: string;
  eyebrow: string;
  photoUrl: string | null;
}

const strip = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function db() {
  return getSupabaseAdmin() ?? supabase;
}

export async function resolveSource(source: WritingSource): Promise<ResolvedSource> {
  if (source.kind === 'idee') {
    const text = source.text.trim();
    if (text.length < 3) throw new Error('Décrivez le sujet en quelques mots.');
    return { kind: 'idee', ref: 'idee', title: text.slice(0, 120), material: text, linkPath: '/reservation', eyebrow: '', photoUrl: null };
  }

  if (source.kind === 'soin') {
    const item = flatCarte().find((i) => i.id === source.id);
    if (!item) throw new Error('Soin introuvable dans la carte.');
    const durations = item.variants?.length ? item.variants.map((v) => `${v.duration} : CHF ${v.price}`).join(', ') : item.duration || '';
    return {
      kind: 'soin',
      ref: item.id,
      title: item.name,
      material: [
        `Soin : ${item.name} (${item.category.label}).`,
        durations ? `Durée et prix : ${durations}.` : `Prix : ${itemPriceLabel(item)}.`,
        item.description ? `Description de la carte : ${item.description}` : '',
      ].filter(Boolean).join('\n'),
      linkPath: item.category.path,
      eyebrow: item.category.label,
      photoUrl: null,
    };
  }

  if (source.kind === 'article') {
    const { data, error } = await db()
      .from('articles')
      .select('id, title, slug, content, meta_description, cover_image')
      .eq('id', source.id)
      .maybeSingle();
    if (error || !data) throw new Error('Article introuvable.');
    return {
      kind: 'article',
      ref: data.id,
      title: data.title,
      material: `Article du blog : « ${data.title} »\n${data.meta_description ? `Résumé : ${data.meta_description}\n` : ''}Texte :\n${strip(data.content).slice(0, 5000)}`,
      linkPath: `/blog/${data.slug}`,
      eyebrow: 'Conseil beauté',
      photoUrl: data.cover_image || null,
    };
  }

  const { data, error } = await db().from('monthly_offers').select('*').eq('id', source.id).maybeSingle();
  if (error || !data) throw new Error('Offre introuvable.');
  const prix = data.prix_normal_chf && data.prix_normal_chf > data.prix_chf
    ? `${formatOfferPrice(data.prix_chf)} au lieu de ${formatOfferPrice(data.prix_normal_chf)}`
    : formatOfferPrice(data.prix_chf);
  return {
    kind: 'offre',
    ref: data.id,
    title: data.titre,
    material: [
      `Offre du moment : ${data.titre}`,
      `Tarif : ${prix} · durée ${data.duree_minutes} min · valable ${formatOfferPeriod(data.date_debut, data.date_fin)}.`,
      data.places_max ? `Nombre de places limité (${data.places_max}).` : '',
      offerDescriptionText(data.description),
      data.conditions ? `Conditions : ${data.conditions}` : '',
    ].filter(Boolean).join('\n'),
    linkPath: offerPagePath(data.id),
    eyebrow: 'Offre du moment',
    photoUrl: data.image_url || null,
  };
}

async function readEditorialSettings(): Promise<Record<string, string>> {
  const keys = [
    'business_name', 'business_owner', 'business_owner_bio', 'business_address_city',
    'site_activity_context', 'site_target_persona', 'site_tone_of_voice',
  ];
  const { data } = await db().from('settings').select('key, value').in('key', keys);
  return Object.fromEntries((data ?? []).map((r: any) => [r.key, String(r.value ?? '').trim()]));
}

/** Ce que l'IA doit savoir de l'institut : activité, public, ton, et la carte (seule source des soins et des prix). */
export function brandContext(s: Record<string, string>): string {
  return `━━━ L'INSTITUT ━━━
${s.site_activity_context || ''}

━━━ À QUI L'ON PARLE ━━━
${s.site_target_persona || ''}

━━━ TON ━━━
${s.site_tone_of_voice || 'Chaleureux, précis, vouvoiement.'}

${carteFactsForPrompt(s)}`;
}

export { readEditorialSettings };

const KIND_RULES: Record<SocialKind, string> = {
  post: '',
  story: `
━━━ C'EST UNE STORY ━━━
- La phrase du visuel est tout ce que l'on verra : 3 à 8 mots, très lisibles.
- La légende ne sera pas publiée (les stories n'en ont pas) : une seule phrase, qui sert de mémo.`,
  reel: `
━━━ C'EST UN REEL (vidéo verticale de 10 à 25 s) ━━━
- "scenes" : 3 à 6 scènes qui racontent le sujet dans l'ordre. Types :
  · "photo" : une photo de l'institut ou d'un soin, avec un texte court posé dessus (0 à 9 mots) ; "photo_hint" = 1 à 3 mots français pour la choisir (ex. « visage », « cabine », « mains »).
  · "text" : une diapo de texte seul sur fond marine (4 à 9 mots), pour une idée forte.
  · "video" : un extrait de banque d'images libre de droits ; "video_query" = 2 à 4 mots ANGLAIS (ex. « facial massage spa », « ocean waves calm »). N'en propose que si c'est permis ci-dessous, jamais de visage reconnaissable présenté comme une cliente.
- Alterner photo et texte ; finir par une scène qui donne envie de réserver (le carton final avec le logo est ajouté automatiquement).
- "mood" : l'ambiance musicale, parmi "douce", "lumineuse", "zen", "rythmee".`,
};

export async function writeSocialPost(
  source: ResolvedSource,
  instruction?: string,
  kind: SocialKind = 'post',
  videoAvailable = false,
  /** Date de parution (ISO), pour que le texte colle à la saison. */
  plannedFor?: string | null,
): Promise<SocialWriting> {
  const s = await readEditorialSettings();
  const brand = s.business_name || 'l’institut';
  const city = s.business_address_city || '';

  const system = `Tu rédiges les publications Instagram et Facebook de ${brand}${city ? ` (${city})` : ''}.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour.

${brandContext(s)}

━━━ RÈGLES DE LA PUBLICATION ━━━
- Une seule légende, la même pour Instagram et Facebook. Vouvoiement. Français de Suisse romande ; montants en CHF.
- Première ligne : une accroche concrète de moins de 110 caractères (c'est tout ce qui s'affiche avant « plus »). Pas de question rhétorique creuse.
- Puis deux à quatre paragraphes courts, séparés par une ligne vide. 450 à 900 caractères au total.
- Finir par une invitation simple à réserver (« réservation en ligne, lien dans la bio »).
- Aucune adresse web dans le texte (le lien est ajouté automatiquement sur Facebook). Aucun hashtag dans le texte.
- Deux emojis au plus, sobres, ou aucun.
- Pas de jargon marketing, pas de superlatifs (« incroyable », « révolutionnaire »), pas de promesse de résultat.

${KIND_RULES[kind]}${kind === 'reel' ? `\n- Extraits vidéo : ${videoAvailable ? 'permis (1 ou 2 au plus).' : 'NON disponibles, utilise seulement "photo" et "text".'}` : ''}

━━━ FORMAT ━━━
{
  "eyebrow": "2 à 4 mots, le thème (ex. « Soins du visage »)",
  "headline": "la phrase du visuel : 4 à 10 mots, sans emoji, sans point final",
  "caption": "la légende",
  "hashtags": ["6 à 10 hashtags sans espace ni accent (#PalezieuxGare) : locaux (ville, région) et thème du post"]${kind === 'reel' ? `,
  "scenes": [{ "type": "photo", "text": "…", "photo_hint": "…", "video_query": "" }],
  "mood": "douce"` : ''}
}`;

  const today = new Date().toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const user = `Nous sommes le ${today}.${plannedFor ? ` La publication paraîtra le ${new Date(plannedFor).toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}

Sujet de la publication :
"""
${source.material}
"""
${instruction?.trim() ? `\nConsigne de l'institut : ${instruction.trim()}\n` : ''}
Rédige la publication.`;

  const res = await callClaude({ feature: 'social', max_tokens: kind === 'reel' ? 2000 : 1400, system, messages: [{ role: 'user', content: user }] });
  const raw = extractJson(res.content[0].text);
  const writing = normalizeWriting(raw);
  if (!writing) throw new Error('La rédaction est revenue incomplète. Réessayez.');
  if (!writing.eyebrow && source.eyebrow) writing.eyebrow = source.eyebrow;
  if (kind === 'reel') {
    const draft = normalizeReelDraft(raw, videoAvailable);
    if (!draft.scenes.length) throw new Error('Les scènes du Reel sont revenues vides. Réessayez.');
    writing.scenes = draft.scenes;
    writing.mood = draft.mood;
  }
  return writing;
}
