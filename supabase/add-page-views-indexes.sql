-- Indexes pour les agrégations du dashboard analytics
-- Sans ces index, GROUP BY page et les filtres sur created_at font un full scan
-- au-delà de ~50k lignes → latence visible dans /admin

CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
