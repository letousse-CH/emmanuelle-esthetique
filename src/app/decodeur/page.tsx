import { notFound } from 'next/navigation';
import quizData from '../../data/decodeur-quiz.json';
import DecodeurQuizClient, { type QuizData } from '../../components/decodeur/DecodeurQuizClient';
import DecodeurHeader from '../../components/decodeur/DecodeurHeader';
import DecodeurFooter from '../../components/decodeur/DecodeurFooter';
import GoogleAnalytics from '../../components/decodeur/GoogleAnalytics';
import { SITE_CONFIG } from '../../config/site';
import { fetchQuizProfiles } from '../../services/quizProfiles';
import { getSettingsServer } from '../../services/settingsServer';
import { isModuleEnabledServer } from '../../config/modules';

export const revalidate = 60;

export const metadata = {
  title: `Le Décodeur de Relations | ${SITE_CONFIG.name} - ${SITE_CONFIG.owner}`,
  description: "35 questions pour objectiver ce que vous vivez dans votre relation : contrôle, isolement, instabilité, réciprocité. Résultat immédiat et confidentiel.",
  keywords: "test relation toxique, suis-je dans une relation toxique, test emprise, quiz manipulation, décodeur de relations, Matthieu Le Tousse",
  alternates: {
    canonical: `${SITE_CONFIG.url}/decodeur`,
  },
  openGraph: {
    title: `Le Décodeur de Relations — ${SITE_CONFIG.name}`,
    description: "Un test en 3 minutes pour remplacer le doute par des faits sur votre relation.",
    url: `${SITE_CONFIG.url}/decodeur`,
    images: [
      {
        url: `${SITE_CONFIG.url}/images/hero.jpg`,
        alt: `Le Décodeur de Relations — ${SITE_CONFIG.name}`,
      }
    ]
  }
};

export default async function DecodeurPage({
  searchParams,
}: {
  searchParams: Promise<{ score?: string; profil?: string }>;
}) {
  if (!(await isModuleEnabledServer('decodeur'))) {
    notFound();
  }

  const [fetchedProfiles, settings, sp] = await Promise.all([
    fetchQuizProfiles(),
    getSettingsServer(['global_logo']),
    searchParams,
  ]);
  const data: QuizData = {
    ...(quizData as QuizData),
    profiles: fetchedProfiles.length > 0 ? fetchedProfiles : (quizData as QuizData).profiles,
  };

  const parsedScore = sp.score ? Number(sp.score) : NaN;
  const sharedResult =
    sp.profil && Number.isFinite(parsedScore) && data.profiles.some(p => p.tag === sp.profil)
      ? { score: parsedScore, profileTag: sp.profil }
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Le Décodeur de Relations",
    "description": "Test interactif pour évaluer les dynamiques de contrôle, d'isolement et d'emprise dans une relation.",
    "url": `${SITE_CONFIG.url}/decodeur`,
    "inLanguage": "fr-CH",
    "author": { "@type": "Person", "@id": `${SITE_CONFIG.url}/#matthieu`, "name": SITE_CONFIG.owner },
    "publisher": { "@type": "Organization", "name": SITE_CONFIG.name, "url": SITE_CONFIG.url },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": `${SITE_CONFIG.url}/` },
        { "@type": "ListItem", "position": 2, "name": "Le Décodeur de Relations", "item": `${SITE_CONFIG.url}/decodeur` }
      ]
    }
  };

  return (
    <div className="min-h-screen bg-paper animate-fadein flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
      <DecodeurHeader logoUrl={settings.global_logo} />
      <div className="flex-1">
        <DecodeurQuizClient data={data} sharedResult={sharedResult} />
      </div>
      <DecodeurFooter />
    </div>
  );
}
