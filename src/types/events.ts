export type EventStatus = 'published' | 'draft' | 'paused';
export type EventCategory = 'retraite_spirituelle' | 'atelier_groupe' | 'module' | 'evenement_regulier';
export type PaymentType = 'full' | 'installment';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface SdeEvent {
  id: string;
  title: string;
  slug: string;
  category: EventCategory;
  excerpt: string | null;
  description: string | null;
  date_start: string | null;
  date_end: string | null;
  time_start: string | null;
  time_end: string | null;
  location: string;
  address: string | null;
  price_chf: number;
  max_participants: number | null;
  image_url: string | null;
  status: EventStatus;
  // Visio
  is_online: boolean;
  visio_url: string | null;
  // Récurrence
  is_recurring: boolean;
  recurrence_sessions: number | null;
  recurrence_day: string | null;
  recurrence_description: string | null;
  // Tarif
  discount_label: string | null;
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  stripe_session_id: string | null;
  amount_chf: number;
  created_at: string;
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  retraite_spirituelle: 'Retraite spirituelle',
  atelier_groupe: 'Atelier en groupe',
  module: 'Module',
  evenement_regulier: 'Événement régulier',
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  retraite_spirituelle: 'bg-violet-100 text-violet-800',
  atelier_groupe: 'bg-emerald-50 text-emerald-700',
  module: 'bg-amber-100 text-amber-700',
  evenement_regulier: 'bg-stone-100 text-stone-600',
};

export const INSTALLMENT_THRESHOLD_CHF = 250;
