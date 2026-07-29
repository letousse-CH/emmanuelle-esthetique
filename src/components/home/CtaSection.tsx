"use client";

import React from 'react';
import { motion } from 'motion/react';
import { User, Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { fadeUp, stagger, AnimatedHeading } from './shared';
import EditableText from '../pagebuilder/EditableText';

export default function CtaSection() {
  const cards = [
    {
      icon: User, 
      color: 'sage', 
      titleKey: 'home_cta_card1_title',
      defaultTitle: 'Séance Individuelle', 
      href: '/seance-individuelle',
      descKey: 'home_cta_card1_desc',
      defaultDesc: 'Un moment privilégié pour poser les bases, apaiser les tensions les plus urgentes et définir vos premiers objectifs.',
      items: [
        { key: 'home_cta_card1_item1', defaultVal: "Bilan complet" },
        { key: 'home_cta_card1_item2', defaultVal: "90 minutes d'écoute" },
        { key: 'home_cta_card1_item3', defaultVal: "Outils de régulation" }
      ],
      ctaKey: 'home_cta_card1_cta',
      defaultCta: 'Réserver un créneau', 
      btnClass: 'btn-pink-to-purple text-white shadow-md shadow-[#EC3875]/10',
      badge: null,
    },
    {
      icon: Building2, 
      color: 'wood', 
      titleKey: 'home_cta_card2_title',
      defaultTitle: 'Programme Complet', 
      href: '/programme-complet',
      descKey: 'home_cta_card2_desc',
      defaultDesc: 'Un accompagnement régulier sur plusieurs séances pour ancrer les changements et transformer durablement votre quotidien.',
      items: [
        { key: 'home_cta_card2_item1', defaultVal: "Suivi structuré" },
        { key: 'home_cta_card2_item2', defaultVal: "Transformation profonde" },
        { key: 'home_cta_card2_item3', defaultVal: "Support prioritaire" }
      ],
      ctaKey: 'home_cta_card2_cta',
      defaultCta: 'Voir les détails', 
      btnClass: 'bg-stone-900 text-white hover:bg-wood',
      badge: 'Recommandé',
    },
  ];

  return (
    <section id="contact" className="py-32 bg-stone-50 px-6 border-t border-stone-100">
      <div className="max-w-6xl mx-auto text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-20"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[10px] mb-4 block">
            <EditableText settingKey="home_cta_eyebrow" value="Commencer" as="span" />
          </motion.span>
          <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold mb-6 text-stone-900">
            <EditableText settingKey="home_cta_title" value="Commencer votre parcours" as="span" />
          </AnimatedHeading>
          <motion.p variants={fadeUp} className="text-xl text-stone-500 font-light max-w-2xl mx-auto">
            <EditableText settingKey="home_cta_subtitle" value="Choisissez la formule qui convient le mieux à vos besoins actuels." as="span" />
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 text-left">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.15 }}
              whileHover={{ y: -8 }}
              className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-stone-200 flex flex-col justify-between hover:shadow-2xl transition-all duration-500 relative overflow-hidden group"
            >
              {card.badge && (
                <div className="absolute top-8 right-8 bg-wood text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest z-10">
                  <EditableText settingKey="home_cta_card2_badge" value={card.badge} as="span" />
                </div>
              )}
              <div>
                <div className={`inline-block p-4 bg-${card.color}/10 rounded-2xl mb-8 group-hover:rotate-6 transition-transform duration-500`}>
                  <card.icon className={`w-8 h-8 text-${card.color}`} />
                </div>
                <h3 className="font-serif text-3xl font-bold text-stone-900 mb-4">
                  <EditableText settingKey={card.titleKey} value={card.defaultTitle} as="span" />
                </h3>
                <p className="text-stone-500 font-light text-lg mb-8">
                  <EditableText settingKey={card.descKey} value={card.defaultDesc} as="span" />
                </p>
                <ul className="space-y-4 mb-12">
                  {card.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-3 text-stone-700">
                      <ArrowRight className={`w-4 h-4 text-${card.color}`} />
                      <EditableText settingKey={item.key} value={item.defaultVal} as="span" />
                    </li>
                  ))}
                </ul>
              </div>
              <a href={card.href} className={`w-full py-4 rounded-xl font-bold text-center transition-all duration-300 ${card.btnClass}`}>
                <EditableText settingKey={card.ctaKey} value={card.defaultCta} as="span" />
              </a>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-16 p-8 bg-sage/5 rounded-3xl inline-flex items-center gap-6 text-left border border-sage/10"
        >
          <AlertTriangle className="w-10 h-10 text-sage shrink-0" />
          <div>
            <p className="font-bold text-stone-900 uppercase tracking-widest text-xs mb-1">
              <EditableText settingKey="home_cta_limit_badge" value="Disponibilités limitées" as="span" />
            </p>
            <p className="text-stone-600">
              <EditableText settingKey="home_cta_limit_desc" value="Pour garantir un suivi de qualité, je n'accueille que 5 nouveaux accompagnements par mois." as="span" />
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
