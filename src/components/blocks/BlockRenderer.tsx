/**
 * Rendu public et rendu d'édition des pages v2.
 *
 * Aucun hook ici : le composant est rendu côté serveur pour les visiteurs
 * (HTML complet, aucune dépendance à JavaScript pour afficher le contenu) et
 * réutilisé tel quel dans l'éditeur, qui lui passe `editor` pour poser les
 * attributs de sélection, de glisser-déposer et d'édition directe des textes.
 */
import React from 'react';
import type {
  ContentStructure, ContentSection, ContentColumn, ContentBlock, Align,
  HeadingBlock, TextBlock, ImageBlock, ButtonBlock, QuoteBlock, VideoBlock,
  HeroBlock, CardsBlock, FaqBlock, StepsBlock, OffersBlock, PriceListBlock, ChecklistBlock,
  CalloutBlock, StatsBlock, TestimonialsBlock, GalleryBlock, MarqueeBlock,
  ContactBlock, GoogleReviewsBlock, CurrentOfferBlock,
} from './types';
import { sanitizeHtml } from './sanitize';
import LegacySection from './LegacySection';
import GoogleReviews from '../GoogleReviews';
import ContactForm from '../ContactForm';
import CardsCarousel from './CardsCarousel';
import { optimizedImgProps, QUALITY, QUALITY_HERO } from '../../utils/imageOptim';
import type { PublicOffer } from '../../types/offers';
import { formatOfferDuration, formatOfferPeriod, formatOfferPrice, offerDescriptionHtml } from '../../types/offers';

export type EditorSelection =
  | { kind: 'section'; sectionId: string }
  | { kind: 'column'; sectionId: string; columnId: string }
  | { kind: 'block'; sectionId: string; columnId: string; blockId: string }
  | null;

export interface EditorState {
  selection: EditorSelection;
  /** Position d'insertion en cours de glisser-déposer. */
  dropTarget?: { sectionId: string; columnId: string; index: number } | null;
  /** Position d'insertion d'une carte glissée, dans le bloc Cartes visé (éventuellement une autre section). */
  cardDrop?: { blockId: string; index: number } | null;
}

/**
 * Images du site public : redimensionnées/converties par l'endpoint `/_next/image`
 * (voir utils/imageOptim.ts). Absent dans l'éditeur, qui garde les URL d'origine.
 */
export interface ImageOptions {
  /** Dimensions lues côté serveur (utils/imageDims.ts), par URL : elles réservent la place de l'image. */
  dims: Record<string, { w: number; h: number }>;
}

/**
 * Données vivantes lues côté serveur par la page (BlockPage) ou par l'éditeur,
 * pour les blocs qui affichent autre chose que leur propre contenu.
 * `undefined` = pas encore chargées (éditeur).
 */
export interface BlockData {
  offers?: PublicOffer[];
}

interface Ctx {
  editor?: EditorState;
  data?: BlockData;
  sectionId: string;
  columnId: string;
  blockId: string;
  /** Réglages d'image, uniquement sur le site public. */
  img?: ImageOptions;
  /** Attribut `sizes` d'une image qui occupe toute la colonne. */
  colSizes: string;
  /** Image probablement à l'origine du LCP : chargée tout de suite, en priorité haute. */
  lcp?: boolean;
}

/** Largeur d'une colonne selon la mise en page de la section (les colonnes s'empilent sous 768 px). */
function columnSizes(layout: string, columns: number): string {
  if (layout === 'full-width' || columns <= 1) return '100vw';
  const share = layout === '3-col-equal' ? 34 : layout === '2-col-equal' ? 50 : 60;
  return `(min-width: 768px) ${share}vw, 100vw`;
}

/**
 * Attributs d'un `<img>` de contenu : `srcset` redimensionné et chargement
 * différé, sauf pour l'image LCP (immédiate, priorité haute). Sans réglages
 * (éditeur), l'URL d'origine et le chargement différé habituel.
 */
function imgAttrs(ctx: Ctx, url: string, sizes: string, lcp = false) {
  if (!ctx.img) return { src: url, loading: 'lazy' as const };
  return {
    ...optimizedImgProps(url, sizes, undefined, lcp ? QUALITY_HERO : QUALITY),
    loading: lcp ? ('eager' as const) : ('lazy' as const),
    fetchPriority: lcp ? ('high' as const) : undefined,
  };
}

/** Attribut d'édition directe d'un texte simple (double-clic dans l'éditeur). */
function f(ctx: Ctx, path: string): Record<string, string> {
  return ctx.editor ? { 'data-pb-field': path } : {};
}

const alignCls = (a?: string) => (a === 'center' ? 'pb-center' : a === 'right' ? 'pb-right' : '');
const taCls = (a?: string) => (a ? `pb-ta-${a}` : '');

