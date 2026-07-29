-- Table des 4 profils de résultat du "Décodeur de Relations".
-- Les questions/catégories restent dans src/data/decodeur-quiz.json (statique) ;
-- seuls les textes de profil (édités par Matthieu depuis /admin/decodeur) vivent ici.
CREATE TABLE IF NOT EXISTS quiz_profiles (
  id         TEXT        PRIMARY KEY,
  tag        TEXT        NOT NULL,
  zone       TEXT        NOT NULL,
  min_score  INTEGER     NOT NULL,
  max_score  INTEGER     NOT NULL,
  title      TEXT        NOT NULL,
  tagline    TEXT        NOT NULL,
  body       TEXT        NOT NULL, -- paragraphes séparés par une ligne vide
  cta_type   TEXT        NOT NULL,
  cta_label  TEXT        NOT NULL,
  cta_href   TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_profiles ENABLE ROW LEVEL SECURITY;

-- Lecture publique (nécessaire pour afficher le résultat sur /decodeur)
CREATE POLICY "public_select" ON quiz_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture réservée à l'admin connecté (édition depuis /admin/decodeur)
CREATE POLICY "admin_update" ON quiz_profiles
  FOR UPDATE TO authenticated
  USING (true);

INSERT INTO quiz_profiles (id, tag, zone, min_score, max_score, title, tagline, body, cta_type, cta_label, cta_href)
VALUES
(
  'terrain-stable', 'profil-terrain-stable', 'vert', 0, 25,
  'Terrain Stable',
  'Votre relation tient debout toute seule, sans rapport de force.',
  E'Ce que vous décrivez ne correspond pas aux dynamiques de contrôle ou d''emprise que ce test cherche à repérer. Votre partenaire respecte vos limites, votre entourage, votre rythme. Les tensions que vous traversez ressemblent aux frictions normales de toute vie à deux — pas à un rapport de force.\n\nÇa ne veut pas dire que tout est parfait. Aucune relation ne l''est. Mais les mécanismes qui usent, isolent ou déstabilisent ne sont pas présents ici, ou trop marginalement pour représenter un risque réel.\n\nLe réflexe à garder : continuer à observer, sans basculer dans la paranoïa. Une relation saine se construit, elle ne se surveille pas. Si un jour la dynamique changeait, vous auriez déjà les repères pour le sentir venir.\n\nPour affiner ces repères, les articles du blog d''Au-delà des Chaînes donnent des clés concrètes pour distinguer un désaccord d''un signal d''alerte, sans jargon ni dramatisation.',
  'soft', 'Lire les articles pour affiner vos repères', '/blog'
),
(
  'signaux-faibles', 'profil-signaux-faibles', 'attention', 26, 50,
  'Signaux Faibles',
  'Rien d''alarmant, mais des points à ne pas laisser s''installer.',
  E'Le score n''est pas alarmant, mais il n''est pas nul non plus. Plusieurs éléments que vous avez cochés en "Souvent" ou "Presque toujours" correspondent à des débuts de dynamiques qui, livrées à elles-mêmes, ont davantage tendance à s''installer qu''à se résoudre.\n\nCe n''est pas un diagnostic. Un mot dur dit sous le coup de la fatigue, une jalousie ponctuelle, un désaccord mal géré — ça arrive dans toutes les relations. La question n''est pas l''incident isolé, c''est sa répétition et la direction qu''il prend.\n\nLe bon moment pour regarder ça en face, c''est maintenant — avant que ces signaux ne deviennent une habitude que vous cessez de remarquer. Prendre du recul et se donner une grille de lecture claire, ça change la trajectoire.\n\nLes contenus gratuits d''Au-delà des Chaînes vous aident à objectiver ce que vous ressentez encore confusément.',
  'soft', 'Comprendre ce qui se joue, sans attendre que ça s''aggrave', '/blog'
),
(
  'emprise-en-construction', 'profil-emprise-en-construction', 'alerte', 51, 75,
  'Emprise en Construction',
  'Un système s''installe — pas des incidents isolés.',
  E'Ce que vous décrivez forme un ensemble cohérent : contrôle, instabilité, ajustements permanents de votre part. Ce n''est plus une question d''incidents isolés — c''est un système qui s''installe, avec ses cycles, ses règles non-dites, et son coût sur vous.\n\nVous avez probablement déjà minimisé certains de ces éléments, en vous disant que "ce n''est pas si grave" ou que "ça va s''arranger". C''est exactement ce que ce type de dynamique produit : elle rend difficile de voir sa propre situation avec clarté, depuis l''intérieur.\n\nCe n''est pas irréversible. Mais plus le système se répète, plus il devient difficile à démonter seul(e), et plus le prix à payer — sur votre énergie, votre confiance, votre entourage — augmente.\n\nC''est le moment de poser un regard extérieur sur ce que vous vivez, formé à repérer précisément ces mécanismes. Un appel découverte, offert et sans engagement, permet de mettre les faits à plat.',
  'strong', 'Réserver l''appel découverte offert', '/arsenal-tactique'
),
(
  'sous-emprise-totale', 'profil-sous-emprise-totale', 'danger', 76, 105,
  'Sous Emprise Totale',
  'Ce que vous vivez a un nom, et ce n''est pas de votre faute.',
  E'Le tableau que vous décrivez est celui d''une emprise installée, avec la plupart de ses mécanismes actifs en même temps : contrôle, isolement, cycles de tension et de réconciliation, absence de réciprocité. Ce n''est pas une relation difficile. C''est un rapport de force que vous avez fini par intégrer comme une normalité.\n\nSi vous êtes arrivé(e) jusqu''ici dans le test, une partie de vous sait déjà que quelque chose ne va pas — même si une autre partie cherche encore des excuses ou des explications à ce que vous vivez. Les deux peuvent coexister. C''est le principe même de l''emprise.\n\nVous n''êtes pas responsable de ce qui vous arrive, et vous n''avez pas à gérer ça seul(e), ni à attendre que la situation empire encore avant de demander de l''aide.\n\nUn appel découverte, offert et confidentiel, permet de poser un point clair sur votre situation et sur les options concrètes qui s''offrent à vous — sans pression et sans jugement.',
  'strong', 'Réserver l''appel découverte offert — gratuit et confidentiel', '/arsenal-tactique'
)
ON CONFLICT (id) DO NOTHING;
