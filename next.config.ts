import type { NextConfig } from "next";

// Domaine public du bucket R2 : l'optimiseur d'images (`/_next/image`) refuse
// tout hôte absent de `remotePatterns`. Le sous-domaine `pub-xxxx.r2.dev` est
// déjà couvert ; un domaine personnalisé doit être ajouté ici.
const r2Host = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL;
    return u ? new URL(u).hostname : '';
  } catch {
    return '';
  }
})();

const nextConfig: NextConfig = {
  // Second serveur de dev (`npm run dev:brouillons`) : dossier de build distinct
  // pour cohabiter avec `npm run dev`. Non défini en production.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    // Les images des pages sont hébergées sur R2, sans en-tête de cache, et
    // servies en taille d'origine : l'optimiseur les redimensionne, les passe en
    // WebP et les garde un an (les noms de fichiers portent un horodatage, une
    // image remplacée a donc une nouvelle URL).
    formats: ['image/webp'],
    minimumCacheTTL: 31536000,
    // `**.supabase.co` couvre le Storage de n'importe quel projet Supabase :
    // ne pas y recoder en dur l'hôte d'un projet précis.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      ...(r2Host ? [{ protocol: 'https' as const, hostname: r2Host }] : []),
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || "",
  },
  async redirects() {
    return [
      // SEO : les pages dynamiques ont une URL canonique unique à la racine
      // (/{slug}). L'ancienne URL /pages/{slug} (duplicata) redirige en 301
      // pour consolider le PageRank et éviter le contenu dupliqué.
      { source: '/pages/:slug', destination: '/:slug', permanent: true },
      // URL legacy de l'ancien site : aucune page ne répond plus. On redirige
      // pour préserver les backlinks externes et les emails déjà envoyés.
      // /contact a désormais sa propre page réelle (NAP + formulaire) — plus
      // de redirection vers /a-propos.
      { source: '/about', destination: '/a-propos', permanent: true },
    ];
  },
};

export default nextConfig;
