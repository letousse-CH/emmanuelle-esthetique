import Link from 'next/link';

export const metadata = {
  title: 'Page introuvable',
  // Une 404 ne doit jamais entrer dans l'index.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex-grow flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="font-serif text-6xl text-sage mb-6">404</p>
        <h1 className="font-serif text-3xl text-stone-deep mb-4">
          Cette page n&apos;existe pas
        </h1>
        <p className="text-stone-deep/70 leading-relaxed mb-10">
          Le lien que vous avez suivi est peut-être ancien ou comporte une
          erreur. Retrouvez tous les soins depuis la page d&apos;accueil.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="inline-block text-xs tracking-[0.15em] uppercase text-stone-deep border-b border-stone-deep pb-1 hover:text-sage hover:border-sage transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/contact"
            className="inline-block text-xs tracking-[0.15em] uppercase text-stone-deep/60 border-b border-stone-deep/30 pb-1 hover:text-sage hover:border-sage transition-colors"
          >
            Nous contacter
          </Link>
        </div>
      </div>
    </main>
  );
}
