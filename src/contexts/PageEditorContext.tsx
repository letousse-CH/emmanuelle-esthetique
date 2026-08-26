"use client";

import { createContext } from 'react';

export interface PageEditorContextType {
  updateField: (sectionIndex: number, fieldPath: string, value: any) => void;
  savePage: () => Promise<void>;
  openSectionEditor?: (sectionIndex: number) => void;
  swapType?: (sectionIndex: number, newType: any) => void;
  moveSection?: (index: number, dir: -1 | 1) => void;
  moveToSection?: (fromIndex: number, toIndex: number) => void;
  removeSection?: (index: number) => void;
  duplicateSection?: (index: number) => void;
  addSection?: (type: any, atIndex?: number) => void;
  isEditing: boolean;
}

export const PageEditorContext = createContext<PageEditorContextType | null>(null);
