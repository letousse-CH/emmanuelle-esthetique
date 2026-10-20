"use client";

import React from 'react';
import { Share2 } from 'lucide-react';
import { LinkButton } from './ui';
import { useModuleFlags } from '../../hooks/useModuleFlags';

/**
 * Raccourci « Créer une publication » depuis un article : ouvre l'écran
 * Réseaux sociaux avec l'article comme sujet, et l'IA rédige aussitôt.
 * La rédaction, le visuel et l'envoi vivent là-bas, et nulle part ailleurs.
 */
export default function SocialContentGenerator({ articleId, published }: { articleId?: string; published: boolean }) {
  const flags = useModuleFlags();
  if (!flags.social) return null;

  return (
    <div className="rounded-xl bg-stone-50 p-6">
      <p className="text-[15px] font-semibold text-stone-900">Partager sur Instagram et Facebook</p>
      <p className="mt-1 text-[14px] leading-relaxed text-stone-600">
        {published && articleId
          ? 'L’IA tire de cet article une publication (visuel aux couleurs du site et légende), que vous relisez avant de la publier ou de la programmer.'
          : 'Publiez d’abord l’article : la publication renverra vers lui.'}
      </p>
      {published && articleId && (
        <LinkButton href={`/admin/social?article=${encodeURIComponent(articleId)}`} variant="primary" icon={Share2} className="mt-4">
          Créer une publication
        </LinkButton>
      )}
    </div>
  );
}
