/**
 * Tests des règles « réseaux sociaux » (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-social.ts
 */
import assert from 'node:assert/strict';
import {
  aggregateError,
  aggregateStatus,
  captionFor,
  isJpegUrl,
  metaErrorMessage,
  normalizePost,
  normalizeWriting,
  parseHashtags,
  publishProblems,
  scheduleProblem,
  normalizePlan,
  normalizeReel,
  normalizeReelDraft,
  parseRhythm,
  reelDuration,
  reelProblems,
  rhythmSlots,
  seasonalMoments,
  zurichToUtc,
  DEFAULT_RHYTHM,
  weekStart,
  nextWeekStart,
  weekLabel,
  weekRange,
  weekState,
  shouldPrepareNextWeek,
  parseWeeklyDay,
} from '../src/types/social';
import { neutralizeEditLists, hasEditList } from '../src/utils/mp4Boxes';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
  }
}

const SITE = 'https://institut.ch';
const both = { instagram: true, facebook: true };
const base = {
  caption: 'Votre peau tire ?\n\nUn soin pour elle.',
  hashtags: '#Palezieux #SoinVisage',
  link_path: '/soins/visage',
  image_url: 'https://pub-x.r2.dev/social/2026-10-20/1-ab.jpg',
  networks: ['instagram', 'facebook'] as ('instagram' | 'facebook')[],
};

console.log('Hashtags');
test('un mot = un hashtag, # ajouté, doublons retirés sans la casse', () => {
  assert.deepEqual(parseHashtags('#Soin, palezieux #Palezieux  oron'), ['#Soin', '#palezieux', '#oron']);
});
test('accents et ponctuation retirés', () => {
  assert.deepEqual(parseHashtags('#Épilation #Oron-la-Ville #bien-être! #PalézieuxGare'), ['#Epilation', '#OronlaVille', '#bienetre', '#PalezieuxGare']);
});
test('vide → aucun hashtag', () => {
  assert.deepEqual(parseHashtags('  , # ;'), []);
});

console.log('Légendes par réseau');
test('Instagram : légende + hashtags, aucun lien', () => {
  assert.equal(captionFor('instagram', base, SITE), 'Votre peau tire ?\n\nUn soin pour elle.\n\n#Palezieux #SoinVisage');
});
test('Facebook : lien vers la page du site et trois hashtags au plus', () => {
  const fb = captionFor('facebook', { ...base, hashtags: '#a #b #c #d #e' }, SITE);
  assert.equal(fb, 'Votre peau tire ?\n\nUn soin pour elle.\n\nDécouvrir le soin : https://institut.ch/soins/visage\n\n#a #b #c');
});
test('Facebook sans lien quand link_path est vide', () => {
  assert.ok(!captionFor('facebook', { ...base, link_path: null }, SITE).includes('http'));
});
test('libellé du lien selon la page', () => {
  assert.ok(captionFor('facebook', { ...base, link_path: '/reservation' }, SITE).includes('Réserver en ligne : https://institut.ch/reservation'));
  assert.ok(captionFor('facebook', { ...base, link_path: '/blog/peau' }, SITE).includes('Lire l’article'));
});

console.log('Contrôles avant envoi');
test('publication complète : rien à redire', () => {
  assert.deepEqual(publishProblems(base, both, SITE), []);
});
test('le visuel doit être un JPEG en https', () => {
  assert.equal(isJpegUrl('https://x.dev/a.webp'), false);
  assert.equal(isJpegUrl('http://x.dev/a.jpg'), false);
  assert.equal(isJpegUrl('https://x.dev/a.JPEG'), true);
  assert.ok(publishProblems({ ...base, image_url: 'https://x.dev/a.webp' }, both)[0].includes('JPEG'));
});
test('réseau non relié signalé', () => {
  const p = publishProblems(base, { instagram: false, facebook: true });
  assert.equal(p.length, 1);
  assert.ok(p[0].startsWith('Instagram'));
});
test('légende vide, aucun réseau, pas de visuel', () => {
  const p = publishProblems({ ...base, caption: '  ', networks: [], image_url: null }, both);
  assert.equal(p.length, 3);
});
test('plus de 30 hashtags refusés pour Instagram, pas pour Facebook seul', () => {
  const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
  assert.ok(publishProblems({ ...base, hashtags: tags }, both).some((x) => x.includes('30 hashtags')));
  assert.deepEqual(publishProblems({ ...base, hashtags: tags, networks: ['facebook'] }, both), []);
});
test('légende Instagram de plus de 2200 caractères refusée', () => {
  assert.ok(publishProblems({ ...base, caption: 'x'.repeat(2190) }, both).some((x) => x.includes('2200')));
});

