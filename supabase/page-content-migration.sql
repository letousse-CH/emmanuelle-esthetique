-- Textes éditables des pages Accueil et À Propos
-- À exécuter dans l'éditeur SQL Supabase (une seule fois)

INSERT INTO settings (key, value) VALUES
  -- Page d'accueil
  ('home_hero_line1',       'Éveillez votre'),
  ('home_hero_line2',       'présence intérieure'),
  ('home_hero_description', 'Un voyage au cœur de soi : traverser ses ombres pour laisser rayonner sa lumière.'),
  ('home_intro_quote',      '"La spiritualité n''est pas une fuite, c''est une rencontre."'),
  ('home_intro_text',       'Accompagner vos ombres n''est pas seulement une question d''apaisement, c''est une marche sacrée vers la connaissance de soi et l''acceptation de votre lumière.'),
  ('home_immersive_quote',  '"Chaque ombre que vous traversez révèle une lumière que vous ne saviez pas posséder."'),
  ('home_expertise_text1',  'Mon rôle est d''être le compagnon de votre voyage intérieur, là où la connaissance de soi devient un acte de libération et de sincérité totale.'),
  ('home_expertise_text2',  'Spécialisé dans l''analyse des rêves, je vous aide à déchiffrer les messages de votre âme pour traverser vos ombres et accepter enfin votre lumière originelle.'),
  ('home_problem_intro',    'Je vous aide à :'),
  ('home_problem_item1',    'Stress et anxiété envahissants'),
  ('home_problem_item2',    'Difficultés à surmonter un deuil'),
  ('home_problem_item3',    'Besoin de redonner du sens à son quotidien'),
  ('home_problem_item4',    'Sensation d''être bloqué dans sa vie'),
  -- Page À Propos
  ('about_hero_title',      'Je vous aide à vous libérer.'),
  ('about_hero_text1',      'De l''épuisement mental et des angoisses, grâce au Rêve Éveillé Libre — une méthode d''hypnose douce par l''imaginaire.'),
  ('about_hero_text2',      'Formé à l''École du Rêve Éveillé Libre de Paris, j''utilise la neuro-relaxation pour réactiver votre propre capacité d''auto-guérison.'),
  ('about_immersive_quote', '"Les ressources pour aller mieux sont déjà en vous. Mon rôle est simplement de vous aider à y accéder."'),
  ('about_histoire_p1',     'Passionné par la complexité humaine, j''ai consacré ma carrière à comprendre comment nous nous brisons, mais surtout comment nous nous réparons. À travers l''analyse des rêves et l''écoute de l''inconscient, j''ai développé une certitude : la résilience n''est pas un don, c''est une construction.'),
  ('about_histoire_p2',     'J''ai créé Semeur d''Eveil pour offrir un espace différent. Un lieu où l''on ne se contente pas de parler de ses problèmes, mais où l''on bâtit activement les structures intérieures nécessaires pour vivre une vie alignée, souveraine et connectée à son essence.'),
  ('about_histoire_quote',  'Je ne suis pas là pour vous porter, mais pour vous apprendre à porter votre propre monde avec élégance et force.'),
  ('about_histoire_p3',     'Mon approche mélange la profondeur de l''analyse des rêves, la clarté de la neuro-relaxation et la dimension sacrée de la connaissance de soi. C''est cette alliance qui permet de traverser ses ombres pour enfin accepter sa propre lumière.')
ON CONFLICT (key) DO NOTHING;
