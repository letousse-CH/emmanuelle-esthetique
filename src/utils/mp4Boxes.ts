/**
 * Retouche d'un fichier MP4 avant envoi à Instagram.
 *
 * Instagram exige « no edit lists » pour les Reels. L'encodeur en pose une
 * (`edts`/`elst`) quand une piste ne démarre pas exactement à zéro — c'est
 * souvent le cas de l'audio AAC, qui commence par quelques millisecondes
 * d'amorce. On renomme ces boîtes `free` : les lecteurs les ignorent, et
 * comme la taille ne change pas, aucune position dans le fichier ne bouge.
 * L'amorce (quelques ms de silence) devient simplement audible : rien.
 *
 * Pur, sans dépendance au navigateur : testé dans scripts/test-social.ts.
 */

const CONTAINERS = new Set(['moov', 'trak']);

/** Neutralise les listes d'éditions. Renvoie le nombre de boîtes renommées. */
export function neutralizeEditLists(buf: Uint8Array): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let count = 0;

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = view.getUint32(pos);
      let header = 8;
      if (size === 1) {
        if (pos + 16 > end) return;
        size = Number(view.getBigUint64(pos + 8));
        header = 16;
      } else if (size === 0) {
        size = end - pos;
      }
      if (size < header || pos + size > end) return;
      const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
      if (type === 'edts') {
        buf.set([0x66, 0x72, 0x65, 0x65], pos + 4); // « free »
        count++;
      } else if (CONTAINERS.has(type)) {
        walk(pos + header, pos + size);
      }
      pos += size;
    }
  };

  walk(0, buf.length);
  return count;
}

/** Vrai si le fichier contient encore une liste d'éditions (contrôle). */
export function hasEditList(buf: Uint8Array): boolean {
  const copy = buf.slice();
  return neutralizeEditLists(copy) > 0;
}
