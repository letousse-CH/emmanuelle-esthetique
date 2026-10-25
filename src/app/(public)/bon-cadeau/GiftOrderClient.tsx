"use client";

/**
 * Offrir un bon cadeau — le parcours (styles `gco-*`, carte `gv-*`).
 *
 * Quatre écrans, un geste par écran : 1. ce que l'on offre (un montant ou des
 * soins), 2. le montant ou les soins, 3. pour qui (nom, petit mot), 4. qui
 * commande. Le bon se compose sous les yeux de l'acheteuse, tel qu'il sera
 * imprimé ; à l'envoi, place au paiement TWINT.
 *
 * Chaque écran est une entrée de l'historique : le bouton « retour » du
 * navigateur ramène à l'écran précédent, pas à la page d'avant. Liens directs :
 * `?famille=corps`, `?soin=<id ou nom>`, `?montant=150`, `?type=montant|soins`.
 *
 * Les règles sont celles du serveur (`validateGiftOrder`), qui recalcule tout.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Loader2, Minus, Plus, Sparkles } from 'lucide-react';
import {
  GIFT_FAMILY_ORDER, GIFT_MAX, GIFT_MESSAGE_MAX, GIFT_PRESETS, GIFT_QTE_MAX,
  giftLineLabel, parseMontant, validateGiftOrder,
  type GiftCatalogItem, type GiftFamily, type GiftOrderField, type GiftOrderPublicView, type GiftOrderType,
} from '../../../types/giftOrders';
import { optimizedImgProps } from '../../../utils/imageOptim';
import VoucherCard from '../../../components/gift/VoucherCard';
import { GIFT_VISUALS, familyTitle, familyVisual, type Visual } from '../../../components/gift/visuals';

interface Props {
  open: boolean;
  catalogue: GiftCatalogItem[];
  montantMin: number;
  validiteMois: number;
  mentions: string;
  businessName: string;
  ownerFirstName: string;
  phone: string;
  logoLight: string;
  place: string;
}

type Errors = Partial<Record<GiftOrderField, string>>;
type Step = 'choix' | 'montant' | 'soins' | 'pour' | 'coord';

const STEP_FIELDS: Record<Step, GiftOrderField[]> = {
  choix: ['type'],
  montant: ['montant'],
  soins: ['soins'],
  pour: ['beneficiaire', 'message'],
  coord: ['acheteur_prenom', 'acheteur_nom', 'acheteur_email', 'acheteur_telephone'],
};
const STEP_INDEX: Record<Step, number> = { choix: 0, montant: 1, soins: 1, pour: 2, coord: 3 };

const MOTS = [
  'Joyeux anniversaire !',
  'Prends du temps pour toi, tu le mérites.',
  'Merci pour tout.',
  'Joyeux Noël et belle année !',
  'Avec toute mon affection.',
];

function chf(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `CHF ${new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v)}`;
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

type LenisLike = { scrollTo: (target: HTMLElement, opts?: { offset?: number }) => void };

/**
 * Amène un élément sous le menu fixe. Passe par Lenis (défilement lissé du
 * site, `MotionLayer`) quand il tourne : il reprendrait sinon la main sur un
 * défilement natif lancé pendant son inertie.
 */
function scrollToEl(el: HTMLElement | null, gap = 16) {
  if (!el) return;
  const nav = document.querySelector<HTMLElement>('nav.fixed');
  const offset = Math.round((nav?.getBoundingClientRect().height ?? 96) + gap);
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset: -offset });
    return;
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: reduce ? 'auto' : 'smooth' });
}

function Photo({ v, sizes, className = '', priority }: { v: Visual; sizes: string; className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...optimizedImgProps(v.url, sizes)}
      alt={v.alt}
      className={className}
      style={v.focus ? { objectPosition: v.focus } : undefined}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
    />
  );
}

