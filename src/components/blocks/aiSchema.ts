/** Description compacte du format v2, envoyée au modèle (générée depuis blockMeta). */
import { BLOCK_META, type FieldDef } from './blockMeta';

function fieldSig(f: FieldDef): string {
  switch (f.kind) {
    case 'select': return `${f.key}: ${f.options?.map((o) => JSON.stringify(o.value)).join('|')}`;
    case 'toggle': return `${f.key}?: boolean`;
    case 'number': return `${f.key}?: number`;
    case 'color': return `${f.key}?: "#RRGGBB ou chaîne vide"`;
    case 'stringlist': return `${f.key}: string[]`;
    case 'richtext': return `${f.key}: "<p>HTML simple : p, strong, em, a, ul, ol, li, h2, h3</p>"`;
    case 'image': return `${f.key}: "URL d'image ou chaîne vide"`;
    case 'list': return `${f.key}: [{ ${(f.itemFields ?? []).map(fieldSig).join(', ')} }]`;
    default: return `${f.key}: string`;
  }
}

export function blocksSchemaForAi(): string {
  const blocks = Object.values(BLOCK_META)
    .filter((m) => !m.hidden)
    .map((m) => `- ${m.type} (${m.label} — ${m.description}) { ${m.fields.map(fieldSig).join(', ')} }`)
    .join('\n');
  return `Une page est un tableau de sections :
{ "layout": "1-col"|"2-col-equal"|"2-col-40-60"|"2-col-60-40"|"3-col-equal"|"full-width",
  "paddingY": "none"|"small"|"medium"|"large",
  "innerPad"?: "none"|"medium"|"large",
  "width"?: "narrow"|"contained"|"wide"|"full",
  "background": "transparent"|"surface"|"warm"|"warm-strong"|"accent"|"dark",
  "bgImage"?: { "url": string, "opacity": number },
  "minHeight"?: "auto"|"half"|"screen",
  "alignItems"?: "top"|"center"|"bottom",
  "animation"?: "none"|"fade"|"rise",
  "flush"?: boolean, "reverseOnMobile"?: boolean,
  "columns": [ { "blocks": [ { "type": "...", ...champs } ] } ]  // autant de colonnes que le layout en demande
}
Fonds : transparent = blanc, surface = gris écume, warm = crème, warm-strong = sable, accent = lagon (texte blanc), dark = bleu nuit (texte blanc).

Blocs disponibles :
${blocks}

Blocs de type "legacy_section" : à conserver tels quels s'ils sont présents, sauf demande contraire.`;
}
