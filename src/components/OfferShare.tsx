"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Link2, Mail, Share2, X } from 'lucide-react';
import type { PublicOffer } from '../types/offers';
import { formatOfferPeriod, formatOfferPrice, offerPagePath, offerShareMessage } from '../types/offers';

/**
 * Bouton « Partager » d'une offre du moment et sa fenêtre : message prêt à
 * l'emploi (modifiable), WhatsApp, Facebook, e-mail, lien, partage natif du
 * téléphone AVEC le visuel en pièce jointe, et téléchargement du visuel pour
 * Instagram. Même composant pour les clientes (site) et pour l'institut (admin).
 *
 * Le lien partagé est la page de l'offre (`/offre/<id>`) : c'est elle qui
 * fournit l'aperçu (visuel, titre, prix) que WhatsApp et Facebook affichent.
 */
export default function OfferShareButton({ offer, brand, className, label = 'Partager' }: {
  offer: PublicOffer;
  brand?: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Share2 size={17} strokeWidth={1.9} aria-hidden />
        <span>{label}</span>
      </button>
      {open && (
        <ShareDialog
          offer={offer}
          brand={brand}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4a22 22 0 0 0-2.5-.1c-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3Z" />
    </svg>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Navigateurs sans API presse-papiers (ou page non sécurisée) : repli historique.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function ShareDialog({ offer, brand, onClose }: { offer: PublicOffer; brand?: string | null; onClose: () => void }) {
  const titleId = useId();
  const [url] = useState(() => `${window.location.origin}${offerPagePath(offer.id)}`);
  const [message, setMessage] = useState(() => offerShareMessage(offer, url, brand));
  const [toast, setToast] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [canNative] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // Le visuel est préparé dès l'ouverture : sur iPhone, le partage doit partir
  // directement du clic, sans téléchargement intermédiaire.
  useEffect(() => {
    if (!canNative || !offer.image_url || typeof navigator.canShare !== 'function') return;
    let cancelled = false;
    fetch(`/api/offers/${offer.id}/visuel`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
        const f = new File([blob], `offre-du-moment.${ext}`, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) setFile(f);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canNative, offer.id, offer.image_url]);

  // Échap pour fermer, défilement de la page bloqué, focus dans la fenêtre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prev;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [onClose]);

  const shareNative = async () => {
    try {
      if (file) await navigator.share({ files: [file], title: offer.titre, text: message });
      else await navigator.share({ title: offer.titre, text: message });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') say('Le partage n’a pas abouti. Essayez WhatsApp ou « Copier le lien ».');
    }
  };

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  // Facebook ne reprend que le lien (aperçu : visuel + titre) : le texte est copié pour être collé.
  const facebook = async () => {
    const ok = await copyText(message);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,width=640,height=640');
    say(ok ? 'Message copié : collez-le dans votre publication Facebook.' : 'Facebook s’ouvre avec l’aperçu de l’offre.');
  };

  const email = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(offer.titre)}&body=${encodeURIComponent(message)}`;
  };

  const copy = async (what: 'lien' | 'message') => {
    const ok = await copyText(what === 'lien' ? url : message);
    say(ok ? (what === 'lien' ? 'Lien copié.' : 'Message copié.') : 'La copie a échoué : sélectionnez le texte à la main.');
  };

  const prix = offer.prix_normal_chf != null && offer.prix_normal_chf > offer.prix_chf
    ? `${formatOfferPrice(offer.prix_chf)} au lieu de ${formatOfferPrice(offer.prix_normal_chf)}`
    : formatOfferPrice(offer.prix_chf);

  const tile = 'flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-[14px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a8f99] focus-visible:ring-offset-2';

  const dialog = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-[#0b1d2a]/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 font-sans text-[#22252A] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-[#5F676E] hover:bg-[#F6F8F9] cursor-pointer">
          <X size={20} aria-hidden />
        </button>

        <div id={titleId} className="pr-10 font-serif text-[22px] font-semibold leading-tight text-[#12283A]">Partager l’offre</div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E7EBEE] bg-[#FAF7F2] p-2.5">
          {offer.image_url && (
            // Aperçu du visuel tel qu'il apparaîtra dans le message.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.image_url} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[#12283A]">{offer.titre}</div>
            <div className="text-[13px] text-[#5F676E]">{prix}</div>
            <div className="text-[12.5px] text-[#5F676E]">Valable {formatOfferPeriod(offer.date_debut, offer.date_fin)}</div>
          </div>
        </div>

        {canNative && (
          <button type="button" data-autofocus onClick={shareNative} className={`${tile} mt-4 w-full border-[#12283A] bg-[#12283A] text-white hover:bg-[#1d3b52]`}>
            <Share2 size={18} aria-hidden />
            {file ? 'Partager avec le visuel…' : 'Partager…'}
          </button>
        )}
        {canNative && (
          <div className="mt-1.5 text-center text-[12.5px] text-[#5F676E]">Instagram, Messenger, SMS… selon les applications du téléphone.</div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" data-autofocus={canNative ? undefined : true} onClick={whatsapp} className={`${tile} border-[#25D366]/40 bg-[#25D366]/10 text-[#0f6b3a] hover:bg-[#25D366]/20`}>
            <WhatsAppIcon /> WhatsApp
          </button>
          <button type="button" onClick={facebook} className={`${tile} border-[#1877F2]/35 bg-[#1877F2]/10 text-[#0d4fa8] hover:bg-[#1877F2]/20`}>
            <FacebookIcon /> Facebook
          </button>
          <button type="button" onClick={email} className={`${tile} border-[#E7EBEE] bg-white text-[#12283A] hover:bg-[#F6F8F9]`}>
            <Mail size={18} aria-hidden /> E-mail
          </button>
          <button type="button" onClick={() => copy('lien')} className={`${tile} border-[#E7EBEE] bg-white text-[#12283A] hover:bg-[#F6F8F9]`}>
            <Link2 size={18} aria-hidden /> Copier le lien
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[14px] font-semibold text-[#12283A]">Message</span>
            <span className="text-[12.5px] text-[#5F676E]">modifiable avant l’envoi</span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            className="w-full resize-y rounded-lg border border-[#E7EBEE] bg-white px-3 py-2.5 text-[15px] leading-relaxed text-[#22252A] focus:border-[#3a8f99] focus:outline-none focus:ring-2 focus:ring-[#60B9C2]/30"
          />
        </label>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => copy('message')} className={`${tile} border-[#E7EBEE] bg-white text-[#12283A] hover:bg-[#F6F8F9]`}>
            <Copy size={17} aria-hidden /> Copier le message
          </button>
          {offer.image_url ? (
            <a href={`/api/offers/${offer.id}/visuel?download=1`} download className={`${tile} border-[#E7EBEE] bg-white text-[#12283A] hover:bg-[#F6F8F9] no-underline`}>
              <Download size={17} aria-hidden /> Télécharger le visuel
            </a>
          ) : <span />}
        </div>

        <div role="status" aria-live="polite" className={`mt-3 flex min-h-6 items-center justify-center gap-1.5 text-[13.5px] font-medium text-[#0f6b3a] transition-opacity ${toast ? 'opacity-100' : 'opacity-0'}`}>
          {toast && <Check size={15} aria-hidden />}
          {toast}
        </div>
      </div>
    </div>
  );

  // Dans la portée de la charte du site quand elle existe (polices), sinon dans <body> (admin).
  const host = (document.querySelector('[data-site-theme]') as HTMLElement | null) ?? document.body;
  return createPortal(dialog, host);
}
