interface PageChromeProps {
  showHeader: boolean;
  showFooter: boolean;
}

// Composant serveur : injecte le CSS de masquage avant l'hydratation pour
// éviter le flash du header/footer qu'un useEffect ne peut pas éviter.
export default function PageChrome({ showHeader, showFooter }: PageChromeProps) {
  const rules = [
    // --nav-h : sans barre, la première section ne doit pas garder la place de son repli (blocks.css).
    !showHeader && 'nav[data-main-nav]{display:none!important}:root{--nav-h:0px!important}',
    !showFooter && 'footer{display:none!important}',
  ].filter(Boolean).join('');

  if (!rules) return null;

  return <style dangerouslySetInnerHTML={{ __html: rules }} />;
}
