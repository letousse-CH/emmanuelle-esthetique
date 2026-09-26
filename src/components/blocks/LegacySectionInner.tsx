"use client";

import { WIREFRAME_REGISTRY } from '../pagebuilder/wireframes.config';
import type { SectionType } from '../pagebuilder/wireframes.config';

export default function LegacySectionInner({ section }: { section: { type: string; data: Record<string, unknown> } }) {
  const entry = WIREFRAME_REGISTRY[section.type as SectionType];
  if (!entry) return null;
  const Component = entry.component;
  return <Component data={section.data} />;
}
