-- Patch à exécuter uniquement si quiz-sequence.sql a déjà été lancé avant
-- l'ajout du lien de résultat ({{resultat_url}}) dans l'email 1. Si vous
-- lancez quiz-sequence.sql pour la première fois, ce fichier est inutile
-- (le texte à jour y est déjà). Sans effet si l'email a été modifié depuis
-- dans /admin/decodeur (le WHERE cible le texte d'origine).
UPDATE quiz_sequence_emails
SET body = E'Bonjour,\n\nVous venez de terminer Le Décodeur de Relations. Le résultat que vous avez sous les yeux n''est pas un jugement sur votre relation — c''est un point de départ pour y voir plus clair.\n\nVous pouvez le retrouver à tout moment ici : {{resultat_url}}\n\nC''est cette photo à un instant T qui vous servira de repère dans les semaines qui viennent.\n\nJe m''appelle Matthieu Le Tousse. Depuis plus de 20 ans, j''observe ces mécanismes de près — d''abord comme témoin, puis pendant 6 ans en cabinet, et aujourd''hui à travers l''accompagnement de personnes qui sortent d''une emprise relationnelle.\n\nUne chose que je constate à chaque fois : ce n''est jamais l''ampleur du problème qui pousse quelqu''un à agir. C''est le moment où le doute devient trop lourd à porter seul.\n\nDans les prochains jours, je vous enverrai quelques emails pour vous aider à poser des mots sur ce que vous vivez. Pas de recette miracle, pas de promesse en l''air — juste ce que des années de terrain m''ont appris.\n\nÀ très vite,\nMatthieu'
WHERE step_order = 1
  AND body LIKE '%Gardez cette page ouverte%';
