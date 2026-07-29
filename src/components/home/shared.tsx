"use client";

import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import EditableImage from '../pagebuilder/EditableImage';

export const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

export const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const } 
  },
};
export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ── 3D Tilt Card wrapper (desktop only) ──────────────────────────────────────
export function TiltCard({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [12, -12]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-12, 12]), { stiffness: 120, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX / rect.width);
    y.set(mouseY / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 32, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const }}
      style={{
        rotateX: isMobile ? 0 : rotateX,
        rotateY: isMobile ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className={className}
    >
      <div style={{ transform: 'translateZ(12px)', transformStyle: 'preserve-3d' }} className="w-full h-full">
        {children}
      </div>
    </motion.div>
  );
}

// ── Magnetic button (desktop only) ───────────────────────────────────────────
export function MagneticButton({
  href, children, className,
}: { href: string; children: React.ReactNode; className?: string }) {
  if (isMobile) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <MagneticButtonDesktop href={href} className={className}>{children}</MagneticButtonDesktop>;
}

function MagneticButtonDesktop({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18 });
  const springY = useSpring(y, { stiffness: 200, damping: 18 });

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.3);
    y.set((e.clientY - r.top - r.height / 2) * 0.3);
  }, [x, y]);

  const onLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);

  return (
    <motion.a
      ref={btnRef}
      href={href}
      style={{ x: springX, y: springY }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileTap={{ scale: 0.95 }}
      className={className}
    >
      {children}
    </motion.a>
  );
}

// ── Marquee strip ─────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  'Accompagnement Spirituel', 'Analyse des Rêves', 'Connaissance de Soi',
  'Traversée des Ombres', 'Psychologie Jungienne', 'Régulation Nerveuse',
  'Deuil & Transformation',
];

export function MarqueeStrip() {
  return (
    <div className="py-3 bg-stone-900 overflow-hidden border-y border-stone-800 select-none">
      <div className="marquee-track flex items-center gap-10 whitespace-nowrap">
        {[...Array(2)].map((_, i) => (
          <span key={i} className="flex items-center gap-10">
            {MARQUEE_ITEMS.map((text, j) => (
              <React.Fragment key={j}>
                <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-stone-400">{text}</span>
                <span className="text-sage text-base leading-none">✦</span>
              </React.Fragment>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Scale-reveal image ────────────────────────────────────────────────────────
export function RevealImage({ src, alt, className, onError, width, height, settingKey }: {
  src: string; alt: string; className?: string; settingKey?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  width?: number; height?: number;
}) {
  return (
    <motion.div
      className="overflow-hidden w-full h-full"
      initial={{ scale: 1.08 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 1.3, ease: [0.76, 0, 0.24, 1] as const }}
    >
      <EditableImage settingKey={settingKey} src={src} alt={alt} className={className} onError={onError}
            loading="lazy" decoding="async" width={width} height={height} />
    </motion.div>
  );
}

// ── Animated section heading ──────────────────────────────────────────────────
export function AnimatedHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  const wordVariants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)', 
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } 
    },
  };
  return (
    <motion.h2
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
    >
      {typeof children === 'string'
        ? children.split(' ').map((w, i) => (
            <motion.span key={i} className="inline-block mr-[0.25em]" variants={wordVariants}>{w}</motion.span>
          ))
        : <motion.span className="inline-block" variants={wordVariants}>{children}</motion.span>
      }
    </motion.h2>
  );
}