console.log('Programmation');
const now = new Date('2026-10-20T10:00:00Z');
test('une heure passée ou trop proche est refusée', () => {
  assert.ok(scheduleProblem(new Date('2026-10-20T10:01:00Z'), now));
  assert.ok(scheduleProblem(new Date('2026-10-19T10:00:00Z'), now));
});
test('demain 18 h est accepté, dans sept mois non', () => {
  assert.equal(scheduleProblem(new Date('2026-10-21T16:00:00Z'), now), null);
  assert.ok(scheduleProblem(new Date('2027-05-20T10:00:00Z'), now));
});
test('date illisible', () => {
  assert.ok(scheduleProblem(new Date('n’importe quoi'), now));
});

console.log('Statut d’ensemble');
test('en cours tant qu’un réseau attend', () => {
  assert.equal(aggregateStatus([{ status: 'published' }, { status: 'processing' }]), 'publishing');
});
test('publiée, en partie, échec', () => {
  assert.equal(aggregateStatus([{ status: 'published' }, { status: 'published' }]), 'published');
  assert.equal(aggregateStatus([{ status: 'published' }, { status: 'failed' }]), 'partial');
  assert.equal(aggregateStatus([{ status: 'failed' }]), 'failed');
  assert.equal(aggregateStatus([]), 'draft');
});
test('message d’échec par réseau', () => {
  assert.equal(
    aggregateError([{ status: 'failed', error: 'Jeton expiré', network: 'instagram' }, { status: 'published', error: null, network: 'facebook' }]),
    'Instagram : Jeton expiré',
  );
});

console.log('Erreurs Meta');
test('jeton expiré → reconnecter', () => {
  assert.ok(metaErrorMessage({ code: 190, message: 'Error validating access token' }).includes('Reconnectez'));
});
test('mauvais App Secret reconnu', () => {
  assert.ok(metaErrorMessage({ code: 1, message: 'Error validating client secret.' }).includes('App Secret'));
});
test('autorisation manquante, limite, image', () => {
  assert.ok(metaErrorMessage({ code: 200, message: 'Permissions error' }).includes('autorisation'));
  assert.ok(metaErrorMessage({ code: 4 }).includes('Réessayez dans une heure'));
  assert.ok(metaErrorMessage({ code: 9004, error_subcode: 2207052 }).includes('télécharger le visuel'));
});
test('erreur inconnue : le détail de Meta reste lisible', () => {
  assert.equal(metaErrorMessage({ code: 12345, message: 'Bizarre' }), 'Meta : Bizarre');
});

console.log('Rédaction IA');
test('hashtags séparés du texte, phrase du visuel nettoyée', () => {
  const w = normalizeWriting({
    eyebrow: 'Soins du visage',
    headline: 'Votre peau\nmérite une pause.',
    caption: 'Première ligne.\n\nSuite du texte. #Oron #Vaud',
    hashtags: ['Palezieux', '#Oron', 'Oron', '#Noel2024'],
  });
  assert.ok(w);
  assert.equal(w!.headline, 'Votre peau mérite une pause');
  assert.equal(w!.caption, 'Première ligne.\n\nSuite du texte.');
  assert.equal(w!.hashtags, '#Palezieux #Oron');
});
test('réponse incomplète refusée', () => {
  assert.equal(normalizeWriting({ caption: 'x' }), null);
  assert.equal(normalizeWriting(null), null);
});

console.log('Anciens posts');
test('un post de l’ancien Studio se lit sans erreur', () => {
  const p = normalizePost({ id: '1', title: 'Ancien', status: 'draft', cover_image: 'https://x/a.webp', content: { instagram: {} } });
  assert.equal(p.visual.layout, 'photo');
  assert.equal(p.visual.headline, 'Ancien');
  assert.equal(p.visual.photo_url, 'https://x/a.webp');
  assert.deepEqual(p.networks, ['instagram', 'facebook']);
});

