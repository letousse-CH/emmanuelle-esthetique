"use client";

import { useEffect } from 'react';

interface PageChromeProps {
  showHeader: boolean;
  showFooter: boolean;
}

export default function PageChrome({ showHeader, showFooter }: PageChromeProps) {
  useEffect(() => {
    const nav = document.querySelector('header, nav[data-main-nav]') as HTMLElement | null;
    const footer = document.querySelector('footer') as HTMLElement | null;

    if (nav) nav.style.display = showHeader ? '' : 'none';
    if (footer) footer.style.display = showFooter ? '' : 'none';

    return () => {
      if (nav) nav.style.display = '';
      if (footer) footer.style.display = '';
    };
  }, [showHeader, showFooter]);

  return null;
}
