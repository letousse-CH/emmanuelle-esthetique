/**
 * Tests du moteur de disponibilité (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-booking-engine.ts
 *
 * Calendrier utilisé : octobre 2026 — le 5 est un lundi, le 4 un dimanche,
 * le 3 un samedi. Horaires : lun–ven 09:00–12:00 et 13:30–18:30, buffer 30 min,
 * pas 30 min, coupure matin/après-midi 13:00.
 */
import assert from 'node:assert/strict';
import {
  addDays,
  busyFromInstants,
  computeDay,
  computeRange,
  dateBoundsError,
  dayOfWeek,
  findFixedConflicts,
  zurichInstant,
  zurichNow,
  zurichToday,
  type EngineBooking,
  type EngineSettings,
} from '../src/services/bookingEngine';
import type { BookingBlock } from '../src/types/booking';

const SEMAINE = {
  ouvert: true,
  plages: [
    { debut: '09:00', fin: '12:00' },
    { debut: '13:30', fin: '18:30' },
  ],
};
const FERME = { ouvert: false, plages: [] };

const SETTINGS: EngineSettings = {
  buffer_minutes: 30,
  anticipation_min_heures: 2,
  anticipation_max_jours: 60,
  pas_creneau_minutes: 30,
  heure_coupure_periode: '13:00',
  fermetures_exceptionnelles: [],
  jours_ouverture: { '0': FERME, '1': SEMAINE, '2': SEMAINE, '3': SEMAINE, '4': SEMAINE, '5': SEMAINE, '6': FERME },
};

// Jeudi 1er octobre 2026, 09:00 à Zurich : tout le reste est dans le futur.
const NOW = zurichNow(new Date('2026-10-01T07:00:00Z'));

const LUNDI = '2026-10-05';
const MARDI = '2026-10-06';

let seq = 0;
function rdv(p: Partial<EngineBooking> & { date_rdv: string; heure_rdv: string }): EngineBooking {
  seq += 1;
  return {
    id: `id-${String(seq).padStart(3, '0')}`,
    created_at: `2026-10-01T08:${String(seq).padStart(2, '0')}:00Z`,
    service_duree_minutes: 60,
    statut: 'confirme',
    horaire_fixe: true,
    prenom: 'Test',
    nom: `N${seq}`,
    ...p,
  };
}
function souple(date: string, periode: 'matin' | 'apres_midi', extra: Partial<EngineBooking> = {}): EngineBooking {
  return rdv({
    date_rdv: date,
    heure_rdv: periode === 'matin' ? '09:00' : '13:30',
    periode,
    statut: 'en_attente',
    horaire_fixe: false,
    ...extra,
  });
}
function bloc(p: Partial<BookingBlock> & { date_debut: string; date_fin: string }): BookingBlock {
  return { id: `blk-${++seq}`, heure_debut: null, heure_fin: null, motif: null, created_at: '2026-10-01T00:00:00Z', ...p };
}

