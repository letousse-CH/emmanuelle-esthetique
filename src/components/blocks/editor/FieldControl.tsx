"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2, X, Copy } from 'lucide-react';
import type { FieldDef } from '../blockMeta';
import { uid } from '../types';
import VoiceInputButton from '../../pagebuilder/VoiceInputButton';
import RichTextEditor from './RichTextEditor';

const MediaPickerModal = dynamic(() => import('../../pagebuilder/MediaPickerModal'), { ssr: false });

const input = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100';

export function Label({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-[12px] font-semibold text-stone-700">{children}</span>
      {help && <p className="text-[11px] leading-snug text-stone-500">{help}</p>}
    </div>
  );
}

export function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-32 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2">
            <button type="button" onClick={() => setOpen(true)} className="rounded bg-white/90 px-2 py-1 text-xs font-semibold text-stone-800">Changer</button>
            <button type="button" onClick={() => onChange('')} className="rounded bg-white/90 px-2 py-1 text-xs font-semibold text-red-600">Retirer</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-xs font-semibold text-stone-500 hover:border-sky-400 hover:text-sky-700">
          <ImagePlus size={18} /> Choisir une image
        </button>
      )}
      <MediaPickerModal isOpen={open} onClose={() => setOpen(false)} onSelect={(url) => { onChange(url); setOpen(false); }} />
    </div>
  );
}

function StringList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-1.5">
      {list.map((item, i) => (
        <div key={i} className="flex gap-1">
          <input className={input} value={item} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-stone-400 hover:bg-red-50 hover:text-red-600"><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, ''])} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"><Plus size={13} /> Ajouter</button>
    </div>
  );
}

function ListField({ field, value, onChange, showStyle }: { field: FieldDef; value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void; showStyle: boolean }) {
  const list = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState<number | null>(list.length ? 0 : null);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpenIdx(j);
  };
  const title = (it: Record<string, unknown>, i: number) => {
    const t = [it.title, it.name, it.question, it.value, it.quote, it.alt].find((x) => typeof x === 'string' && x.trim());
    return t ? String(t).slice(0, 40) : `${field.itemLabel ?? 'Élément'} ${i + 1}`;
  };
  return (
    <div className="space-y-1.5">
      {list.map((it, i) => (
        <div key={(it.id as string) ?? i} className="rounded-lg border border-stone-200 bg-stone-50/60">
          <div className="flex items-center gap-1 px-2 py-1.5">
            <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-stone-700">
              {title(it, i)}
            </button>
            <button type="button" aria-label="Monter" onClick={() => move(i, -1)} className="rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700"><ChevronUp size={13} /></button>
            <button type="button" aria-label="Descendre" onClick={() => move(i, 1)} className="rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700"><ChevronDown size={13} /></button>
            <button type="button" aria-label="Dupliquer" onClick={() => { const next = [...list]; next.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(it)), id: uid() }); onChange(next); }} className="rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700"><Copy size={13} /></button>
            <button type="button" aria-label="Supprimer" onClick={() => onChange(list.filter((_, j) => j !== i))} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
          {openIdx === i && (
            <div className="space-y-3 border-t border-stone-200 bg-white p-2.5">
              {(field.itemFields ?? []).filter((f) => showStyle || !f.style).map((f) => (
                <FieldControl key={f.key} field={f} value={it[f.key]} showStyle={showStyle}
                  onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)))} />
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={() => { onChange([...list, field.newItem ? field.newItem() : { id: uid() }]); setOpenIdx(list.length); }}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:border-sky-400">
        <Plus size={13} /> Ajouter {field.itemLabel ? `: ${field.itemLabel.toLowerCase()}` : ''}
      </button>
    </div>
  );
}

export default function FieldControl({ field, value, onChange, showStyle }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; showStyle: boolean }) {
  const v = value;
  let control: React.ReactNode;
  switch (field.kind) {
    case 'text':
    case 'url':
      control = (
        <div className="flex gap-1">
          <input className={input} value={(v as string) ?? ''} placeholder={field.placeholder ?? (field.kind === 'url' ? '/contact ou https://…' : '')}
            onChange={(e) => onChange(e.target.value)} />
          {field.kind === 'text' && <VoiceInputButton onTranscript={(t) => onChange(`${(v as string) ?? ''}${(v as string) ? ' ' : ''}${t}`)} className="shrink-0" />}
        </div>
      );
      break;
    case 'textarea':
      control = (
        <div className="relative">
          <textarea className={`${input} min-h-[88px] resize-y pr-10`} value={(v as string) ?? ''} placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)} />
          <div className="absolute right-1.5 top-1.5"><VoiceInputButton onTranscript={(t) => onChange(`${(v as string) ?? ''}${(v as string) ? ' ' : ''}${t}`)} /></div>
        </div>
      );
      break;
    case 'richtext':
      control = <RichTextEditor value={(v as string) ?? ''} onChange={onChange} />;
      break;
    case 'image':
      control = <ImageField value={(v as string) ?? ''} onChange={onChange} />;
      break;
    case 'select':
      control = (
        <select className={input} value={v === undefined ? '' : String(v)}
          onChange={(e) => {
            const opt = field.options?.find((o) => String(o.value) === e.target.value);
            onChange(opt ? opt.value : e.target.value);
          }}>
          {v === undefined && <option value="">—</option>}
          {field.options?.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
      break;
    case 'toggle':
      return (
        <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-stone-700">{field.label}</span>
          <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={!!v} onChange={(e) => onChange(e.target.checked)} />
        </label>
      );
    case 'number':
      control = <input type="number" className={input} min={field.min} max={field.max} value={(v as number) ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
      break;
    case 'stringlist':
      control = <StringList value={v as string[]} onChange={onChange} />;
      break;
    case 'list':
      control = <ListField field={field} value={v as Record<string, unknown>[]} onChange={onChange} showStyle={showStyle} />;
      break;
  }
  return (
    <div>
      <Label help={field.help}>{field.label}</Label>
      {control}
    </div>
  );
}
