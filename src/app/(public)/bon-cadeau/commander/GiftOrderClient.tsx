"use client";

/**
 * Commande d'un bon cadeau — formulaire public (styles `gco-*`).
 *
 * Trois temps sur une seule page : ce que l'on offre (montant ou soins), pour
 * qui (nom, petit mot), qui commande. Le bon se compose sous les yeux de
 * l'acheteuse ; à l'envoi, l'écran passe au paiement TWINT. Les règles sont
 * celles du serveur (`validateGiftOrder`), qui recalcule tout.
 */
import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Gift, Loader2, Minus, Plus, Smartphone } from 'lucide-react';
import {
  GIFT_FAMILY_LABEL, GIFT_FAMILY_ORDER, GIFT_MAX, GIFT_MESSAGE_MAX, GIFT_PRESETS, GIFT_QTE_MAX,
  giftLineLabel, parseMontant, validateGiftOrder,
  type GiftCatalogItem, type GiftOrderField, type GiftOrderPublicView, type GiftOrderType,
} from '../../../../types/giftOrders';

interface Props {
  open: boolean;
  catalogue: GiftCatalogItem[];
  montantMin: number;
  validiteMois: number;
  mentions: string;
  businessName: string;
  ownerFirstName: string;
  phone: string;
}

type Errors = Partial<Record<GiftOrderField, string>>;

function chf(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `CHF ${new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v)}`;
}