function day(date: string, opts: { duration?: number; bookings?: EngineBooking[]; blocks?: BookingBlock[]; now?: typeof NOW; settings?: EngineSettings; excludeId?: string; mode?: 'public' | 'admin'; externalBusy?: { start: number; end: number }[] } = {}) {
  return computeDay({
    date,
    duration: opts.duration ?? 60,
    settings: opts.settings ?? SETTINGS,
    blocks: opts.blocks ?? [],
    bookings: opts.bookings ?? [],
    now: opts.now ?? NOW,
    excludeId: opts.excludeId,
    mode: opts.mode,
    externalBusy: opts.externalBusy,
  });
}
const heuresLibres = (r: ReturnType<typeof day>) => r.slots.filter((s) => s.disponible).map((s) => s.heure);

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}`);
    console.log(`      ${(err as Error).message.split('\n').join('\n      ')}`);
  }
}
function section(title: string) {
  console.log(`\n${title}`);
}

// ─────────────────────────────────────────────────────────────────────────────
section('Calendrier de référence');
test('2026-10-05 est un lundi, 2026-10-04 un dimanche', () => {
  assert.equal(dayOfWeek(LUNDI), 1);
  assert.equal(dayOfWeek('2026-10-04'), 0);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

section('Fuseau Europe/Zurich');
test('minuit Zurich en été = 22:00 UTC la veille ; en hiver = 23:00 UTC', () => {
  assert.equal(zurichInstant('2026-07-15', 0).toISOString(), '2026-07-14T22:00:00.000Z');
  assert.equal(zurichInstant('2026-01-15', 0).toISOString(), '2026-01-14T23:00:00.000Z');
});
test('jour de bascule heure d\'été (29 mars 2026) : minuit encore en heure d\'hiver', () => {
  assert.equal(zurichInstant('2026-03-29', 0).toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(zurichInstant('2026-03-29', 12 * 60).toISOString(), '2026-03-29T10:00:00.000Z');
});
test('22:30 UTC le 14 juillet = 00:30 le 15 à Zurich', () => {
  const z = zurichNow(new Date('2026-07-14T22:30:00Z'));
  assert.equal(z.date, '2026-07-15');
  assert.equal(z.minutes, 30);
  assert.equal(zurichToday(new Date('2026-07-14T22:30:00Z')), '2026-07-15');
});
test('busyFromInstants convertit en minutes Zurich et coupe à minuit', () => {
  assert.deepEqual(busyFromInstants('2026-07-15', [{ start: '2026-07-15T07:00:00Z', end: '2026-07-15T08:00:00Z' }]), [{ start: 540, end: 600 }]);
  // 23:00 → 01:00 Zurich (21:00Z → 23:00Z) : la veille garde [1380, 1440], le lendemain [0, 60]
  const ev = [{ start: '2026-07-14T21:00:00Z', end: '2026-07-14T23:00:00Z' }];
  assert.deepEqual(busyFromInstants('2026-07-14', ev), [{ start: 1380, end: 1440 }]);
  assert.deepEqual(busyFromInstants('2026-07-15', ev), [{ start: 0, end: 60 }]);
  assert.deepEqual(busyFromInstants('2026-07-16', ev), []);
});

section('Jours fermés');
test('dimanche : fermé', () => {
  const r = day('2026-10-04');
  assert.equal(r.ouvert, false);
  assert.equal(r.periodes.matin.disponible, false);
  assert.equal(r.slots.length, 0);
});
test('samedi : fermé (horaires par défaut de la migration)', () => {
  assert.equal(day('2026-10-03', { now: zurichNow(new Date('2026-09-20T07:00:00Z')) }).ouvert, false);
});
test('lundi : ouvert, matin et après-midi disponibles', () => {
  const r = day(LUNDI);
  assert.equal(r.ouvert, true);
  assert.equal(r.periodes.matin.disponible, true);
  assert.equal(r.periodes.matin.premier_creneau, '09:00');
  assert.equal(r.periodes.apres_midi.disponible, true);
  assert.equal(r.periodes.apres_midi.premier_creneau, '13:30');
});
test('fermeture exceptionnelle héritée (fermetures_exceptionnelles)', () => {
  const r = day(LUNDI, { settings: { ...SETTINGS, fermetures_exceptionnelles: [LUNDI] } });
  assert.equal(r.ouvert, false);
});

section('Blocages');
test('journée entière bloquée', () => {
  const r = day(LUNDI, { blocks: [bloc({ date_debut: LUNDI, date_fin: LUNDI, motif: 'Formation' })] });
  assert.equal(r.ouvert, false);
  // Le motif d'un blocage ne fuit jamais côté public ; l'admin le voit.
  assert.equal(r.motif, 'Indisponible ce jour.');
  assert.equal(r.periodes.matin.motif, 'Indisponible ce jour.');
  assert.ok(!JSON.stringify(r).includes('Formation'));
  assert.equal(day(LUNDI, { mode: 'admin', blocks: [bloc({ date_debut: LUNDI, date_fin: LUNDI, motif: 'Formation' })] }).motif, 'Formation');
});
test('plusieurs jours (vacances) : tous bloqués, le lendemain de la plage est ouvert', () => {
  const blocks = [bloc({ date_debut: '2026-10-05', date_fin: '2026-10-07' })];
  assert.equal(day('2026-10-05', { blocks }).ouvert, false);
  assert.equal(day('2026-10-06', { blocks }).ouvert, false);
  assert.equal(day('2026-10-07', { blocks }).ouvert, false);
  assert.equal(day('2026-10-08', { blocks }).ouvert, true);
});
test('plage horaire 10:00–11:00 : un soin de 60 min tient avant et après, jamais à cheval', () => {
  const blocks = [bloc({ date_debut: LUNDI, date_fin: LUNDI, heure_debut: '10:00', heure_fin: '11:00' })];
  const libres = heuresLibres(day(LUNDI, { blocks }));
  assert.ok(libres.includes('09:00'), '09:00 (finit pile à 10:00, sans buffer devant un blocage)');
  assert.ok(!libres.includes('09:30'));
  assert.ok(!libres.includes('10:00'));
  assert.ok(!libres.includes('10:30'));
  assert.ok(libres.includes('11:00'));
});
test('plage horaire couvrant tout le matin : matin indisponible, après-midi libre', () => {
  const blocks = [bloc({ date_debut: LUNDI, date_fin: LUNDI, heure_debut: '09:00', heure_fin: '12:00' })];
  const r = day(LUNDI, { blocks });
  assert.equal(r.periodes.matin.disponible, false);
  assert.equal(r.periodes.apres_midi.disponible, true);
});

section('Buffer');
test('un rdv fixe 10:00–11:00 bloque jusqu\'à 11:30 : soin de 60 min impossible le matin', () => {
  const r = day(LUNDI, { bookings: [rdv({ date_rdv: LUNDI, heure_rdv: '10:00' })] });
  assert.equal(r.periodes.matin.disponible, false);
  assert.equal(r.periodes.apres_midi.disponible, true);
});
test('soin de 30 min à 09:00 : finit à 09:30, buffer 30 min => pile avant le rdv de 10:00', () => {
  const r = day(LUNDI, { duration: 30, bookings: [rdv({ date_rdv: LUNDI, heure_rdv: '10:00' })] });
  const libres = heuresLibres(r);
  assert.ok(libres.includes('09:00'));
  assert.ok(!libres.includes('09:30'));
});
test('pas de buffer exigé en fin de plage d\'ouverture : 180 min tiennent dans 09:00–12:00', () => {
  const r = day(LUNDI, { duration: 180 });
  assert.deepEqual(heuresLibres(r).filter((h) => h < '13:00'), ['09:00']);
});
test('un rdv terminé bloque, un rdv annulé ou refusé non', () => {
  const termine = rdv({ date_rdv: LUNDI, heure_rdv: '14:00', statut: 'termine' });
  const annule = rdv({ date_rdv: MARDI, heure_rdv: '14:00', statut: 'annule' });
  assert.ok(!heuresLibres(day(LUNDI, { bookings: [termine] })).includes('14:00'));
  assert.ok(heuresLibres(day(MARDI, { bookings: [annule] })).includes('14:00'));
});
test('occupation externe (Google Agenda) + buffer', () => {
  const r = day(LUNDI, { duration: 60, externalBusy: [{ start: 14 * 60, end: 15 * 60 }] });
  const libres = heuresLibres(r);
  assert.ok(!libres.includes('13:30')); // 13:30 + 60 + 30 > 14:00
  assert.ok(!libres.includes('14:30'));
  assert.ok(libres.includes('15:30'));
});

section('Demandes souples (matin / après-midi)');
test('2 demandes le même matin ne se bloquent pas : la 2e passe, la 3e échoue', () => {
  const s1 = souple(LUNDI, 'matin');
  const s2 = souple(LUNDI, 'matin');
  const s3 = souple(LUNDI, 'matin');

  const apres0 = day(LUNDI, { bookings: [] });
  assert.equal(apres0.periodes.matin.disponible, true);

  const apres1 = day(LUNDI, { bookings: [s1] });
  assert.equal(apres1.periodes.matin.disponible, true, 'la 2e cliente doit pouvoir demander');
  assert.equal(apres1.periodes.matin.premier_creneau, '10:30', 'placée après la 1re + buffer');

  const apres2 = day(LUNDI, { bookings: [s1, s2] });
  assert.equal(apres2.periodes.matin.disponible, false, 'la 3e est refusée : plus de place');
  assert.equal(apres2.periodes.apres_midi.disponible, true);
  assert.deepEqual(apres2.surcapacite, []);

  // Re-vérification après INSERT concurrent : la 3e demande est « en surcapacité »
  const verif = day(LUNDI, { bookings: [s1, s2, s3] });
  assert.deepEqual(verif.surcapacite, [s3.id]);
  assert.equal(verif.placements.length, 2);
});
test('le placement suit (created_at, id), pas l\'ordre du tableau', () => {
  const a = souple(LUNDI, 'matin', { id: 'zzz', created_at: '2026-10-01T08:00:00Z' });
  const b = souple(LUNDI, 'matin', { id: 'aaa', created_at: '2026-10-01T08:00:01Z' });
  const c = souple(LUNDI, 'matin', { id: 'bbb', created_at: '2026-10-01T08:00:01Z' });
  const r1 = day(LUNDI, { bookings: [c, b, a] });
  assert.deepEqual(r1.placements.map((p) => p.booking_id), ['zzz', 'aaa']);
  assert.deepEqual(r1.surcapacite, ['bbb']);
});
test('une demande du matin ne mange pas l\'après-midi', () => {
  const r = day(LUNDI, { bookings: [souple(LUNDI, 'matin'), souple(LUNDI, 'matin')] });
  assert.equal(r.periodes.apres_midi.premier_creneau, '13:30');
});
test('une demande souple en attente est placée AUTOUR d\'un rdv fixe, pas par-dessus', () => {
  const fixe = rdv({ date_rdv: LUNDI, heure_rdv: '09:00' }); // 09:00–10:00 + 30
  const s = souple(LUNDI, 'matin');
  const r = day(LUNDI, { bookings: [fixe, s] });
  assert.equal(r.placements[0].heure, '10:30');
  assert.equal(r.periodes.matin.disponible, false, 'plus de place après le fixe et la souple');
});
test('mode admin : les demandes souples ne bloquent pas les créneaux exacts', () => {
  const s = souple(LUNDI, 'matin');
  const pub = day(LUNDI, { bookings: [s] });
  const adm = day(LUNDI, { bookings: [s], mode: 'admin' });
  assert.ok(!heuresLibres(pub).includes('09:00'));
  assert.ok(heuresLibres(adm).includes('09:00'));
});
test('une demande souple annulée libère la place', () => {
  const s = souple(LUNDI, 'matin', { statut: 'annule' });
  assert.equal(day(LUNDI, { bookings: [s, souple(LUNDI, 'matin')] }).periodes.matin.premier_creneau, '10:30');
});

section('Conflits d\'un rdv à horaire fixe');
const base = { settings: SETTINGS, blocks: [] as BookingBlock[] };
test('rdv fixe sur un créneau libre : aucun conflit', () => {
  assert.deepEqual(findFixedConflicts({ ...base, date: LUNDI, heure: '14:00', duration: 60, bookings: [], now: NOW }), []);
});
test('chevauchement avec un autre rdv fixe', () => {
  const autre = rdv({ date_rdv: LUNDI, heure_rdv: '14:00' });
  const c = findFixedConflicts({ ...base, date: LUNDI, heure: '14:30', duration: 60, bookings: [autre], now: NOW });
  assert.equal(c.length, 1);
  assert.equal(c[0].type, 'rdv');
  assert.equal(c[0].booking_id, autre.id);
});
test('collé au rdv précédent sans buffer = conflit ; avec 30 min = libre', () => {
  const autre = rdv({ date_rdv: LUNDI, heure_rdv: '14:00' }); // finit 15:00
  assert.equal(findFixedConflicts({ ...base, date: LUNDI, heure: '15:00', duration: 60, bookings: [autre], now: NOW }).length, 1);
  assert.equal(findFixedConflicts({ ...base, date: LUNDI, heure: '15:30', duration: 60, bookings: [autre], now: NOW }).length, 0);
});
test('hors horaires : pause de midi, dimanche', () => {
  const midi = findFixedConflicts({ ...base, date: LUNDI, heure: '12:30', duration: 60, bookings: [], now: NOW });
  assert.equal(midi[0].type, 'hors_horaires');
  const dim = findFixedConflicts({ ...base, date: '2026-10-04', heure: '10:00', duration: 60, bookings: [], now: NOW });
  assert.equal(dim[0].type, 'hors_horaires');
  assert.match(dim[0].libelle, /dimanche/);
});
test('blocage : journée et plage horaire', () => {
  const jour = bloc({ date_debut: LUNDI, date_fin: LUNDI, motif: 'Congé' });
  const plage = bloc({ date_debut: MARDI, date_fin: MARDI, heure_debut: '10:00', heure_fin: '11:00' });
  const c1 = findFixedConflicts({ ...base, blocks: [jour], date: LUNDI, heure: '14:00', duration: 60, bookings: [], now: NOW });
  assert.equal(c1.some((c) => c.type === 'blocage' && c.block_id === jour.id), true);
  const c2 = findFixedConflicts({ ...base, blocks: [plage], date: MARDI, heure: '10:30', duration: 60, bookings: [], now: NOW });
  assert.equal(c2.some((c) => c.type === 'blocage' && c.block_id === plage.id), true);
  const c3 = findFixedConflicts({ ...base, blocks: [plage], date: MARDI, heure: '09:00', duration: 60, bookings: [], now: NOW });
  assert.deepEqual(c3, [], 'finit pile au début du blocage : pas de buffer exigé');
});
test('rdv fixe vs souple : poser un fixe qui prive une demande de sa place est signalé', () => {
  const s1 = souple(LUNDI, 'matin');
  const s2 = souple(LUNDI, 'matin');
  // 2 demandes placées à 09:00 et 10:30. Un fixe à 10:30 laisse une seule place.
  const c = findFixedConflicts({ ...base, date: LUNDI, heure: '10:30', duration: 60, bookings: [s1, s2], now: NOW });
  assert.equal(c.length, 1);
  assert.equal(c[0].booking_id, s2.id);
  // Un fixe l'après-midi ne gêne personne
  assert.deepEqual(findFixedConflicts({ ...base, date: LUNDI, heure: '14:00', duration: 60, bookings: [s1, s2], now: NOW }), []);
});
test('rdv fixe vs souple : une seule demande souple se déplace sans conflit', () => {
  const s1 = souple(LUNDI, 'matin');
  assert.deepEqual(findFixedConflicts({ ...base, date: LUNDI, heure: '09:00', duration: 60, bookings: [s1], now: NOW }), []);
});
test('déplacement avec excludeId : le rdv ne rentre pas en conflit avec lui-même', () => {
  const x = rdv({ date_rdv: LUNDI, heure_rdv: '10:00' });
  const sans = findFixedConflicts({ ...base, date: LUNDI, heure: '10:30', duration: 60, bookings: [x], now: NOW });
  assert.equal(sans.length, 1);
  const avec = findFixedConflicts({ ...base, date: LUNDI, heure: '10:30', duration: 60, bookings: [x], excludeId: x.id, now: NOW });
  assert.deepEqual(avec, []);
  // et la grille admin propose bien l'ancien créneau quand on ignore le rdv déplacé
  assert.ok(!heuresLibres(day(LUNDI, { bookings: [x], mode: 'admin' })).includes('10:00'));
  assert.ok(heuresLibres(day(LUNDI, { bookings: [x], mode: 'admin', excludeId: x.id })).includes('10:00'));
});

section('Anticipation et bornes (Zurich)');
test('aujourd\'hui à 08:30 Zurich avec 2 h de délai : rien avant 10:30', () => {
  // 06:30 UTC = 08:30 à Zurich (heure d'été). Un calcul en UTC autoriserait 09:00.
  const now = zurichNow(new Date('2026-07-15T06:30:00Z'));
  assert.deepEqual(now, { date: '2026-07-15', minutes: 8 * 60 + 30 });
  const r = day('2026-07-15', { now });
  const libres = heuresLibres(r);
  assert.ok(!libres.includes('09:00'));
  assert.ok(!libres.includes('10:00'));
  assert.ok(libres.includes('10:30'));
  assert.equal(r.slots.find((s) => s.heure === '09:00')?.motif, "Délai d'anticipation dépassé");
});
test('minuit UTC vs Zurich : à 22:30 UTC le 14 juillet, on est déjà le 15 — le 14 est passé', () => {
  const now = zurichNow(new Date('2026-07-14T22:30:00Z'));
  assert.equal(now.date, '2026-07-15');
  const hier = day('2026-07-14', { now });
  assert.equal(hier.ouvert, false);
  assert.match(hier.motif ?? '', /passée/);
  assert.equal(day('2026-07-15', { now }).periodes.matin.disponible, true);
});
test('anticipation de 48 h : lundi 10:00 => rien le mardi, mercredi à partir de 10:00', () => {
  const now = zurichNow(new Date('2026-10-05T08:00:00Z')); // lundi 10:00 Zurich
  assert.deepEqual(now, { date: LUNDI, minutes: 600 });
  const settings = { ...SETTINGS, anticipation_min_heures: 48 };
  assert.deepEqual(heuresLibres(day(MARDI, { now, settings })), []);
  const mercredi = heuresLibres(day('2026-10-07', { now, settings }));
  assert.ok(!mercredi.includes('09:30'));
  assert.ok(mercredi.includes('10:00'));
});
test('au-delà de anticipation_max_jours : fermé', () => {
  const now = zurichNow(new Date('2026-10-01T07:00:00Z'));
  assert.equal(dateBoundsError(addDays(now.date, 60), SETTINGS, now), null);
  assert.notEqual(dateBoundsError(addDays(now.date, 61), SETTINGS, now), null);
  assert.equal(day(addDays(now.date, 61), { now }).ouvert, false);
});
test('le mode admin ignore les bornes (saisie d\'un rdv passé ou lointain)', () => {
  const r = day('2026-09-28', { mode: 'admin' });
  assert.equal(r.ouvert, true);
});

section('Calendrier public');
test('computeRange : dimanche grisé, lundi libre, matin complet signalé', () => {
  const cal = computeRange('2026-10-04', '2026-10-06', {
    duration: 60,
    settings: SETTINGS,
    blocks: [],
    bookings: [souple(MARDI, 'matin'), souple(MARDI, 'matin')],
    now: NOW,
  });
  assert.deepEqual(cal.jours['2026-10-04'], { matin: false, apres_midi: false });
  assert.deepEqual(cal.jours[LUNDI], { matin: true, apres_midi: true });
  assert.deepEqual(cal.jours[MARDI], { matin: false, apres_midi: true });
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
