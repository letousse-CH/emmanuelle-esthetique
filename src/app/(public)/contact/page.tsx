import type { Metadata } from 'next';
import { Mail, Phone, MapPin } from 'lucide-react';
import ContactForm from '../../../components/ContactForm';
import { getBusinessInfoServer } from '../../../config/site';

export const metadata: Metadata = {
  title: "Contact | Au-delà des Chaînes — Matthieu Le Tousse",
  description: "Contactez Matthieu Le Tousse, coach en sortie d'emprise relationnelle. Présentiel dans le canton de Vaud (Suisse) ou séances à distance en visio.",
  alternates: { canonical: 'https://audeladeschaines.com/contact' },
};

export default async function ContactPage() {
  const business = await getBusinessInfoServer();
  const locationLabel = [business.addressCity, business.addressRegion].filter(Boolean).join(', ');

  return (
    <div className="pt-32 pb-24 px-6 bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <span className="text-sage font-bold tracking-widest uppercase text-xs block mb-4">Contact</span>
        <h1 className="font-serif text-4xl md:text-6xl font-bold text-stone-900 mb-6">Parlons de votre situation</h1>
        <p className="text-lg font-light text-stone-500 leading-relaxed">
          Un premier échange pour comprendre votre situation et voir comment l'Arsenal Tactique peut vous accompagner. Réponse sous 48 heures.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">
        <div className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Contact</p>
            <p className="text-lg font-medium text-stone-900">{business.owner} — {business.name}</p>
          </div>

          <div className="flex items-start gap-5">
            <div className="bg-sage/10 p-3 rounded-full shrink-0"><Mail className="w-5 h-5 text-sage" /></div>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Email</p>
              <a href={`mailto:${business.email}`} className="text-lg font-medium text-stone-900 hover:text-sage transition-colors">{business.email}</a>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="bg-sage/10 p-3 rounded-full shrink-0"><Phone className="w-5 h-5 text-sage" /></div>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Téléphone</p>
              <a href={`tel:${business.phone.replace(/\s+/g, '')}`} className="text-lg font-medium text-stone-900 hover:text-sage transition-colors">{business.phone}</a>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="bg-sage/10 p-3 rounded-full shrink-0"><MapPin className="w-5 h-5 text-sage" /></div>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Zone desservie</p>
              <p className="text-lg font-medium text-stone-900">{locationLabel}</p>
              <p className="text-sm text-stone-500 mt-1">Présentiel dans le canton de Vaud — séances à distance en visio pour la Suisse, la France, la Belgique et le Canada.</p>
            </div>
          </div>

          <div className="pt-4">
            <a href="/arsenal-tactique" className="inline-flex items-center gap-2 text-sage font-bold uppercase tracking-widest text-xs hover:gap-3 transition-all">
              Découvrir l'Arsenal Tactique →
            </a>
          </div>
        </div>

        <ContactForm light />
      </div>
    </div>
  );
}
