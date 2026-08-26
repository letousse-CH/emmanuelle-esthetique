/**
 * Service d'Illustration Automatique pour Articles de Blog & Contenus Studio
 * Sélectionne une photo de couverture HD et 1 à 2 photos d'illustration internes contextuelles.
 */

export interface ArticleImagesResult {
  coverImage: string;
  inlineImages: string[];
}

const STOCK_HD_IMAGES = [
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
];

/**
 * Sélectionne automatiquement une image de couverture + 2 images d'illustration internes
 */
export function getAutomaticArticleImages(topic: string): ArticleImagesResult {
  const hash = Array.from(topic || 'studio').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const idx1 = hash % STOCK_HD_IMAGES.length;
  const idx2 = (hash + 3) % STOCK_HD_IMAGES.length;
  const idx3 = (hash + 7) % STOCK_HD_IMAGES.length;

  return {
    coverImage: STOCK_HD_IMAGES[idx1],
    inlineImages: [STOCK_HD_IMAGES[idx2], STOCK_HD_IMAGES[idx3]],
  };
}

/**
 * Injecte automatiquement des visuels d'illustration dans le corps HTML de l'article
 */
export function injectInlineImagesIntoContent(htmlContent: string, inlineImages: string[], title: string): string {
  if (!htmlContent) return htmlContent;
  
  const img1Html = `<figure className="my-8"><img src="${inlineImages[0]}" alt="${title} - Illustration" className="w-full h-auto rounded-2xl object-cover shadow-md max-h-96" /><figcaption className="text-center text-xs text-stone-500 mt-2 font-medium">Illustration : ${title}</figcaption></figure>`;
  const img2Html = `<figure className="my-8"><img src="${inlineImages[1] || inlineImages[0]}" alt="${title} - Visuel" className="w-full h-auto rounded-2xl object-cover shadow-md max-h-96" /></figure>`;

  // Injecter la première image après le 2ème paragraphe </p> ou </h2>
  let updated = htmlContent;
  if (updated.includes('</p>')) {
    const parts = updated.split('</p>');
    if (parts.length > 2) {
      parts[1] += `</p>${img1Html}`;
      if (parts.length > 5) {
        parts[4] += `</p>${img2Html}`;
      }
      updated = parts.join('</p>');
    } else {
      updated += img1Html;
    }
  } else {
    updated += img1Html;
  }

  return updated;
}
