"use client";

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowRight, CheckCircle2 } from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" }
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { staggerChildren: 0.1 }
};

export default function ContactForm({ light = false }: { light?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Demande de premier contact',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue lors de l\'envoi du message.');
      }

      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        subject: 'Demande de premier contact',
        message: ''
      });
      setTimeout(() => setSubmitted(false), 10000);
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-full flex flex-col items-center justify-center text-center space-y-6 py-12"
      >
        <div className="bg-sage/20 p-4 rounded-full">
          <CheckCircle2 className="w-16 h-16 text-sage" />
        </div>
        <h3 className="font-serif text-3xl font-bold text-stone-deep">Merci !</h3>
        <p className="text-stone-deep/60 max-w-xs mx-auto">
          Votre message a été envoyé avec succès. Je vous répondrai dans les meilleurs délais.
        </p>
        <button 
          onClick={() => setSubmitted(false)}
          className="text-wood underline font-bold uppercase tracking-widest text-xs"
        >
          Envoyer un autre message
        </button>
      </motion.div>
    );
  }

  return (
    <div className={`relative ${light ? 'bg-white' : 'bg-paper'} p-8 md:p-12 border border-stone-200 shadow-xl`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-wood"></div>
      <h3 className="font-serif text-3xl font-bold text-stone-deep mb-8 flex items-center gap-4">
        <Send className="w-6 h-6 text-wood" />
        Envoyez un message
      </h3>
      <motion.form 
        className="space-y-6" 
        onSubmit={handleSubmit}
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 italic mb-4"
          >
            {error}
          </motion.div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-xs uppercase tracking-widest text-stone-deep/60 mb-2 font-bold text-left">Nom</label>
            <input 
              id="name"
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-white border border-stone-200 px-4 py-3 outline-none focus:border-sage transition-colors" 
              placeholder="Votre nom" 
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-widest text-stone-deep/60 mb-2 font-bold text-left">Email</label>
            <input 
              id="email"
              required
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-white border border-stone-200 px-4 py-3 outline-none focus:border-sage transition-colors" 
              placeholder="votre@email.com" 
            />
          </div>
        </div>
        <div>
          <label htmlFor="subject" className="block text-xs uppercase tracking-widest text-stone-deep/60 mb-2 font-bold text-left">Sujet</label>
          <select 
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            className="w-full bg-white border border-stone-200 px-4 py-3 outline-none focus:border-sage transition-colors"
          >
            <option value="Demande de premier contact">Demande de premier contact</option>
            <option value="Information sur le programme">Information sur le programme</option>
            <option value="Autre demande">Autre demande</option>
          </select>
        </div>
        <div>
          <label htmlFor="message" className="block text-xs uppercase tracking-widest text-stone-deep/60 mb-2 font-bold text-left">Votre message</label>
          <textarea 
            id="message"
            required
            rows={5} 
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
            className="w-full bg-white border border-stone-200 px-4 py-3 outline-none focus:border-sage transition-colors" 
            placeholder="Comment puis-je vous aider ?"
          ></textarea>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit" 
          disabled={loading}
          className={`w-full bg-stone-deep text-paper py-5 font-bold uppercase tracking-[0.2em] hover:bg-stone-deep/90 transition-all shadow-lg flex items-center justify-center gap-4 group ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Envoi en cours...' : 'Envoyer le message'}
          {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />}
        </motion.button>
      </motion.form>
    </div>
  );
}
