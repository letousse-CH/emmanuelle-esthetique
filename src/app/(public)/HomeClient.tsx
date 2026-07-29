"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Lock, Radio, Youtube, Check, ChevronDown, HelpCircle, Award, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EditableText from '../../components/pagebuilder/EditableText';
import EditableImage from '../../components/pagebuilder/EditableImage';
import GoogleReviews from '../../components/GoogleReviews';
import { NewsletterBanner } from '../../components/NewsletterBanner';

interface HomeClientProps {
  content: Record<string, string>;
  pageImages: Record<string, string>;
  defaults: Record<string, string>;
}

export default function HomeClient({ content, pageImages, defaults }: HomeClientProps) {
  // State to handle accordion toggles in the FAQ section
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, fallbackUrl: string) => {
    e.currentTarget.src = fallbackUrl;
    e.currentTarget.onerror = null;
  };

  return (
    <div className="min-h-screen bg-paper text-stone-deep font-sans antialiased overflow-x-hidden selection:bg-sage/20 selection:text-stone-deep">
      
      {/* ─── SECTION 1: HERO (L'EN-TÊTE HÉRO) ──────────────────────── */}
      <section className="relative min-h-[90vh] md:min-h-screen flex items-center justify-center bg-[#13071A] text-white pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <EditableImage
            settingKey="home_hero_bg"
            src={pageImages.home_hero_bg || "/images/home_hero_bg.webp"}
            alt=""
            className="w-full h-full object-cover opacity-20 pointer-events-auto"
          />
        </div>
        <div className="absolute inset-0 bg-[#13071A]/70 pointer-events-none z-0" />

        {/* Slow spinning visual gradient ring behind background */}
        <div className="absolute right-[-15%] top-[-10%] w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full brand-ring-gradient opacity-15 blur-3xl pointer-events-none z-0" />
        <div className="absolute left-[-10%] bottom-[-10%] w-[400px] h-[400px] rounded-full brand-ring-gradient opacity-10 blur-3xl pointer-events-none z-0" />

        <div className="max-w-4xl w-full mx-auto text-center relative z-10 space-y-8 animate-fadein">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm text-white/70 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
            <EditableText
              settingKey="home_coaching_hero_badge"
              value={content.home_coaching_hero_badge || "Coaching Relation Toxique"}
              as="span"
            />
          </div>

          {/* Heavy Title */}
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-white">
            <EditableText
              settingKey="home_coaching_hero_title"
              value={content.home_coaching_hero_title || "Comprendre l'Emprise, Briser les Chaînes et Se Reconstruire"}
              as="span"
            />
          </h1>

          {/* Subtitle description */}
          <p className="text-white/80 font-light text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
            <EditableText
              settingKey="home_coaching_hero_subtitle"
              value={content.home_coaching_hero_subtitle || "Tu as longtemps cru que le problème venait de toi. Aujourd'hui, la confusion laisse place à une certitude : tu es ou tu as été sous emprise. Ne reste plus seul(e) face au doute. Bénéficie d'un accompagnement pragmatique, direct et orienté résultats pour décoder les mécanismes de manipulation, poser des limites infranchissables et reprendre définitivement les commandes de ta vie."}
              as="span"
            />
          </p>

          {/* CTA action & disclaimer */}
          <div className="flex flex-col items-center justify-center gap-4 pt-4">
            <div className="flex flex-col items-center gap-1 text-xs text-white/50 font-light text-center">
              <Lock className="w-3.5 h-3.5 text-sage" />
              <EditableText
                settingKey="home_coaching_hero_disclaimer"
                value={content.home_coaching_hero_disclaimer || "Échange de 30 minutes, strictement confidentiel, sécurisé et sans aucun engagement."}
                as="span"
              />
            </div>

            <Link
              href="/a-propos"
              className="group inline-flex items-center justify-center gap-3 btn-pink-to-purple text-white font-bold text-xs uppercase tracking-widest py-4 px-8 rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-[#EC3875]/20"
            >
              <EditableText
                settingKey="home_coaching_hero_cta"
                value={content.home_coaching_hero_cta || "Réserver ma session Découverte"}
                as="span"
              />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 z-10 pointer-events-none">
          <span className="text-[9px] uppercase tracking-widest text-white/50">Découvrir</span>
          <ChevronDown className="w-4 h-4 text-white animate-bounce" />
        </div>
      </section>

      {/* ─── SECTION 2: LE MIROIR DE LA RÉALITÉ (Symptômes Emprise) ──────── */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-20 bg-paper text-stone-deep">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Eyebrow + Title + Illustration */}
          <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-28">
            <div className="space-y-4">
              <span className="text-sage text-[11px] font-black uppercase tracking-widest block">
                <EditableText
                  settingKey="home_coaching_frustrations_eyebrow"
                  value={content.home_coaching_frustrations_eyebrow || "Reconnaître les Symptômes de l'Emprise Psychologique"}
                  as="span"
                />
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-stone-deep leading-tight">
                <EditableText
                  settingKey="home_coaching_frustrations_title"
                  value={content.home_coaching_frustrations_title || "Vivre ou avoir vécu aux côtés d'une personnalité toxique, manipulatrice ou présentant une structure psychotique ne laisse aucune place au hasard. C'est une érosion lente, invisible et méthodique de ton identité."}
                  as="span"
                />
              </h2>
            </div>

            {/* Glowing Illustration / Mirror Image */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative rounded-[2rem] overflow-hidden border border-stone-200/50 aspect-[4/5] shadow-2xl bg-white group hidden lg:block"
            >
              <EditableImage
                settingKey="home_symptoms_side_photo"
                src={pageImages.home_symptoms_side_photo || "/images/photo1.webp"}
                alt="Miroir de la Réalité - Emprise Relationnelle"
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-95 transition-all duration-1000 grayscale group-hover:grayscale-0"
                onError={(e) => handleImageError(e, "/images/photo1.webp")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 via-transparent to-transparent opacity-95 pointer-events-none" />
              <div className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-stone-200/30">
                <p className="text-[10px] uppercase tracking-widest text-sage font-black mb-1">Observation Clinique</p>
                <p className="text-stone-700 font-light text-[11px] leading-relaxed">Les traumatismes de l'emprise s'installent de manière silencieuse et invisible.</p>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Symptoms Grid & Quote */}
          <div className="lg:col-span-7 space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  num: "01",
                  titleKey: "home_coaching_frustrations_card1_title",
                  titleVal: content.home_coaching_frustrations_card1_title || "La confusion permanente (Gaslighting)",
                  descKey: "home_coaching_frustrations_card1_desc",
                  descVal: content.home_coaching_frustrations_card1_desc || "Tu réécris tes propres souvenirs, tu doutes de tes ressentis et tu finis par t'excuser pour des fautes que tu n'as pas commises."
                },
                {
                  num: "02",
                  titleKey: "home_coaching_frustrations_card2_title",
                  titleVal: content.home_coaching_frustrations_card2_title || "La marche sur des œufs",
                  descKey: "home_coaching_frustrations_card2_desc",
                  descVal: content.home_coaching_frustrations_card2_desc || "Ton quotidien est dicté par l'humeur de l'autre. Tu adaptes tes mots, tes choix, tes vêtements et tes comportements pour éviter la prochaine explosion ou le prochain silence punitif."
                },
                {
                  num: "03",
                  titleKey: "home_coaching_frustrations_card3_title",
                  titleVal: content.home_coaching_frustrations_card3_title || "L'isolement invisible",
                  descKey: "home_coaching_frustrations_card3_desc",
                  descVal: content.home_coaching_frustrations_card3_desc || "Sans t'en rendre compte, tu t'es éloigné(e) de tes amis, de ta famille ou de tes passions pour te focaliser exclusivement sur la satisfaction d'un pôle toxique insatiable."
                },
                {
                  num: "04",
                  titleKey: "home_coaching_frustrations_card4_title",
                  titleVal: content.home_coaching_frustrations_card4_title || "L'épuisement biologique",
                  descKey: "home_coaching_frustrations_card4_desc",
                  descVal: content.home_coaching_frustrations_card4_desc || "Ton corps envoie des signaux d'alerte massifs (insomnies, crises d'angoisse, fatigue chronique, sensation d'étouffement). Tu es en état d'hypervigilance 24h/24."
                }
              ].map((card) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  key={card.num}
                  className="p-8 bg-white border border-stone-200/50 rounded-2xl transition-all duration-300 group text-left shadow-sm"
                >
                  <div className="flex gap-4">
                    <span className="font-serif text-xl font-black text-sage/40 transition-colors mt-1">{card.num}</span>
                    <div className="space-y-3">
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-stone-deep">
                        <EditableText
                          settingKey={card.titleKey}
                          value={card.titleVal}
                          as="span"
                        />
                      </h3>
                      <p className="text-stone-600 font-light text-sm leading-relaxed">
                        <EditableText
                          settingKey={card.descKey}
                          value={card.descVal}
                          as="span"
                        />
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Hard Truth Quote */}
            <div className="border-l-4 border-sage pl-6 pt-2 text-left">
              <p className="text-sage text-lg md:text-xl font-medium leading-relaxed italic">
                <EditableText
                  settingKey="home_coaching_frustrations_p1"
                  value={content.home_coaching_frustrations_p1 || "La vérité brute : On ne guérit pas d'une relation toxique par le simple passage du temps. On en guérit en comprenant les codes du bourreau et en appliquant une contre-stratégie implacable."}
                  as="span"
                />
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── SECTION 3: LA DOUBLE LÉGITIMITÉ ─────────────────────────── */}
      <section className="py-24 px-6 md:px-12 lg:px-20 bg-[#13071A] text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Text & Quote */}
          <div className="lg:col-span-7 space-y-12">
            
            {/* Header block */}
            <div className="space-y-4 text-left">
              <span className="text-sage text-[11px] font-black uppercase tracking-widest block">
                <EditableText
                  settingKey="home_coaching_expertise_eyebrow"
                  value={content.home_coaching_expertise_eyebrow || "De la Clinique au Terrain"}
                  as="span"
                />
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
                <EditableText
                  settingKey="home_coaching_expertise_title"
                  value={content.home_coaching_expertise_title || "Pourquoi mon Approche fait Autorité"}
                  as="span"
                />
              </h2>
              <p className="text-white/70 font-light text-base md:text-lg leading-relaxed pt-2">
                <EditableText
                  settingKey="home_coaching_expertise_text1"
                  value={content.home_coaching_expertise_text1 || "Le marché de l'accompagnement regorge de théories abstraites et de conseils génériques. Face à la perversion, à la manipulation fine ou à des profils psychotiques installés, la théorie pure s'effondre. Mon expertise unique s'appuie sur deux piliers indéboulonnables :"}
                  as="span"
                />
              </p>
            </div>

            {/* Pillars explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
              
              {/* Column 1: Clinic */}
              <div className="space-y-4 p-8 bg-[#1B0B24] border border-white/5 rounded-2xl shadow-inner hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-white">6 ans d'expérience en tant que Thérapeute</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">
                  <EditableText
                    settingKey="home_coaching_expertise_text2"
                    value={content.home_coaching_expertise_text2 || "Durant ces années de pratique intense en cabinet, j'ai disséqué la psyché humaine, soigné les traumas complexes et développé des protocoles précis de reconstruction identitaire. Je sais scientifiquement ce qu'il se passe dans ton cerveau sous emprise."}
                    as="span"
                  />
                </p>
              </div>

              {/* Column 2: Terrain */}
              <div className="space-y-4 p-8 bg-[#1B0B24] border border-white/5 rounded-2xl shadow-inner hover:border-white/10 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center text-sage">
                  <Heart className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl font-bold text-white">Une immersion personnelle depuis toujours</h3>
                <p className="text-white/60 font-light text-sm leading-relaxed">
                  <EditableText
                    settingKey="home_coaching_expertise_text3"
                    value={content.home_coaching_expertise_text3 || "Les personnalités toxiques et les structures psychotiques ne sont pas pour moi des chapitres de manuels universitaires. Je les ai côtoyées, subies et analysées au sein même de ma propre structure familiale. Ce système, je l'ai vécu dans ma chair. J'en ai décodé les rouages secrets et j'ai appris à m'en libérer définitivement."}
                    as="span"
                  />
                </p>
              </div>

            </div>

            {/* Statement quote box */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-8 sm:p-12 bg-white text-stone-deep rounded-[2rem] overflow-hidden shadow-2xl text-left border border-stone-200/10"
            >
              {/* Soft spun brand gradient behind */}
              <div className="absolute right-[-10%] bottom-[-20%] w-[350px] h-[350px] rounded-full brand-ring-gradient opacity-10 blur-2xl pointer-events-none" />
              
              <div className="relative z-10 max-w-3xl space-y-6">
                <p className="font-serif text-lg sm:text-xl md:text-2xl font-bold italic leading-relaxed text-stone-deep">
                  <EditableText
                    settingKey="home_coaching_expertise_quote"
                    value={content.home_coaching_expertise_quote || "« Je ne vais pas me contenter de t'accueillir et de hocher la tête. Je sais exactement où fait mal le piège, je connais les verrous psychologiques de ton agresseur, et je possède la clé tactique pour les faire sauter. »"}
                    as="span"
                  />
                </p>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-px bg-sage" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                    <EditableText
                      settingKey="home_coaching_expertise_author"
                      value={content.home_coaching_expertise_author || "Matthieu Le Tousse"}
                      as="span"
                    />
                    {" — "}
                    <EditableText
                      settingKey="home_coaching_expertise_author_title"
                      value={content.home_coaching_expertise_author_title || "Ancien Thérapeute & Coach de Posture"}
                      as="span"
                    />
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Premium Image Zone showcasing the Coach */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative w-full max-w-[400px] aspect-[4/5]"
            >
              {/* Glowing colored overlay border */}
              <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-tr from-sage via-copper to-[#EC3875] opacity-20 blur-lg animate-pulse" />
              
              <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden bg-[#1B0B24] border border-white/5 shadow-2xl group">
                <EditableImage
                  settingKey="home_legitimacy_side_photo"
                  src={pageImages.home_legitimacy_side_photo || "/images/photo2.webp"}
                  alt="Matthieu Le Tousse - Cabinet Thérapeutique"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700"
                  onError={(e) => handleImageError(e, "/images/photo2.webp")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 to-transparent opacity-50 pointer-events-none" />
              </div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ─── SECTION 4: LE PROGRAMME PHARE (L'Arsenal Tactique) ───────── */}
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-20 bg-paper text-stone-deep">
        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* Header block */}
          <div className="max-w-3xl space-y-4 text-left">
            <span className="text-sage text-[11px] font-black uppercase tracking-widest block">
              <EditableText
                settingKey="home_coaching_prog_eyebrow"
                value={content.home_coaching_prog_eyebrow || "L'Arsenal Tactique"}
                as="span"
              />
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-stone-deep leading-tight">
              <EditableText
                settingKey="home_coaching_prog_title"
                value={content.home_coaching_prog_title || "La Feuille de Route Stratégique pour Briser l'Emprise"}
                as="span"
              />
            </h2>
            <p className="text-stone-600 font-light text-base md:text-lg leading-relaxed pt-2">
              <EditableText
                settingKey="home_coaching_prog_desc"
                value={content.home_coaching_prog_desc || "Un système d'accompagnement complet et pas-à-pas, validé par mon expérience clinique et conçu pour te redonner tes armes psychologiques, émotionnelles et comportementales."}
                as="span"
              />
            </p>
          </div>

          {/* Banner Image */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full h-64 md:h-96 rounded-[2rem] overflow-hidden border border-stone-200/50 relative group shadow-2xl bg-white"
          >
            <EditableImage
              settingKey="home_prog_banner_image"
              src={pageImages.home_prog_banner_image || "/images/livre-quote-bg.webp"}
              alt="La Feuille de Route Stratégique"
              className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-1000 filter saturate-[0.8] group-hover:saturate-100"
              onError={(e) => handleImageError(e, "/images/livre-quote-bg.webp")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-paper/85 via-transparent to-paper/10 pointer-events-none" />
          </motion.div>

          {/* Modules Grid (3x2 layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 text-left">
            
            {[
              {
                num: "01",
                titleKey: "home_coaching_prog_module1_title",
                titleVal: content.home_coaching_prog_module1_title || "Module 1 : Le Point de Départ — Mindset Impénétrable",
                descKey: "home_coaching_prog_module1_desc",
                descVal: content.home_coaching_prog_module1_desc || "Inversion immédiate de la polarité psychologique. Sortir définitivement du costume de victime passive pour endosser la posture d'acteur souverain de ta délivrance. Reprendre les commandes absolues de ton flux de pensées et couper l'accès à ta jauge émotionnelle."
              },
              {
                num: "02",
                titleKey: "home_coaching_prog_module2_title",
                titleVal: content.home_coaching_prog_module2_title || "Module 2 : Sortir du Brouillard Mental",
                descKey: "home_coaching_prog_module2_desc",
                descVal: content.home_coaching_prog_module2_desc || "Dissipation de la confusion instillée par le manipulateur. Poser des concepts cliniques précis sur chaque agression, chaque inversion de culpabilité, pour valider ta propre réalité, poser des mots sur tes maux et cesser d'auto-saboter tes jugements."
              },
              {
                num: "03",
                titleKey: "home_coaching_prog_module3_title",
                titleVal: content.home_coaching_prog_module3_title || "Module 3 : Le Protocole de Défense & Contre-Communication",
                descKey: "home_coaching_prog_module3_desc",
                descVal: content.home_coaching_prog_module3_desc || "Mise en place de remparts comportementaux infranchissables. Apprentissage des techniques de communication de crise (méthode de la roche grise, scripts de réponse courts) pour neutraliser, court-circuiter et désamorcer les attaques et provocations de la personnalité toxique au quotidien."
              },
              {
                num: "04",
                titleKey: "home_coaching_prog_module4_title",
                titleVal: content.home_coaching_prog_module4_title || "Module 4 : Le Sevrage Neuro-Émotionnel",
                descKey: "home_coaching_prog_module4_desc",
                descVal: content.home_coaching_prog_module4_desc || "Briser l'addiction biologique à la relation. L'emprise crée un cycle de \"shoots\" chimiques destructeurs (alternance dopamine/cortisol). Ce module nettoie les ancrages neuro-biologiques profonds pour éteindre définitivement le manque, la nostalgie feinte et le risque de rechute."
              },
              {
                num: "05",
                titleKey: "home_coaching_prog_module5_title",
                titleVal: content.home_coaching_prog_module5_title || "Module 5 : Reconstruction de l'Identité & Estime Blindée",
                descKey: "home_coaching_prog_module5_desc",
                descVal: content.home_coaching_prog_module5_desc || "Redécouvrir qui tu es une fois le parasite relationnel extrait de ton système. Travail en profondeur de guérison sur l'enfant intérieur, recollement des morceaux de l'amour propre et réalignement total avec tes désirs, tes ambitions et tes valeurs fondamentales."
              },
              {
                num: "06",
                titleKey: "home_coaching_prog_module6_title",
                titleVal: content.home_coaching_prog_module6_title || "Module 6 : L'Immunisation Définitive",
                descKey: "home_coaching_prog_module6_desc",
                descVal: content.home_coaching_prog_module6_desc || "Création d'un bouclier psychologique à vie. Reprogrammation de tes schémas inconscients pour détecter les profils prédateurs et manipulateurs à des kilomètres. Tu imposes tes limites de manière automatique, garantissant que plus jamais personne ne piétine ton territoire."
              }
            ].map((mod) => (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                key={mod.num} 
                className="p-8 bg-white border border-stone-200/50 rounded-2xl transition-all duration-300 flex flex-col gap-5 shadow-sm"
              >
                <div className="font-serif text-5xl font-black text-sage/20 leading-none">
                  {mod.num}
                </div>
                <h3 className="font-serif text-lg font-bold text-stone-deep leading-tight">
                  <EditableText
                    settingKey={mod.titleKey}
                    value={mod.titleVal}
                    as="span"
                  />
                </h3>
                <p className="text-stone-600 font-light text-sm leading-relaxed">
                  <EditableText
                    settingKey={mod.descKey}
                    value={mod.descVal}
                    as="span"
                  />
                </p>
              </motion.div>
            ))}

          </div>

          {/* Module Action button */}
          <div className="flex justify-center pt-8">
            <Link
              href="/a-propos"
              className="group inline-flex items-center gap-3 btn-pink-to-purple text-white font-bold text-xs uppercase tracking-widest py-4 px-10 rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-[#EC3875]/20"
            >
              <EditableText
                settingKey="home_coaching_prog_cta"
                value={content.home_coaching_prog_cta || "POSTULER AU PROGRAMME ARSENAL TACTIQUE"}
                as="span"
              />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </div>
      </section>

      {/* ─── SECTION 5: LA FOIRE AUX QUESTIONS (SEO Google) ─────────────── */}
      <section className="py-24 px-6 md:px-12 lg:px-20 bg-[#13071A] text-white">
        <div className="max-w-4xl mx-auto space-y-16">
          
          {/* Header block */}
          <div className="text-center space-y-4">
            <span className="text-sage text-[11px] font-black uppercase tracking-widest block">
              <EditableText
                settingKey="home_coaching_faq_eyebrow"
                value={content.home_coaching_faq_eyebrow || "Questions Fréquentes"}
                as="span"
              />
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
              <EditableText
                settingKey="home_coaching_faq_title"
                value={content.home_coaching_faq_title || "FAQ — Réponses Claires sur l'Emprise et l'Accompagnement"}
                as="span"
              />
            </h2>
          </div>

          {/* Accordion Questions */}
          <div className="space-y-4 pt-4">
            
            {[
              {
                qKey: "home_coaching_faq_q1",
                qVal: content.home_coaching_faq_q1 || "Comment savoir si je suis dans une relation toxique ou si le problème vient de moi ?",
                rKey: "home_coaching_faq_r1",
                rVal: content.home_coaching_faq_r1 || "C’est la question centrale induite par la manipulation. Si vous passez votre temps à vous remettre en question, à ressentir une culpabilité sourde et à analyser frénétiquement les moindres variations d'humeur de l'autre pour éviter un conflit, vous êtes sous emprise. Le profil toxique ne se remet jamais en question. Le simple fait que vous vous posiez cette question est la preuve clinique que le dysfonctionnement ne vient pas de votre nature."
              },
              {
                qKey: "home_coaching_faq_q2",
                qVal: content.home_coaching_faq_q2 || "Quelle est la différence entre votre passé de thérapeute et ce coaching axé sur les résultats ?",
                rKey: "home_coaching_faq_r2",
                rVal: content.home_coaching_faq_r2 || "La thérapie traditionnelle cherche principalement à comprendre le \"pourquoi\" et s'inscrit souvent dans un temps long d'introspection. Mon approche de coaching axée sur l'Arsenal Tactique utilise mes 6 ans de bagage clinique pour identifier le mécanisme instantanément, mais bascule immédiatement sur le \"comment\". Nous mettons en place des protocoles d'action, des scripts de communication et des verrous émotionnels pour obtenir des résultats factuels, mesurables et rapides."
              },
              {
                qKey: "home_coaching_faq_q3",
                qVal: content.home_coaching_faq_q3 || "Peut-on réellement se réparer après avoir partagé la vie d'une personnalité psychotique ou perverse ?",
                rKey: "home_coaching_faq_r3",
                rVal: content.home_coaching_faq_r3 || "Oui, absolument. Le traumatisme lié à une structure perverse ou psychotique agit comme un véritable piratage de votre système nerveux et cognitif. En appliquant un protocole strict de sevrage neuro-émotionnel et en reprogrammant vos schémas identitaires (les modules 4 et 5 de mon programme), vous pouvez non seulement retrouver votre état initial, mais développer une immunité et une clarté intérieures bien supérieures à celles que vous aviez avant la rencontre."
              },
              {
                qKey: "home_coaching_faq_q4",
                qVal: content.home_coaching_faq_q4 || "Mon ex-partenaire ou membre de ma famille est-il un pervers narcissique ou un psychotique ?",
                rKey: "home_coaching_faq_r4",
                rVal: content.home_coaching_faq_r4 || "Poser un diagnostic psychiatrique formel demande du temps, mais les dynamiques destructrices restent identiques : absence totale d'empathie, paranoïa constructive, inversion de la culpabilité, cycles de séduction et de destruction. Ensemble, durant nos sessions, nous analysons la typologie des comportements factuels pour adapter le protocole de défense le plus efficace possible, sans perdre de temps en spéculations stériles."
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-[#1B0B24] border border-white/5 rounded-xl overflow-hidden shadow-sm transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-5 sm:px-8 text-left font-serif text-base sm:text-lg font-black text-white flex items-center justify-between gap-4 transition-colors cursor-pointer"
                >
                  <EditableText
                    settingKey={faq.qKey}
                    value={faq.qVal}
                    as="span"
                  />
                  <ChevronDown 
                    className={`w-5 h-5 text-stone-400 shrink-0 transition-transform duration-300 ${
                      openFaq === idx ? 'rotate-180 text-sage' : ''
                    }`} 
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 sm:px-8 sm:pb-8 border-t border-white/5 pt-4 text-white/70 font-light text-sm sm:text-base leading-relaxed">
                        <EditableText
                          settingKey={faq.rKey}
                          value={faq.rVal}
                          as="span"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* ─── SECTION 6: L'APPEL FINAL À LA LIBÉRATION (Fermeture) ───────── */}
      <section className="relative py-32 md:py-40 px-6 text-center bg-paper text-stone-deep overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto space-y-12">
          
          <div className="space-y-6">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-stone-deep leading-tight">
              <EditableText
                settingKey="home_coaching_cta_title"
                value={content.home_coaching_cta_title || "Ne laisse plus un profil destructeur écrire les chapitres de ta vie"}
                as="span"
              />
            </h2>
            
            <p className="text-stone-600 font-light text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              <EditableText
                settingKey="home_coaching_cta_desc"
                value={content.home_coaching_cta_desc || "Chaque jour passé dans la confusion, le doute ou l'attente d'un changement qui n'arrivera jamais est un jour volé à ta liberté et à ton avenir. Tu possèdes désormais la preuve qu'un chemin clair, codifié et encadré par un professionnel qui a vécu cette reality existe."}
                as="span"
              />
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Link
              href="/a-propos"
              className="group inline-flex items-center gap-3 btn-pink-to-purple text-white font-bold text-xs uppercase tracking-widest py-5 px-10 rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-xl shadow-[#EC3875]/20"
            >
              <EditableText
                settingKey="home_coaching_cta_button"
                value={content.home_coaching_cta_button || "DEMANDER MON ENTRETIEN STRATÉGIQUE PRIVÉ"}
                as="span"
              />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <p className="text-stone-500 text-xs font-light max-w-lg leading-relaxed pt-2">
              <EditableText
                settingKey="home_coaching_cta_invite"
                value={content.home_coaching_cta_invite || "Le premier pas ne demande aucun courage, juste une décision : celle de parler à quelqu'un qui te croit, qui te comprend, et qui sait exactement comment te sortir de là."}
                as="span"
              />
            </p>
          </div>

        </div>
      </section>

      {/* ─── SECTION 7: HUB D'AUTORITÉ MÉDIA (Validation E-E-A-T) ───────── */}
      <section className="py-24 px-6 md:px-12 lg:px-20 bg-[#13071A] text-white">
        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* Header block */}
          <div className="max-w-3xl space-y-4">
            <span className="text-sage text-[11px] font-black uppercase tracking-widest block">
              <EditableText
                settingKey="home_coaching_media_eyebrow"
                value={content.home_coaching_media_eyebrow || "Au-delà des Chaînes"}
                as="span"
              />
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
              <EditableText
                settingKey="home_coaching_media_title"
                value={content.home_coaching_media_title || "L'Expertise Multimédia au Service de ta Clarté"}
                as="span"
              />
            </h2>
            <p className="text-white/70 font-light text-base md:text-lg leading-relaxed pt-2">
              <EditableText
                settingKey="home_coaching_media_desc"
                value={content.home_coaching_media_desc || "Avant d'engager un changement ou de poser un acte de rupture, tu as besoin de certitudes et de clés de décodage. À travers mes canaux d'analyse, je décortique chaque semaine les profils complexes et les dynamiques de manipulation psychologique pour t'apporter des réponses là où régnait le chaos."}
                as="span"
              />
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            
            {/* Podcast Card */}
            <motion.div 
              whileHover={{ y: -6 }}
              className="group relative p-8 sm:p-10 bg-[#1B0B24] border border-white/5 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 rounded-bl-full bg-sage/5 transition-colors pointer-events-none" />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center text-sage">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Audio Immersif</span>
                </div>
                
                {/* Podcast Cover Image zone */}
                <div className="w-full h-44 rounded-2xl overflow-hidden relative shadow-inner bg-[#1B0B24] border border-white/5">
                  <EditableImage
                    settingKey="home_podcast_cover"
                    src={pageImages.home_podcast_cover || "/images/livre-quote-bg.webp"}
                    alt="Au-delà des Chaînes Podcast Cover"
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 filter saturate-[0.8] group-hover:saturate-100"
                    onError={(e) => handleImageError(e, "/images/livre-quote-bg.webp")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent opacity-85 pointer-events-none" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-serif text-xl sm:text-2xl font-black text-white transition-colors">
                    <EditableText
                      settingKey="home_coaching_podcast_title"
                      value={content.home_coaching_podcast_title || "Le Podcast \"Au-delà des Chaînes\""}
                      as="span"
                    />
                  </h3>
                  <p className="text-white/60 font-light text-sm sm:text-base leading-relaxed">
                    <EditableText
                      settingKey="home_coaching_podcast_desc"
                      value={content.home_coaching_podcast_desc || "L'espace audio immersif pour plonger en profondeur dans les mécaniques invisibles de l'emprise. Des épisodes denses et sans tabou pour comprendre la psyché des manipulateurs, analyser le trauma et entamer un sevrage émotionnel durable."}
                      as="span"
                    />
                  </p>
                </div>
              </div>

              <div className="pt-8">
                <a
                  href="https://open.spotify.com/show/3SNRWk1SNRzGaS2qQAsOF4?si=a02307e8109c4d95"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-black text-sage hover:text-white transition-colors"
                >
                  <EditableText
                    settingKey="home_coaching_podcast_cta"
                    value={content.home_coaching_podcast_cta || "➔ Écouter sur Apple Podcast & Spotify"}
                    as="span"
                  />
                </a>
              </div>
            </motion.div>

            {/* YouTube Card */}
            <motion.div 
              whileHover={{ y: -6 }}
              className="group relative p-8 sm:p-10 bg-[#1B0B24] border border-white/5 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 rounded-bl-full bg-[#ff0000]/5 transition-colors pointer-events-none" />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#ff0000]/10 flex items-center justify-center text-[#ff0000]">
                    <Youtube className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Analyses Vidéo</span>
                </div>

                {/* YouTube Cover Image zone */}
                <div className="w-full h-44 rounded-2xl overflow-hidden relative shadow-inner bg-[#1B0B24] border border-white/5">
                  <EditableImage
                    settingKey="home_youtube_cover"
                    src={pageImages.home_youtube_cover || "/images/photo4.webp"}
                    alt="YouTube Video Cover"
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 filter saturate-[0.8] group-hover:saturate-100"
                    onError={(e) => handleImageError(e, "/images/photo4.webp")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent opacity-85 pointer-events-none" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-serif text-xl sm:text-2xl font-black text-white transition-colors">
                    <EditableText
                      settingKey="home_coaching_youtube_title"
                      value={content.home_coaching_youtube_title || "📺 La Chaîne YouTube"}
                      as="span"
                    />
                  </h3>
                  <p className="text-white/60 font-light text-sm sm:text-base leading-relaxed">
                    <EditableText
                      settingKey="home_coaching_youtube_desc"
                      value={content.home_coaching_youtube_desc || "Des analyses cliniques et des décryptages chirurgicaux des personnalités toxiques, perverses et des structures psychotiques. Des vidéos concrètes et imagées pour cesser de douter de ta propre réalité et identifier les pièges comportementaux."}
                      as="span"
                    />
                  </p>
                </div>
              </div>

              <div className="pt-8">
                <a
                  href="https://www.youtube.com/@audeladeschaines"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-black text-[#ff0000] hover:text-white transition-colors"
                >
                  <EditableText
                    settingKey="home_coaching_youtube_cta"
                    value={content.home_coaching_youtube_cta || "➔ Regarder les dernières analyses vidéo"}
                    as="span"
                  />
                </a>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* ─── AVIS & NEWSLETTER BANNER (E-E-A-T & list building) ───────── */}
      <GoogleReviews bg="#FAF9FB" theme="light" />
      <NewsletterBanner bg="#13071A" theme="dark" />
    </div>
  );
}
