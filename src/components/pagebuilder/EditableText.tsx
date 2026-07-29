"use client";

import React, { useState, useEffect, useRef, FormEvent, useContext } from 'react';
import { supabase } from '../../services/supabase';
import { Check } from 'lucide-react';
import { PageEditorContext } from '../../contexts/PageEditorContext';
import { fetchAllSettings, settingsCache } from '../../hooks/useSettings';

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
    const newValue = e.currentTarget.innerText.trim();
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

  // En mode Dynamic Page, si isEditing est forcé par le contexte, on le gère.
  if ((!isAdmin && !pageEditor?.isEditing) || (!settingKey && !fieldPath)) {
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
        className={`outline-none transition-all duration-200 ${
          isEditing ? 'ring-2 ring-stone-400 bg-stone-100/80 rounded px-1 text-stone-900' : 'hover:outline-dashed hover:outline-1 hover:outline-stone-300 rounded'
        } ${className}`}
        dangerouslySetInnerHTML={{ __html: (currentValue || '').replace(/\n/g, '<br/>') }}
        data-no-edit="true"
      />
      {showSaved && (
        <span className="absolute -top-6 right-0 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-fadein z-50">
          <Check size={10} /> Enregistré
        </span>
      )}
    </span>
  );
}
