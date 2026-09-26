"use client";

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2, Quote, Undo2 } from 'lucide-react';

/** Texte riche (Tiptap). Sortie HTML, nettoyée au rendu par sanitizeHtml. */
export default function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } })],
    content: value || '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: 'pb-prose min-h-[140px] px-3 py-2.5 focus:outline-none text-[15px]' } },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="min-h-[140px] rounded-lg border border-stone-200 bg-stone-50" />;

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded ${active ? 'bg-sky-100 text-sky-700' : 'text-stone-600 hover:bg-stone-100'}`}>
      {icon}
    </button>
  );

  const applyLink = () => {
    const url = href.trim();
    if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white" style={{ ['--pb-fg' as string]: '#1c1917', ['--pb-fg-muted' as string]: '#44403c' }}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 px-1.5 py-1">
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={14} />, 'Gras')}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, 'Italique')}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={14} />, 'Intertitre')}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 size={14} />, 'Sous-intertitre')}
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={14} />, 'Liste à puces')}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={14} />, 'Liste numérotée')}
        {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={14} />, 'Citation')}
        {btn(editor.isActive('link'), () => { setHref(editor.getAttributes('link').href || ''); setLinkOpen((o) => !o); }, <Link2 size={14} />, 'Lien')}
        {btn(false, () => editor.chain().focus().undo().run(), <Undo2 size={14} />, 'Annuler la frappe')}
      </div>
      {linkOpen && (
        <div className="flex gap-1.5 border-b border-stone-100 p-1.5">
          <input autoFocus value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyLink())}
            placeholder="/contact ou https://…" className="min-w-0 flex-1 rounded border border-stone-200 px-2 py-1 text-xs" />
          <button type="button" onClick={applyLink} className="rounded bg-sky-600 px-2 text-xs font-semibold text-white">OK</button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
