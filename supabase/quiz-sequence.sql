-- Séquence email automatique envoyée après réception du profil au "Décodeur de
-- Relations". Contenu éditable depuis /admin/decodeur (onglet "Séquence email").
-- L'envoi effectif est fait par le cron src/app/api/cron/quiz-sequence (service
-- role key) — aucune policy publique n'est nécessaire ici.

CREATE TABLE IF NOT EXISTS quiz_sequence_emails (
  step_order   INTEGER     PRIMARY KEY,
  delay_hours  INTEGER     NOT NULL, -- délai après quiz_completed_at avant envoi
  subject      TEXT        NOT NULL,
  body         TEXT        NOT NULL, -- texte brut, paragraphes séparés par une ligne vide
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_sequence_emails ENABLE ROW LEVEL SECURITY;

-- Lecture/écriture réservées à l'admin connecté (édition depuis /admin/decodeur).
-- Pas de policy anon : le cron utilise la service role key, qui contourne la RLS.
CREATE POLICY "admin_select" ON quiz_sequence_emails
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_update" ON quiz_sequence_emails
  FOR UPDATE TO authenticated
  USING (true);

-- Journal d'envoi : empêche de renvoyer deux fois le même email au même
-- inscrit. Écrit uniquement par le cron (service role) — aucune policy anon.
CREATE TABLE IF NOT EXISTS quiz_sequence_log (
  subscriber_email TEXT        NOT NULL,
  step_order       INTEGER     NOT NULL,
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (subscriber_email, step_order)
);

ALTER TABLE quiz_sequence_log ENABLE ROW LEVEL SECURITY;

INSERT INTO quiz_sequence_emails (step_order, delay_hours, subject, body)
VALUES
(
  1, 0,
  'Votre profil au Décodeur de Relations',
  E'Bonjour,\n\nVous venez de terminer Le Décodeur de Relations. Voici votre profil complet : {{resultat_url}}\n\nCe résultat n''est pas un jugement sur votre relation — c''est un point de départ pour y voir plus clair. Gardez-le de côté : c''est une photo à un instant T qui vous servira de repère dans les semaines qui viennent.\n\nJe m''appelle Matthieu Le Tousse. Depuis plus de 20 ans, j''observe ces mécanismes de près — d''abord comme témoin, puis pendant 6 ans en cabinet, et aujourd''hui à travers l''accompagnement de personnes qui sortent d''une emprise relationnelle.\n\nUne chose que je constate à chaque fois : ce n''est jamais l''ampleur du problème qui pousse quelqu''un à agir. C''est le moment où le doute devient trop lourd à porter seul.\n\nDans les prochains jours, je vous enverrai quelques emails pour vous aider à poser des mots sur ce que vous vivez. Pas de recette miracle, pas de promesse en l''air — juste ce que des années de terrain m''ont appris.\n\nÀ très vite,\nMatthieu'
),
(
  2, 24,
  'Le mécanisme que presque personne ne voit venir',
  E'Bonjour,\n\nIl y a un mécanisme qui revient dans presque toutes les histoires que j''entends en consultation : l''inversion.\n\nUne dispute éclate. Les torts sont clairs, presque évidents. Et pourtant, quelques heures plus tard, c''est vous qui vous excusez.\n\nPas parce que vous avez changé d''avis sur les faits. Mais parce que l''autre a suffisamment insisté, nié, réécrit la scène — jusqu''à ce que porter le doute devienne plus fatigant que de céder.\n\nCe n''est pas de la mauvaise foi ordinaire. C''est une stratégie, consciente ou non, qui fonctionne à un seul endroit : votre besoin d''avoir la paix.\n\nSi une ou plusieurs questions du test portaient sur ce point, ce n''est pas un hasard. C''est l''un des signaux les plus fiables d''un rapport de force déséquilibré.\n\nLa bonne nouvelle : une fois que vous savez reconnaître ce mécanisme au moment où il se produit, il perd une grande partie de son effet.\n\nÀ dans quelques jours,\nMatthieu'
),
(
  3, 72,
  'Ce que j''ai vu revenir, année après année',
  E'Bonjour,\n\nIl y a une phrase que j''entends depuis des années, presque mot pour mot, en cabinet ou en consultation : « Je ne me reconnais plus. »\n\nCe ne sont pas des personnes fragiles au départ. Ce sont des personnes qui, petit à petit, ont arrêté de voir leurs amis aussi souvent, ont cessé certaines activités, ont pris l''habitude de tout vérifier avant de dire ou de faire quoi que ce soit.\n\nRien de tout ça n''arrive d''un coup. C''est un glissement — un rendez-vous annulé ici, une remarque qui décourage là, une dispute qui rend la sortie du week-end « pas si importante que ça, finalement ».\n\nLe problème, c''est que ce glissement est presque invisible depuis l''intérieur. On ne voit pas midi bouger sur l''horloge, seulement l''heure qu''il fait.\n\nSi votre score sur les catégories Isolement ou Contrôle vous a semblé plus élevé que prévu, ce n''est pas anodin. C''est souvent le signal le plus tôt visible — bien avant les autres.\n\nÀ bientôt,\nMatthieu'
),
(
  4, 168,
  '« Ce n''est peut-être pas si grave »',
  E'Bonjour,\n\nIl y a une phrase que je récupère presque à chaque premier appel : « Je ne suis pas sûr(e) que ma situation soit assez grave pour en parler. »\n\nC''est souvent la dernière barrière avant de demander de l''aide. Et c''est aussi, la plupart du temps, un effet direct de la relation elle-même : à force d''entendre que vous exagérez, vous finissez par appliquer ce filtre tout seul, sans que personne n''ait besoin d''insister.\n\nIl n''y a pas de seuil officiel à partir duquel une situation « mérite » d''être regardée. S''il y a un doute suffisamment installé pour que vous ayez fait ce test, c''est déjà suffisant pour qu''on en parle.\n\nC''est exactement pour ça que j''ai construit L''Arsenal Tactique : un accompagnement structuré pour sortir du brouillard, poser un diagnostic clair sur votre situation, et reprendre la main avec une méthode plutôt qu''à l''instinct.\n\nSi vous voulez en discuter concrètement, sans engagement, un appel découverte de 45 minutes est offert : {{cta_url}}\n\nÀ bientôt,\nMatthieu'
),
(
  5, 336,
  'La suite, si vous en avez besoin',
  E'Bonjour,\n\nÇa fait maintenant deux semaines que vous avez fait Le Décodeur de Relations. J''espère que ce qu''il a mis en mots vous a été utile, d''une manière ou d''une autre.\n\nCet email est le dernier de cette petite série. À partir de maintenant, vous recevrez surtout mes articles et mes analyses au fil de leur publication — sur les mécanismes de manipulation, les stratégies pour poser des limites, et la reconstruction après une relation toxique.\n\nSi votre situation demande plus qu''un article — un regard extérieur, un plan concret, quelqu''un à qui parler sans avoir à tout justifier — l''appel découverte reste disponible, gratuitement et sans engagement : {{cta_url}}\n\nEt si ce n''est pas le bon moment, ce n''est pas grave. Gardez simplement ceci en tête : ce que vous avez ressenti en faisant ce test n''était pas une invention. À vous de décider quand agir dessus.\n\nPrenez soin de vous,\nMatthieu'
)
ON CONFLICT (step_order) DO NOTHING;
