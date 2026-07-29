export interface FieldDef {
  key: string;
  label: string;
  rows?: number;
  hint?: string;
}

export const HOME_FIELDS: FieldDef[] = [
  { key: 'home_hero_line1',       label: 'Titre hero — ligne 1',            rows: 1, hint: 'Ex : "Éveillez votre"' },
  { key: 'home_hero_line2',       label: 'Titre hero — ligne 2 (italique)', rows: 1 },
  { key: 'home_hero_description', label: 'Description hero',                rows: 2 },
  { key: 'home_intro_quote',      label: 'Citation intro',                  rows: 2 },
  { key: 'home_intro_text',       label: 'Texte intro',                     rows: 3 },
  { key: 'home_immersive_quote',  label: 'Citation section immersive',      rows: 2 },
  { key: 'home_expertise_text1',  label: 'Expertise — paragraphe 1',        rows: 3 },
  { key: 'home_expertise_text2',  label: 'Expertise — paragraphe 2',        rows: 3 },
  { key: 'home_problem_intro',    label: 'Liste points — intro',            rows: 1 },
  { key: 'home_problem_item1',    label: 'Liste — item 1',                  rows: 1 },
  { key: 'home_problem_item2',    label: 'Liste — item 2',                  rows: 1 },
  { key: 'home_problem_item3',    label: 'Liste — item 3',                  rows: 1 },
  { key: 'home_problem_item4',    label: 'Liste — item 4',                  rows: 1 },
];

export const SEANCE_FIELDS: FieldDef[] = [
  { key: 'seance_hero_eyebrow',    label: 'Hero — étiquette',              rows: 1 },
  { key: 'seance_hero_title',      label: 'Hero — titre',                  rows: 1 },
  { key: 'seance_hero_subtitle',   label: 'Hero — sous-titre',             rows: 2 },
  { key: 'seance_content_title',   label: 'Section — titre',               rows: 1 },
  { key: 'seance_content_intro',   label: 'Section — texte intro',         rows: 3 },
  { key: 'seance_feature_1_title', label: 'Atout 1 — titre',               rows: 1 },
  { key: 'seance_feature_1_desc',  label: 'Atout 1 — description',         rows: 2 },
  { key: 'seance_feature_2_title', label: 'Atout 2 — titre',               rows: 1 },
  { key: 'seance_feature_2_desc',  label: 'Atout 2 — description',         rows: 2 },
  { key: 'seance_feature_3_title', label: 'Atout 3 — titre',               rows: 1 },
  { key: 'seance_feature_3_desc',  label: 'Atout 3 — description',         rows: 2 },
  { key: 'seance_explore_title',   label: 'Encart noir — titre',           rows: 1 },
  { key: 'seance_explore_1',       label: 'Encart noir — item 1',          rows: 1 },
  { key: 'seance_explore_2',       label: 'Encart noir — item 2',          rows: 1 },
  { key: 'seance_explore_3',       label: 'Encart noir — item 3',          rows: 1 },
  { key: 'seance_explore_4',       label: 'Encart noir — item 4',          rows: 1 },
  { key: 'seance_pricing_label',   label: 'Prix — étiquette',              rows: 1 },
  { key: 'seance_pricing_amount',  label: 'Prix — montant',                rows: 1, hint: 'Ex : 140 CHF' },
  { key: 'seance_pricing_unit',    label: 'Prix — unité',                  rows: 1, hint: 'Ex : / séance' },
  { key: 'seance_cta_text',        label: 'Bouton CTA',                    rows: 1 },
];

export const PROGRAMME_FIELDS: FieldDef[] = [
  { key: 'programme_hero_eyebrow',   label: 'Hero — étiquette',            rows: 1 },
  { key: 'programme_hero_title',     label: 'Hero — titre',                rows: 1 },
  { key: 'programme_hero_subtitle',  label: 'Hero — sous-titre',           rows: 2 },
  { key: 'programme_pillars_title',  label: 'Piliers — titre',             rows: 1 },
  { key: 'programme_pillars_intro',  label: 'Piliers — intro',             rows: 2 },
  { key: 'programme_pillar_1_title', label: 'Pilier 1 — titre',            rows: 1 },
  { key: 'programme_pillar_1_desc',  label: 'Pilier 1 — description',      rows: 3 },
  { key: 'programme_pillar_2_title', label: 'Pilier 2 — titre',            rows: 1 },
  { key: 'programme_pillar_2_desc',  label: 'Pilier 2 — description',      rows: 3 },
  { key: 'programme_pillar_3_title', label: 'Pilier 3 — titre',            rows: 1 },
  { key: 'programme_pillar_3_desc',  label: 'Pilier 3 — description',      rows: 3 },
  { key: 'programme_details_title',  label: 'Inclus — titre',              rows: 1 },
  { key: 'programme_detail_1',       label: 'Inclus — item 1',             rows: 1 },
  { key: 'programme_detail_2',       label: 'Inclus — item 2',             rows: 1 },
  { key: 'programme_detail_3',       label: 'Inclus — item 3',             rows: 1 },
  { key: 'programme_detail_4',       label: 'Inclus — item 4',             rows: 1 },
  { key: 'programme_details_quote',  label: 'Inclus — citation',           rows: 2 },
  { key: 'programme_cta_text',       label: 'Bouton CTA',                  rows: 1 },
];

export const ABOUT_FIELDS: FieldDef[] = [
  { key: 'about_hero_title',      label: 'Titre hero',                      rows: 1 },
  { key: 'about_hero_text1',      label: 'Description hero — ligne 1',      rows: 2 },
  { key: 'about_hero_text2',      label: 'Description hero — ligne 2',      rows: 2 },
  { key: 'about_immersive_quote', label: 'Citation section immersive',      rows: 2 },
  { key: 'about_histoire_p1',     label: 'Mon Histoire — paragraphe 1',     rows: 4 },
  { key: 'about_histoire_p2',     label: 'Mon Histoire — paragraphe 2',     rows: 4 },
  { key: 'about_histoire_quote',  label: 'Mon Histoire — citation',         rows: 2 },
  { key: 'about_histoire_p3',     label: 'Mon Histoire — paragraphe 3',     rows: 4 },
];
