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
  HeroBlock, CardsBlock, FaqBlock, StepsBlock, OffersBlock, ChecklistBlock,
  CalloutBlock, StatsBlock, TestimonialsBlock, GalleryBlock, MarqueeBlock,
  ContactBlock, GoogleReviewsBlock,
} from './types';
import { sanitizeHtml } from './sanitize';
import LegacySection from './LegacySection';
import GoogleReviews from '../GoogleReviews';

export type EditorSelection =
  | { kind: 'section'; sectionId: string }
  | { kind: 'column'; sectionId: string; columnId: string }
  | { kind: 'block'; sectionId: string; columnId: string; blockId: string }
  | null;

export interface EditorState {
  selection: EditorSelection;
  /** Position d'insertion en cours de glisser-déposer. */
  dropTarget?: { sectionId: string; columnId: string; index: number } | null;
}

interface Ctx {
  editor?: EditorState;
  sectionId: string;
  columnId: string;
  blockId: string;
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
        <img src={b.url} alt={b.alt || ''} loading="lazy" decoding="async" />
      </figure>
    );
  }
  const size = b.size && b.size !== 'full' ? `pb-img-${b.size}` : '';
  return (
    <figure className={`pb-img ${size} ${alignCls(b.align)}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={b.url}
        alt={b.alt || ''}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: b.ratio && b.ratio !== 'auto' ? b.ratio : undefined, objectFit: b.fit || 'cover' }}
      />
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
  return (
    <div>
      <Head eyebrow={b.eyebrow} title={b.title} intro={b.intro} ctx={ctx} />
      <div className={`pb-cards pb-cols-${b.cols || 3}`}>
        {b.items.map((it, i) => (
          <article key={it.id} className={`pb-card pb-card-${style}`}>
            {it.image && (
              <div className="pb-card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt={it.title || ''} loading="lazy" decoding="async" />
              </div>
            )}
            {it.title && <h3 className="pb-card-title" {...f(ctx, `items.${i}.title`)}>{it.title}</h3>}
            {it.text && <p className="pb-card-text" {...f(ctx, `items.${i}.text`)}>{it.text}</p>}
            {it.linkText && <Btn text={it.linkText} url={it.linkUrl} variant="link" ctx={ctx} field={`items.${i}.linkText`} />}
          </article>
        ))}
      </div>
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
  return (
    <div>
      <Head title={b.title} ctx={ctx} />
      <div className={`pb-gallery pb-gallery-${b.variant} pb-cols-${b.cols || 3}`}>
        {b.images.map((im) => (
          <figure key={im.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.alt || ''} loading="lazy" decoding="async" />
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
    case 'checklist': return <ChecklistView b={block} ctx={ctx} />;
    case 'faq': return <FaqView b={block} ctx={ctx} />;
    case 'callout': return <CalloutView b={block} ctx={ctx} />;
    case 'stats': return <StatsView b={block} ctx={ctx} />;
    case 'testimonials': return <TestimonialsView b={block} ctx={ctx} />;
    case 'gallery': return <GalleryView b={block} ctx={ctx} />;
    case 'marquee': return <MarqueeView b={block} />;
    case 'contact': return <ContactView b={block} ctx={ctx} />;
    case 'google_reviews': return <GoogleReviewsView b={block} ctx={ctx} />;
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

function ColumnView({ section, column, index, editor }: { section: ContentSection; column: ContentColumn; index: number; editor?: EditorState }) {
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
        const ctx: Ctx = { editor, sectionId: section.id, columnId: column.id, blockId: block.id };
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
          </React.Fragment>
        );
      })}
      {editor && drop === column.blocks.length && <div className="pb-drop-line" />}
      {editor && column.blocks.length === 0 && <div className="pb-empty-col">Colonne vide — ajoutez un bloc</div>}
    </div>
  );
}

function SectionView({ section, editor, first }: { section: ContentSection; editor?: EditorState; first: boolean }) {
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
    section.reverseOnMobile ? 'pb-reverse-mobile' : '',
  ].filter(Boolean).join(' ');
  const edAttrs = editor ? { 'data-editor-kind': 'section', 'data-editor-section-id': section.id } : {};

  return (
    <section className={cls} {...edAttrs} data-section data-density={section.paddingY}>
      {section.bgImage?.url && (
        <div className="pb-bgimg" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={section.bgImage.url}
            alt=""
            loading={first ? 'eager' : 'lazy'}
            fetchPriority={first ? 'high' : undefined}
            decoding="async"
            style={{ opacity: (section.bgImage.opacity ?? 60) / 100, objectPosition: section.bgImage.position || 'center' }}
          />
        </div>
      )}
      <div className={`pb-container pb-w-${width}`} data-container data-width={width} data-gutter={width === 'full' ? 'none' : undefined}>
        <div className={grid}>
          {section.columns.map((col, i) => (
            <ColumnView key={col.id} section={section} column={col} index={i} editor={editor} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlockRenderer({ content, editor }: { content: ContentStructure; editor?: EditorState }) {
  return (
    <div className={`pb-page ${editor ? 'pb-editing' : ''}`}>
      {content.map((section, i) => (
        <SectionView key={section.id} section={section} editor={editor} first={i === 0} />
      ))}
    </div>
  );
}

/** Questions/réponses de la page, pour le JSON-LD FAQPage (une seule fois par page). */
export function collectFaq(content: ContentStructure): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  for (const s of content) for (const c of s.columns) for (const b of c.blocks) {
    if (b.type === 'faq') for (const it of b.items) if (it.question && it.answer) out.push({ question: it.question, answer: it.answer });
  }
  return out;
}
