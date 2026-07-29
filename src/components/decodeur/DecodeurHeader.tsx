export default function DecodeurHeader({ logoUrl }: { logoUrl?: string }) {
  if (!logoUrl) return null;

  return (
    <header className="pt-10 pb-2 px-6 flex justify-center">
      <img src={logoUrl} alt="Au-delà des Chaînes" className="h-10 md:h-12 w-auto" />
    </header>
  );
}
