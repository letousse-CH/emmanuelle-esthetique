/**
 * Les trois premiers articles du blog, prévus par l'audit SEO du 2026-10-19.
 *
 *   node scripts/blog-articles-2026-10-19.mjs           # essai : contrôles + aperçu HTML
 *   node scripts/blog-articles-2026-10-19.mjs --write   # insère en brouillon (published = false)
 *
 * Seules sources : la carte (src/constants/carteSoins.ts), les textes déjà en
 * ligne des pages piliers et le réglage business_owner_bio. Aucun article
 * n'est publié par ce script : la publication se fait depuis /admin, après
 * relecture d'Emmanuelle. Un slug déjà présent en base n'est jamais écrasé.
 *
 * L'aperçu est écrit dans scripts/backups/ (ignoré par git).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const R2 = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/';
const BIO = 'esthéticienne depuis plus de 20 ans, passée par le Skin Spa Clarins Vevey, le Lausanne Palace et Thalasso en ville';

const ARTICLES = [
  // ── 1. Épilation ──────────────────────────────────────────────────────────
  {
    title: 'Épilation au sucre ou à la cire douce : que choisir quand la peau est sensible ?',
    slug: 'epilation-sucre-ou-cire-peau-sensible',
    category: 'Conseils',
    cover_image: `${R2}1789998853978-e-pilation.jpg`,
    meta_title: 'Épilation au sucre ou à la cire douce sur peau sensible',
    meta_description:
      'Sucre ou cire douce, quelle épilation pour une peau sensible ? Différences, zones, avant et après : les conseils d’Emmanuelle Esthétique à Palézieux-Gare.',
    meta_keywords:
      'épilation au sucre, épilation cire douce, peau sensible, épilation maillot intégral, épilation Palézieux',
    content: `
<p>Une peau qui rougit au moindre passage du rasoir, de petits boutons qui apparaissent deux jours plus tard sur les jambes ou au maillot : quand la peau est sensible, choisir entre l’<strong>épilation au sucre</strong> et l’<strong>épilation à la cire douce</strong> n’a rien d’un détail. Chez Emmanuelle Esthétique, à Palézieux-Gare, les deux méthodes sont proposées en cabine privée, et le choix se fait ensemble, selon la zone et la façon dont votre peau réagit.</p>
<p>C’est vrai qu’on entend tout et son contraire sur le sujet. La cire ferait toujours mal, le sucre serait réservé aux initiées, une peau sensible devrait se contenter du rasoir. Cet article remet les choses à plat : ce qui distingue vraiment les deux méthodes, comment choisir selon la zone, comment préparer votre peau et comment l’apaiser après. Sans promesse miracle, parce qu’aucune épilation ne se ressent de la même façon d’une femme à l’autre.</p>

<h2>En bref</h2>
<ul>
  <li>La cire douce utilisée chez Emmanuelle Esthétique est une cire de haute qualité, adaptée aux peaux sensibles, et l’épilation se termine par une émulsion apaisante marine.</li>
  <li>La pâte de sucre est 100 % naturelle et s’utilise selon la méthode orientale : elle extrait le poil avec douceur et réduit visiblement les repousses sous la peau.</li>
  <li>Le maillot échancré ou intégral se réalise au sucre (CHF 55) ; le maillot classique est à CHF 28.</li>
  <li>Aucune méthode ne convient à toutes les peaux sensibles : le choix se fait au début du rendez-vous, selon la zone et vos expériences passées.</li>
  <li>Une peau irritée, lésée ou sous traitement dermatologique se signale avant l’épilation ; en cas de doute, demandez l’avis de votre médecin.</li>
</ul>

<h2>Épilation au sucre ou à la cire douce : quelle différence ?</h2>
<p>La différence entre l’épilation au sucre et l’épilation à la cire douce tient à la matière et au savoir-faire. La cire douce est choisie pour sa qualité et sa tolérance sur les peaux sensibles. La pâte de sucre, elle, est 100 % naturelle et se travaille selon un savoir-faire traditionnel, celui de l’<em>épilation orientale</em>. Dans les deux cas, le poil est retiré à la racine, ce qui laisse la peau nette plus longtemps qu’un rasage.</p>
<p>La <strong>cire douce</strong> est la méthode la plus connue. Celle qu’utilise Emmanuelle est une cire de haute qualité, pensée pour des épilations soignées, hygiéniques et confortables. Une fois la zone épilée, une émulsion apaisante marine vient calmer la peau, et ce geste de fin compte beaucoup quand la peau a tendance à chauffer.</p>
<p>La <strong>pâte de sucre</strong> demande un vrai coup de main. Réalisée selon la méthode orientale, elle offre une extraction du poil d’une grande douceur, réduit visiblement les repousses sous la peau et laisse l’épiderme souple et satiné. C’est aussi la méthode retenue pour le maillot échancré ou intégral, une zone où la peau est particulièrement fine.</p>

<h2>Quelle épilation choisir quand on a la peau sensible ?</h2>
<p>Quand la peau est sensible, aucune méthode n’est meilleure pour toutes : la cire douce de haute qualité est pensée pour les peaux sensibles, la pâte de sucre séduit par sa douceur et son côté 100 % naturel. Le bon choix dépend de la zone à épiler, de la façon dont votre peau a réagi aux épilations précédentes et de son état le jour même. C’est pour ça qu’il se décide ensemble, au début du rendez-vous, plutôt que sur un formulaire.</p>
<p>Ce qui aide le plus, c’est de raconter ce que vous avez déjà vécu. Une zone qui est restée rouge longtemps, des poils qui repoussent sous la peau au maillot, une peau qui a chauffé longtemps après une épilation : tout ça oriente le choix. En cabine, beaucoup de femmes arrivent après des années de rasoir, persuadées que leur peau « ne supporte rien ». Souvent, elle a surtout besoin d’une méthode et d’un rythme qui lui conviennent.</p>
<p>Emmanuelle, ${BIO}, prend le temps de regarder la zone et de vous écouter avant de commencer. Si vous appréhendez, dites-le simplement : le rythme s’adapte, et vous pouvez demander une pause à tout moment.</p>

<h2>Sucre ou cire douce : comment choisir selon la zone ?</h2>
<p>Chaque zone a sa peau, plus ou moins fine, plus ou moins exposée aux frottements. Le choix de la méthode suit la zone autant que la sensibilité. Tous les tarifs sont réunis sur la page <a href="/soins/epilation">épilation à la cire douce et au sucre</a>.</p>
<p><strong>Le visage.</strong> La peau y est fine et souvent plus réactive. Les sourcils sont à CHF 22, la lèvre supérieure à CHF 15, et le visage complet (sourcils, lèvre, menton, joues) à CHF 45. Pour les sourcils, la ligne se dessine avec vous, dans le respect de votre regard naturel.</p>
<p><strong>Les aisselles et les bras.</strong> Les aisselles sont à CHF 22, les bras à CHF 40. Les aisselles sont une zone de frottement et de déodorant : c’est souvent là qu’une peau sensible se manifeste le plus vite après l’épilation.</p>
<p><strong>Les jambes.</strong> Demi-jambes à CHF 42, jambes complètes à CHF 68. Sur une grande surface, le confort de la méthode compte, et l’émulsion apaisante marine de fin de soin aussi.</p>
<p><strong>Le maillot.</strong> Le maillot classique est à CHF 28. Le maillot échancré ou intégral se réalise au sucre, à CHF 55, parce que la peau de cette zone est la plus fine et la plus délicate.</p>
<p>Pour plusieurs zones à la fois, deux forfaits simplifient les choses. Le <strong>Forfait Douceur</strong> (CHF 95) réunit demi-jambes, aisselles et maillot au choix. Le <strong>Forfait Intégral</strong> (CHF 125) réunit jambes complètes, aisselles et maillot au choix. Dans les deux cas, le type de maillot est libre, classique, échancré ou intégral.</p>

<h2>Comment préparer sa peau avant une épilation ?</h2>
<p>Pour préparer une peau sensible à l’épilation, laissez repousser le poil sur quelques millimètres sans le raser, arrivez la peau propre, sans crème ni huile sur la zone, et signalez tout traitement en cours ou toute irritation. Un gommage doux quelques jours avant aide à dégager les poils, à condition de ne pas le faire la veille. Une peau préparée calmement réagit en général mieux qu’une peau frottée à la dernière minute.</p>
<p>Le rasoir des semaines précédentes, c’est le piège le plus courant. Il coupe le poil au ras de la peau : au moment de l’épilation, il est trop court pour être retiré proprement. Mieux vaut patienter un peu, même si l’attente est inconfortable avant l’été.</p>
<p>Si votre peau est irritée, coupée ou marquée par un coup de soleil, il vaut mieux décaler le rendez-vous. Et si vous suivez un traitement qui touche la peau, dermatologique ou médicamenteux, parlez-en à votre médecin avant de prendre rendez-vous, puis signalez-le à Emmanuelle.</p>

<h2>Après l’épilation : les gestes qui apaisent une peau sensible</h2>
<p>Les heures qui suivent une épilation comptent autant que l’épilation elle-même. La peau vient d’être sollicitée : elle a besoin de calme, de fraîcheur et de produits simples. Quelques gestes suffisent.</p>
<ol>
  <li><strong>Laissez respirer la zone :</strong> des vêtements amples, en coton de préférence, surtout après le maillot ou les jambes.</li>
  <li><strong>Évitez la chaleur le jour même et le lendemain :</strong> sauna, hammam, bain très chaud, sport intense et soleil direct.</li>
  <li><strong>Mettez de côté les produits parfumés ou alcoolisés :</strong> déodorant parfumé après les aisselles, parfum ou lotion sur la zone épilée.</li>
  <li><strong>Hydratez simplement :</strong> une crème sans parfum, appliquée sur une peau propre, les jours suivants.</li>
  <li><strong>Reprenez un gommage doux quelques jours plus tard :</strong> puis régulièrement, pour aider les poils à repousser à la surface plutôt que sous la peau.</li>
  <li><strong>Ne grattez pas :</strong> si une rougeur persiste, devient douloureuse ou s’infecte, consultez un médecin.</li>
</ol>

<h2>Questions fréquentes</h2>
<h3>L’épilation au sucre fait-elle moins mal que la cire ?</h3>
<p>La sensation varie d’une femme à l’autre et d’une zone à l’autre, et personne ne peut vous promettre une épilation sans aucune sensation. La pâte de sucre est appréciée pour sa douceur ; la cire douce de haute qualité est choisie pour son confort sur les peaux sensibles. Si vous appréhendez, dites-le : la méthode et le rythme s’adaptent.</p>
<h3>Peut-on faire le maillot intégral à la cire douce ?</h3>
<p>Chez Emmanuelle Esthétique, le maillot échancré ou intégral se réalise au sucre, à CHF 55 : c’est la zone où la peau est la plus fine. Le maillot classique, à CHF 28, fait partie des zones pour lesquelles la méthode se choisit ensemble. Les deux forfaits laissent le type de maillot libre.</p>
<h3>À quelle fréquence prendre rendez-vous pour une épilation ?</h3>
<p>Le rythme dépend de votre pilosité, de la zone et de la méthode : il n’existe pas de calendrier valable pour toutes. Le plus simple est d’en parler avec Emmanuelle à la fin du rendez-vous, en regardant comment la repousse s’est faite depuis la dernière fois. Évitez seulement le rasoir entre deux séances.</p>
<h3>Que faire si ma peau réagit après l’épilation ?</h3>
<p>Une rougeur légère juste après l’épilation est fréquente sur une peau sensible et s’estompe le plus souvent d’elle-même. Gardez la zone au frais, évitez la chaleur et les produits parfumés. Si la rougeur persiste, devient douloureuse ou que des boutons s’infectent, consultez un médecin, et parlez-en à Emmanuelle avant la séance suivante.</p>

<h2>Pour aller plus loin</h2>
<p>Sucre ou cire douce, la bonne épilation pour une peau sensible est celle qui tient compte de la zone, de votre histoire avec l’épilation et de l’état de votre peau le jour même. Les deux méthodes ont leur place, et aucune ne se choisit à l’aveugle. Le reste tient dans quelques gestes simples, avant et après, et dans le fait d’oser dire ce qui vous inquiète.</p>
<p>Pour voir toutes les zones, les tarifs et les deux forfaits, rendez-vous sur la page <a href="/soins/epilation">épilation à la cire douce et à la pâte de sucre</a>.</p>

<blockquote><p>Envie d’essayer ? <a href="/reservation">Réservez votre épilation en ligne</a> : choisissez le jour et l’heure qui vous conviennent, Emmanuelle vous recontacte pour confirmer le rendez-vous.</p></blockquote>
`,
  },

  // ── 2. Soins du visage ────────────────────────────────────────────────────
  {
    title: 'Quel soin du visage Phytomer choisir selon l’état de votre peau ?',
    slug: 'quel-soin-visage-phytomer-choisir',
    category: 'Conseils',
    cover_image: `${R2}1790524738941-WhatsApp-Image-2026-09-27-at-17.51.49--2-.webp`,
    meta_title: 'Quel soin du visage Phytomer choisir selon votre peau ?',
    meta_description:
      'Peau terne, qui tiraille ou qui marque : quel soin du visage Phytomer choisir ? Les trois protocoles d’Emmanuelle Esthétique à Palézieux-Gare, de 40 à 75 min.',
    meta_keywords:
      'soin du visage Phytomer, soin visage peau déshydratée, soin anti-âge, soin éclat, institut de beauté Palézieux',
    content: `
<p>Choisir un <strong>soin du visage Phytomer</strong> commence rarement par le nom du soin. Ça commence devant le miroir, quand la peau tire après la douche, que le teint paraît gris malgré une bonne nuit, ou qu’une ride s’est installée au coin des yeux sans prévenir. Chez Emmanuelle Esthétique, à Palézieux-Gare, la carte propose trois protocoles Phytomer, de 40 à 75 minutes, et chacun répond à un état de peau différent.</p>
<p>Cet article vous aide à vous y retrouver, sans jargon. Vous n’avez pas à poser un diagnostic vous-même : l’échange qui précède chaque soin est là pour ça. Mais savoir ce que contient chaque protocole permet d’arriver plus sereine, et de réserver le soin qui vous ressemble.</p>

<h2>En bref</h2>
<ul>
  <li>Peau terne ou encombrée, peu de temps : le Soin Peau Nette &amp; Coup d’Éclat Express, 40 minutes, CHF 90.</li>
  <li>Peau qui tiraille, en manque d’eau : le Soin Hydra Originel — Désaltérant &amp; Repulpant, 60 minutes, CHF 140.</li>
  <li>Rides installées, ovale qui se relâche : le Soin Expert Jeunesse — Correction Rides &amp; Fermeté, 75 minutes, CHF 165.</li>
  <li>Peau sensible : chacun des trois soins s’adapte après l’échange qui précède le soin ; signalez toute sensibilité, allergie ou traitement.</li>
  <li>Deux options se glissent pendant le soin : la boue marine auto-chauffante pour le dos (CHF 30) et le massage du cuir chevelu et de la nuque, 15 minutes (CHF 25).</li>
</ul>

<h2>Comment savoir de quel soin du visage votre peau a besoin ?</h2>
<p>Pour choisir un soin du visage, partez de ce que vous ressentez plutôt que d’un « type de peau » : une peau qui tiraille demande de l’hydratation, un teint terne et une peau encombrée appellent un nettoyage en profondeur, des rides installées et un ovale moins net orientent vers un soin plus ciblé. Le choix se confirme ensuite avec Emmanuelle, en regardant votre peau au début du rendez-vous.</p>
<p>Une nuance aide beaucoup : une peau <em>déshydratée</em> manque d’eau, une peau <em>sèche</em> manque de lipides. Les deux peuvent tirailler, et une peau qui brille peut très bien manquer d’eau en même temps. C’est pour ça qu’on se trompe souvent de crème, et qu’un regard extérieur est utile.</p>
<p>En cabine, on voit souvent des peaux qui cumulent plusieurs besoins : un teint fatigué et des tiraillements, ou de premières rides sur une peau déshydratée. Dans ce cas, on commence par ce qui gêne le plus au quotidien. Les trois protocoles sont détaillés sur la page <a href="/soins/visage">soins du visage Phytomer</a>.</p>

<h2>Peau terne ou encombrée : le Soin Peau Nette &amp; Coup d’Éclat Express</h2>
<p>Le <strong>Soin Peau Nette &amp; Coup d’Éclat Express</strong> (40 minutes, CHF 90) est le rendez-vous le plus court de la carte, pensé pour les jours où le temps manque mais où la peau a besoin d’un vrai nettoyage. Il commence par un nettoyage profond désincrustant sous serviettes chaudes, suivi d’un gommage marin enzymatique.</p>
<p>Vient ensuite un masque chauffant détoxifiant, puis une hydratation personnalisée pour finir. La chaleur des serviettes sur le visage, la peau qui respire à nouveau : c’est le soin qu’on choisit avant un événement, ou quand le teint a perdu sa lumière après quelques semaines chargées.</p>

<h2>Peau qui tiraille : le Soin Hydra Originel</h2>
<p>Le <strong>Soin Hydra Originel — Désaltérant &amp; Repulpant</strong> (60 minutes, CHF 140) est un bain d’hydratation aux algues tissées bio. Il s’adresse aux peaux qui tirent, qui manquent de confort, qui marquent un peu plus à la fin d’une journée de chauffage ou de vent.</p>
<p>Le protocole associe un gommage velours, un modelage délassant du visage et du décolleté, et un masque crémeux à l’algue Nori. Il est pensé pour repulper les traits et aider la peau à retrouver son confort. Le modelage du décolleté, souvent oublié, fait partie du soin : les épaules redescendent d’un cran.</p>
<p>Le Soin Hydra Originel est aussi le cœur du <strong>Rituel Échappée Belle</strong> (1h45, CHF 230), qui le fait précéder d’un gommage complet du corps ou d’un massage ciblé du dos, à découvrir avec les <a href="/soins/corps">rituels et massages du corps</a>.</p>

<h2>Rides installées, ovale moins net : le Soin Expert Jeunesse</h2>
<p>Le <strong>Soin Expert Jeunesse — Correction Rides &amp; Fermeté</strong> (75 minutes, CHF 165) est le protocole anti-âge de la carte. Il repose sur un modelage remodelant ciblé, inspiré des techniques de <em>digito-pression</em>, suivi de la pose d’un masque plastifiant tenseur aux actifs marins.</p>
<p>Soyons honnêtes : aucun soin en institut n’efface une ride. Ce que vise ce protocole, c’est une peau visiblement plus lisse et un ovale plus tonique, avec le temps d’un vrai modelage. Pour une peau qui commence à marquer, c’est aussi un moment pour apprendre ce qui lui fait du bien au quotidien.</p>

<h2>Quel soin du visage choisir quand on a la peau sensible ?</h2>
<p>Avec une peau sensible, il n’y a pas de soin à éviter par principe : chacun des trois protocoles Phytomer s’adapte à votre peau du jour, après l’échange qui précède le soin. Signalez toute sensibilité, allergie ou traitement en cours avant de commencer, pour que le protocole soit ajusté. En cas de peau lésée, de maladie de peau ou de traitement dermatologique, demandez d’abord l’avis de votre médecin.</p>
<p>Ce qui compte, c’est que rien ne se fasse sans vous. Emmanuelle, ${BIO}, explique chaque étape et ajuste le geste à ce que votre peau montre ce jour-là. Une peau sensible n’a pas à être « réparée » : elle a besoin qu’on la respecte.</p>

<h2>Les options pendant votre soin du visage : dos et nuque</h2>
<p>Deux options, appelées les Privilèges Visage, se glissent pendant le soin du visage, sans rallonger le rendez-vous de façon compliquée. Vous pouvez les ajouter directement en réservant en ligne.</p>
<p>L’<strong>Option Boue Marine Auto-Chauffante Dos</strong> (CHF 30) dépose une boue marine effervescente et reminéralisante le long de la colonne vertébrale pendant votre soin du visage. Sa chaleur détend le haut du corps pendant que le visage est pris en charge. L’<strong>Option Massage Relaxant du Cuir Chevelu &amp; Nuque</strong> (15 minutes, CHF 25) s’adresse à celles qui portent leur fatigue dans la nuque et les tempes.</p>

<h2>Avant et après votre soin du visage : quelques repères</h2>
<p>Un soin du visage se prépare simplement. Ces quelques repères vous aident à en profiter pleinement, et à prolonger ses effets une fois rentrée chez vous.</p>
<ol>
  <li><strong>Notez ce que vous ressentez :</strong> tiraillements, zones qui brillent, rougeurs, et les produits que vous utilisez en ce moment.</li>
  <li><strong>Signalez allergies et traitements :</strong> au moment de la réservation ou dès le début du rendez-vous.</li>
  <li><strong>Prévoyez du temps après :</strong> sortir d’un soin pour courir à une réunion, c’est dommage.</li>
  <li><strong>Laissez votre peau tranquille le soir même :</strong> pas de gommage maison ni de nouveau produit à tester.</li>
  <li><strong>Protégez-la du soleil les jours suivants :</strong> une protection solaire, même en hiver, accompagne bien un soin qui comprend un gommage.</li>
</ol>

<h2>Questions fréquentes</h2>
<h3>Combien de temps dure un soin du visage Phytomer ?</h3>
<p>Selon la formule : 40 minutes pour le Soin Peau Nette &amp; Coup d’Éclat Express (CHF 90), 60 minutes pour le Soin Hydra Originel (CHF 140) et 75 minutes pour le Soin Expert Jeunesse (CHF 165). Le Rituel Échappée Belle, qui associe un soin du corps et le Soin Hydra Originel, dure 1h45 (CHF 230).</p>
<h3>Quelle différence entre Hydra Originel et Expert Jeunesse ?</h3>
<p>Le Soin Hydra Originel est un soin d’hydratation aux algues tissées bio, pour les peaux qui tiraillent : gommage velours, modelage du visage et du décolleté, masque à l’algue Nori. Le Soin Expert Jeunesse est un protocole anti-âge : modelage remodelant inspiré de la digito-pression et masque plastifiant tenseur, pour les rides installées et l’ovale.</p>
<h3>Peut-on combiner un soin du visage et un soin du corps ?</h3>
<p>Oui, avec le Rituel Échappée Belle (1h45, CHF 230) : un gommage complet du corps Voile de Satin ou un massage ciblé du dos, immédiatement suivi du Soin Hydra Originel complet. Vous pouvez aussi ajouter à votre soin du visage l’option boue marine pour le dos (CHF 30).</p>
<h3>Qu’est-ce que la cosmétique Phytomer ?</h3>
<p>Phytomer est une maison de cosmétique marine née à Saint-Malo. Ses soins professionnels utilisent des textures issues de la mer, comme les algues, les sels marins et la boue marine. Pour en savoir plus sur ces ingrédients, découvrez la page consacrée à <a href="/phytomer">la cosmétique marine Phytomer</a>.</p>

<h2>Pour aller plus loin</h2>
<p>Teint terne, peau qui tiraille ou rides installées : chaque état de peau a son protocole Phytomer, et aucun ne se choisit à l’aveugle. Si vous hésitez entre deux soins, partez de ce qui vous gêne le plus au quotidien, et laissez l’échange du début de rendez-vous confirmer le choix.</p>
<p>Les descriptions complètes, les durées et les tarifs sont réunis sur la page <a href="/soins/visage">soins du visage Phytomer à Palézieux-Gare</a>.</p>

<blockquote><p>Votre peau a besoin d’une parenthèse ? <a href="/reservation">Réservez votre soin du visage en ligne</a> : choisissez le jour et l’heure qui vous conviennent, Emmanuelle vous recontacte pour confirmer le rendez-vous, et pour en parler si vous hésitez encore entre deux soins.</p></blockquote>
`,
  },

  // ── 3. Grand massage relaxant ─────────────────────────────────────────────
  {
    title: 'Que se passe-t-il pendant un grand massage relaxant de 60 ou de 90 minutes ?',
    slug: 'grand-massage-relaxant-60-ou-90-minutes',
    category: 'Questions',
    cover_image: `${R2}1790524735770-WhatsApp-Image-2026-09-27-at-17.51.48.webp`,
    meta_title: 'Grand massage relaxant 60 ou 90 min : comment ça se passe',
    meta_description:
      'Échange, installation, gestuelle, retour au calme : le déroulé du Grand Massage Relaxant Marine de 60 ou 90 minutes chez Emmanuelle Esthétique, à Palézieux.',
    meta_keywords:
      'grand massage relaxant, massage 60 minutes, massage 90 minutes, massage relaxant Palézieux, massage corps complet',
    content: `
<p>La porte de la cabine qui se referme, le téléphone en silencieux, le parfum printanier d’une huile marine : un <strong>grand massage relaxant</strong> commence bien avant le premier geste. Chez Emmanuelle Esthétique, à Palézieux-Gare, le Grand Massage Relaxant Marine — Signature Spa se réserve en 60 minutes (CHF 145) ou en 90 minutes (CHF 210).</p>
<p>Si vous n’avez jamais été massée, ou si vous hésitez entre les deux durées, c’est normal de vous demander comment ça se passe. On n’ose pas toujours poser la question. Cet article déroule le soin pas à pas, de l’accueil au moment où vous vous relevez, pour que vous sachiez à quoi vous attendre en franchissant la porte.</p>

<h2>En bref</h2>
<ul>
  <li>Le Grand Massage Relaxant Marine — Signature Spa est un massage complet du corps, sur-mesure, proposé en 60 minutes (CHF 145) ou en 90 minutes (CHF 210).</li>
  <li>Il associe effleurages profonds, drainages doux et pressions dénouantes, à l’huile marine satinante au parfum printanier.</li>
  <li>Les 90 minutes ne changent pas la nature du massage : elles laissent plus de temps à chaque geste et aux zones qui en ont besoin.</li>
  <li>C’est un soin de bien-être et de détente, à visée esthétique : il ne remplace pas un traitement médical ou de physiothérapie.</li>
  <li>Il a lieu dans une cabine privée à Palézieux-Gare, sur rendez-vous ; les soins sont réservés aux femmes.</li>
</ul>

<h2>Comment se déroule un grand massage relaxant, du début à la fin ?</h2>
<p>Un grand massage relaxant se déroule en trois temps : un échange pour comprendre comment vous vous sentez ce jour-là, le massage complet du corps adapté à vos besoins musculaires et énergétiques du jour, puis un retour au calme avant de reparler de ce que vous avez ressenti. Chez Emmanuelle Esthétique, tout se passe dans une cabine privée, sans passage ni attente, à deux minutes à pied de la gare CFF de Palézieux.</p>
<p>Le Grand Massage Relaxant Marine porte le nom de « Signature Spa » parce qu’il est sur-mesure : le même soin ne se ressemble jamais tout à fait d’un rendez-vous à l’autre. Il suit ce que votre corps raconte ce jour-là. Vous le retrouvez avec les autres soins du corps sur la page <a href="/soins/corps">rituels et massages du corps</a>.</p>

<h2>Avant le massage : l’échange et l’installation</h2>
<p>Le rendez-vous commence par un temps d’échange. Emmanuelle vous demande comment vous allez, où se logent les tensions du moment, si vous préférez une pression enveloppante ou plus appuyée, et s’il y a une zone à éviter. C’est aussi le moment de signaler un problème de santé, une grossesse ou une blessure récente.</p>
<p>Vous vous installez ensuite sur la table de soin, confortablement, et vous restez couverte pendant tout le massage : seule la zone massée est découverte. Personne ne commente quoi que ce soit, ni votre corps ni vos tensions. On part d’où vous en êtes.</p>

<h2>Pendant le massage : effleurages, drainages et pressions</h2>
<p>Le Grand Massage Relaxant Marine combine trois familles de gestes, dosées selon vos besoins du jour. Les <em>effleurages profonds</em> sont de longs gestes enveloppants, qui réchauffent et relient les zones entre elles. Les <em>drainages doux</em> sont des gestes plus lents et légers, qui accompagnent le relâchement de tout le corps.</p>
<p>Les <em>pressions dénouantes</em>, enfin, se posent là où ça tire : la nuque, les épaules, le haut du dos chez beaucoup de femmes qui passent leurs journées devant un écran ou au volant. Le tout se fait à l’huile marine satinante au parfum printanier, qui laisse la peau douce et satinée.</p>
<p>Vous pouvez parler ou vous taire, fermer les yeux, vous laisser aller au point de somnoler. Si la pression est trop forte ou pas assez, dites-le à tout moment : le massage s’ajuste. En cabine, on voit souvent la respiration ralentir et les épaules redescendre au bout de quelques minutes, sans que personne ait rien demandé.</p>

<h2>60 ou 90 minutes : quelle durée choisir pour un grand massage relaxant ?</h2>
<p>Choisissez 60 minutes pour un massage complet qui détend l’ensemble du corps dans un temps maîtrisé, et 90 minutes si vous voulez que chaque zone soit travaillée sans se presser, ou si vous arrivez avec beaucoup de tensions. C’est le même Grand Massage Relaxant Marine, sur-mesure : la différence tient au temps accordé aux effleurages profonds, aux drainages doux et aux pressions dénouantes.</p>
<p>Le format de <strong>60 minutes (CHF 145)</strong> convient bien à une première fois, ou à un rendez-vous glissé dans une semaine chargée. Le format de <strong>90 minutes (CHF 210)</strong> laisse au corps le temps de vraiment lâcher, et au massage celui de revenir sur les zones qui en ont le plus besoin. Si vous hésitez, parlez-en à Emmanuelle quand elle vous recontacte pour confirmer le rendez-vous.</p>

<h2>Après le massage : revenir doucement</h2>
<p>À la fin du massage, rien ne presse. Vous prenez le temps de vous relever à votre rythme, puis un court échange permet de reparler de ce que vous avez ressenti et des zones qui étaient les plus tendues.</p>
<p>Si possible, évitez d’enchaîner tout de suite avec un rendez-vous stressant ou une longue route. Le corps garde la trace du massage un moment après : autant lui laisser cette fin de journée plus douce.</p>

<h2>Préparer votre premier massage : les repères utiles</h2>
<p>Un premier massage se prépare en quelques gestes simples, pour arriver détendue et profiter de chaque minute.</p>
<ol>
  <li><strong>Prévoyez de la marge :</strong> arriver en courant, c’est commencer le massage avec les épaules déjà serrées.</li>
  <li><strong>Mangez léger avant :</strong> un repas copieux juste avant le soin n’aide pas à se détendre sur la table.</li>
  <li><strong>Signalez votre santé :</strong> grossesse, problème de santé, blessure récente ou douleur inexpliquée. En cas de doute, demandez d’abord l’avis de votre médecin.</li>
  <li><strong>Dites vos préférences :</strong> pression, zones à éviter, envie de parler ou de silence.</li>
  <li><strong>Choisissez une tenue confortable pour après :</strong> des vêtements souples, pour garder la sensation de détente sur le chemin du retour.</li>
</ol>

<h2>Envie d’un soin du corps plus ciblé ?</h2>
<p>Le grand massage relaxant n’est pas le seul rituel du corps de la carte. Le <strong>Soin Bulles des Mers — Détox &amp; Pureté du Dos</strong> (45 minutes, CHF 110) associe un gommage purifiant du dos, une boue marine auto-chauffante sous occlusion thermique et un modelage des trapèzes, de la nuque et du dos. Le <strong>Soin Voile de Satin — Gommage Peau Neuve</strong> (45 minutes, CHF 110) exfolie tout le corps aux cristaux de sels marins, puis le nourrit d’un lait satinant.</p>
<p>Pour un moment plus long, le <strong>Rituel Échappée Belle</strong> (1h45, CHF 230) réunit le gommage Voile de Satin ou un massage ciblé du dos et le Soin Hydra Originel pour le visage. Tous ces soins sont décrits sur la page <a href="/soins/corps">rituels et massages du corps à Palézieux-Gare</a>, et le massage s’offre aussi en <a href="/bon-cadeau">bon cadeau</a>.</p>

<h2>Questions fréquentes</h2>
<h3>Faut-il se déshabiller pour un grand massage relaxant ?</h3>
<p>Le Grand Massage Relaxant Marine est un massage complet du corps à l’huile : vous vous déshabillez selon votre confort, et vous restez couverte pendant tout le soin, seule la zone massée étant découverte. Si quelque chose vous met mal à l’aise, dites-le avant de commencer : le soin s’adapte.</p>
<h3>Le massage relaxant est-il un massage thérapeutique ?</h3>
<p>Non : le Grand Massage Relaxant Marine est un soin de bien-être et de détente, à visée esthétique. Il ne remplace pas un traitement médical ou de physiothérapie. Si vous avez une douleur ou un problème de santé, consultez votre médecin avant de réserver, puis signalez-le lors de l’échange qui précède le massage.</p>
<h3>Peut-on se faire masser pendant la grossesse ?</h3>
<p>Parlez-en d’abord à votre médecin ou à votre sage-femme, puis signalez votre grossesse à Emmanuelle au moment de la réservation. Le soin se décide ensemble, en fonction de leur avis et de ce que vous ressentez. Dans tous les cas, ne réservez pas sans l’avoir mentionné.</p>
<h3>Un homme peut-il réserver un grand massage relaxant ?</h3>
<p>Non : les soins d’Emmanuelle Esthétique sont réservés aux femmes. En revanche, n’importe qui peut offrir le Grand Massage Relaxant Marine à une femme de son entourage, en 60 ou en 90 minutes, grâce à un bon cadeau.</p>

<h2>Pour aller plus loin</h2>
<p>Un grand massage relaxant, c’est un échange, un massage complet du corps sur-mesure, puis un vrai temps pour revenir. Que vous choisissiez 60 ou 90 minutes, le soin suit ce que votre corps demande ce jour-là, dans une cabine privée où rien ne vous presse. La seule chose à préparer, c’est de vous accorder ce temps.</p>

<blockquote><p>Envie de lâcher prise ? <a href="/reservation">Réservez votre grand massage relaxant en ligne</a> : choisissez le jour et l’heure qui vous conviennent, Emmanuelle vous recontacte pour confirmer le rendez-vous.</p></blockquote>
`,
  },
];

// ── Contrôles ────────────────────────────────────────────────────────────────
const FORBIDDEN = /(?<!\p{L})(cela|crucial|fondamental|essentiel(le)?s?|constitue|représente|transformer|s’avère|il convient|optimiser|booster|maximiser|néanmoins|nonobstant|synergie|écosystème|révolution)(?!\p{L})/iu;
const words = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
let ok = true;
const fail = (msg) => { ok = false; console.log(`  ✗ ${msg}`); };

for (const a of ARTICLES) {
  a.content = a.content.trim();
  console.log(`\n« ${a.title} »  (/blog/${a.slug})`);
  const t = a.meta_title.length, d = a.meta_description.length;
  console.log(`  meta_title ${t} car. · meta_description ${d} car. · ${words(a.content)} mots`);
  if (t < 50 || t > 60) fail('meta_title hors 50-60');
  if (d < 140 || d > 160) fail('meta_description hors 140-160');
  const links = [...a.content.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  const pillar = links.find((l) => l.startsWith('/soins/'));
  const pillarCount = links.filter((l) => l === pillar).length;
  console.log(`  pilier ${pillar} ×${pillarCount} · liens internes : ${links.join(', ')}`);
  if (pillarCount < 1 || pillarCount > 3) fail('1 à 3 liens vers le pilier');
  if (links.at(-1) !== '/reservation') fail('le dernier lien doit mener à /reservation');
  const bad = a.content.match(FORBIDDEN);
  if (bad) fail(`mot à éviter : « ${bad[0]} »`);
  if (/(?<!\p{L})(tu|ton|ta|tes|toi)(?!\p{L})/iu.test(a.content.replace(/<[^>]+>/g, ' '))) fail('tutoiement ?');
}

// ── Aperçu à relire ──────────────────────────────────────────────────────────
mkdirSync('scripts/backups', { recursive: true });
const preview = 'scripts/backups/blog-articles-2026-10-19.html';
writeFileSync(preview, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brouillons du blog</title><style>
body{font:17px/1.65 Georgia,serif;color:#1f2a33;background:#fff;max-width:720px;margin:0 auto;padding:24px 16px}
h1{font-size:1.7em;line-height:1.25;margin-top:2.5em;border-top:3px solid #1d4e6b;padding-top:1em}
h2{font-size:1.3em;margin-top:1.8em}h3{font-size:1.05em}a{color:#1d4e6b}
blockquote{border-left:4px solid #2c8160;background:#f2f7f5;margin:2em 0;padding:4px 20px}
.meta{font:14px/1.5 system-ui,sans-serif;background:#f4f4f2;padding:10px 14px;color:#444}
.meta b{color:#1f2a33}img{max-width:100%;height:auto}
</style></head><body>
${ARTICLES.map((a) => `<h1>${a.title}</h1>
<div class="meta"><b>Slug</b> /blog/${a.slug} · <b>Catégorie</b> ${a.category} · ${words(a.content)} mots<br>
<b>Titre SEO</b> (${a.meta_title.length}) ${a.meta_title}<br>
<b>Description</b> (${a.meta_description.length}) ${a.meta_description}<br>
<b>Mots-clés</b> ${a.meta_keywords}</div>
<p><img src="${a.cover_image}" alt="" loading="lazy"></p>
${a.content}`).join('\n')}
</body></html>`);
console.log(`\nAperçu : ${preview}`);

if (!ok) { console.log('\nContrôles en échec : rien n’est écrit.'); process.exit(1); }

// ── Écriture (brouillons) ────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
const db = createClient(url, key, { auth: { persistSession: false } });
const write = process.argv.includes('--write');
console.log(`\nBase : ${url}${write ? '' : '   (essai — rien n’est écrit)'}`);

const { data: existing, error } = await db.from('articles').select('slug').in('slug', ARTICLES.map((a) => a.slug));
if (error) throw error;
const taken = new Set((existing || []).map((r) => r.slug));
for (const a of ARTICLES) {
  if (taken.has(a.slug)) { console.log(`  = ${a.slug} existe déjà : laissé tel quel`); continue; }
  if (!write) { console.log(`  + ${a.slug} serait créé en brouillon`); continue; }
  const { error: e } = await db.from('articles').insert({ ...a, published: false });
  if (e) throw e;
  console.log(`  + ${a.slug} créé en brouillon (non publié)`);
}