export default function GiftOrderClient(props: Props) {
  const { open, catalogue, montantMin, validiteMois, mentions, ownerFirstName, phone } = props;
  const owner = ownerFirstName || 'L’institut';

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
  const topRef = useRef<HTMLDivElement>(null);

  const catalogueMap = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);
  const presets = GIFT_PRESETS.filter((p) => p >= montantMin);

  const families = useMemo(
    () => GIFT_FAMILY_ORDER
      .map((f) => ({ id: f, label: GIFT_FAMILY_LABEL[f], items: catalogue.filter((c) => c.famille === f) }))
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

  const payload = () => ({
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
  });

  const clearError = (f: GiftOrderField) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const setQte = (id: string, q: number) => {
    setQtes((prev) => ({ ...prev, [id]: Math.max(0, Math.min(GIFT_QTE_MAX, q)) }));
    clearError('soins');
  };

  const scrollToFirstError = (errs: Errors) => {
    const first = (Object.keys(errs) as GiftOrderField[])[0];
    const el = first ? document.querySelector<HTMLElement>(`[data-field="${first}"]`) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const check = validateGiftOrder(payload(), { montantMin, catalogue: catalogueMap });
    if (!check.ok) {
      setErrors(check.errors);
      scrollToFirstError(check.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/bons-cadeaux/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.fields) {
          setErrors(json.fields);
          scrollToFirstError(json.fields);
        }
        setFormError(json.error || 'Votre commande n’a pas pu être envoyée. Merci de réessayer.');
        return;
      }
      if (!json.order) {
        setFormError('Votre commande n’a pas pu être envoyée. Merci de réessayer.');
        return;
      }
      setDone(json.order as GiftOrderPublicView);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      setFormError('Pas de connexion. Vérifiez votre réseau et réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Vente en ligne fermée ────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="gco">
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
      <div className="gco" ref={topRef}>
        <div className="gco-container gco-pay">
          <div className="gco-pay__main">
            <div className="gco-eyebrow">Commande {done.reference} enregistrée</div>
            <h2 className="gco-h2">Plus qu’une étape : le paiement TWINT</h2>
            <div className="gco-pay__amount">{chf(done.montant)}</div>
            <div className="gco-lead">
              {done.libelle} pour {done.beneficiaire}. Payez ce montant exact par TWINT : dès réception du paiement,
              {' '}{owner} vous envoie le bon en PDF à <strong>{done.acheteur_email}</strong>.
            </div>

            {done.twintLien && (
              <a href={done.twintLien} data-btn="primary" className="gco-pay__twint" target="_blank" rel="noopener noreferrer">
                <Smartphone /> Payer {chf(done.montant)} avec TWINT
              </a>
            )}

            <ol className="gco-steps">
              <li><span>1</span><div>{done.twintLien ? 'Touchez le bouton, ou scannez le code avec l’app TWINT.' : 'Ouvrez l’app TWINT et scannez le code.'}</div></li>
              <li><span>2</span><div>Payez <strong>{chf(done.montant)}</strong>, le montant exact de votre commande.</div></li>
              <li><span>3</span><div>Le bon arrive par e-mail, en PDF, dès que le paiement est vu — en général le jour même.</div></li>
            </ol>

            <div className="gco-note">
              Ces indications vous ont aussi été envoyées par e-mail. Vous avez changé d’avis ? Ne payez pas : la commande
              sera simplement annulée.
            </div>
            <Link href="/" className="gco-link">Retour au site <ArrowRight /></Link>
          </div>

          {done.twintQr && (
            <figure className="gco-pay__qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={done.twintQr} alt="Code QR TWINT de l’institut" />
              <figcaption>Scannez ce code avec l’app TWINT</figcaption>
            </figure>
          )}
        </div>
      </div>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────
  return (
    <div className="gco" ref={topRef}>
      <form className="gco-container gco-layout" onSubmit={submit} noValidate>
        <div className="gco-steps-col">
          {/* 1. Ce que l'on offre */}
          <section className="gco-step" aria-labelledby="gco-s1">
            <div className="gco-step__num">01</div>
            <h2 id="gco-s1" className="gco-h2">Que souhaitez-vous offrir ?</h2>

            <div className="gco-toggle" role="radiogroup" aria-label="Type de bon" data-field="type">
              {([
                ['montant', 'Un montant', 'La personne choisit son soin'],
                ['soins', 'Des soins de la carte', 'Un ou plusieurs soins précis'],
              ] as const).map(([v, title, sub]) => (
                <button
                  key={v} type="button" role="radio" aria-checked={type === v}
                  className={`gco-toggle__opt ${type === v ? 'is-on' : ''}`}
                  onClick={() => { setType(v); clearError('type'); }}
                >
                  <span className="gco-toggle__title">{title}</span>
                  <span className="gco-toggle__sub">{sub}</span>
                </button>
              ))}
            </div>

            {type === 'montant' ? (
              <div className="gco-amount" data-field="montant">
                <div className="gco-chips">
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
                <div className="gco-field">
                  <label htmlFor="gco-autre">Autre montant</label>
                  <div className="gco-money">
                    <span aria-hidden="true">CHF</span>
                    <input
                      id="gco-autre" className="gco-input" inputMode="decimal" autoComplete="off"
                      placeholder={`dès ${montantMin}`} value={autre}
                      aria-invalid={Boolean(errors.montant)}
                      onChange={(e) => { setAutre(e.target.value); clearError('montant'); }}
                    />
                  </div>
                  {errors.montant
                    ? <div className="gco-field__error">{errors.montant}</div>
                    : <div className="gco-field__hint">Dès {chf(montantMin)}, jusqu’à {chf(GIFT_MAX)}. Le bon s’utilise en une ou plusieurs fois.</div>}
                </div>
              </div>
            ) : (
              <div className="gco-carte" data-field="soins">
                {errors.soins && <div className="gco-field__error gco-carte__error">{errors.soins}</div>}
                {families.length === 0 && (
                  <div className="gco-note">La carte des soins est momentanément indisponible : choisissez un montant.</div>
                )}
                {families.map((f) => (
                  <div key={f.id} className="gco-family">
                    <h3 className="gco-family__title">{f.label}</h3>
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
            )}
          </section>

          {/* 2. Pour qui */}
          <section className="gco-step" aria-labelledby="gco-s2">
            <div className="gco-step__num">02</div>
            <h2 id="gco-s2" className="gco-h2">Pour qui ?</h2>
            <div className="gco-grid">
              <div className="gco-field gco-field--wide" data-field="beneficiaire">
                <label htmlFor="gco-benef">Nom de la personne qui reçoit le bon</label>
                <input
                  id="gco-benef" className="gco-input" autoComplete="off" maxLength={80}
                  placeholder="Prénom et nom" value={beneficiaire}
                  aria-invalid={Boolean(errors.beneficiaire)}
                  onChange={(e) => { setBeneficiaire(e.target.value); clearError('beneficiaire'); }}
                />
                {errors.beneficiaire
                  ? <div className="gco-field__error">{errors.beneficiaire}</div>
                  : <div className="gco-field__hint">Le bon est nominatif : ce nom y est imprimé.</div>}
              </div>
              <div className="gco-field gco-field--wide" data-field="message">
                <label htmlFor="gco-msg">Votre petit mot <span className="gco-opt">(facultatif)</span></label>
                <textarea
                  id="gco-msg" className="gco-input" rows={3} maxLength={GIFT_MESSAGE_MAX + 20}
                  placeholder="Joyeux anniversaire ! Prends soin de toi…" value={message}
                  aria-invalid={Boolean(errors.message)}
                  onChange={(e) => { setMessage(e.target.value); clearError('message'); }}
                />
                <div className={message.length > GIFT_MESSAGE_MAX ? 'gco-field__error' : 'gco-field__hint'}>
                  {errors.message ?? `Imprimé sur le bon. ${Math.max(0, GIFT_MESSAGE_MAX - message.length)} caractères restants.`}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Qui commande */}
          <section className="gco-step" aria-labelledby="gco-s3">
            <div className="gco-step__num">03</div>
            <h2 id="gco-s3" className="gco-h2">Vos coordonnées</h2>
            <div className="gco-grid">
              <Field id="gco-prenom" label="Prénom" field="acheteur_prenom" errors={errors} value={prenom} autoComplete="given-name"
                onChange={(v) => { setPrenom(v); clearError('acheteur_prenom'); }} />
              <Field id="gco-nom" label="Nom" field="acheteur_nom" errors={errors} value={nom} autoComplete="family-name"
                onChange={(v) => { setNom(v); clearError('acheteur_nom'); }} />
              <Field id="gco-email" label="E-mail" field="acheteur_email" errors={errors} value={email} type="email" autoComplete="email"
                hint="Le bon vous est envoyé à cette adresse." onChange={(v) => { setEmail(v); clearError('acheteur_email'); }} />
              <Field id="gco-tel" label="Téléphone" optional field="acheteur_telephone" errors={errors} value={telephone} type="tel" autoComplete="tel"
                hint="Seulement en cas de question sur la commande." onChange={(v) => { setTelephone(v); clearError('acheteur_telephone'); }} />
            </div>
            {/* Champ-piège : invisible pour une personne, rempli par les robots. */}
            <div className="gco-trap" aria-hidden="true">
              <label htmlFor="gco-piege">Ne pas remplir</label>
              <input id="gco-piege" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
            </div>
          </section>
        </div>

        {/* Le bon, tel qu'il sera imprimé, et l'envoi */}
        <aside className="gco-aside" aria-label="Votre bon cadeau">
          <div className="gco-aside__sticky">
            <div className="gco-voucher" aria-hidden="true">
              <div className="gco-voucher__head">
                <span>{props.businessName}</span>
                <span>BON-{new Date().getFullYear()}-····</span>
              </div>
              <div className="gco-voucher__title">Bon cadeau</div>
              <div className="gco-voucher__rule" />
              <div className="gco-voucher__offer">
                {type === 'soins' && lignes.length > 0 ? lignes.map(giftLineLabel).join(' + ') : type === 'soins' ? 'Choisissez un ou plusieurs soins' : 'Bon cadeau'}
              </div>
              <div className="gco-voucher__amount">{total > 0 ? chf(total) : '—'}</div>
              <div className="gco-voucher__for">Pour</div>
              <div className="gco-voucher__name">{beneficiaire.trim() || '…'}</div>
              {message.trim() && <div className="gco-voucher__msg">« {message.trim().slice(0, GIFT_MESSAGE_MAX)} »</div>}
              <div className="gco-voucher__foot">Valable {validiteMois} mois</div>
            </div>

            {formError && <div className="gco-notice" role="alert">{formError}</div>}

            <div className="gco-total">
              <span>À payer par TWINT</span>
              <strong>{total > 0 ? chf(total) : '—'}</strong>
            </div>
            <button type="submit" data-btn="primary" className="gco-submit" disabled={submitting}>
              {submitting ? <Loader2 className="gco-spin" /> : <Gift />}
              {submitting ? 'Envoi…' : 'Commander le bon'}
            </button>
            <ul className="gco-reassure">
              <li><Check /> Paiement par TWINT uniquement, à l’étape suivante</li>
              <li><Check /> Le bon vous est envoyé en PDF dès réception du paiement</li>
            </ul>
            {mentions && <div className="gco-legal">{mentions}</div>}
          </div>
        </aside>
      </form>
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
