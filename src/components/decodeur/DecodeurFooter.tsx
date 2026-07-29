import Link from 'next/link';

export default function DecodeurFooter() {
  return (
    <footer className="border-t border-stone-100 py-8 px-6 text-center">
      <div className="flex items-center justify-center gap-4 text-xs text-stone-400 mb-3">
        <Link href="/cgv" className="hover:text-stone-600 transition-colors">CGV</Link>
        <span className="text-stone-200">·</span>
        <Link href="/a-propos" className="hover:text-stone-600 transition-colors">Contact</Link>
      </div>
      <p className="text-xs text-stone-400">
        © Au-delà des Chaînes {new Date().getFullYear()}
        <br />
        Palézieux, Suisse Romande
      </p>
    </footer>
  );
}
