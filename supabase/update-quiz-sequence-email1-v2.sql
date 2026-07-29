-- Le résultat ne s'affiche plus du tout sur la page /decodeur après la
-- saisie de l'email : il n'est visible qu'en cliquant le lien de cet email.
-- Corrige le texte de l'email 1, qui disait encore "le résultat que vous
-- avez sous les yeux" (faux depuis ce changement). Écrase sans condition
-- l'étape 1 — sans effet si quiz-sequence.sql n'a pas encore été exécuté.
UPDATE quiz_sequence_emails
SET body = E'Bonjour,\n\nVous venez de terminer Le Décodeur de Relations. Voici votre profil complet : {{resultat_url}}\n\nCe résultat n''est pas un jugement sur votre relation — c''est un point de départ pour y voir plus clair. Gardez-le de côté : c''est une photo à un instant T qui vous servira de repère dans les semaines qui viennent.\n\nJe m''appelle Matthieu Le Tousse. Depuis plus de 20 ans, j''observe ces mécanismes de près — d''abord comme témoin, puis pendant 6 ans en cabinet, et aujourd''hui à travers l''accompagnement de personnes qui sortent d''une emprise relationnelle.\n\nUne chose que je constate à chaque fois : ce n''est jamais l''ampleur du problème qui pousse quelqu''un à agir. C''est le moment où le doute devient trop lourd à porter seul.\n\nDans les prochains jours, je vous enverrai quelques emails pour vous aider à poser des mots sur ce que vous vivez. Pas de recette miracle, pas de promesse en l''air — juste ce que des années de terrain m''ont appris.\n\nÀ très vite,\nMatthieu'
WHERE step_order = 1;
