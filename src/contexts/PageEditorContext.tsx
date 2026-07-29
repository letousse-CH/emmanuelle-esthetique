import { createContext } from 'react';

export interface PageEditorContextType {
  updateField: (sectionIndex: number, fieldPath: string, value: any) => void;
  savePage: () => Promise<void>;
  isEditing: boolean;
}

export const PageEditorContext = createContext<PageEditorContextType | null>(null);