console.log('Stories et Reels');
test('une story n’a pas besoin de légende', () => {
  assert.deepEqual(publishProblems({ ...base, kind: 'story', caption: '' }, both), []);
});
test('un Reel exige sa vidéo MP4 et sa couverture', () => {
  const p = publishProblems({ ...base, kind: 'reel', video_url: null }, both);
  assert.ok(p.some((x) => x.includes('vidéo du Reel')));
  assert.ok(publishProblems({ ...base, kind: 'reel', video_url: 'https://x.dev/v.webm' }, both).some((x) => x.includes('MP4')));
  assert.deepEqual(publishProblems({ ...base, kind: 'reel', video_url: 'https://x.dev/v.mp4' }, both), []);
});
test('scènes du Reel : durées bornées, contenu exigé, 60 s au plus', () => {
  const r = normalizeReel({ scenes: [{ type: 'photo', duration: 99 }, { type: 'text', text: '', duration: 0.5 }, { type: 'bidon' }] })!;
  assert.equal(r.scenes.length, 2);
  assert.equal(r.scenes[0].duration, 12);
  assert.equal(r.scenes[1].duration, 1.5);
  const problems = reelProblems(r);
  assert.ok(problems.some((x) => x.includes('choisissez une photo')));
  assert.ok(problems.some((x) => x.includes('écrivez le texte')));
  const long = normalizeReel({ scenes: Array.from({ length: 6 }, () => ({ type: 'text', text: 'x', duration: 12 })) })!;
  assert.ok(reelProblems(long).some((x) => x.includes('60 s')));
  assert.equal(reelDuration({ scenes: [{ duration: 3 }, { duration: 2 }] as any }), 7.5);
});
test('brouillon IA de Reel : pas de vidéo sans banque branchée', () => {
  const d = normalizeReelDraft({ scenes: [{ type: 'video', text: 'Vagues', video_query: 'ocean' }, { type: 'text', text: '' }], mood: 'zen' }, false);
  assert.equal(d.scenes.length, 1);
  assert.equal(d.scenes[0].type, 'photo');
  assert.equal(d.mood, 'zen');
  assert.equal(normalizeReelDraft({ scenes: [{ type: 'video', video_query: 'spa' }] }, true).scenes[0].type, 'video');
});

console.log('MP4 : listes d’éditions');
const box = (type: string, payload: Uint8Array) => {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(payload, 8);
  return out;
};
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
test('edts renommé en free dans moov/trak, tailles intactes', () => {
  const trak = box('trak', cat(box('tkhd', new Uint8Array(4)), box('edts', box('elst', new Uint8Array(12))), box('mdia', new Uint8Array(8))));
  const file = cat(box('ftyp', new Uint8Array(8)), box('moov', cat(box('mvhd', new Uint8Array(4)), trak)), box('mdat', new Uint8Array(16)));
  const length = file.length;
  assert.equal(hasEditList(file), true);
  assert.equal(neutralizeEditLists(file), 1);
  assert.equal(file.length, length);
  assert.equal(hasEditList(file), false);
  assert.ok(new TextDecoder('latin1').decode(file).includes('free'));
});
test('un edts hors de moov n’est pas touché', () => {
  const file = cat(box('ftyp', new Uint8Array(8)), box('mdat', box('edts', new Uint8Array(4))));
  assert.equal(neutralizeEditLists(file), 0);
});

