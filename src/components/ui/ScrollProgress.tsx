"use client";

import { motion, useScroll, useSpring } from 'motion/react';
import { useState, useEffect } from 'react';

export default function ScrollProgress() {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  if (isMobile) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] bg-sage z-[9999] origin-left"
      style={{ scaleX: progressScaleX }}
    />
  );
}
