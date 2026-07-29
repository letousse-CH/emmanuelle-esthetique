export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  category: string | null;
  published: boolean;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  category: string;
  image: string;
  readTime: string;
}
