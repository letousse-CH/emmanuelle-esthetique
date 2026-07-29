import { Helmet } from 'react-helmet-async';

import { SITE_CONFIG } from '../config/site';

const SITE_NAME = SITE_CONFIG.name;
const BASE_URL = SITE_CONFIG.url;
const DEFAULT_IMAGE = SITE_CONFIG.seoDefaults.ogImage;
const DEFAULT_IMAGE_ALT = `Matthieu Le Tousse — ${SITE_CONFIG.name}, coaching relation toxique`;

interface ArticleMeta {
  publishedTime: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
}

interface OpenGraphProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'article' | 'book' | 'profile';
  article?: ArticleMeta;
}

export default function OpenGraph({
  title,
  description,
  url,
  image = DEFAULT_IMAGE,
  imageAlt = DEFAULT_IMAGE_ALT,
  imageWidth = 1200,
  imageHeight = 630,
  type = 'website',
  article,
}: OpenGraphProps) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const fullImage = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  return (
    <Helmet>
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:image:secure_url" content={fullImage} />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_CH" />
      <meta property="og:locale:alternate" content="fr_FR" />
      <meta property="og:locale:alternate" content="fr_BE" />

      {/* Article-specific */}
      {article && <meta property="article:author" content={article.author ?? 'Matthieu Le Tousse'} />}
      {article && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
      {article?.section && <meta property="article:section" content={article.section} />}

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Helmet>
  );
}
