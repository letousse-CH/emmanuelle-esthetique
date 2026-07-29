import React from 'react';
import { WIREFRAME_REGISTRY } from './wireframes.config';
import type { PageSection, SectionType } from './wireframes.config';

interface Props {
  sections: PageSection[];
  onUnknownType?: (type: string) => void;
}

function UnknownSection({ type }: { type: string }) {
  return (
    <div className="py-16 px-6 bg-red-50 border-l-4 border-red-400 text-red-700 text-center">
      <p className="font-bold text-sm uppercase tracking-widest mb-1">Section inconnue</p>
      <p className="font-mono text-sm">"{type}" n'existe pas dans le registre de wireframes.</p>
    </div>
  );
}

export default function DynamicPageRenderer({ sections, onUnknownType }: Props) {
  if (!sections || sections.length === 0) {
    return (
      <div className="py-32 text-center text-stone-400">
        <p className="font-serif text-2xl font-light">Aucune section à afficher.</p>
      </div>
    );
  }

  return (
    <>
      {sections.map((section, i) => {
        const entry = WIREFRAME_REGISTRY[section.type as SectionType];

        if (!entry) {
          onUnknownType?.(section.type);
          return <UnknownSection key={i} type={section.type} />;
        }

        const Component = entry.component;
        return <Component key={i} data={section.data} sectionIndex={i} />;
      })}
    </>
  );
}