console.log('Rythme et plan');
test('heure de Zurich → UTC, été comme hiver', () => {
  assert.equal(zurichToUtc('2026-10-20', '18:30').toISOString(), '2026-10-20T16:30:00.000Z');
  assert.equal(zurichToUtc('2026-10-27', '18:30').toISOString(), '2026-10-27T17:30:00.000Z');
  assert.equal(zurichToUtc('2027-03-28', '09:30').toISOString(), '2027-03-28T07:30:00.000Z');
});
test('rythme illisible → rythme par défaut ; créneaux triés', () => {
  assert.deepEqual(parseRhythm('n’importe quoi'), DEFAULT_RHYTHM);
  const r = parseRhythm(JSON.stringify({ slots: [{ day: 6, time: '09:30' }, { day: 2, time: '18:30', kind: 'reel' }, { day: 9, time: '10:00' }] }));
  assert.deepEqual(r.slots.map((s) => `${s.day}-${s.time}-${s.kind}`), ['2-18:30-reel', '6-09:30-post']);
});
test('créneaux : jours pris et heures passées sautés', () => {
  const now = new Date('2026-10-20T10:00:00Z'); // mardi
  const slots = rhythmSlots(DEFAULT_RHYTHM, '2026-10-20', 14, new Set(['2026-10-22']), now);
  // mar 20 (18:30 à venir), [jeu 22 pris], sam 24, mar 27, jeu 29, sam 31
  assert.deepEqual(slots.map((s) => s.dayKey), ['2026-10-20', '2026-10-24', '2026-10-27', '2026-10-29', '2026-10-31']);
  assert.equal(slots[3].kind, 'reel');
  const later = rhythmSlots(DEFAULT_RHYTHM, '2026-10-20', 1, new Set(), new Date('2026-10-20T16:10:00Z'));
  assert.equal(later.length, 0, 'moins de 30 min avant le créneau : trop tard');
});
test('moments de l’année : fête des mères le 2e dimanche de mai', () => {
  const m = seasonalMoments('2027-05-01', '2027-05-31');
  assert.ok(m.some((x) => x.day === '2027-05-09' && x.label.includes('mères')));
});
test('plan IA normalisé : créneau unique, source vérifiée, offre dans sa période', () => {
  const slots = [
    { at: '2026-10-27T17:30:00.000Z', dayKey: '2026-10-27', kind: 'post' as const },
    { at: '2026-10-29T17:30:00.000Z', dayKey: '2026-10-29', kind: 'reel' as const },
    { at: '2026-11-10T17:30:00.000Z', dayKey: '2026-11-10', kind: 'post' as const },
  ];
  const plan = normalizePlan({ items: [
    { slot: 0, pillar: 'visage', source: 'soin', ref: 'hydra', subject: 'Le soin Hydra', angle: 'Peau qui tiraille' },
    { slot: 0, pillar: 'corps', source: 'idee', subject: 'Doublon du créneau 0' },
    { slot: 1, pillar: 'bidon', source: 'soin', ref: 'inconnu', subject: 'Un massage' },
    { slot: 2, pillar: 'offre', source: 'offre', ref: 'o1', subject: 'Offre hors période' },
    { slot: 7, subject: 'Créneau inexistant' },
  ] }, { slots, soinIds: new Set(['hydra']), articleIds: new Set(), offers: [{ id: 'o1', date_debut: '2026-10-20', date_fin: '2026-10-31' }] });
  assert.equal(plan.length, 3);
  assert.deepEqual(plan[0].source, { kind: 'soin', id: 'hydra' });
  assert.deepEqual(plan[1].source, { kind: 'idee' }, 'soin inconnu → idée libre');
  assert.equal(plan[1].pillar, 'conseil');
  assert.equal(plan[1].kind, 'reel');
  assert.deepEqual(plan[2].source, { kind: 'idee' }, 'offre hors période → idée libre');
});

console.log('Semaine à préparer');
test('lundi de la semaine, semaine suivante, libellé', () => {
  assert.equal(weekStart('2026-10-21'), '2026-10-19'); // mercredi → lundi
  assert.equal(weekStart('2026-10-25'), '2026-10-19'); // dimanche → lundi
  assert.equal(nextWeekStart('2026-10-21'), '2026-10-26');
  assert.equal(weekLabel('2026-10-26'), 'du 26 octobre au 1er novembre');
});
test('bornes de la semaine en heure suisse (passage à l’heure d’hiver compris)', () => {
  assert.deepEqual(weekRange('2026-10-19'), { from: '2026-10-18T22:00:00.000Z', to: '2026-10-25T23:00:00.000Z' });
});
test('préparer la semaine suivante à partir du jour réglé', () => {
  assert.equal(shouldPrepareNextWeek('2026-10-20', 3), false); // mardi
  assert.equal(shouldPrepareNextWeek('2026-10-21', 3), true); // mercredi
  assert.equal(shouldPrepareNextWeek('2026-10-24', 3), true); // samedi : rattrapage
  assert.equal(parseWeeklyDay('9'), 3);
  assert.equal(parseWeeklyDay('5'), 5);
});
test('état d’une publication dans la semaine', () => {
  const ready = { ...base, status: 'draft' as const, kind: 'post' as const, video_url: null };
  assert.equal(weekState({ ...ready, caption: '' }), 'sujet');
  assert.equal(weekState(ready), 'a_relire');
  assert.equal(weekState({ ...ready, status: 'scheduled' }), 'programmee');
  assert.equal(weekState({ ...ready, kind: 'reel' }), 'sujet', 'Reel sans vidéo : pas encore prêt');
});

console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
if (failed > 0) process.exit(1);