function isExternal(url?: string) {
  return !!url && /^https?:\/\//.test(url);
}

function Btn({ text, url, variant = 'primary', ctx, field, newTab }: { text?: string; url?: string; variant?: 'primary' | 'secondary' | 'link'; ctx: Ctx; field: string; newTab?: boolean }) {
  if (!text) return null;
  const target = newTab || isExternal(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  if (variant === 'link') {
    return (
      <a href={url || '#'} className="pb-link" {...target}>
        <span {...f(ctx, field)}>{text}</span> <span aria-hidden>→</span>
      </a>
    );
  }
  return (
    <a href={url || '#'} data-btn={variant} className={`pb-btn btn-${variant}`} {...target}>
      <span {...f(ctx, field)}>{text}</span>
    </a>
  );
}

function Head({ eyebrow, title, intro, level = 2, align, ctx }: { eyebrow?: string; title?: string; intro?: string; level?: 1 | 2 | 3; align?: Align; ctx: Ctx }) {
  if (!eyebrow && !title && !intro) return null;
  const H = (`h${level}` as 'h1' | 'h2' | 'h3');
  return (
    <div className={`pb-head ${alignCls(align)}`}>
      {eyebrow && <span className="pb-eyebrow" {...f(ctx, 'eyebrow')}>{eyebrow}</span>}
      {title && <H className={`pb-h pb-h${level}`} {...f(ctx, 'title')}>{title}</H>}
      {intro && <p className="pb-lead" {...f(ctx, 'intro')}>{intro}</p>}
    </div>
  );
}

// ─── Blocs ────────────────────────────────────────────────────────────────────

function HeadingView({ b, ctx }: { b: HeadingBlock; ctx: Ctx }) {
  const H = (`h${b.level || 2}` as 'h1' | 'h2' | 'h3');
  return (
    <div className={`pb-head ${alignCls(b.align)} ${taCls(b.align)}`} style={{ marginBottom: 0 }}>
      {b.eyebrow && <span className="pb-eyebrow" {...f(ctx, 'eyebrow')}>{b.eyebrow}</span>}
      <H className={`pb-h pb-h${b.level || 2}`} {...f(ctx, 'text')}>{b.text}</H>
      {b.lead && <p className="pb-lead" {...f(ctx, 'lead')}>{b.lead}</p>}
    </div>
  );
}

function TextView({ b }: { b: TextBlock }) {
  return <div className={`pb-prose ${taCls(b.align)}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html) }} />;
}

function ImageView({ b, ctx }: { b: ImageBlock; ctx: Ctx }) {
  if (!b.url) {
    return ctx.editor ? <div className="pb-img-empty">Cliquez pour choisir une image</div> : null;
  }
  if (b.fill) {
    return (
      <figure className="pb-img pb-img-fill">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...imgAttrs(ctx, b.url, ctx.colSizes, ctx.lcp)} alt={b.alt || ''} decoding="async" data-parallax={ctx.editor ? undefined : '0.06'} />
      </figure>
    );
  }
  const size = b.size && b.size !== 'full' ? `pb-img-${b.size}` : '';
  const maxPx = b.size === 'small' ? 288 : b.size === 'medium' ? 448 : b.size === 'large' ? 672 : 0;
  const hasRatio = !!b.ratio && b.ratio !== 'auto';
  // Sans ratio imposé, largeur/hauteur d'origine : le navigateur réserve la place avant le chargement.
  const dims = !hasRatio ? ctx.img?.dims[b.url] : undefined;
  return (
    <figure className={`pb-img ${size} ${alignCls(b.align)}`}>
      <div className="pb-img-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...imgAttrs(ctx, b.url, maxPx ? `min(100vw, ${maxPx}px)` : ctx.colSizes, ctx.lcp)}
          width={dims?.w}
          height={dims?.h}
          alt={b.alt || ''}
          decoding="async"
          data-parallax={ctx.editor ? undefined : '0.05'}
          style={{ aspectRatio: hasRatio ? b.ratio : undefined, objectFit: b.fit || 'cover' }}
        />
      </div>
      {b.caption && <figcaption {...f(ctx, 'caption')}>{b.caption}</figcaption>}
    </figure>
  );
}

function ButtonView({ b, ctx }: { b: ButtonBlock; ctx: Ctx }) {
  return (
    <div className={`pb-btns ${alignCls(b.align)}`}>
      <Btn text={b.text} url={b.url} variant={b.variant} ctx={ctx} field="text" newTab={b.newTab} />
      <Btn text={b.secondaryText} url={b.secondaryUrl} variant="secondary" ctx={ctx} field="secondaryText" newTab={b.newTab} />
    </div>
  );
}

function QuoteView({ b, ctx }: { b: QuoteBlock; ctx: Ctx }) {
  return (
    <blockquote className={`pb-quote ${taCls(b.align)}`}>
      <span {...f(ctx, 'quote')}>{b.quote}</span>
      {(b.author || b.role) && (
        <cite>
          {b.author && <span {...f(ctx, 'author')}>{b.author}</span>}
          {b.author && b.role ? ' · ' : ''}
          {b.role && <span {...f(ctx, 'role')}>{b.role}</span>}
        </cite>
      )}
    </blockquote>
  );
}

function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function VideoView({ b, ctx }: { b: VideoBlock; ctx: Ctx }) {
  if (!b.url) return ctx.editor ? <div className="pb-img-empty">Ajoutez l&apos;adresse d&apos;une vidéo</div> : null;
  const embed = videoEmbed(b.url);
  return (
    <figure className="pb-img">
      <div className="pb-video">
        {embed
          ? <iframe src={embed} title={b.caption || 'Vidéo'} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
          : <video src={b.url} controls preload="metadata" />}
      </div>
      {b.caption && <figcaption {...f(ctx, 'caption')}>{b.caption}</figcaption>}
    </figure>
  );
}

function HeroView({ b, ctx }: { b: HeroBlock; ctx: Ctx }) {
  const center = b.align === 'center';
  return (
    <div className={`pb-head ${center ? 'pb-center' : ''}`} style={{ marginBottom: 0, gap: '1.5rem' }}>
      {b.eyebrow && <span className="pb-eyebrow" {...f(ctx, 'eyebrow')}>{b.eyebrow}</span>}
      <h1 className={`pb-h ${b.size === 'medium' ? 'pb-h2' : 'pb-h1'}`} style={{ maxWidth: '18ch' }} {...f(ctx, 'title')}>{b.title}</h1>
      {b.text && <p className="pb-lead" {...f(ctx, 'text')}>{b.text}</p>}
      {(b.ctaText || b.secondaryText) && (
        <div className={`pb-btns ${center ? 'pb-center' : ''}`} style={{ marginTop: '.75rem' }}>
          <Btn text={b.ctaText} url={b.ctaUrl} ctx={ctx} field="ctaText" />
          <Btn text={b.secondaryText} url={b.secondaryUrl} variant="secondary" ctx={ctx} field="secondaryText" />
        </div>
      )}
    </div>
  );
}

function CardsView({ b, ctx }: { b: CardsBlock; ctx: Ctx }) {
  const style = b.style || 'tinted';
  const left = b.imagePosition === 'left';
  const carousel = b.layout === 'carousel';
  const editor = ctx.editor;
  const cardDrop = editor?.cardDrop && editor.cardDrop.blockId === ctx.blockId ? editor.cardDrop : null;
  const cardSizes = carousel
    ? '(min-width: 640px) 320px, 82vw'
    : left
      ? '(min-width: 640px) 20vw, 40vw'
      : `(min-width: 1024px) ${b.cols === 4 ? 25 : b.cols === 3 ? 34 : 50}vw, (min-width: 640px) 50vw, 100vw`;
  const cardNodes = b.items.map((it, i) => {
    const body = (
      <>
        {it.title && <h3 className="pb-card-title" {...f(ctx, `items.${i}.title`)}>{it.title}</h3>}
        {it.text && <p className="pb-card-text" {...f(ctx, `items.${i}.text`)}>{it.text}</p>}
        {it.linkText && <Btn text={it.linkText} url={it.linkUrl} variant="link" ctx={ctx} field={`items.${i}.linkText`} />}
      </>
    );
    const dropCls = !cardDrop ? '' : cardDrop.index === i ? 'pb-card-drop-before' : (cardDrop.index === b.items.length && i === b.items.length - 1) ? 'pb-card-drop-after' : '';
    return (
      <article
        key={it.id}
        className={`pb-card pb-card-${style} ${dropCls}`}
        draggable={!!editor}
        data-editor-kind={editor ? 'card-item' : undefined}
        data-editor-item-id={editor ? it.id : undefined}
      >
        {it.image && (
          <div className="pb-card-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...imgAttrs(ctx, it.image, cardSizes)} alt={it.title || ''} decoding="async" draggable={false} />
          </div>
        )}
        {left ? <div className="pb-card-body">{body}</div> : body}
      </article>
    );
  });
  return (
    <div>
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} ctx={ctx} />
      {carousel ? (
        <div className={`pb-cards-carousel pb-cols-${b.cols || 3}`}>
          <CardsCarousel editable={!!ctx.editor}>{cardNodes}</CardsCarousel>
        </div>
      ) : (
        <div className={`pb-cards pb-cols-${b.cols || 3} ${left ? 'pb-cards-imgleft' : ''}`}>{cardNodes}</div>
      )}
    </div>
  );
}

function StepsView({ b, ctx }: { b: StepsBlock; ctx: Ctx }) {
  const n = Math.min(b.items.length, 4);
  return (
    <div>
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} ctx={ctx} />
      <ol className={`pb-steps pb-steps-n${n}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {b.items.map((it, i) => (
          <li key={it.id} className="pb-step">
            <span className="pb-step-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <h3 className="pb-card-title" {...f(ctx, `items.${i}.title`)}>{it.title}</h3>
            {it.text && <p className="pb-card-text" {...f(ctx, `items.${i}.text`)}>{it.text}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OffersView({ b, ctx }: { b: OffersBlock; ctx: Ctx }) {
  const n = Math.min(b.offers.length, 4);
  return (
    <div>
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} ctx={ctx} />
      <div className={`pb-offers pb-offers-n${n}`}>
        {b.offers.map((o, i) => (
          <article key={o.id} className={`pb-offer ${o.highlight ? 'pb-offer-hl' : ''}`}>
            {o.badge && <span className="pb-offer-badge" {...f(ctx, `offers.${i}.badge`)}>{o.badge}</span>}
            {o.name && <h3 className="pb-offer-name" {...f(ctx, `offers.${i}.name`)}>{o.name}</h3>}
            <p className="pb-offer-price">
              <span {...f(ctx, `offers.${i}.price`)}>{o.price}</span>
              {o.priceNote && <small {...f(ctx, `offers.${i}.priceNote`)}>{o.priceNote}</small>}
            </p>
            {o.description && <p className="pb-offer-desc" {...f(ctx, `offers.${i}.description`)}>{o.description}</p>}
            {o.bullets && o.bullets.length > 0 && (
              <ul className="pb-check">{o.bullets.map((x, j) => <li key={j} {...f(ctx, `offers.${i}.bullets.${j}`)}>{x}</li>)}</ul>
            )}
            <Btn text={o.ctaText} url={o.ctaUrl} ctx={ctx} field={`offers.${i}.ctaText`} />
          </article>
        ))}
      </div>
      {b.footnote && <p className="pb-foot" {...f(ctx, 'footnote')}>{b.footnote}</p>}
    </div>
  );
}

function PriceListView({ b, ctx }: { b: PriceListBlock; ctx: Ctx }) {
  return (
    <div className="pb-pricelist">
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} level={b.level === 3 ? 3 : 2} ctx={ctx} />
      <ul className="pb-prices">
        {b.items.map((it, i) => (
          <li key={it.id} className="pb-price-row">
            <div className="pb-price-main">
              <span className="pb-price-name" {...f(ctx, `items.${i}.name`)}>{it.name}</span>
              {it.duration && <span className="pb-price-dur" {...f(ctx, `items.${i}.duration`)}>{it.duration}</span>}
              <span className="pb-price-dots" aria-hidden />
              <span className="pb-price-val" {...f(ctx, `items.${i}.price`)}>{it.price}</span>
            </div>
            {it.description && <p className="pb-price-desc" {...f(ctx, `items.${i}.description`)}>{it.description}</p>}
          </li>
        ))}
      </ul>
      {b.footnote && <p className="pb-foot" {...f(ctx, 'footnote')}>{b.footnote}</p>}
      {b.linkText && <div style={{ marginTop: '1.5rem' }}><Btn text={b.linkText} url={b.linkUrl} variant="link" ctx={ctx} field="linkText" /></div>}
    </div>
  );
}

function ChecklistView({ b, ctx }: { b: ChecklistBlock; ctx: Ctx }) {
  return (
    <div>
      {b.title && <h3 className="pb-h pb-h3" style={{ marginBottom: '1rem' }} {...f(ctx, 'title')}>{b.title}</h3>}
      <ul className="pb-check">{b.items.map((x, i) => <li key={i} {...f(ctx, `items.${i}`)}>{x}</li>)}</ul>
    </div>
  );
}

function FaqView({ b, ctx }: { b: FaqBlock; ctx: Ctx }) {
  return (
    <div className="pb-faq-wrap pb-center">
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} ctx={ctx} align="center" />
      <div className="pb-faq">
        {b.items.map((it, i) => (
          <details key={it.id} open={!!ctx.editor || undefined}>
            <summary><span {...f(ctx, `items.${i}.question`)}>{it.question}</span></summary>
            <div className="pb-faq-a" {...f(ctx, `items.${i}.answer`)}>{it.answer}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

function CalloutView({ b, ctx }: { b: CalloutBlock; ctx: Ctx }) {
  return (
    <div className="pb-callout">
      {b.eyebrow && <span className="pb-eyebrow" {...f(ctx, 'eyebrow')}>{b.eyebrow}</span>}
      <h2 className="pb-h pb-h2" {...f(ctx, 'title')}>{b.title}</h2>
      {b.text && <p className="pb-lead" {...f(ctx, 'text')}>{b.text}</p>}
      <div className="pb-btns pb-center" style={{ marginTop: '.5rem' }}>
        <Btn text={b.ctaText} url={b.ctaUrl} ctx={ctx} field="ctaText" />
      </div>
    </div>
  );
}

function StatsView({ b, ctx }: { b: StatsBlock; ctx: Ctx }) {
  return (
    <div>
      <Head eyebrow={b.eyebrow} title={b.title} ctx={ctx} />
      <dl className={`pb-stats pb-stats-n${Math.min(b.items.length, 6)}`} style={{ margin: 0 }}>
        {b.items.map((it, i) => (
          <div key={it.id} className="pb-stat">
            <dt className="pb-stat-l" style={{ order: 2 }} {...f(ctx, `items.${i}.label`)}>{it.label}</dt>
            <dd className="pb-stat-v" style={{ margin: 0 }} {...f(ctx, `items.${i}.value`)}>{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TestimonialsView({ b, ctx }: { b: TestimonialsBlock; ctx: Ctx }) {
  if (!b.items.length) return ctx.editor ? <div className="pb-img-empty">Ajoutez un témoignage réel dans le panneau</div> : null;
  return (
    <div>
      <Head title={b.title} ctx={ctx} />
      <div className="pb-testis">
        {b.items.map((it, i) => (
          <blockquote key={it.id} className="pb-testi">
            <p {...f(ctx, `items.${i}.quote`)}>{it.quote}</p>
            <footer>
              <span {...f(ctx, `items.${i}.author`)}>{it.author}</span>
              {it.role ? <> · <span {...f(ctx, `items.${i}.role`)}>{it.role}</span></> : null}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

function GalleryView({ b, ctx }: { b: GalleryBlock; ctx: Ctx }) {
  if (!b.images.length) return ctx.editor ? <div className="pb-img-empty">Ajoutez des photos dans le panneau</div> : null;
  const cols = b.cols || 3;
  const gallerySizes = b.variant === 'carousel'
    ? '(min-width: 416px) 416px, 80vw'
    : `(min-width: 900px) ${cols === 4 ? 25 : cols === 3 ? 34 : 50}vw, 50vw`;
  return (
    <div>
      <Head title={b.title} ctx={ctx} />
      <div className={`pb-gallery pb-gallery-${b.variant} pb-cols-${b.cols || 3}`}>
        {b.images.map((im) => (
          <figure key={im.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...imgAttrs(ctx, im.url, gallerySizes)} alt={im.alt || ''} decoding="async" />
            {im.caption && <figcaption>{im.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

function MarqueeView({ b }: { b: MarqueeBlock }) {
  const dur = b.speed === 'slow' ? '48s' : b.speed === 'fast' ? '18s' : '32s';
  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined}>
      {b.items.map((x, i) => (
        <React.Fragment key={i}>
          <span style={{ fontStyle: b.italic ? 'italic' : undefined }}>{x}</span>
          <span className="pb-marquee-sep" aria-hidden>{b.separator || '●'}</span>
        </React.Fragment>
      ))}
    </span>
  );
  return (
    <div className="pb-marquee" aria-label={b.items.join(', ')}>
      <div className="pb-marquee-track" style={{ ['--pb-marquee-dur' as string]: dur }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

function ContactView({ b, ctx }: { b: ContactBlock; ctx: Ctx }) {
  const tel = b.phone ? `tel:${b.phone.replace(/[^\d+]/g, '')}` : undefined;
  return (
    <div className="pb-contact">
      {b.title && <h2 className="pb-h pb-h2" {...f(ctx, 'title')}>{b.title}</h2>}
      {b.text && <p className="pb-lead" {...f(ctx, 'text')}>{b.text}</p>}
      <dl>
        {b.address && <div><dt>Adresse</dt><dd {...f(ctx, 'address')}>{b.address}</dd></div>}
        {b.phone && <div><dt>Téléphone</dt><dd><a href={tel} {...f(ctx, 'phone')}>{b.phone}</a></dd></div>}
        {b.email && <div><dt>E-mail</dt><dd><a href={`mailto:${b.email}`} {...f(ctx, 'email')}>{b.email}</a></dd></div>}
        {b.hours && <div><dt>Horaires</dt><dd {...f(ctx, 'hours')}>{b.hours}</dd></div>}
      </dl>
    </div>
  );
}

function GoogleReviewsView({ b, ctx }: { b: GoogleReviewsBlock; ctx: Ctx }) {
  return (
    <div>
      <Head title={b.title} ctx={ctx} align="center" />
      <GoogleReviews bg="bg-transparent" />
    </div>
  );
}

function placesLabel(n: number, max: number | null): string {
  if (n === 1) return 'Dernière place disponible';
  if (n <= 5) return `Plus que ${n} places`;
  return max ? `${n} places disponibles sur ${max}` : `${n} places disponibles`;
}

function CurrentOfferView({ b, ctx }: { b: CurrentOfferBlock; ctx: Ctx }) {
  const offers = ctx.data?.offers;
  if (!offers) return ctx.editor ? <div className="pb-img-empty">Chargement de l&apos;offre du moment…</div> : null;
  if (offers.length === 0) {
    return ctx.editor
      ? <div className="pb-img-empty pb-curoffer-empty">Aucune offre en cours aujourd&apos;hui : l&apos;encart est masqué sur le site. Les offres se créent dans Admin → Offre du moment.</div>
      : null;
  }
  return (
    <div className="pb-curoffers">
      {offers.map((o) => {
        const url = o.reservable_en_ligne ? `/reservation?offre=${encodeURIComponent(o.id)}` : '/contact';
        return (
          <article key={o.id} className={`pb-curoffer ${b.imagePosition === 'right' ? 'pb-curoffer-rev' : ''} ${o.image_url ? '' : 'pb-curoffer-noimg'}`}>
            {o.image_url && (
              <div className="pb-curoffer-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...imgAttrs(ctx, o.image_url, '(min-width: 900px) 45vw, 100vw')} alt={o.titre} decoding="async" />
              </div>
            )}
            <div className="pb-curoffer-body">
              {b.eyebrow && <span className="pb-eyebrow" {...f(ctx, 'eyebrow')}>{b.eyebrow}</span>}
              <h2 className="pb-h pb-h2">{o.titre}</h2>
              {o.description && (
                <div className="pb-curoffer-desc rich-text" dangerouslySetInnerHTML={{ __html: offerDescriptionHtml(o.description) }} />
              )}
              <p className="pb-curoffer-price">
                <span>{formatOfferPrice(o.prix_chf)}</span>
                {o.prix_normal_chf != null && o.prix_normal_chf > o.prix_chf && (
                  <small>au lieu de <s>{formatOfferPrice(o.prix_normal_chf)}</s></small>
                )}
              </p>
              <ul className="pb-curoffer-meta">
                <li>Valable {formatOfferPeriod(o.date_debut, o.date_fin)}</li>
                <li>{formatOfferDuration(o.duree_minutes)}</li>
                {b.showPlaces !== false && o.places_restantes != null && (
                  <li className="pb-curoffer-places">{placesLabel(o.places_restantes, o.places_max)}</li>
                )}
              </ul>
              {b.showConditions !== false && o.conditions && <p className="pb-curoffer-cond">{o.conditions}</p>}
              <div className="pb-btns"><Btn text={b.ctaText || 'Réserver cette offre'} url={url} ctx={ctx} field="ctaText" /></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BlockView({ block, ctx }: { block: ContentBlock; ctx: Ctx }) {
  switch (block.type) {
    case 'heading': return <HeadingView b={block} ctx={ctx} />;
    case 'text': return <TextView b={block} />;
    case 'image': return <ImageView b={block} ctx={ctx} />;
    case 'button': return <ButtonView b={block} ctx={ctx} />;
    case 'quote': return <QuoteView b={block} ctx={ctx} />;
    case 'video': return <VideoView b={block} ctx={ctx} />;
    case 'spacer': return <div className={`pb-spacer-${block.height}`} aria-hidden />;
    case 'divider': return <hr className={`pb-divider ${block.style === 'short' ? 'pb-divider-short' : ''}`} />;
    case 'hero': return <HeroView b={block} ctx={ctx} />;
    case 'cards': return <CardsView b={block} ctx={ctx} />;
    case 'steps': return <StepsView b={block} ctx={ctx} />;
    case 'offers': return <OffersView b={block} ctx={ctx} />;
    case 'pricelist': return <PriceListView b={block} ctx={ctx} />;
    case 'checklist': return <ChecklistView b={block} ctx={ctx} />;
    case 'faq': return <FaqView b={block} ctx={ctx} />;
    case 'callout': return <CalloutView b={block} ctx={ctx} />;
    case 'stats': return <StatsView b={block} ctx={ctx} />;
    case 'testimonials': return <TestimonialsView b={block} ctx={ctx} />;
    case 'gallery': return <GalleryView b={block} ctx={ctx} />;
    case 'marquee': return <MarqueeView b={block} />;
    case 'contact': return <ContactView b={block} ctx={ctx} />;
    case 'contact_form': return <div className="pb-contact-form"><ContactForm /></div>;
    case 'google_reviews': return <GoogleReviewsView b={block} ctx={ctx} />;
    case 'current_offer': return <CurrentOfferView b={block} ctx={ctx} />;
    case 'legacy_section': return <LegacySection section={block.section} />;
    default: return null;
  }
}

// ─── Structure ────────────────────────────────────────────────────────────────

function toneClass(bg: string | undefined, tone: string | undefined): string {
  if (tone === 'light') return 'pb-tone-light';
  if (tone === 'dark') return '';
  return bg === 'dark' || bg === 'accent' ? 'pb-tone-light' : '';
}

function ColumnView({ section, column, index, editor, images, data, lcpId }: { section: ContentSection; column: ContentColumn; index: number; editor?: EditorState; images?: ImageOptions; data?: BlockData; lcpId?: string | null }) {
  const colSizes = columnSizes(section.layout, section.columns.length);
  const sel = editor?.selection;
  const selected = sel?.kind === 'column' && sel.columnId === column.id;
  const hasBg = column.background && column.background !== 'transparent';
  const onlyFill = column.blocks.length === 1 && column.blocks[0].type === 'image' && (column.blocks[0] as ImageBlock).fill;
  const cls = [
    'pb-col',
    hasBg ? `pb-col-bg pb-bg-${column.background}` : '',
    hasBg || column.textTone ? toneClass(column.background, column.textTone) : '',
    onlyFill ? 'pb-col-fill' : '',
    selected ? 'pb-selected' : '',
  ].filter(Boolean).join(' ');
  const drop = editor?.dropTarget && editor.dropTarget.columnId === column.id ? editor.dropTarget.index : -1;
  const edAttrs = editor
    ? { 'data-editor-kind': 'column', 'data-editor-section-id': section.id, 'data-editor-column-id': column.id, 'data-editor-column-idx': String(index) }
    : {};

  return (
    <div className={cls} {...edAttrs}>
      {column.blocks.map((block, i) => {
        const ctx: Ctx = { editor, data, sectionId: section.id, columnId: column.id, blockId: block.id, img: images, colSizes, lcp: block.id === lcpId };
        const view = <BlockView block={block} ctx={ctx} />;
        if (!editor) return <React.Fragment key={block.id}>{view}</React.Fragment>;
        const isSel = sel?.kind === 'block' && sel.blockId === block.id;
        return (
          <React.Fragment key={block.id}>
            {drop === i && <div className="pb-drop-line" />}
            <div
              className={`${isSel ? 'pb-selected' : ''} ${block.type === 'image' && (block as ImageBlock).fill ? 'pb-img-fill' : ''}`}
              style={block.type === 'image' && (block as ImageBlock).fill ? { display: 'flex' } : undefined}
              draggable
              data-editor-kind="block"
              data-editor-section-id={section.id}
              data-editor-column-id={column.id}
              data-editor-block-id={block.id}
              data-editor-block-idx={i}
            >
              {view}
            </div>
            <div className="pb-add-zone">
              <button type="button" className="pb-add-btn" data-pb-add data-pb-add-section={section.id} data-pb-add-column={column.id} data-pb-add-block={block.id} aria-label="Ajouter un bloc en dessous">+</button>
            </div>
          </React.Fragment>
        );
      })}
      {editor && drop === column.blocks.length && <div className="pb-drop-line" />}
      {editor && column.blocks.length === 0 && (
        <div className="pb-empty-col">
          <span>Colonne vide</span>
          <button type="button" className="pb-add-btn pb-add-btn-static" data-pb-add data-pb-add-section={section.id} data-pb-add-column={column.id} aria-label="Ajouter un bloc">+</button>
        </div>
      )}
    </div>
  );
}

function SectionView({ section, editor, first, images, data, lcpId }: { section: ContentSection; editor?: EditorState; first: boolean; images?: ImageOptions; data?: BlockData; lcpId?: string | null }) {
  const bg = section.background || 'transparent';
  const sel = editor?.selection;
  const selected = sel?.kind === 'section' && sel.sectionId === section.id;
  const cls = [
    'pb-section',
    `pb-bg-${bg}`,
    toneClass(bg, section.textTone),
    `pb-pad-${section.paddingY || 'medium'}`,
    section.minHeight && section.minHeight !== 'auto' ? `pb-minh-${section.minHeight}` : '',
    section.animation && section.animation !== 'none' ? `pb-anim-${section.animation}` : '',
    selected ? 'pb-selected' : '',
  ].filter(Boolean).join(' ');
  const width = section.layout === 'full-width' ? 'full' : section.width || 'wide';
  const grid = [
    'pb-grid',
    `pb-l-${section.layout}`,
    `pb-align-${section.alignItems || 'top'}`,
    section.flush ? 'pb-flush' : '',
    section.innerPad && section.innerPad !== 'none' ? `pb-inner-${section.innerPad}` : '',
    section.reverseOnMobile ? 'pb-reverse-mobile' : '',
  ].filter(Boolean).join(' ');
  const edAttrs = editor ? { 'data-editor-kind': 'section', 'data-editor-section-id': section.id } : {};

  return (
    <section className={cls} {...edAttrs} data-section data-density={section.paddingY}>
      {section.bgImage?.url && (
        <div className="pb-bgimg" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...(images ? optimizedImgProps(section.bgImage.url, '100vw', undefined, first ? QUALITY_HERO : QUALITY) : { src: section.bgImage.url })}
            alt=""
            loading={first ? 'eager' : 'lazy'}
            fetchPriority={first ? 'high' : undefined}
            decoding="async"
            data-parallax={editor ? undefined : '0.05'}
            style={{ opacity: (section.bgImage.opacity ?? 60) / 100, objectPosition: section.bgImage.position || 'center' }}
          />
        </div>
      )}
      <div className={`pb-container pb-w-${width}`} data-container data-width={width} data-gutter={width === 'full' ? 'none' : undefined}>
        <div className={grid}>
          {section.columns.map((col, i) => (
            <ColumnView key={col.id} section={section} column={col} index={i} editor={editor} images={images} data={data} lcpId={lcpId} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Premier bloc image de la première section, quand celle-ci n'a pas d'image de
 * fond : c'est lui, le plus souvent, l'élément le plus grand du premier écran.
 */
function firstSectionImageId(content: ContentStructure): string | null {
  const first = content[0];
  if (!first || first.bgImage?.url) return null;
  for (const col of first.columns) {
    for (const blk of col.blocks) if (blk.type === 'image' && blk.url) return blk.id;
  }
  return null;
}

/** Blocs qui ne rendent rien sans offre en cours, et ceux qui ne font que les entourer. */
const OFFER_FRAME_TYPES = new Set(['current_offer', 'spacer', 'divider']);

/**
 * Section qui n'existe que pour l'offre du moment (bloc « Offre du moment »,
 * éventuellement espaces et séparateurs) alors qu'aucune offre n'est en cours :
 * on ne la rend pas, plutôt que de laisser une bande de couleur vide.
 */
function isIdleOfferSection(section: ContentSection, data?: BlockData): boolean {
  if (data?.offers?.length) return false;
  const blocks = section.columns.flatMap((c) => c.blocks);
  return blocks.some((b) => b.type === 'current_offer') && blocks.every((b) => OFFER_FRAME_TYPES.has(b.type));
}

export function BlockRenderer({ content, editor, images, data }: { content: ContentStructure; editor?: EditorState; images?: ImageOptions; data?: BlockData }) {
  const visible = editor ? content : content.filter((s) => !isIdleOfferSection(s, data));
  const lcpId = images ? firstSectionImageId(visible) : null;
  return (
    <div className={`pb-page ${editor ? 'pb-editing' : ''}`}>
      {visible.map((section, i) => (
        <SectionView key={section.id} section={section} editor={editor} first={i === 0} images={images} data={data} lcpId={i === 0 ? lcpId : null} />
      ))}
    </div>
  );
}

/** La page contient-elle un bloc « Offre du moment » ? (évite une requête inutile) */
export function hasCurrentOfferBlock(content: ContentStructure): boolean {
  return content.some((s) => s.columns.some((c) => c.blocks.some((b) => b.type === 'current_offer')));
}

/** Questions/réponses de la page, pour le JSON-LD FAQPage (une seule fois par page). */
export function collectFaq(content: ContentStructure): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  for (const s of content) for (const c of s.columns) for (const b of c.blocks) {
    if (b.type === 'faq') for (const it of b.items) if (it.question && it.answer) out.push({ question: it.question, answer: it.answer });
  }
  return out;
}

/** URL des images qui ont besoin de leurs dimensions (bloc image sans ratio imposé, hors « remplir »). */
export function collectImageUrlsNeedingDims(content: ContentStructure): string[] {
  const out: string[] = [];
  for (const s of content) for (const c of s.columns) for (const b of c.blocks) {
    if (b.type === 'image' && b.url && !b.fill && (!b.ratio || b.ratio === 'auto')) out.push(b.url);
  }
  return out;
}
