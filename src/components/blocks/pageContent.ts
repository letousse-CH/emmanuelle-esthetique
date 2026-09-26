import type { ContentStructure } from './types';
import { isContentStructure } from './types';
import { convertStudioSections, type StudioSection, type ConversionReport } from './convert';

export interface PageContentSource {
  content?: unknown;
  content_version?: number | null;
  sections?: unknown;
}

/**
 * Contenu à afficher pour une page : la version v2 si elle a été enregistrée
 * avec le nouvel éditeur, sinon la conversion à la volée des sections Studio.
 * La colonne `sections` n'est jamais modifiée par le nouvel éditeur : elle
 * reste lisible par l'ancien code (site en production) et sert de retour
 * arrière.
 */
export function resolvePageContent(page: PageContentSource | null | undefined, report?: ConversionReport): ContentStructure {
  if (!page) return [];
  if (page.content_version === 2 && isContentStructure(page.content)) return page.content;
  return convertStudioSections(Array.isArray(page.sections) ? (page.sections as StudioSection[]) : [], report);
}

export function isBlocksPage(page: PageContentSource | null | undefined): boolean {
  return !!page && page.content_version === 2 && isContentStructure(page.content);
}
