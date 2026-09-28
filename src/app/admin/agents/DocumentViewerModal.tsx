'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText, X, Save, Edit3,
} from 'lucide-react';
import type { AgentDocument } from '../../../types/agents';
import { Badge, Button, FormMessage } from '../../../components/admin/ui';
import { updateAgentDocument } from '../../../services/agents';

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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setContent(doc.content || '');
      setIsEditing(false);
      setSavedSuccess(false);
      setSaveError(null);
    }
  }, [doc]);

  // Échap ferme la fenêtre, sauf pendant un enregistrement.
  useEffect(() => {
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, saving, onClose]);

  if (!doc) return null;

  const isBrief = doc.source_ref === 'brief-editorial' || doc.source_type === 'brief';
  // Pages, articles et brief sont relus depuis le site à chaque réindexation :
  // une retouche ici serait effacée à la prochaine ouverture de l'écran.
  const isEditable = doc.source_type === 'texte' && !isBrief;

  async function handleSave() {
    if (!doc) return;
    if (!content.trim()) {
      setSaveError('Le texte ne peut pas être vide. Supprimez plutôt le document depuis la liste.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await updateAgentDocument(doc.id, content.trim());
    setSaving(false);
    if (!res.success) {
      setSaveError(`Modification non enregistrée : ${res.error ?? 'erreur inconnue'}. Réessayez.`);
      return;
    }
    setSavedSuccess(true);
    setIsEditing(false);
    if (onSaved) onSaved();
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  function getBadge(d: AgentDocument) {
    if (isBrief) {
      return (
<Badge>Brief éditorial</Badge>
      );
    }
    if (d.source_type === 'page') {
      return (
<Badge>Page du site</Badge>
      );
    }
    if (d.source_type === 'article') {
      return (
<Badge>Article de blog</Badge>
      );
    }
    return <Badge tone="info">Texte ajouté</Badge>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div role="dialog" aria-modal="true" aria-label={doc.title} className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/80 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent font-semibold border border-accent/20">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-stone-900">{doc.title}</h2>
                {getBadge(doc)}
              </div>
              <p className="text-[13px] text-stone-600 truncate">
                {doc.updated_at ? `Mis à jour le ${new Date(doc.updated_at).toLocaleString('fr-CH')}` : 'Texte ajouté à la main'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer"
            className="rounded-xl p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-700 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action bar for switching mode */}
        <div className="flex items-center justify-between bg-stone-100/70 px-6 py-2 border-b border-stone-200">
          <span className="text-[13px] font-medium text-stone-700">
            {isEditing
              ? 'Modifiez le texte, puis enregistrez.'
              : isEditable
                ? "Texte que l'agent utilise pour répondre."
                : isBrief
                  ? 'Relu automatiquement depuis le Brief éditorial. Pour le changer, modifiez le brief.'
                  : 'Relu automatiquement depuis le site. Pour le changer, modifiez la page ou l’article.'}
          </span>
          <div className="flex items-center gap-2">
            {!isEditable ? null : !isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline cursor-pointer"
              >
                <Edit3 size={13} /> Modifier le texte
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setIsEditing(false); setContent(doc.content || ''); setSaveError(null); }}
                className="text-[13px] font-medium text-stone-700 hover:text-stone-900 cursor-pointer"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {savedSuccess && <FormMessage message={{ type: 'success', text: 'Modification enregistrée.' }} />}
          {saveError && <FormMessage message={{ type: 'error', text: saveError }} />}

          {isEditing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-stone-300 bg-white p-4 text-[14px] leading-relaxed text-stone-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder="Écrivez ou modifiez le texte retenu par l'agent..."
            />
          ) : (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-[14px] leading-relaxed text-stone-800 whitespace-pre-wrap">
              {content || 'Aucun texte renseigné pour le moment.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-6 py-3.5">
          <p className="text-[13px] text-stone-600">
            {content.length.toLocaleString('fr-CH')} caractères
          </p>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <Button variant="primary" icon={Save} loading={saving} onClick={() => void handleSave()}>
                Enregistrer
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onClose}>
                Fermer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
