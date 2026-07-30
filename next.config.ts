import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // `**.supabase.co` couvre le Storage de n'importe quel projet Supabase :
    // ne pas y recoder en dur l'hôte d'un projet précis.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
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