export default function GiftOrderClient(props: Props) {
  const { open, catalogue, montantMin, validiteMois, mentions, ownerFirstName, phone } = props;
  const owner = ownerFirstName || 'L’institut';

  const [step, setStep] = useState<Step>('choix');
  const [type, setType] = useState<GiftOrderType>('montant');
  const [preset, setPreset] = useState<number | null>(GIFT_PRESETS.find((p) => p >= montantMin) ?? null);
  const [autre, setAutre] = useState('');
  const [qtes, setQtes] = useState<Record<string, number>>({});
  const [beneficiaire, setBeneficiaire] = useState('');
  const [message, setMessage] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [piege, setPiege] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<GiftOrderPublicView | null>(null);
  const [famille, setFamille] = useState<GiftFamily | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Vrai quand l'écran change à la suite d'un geste : on remonte alors en haut du parcours. */
  const moved = useRef(false);

  const catalogueMap = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);
  const presets = useMemo(() => {
    const list = [...GIFT_PRESETS, 500].filter((p, i, a) => p >= montantMin && a.indexOf(p) === i);
    return list.length ? list : [montantMin];
  }, [montantMin]);

  const families = useMemo(
    () => GIFT_FAMILY_ORDER
      .map((f) => ({ id: f, ...familyTitle(f), visual: familyVisual(f), items: catalogue.filter((c) => c.famille === f) }))
      .filter((f) => f.items.length > 0),
    [catalogue],
  );

  const lignes = useMemo(
    () => Object.entries(qtes)
      .filter(([id, q]) => q > 0 && catalogueMap.has(id))
      .map(([id, quantite]) => {
        const c = catalogueMap.get(id)!;
        return { service_id: id, nom: c.nom, prix_chf: c.prix, quantite };
      }),
    [qtes, catalogueMap],
  );

  const montantLibre = autre.trim() ? parseMontant(autre) : preset;
  const total = type === 'montant'
    ? montantLibre ?? 0
    : Math.round(lignes.reduce((a, l) => a + l.prix_chf * l.quantite, 0) * 100) / 100;
  const offer = type === 'soins' ? lignes.map(giftLineLabel).join(' + ') : '';
  const nbSoins = lignes.reduce((a, l) => a + l.quantite, 0);

  const payload = useCallback(() => ({
    type,
    montant: type === 'montant' ? montantLibre : undefined,
    soins: type === 'soins' ? lignes.map((l) => ({ id: l.service_id, quantite: l.quantite })) : undefined,
    beneficiaire,
    message,
    acheteur_prenom: prenom,
    acheteur_nom: nom,
    acheteur_email: email,
    acheteur_telephone: telephone,
    champ_piege: piege,
  }), [type, montantLibre, lignes, beneficiaire, message, prenom, nom, email, telephone, piege]);

  // ── Navigation entre écrans (historique du navigateur) ────────────────────

  const show = useCallback((next: Step, push = true) => {
    moved.current = true;
    setStep(next);
    setFormError(null);
    if (push && typeof window !== 'undefined') {
      window.history.pushState({ gco: next }, '', window.location.href);
    }
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state ?? {}), gco: 'choix' }, '', window.location.href);
    const onPop = (e: PopStateEvent) => {
      const s = (e.state?.gco ?? 'choix') as Step;
      if (s in STEP_INDEX) { moved.current = true; setStep(s); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Hauteur réelle du menu fixe (elle change au défilement) : les éléments
  // collants du parcours se rangent juste dessous.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav.fixed');
    const root = rootRef.current;
    if (!nav || !root || typeof ResizeObserver === 'undefined') return;
    const sync = () => root.style.setProperty('--gco-top', `${Math.round(nav.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [done]);

  // Liens directs depuis le site : un univers, un soin, un montant.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const soin = q.get('soin');
    const fam = q.get('famille') as GiftFamily | null;
    const montant = parseMontant(q.get('montant'));
    if (soin) {
      const hit = catalogueMap.get(soin) ?? catalogue.find((c) => norm(c.nom) === norm(soin))
        ?? catalogue.find((c) => norm(c.nom).includes(norm(soin)) || norm(soin).includes(norm(c.nom)));
      if (hit) {
        setType('soins');
        setQtes({ [hit.id]: 1 });
        setFamille(hit.famille);
        show('soins');
        return;
      }
    }
    if (fam && GIFT_FAMILY_ORDER.includes(fam)) {
      setType('soins');
      setFamille(fam);
      show('soins');
      return;
    }
    if (montant && montant >= montantMin) {
      setType('montant');
      setAutre(GIFT_PRESETS.includes(montant) ? '' : String(montant));
      setPreset(GIFT_PRESETS.includes(montant) ? montant : null);
      show('montant');
      return;
    }
    const t = q.get('type');
    if (t === 'montant' || (t === 'soins' && catalogue.length)) {
      setType(t);
      show(t);
    }
    // Lu une fois, au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // À chaque écran : en haut du parcours, le titre reçoit le focus.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    scrollToEl(rootRef.current, 8);
    headingRef.current?.focus({ preventScroll: true });
  }, [step, done]);

  // Univers demandé : on y descend une fois l'écran des soins affiché.
  useEffect(() => {
    if (step !== 'soins' || !famille) return;
    const t = window.setTimeout(() => {
      scrollToEl(document.getElementById(`gco-fam-${famille}`), 84);
    }, 450);
    return () => window.clearTimeout(t);
  }, [step, famille]);

  const clearError = (f: GiftOrderField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const setQte = (id: string, q: number) => {
    setQtes((prev) => ({ ...prev, [id]: Math.max(0, Math.min(GIFT_QTE_MAX, q)) }));
    clearError('soins');
  };

  /** Erreurs de l'écran courant seulement. */
  const stepErrors = (s: Step): Errors => {
    const check = validateGiftOrder(payload(), { montantMin, catalogue: catalogueMap });
    if (check.ok) return {};
    return Object.fromEntries(
      Object.entries(check.errors).filter(([k]) => STEP_FIELDS[s].includes(k as GiftOrderField)),
    ) as Errors;
  };

  const next = () => {
    const errs = stepErrors(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const first = Object.keys(errs)[0];
      const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
      scrollToEl(el, 120);
      el?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
      return;
    }
    setErrors({});
    if (step === 'montant' || step === 'soins') show('pour');
    else if (step === 'pour') show('coord');
    else if (step === 'coord') submit();
  };

  const back = () => window.history.back();

  const choose = (t: GiftOrderType) => {
    setType(t);
    clearError('type');
    show(t === 'montant' ? 'montant' : 'soins');
  };

  const submit = async () => {
    setFormError(null);
    const check = validateGiftOrder(payload(), { montantMin, catalogue: catalogueMap });
    if (!check.ok) {
      setErrors(check.errors);
      // Une erreur d'un écran précédent (rare : soin retiré de la carte entre-temps) y ramène.
      const first = Object.keys(check.errors)[0] as GiftOrderField;
      const where = (Object.keys(STEP_FIELDS) as Step[]).find((s) => STEP_FIELDS[s].includes(first));
      if (where && where !== 'coord') show(where === 'choix' ? 'choix' : where);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bons-cadeaux/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.order) {
        if (json.fields) setErrors(json.fields);
        setFormError(json.error || 'Votre commande n’a pas pu être envoyée. Merci de réessayer.');
        return;
      }
      moved.current = true;
      setDone(json.order as GiftOrderPublicView);
      // L'écran de paiement remplace le parcours : « retour » ne doit pas y ramener.
      window.history.replaceState({ gco: 'coord' }, '', window.location.href);
    } catch {
      setFormError('Pas de connexion. Vérifiez votre réseau et réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const voucher = (cls = '', sizes = '(min-width: 1024px) 180px, 34vw', montant = total) => (
    <VoucherCard
      businessName={props.businessName}
      logoLight={props.logoLight}
      place={props.place}
      beneficiaire={beneficiaire}
      offer={offer}
      montant={montant}
      message={message.slice(0, GIFT_MESSAGE_MAX)}
      validiteMois={validiteMois}
      className={cls}
      sizes={sizes}
    />
  );

  // ── Vente en ligne fermée ────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="gco" id="composer">
        <div className="gco-container gco-closed">
          <h2 className="gco-h2">Commande par message</h2>
          <div className="gco-lead">
            La commande en ligne n’est pas encore ouverte. Écrivez à {owner} en indiquant le montant ou le soin
            souhaité et le nom de la personne qui recevra le bon : il vous est envoyé dans les 24 heures.
          </div>
          <div className="gco-actions">
            <Link href="/contact" data-btn="primary">Écrire un message <ArrowRight /></Link>
            {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`} data-btn="secondary">{phone}</a>}
          </div>
        </div>
      </div>
    );
  }

  // ── Commande enregistrée : place au paiement ──────────────────────────────
  if (done) {
    return (
      <div className="gco gco--pay" ref={rootRef} id="composer">
        <div className="gco-pay__bg" aria-hidden="true">
          <Photo v={GIFT_VISUALS.marin} sizes="100vw" />
        </div>
        <div className="gco-container gco-pay">
          <div className="gco-pay__main gco-screen">
            <div className="gco-eyebrow gco-eyebrow--light">Commande {done.reference} enregistrée</div>
            <h2 ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Plus qu’une étape : le paiement TWINT</h2>
            <div className="gco-pay__amount">{chf(done.montant)}</div>
            <div className="gco-pay__lead">
              {done.libelle} pour {done.beneficiaire}. Payez ce montant exact par TWINT : dès réception du paiement,
              {' '}{owner} vous envoie le bon en PDF à <strong>{done.acheteur_email}</strong>.
            </div>

            {/* Bouton officiel TWINT (version claire, pour le fond marin). Le
                lien porte déjà le montant et la référence (`twintPayUrl`). */}
            {done.twintLien && (
              <a href={done.twintLien} className="gco-pay__twint" target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/twint-payer-fr.svg" alt={`Payer ${chf(done.montant)} avec TWINT`} width={248} height={58} />
              </a>
            )}

            <ol className="gco-paysteps">
              <li><span>1</span><div>Touchez « Payer avec TWINT » : l’app s’ouvre avec le montant et la référence déjà remplis. Sur ordinateur, scannez le code qui s’affiche avec l’app TWINT.</div></li>
              <li><span>2</span><div>Vérifiez le montant, <strong>{chf(done.montant)}</strong>, et confirmez le paiement.</div></li>
              <li><span>3</span><div>Le bon arrive par e-mail, en PDF, dès que le paiement est vu — en général le jour même.</div></li>
            </ol>

            <div className="gco-pay__note">
              Ce bouton vous a aussi été envoyé par e-mail. Vous avez changé d’avis ? Ne payez pas, la commande sera
              simplement annulée.
            </div>
          </div>

          <aside className="gco-pay__side gco-screen">
            {voucher('gv--pay', '200px', done.montant)}
            <Link href="/" className="gco-link gco-link--light">Retour au site <ArrowRight /></Link>
          </aside>
        </div>
      </div>
    );
  }

  // ── Parcours ─────────────────────────────────────────────────────────────
  const idx = STEP_INDEX[step];
  const progress = [
    'Votre cadeau',
    type === 'soins' ? 'Les soins' : 'Le montant',
    'Pour qui',
    'Vos coordonnées',
  ];
  const canGoTo = (i: number) => i < idx;
  const goTo = (i: number) => {
    if (!canGoTo(i)) return;
    // Revenir en arrière dans l'historique garde « retour » cohérent.
    window.history.go(i - idx);
  };

  return (
    <div className="gco" ref={rootRef} id="composer">
      <div className="gco-container">
        <nav className="gco-progress" aria-label="Étapes de la commande">
          <ol>
            {progress.map((label, i) => (
              <li key={label} className={i === idx ? 'is-current' : i < idx ? 'is-done' : ''}>
                <button type="button" onClick={() => goTo(i)} disabled={!canGoTo(i)} aria-current={i === idx ? 'step' : undefined}>
                  <span className="gco-progress__dot">{i < idx ? <Check /> : i + 1}</span>
                  <span className="gco-progress__label">{label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="gco-progress__bar" aria-hidden="true"><span style={{ width: `${(idx / 3) * 100}%` }} /></div>
        </nav>

        <div key={step} className="gco-screen">
          {/* 1. Votre cadeau */}
          {step === 'choix' && (
            <section aria-labelledby="gco-h">
              <div className="gco-head">
                <div className="gco-eyebrow">Étape 1 sur 4</div>
                <h2 id="gco-h" ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Que souhaitez-vous offrir ?</h2>
              </div>
              <div className="gco-choices">
                <button type="button" className="gco-choice" onClick={() => choose('montant')}>
                  <Photo v={GIFT_VISUALS.montant} sizes="(min-width: 900px) 560px, 100vw" className="gco-choice__img" priority />
                  <span className="gco-choice__veil" />
                  <span className="gco-choice__body">
                    <span className="gco-choice__kicker">Dès {chf(montantMin)}</span>
                    <span className="gco-choice__title">Un montant</span>
                    <span className="gco-choice__text">La liberté de choisir son soin, le jour venu. Le bon s’utilise en une ou plusieurs fois.</span>
                    <span className="gco-choice__cta">Choisir un montant <ArrowRight /></span>
                  </span>
                </button>
                <button type="button" className="gco-choice" onClick={() => choose('soins')} disabled={catalogue.length === 0}>
                  <Photo v={GIFT_VISUALS.soins} sizes="(min-width: 900px) 560px, 100vw" className="gco-choice__img" priority />
                  <span className="gco-choice__veil" />
                  <span className="gco-choice__body">
                    <span className="gco-choice__kicker">{catalogue.length} soins à la carte</span>
                    <span className="gco-choice__title">Un soin, ou plusieurs</span>
                    <span className="gco-choice__text">Un soin du visage Phytomer, un massage, un rituel : le bon indique les soins offerts.</span>
                    <span className="gco-choice__cta">Choisir les soins <ArrowRight /></span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* 2a. Le montant */}
          {step === 'montant' && (
            <section aria-labelledby="gco-h">
              <div className="gco-head">
                <div className="gco-eyebrow">Étape 2 sur 4</div>
                <h2 id="gco-h" ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Quel montant ?</h2>
                <div className="gco-lead">La personne qui le reçoit choisit le soin qui lui fait envie, et l’utilise en une ou plusieurs fois.</div>
              </div>
              <div className="gco-split">
              <div className="gco-split__main">
                <div className="gco-bigamount" aria-live="polite">{total > 0 ? chf(total) : 'CHF —'}</div>
                <div className="gco-chips" data-field="montant">
                  {presets.map((p) => (
                    <button
                      key={p} type="button"
                      className={`gco-chip ${!autre.trim() && preset === p ? 'is-on' : ''}`}
                      aria-pressed={!autre.trim() && preset === p}
                      onClick={() => { setPreset(p); setAutre(''); clearError('montant'); }}
                    >
                      {chf(p)}
                    </button>
                  ))}
                </div>
                <div className="gco-field gco-field--narrow">
                  <label htmlFor="gco-autre">Ou un autre montant</label>
                  <div className="gco-money">
                    <span aria-hidden="true">CHF</span>
                    <input
                      id="gco-autre" className="gco-input" inputMode="decimal" autoComplete="off"
                      placeholder={`dès ${montantMin}`} value={autre}
                      aria-invalid={Boolean(errors.montant)}
                      onChange={(e) => { setAutre(e.target.value); clearError('montant'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } }}
                    />
                  </div>
                  {errors.montant
                    ? <div className="gco-field__error">{errors.montant}</div>
                    : <div className="gco-field__hint">De {chf(montantMin)} à {chf(GIFT_MAX)}.</div>}
                </div>
              </div>
              <aside className="gco-split__side">
                <div className="gco-stage">
                  <Photo v={GIFT_VISUALS.montant} sizes="(min-width: 1024px) 440px, 0px" className="gco-stage__img" />
                  {voucher('gv--stage', '180px')}
                </div>
              </aside>
              </div>
            </section>
          )}

          {/* 2b. Les soins */}
          {step === 'soins' && (
            <section aria-labelledby="gco-h">
              <div className="gco-head">
                <div className="gco-eyebrow">Étape 2 sur 4</div>
                <h2 id="gco-h" ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Quels soins offrir ?</h2>
                <div className="gco-lead">Un soin, ou plusieurs pour composer un moment complet. Les prix sont ceux de la carte.</div>
              </div>
              <div className="gco-split">
              <div className="gco-split__main">

                <div className="gco-famnav" role="navigation" aria-label="Univers de soins">
                  {families.map((f) => (
                    <button key={f.id} type="button" className="gco-famnav__item" onClick={() => {
                      scrollToEl(document.getElementById(`gco-fam-${f.id}`), 84);
                    }}>
                      <Photo v={f.visual} sizes="44px" className="gco-famnav__img" />
                      <span>{f.title}</span>
                    </button>
                  ))}
                </div>

                {errors.soins && <div className="gco-notice" role="alert" data-field="soins">{errors.soins}</div>}

                <div className="gco-carte">
                  {families.map((f) => (
                    <div key={f.id} id={`gco-fam-${f.id}`} className="gco-family">
                      <div className="gco-family__banner">
                        <Photo v={f.visual} sizes="(min-width: 1024px) 720px, 100vw" className="gco-family__img" />
                        <div className="gco-family__veil" />
                        <div className="gco-family__text">
                          <h3>{f.title}</h3>
                          {f.tagline && <span>{f.tagline}</span>}
                        </div>
                      </div>
                      <ul className="gco-soins">
                        {f.items.map((c) => {
                          const q = qtes[c.id] ?? 0;
                          return (
                            <li key={c.id} className={`gco-soin ${q > 0 ? 'is-on' : ''}`}>
                              <div className="gco-soin__text">
                                <div className="gco-soin__name">
                                  {c.nom}
                                  {c.complement && <span className="gco-tag">Complément</span>}
                                </div>
                                <div className="gco-soin__meta">
                                  {[c.dureeMinutes ? `${c.dureeMinutes} min` : '', c.description].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                              <div className="gco-soin__side">
                                <div className="gco-soin__price">{chf(c.prix)}</div>
                                {q === 0 ? (
                                  <button type="button" className="gco-add" onClick={() => setQte(c.id, 1)} aria-label={`Offrir ${c.nom}`}>
                                    <Plus /> Offrir
                                  </button>
                                ) : (
                                  <div className="gco-stepper" role="group" aria-label={`Quantité : ${c.nom}`}>
                                    <button type="button" onClick={() => setQte(c.id, q - 1)} aria-label="Un de moins"><Minus /></button>
                                    <span aria-live="polite">{q}</span>
                                    <button type="button" onClick={() => setQte(c.id, q + 1)} disabled={q >= GIFT_QTE_MAX} aria-label="Un de plus"><Plus /></button>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="gco-split__side">
                <div className="gco-basket">
                  {voucher('gv--side', '160px')}
                  <div className="gco-basket__title">Votre sélection</div>
                  {lignes.length === 0 ? (
                    <div className="gco-basket__empty">Touchez « Offrir » à côté d’un soin.</div>
                  ) : (
                    <ul className="gco-basket__list">
                      {lignes.map((l) => (
                        <li key={l.service_id}>
                          <span>{giftLineLabel(l)}</span>
                          <span>{chf(l.prix_chf * l.quantite)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
              </div>
            </section>
          )}

          {/* 3. Pour qui */}
          {step === 'pour' && (
            <section aria-labelledby="gco-h">
              <div className="gco-head">
                <div className="gco-eyebrow">Étape 3 sur 4</div>
                <h2 id="gco-h" ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Pour qui ?</h2>
                <div className="gco-lead">Son nom est imprimé sur le bon. Ajoutez, si vous le souhaitez, quelques mots de votre main.</div>
              </div>
              <div className="gco-split">
              <div className="gco-split__main">
                <div className="gco-field" data-field="beneficiaire">
                  <label htmlFor="gco-benef">Nom de la personne qui reçoit le bon</label>
                  <input
                    id="gco-benef" className="gco-input gco-input--lg" autoComplete="off" maxLength={80}
                    placeholder="Prénom et nom" value={beneficiaire}
                    aria-invalid={Boolean(errors.beneficiaire)}
                    onChange={(e) => { setBeneficiaire(e.target.value); clearError('beneficiaire'); }}
                  />
                  {errors.beneficiaire && <div className="gco-field__error">{errors.beneficiaire}</div>}
                </div>
                <div className="gco-field" data-field="message">
                  <label htmlFor="gco-msg">Votre petit mot <span className="gco-opt">(facultatif)</span></label>
                  <div className="gco-mots" aria-label="Idées de message">
                    {MOTS.map((m) => (
                      <button key={m} type="button" className={`gco-mot ${message === m ? 'is-on' : ''}`} onClick={() => { setMessage(m); clearError('message'); }}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="gco-msg" className="gco-input gco-input--msg" rows={4} maxLength={GIFT_MESSAGE_MAX + 20}
                    placeholder="Écrivez votre message, et signez-le si vous le souhaitez." value={message}
                    aria-invalid={Boolean(errors.message)}
                    onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
                  />
                  <div className={message.length > GIFT_MESSAGE_MAX ? 'gco-field__error' : 'gco-field__hint'}>
                    {errors.message ?? `Imprimé sur le bon · ${Math.max(0, GIFT_MESSAGE_MAX - message.length)} caractères restants`}
                  </div>
                </div>
              </div>
              <aside className="gco-split__side">
                <div className="gco-stage gco-stage--pour">
                  <Photo v={GIFT_VISUALS.pour} sizes="(min-width: 1024px) 440px, 0px" className="gco-stage__img" />
                  {voucher('gv--stage', '180px')}
                </div>
              </aside>
              </div>
            </section>
          )}

          {/* 4. Vos coordonnées */}
          {step === 'coord' && (
            <section aria-labelledby="gco-h">
              <div className="gco-head">
                <div className="gco-eyebrow">Étape 4 sur 4</div>
                <h2 id="gco-h" ref={headingRef} tabIndex={-1} className="gco-h2 gco-h2--xl">Vos coordonnées</h2>
                <div className="gco-lead">Le bon vous est envoyé en PDF à votre adresse e-mail, prêt à imprimer ou à transmettre.</div>
              </div>
              <div className="gco-split">
              <div className="gco-split__main">
                <div className="gco-grid">
                  <Field id="gco-prenom" label="Prénom" field="acheteur_prenom" errors={errors} value={prenom} autoComplete="given-name"
                    onChange={(v) => { setPrenom(v); clearError('acheteur_prenom'); }} />
                  <Field id="gco-nom" label="Nom" field="acheteur_nom" errors={errors} value={nom} autoComplete="family-name"
                    onChange={(v) => { setNom(v); clearError('acheteur_nom'); }} />
                  <Field id="gco-email" label="E-mail" field="acheteur_email" errors={errors} value={email} type="email" autoComplete="email"
                    hint="Pour recevoir le bon." onChange={(v) => { setEmail(v); clearError('acheteur_email'); }} />
                  <Field id="gco-tel" label="Téléphone" optional field="acheteur_telephone" errors={errors} value={telephone} type="tel" autoComplete="tel"
                    hint="Seulement en cas de question." onChange={(v) => { setTelephone(v); clearError('acheteur_telephone'); }} />
                </div>
                <div className="gco-trap" aria-hidden="true">
                  <label htmlFor="gco-piege">Ne pas remplir</label>
                  <input id="gco-piege" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
                </div>
                <ul className="gco-reassure">
                  <li><Check /> Paiement par TWINT, à l’étape suivante : rien n’est débité maintenant.</li>
                  <li><Check /> Le bon vous parvient dès réception du paiement, en général le jour même.</li>
                  <li><Check /> Valable {validiteMois} mois, en une ou plusieurs fois.</li>
                </ul>
                {mentions && <div className="gco-legal">{mentions}</div>}
              </div>
              <aside className="gco-split__side">
                <div className="gco-recap">
                  {voucher('gv--side', '160px')}
                  <div className="gco-recap__rows">
                    <div><span>Pour</span><strong>{beneficiaire.trim()}</strong></div>
                    <div><span>{type === 'soins' ? (nbSoins > 1 ? 'Soins offerts' : 'Soin offert') : 'Bon'}</span><strong>{type === 'soins' ? offer : 'Montant libre'}</strong></div>
                    <div className="gco-recap__total"><span>À payer par TWINT</span><strong>{chf(total)}</strong></div>
                  </div>
                </div>
              </aside>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Barre d'action : collée en bas de l'écran pendant le parcours. */}
      {step !== 'choix' && (
        <div className="gco-bar">
          <div className="gco-container gco-bar__inner">
            <button type="button" className="gco-bar__back" onClick={back}>
              <ArrowLeft /> <span>Retour</span>
            </button>
            <div className="gco-bar__sum" aria-live="polite">
              <span>{type === 'soins' ? `${nbSoins} soin${nbSoins > 1 ? 's' : ''}` : 'Votre bon'}</span>
              <strong>{total > 0 ? chf(total) : '—'}</strong>
            </div>
            <button type="button" data-btn="primary" className="gco-bar__next" onClick={next} disabled={submitting}>
              {submitting ? <Loader2 className="gco-spin" /> : step === 'coord' ? <Sparkles /> : null}
              <span>{submitting ? 'Envoi…' : step === 'coord' ? 'Commander le bon' : 'Continuer'}</span>
              {!submitting && step !== 'coord' && <ArrowRight />}
            </button>
          </div>
          {formError && <div className="gco-container"><div className="gco-notice gco-notice--bar" role="alert">{formError}</div></div>}
        </div>
      )}
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  field: GiftOrderField;
  errors: Errors;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  optional?: boolean;
}) {
  const err = props.errors[props.field];
  return (
    <div className="gco-field" data-field={props.field}>
      <label htmlFor={props.id}>
        {props.label}{props.optional && <span className="gco-opt"> (facultatif)</span>}
      </label>
      <input
        id={props.id} className="gco-input" type={props.type ?? 'text'} autoComplete={props.autoComplete}
        value={props.value} aria-invalid={Boolean(err)} onChange={(e) => props.onChange(e.target.value)}
      />
      {err ? <div className="gco-field__error">{err}</div> : props.hint ? <div className="gco-field__hint">{props.hint}</div> : null}
    </div>
  );
}
