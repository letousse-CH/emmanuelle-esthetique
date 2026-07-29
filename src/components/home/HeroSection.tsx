"use client";

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { proxyUrl } from '../../utils/media';
import { isMobile, MagneticButton } from './shared';
import EditableText from '../pagebuilder/EditableText';
import EditableImage from '../pagebuilder/EditableImage';

const LOCAL_IMAGE = '/images/hero.jpg';
const HERO_CACHE = 'sde_hero_v1';

function readHeroCache(): { img: string; color: 'dark' | 'light' } {
  try {
    const raw = localStorage.getItem(HERO_CACHE);
    if (raw) {
      const data = JSON.parse(raw) as { img: string; color: 'dark' | 'light' };
      const url = proxyUrl(data.img.replace('/img/', '/medias/').split('?')[0]);
      return { img: url, color: data.color };
    }
  } catch {}
  return { img: LOCAL_IMAGE, color: 'dark' };
}

interface Props {
  content: Record<string, string>;
}

export default function HeroSection({ content }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  // Priorité : valeur SSR > cache localStorage > image locale
  const ssrImg     = content.hero_image   || '';
  const ssrColor   = (content.hero_text_color as 'dark' | 'light') || 'dark';
  const ssrOpacity = content.section_hero_opacity ? Number(content.section_hero_opacity) / 100 : 0.8;
  const [heroImg, setHeroImg]     = useState<string>(() => ssrImg || readHeroCache().img);
  const [heroColor, setHeroColor] = useState<'dark' | 'light'>(() => ssrColor || readHeroCache().color);

  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY       = useTransform(heroP, [0, 1], isMobile ? ['0%', '0%'] : ['0%', '25%']);
  const heroOpacity = useTransform(heroP, [0, 0.85], isMobile ? [1, 1] : [1, 0]);

  const imgErr = useCallback((e: React.SyntheticEvent<HTMLImageElement>, fb: string) => {
    e.currentTarget.src = fb;
    e.currentTarget.onerror = null;
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    import('../../services/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
      supabase.auth.onAuthStateChange((_e, session) => setIsAdmin(!!session));
      
      // Met à jour le localStorage pour la cohérence entre sessions
      supabase
        .from('settings')
        .select('key, value')
        .in('key', ['hero_image', 'hero_text_color'])
        .then(({ data }) => {
          if (data) {
            const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
            const newImg   = map.hero_image ? proxyUrl(map.hero_image) : heroImg;
            const newColor = (map.hero_text_color as 'dark' | 'light') || heroColor;
            localStorage.setItem(HERO_CACHE, JSON.stringify({ img: newImg, color: newColor }));
          }
        });
    });
  }, []);

  return (
    <header
      ref={heroRef}
      className="relative flex justify-center text-center px-6 overflow-hidden bg-stone-50"
      style={{ height: '100svh', minHeight: '600px', alignItems: 'safe center' }}
    >
      {/* Parallax background */}
      <motion.div
        className={`absolute inset-0 z-0${isMobile ? ' hero-bg-zoom' : ''}`}
        style={{ y: isMobile ? undefined : heroY }}
        initial={isMobile ? false : { scale: 1.08 }}
        animate={isMobile ? false : { scale: 1 }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
      >
        {heroImg === LOCAL_IMAGE ? (
          <picture>
            <source media="(max-width: 768px)" srcSet="/images/hero-800.webp" type="image/webp" />
            <source srcSet="/images/hero-1400.webp" type="image/webp" />
            <source media="(max-width: 768px)" srcSet="/images/hero-800.jpg" />
            <EditableImage
              settingKey="hero_image"
              src="/images/hero-1400.jpg"
              alt="Ambiance Semeur d'Eveil"
              className="w-full h-[115%] object-cover" style={{ opacity: ssrOpacity }}
              width={1920}
              height={1080}
            />
          </picture>
        ) : (
          <EditableImage
            settingKey="hero_image"
            src={heroImg}
            onError={(e: any) => imgErr(e, 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2000&auto=format&fit=crop')}
            alt="Ambiance Semeur d'Eveil"
            className="w-full h-[115%] object-cover" style={{ opacity: ssrOpacity }}
            referrerPolicy="no-referrer"
            width={1920}
            height={1080}
          />
        )}
        <div className={`absolute inset-0 pointer-events-none ${heroColor === 'dark' ? 'bg-gradient-to-b from-stone-50/10 via-transparent to-stone-50/60' : 'bg-gradient-to-b from-stone-900/20 via-stone-900/30 to-stone-900/60'}`} />
      </motion.div>

      {/* Grain texture */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 max-w-4xl pt-28 pb-8"
        style={isMobile ? undefined : { opacity: heroOpacity as any }}
      >
        <div className={isMobile ? 'hero-fade-in' : ''}>
          {!isMobile ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <span className={`font-bold tracking-[0.35em] uppercase text-[10px] mb-6 block ${heroColor === 'dark' ? 'text-sage' : 'text-white/60'}`}>Semeur d'Eveil</span>
            </motion.div>
          ) : (
            <span className={`font-bold tracking-[0.35em] uppercase text-[10px] mb-6 block ${heroColor === 'dark' ? 'text-sage' : 'text-white/60'}`}>Semeur d'Eveil</span>
          )}
        </div>

        {isMobile ? (
          <h1 className={`hero-fade-up-1 font-serif text-6xl font-bold tracking-tight mb-8 leading-[1.05] ${heroColor === 'dark' ? 'text-stone-900' : 'text-white'}`}>
            <EditableText settingKey="home_hero_line1" value={content.home_hero_line1} /><br />
            <span className={`italic font-light ${heroColor === 'dark' ? 'text-sage' : 'text-white/85'}`}>
              <EditableText settingKey="home_hero_line2" value={content.home_hero_line2} />
            </span>
          </h1>
        ) : (
          <motion.h1
            className={`font-serif text-6xl md:text-[5.5rem] font-bold tracking-tight mb-8 leading-[1.05] ${heroColor === 'dark' ? 'text-stone-900' : 'text-white'}`}
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } }}
          >
            {isAdmin ? (
              <EditableText settingKey="home_hero_line1" value={content.home_hero_line1} />
            ) : (
              content.home_hero_line1.split(' ').map((w, i) => (
                <motion.span key={i} className="inline-block mr-[0.25em]"
                  variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] as const } } }}>
                  {w}
                </motion.span>
              ))
            )}
            <br />
            <motion.span
              className={`italic font-light inline-block ${heroColor === 'dark' ? 'text-sage' : 'text-white/85'}`}
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] as const } } }}
            >
              <EditableText settingKey="home_hero_line2" value={content.home_hero_line2} />
            </motion.span>
          </motion.h1>
        )}

        {isMobile ? (
          <p className={`hero-fade-up-2 text-xl mb-14 max-w-2xl mx-auto leading-relaxed font-light ${heroColor === 'dark' ? 'text-stone-600' : 'text-white/80'}`}>
            <EditableText settingKey="home_hero_description" value={content.home_hero_description} />
          </p>
        ) : (
          <motion.p
            className={`text-xl md:text-2xl mb-14 max-w-2xl mx-auto leading-relaxed font-light ${heroColor === 'dark' ? 'text-stone-600' : 'text-white/80'}`}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.75 }}
          >
            <EditableText settingKey="home_hero_description" value={content.home_hero_description} />
          </motion.p>
        )}

        {isMobile ? (
          <div className="flex flex-col items-center gap-6 mb-10 hero-fade-up-3">
            <a href="/programme-complet" className="w-full text-center bg-sage text-white px-14 py-5 rounded-full font-bold shadow-xl">Programme Complet</a>
            <a href="/seance-individuelle" className={`w-full text-center px-14 py-5 rounded-full font-bold shadow-lg ${heroColor === 'dark' ? 'bg-stone-900/5 text-stone-900 border border-stone-900/15' : 'bg-white/15 text-white border border-white/30'}`}>Séance Individuelle</a>
          </div>
        ) : (
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-10"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95 }}
          >
            <MagneticButton href="/programme-complet" className="w-full sm:w-auto bg-sage text-white px-14 py-5 rounded-full font-bold shadow-xl hover:bg-wood transition-colors duration-300">Programme Complet</MagneticButton>
            <MagneticButton href="/seance-individuelle" className={`w-full sm:w-auto backdrop-blur-sm px-14 py-5 rounded-full font-bold shadow-lg transition-colors duration-300 ${heroColor === 'dark' ? 'bg-stone-900/5 text-stone-900 border border-stone-900/15 hover:bg-stone-900/10' : 'bg-white/15 text-white border border-white/30 hover:bg-white/25'}`}>Séance Individuelle</MagneticButton>
          </motion.div>
        )}
      </div>

      {!isMobile && (
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-10 ${heroColor === 'dark' ? 'text-stone-400' : 'text-white/50'}`}
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      )}
    </header>
  );
}
