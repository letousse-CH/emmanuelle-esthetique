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
} from '../src/types/social';

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
    hashtags: ['Palezieux', '#Oron', 'Oron'],
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

console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
if (failed > 0) process.exit(1);
