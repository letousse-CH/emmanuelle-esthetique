"use client";

import React, { useState, useEffect, useRef, FormEvent, useContext } from 'react';
import { supabase } from '../../services/supabase';
import { Check } from 'lucide-react';
import { PageEditorContext } from '../../contexts/PageEditorContext';
import { fetchAllSettings, settingsCache } from '../../hooks/useSettings';

/**
 * Convertit l'HTML d'un bloc contentEditable vers la valeur stockée : les sauts
 * de ligne redeviennent des `\n` (convention de stockage, voir le rendu plus
 * bas), les blocs que le navigateur insère au passage à la ligne sont aplatis,
 * et le balisage de mise en forme (gras, italique, liens) est conservé.
 */
function htmlToStoredValue(html: string): string {
  return html
    // `<div>` est l'artefact que les navigateurs insèrent à chaque retour à la
    // ligne dans un bloc contentEditable — on le ramène à un simple `\n`. Le
    // reste du balisage (gras, italique, liens, titres, listes) est conservé.
    .replace(/<div><br\s*\/?><\/div>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface EditableTextProps {
  settingKey?: string;
  value: string;
  as?: React.ElementType;
  className?: string;
  disableAnimation?: boolean; // Si true, le composant ignore les animations de Framer Motion s'il est admin
  sectionIndex?: number;
  fieldPath?: string;
}

export default function EditableText({
  settingKey = '',
  value,
  as: Component = 'span',
  className = '',
  disableAnimation = false,
  sectionIndex,
  fieldPath,
}: EditableTextProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [showSaved, setShowSaved] = useState(false);
  const contentEditableRef = useRef<HTMLElement>(null);
  
  const pageEditor = useContext(PageEditorContext);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (settingKey) {
      const cached = settingsCache.get(settingKey);
      if (cached !== undefined) {
        setCurrentValue(cached);
      } else {
        fetchAllSettings().then(() => {
          const dbVal = settingsCache.get(settingKey);
          if (dbVal !== undefined) {
            setCurrentValue(dbVal);
          }
        });
      }
    }
  }, [settingKey]);

  useEffect(() => {
    // Si la valeur externe change (ex: initial load complet)
    if (!isEditing) {
      if (settingKey) {
        const cached = settingsCache.get(settingKey);
        if (cached !== undefined) {
          setCurrentValue(cached);
          return;
        }
      }
      setCurrentValue(value);
    }
  }, [value, settingKey, isEditing]);

  const handleBlur = async (e: FormEvent<HTMLElement>) => {
    setIsEditing(false);
    // On relit l'innerHTML, pas l'innerText : la valeur est réaffichée via
    // dangerouslySetInnerHTML et peut contenir du gras, de l'italique ou des
    // liens posés depuis le panneau d'édition. `innerText` les effaçait à la
    // première modification en ligne.
    const newValue = htmlToStoredValue(e.currentTarget.innerHTML);
    if (newValue !== currentValue) {
      const oldValue = currentValue;
      setCurrentValue(newValue);
      
      if (pageEditor && sectionIndex !== undefined && fieldPath) {
        // Mode Dynamic Page
        pageEditor.updateField(sectionIndex, fieldPath, newValue);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
        pageEditor.savePage();
      } else {
        if (settingKey) {
          settingsCache.set(settingKey, newValue);
        }
        
        // Mode Settings global
        const { error } = await supabase
          .from('settings')
          .upsert({ key: settingKey, value: newValue }, { onConflict: 'key' });
        
        if (!error) {
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 2000);
        } else {
          console.error("Erreur lors de la sauvegarde du paramètre :", error);
          alert(`Erreur de sauvegarde : ${error.message}`);
          setCurrentValue(oldValue);
          if (settingKey) {
            settingsCache.set(settingKey, oldValue);
          }
          if (contentEditableRef.current) {
            contentEditableRef.current.innerHTML = oldValue.replace(/\n/g, '<br/>');
          }
        }
      }
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  /** Collage en texte brut : évite d'injecter le balisage de Word ou d'un site. */
  const handlePaste = (e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  /** Échap annule la modification en cours, Ctrl/⌘+Entrée valide. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = (currentValue || '').replace(/\n/g, '<br/>');
      }
      setIsEditing(false);
      contentEditableRef.current?.blur();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      contentEditableRef.current?.blur();
    }
  };

  /*
   * Deux modes d'édition seulement :
   *  — `settingKey` : réglage global, écrit dans la table `settings` ;
   *  — `fieldPath` + contexte page builder : écrit dans la section.
   * Un `fieldPath` sans contexte (aperçu de l'éditeur admin) rendait le texte
   * modifiable alors que l'enregistrement retombait sur la branche `settings`
   * avec une clé vide — la saisie était perdue et polluait la table.
   */
  const canEdit = (isAdmin && !!settingKey) || (!!fieldPath && !!pageEditor?.isEditing);

  if (!canEdit) {
    return <Component className={className} data-no-edit="true" dangerouslySetInnerHTML={{ __html: (currentValue || '').replace(/\n/g, '<br/>') }} />;
  }

  return (
    <span className={`relative inline-block ${className.includes('block') ? 'w-full block' : ''}`} data-no-edit="true">
      <Component
        ref={contentEditableRef as any}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onFocus={handleFocus}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        title={isEditing ? 'Échap pour annuler — ⌘/Ctrl + Entrée pour valider' : 'Cliquer pour modifier ce texte'}
        className={`outline-none transition-all duration-200 ${
          isEditing ? 'ring-2 ring-stone-400 bg-stone-100/80 rounded px-1 text-stone-900' : 'hover:outline-dashed hover:outline-1 hover:outline-stone-300 rounded cursor-text'
        } ${className}`}
        {...(!isEditing ? { dangerouslySetInnerHTML: { __html: (currentValue || '').replace(/\n/g, '<br/>') } } : {})}
        data-no-edit="true"
      />
      {showSaved && (
        <span className="absolute -top-6 right-0 bg-green-500 text-white text-[12px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-fadein z-50">
          <Check size={10} /> Enregistré
        </span>
      )}
    </span>
  );
}
