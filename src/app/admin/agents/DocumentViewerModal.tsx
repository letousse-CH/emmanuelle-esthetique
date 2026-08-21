'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Sparkles, Globe, BookOpen, X, Save, Edit3, Check } from 'lucide-react';
import type { AgentDocument } from '../../../types/agents';
import { Badge, Button } from '../../../components/admin/ui';
import { saveAgentDocument } from '../../../services/agents';

interface DocumentViewerModalProps {
  doc: AgentDocument | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DocumentViewerModal({ doc, onClose, onSaved }: DocumentViewerModalProps) {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (doc) {
      setContent(doc.content || '');
      setIsEditing(false);
      setSavedSuccess(false);
    }
  }, [doc]);

  if (!doc) return null;

  const isBrief = doc.source_ref === 'brief-editorial' || doc.source_type === 'brief';

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    const res = await saveAgentDocument({
      ...doc,
      content,
    });
    setSaving(false);
    if (res.success) {
      setSavedSuccess(true);
      setIsEditing(false);
      if (onSaved) onSaved();
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  }

  function getBadge(d: AgentDocument) {
    if (isBrief) {
      return (
        <Badge tone="warning">
          <Sparkles size={11} className="mr-1 inline" /> Brief Éditorial
        </Badge>
      );
    }
    if (d.source_type === 'page') {
      return (
        <Badge tone="info">
          <Globe size={11} className="mr-1 inline" /> Page du site
        </Badge>
      );
    }
    if (d.source_type === 'article') {
      return (
        <Badge tone="neutral">
          <BookOpen size={11} className="mr-1 inline" /> Article de blog
        </Badge>
      );
    }
    return <Badge>{d.source_type}</Badge>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold text-stone-900">{doc.title}</h2>
                {getBadge(doc)}
              </div>
              <p className="text-[12px] text-stone-500 truncate">
                {doc.source_ref ? `Référence : ${doc.source_ref}` : 'Savoir complémentaire'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-xl p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action bar for switching mode */}
        <div className="flex items-center justify-between bg-stone-100/70 px-6 py-2 border-b border-stone-200/60 text-xs">
          <span className="font-semibold text-stone-700">
            {isEditing ? '✏️ Mode Édition : vous pouvez modifier ou ajouter du texte' : '👁️ Mode Lecture du savoir retenu'}
          </span>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Edit3 size={13} /> Éditer / Compléter le texte
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-stone-500 hover:text-stone-700 font-medium cursor-pointer"
              >
                Annuler l'édition
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {savedSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-900">
              <Check size={16} className="text-emerald-600" /> Modifications enregistrées dans la mémoire du Super Agent !
            </div>
          )}

          {isEditing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-stone-300 bg-white p-4 font-mono text-[13px] leading-relaxed text-stone-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              placeholder="Écrivez ou modifiez le texte retenu par l'agent..."
            />
          ) : (
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 font-mono text-[13px] leading-relaxed text-stone-800 whitespace-pre-wrap selection:bg-amber-100 shadow-inner">
              {content || 'Aucun texte renseigné pour le moment.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-6 py-3.5">
          <p className="text-[12px] text-stone-500 font-medium">
            {content.length.toLocaleString()} caractères mémorisés dans table Supabase agent_documents.
          </p>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
              >
                <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer le texte retenu'}
              </button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Fermer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
