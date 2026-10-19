// Abréviation officielle d'un canton suisse (« Vaud » → « VD »), pour écrire
// l'adresse comme partout ailleurs sur le site : « 1607 Palézieux (VD) ».
// Une région inconnue (autre pays, faute de frappe) est rendue telle quelle.
const CANTONS: Record<string, string> = {
  'argovie': 'AG', 'appenzell rhodes-intérieures': 'AI', 'appenzell rhodes-extérieures': 'AR',
  'berne': 'BE', 'bâle-campagne': 'BL', 'bâle-ville': 'BS', 'fribourg': 'FR', 'genève': 'GE',
  'glaris': 'GL', 'grisons': 'GR', 'jura': 'JU', 'lucerne': 'LU', 'neuchâtel': 'NE',
  'nidwald': 'NW', 'obwald': 'OW', 'saint-gall': 'SG', 'schaffhouse': 'SH', 'soleure': 'SO',
  'schwytz': 'SZ', 'thurgovie': 'TG', 'tessin': 'TI', 'uri': 'UR', 'vaud': 'VD',
  'valais': 'VS', 'zoug': 'ZG', 'zurich': 'ZH',
};

export function cantonCode(region: string | undefined): string {
  const v = (region || '').trim();
  return CANTONS[v.toLowerCase()] || v;
}

/** « 1607 Palézieux (VD) » — code postal, localité, canton entre parenthèses. */
export function localityLine(postal?: string, city?: string, region?: string): string {
  const canton = cantonCode(region);
  return [[postal, city].filter(Boolean).join(' '), canton && `(${canton})`].filter(Boolean).join(' ');
}
