"use client";

/**
 * Rend une section de l'ancien constructeur (Studio) telle quelle. Chargée à
 * la demande : une page sans section héritée ne télécharge pas le registre
 * Studio.
 */
import dynamic from 'next/dynamic';

const Inner = dynamic(() => import('./LegacySectionInner'), { ssr: true, loading: () => null });

export default function LegacySection({ section }: { section: { type: string; data: Record<string, unknown> } }) {
  return <Inner section={section} />;
}
