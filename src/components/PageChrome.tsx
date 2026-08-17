interface PageChromeProps {
  showHeader: boolean;
  showFooter: boolean;
}

// Composant serveur : injecte le CSS de masquage avant l'hydratation pour
// éviter le flash du header/footer qu'un useEffect ne peut pas éviter.
export default function PageChrome({ showHeader, showFooter }: PageChromeProps) {
  const rules = [
    !showHeader && 'nav[data-main-nav]{display:none!important}',
    !showFooter && 'footer{display:none!important}',
  ].filter(Boolean).join('');

  if (!rules) return null;

  return <style dangerouslySetInnerHTML={{ __html: rules }} />;
}
