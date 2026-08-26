"use client";

import React, { useState, useEffect } from 'react';
import AiKeyPanel from './AiKeyPanel';
import ApiKeysPanel from './ApiKeysPanel';
import DesignSystemPanel from './DesignSystemPanel';
import EditorialVoiceInterviewModal from './EditorialVoiceInterviewModal';
import FleetManagerPanel from './FleetManagerPanel';
import { supabase } from '../../../services/supabase';
import { Save, Lock, Tag, Image, X, Check, Sun, Moon, Palette, Type, Sliders, Eye, RefreshCw, Share2, Puzzle, Building2, Sparkles, AlertTriangle, BookOpen, CreditCard, Mic, ShieldCheck, Server, ExternalLink, KeyRound } from 'lucide-react';
import { settingsCache } from '../../../hooks/useSettings';
import { SETTINGS_DEFAULTS } from '../../../constants/settings';
import { AI_EFFORT_LEVELS, AI_MODELS, AiEffort, AiModelSpec, DEFAULT_AI_EFFORT, DEFAULT_AI_MODEL } from '../../../constants/aiModels';
import { MODULE_SETTING_KEYS } from '../../../config/modules';
import { PageHeader, SideNav, type TabItem } from '../../../components/admin/ui';

/**
 * Les rubriques de réglages, dans l'ordre où on s'en sert : ce qui identifie
 * l'entreprise d'abord, ce qui la fait parler ensuite, l'outillage enfin.
 * Chaque description dit ce qu'on trouve derrière — un intitulé seul
 * (« Général », « Modules ») n'apprend rien à quelqu'un qui découvre l'écran.
 */
const SETTINGS_SECTIONS: TabItem[] = [
  { id: 'business', label: 'Entreprise', icon: Building2,
    description: "Nom, adresse, téléphone, e-mail et code promo de bienvenue." },
  { id: 'general', label: 'Identité visuelle', icon: Image,
    description: 'Logos (principal & footer), visuel de pied de page et favicon.' },
  { id: 'style', label: 'Design & style', icon: Palette,
    description: 'Couleurs, polices, visuel du Hero, bouton du menu et rythme.' },
  { id: 'editorial', label: 'Éditorial & marque', icon: BookOpen,
    description: "Ce que l'IA doit savoir de votre activité et de votre ton." },
  { id: 'modules', label: 'Modules', icon: Puzzle,
    description: 'Activez ou masquez les grandes fonctions du site.' },
  { id: 'keys', label: 'Clés API & Services', icon: KeyRound,
    description: 'Anthropic Claude, Resend E-mails, Cloudflare R2, Bing IndexNow.' },
  { id: 'caisse', label: 'Caisse & TVA', icon: CreditCard,
    description: 'Taux de TVA, IBAN, mentions de facture et bons cadeaux.' },
  { id: 'fleet', label: 'Flotte Multi-Sites', icon: Server,
    description: 'Gérer et mettre à jour vos autres sites clients (ex: audeladeschaines.com) en 1-clic.' },
  { id: 'security', label: 'Sécurité', icon: Lock,
    description: 'Mot de passe du compte administrateur.' },
];

interface MediaAsset {
  id: string;
  url: string;
  alt_text: string;
}

export default function Settings() {

  // ── Mot de passe ─────────────────────────────────────────
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading]           = useState(false);
  const [pwdMessage, setPwdMessage]           = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Migration & Système ──────────────────────────────────
  const [migrating, setMigrating] = useState(false);
  const [migrateLog, setMigrateLog] = useState<{ success?: boolean; message?: string; error?: string; logs?: string[] } | null>(null);

  const handleAutoMigrate = async () => {
    setMigrating(true);
    setMigrateLog(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/auto-migrate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la migration');
      setMigrateLog(data);
    } catch (err: any) {
      setMigrateLog({ error: err?.message || 'Erreur lors de la synchronisation Supabase.' });
    } finally {
      setMigrating(false);
    }
  };

  // ── Hero section ──────────────────────────────────────────
  const [heroImage, setHeroImage]       = useState('');
  const [heroOpacity, setHeroOpacity]   = useState('70');
  const [heroColor, setHeroColor]       = useState<'dark' | 'light'>('dark');
  const [heroLoading, setHeroLoading]   = useState(false);
  const [heroFetching, setHeroFetching] = useState(true);
  const [heroMessage, setHeroMessage]   = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPicker, setShowPicker]     = useState(false);
  const [mediaAssets, setMediaAssets]   = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  // ── Logo section ──────────────────────────────────────────
  const [logoImage, setLogoImage]             = useState('');
  const [footerLogoImage, setFooterLogoImage] = useState('');
  const [footerImage, setFooterImage]         = useState('');
  const [faviconImage, setFaviconImage]       = useState('');
  const [logoLoading, setLogoLoading]         = useState(false);
  const [logoMessage, setLogoMessage]         = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activePicker, setActivePicker]       = useState<'hero' | 'logo' | 'footerLogo' | 'footerImage' | 'favicon' | null>(null);

  // ── Réseaux sociaux & Automatisations ────────────────────────
  const [socialInstagram, setSocialInstagram]                 = useState('');
  const [socialLinkedin, setSocialLinkedin]                   = useState('');
  const [socialYoutube, setSocialYoutube]                     = useState('');
  const [socialSpotify, setSocialSpotify]                     = useState('');
  const [socialWebhookUrl, setSocialWebhookUrl]               = useState('');
  const [socialLinkedinToken, setSocialLinkedinToken]         = useState('');
  const [socialLinkedinClientId, setSocialLinkedinClientId]   = useState('770flq5kanpk35');
  const [socialLinkedinClientSecret, setSocialLinkedinClientSecret] = useState('WPL_AP1.DWjJmw1gavYrqZ');
  const [socialLinkedinPageId, setSocialLinkedinPageId]       = useState('');
  const [socialMetaToken, setSocialMetaToken]                 = useState('');
  const [socialInstagramAccountId, setSocialInstagramAccountId] = useState('');
  const [socialFacebookPageId, setSocialFacebookPageId]       = useState('');
  const [aiLeadResponderEnabled, setAiLeadResponderEnabled]   = useState(true);
  const [webhookTestStatus, setWebhookTestStatus]             = useState<string | null>(null);
  const [webhookTesting, setWebhookTesting]                   = useState(false);
  const [socialLoading, setSocialLoading]                     = useState(false);
  const [socialFetching, setSocialFetching]                   = useState(true);
  const [socialMessage, setSocialMessage]                     = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Auteur ────────────────────────────────────────────────
  const [authorBio, setAuthorBio]         = useState('');
  const [authorLink, setAuthorLink]       = useState('/about');
  const [authorLoading, setAuthorLoading] = useState(false);
  const [authorMessage, setAuthorMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Promo ─────────────────────────────────────────────────
  const [promoCode, setPromoCode]       = useState('');
  const [promoAmount, setPromoAmount]   = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFetching, setPromoFetching] = useState(true);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Bouton inscription Header ─────────────────────────────
  const [headerRegisterLink, setHeaderRegisterLink]           = useState('/contact');
  const [headerRegisterLoading, setHeaderRegisterLoading]     = useState(false);
  const [headerRegisterMessage, setHeaderRegisterMessage]     = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [headerRegisterFetching, setHeaderRegisterFetching]   = useState(true);

  // ── Style Global ──────────────────────────────────────────

  // ── Modules ───────────────────────────────────────────────
  const [moduleBlogEnabled, setModuleBlogEnabled]           = useState(true);
  const [moduleAiEnabled, setModuleAiEnabled]               = useState(true);
  const [moduleEventsEnabled, setModuleEventsEnabled]       = useState(true);
  const [moduleNewsletterEnabled, setModuleNewsletterEnabled] = useState(true);
  const [moduleSocialEnabled, setModuleSocialEnabled]       = useState(true);
  const [moduleCaisseEnabled, setModuleCaisseEnabled]       = useState(true);
  // Trois modules existaient dans `config/modules.ts` — et gouvernaient déjà la
  // navigation de l'admin, les tâches planifiées et le widget public — sans
  // aucun interrupteur ici : impossible de les couper.
  const [moduleKeywordsEnabled, setModuleKeywordsEnabled]   = useState(true);
  const [moduleAgentsEnabled, setModuleAgentsEnabled]       = useState(true);
  const [moduleAutomationsEnabled, setModuleAutomationsEnabled] = useState(true);
  const [modulesLoading, setModulesLoading]                 = useState(false);
  const [modulesFetching, setModulesFetching]               = useState(true);
  const [modulesMessage, setModulesMessage]                 = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Caisse & facturation ──────────────────────────────────
  const [caisseTvaAssujetti, setCaisseTvaAssujetti]   = useState(false);
  const [caisseTvaTaux, setCaisseTvaTaux]             = useState('0');
  const [caisseTvaNumero, setCaisseTvaNumero]         = useState('');
  const [caisseIban, setCaisseIban]                   = useState('');
  const [caisseMentions, setCaisseMentions]           = useState('');
  const [caisseBonValidite, setCaisseBonValidite]     = useState('60');
  const [caisseBonMentions, setCaisseBonMentions]     = useState('');
  const [caisseLoading, setCaisseLoading]             = useState(false);
  const [caisseFetching, setCaisseFetching]           = useState(true);
  const [caisseMessage, setCaisseMessage]             = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Entreprise ────────────────────────────────────────────
  const [bizName, setBizName]                     = useState('');
  const [bizOwner, setBizOwner]                   = useState('');
  const [bizEmail, setBizEmail]                   = useState('');
  const [bizPhone, setBizPhone]                   = useState('');
  const [bizAddressStreet, setBizAddressStreet]   = useState('');
  const [bizAddressPostal, setBizAddressPostal]   = useState('');
  const [bizAddressCity, setBizAddressCity]       = useState('');
  const [bizAddressRegion, setBizAddressRegion]   = useState('');
  const [bizAddressCountry, setBizAddressCountry] = useState('');
  const [bizPriceRange, setBizPriceRange]         = useState('');
  // Textes de la page /contact. Ils vivaient en dur dans le composant de la
  // page : c'était la seule page publique dont le contenu échappait au client.
  const [contactIntro, setContactIntro]           = useState('');
  const [contactAddressNote, setContactAddressNote] = useState('');
  const [contactSubjects, setContactSubjects]     = useState(SETTINGS_DEFAULTS.contact_subjects);
  const [bizLoading, setBizLoading]               = useState(false);
  const [bizFetching, setBizFetching]             = useState(true);
  const [bizMessage, setBizMessage]               = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── IA & Budget ───────────────────────────────────────────
  const [aiModel, setAiModel]                     = useState(DEFAULT_AI_MODEL);
  const [aiEffort, setAiEffort]                   = useState<AiEffort>(DEFAULT_AI_EFFORT);
  const [aiBudget, setAiBudget]                   = useState('0');
  const [aiAlertPercent, setAiAlertPercent]       = useState('80');
  const [aiCatalog, setAiCatalog]                 = useState<(AiModelSpec & { available: boolean | null })[]>(
    AI_MODELS.map((m) => ({ ...m, available: null })),
  );
  const [aiUsage, setAiUsage]                     = useState<any>(null);
  const [aiLoading, setAiLoading]                 = useState(false);
  const [aiFetching, setAiFetching]               = useState(true);
  const [aiMessage, setAiMessage]                 = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Éditorial & Marque ────────────────────────────────────
  const [siteActivityContext, setSiteActivityContext] = useState('');
  const [siteTargetPersona, setSiteTargetPersona]     = useState('');
  const [siteToneOfVoice, setSiteToneOfVoice]         = useState('');
  const [siteBrandTone, setSiteBrandTone]             = useState('');
  const [siteBlogTopics, setSiteBlogTopics]           = useState('');
  const [editorialLoading, setEditorialLoading]       = useState(false);
  const [editorialFetching, setEditorialFetching]     = useState(true);
  const [editorialMessage, setEditorialMessage]       = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isEditorialVoiceModalOpen, setIsEditorialVoiceModalOpen] = useState(false);

  const [activeTab, setActiveTab]                     = useState<'general' | 'business' | 'editorial' | 'modules' | 'caisse' | 'ai' | 'style' | 'fleet' | 'security' | 'keys'>('general');

  // Preview button hovers

  const renderPresets = (setter: (val: string) => void) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {[
        { name: 'Sauge', value: '#8A9A7B' },
        { name: 'Terracotta', value: '#C08768' },
        { name: 'Lin', value: '#EDE6DA' },
        { name: 'Taupe', value: '#3A3730' },
        { name: 'Bleu', value: '#35505E' },
        { name: 'Crème', value: '#FAF7F2' },
        { name: 'Blanc', value: '#ffffff' },
        { name: 'Gris', value: '#e5e7eb' }
      ].map(preset => (
        <button
          type="button"
          key={preset.value}
          onClick={() => setter(preset.value)}
          style={{ backgroundColor: preset.value }}
          title={preset.name}
          className="w-4 h-4 rounded-full border border-stone-200 hover:scale-125 transition-transform cursor-pointer shadow-sm shrink-0"
        />
      ))}
    </div>
  );

  const [isMasterStudio, setIsMasterStudio] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isMaster =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.includes('kinetick');
      setIsMasterStudio(isMaster);
    }
  }, []);

  const visibleSections = SETTINGS_SECTIONS.filter((section) => {
    if (section.id === 'fleet') return isMasterStudio;
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['general', 'business', 'editorial', 'modules', 'caisse', 'ai', 'style', 'fleet', 'security', 'keys'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
    loadHero();
    loadPromo();
    loadSocials();
    loadAuthor();
    loadHeaderRegisterLink();
    loadModules();
    loadCaisse();
    loadBusiness();
    loadEditorial();
    loadAi();
  }, []);

  const EDITORIAL_KEYS = [
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
    'site_blog_topics',
  ];

  const loadEditorial = async () => {
    setEditorialFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', EDITORIAL_KEYS);
    if (data && data.length > 0) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      setSiteActivityContext(map.site_activity_context ?? SETTINGS_DEFAULTS.site_activity_context ?? '');
      setSiteTargetPersona(map.site_target_persona ?? SETTINGS_DEFAULTS.site_target_persona ?? '');
      setSiteToneOfVoice(map.site_tone_of_voice ?? SETTINGS_DEFAULTS.site_tone_of_voice ?? '');
      setSiteBrandTone(map.site_brand_tone ?? SETTINGS_DEFAULTS.site_brand_tone ?? '');
      setSiteBlogTopics(map.site_blog_topics ?? SETTINGS_DEFAULTS.site_blog_topics ?? '');
    } else {
      setSiteActivityContext(SETTINGS_DEFAULTS.site_activity_context ?? '');
      setSiteTargetPersona(SETTINGS_DEFAULTS.site_target_persona ?? '');
      setSiteToneOfVoice(SETTINGS_DEFAULTS.site_tone_of_voice ?? '');
      setSiteBrandTone(SETTINGS_DEFAULTS.site_brand_tone ?? '');
      setSiteBlogTopics(SETTINGS_DEFAULTS.site_blog_topics ?? '');
    }
    setEditorialFetching(false);
  };

  const handleSaveEditorial = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditorialMessage(null);
    setEditorialLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'site_activity_context', value: siteActivityContext.trim() },
        { key: 'site_target_persona',   value: siteTargetPersona.trim() },
        { key: 'site_tone_of_voice',     value: siteToneOfVoice.trim() },
        { key: 'site_brand_tone',        value: siteBrandTone.trim() },
        { key: 'site_blog_topics',       value: siteBlogTopics.trim() },
      ], { onConflict: 'key' });
    if (error) {
      setEditorialMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setEditorialMessage({ type: 'success', text: 'Paramètres d\'activité et ligne éditoriale enregistrés ! Ils alimenteront les prochaines suggestions du blog et rédactions IA.' });
      settingsCache.set('site_activity_context', siteActivityContext.trim());
      settingsCache.set('site_target_persona', siteTargetPersona.trim());
      settingsCache.set('site_tone_of_voice', siteToneOfVoice.trim());
      settingsCache.set('site_brand_tone', siteBrandTone.trim());
      settingsCache.set('site_blog_topics', siteBlogTopics.trim());
    }
    setEditorialLoading(false);
  };

  const BUSINESS_KEYS = [
    'business_name', 'business_owner', 'business_email', 'business_phone',
    'business_address_street', 'business_address_postal', 'business_address_city',
    'business_address_region', 'business_address_country', 'business_price_range',
    'contact_intro', 'contact_address_note', 'contact_subjects',
  ];

  const loadBusiness = async () => {
    setBizFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', BUSINESS_KEYS);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.business_name)             setBizName(map.business_name);
      if (map.business_owner)            setBizOwner(map.business_owner);
      if (map.business_email)            setBizEmail(map.business_email);
      if (map.business_phone)            setBizPhone(map.business_phone);
      if (map.business_address_street)   setBizAddressStreet(map.business_address_street);
      if (map.business_address_postal)   setBizAddressPostal(map.business_address_postal);
      if (map.business_address_city)     setBizAddressCity(map.business_address_city);
      if (map.business_address_region)   setBizAddressRegion(map.business_address_region);
      if (map.business_address_country) setBizAddressCountry(map.business_address_country);
      if (map.business_price_range)      setBizPriceRange(map.business_price_range);
      if (map.contact_intro)             setContactIntro(map.contact_intro);
      if (map.contact_address_note)      setContactAddressNote(map.contact_address_note);
      if (map.contact_subjects)          setContactSubjects(map.contact_subjects);
    }
    setBizFetching(false);
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizMessage(null);
    setBizLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'business_name',            value: bizName.trim() },
        { key: 'business_owner',           value: bizOwner.trim() },
        { key: 'business_email',           value: bizEmail.trim() },
        { key: 'business_phone',           value: bizPhone.trim() },
        { key: 'business_address_street',  value: bizAddressStreet.trim() },
        { key: 'business_address_postal',  value: bizAddressPostal.trim() },
        { key: 'business_address_city',    value: bizAddressCity.trim() },
        { key: 'business_address_region',  value: bizAddressRegion.trim() },
        { key: 'business_address_country', value: bizAddressCountry.trim() },
        { key: 'business_price_range',     value: bizPriceRange.trim() },
        { key: 'contact_intro',            value: contactIntro.trim() },
        { key: 'contact_address_note',     value: contactAddressNote.trim() },
        { key: 'contact_subjects',         value: contactSubjects.trim() },
      ], { onConflict: 'key' });
    if (error) {
      setBizMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setBizMessage({ type: 'success', text: 'Coordonnées mises à jour !' });
      settingsCache.set('business_name', bizName.trim());
      settingsCache.set('business_owner', bizOwner.trim());
      settingsCache.set('business_email', bizEmail.trim());
      settingsCache.set('business_phone', bizPhone.trim());
      settingsCache.set('business_address_street', bizAddressStreet.trim());
      settingsCache.set('business_address_postal', bizAddressPostal.trim());
      settingsCache.set('business_address_city', bizAddressCity.trim());
      settingsCache.set('business_address_region', bizAddressRegion.trim());
      settingsCache.set('business_address_country', bizAddressCountry.trim());
      settingsCache.set('business_price_range', bizPriceRange.trim());
      settingsCache.set('contact_intro', contactIntro.trim());
      settingsCache.set('contact_address_note', contactAddressNote.trim());
      settingsCache.set('contact_subjects', contactSubjects.trim());
    }
    setBizLoading(false);
  };

  const AI_KEYS = ['ai_model', 'ai_effort', 'ai_budget_monthly_usd', 'ai_budget_alert_percent'];

  /** Jeton Supabase requis par les routes /api/admin/*. */
  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const loadAiUsage = async () => {
    try {
      const res = await fetch('/api/admin/ai-usage', { headers: await authHeaders() });
      if (res.ok) setAiUsage(await res.json());
    } catch (err) {
      console.error('[settings] Consommation IA indisponible :', err);
    }
  };

  const loadAi = async () => {
    setAiFetching(true);
    const { data } = await supabase.from('settings').select('key, value').in('key', AI_KEYS);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.ai_model)                setAiModel(map.ai_model);
      if (map.ai_effort)               setAiEffort(map.ai_effort as AiEffort);
      if (map.ai_budget_monthly_usd)   setAiBudget(map.ai_budget_monthly_usd);
      if (map.ai_budget_alert_percent) setAiAlertPercent(map.ai_budget_alert_percent);
    }

    // Confronte le catalogue local à la liste réellement servie par Anthropic.
    try {
      const res = await fetch('/api/admin/ai-models', { headers: await authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        if (Array.isArray(payload.models)) setAiCatalog(payload.models);
      }
    } catch (err) {
      console.error('[settings] Catalogue de modèles indisponible :', err);
    }

    await loadAiUsage();
    setAiFetching(false);
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiMessage(null);
    setAiLoading(true);

    const budget = Math.max(0, Number.parseFloat(aiBudget.replace(',', '.')) || 0);
    const percent = Math.min(100, Math.max(1, Number.parseInt(aiAlertPercent, 10) || 80));

    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'ai_model',                value: aiModel },
        { key: 'ai_effort',               value: aiEffort },
        { key: 'ai_budget_monthly_usd',   value: String(budget) },
        { key: 'ai_budget_alert_percent', value: String(percent) },
      ], { onConflict: 'key' });

    if (error) {
      setAiMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setAiBudget(String(budget));
      setAiAlertPercent(String(percent));
      settingsCache.set('ai_model', aiModel);
      settingsCache.set('ai_effort', aiEffort);
      settingsCache.set('ai_budget_monthly_usd', String(budget));
      settingsCache.set('ai_budget_alert_percent', String(percent));
      /*
        La configuration IA est mise en cache côté serveur pour ne pas payer un
        aller-retour Supabase à chaque génération. On purge ce cache tout de
        suite : sans cet appel, le modèle fraîchement choisi ne s'appliquait
        qu'à l'expiration du TTL.
      */
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/admin/ai-status?refresh=true', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      }).catch(() => { /* purge best-effort : l'enregistrement, lui, a réussi */ });

      setAiMessage({ type: 'success', text: 'Réglages IA enregistrés. Les prochaines générations utilisent ce modèle.' });
      await loadAiUsage();
    }
    setAiLoading(false);
  };

  const loadModules = async () => {
    setModulesFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', Object.values(MODULE_SETTING_KEYS));
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.module_blog_enabled !== undefined)          setModuleBlogEnabled(map.module_blog_enabled !== 'false');
      if (map.module_ai_generation_enabled !== undefined) setModuleAiEnabled(map.module_ai_generation_enabled !== 'false');
      if (map.module_events_enabled !== undefined)        setModuleEventsEnabled(map.module_events_enabled !== 'false');
      if (map.module_newsletter_enabled !== undefined)    setModuleNewsletterEnabled(map.module_newsletter_enabled !== 'false');
      if (map.module_social_enabled !== undefined)        setModuleSocialEnabled(map.module_social_enabled !== 'false');
      if (map.module_caisse_enabled !== undefined)        setModuleCaisseEnabled(map.module_caisse_enabled !== 'false');
      if (map.module_keywords_enabled !== undefined)      setModuleKeywordsEnabled(map.module_keywords_enabled !== 'false');
      if (map.module_agents_enabled !== undefined)        setModuleAgentsEnabled(map.module_agents_enabled !== 'false');
      if (map.module_automations_enabled !== undefined)   setModuleAutomationsEnabled(map.module_automations_enabled !== 'false');
    }
    setModulesFetching(false);
  };

  const CAISSE_KEYS = [
    'caisse_tva_assujetti',
    'caisse_tva_taux_defaut',
    'caisse_tva_numero',
    'caisse_iban',
    'caisse_facture_mentions',
    'caisse_bon_validite_mois',
    'caisse_bon_mentions',
  ];

  const loadCaisse = async () => {
    setCaisseFetching(true);
    const { data } = await supabase.from('settings').select('key, value').in('key', CAISSE_KEYS);
    const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    setCaisseTvaAssujetti((map.caisse_tva_assujetti ?? SETTINGS_DEFAULTS.caisse_tva_assujetti) === 'true');
    setCaisseTvaTaux(map.caisse_tva_taux_defaut ?? SETTINGS_DEFAULTS.caisse_tva_taux_defaut);
    setCaisseTvaNumero(map.caisse_tva_numero ?? SETTINGS_DEFAULTS.caisse_tva_numero);
    setCaisseIban(map.caisse_iban ?? SETTINGS_DEFAULTS.caisse_iban);
    setCaisseMentions(map.caisse_facture_mentions ?? SETTINGS_DEFAULTS.caisse_facture_mentions);
    setCaisseBonValidite(map.caisse_bon_validite_mois ?? SETTINGS_DEFAULTS.caisse_bon_validite_mois);
    setCaisseBonMentions(map.caisse_bon_mentions ?? SETTINGS_DEFAULTS.caisse_bon_mentions);
    setCaisseFetching(false);
  };

  const handleSaveCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaisseMessage(null);
    setCaisseLoading(true);
    const rows = [
      { key: 'caisse_tva_assujetti',    value: String(caisseTvaAssujetti) },
      // Un prestataire non assujetti facture forcément à 0 % : on force le taux
      // plutôt que de laisser une valeur orpheline apparaître sur les factures.
      { key: 'caisse_tva_taux_defaut',  value: caisseTvaAssujetti ? caisseTvaTaux : '0' },
      { key: 'caisse_tva_numero',       value: caisseTvaNumero.trim() },
      { key: 'caisse_iban',             value: caisseIban.trim() },
      { key: 'caisse_facture_mentions', value: caisseMentions.trim() },
      // Plancher à 12 mois : un bon de quelques semaines serait contesté, et
      // une valeur vide ou nulle produirait des bons déjà échus à l'émission.
      { key: 'caisse_bon_validite_mois', value: String(Math.max(12, Number(caisseBonValidite) || 60)) },
      { key: 'caisse_bon_mentions',      value: caisseBonMentions.trim() },
    ];
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) {
      setCaisseMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      rows.forEach(r => settingsCache.set(r.key, r.value));
      setCaisseMessage({ type: 'success', text: 'Réglages de caisse enregistrés. Les prochaines factures en tiennent compte.' });
    }
    setCaisseLoading(false);
  };

  const handleSaveModules = async (e: React.FormEvent) => {
    e.preventDefault();
    setModulesMessage(null);
    setModulesLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'module_blog_enabled',          value: String(moduleBlogEnabled) },
        { key: 'module_ai_generation_enabled', value: String(moduleAiEnabled) },
        { key: 'module_events_enabled',         value: String(moduleEventsEnabled) },
        { key: 'module_newsletter_enabled',     value: String(moduleNewsletterEnabled) },
        { key: 'module_social_enabled',         value: String(moduleSocialEnabled) },
        { key: 'module_caisse_enabled',         value: String(moduleCaisseEnabled) },
        { key: 'module_keywords_enabled',       value: String(moduleKeywordsEnabled) },
        { key: 'module_agents_enabled',         value: String(moduleAgentsEnabled) },
        { key: 'module_automations_enabled',    value: String(moduleAutomationsEnabled) },
      ], { onConflict: 'key' });
    if (error) {
      setModulesMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setModulesMessage({ type: 'success', text: 'Modules mis à jour ! Rechargez le site pour voir les changements.' });
      settingsCache.set('module_blog_enabled', String(moduleBlogEnabled));
      settingsCache.set('module_ai_generation_enabled', String(moduleAiEnabled));
      settingsCache.set('module_events_enabled', String(moduleEventsEnabled));
      settingsCache.set('module_newsletter_enabled', String(moduleNewsletterEnabled));
      settingsCache.set('module_social_enabled', String(moduleSocialEnabled));
      settingsCache.set('module_caisse_enabled', String(moduleCaisseEnabled));
      settingsCache.set('module_keywords_enabled', String(moduleKeywordsEnabled));
      settingsCache.set('module_agents_enabled', String(moduleAgentsEnabled));
      settingsCache.set('module_automations_enabled', String(moduleAutomationsEnabled));
    }
    setModulesLoading(false);
  };

  const loadHeaderRegisterLink = async () => {
    setHeaderRegisterFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'header_register_link')
      .maybeSingle();
    if (data?.value) {
      setHeaderRegisterLink(data.value);
    }
    setHeaderRegisterFetching(false);
  };

  const handleSaveHeaderRegisterLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeaderRegisterMessage(null);
    setHeaderRegisterLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'header_register_link', value: headerRegisterLink.trim() }, { onConflict: 'key' });
    if (error) {
      setHeaderRegisterMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      settingsCache.set('header_register_link', headerRegisterLink.trim());
      setHeaderRegisterMessage({ type: 'success', text: 'Lien mis à jour avec succès !' });
      window.dispatchEvent(new CustomEvent('sde:settingsChanged'));
    }
    setHeaderRegisterLoading(false);
  };

  // ── Loaders ───────────────────────────────────────────────
  const loadHero = async () => {
    setHeroFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['hero_image', 'hero_text_color', 'global_logo', 'footer_logo', 'footer_image', 'favicon_url', 'section_hero_opacity']);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.hero_image)           setHeroImage(map.hero_image);
      if (map.hero_text_color)      setHeroColor(map.hero_text_color as 'dark' | 'light');
      if (map.global_logo)          setLogoImage(map.global_logo);
      if (map.footer_logo)          setFooterLogoImage(map.footer_logo);
      if (map.footer_image)         setFooterImage(map.footer_image);
      if (map.favicon_url)          setFaviconImage(map.favicon_url);
      if (map.section_hero_opacity) setHeroOpacity(map.section_hero_opacity);
    }
    setHeroFetching(false);
  };

  const loadSocials = async () => {
    setSocialFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'social_instagram', 'social_linkedin', 'social_youtube', 'social_spotify',
        'social_webhook_url', 'social_linkedin_token', 'social_linkedin_client_id', 'social_linkedin_client_secret', 'social_linkedin_page_id',
        'social_meta_token', 'social_instagram_account_id', 'social_facebook_page_id',
        'ai_lead_responder_enabled'
      ]);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.social_instagram) setSocialInstagram(map.social_instagram);
      if (map.social_linkedin)  setSocialLinkedin(map.social_linkedin);
      if (map.social_youtube)   setSocialYoutube(map.social_youtube);
      if (map.social_spotify)   setSocialSpotify(map.social_spotify);
      if (map.social_webhook_url) setSocialWebhookUrl(map.social_webhook_url);
      if (map.social_linkedin_token) setSocialLinkedinToken(map.social_linkedin_token);
      if (map.social_linkedin_client_id) setSocialLinkedinClientId(map.social_linkedin_client_id);
      if (map.social_linkedin_client_secret) setSocialLinkedinClientSecret(map.social_linkedin_client_secret);
      if (map.social_linkedin_page_id) setSocialLinkedinPageId(map.social_linkedin_page_id);
      if (map.social_meta_token) setSocialMetaToken(map.social_meta_token);
      if (map.social_instagram_account_id) setSocialInstagramAccountId(map.social_instagram_account_id);
      if (map.social_facebook_page_id) setSocialFacebookPageId(map.social_facebook_page_id);
      if (map.ai_lead_responder_enabled !== undefined) setAiLeadResponderEnabled(map.ai_lead_responder_enabled !== 'false');
    }
    setSocialFetching(false);
  };

  const handleTestWebhook = async () => {
    setWebhookTesting(true);
    setWebhookTestStatus(null);
    try {
      const res = await fetch('/api/admin/social-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'linkedin',
          title: 'Test Publication LinkedIn',
          caption: 'Ceci est un post de test envoyé depuis Studio pour vérifier la connexion LinkedIn.',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookTestStatus(data.result?.message || 'Publication LinkedIn réussie !');
      } else {
        setWebhookTestStatus(`Erreur : ${data.error || data.result?.message || 'Impossible de publier sur LinkedIn'}`);
      }
    } catch (e: any) {
      setWebhookTestStatus(`Erreur : ${e.message}`);
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleSaveSocials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialMessage(null);
    setSocialLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'social_instagram',              value: socialInstagram.trim() },
        { key: 'social_linkedin',               value: socialLinkedin.trim() },
        { key: 'social_youtube',                value: socialYoutube.trim() },
        { key: 'social_spotify',                value: socialSpotify.trim() },
        { key: 'social_webhook_url',            value: socialWebhookUrl.trim() },
        { key: 'social_linkedin_token',          value: socialLinkedinToken.trim() },
        { key: 'social_linkedin_client_id',      value: socialLinkedinClientId.trim() },
        { key: 'social_linkedin_client_secret',  value: socialLinkedinClientSecret.trim() },
        { key: 'social_linkedin_page_id',        value: socialLinkedinPageId.trim() },
        { key: 'social_meta_token',              value: socialMetaToken.trim() },
        { key: 'social_instagram_account_id',   value: socialInstagramAccountId.trim() },
        { key: 'social_facebook_page_id',       value: socialFacebookPageId.trim() },
        { key: 'ai_lead_responder_enabled',     value: aiLeadResponderEnabled ? 'true' : 'false' },
      ], { onConflict: 'key' });
    if (error) {
      setSocialMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setSocialMessage({ type: 'success', text: 'Paramètres réseaux & clés d\'accès enregistrés !' });
      settingsCache.set('social_webhook_url', socialWebhookUrl.trim());
      settingsCache.set('ai_lead_responder_enabled', aiLeadResponderEnabled ? 'true' : 'false');
    }
    setSocialLoading(false);
  };

  const loadAuthor = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['author_bio', 'author_link']);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.author_bio)  setAuthorBio(map.author_bio);
      if (map.author_link) setAuthorLink(map.author_link);
    }
  };

  const handleSaveAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthorMessage(null);
    setAuthorLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'author_bio',  value: authorBio.trim()  },
        { key: 'author_link', value: authorLink.trim() },
      ], { onConflict: 'key' });
    if (error) {
      setAuthorMessage({ type: 'error', text: 'Erreur : ' + error.message });
    } else {
      setAuthorMessage({ type: 'success', text: 'Auteur mis à jour !' });
    }
    setAuthorLoading(false);
  };

  const loadPromo = async () => {
    setPromoFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['promo_code', 'promo_amount']);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      setPromoCode(map.promo_code   || 'BIENVENUE');
      setPromoAmount(map.promo_amount || '20 CHF');
    }
    setPromoFetching(false);
  };

  const openPicker = async (type: 'hero' | 'logo' | 'footerLogo' | 'footerImage' | 'favicon', trigger?: HTMLElement) => {
    pickerTriggerRef.current = trigger ?? null;
    setActivePicker(type);
    setShowPicker(true);
    if (mediaAssets.length === 0) {
      setMediaLoading(true);
      const { data } = await supabase
        .from('media_assets')
        .select('id, url, alt_text')
        .order('created_at', { ascending: false });
      setMediaAssets(data || []);
      setMediaLoading(false);
    }
  };

  // Modale médiathèque : fermeture sur Échap, focus initial sur la modale, focus renvoyé au bouton déclencheur.
  const pickerTriggerRef = React.useRef<HTMLElement | null>(null);
  const pickerPanelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!showPicker) return;
    pickerPanelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPicker(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      pickerTriggerRef.current?.focus();
    };
  }, [showPicker]);

  // ── Sauvegarde Hero ───────────────────────────────────────
  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroMessage(null);
    if (!heroImage.trim()) {
      setHeroMessage({ type: 'error', text: 'Veuillez saisir ou choisir une image.' });
      return;
    }
    setHeroLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert(
        [
          { key: 'hero_image',           value: heroImage.trim() },
          { key: 'hero_text_color',      value: heroColor },
          { key: 'section_hero_opacity', value: heroOpacity },
        ],
        { onConflict: 'key' }
      );
    if (error) {
      setHeroMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setHeroMessage({ type: 'success', text: 'Hero mis à jour avec succès ! Rechargez la page d\'accueil.' });
    }
    setHeroLoading(false);
  };

  // ── Sauvegarde Logo ───────────────────────────────────────
  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogoMessage(null);
    if (!logoImage.trim()) {
      setLogoMessage({ type: 'error', text: 'Veuillez saisir ou choisir une image pour le logo principal.' });
      return;
    }
    setLogoLoading(true);
    const updates = [
      { key: 'global_logo', value: logoImage.trim() }
    ];
    if (footerLogoImage.trim()) {
      updates.push({ key: 'footer_logo', value: footerLogoImage.trim() });
    }
    if (footerImage.trim()) {
      updates.push({ key: 'footer_image', value: footerImage.trim() });
    }
    if (faviconImage.trim()) {
      updates.push({ key: 'favicon_url', value: faviconImage.trim() });
    }
    const { error } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'key' });
    if (error) {
      setLogoMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      settingsCache.set('global_logo', logoImage.trim());
      if (footerLogoImage.trim()) {
        settingsCache.set('footer_logo', footerLogoImage.trim());
      }
      if (footerImage.trim()) {
        settingsCache.set('footer_image', footerImage.trim());
      }
      if (faviconImage.trim()) {
        settingsCache.set('favicon_url', faviconImage.trim());
      }
      setLogoMessage({ type: 'success', text: 'Logos mis à jour avec succès !' });
      window.dispatchEvent(new CustomEvent('sde:settingsChanged'));
    }
    setLogoLoading(false);
  };

  // ── Sauvegarde Promo ──────────────────────────────────────
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoMessage(null);
    if (!promoCode.trim() || !promoAmount.trim()) {
      setPromoMessage({ type: 'error', text: 'Veuillez remplir tous les champs.' });
      return;
    }
    setPromoLoading(true);
    const updates = [
      supabase.from('settings').update({ value: promoCode.trim().toUpperCase() }).eq('key', 'promo_code'),
      supabase.from('settings').update({ value: promoAmount.trim() }).eq('key', 'promo_amount'),
    ];
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    if (hasError) {
      setPromoMessage({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      setPromoCode(promoCode.trim().toUpperCase());
      setPromoMessage({ type: 'success', text: 'Paramètres du code promo sauvegardés !' });
    }
    setPromoLoading(false);
  };

  // ── Mot de passe ──────────────────────────────────────────
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);
    if (password !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (password.length < 6) {
      setPwdMessage({ type: 'error', text: 'Le mot de passe doit faire au moins 6 caractères.' });
      return;
    }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPwdMessage({ type: 'error', text: 'Erreur lors de la mise à jour : ' + error.message });
    } else {
      setPwdMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès !' });
      setPassword('');
      setConfirmPassword('');
    }
    setPwdLoading(false);
  };

  const currentSection = visibleSections.find((section) => section.id === activeTab);

  return (
    <>
      <PageHeader
        title="Paramètres"
        description={currentSection?.description ?? 'Coordonnées, marque, modules et apparence du site.'}
      />

      {/* ── Modal sélecteur de médias ─────────────────────── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[999999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            ref={pickerPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-picker-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl rounded-xl overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 id="media-picker-title" className="font-bold text-stone-900 text-sm">Choisir une image</h3>
              <button onClick={() => setShowPicker(false)} aria-label="Fermer la médiathèque" className="p-2 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {mediaLoading ? (
                <p className="text-center text-stone-600 py-12">Chargement des médias…</p>
              ) : mediaAssets.length === 0 ? (
                <p className="text-center text-stone-600 py-12">Aucune image dans la médiathèque.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {mediaAssets.map(asset => {
                    const isSelected = (activePicker === 'hero' && heroImage === asset.url) ||
                                       (activePicker === 'logo' && logoImage === asset.url) ||
                                       (activePicker === 'footerLogo' && footerLogoImage === asset.url) ||
                                       (activePicker === 'footerImage' && footerImage === asset.url) ||
                                       (activePicker === 'favicon' && faviconImage === asset.url);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        aria-label={`Choisir l'image ${asset.alt_text || 'sans titre'}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (activePicker === 'hero') setHeroImage(asset.url);
                          if (activePicker === 'logo') setLogoImage(asset.url);
                          if (activePicker === 'footerLogo') setFooterLogoImage(asset.url);
                          if (activePicker === 'footerImage') setFooterImage(asset.url);
                          if (activePicker === 'favicon') setFaviconImage(asset.url);
                          setShowPicker(false);
                        }}
                        className={`relative group aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected ? 'border-stone-900 shadow-lg' : 'border-stone-200 hover:border-stone-400/50'}`}
                      >
                        <img src={asset.url} alt={asset.alt_text} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-stone-900/20 flex items-center justify-center">
                            <div className="bg-stone-900 text-white rounded-full p-1.5">
                              <Check size={14} />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-stone-900/60 text-white text-[12px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {asset.alt_text || 'Sans titre'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        {/*
          Les huit rubriques étaient huit pastilles en capitales étroites sur une
          ligne qui passait à la ligne : impossible de savoir laquelle était
          active, ni ce que chacune contenait. En colonne, chaque rubrique garde
          son nom entier et une phrase qui dit ce qu'on y règle.
        */}
        <div className="mb-6 lg:mb-0">
          <SideNav
            label="Rubriques des paramètres"
            active={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
            items={visibleSections}
          />
        </div>

        <div className="min-w-0 space-y-8">
        {/* ── Onglet Général (Hero + Code promo) ────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-10 animate-fadein">
            {/* Logo Section */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Image size={16} /> Identité visuelle — Logo du site
              </h2>

              {heroFetching ? (
                <p className="text-stone-600 text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveLogo} className="space-y-8">
                  {logoMessage && (
                    <div className={`p-4 text-sm ${logoMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {logoMessage.text}
                    </div>
                  )}

                  {/* Logo Image */}
                  {/* Favicon */}
                  <div className="space-y-3 pb-6 border-b border-stone-200">
                    <label htmlFor="settings-favicon" className="block text-[13px] font-medium text-stone-800">
                      Favicon (icône onglet navigateur — format carré .png ou .svg recommandé)
                    </label>

                    {faviconImage && (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 p-2 shadow-sm">
                        <img src={faviconImage} alt="Aperçu favicon" className="w-full h-full object-contain" />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <input
                        id="settings-favicon"
                        type="url"
                        value={faviconImage}
                        onChange={(e) => setFaviconImage(e.target.value)}
                        placeholder="https://… ou choisir depuis la médiathèque →"
                        className="flex-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('favicon', e.currentTarget)}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-[13px] font-medium text-stone-800 transition-colors hover:bg-stone-50 hover:border-stone-400 whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                    <p className="text-[12.5px] text-stone-500">Pris en compte au prochain déploiement (rendu côté serveur).</p>
                  </div>

                  <div className="space-y-3">
                    <label htmlFor="settings-logo" className="block text-[13px] font-medium text-stone-800">
                      Logo principal (En-tête et Favicon - Format carré recommandé)
                    </label>

                    {/* Aperçu */}
                    {logoImage && (
                      <div className="relative w-24 h-24 rounded-[22%] aspect-square overflow-hidden border border-stone-200 bg-stone-50 p-2 shadow-sm">
                        <img src={logoImage} alt="Aperçu logo principal" className="w-full h-full object-cover rounded-[22%]" />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <input
                        id="settings-logo"
                        type="url"
                        value={logoImage}
                        onChange={(e) => setLogoImage(e.target.value)}
                        placeholder="https://… ou choisir depuis la médiathèque →"
                        className="flex-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('logo', e.currentTarget)}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-[13px] font-medium text-stone-800 transition-colors hover:bg-stone-50 hover:border-stone-400 whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  {/* Logo du Footer Image */}
                  <div className="space-y-3 pt-6 border-t border-stone-200">
                    <label htmlFor="settings-footer-logo" className="block text-[13px] font-medium text-stone-800">
                      Logo du pied de page (Footer - Format paysage/allongé recommandé)
                    </label>

                    {/* Aperçu */}
                    {footerLogoImage && (
                      <div className="relative w-48 h-20 rounded-lg overflow-hidden border border-stone-200 bg-stone-900 p-2 shadow-sm">
                        <img src={footerLogoImage} alt="Aperçu logo footer" className="w-full h-full object-contain" />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <input
                        id="settings-footer-logo"
                        type="url"
                        value={footerLogoImage}
                        onChange={(e) => setFooterLogoImage(e.target.value)}
                        placeholder="https://… ou choisir depuis la médiathèque →"
                        className="flex-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('footerLogo', e.currentTarget)}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-[13px] font-medium text-stone-800 transition-colors hover:bg-stone-50 hover:border-stone-400 whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  {/* Image footer (colonne gauche) */}
                  <div className="space-y-3 pt-6 border-t border-stone-200">
                    <label htmlFor="settings-footer-image" className="block text-[13px] font-medium text-stone-800">
                      Image du footer — colonne gauche
                    </label>

                    {footerImage && (
                      <div className="relative w-48 h-32 rounded-lg overflow-hidden border border-stone-200 bg-stone-900 p-2 shadow-sm">
                        <img src={footerImage} alt="Aperçu image footer" className="w-full h-full object-contain" />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <input
                        id="settings-footer-image"
                        type="url"
                        value={footerImage}
                        onChange={(e) => setFooterImage(e.target.value)}
                        placeholder="https://… ou choisir depuis la médiathèque →"
                        className="flex-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('footerImage', e.currentTarget)}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 text-[13px] font-medium text-stone-800 transition-colors hover:bg-stone-50 hover:border-stone-400 whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-stone-200 pt-6">
                    <button
                      type="submit"
                      disabled={logoLoading || !logoImage.trim()}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {logoLoading ? (
                        <>Enregistrement…</>
                      ) : (
                        <><Save size={14} /> Enregistrer l'identité visuelle</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>


            {/* Réseaux sociaux */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Share2 size={16} /> Réseaux sociaux
              </h2>
              {socialFetching ? (
                <p className="text-stone-600 text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveSocials} className="space-y-6">
                  {socialMessage && (
                    <div className={`p-4 rounded-xl text-sm ${socialMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {socialMessage.text}
                    </div>
                  )}

                  {/* Profils Publics Réseaux */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">
                      Liens Publics des Profils
                    </h3>
                    {[
                      { label: 'Instagram', value: socialInstagram, setter: setSocialInstagram, placeholder: 'https://www.instagram.com/votre-compte/' },
                      { label: 'LinkedIn',  value: socialLinkedin,  setter: setSocialLinkedin,  placeholder: 'https://www.linkedin.com/in/votre-profil/' },
                      { label: 'YouTube',   value: socialYoutube,   setter: setSocialYoutube,   placeholder: 'https://www.youtube.com/@votre-chaine' },
                      { label: 'Spotify',   value: socialSpotify,   setter: setSocialSpotify,   placeholder: 'https://open.spotify.com/show/...' },
                    ].map(({ label, value, setter, placeholder }) => (
                      <div key={label} className="space-y-1">
                        <label htmlFor={`settings-social-${label.toLowerCase()}`} className="block text-[13px] font-medium text-stone-800">{label}</label>
                        <input
                          id={`settings-social-${label.toLowerCase()}`}
                          type="url"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Auto-Publication Native Directe (Sans tiers ni Zapier/Make) */}
                  {/* Auto-Répondeur IA Lead */}
                  <div className="space-y-3 pt-2 border-t border-stone-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">
                      Auto-Répondeur IA Lead (Formulaires de Contact)
                    </h3>
                    <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiLeadResponderEnabled}
                        onChange={(e) => setAiLeadResponderEnabled(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">
                          Activer l'Auto-Répondeur IA sur tous les formulaires
                        </span>
                        <span className="text-[11.5px] text-stone-500 block">
                          Répond instantanément aux prospects par e-mail en adoptant votre ton de voix éditorial.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-stone-100">
                    <button
                      type="submit"
                      disabled={socialLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={15} />
                      {socialLoading ? 'Sauvegarde…' : 'Sauvegarder les réseaux sociaux'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Auteur (bio + lien) */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Share2 size={16} /> Auteur — Bio & lien (affiché en bas des articles)
              </h2>
              <form onSubmit={handleSaveAuthor} className="space-y-5">
                {authorMessage && (
                  <div className={`p-4 text-sm ${authorMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {authorMessage.text}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="settings-author-bio" className="block text-[13px] font-medium text-stone-800">Description / Bio</label>
                  <textarea
                    id="settings-author-bio"
                    rows={4}
                    value={authorBio}
                    onChange={(e) => setAuthorBio(e.target.value)}
                    placeholder="Courte présentation de l'auteur affichée sous chaque article…"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="settings-author-link" className="block text-[13px] font-medium text-stone-800">Lien « En savoir plus »</label>
                  <input
                    id="settings-author-link"
                    type="text"
                    value={authorLink}
                    onChange={(e) => setAuthorLink(e.target.value)}
                    placeholder="/about"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm"
                  />
                  <p className="text-[12.5px] text-stone-500">URL relative (ex : /about) ou absolue.</p>
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authorLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} />
                    {authorLoading ? 'Sauvegarde…' : 'Sauvegarder l’auteur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Onglet Design & Style ──────────────────────────────── */}
        {/*
          Design & style.

          L'onglet contenait **deux éditeurs concurrents** pour les mêmes
          réglages : le panneau de jetons, et un formulaire « Personnalisation
          du Design » plus ancien qui réécrivait la police, la couleur primaire
          et le rayon des angles — plus deux clés, `style_color_text_h2` et
          `style_color_text_body`, qui n'existent dans aucun jeton et que
          `GlobalStyles` n'a jamais lues. Enregistrer l'un défaisait donc
          silencieusement l'autre. Il ne reste que le panneau, qui porte
          désormais son propre aperçu.
        */}
        {activeTab === 'style' && (
          <div className="space-y-8 animate-fadein">
            <DesignSystemPanel />

            {/* Bouton S'inscrire / Action du Header */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Sliders size={16} /> Bouton d'action du Menu (Header)
              </h2>

              {headerRegisterFetching ? (
                <p className="text-stone-600 text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveHeaderRegisterLink} className="space-y-6">
                  {headerRegisterMessage && (
                    <div className={`p-4 text-sm ${headerRegisterMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {headerRegisterMessage.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="header-register-link" className="block text-[13px] font-medium text-stone-800">
                      Lien du bouton d'action (Menu principal)
                    </label>
                    <input
                      id="header-register-link"
                      type="text"
                      value={headerRegisterLink}
                      onChange={(e) => setHeaderRegisterLink(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm"
                      placeholder="/contact"
                    />
                    <p className="text-[12.5px] text-stone-500">Exemple : /contact, /programme-complet, ou un lien externe complet https://...</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={headerRegisterLoading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      <Save size={16} />
                      {headerRegisterLoading ? 'Sauvegarde…' : 'Sauvegarder le lien'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}


        {activeTab === 'business' && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein">
            <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
              <Building2 size={16} /> Coordonnées d'entreprise
            </h2>

            {bizFetching ? (
              <p className="text-sm text-stone-600">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveBusiness} className="space-y-6">
                {bizMessage && (
                  <div className={`p-4 text-sm ${bizMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {bizMessage.text}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="biz-name" className="block text-[13px] font-medium text-stone-800">Nom de l'entreprise / du site</label>
                    <input id="biz-name" value={bizName} onChange={(e) => setBizName(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-owner" className="block text-[13px] font-medium text-stone-800">Nom du propriétaire / praticien</label>
                    <input id="biz-owner" value={bizOwner} onChange={(e) => setBizOwner(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-email" className="block text-[13px] font-medium text-stone-800">E-mail de contact</label>
                    <input id="biz-email" type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-phone" className="block text-[13px] font-medium text-stone-800">Téléphone</label>
                    <input id="biz-phone" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="biz-street" className="block text-[13px] font-medium text-stone-800">Rue et numéro</label>
                    <input id="biz-street" value={bizAddressStreet} onChange={(e) => setBizAddressStreet(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-postal" className="block text-[13px] font-medium text-stone-800">Code postal</label>
                    <input id="biz-postal" value={bizAddressPostal} onChange={(e) => setBizAddressPostal(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-city" className="block text-[13px] font-medium text-stone-800">Ville</label>
                    <input id="biz-city" value={bizAddressCity} onChange={(e) => setBizAddressCity(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-region" className="block text-[13px] font-medium text-stone-800">Région / Canton</label>
                    <input id="biz-region" value={bizAddressRegion} onChange={(e) => setBizAddressRegion(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-country" className="block text-[13px] font-medium text-stone-800">Pays (code ISO, ex : CH)</label>
                    <input id="biz-country" value={bizAddressCountry} onChange={(e) => setBizAddressCountry(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-price-range" className="block text-[13px] font-medium text-stone-800">Gamme de prix (SEO, ex : CHF 450–CHF 1295)</label>
                    <input id="biz-price-range" value={bizPriceRange} onChange={(e) => setBizPriceRange(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                  </div>
                </div>

                {/*
                  Page de contact : deux textes et la liste des motifs, et rien
                  de plus. Le gabarit n'affiche que ce qui est renseigné, et une
                  page « contact » créée dans le constructeur remplace tout ce
                  bloc.
                */}
                <div className="space-y-4 border-t border-stone-200 pt-6">
                  <div>
                    <h3 className="text-[15px] font-semibold text-stone-900">Page de contact</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
                      Ces textes s&apos;affichent sur <span className="font-mono text-[12.5px]">/contact</span>,
                      au-dessus de vos coordonnées. Laissez-les vides pour n&apos;afficher que le formulaire.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-intro" className="block text-[13px] font-medium text-stone-800">
                      Phrase d&apos;accroche
                    </label>
                    <textarea
                      id="contact-intro"
                      rows={2}
                      value={contactIntro}
                      onChange={(e) => setContactIntro(e.target.value)}
                      placeholder="Ce que le visiteur doit savoir avant d'écrire : délai de réponse, ce que vous attendez de lui…"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-subjects" className="block text-[13px] font-medium text-stone-800">
                      Motifs proposés dans le formulaire
                    </label>
                    <textarea
                      id="contact-subjects"
                      rows={3}
                      value={contactSubjects}
                      onChange={(e) => setContactSubjects(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <p className="text-[12.5px] leading-relaxed text-stone-500">
                      Un motif par ligne. Le premier est proposé par défaut.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-address-note" className="block text-[13px] font-medium text-stone-800">
                      Précision sur l&apos;adresse
                    </label>
                    <input
                      id="contact-address-note"
                      value={contactAddressNote}
                      onChange={(e) => setContactAddressNote(e.target.value)}
                      placeholder="Ex. : parking devant, 2e étage, accès par la cour…"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={bizLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 px-6 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {bizLoading ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
                  </button>
                </div>
              </form>
            )}

            {/* Code Promo de Bienvenue */}
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 mt-8">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Tag size={16} /> Email de bienvenue — Code promo
              </h2>

              {promoFetching ? (
                <p className="text-stone-600 text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSavePromo} className="space-y-6">
                  {promoMessage && (
                    <div className={`p-4 text-sm ${promoMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {promoMessage.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="promo-code" className="block text-[13px] font-medium text-stone-800">
                      Code promo
                    </label>
                    <input
                      id="promo-code"
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 font-mono text-lg tracking-widest uppercase"
                      placeholder="BIENVENUE"
                    />
                    <p className="text-[12.5px] text-stone-500">Le code sera automatiquement mis en majuscules.</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="promo-amount" className="block text-[13px] font-medium text-stone-800">
                      Montant de la réduction
                    </label>
                    <input
                      id="promo-amount"
                      type="text"
                      value={promoAmount}
                      onChange={(e) => setPromoAmount(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                      placeholder="20 CHF"
                    />
                    <p className="text-[12.5px] text-stone-500">Exemples : 20 CHF, 15 €, 10%</p>
                  </div>
                  <div className="border-2 border-dashed border-stone-300 bg-stone-50 rounded-lg p-5 text-center space-y-1">
                    <p className="text-[12.5px] font-medium text-stone-700">Aperçu dans l'email</p>
                    <p className="font-mono text-2xl font-bold text-stone-900 tracking-widest">{promoCode || 'BIENVENUE'}</p>
                    <p className="text-sm text-stone-500">Réduction de <strong>{promoAmount || '20 CHF'}</strong> sur la première prestation</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={promoLoading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      <Save size={16} />
                      {promoLoading ? 'Sauvegarde…' : 'Sauvegarder le code promo'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Onglet Éditorial & Marque ───────────────────────────── */}
        {activeTab === 'editorial' && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-3 mb-2">
              <div>
                <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                  <BookOpen size={16} /> Ligne Éditoriale, Ton &amp; Branding
                </h2>
                <p className="text-stone-500 text-sm mt-1">
                  Décrivez l'activité, le positionnement, le persona cible, le ton de voix et les piliers thématiques. Réutilisés par l'IA pour générer vos articles et posts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorialVoiceModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-semibold shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Mic size={16} />
                Lancer l'interview vocale (Claude)
              </button>
            </div>

            {editorialFetching ? (
              <p className="text-sm text-stone-600">Chargement des paramètres éditoriaux…</p>
            ) : (
              <form onSubmit={handleSaveEditorial} className="space-y-6">
                {editorialMessage && (
                  <div className={`p-4 text-sm ${editorialMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {editorialMessage.text}
                  </div>
                )}

                {/* Champ 1 : Activité et Contexte */}
                <div className="space-y-2">
                  <label htmlFor="editorial-activity" className="block text-[13px] font-medium text-stone-800 flex items-center justify-between">
                    <span>1. Activité &amp; Contexte général du site</span>
                    <span className="text-[12px] text-stone-500 font-normal">Description du métier, de la spécialisation et de l'offre</span>
                  </label>
                  <textarea
                    id="editorial-activity"
                    rows={4}
                    value={siteActivityContext}
                    onChange={(e) => setSiteActivityContext(e.target.value)}
                    placeholder="Présentation globale du site et de son secteur..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 2 : Public Cible et Persona */}
                <div className="space-y-2">
                  <label htmlFor="editorial-target" className="block text-[13px] font-medium text-stone-800 flex items-center justify-between">
                    <span>2. Public Cible &amp; Persona</span>
                    <span className="text-[12px] text-stone-500 font-normal">Profil des lecteurs/clients, douleurs et attentes</span>
                  </label>
                  <textarea
                    id="editorial-target"
                    rows={4}
                    value={siteTargetPersona}
                    onChange={(e) => setSiteTargetPersona(e.target.value)}
                    placeholder="Profil démographique, psychologique et problématiques du public visé..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 3 : Ton de voix */}
                <div className="space-y-2">
                  <label htmlFor="editorial-tone" className="block text-[13px] font-medium text-stone-800 flex items-center justify-between">
                    <span>3. Ton de voix &amp; Style d'écriture</span>
                    <span className="text-[12px] text-stone-500 font-normal">Registre de langue, tutoiement/vouvoiement, posture</span>
                  </label>
                  <textarea
                    id="editorial-tone"
                    rows={4}
                    value={siteToneOfVoice}
                    onChange={(e) => setSiteToneOfVoice(e.target.value)}
                    placeholder="Direct, conversationnel, tutoiement, parole de cabinet..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 4 : Ton de marque & Vocabulaire */}
                <div className="space-y-2">
                  <label htmlFor="editorial-brand" className="block text-[13px] font-medium text-stone-800 flex items-center justify-between">
                    <span>4. Ton de marque, Promesse &amp; Vocabulaire</span>
                    <span className="text-[12px] text-stone-500 font-normal">Mots clés de marque, termes privilégiés et mots interdits</span>
                  </label>
                  <textarea
                    id="editorial-brand"
                    rows={4}
                    value={siteBrandTone}
                    onChange={(e) => setSiteBrandTone(e.target.value)}
                    placeholder="Promesse phare, expressions fortes de la marque, mots interdits..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 5 : Piliers & Thématiques du Blog */}
                <div className="space-y-2">
                  <label htmlFor="editorial-topics" className="block text-[13px] font-medium text-stone-800 flex items-center justify-between">
                    <span>5. Piliers &amp; Thématiques majeures du Blog</span>
                    <span className="text-[12px] text-stone-500 font-normal">Grandes thématiques pour les idées et articles de blog</span>
                  </label>
                  <textarea
                    id="editorial-topics"
                    rows={5}
                    value={siteBlogTopics}
                    onChange={(e) => setSiteBlogTopics(e.target.value)}
                    placeholder="1. Thématique A...\n2. Thématique B..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={editorialLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 px-6 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {editorialLoading ? 'Enregistrement…' : 'Enregistrer la ligne éditoriale'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Onglet Modules ───────────────────────────────────────── */}
        {activeTab === 'modules' && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein">
            <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-2 mb-2 flex items-center gap-2">
              <Puzzle size={16} /> Modules du site
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              Active ou désactive les fonctionnalités du site. Un module désactivé disparaît du site public
              (pages, menu, plan du site) mais reste modifiable dans l'admin.
            </p>

            {modulesFetching ? (
              <p className="text-sm text-stone-600">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveModules} className="space-y-6">
                {modulesMessage && (
                  <div className={`p-4 text-sm ${modulesMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {modulesMessage.text}
                  </div>
                )}

                {[
                  { label: 'Blog / Articles', desc: 'Pages /blog, admin Articles et publication programmée.', value: moduleBlogEnabled, setter: setModuleBlogEnabled },
                  { label: "Génération & Assistant IA (Builder, Pages, Articles & Réseaux)", desc: "Contrôle toute la couche IA du Studio : assistant de section du builder de pages, générateur de structure de site, rédaction assistée d'articles et création de posts réseaux.", value: moduleAiEnabled, setter: setModuleAiEnabled },
                  { label: 'Événements / Ateliers', desc: 'Pages /ateliers, admin Événements et inscriptions/paiement.', value: moduleEventsEnabled, setter: setModuleEventsEnabled },
                  { label: 'Newsletter', desc: "Admin Newsletter (envoi d'e-mails), formulaires d'inscription et bannière sur le site.", value: moduleNewsletterEnabled, setter: setModuleNewsletterEnabled },
                  { label: 'Réseaux Sociaux', desc: "Génération de contenu Instagram/LinkedIn/Facebook (articles, flux RSS, suggestions), calendrier et automatisation.", value: moduleSocialEnabled, setter: setModuleSocialEnabled },
                  { label: 'Caisse & facturation', desc: "Encaissement, fichier clientes, quittances PDF, journal des recettes et export pour la fiducie. Module interne : rien n'apparaît sur le site public.", value: moduleCaisseEnabled, setter: setModuleCaisseEnabled },
                  { label: 'Mots-clés & SEO', desc: 'Espace SEO : recherche de mots-clés, suggestions de sujets et clusters sémantiques.', value: moduleKeywordsEnabled, setter: setModuleKeywordsEnabled },
                  { label: 'Agent IA', desc: "Widget de conversation sur le site public et suivi des échanges dans l'admin.", value: moduleAgentsEnabled, setter: setModuleAgentsEnabled },
                  { label: 'Automatisations', desc: 'Déclencheurs planifiés et événements applicatifs (webhook, e-mail, génération de contenu).', value: moduleAutomationsEnabled, setter: setModuleAutomationsEnabled },
                ].map((mod) => (
                  <div key={mod.label} className="flex items-start gap-4 py-3 border-b border-stone-50 last:border-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mod.value}
                      aria-label={`${mod.value ? 'Désactiver' : 'Activer'} le module ${mod.label}`}
                      onClick={() => mod.setter(!mod.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 cursor-pointer ${mod.value ? 'bg-purple-600' : 'bg-stone-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mod.value ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span>
                      <span className="block text-sm font-semibold text-stone-900">{mod.label}</span>
                      <span className="block text-[12.5px] text-stone-500 mt-0.5">{mod.desc}</span>
                    </span>
                  </div>
                ))}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={modulesLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} />
                    {modulesLoading ? 'Enregistrement…' : 'Enregistrer les modules'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Onglet Caisse & facturation ─────────────────────────── */}
        {activeTab === 'caisse' && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein">
            <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-2 mb-2 flex items-center gap-2">
              <CreditCard size={16} /> Caisse &amp; facturation
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              TVA, coordonnées bancaires et mentions imprimées sur les quittances.
              Les coordonnées de l&apos;institut affichées en tête de facture viennent de l&apos;onglet <strong>Entreprise</strong>.
            </p>

            {caisseFetching ? (
              <p className="text-sm text-stone-600">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveCaisse} className="space-y-6">
                {caisseMessage && (
                  <div className={`p-4 text-sm ${caisseMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {caisseMessage.text}
                  </div>
                )}

                <div className="flex items-start gap-4 py-3 border-b border-stone-50">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={caisseTvaAssujetti}
                    aria-label={`${caisseTvaAssujetti ? 'Désactiver' : 'Activer'} l'assujettissement à la TVA`}
                    onClick={() => setCaisseTvaAssujetti(!caisseTvaAssujetti)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 cursor-pointer ${caisseTvaAssujetti ? 'bg-stone-900' : 'bg-stone-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${caisseTvaAssujetti ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span>
                    <span className="block text-sm font-medium text-stone-800">Activité assujettie à la TVA</span>
                    <span className="block text-[12.5px] text-stone-500 leading-relaxed">
                      À laisser désactivé tant que le chiffre d&apos;affaires annuel reste sous CHF 100&apos;000 (LTVA art. 10) :
                      les factures portent alors la mention « TVA non applicable » et un taux de 0 %.
                      Activer ce réglage fait apparaître le choix du taux à la caisse.
                      Les factures déjà émises gardent leur propre taux — elles ne sont jamais recalculées.
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="caisse-taux" className="block text-[13px] font-medium text-stone-800 mb-2">
                      Taux par défaut
                    </label>
                    <select
                      id="caisse-taux"
                      value={caisseTvaTaux}
                      onChange={e => setCaisseTvaTaux(e.target.value)}
                      disabled={!caisseTvaAssujetti}
                      className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all disabled:bg-stone-50 disabled:text-stone-500 cursor-pointer"
                    >
                      <option value="0">0 % — non assujettie</option>
                      <option value="8.1">8.1 % — taux normal</option>
                      <option value="3.8">3.8 % — hébergement</option>
                      <option value="2.6">2.6 % — taux réduit</option>
                    </select>
                    <p className="text-[12.5px] text-stone-500 mt-1.5">
                      Appliqué aux nouvelles prestations du catalogue. Chaque prestation peut avoir le sien.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="caisse-tva-numero" className="block text-[13px] font-medium text-stone-800 mb-2">
                      N° TVA
                    </label>
                    <input
                      id="caisse-tva-numero"
                      type="text"
                      value={caisseTvaNumero}
                      onChange={e => setCaisseTvaNumero(e.target.value)}
                      placeholder="CHE-123.456.789 TVA"
                      className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all"
                    />
                    <p className="text-[12.5px] text-stone-500 mt-1.5">
                      Obligatoire sur les factures dès l&apos;assujettissement (OTVA art. 26).
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="caisse-iban" className="block text-[13px] font-medium text-stone-800 mb-2">
                    IBAN
                  </label>
                  <input
                    id="caisse-iban"
                    type="text"
                    value={caisseIban}
                    onChange={e => setCaisseIban(e.target.value)}
                    placeholder="CH00 0000 0000 0000 0000 0"
                    className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all"
                  />
                  <p className="text-[12.5px] text-stone-500 mt-1.5">
                    Imprimé sur la quittance uniquement quand le paiement est un virement.
                  </p>
                </div>

                <div>
                  <label htmlFor="caisse-mentions" className="block text-[13px] font-medium text-stone-800 mb-2">
                    Mentions en pied de facture
                  </label>
                  <textarea
                    id="caisse-mentions"
                    rows={3}
                    value={caisseMentions}
                    onChange={e => setCaisseMentions(e.target.value)}
                    className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all resize-y"
                  />
                </div>

                <div className="pt-2 border-t border-stone-200">
                  <h3 className="text-[13px] font-medium text-stone-800 mb-4">Bons cadeaux</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="caisse-bon-validite" className="block text-[13px] font-medium text-stone-800 mb-2">
                        Durée de validité
                      </label>
                      <select
                        id="caisse-bon-validite"
                        value={caisseBonValidite}
                        onChange={e => setCaisseBonValidite(e.target.value)}
                        className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all cursor-pointer"
                      >
                        <option value="12">1 an</option>
                        <option value="24">2 ans</option>
                        <option value="36">3 ans</option>
                        <option value="60">5 ans (recommandé)</option>
                        <option value="120">10 ans (durée légale)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 px-5 py-4 text-xs text-stone-500 leading-relaxed">
                    Le droit suisse ne fixe <strong>aucune durée minimale</strong>. Un bon cadeau est une
                    créance ordinaire : à défaut d&apos;accord contraire, il se prescrit par 10 ans
                    (CO art. 127). Une validité courte reste possible si elle est annoncée à l&apos;achat,
                    mais les organisations de consommateurs la contestent régulièrement — d&apos;où le
                    réglage à 5 ans par défaut, usuel dans la branche. En cas de doute, demande à ta
                    fiduciaire.
                    <br /><br />
                    L&apos;échéance est <strong>figée sur chaque bon à son émission</strong> : modifier ce
                    réglage n&apos;affecte que les bons vendus ensuite, jamais ceux déjà remis à une cliente.
                  </div>

                  <div className="mt-4">
                    <label htmlFor="caisse-bon-mentions" className="block text-[13px] font-medium text-stone-800 mb-2">
                      Conditions imprimées sur le bon
                    </label>
                    <textarea
                      id="caisse-bon-mentions"
                      rows={3}
                      value={caisseBonMentions}
                      onChange={e => setCaisseBonMentions(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none transition-all resize-y"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-5 py-4 text-xs text-stone-500 leading-relaxed">
                  <strong className="block text-stone-700 mb-1 font-semibold">Numérotation et conservation</strong>
                  Les factures sont numérotées <code className="px-1 bg-white rounded border border-stone-200">FAC-{new Date().getFullYear()}-0001</code>,
                  en continu et par année civile. Une écriture encaissée ne peut être ni supprimée ni recalculée :
                  une erreur se corrige par une annulation depuis le journal, qui laisse la trace exigée par
                  le Code des obligations (art. 957a). Pense à exporter le livre de caisse pour ta fiducie
                  et à conserver les fichiers 10 ans (art. 958f).
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={caisseLoading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {caisseLoading ? 'Enregistrement…' : 'Enregistrer les réglages'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Onglet Clés API & Services ─────────────────────────── */}
        {activeTab === 'keys' && (
          <ApiKeysPanel />
        )}

        {/* ── Onglet IA & Budget ──────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein">
            <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-2 mb-2 flex items-center gap-2">
              <Sparkles size={16} /> Modèle IA &amp; budget
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              Choisis le modèle Claude utilisé par toutes les générations (articles, pages, SEO, réseaux sociaux)
              et surveille la dépense du mois. Les tarifs sont ceux d'Anthropic, en dollars par million de tokens.
            </p>

            {aiFetching ? (
              <p className="text-sm text-stone-600">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveAi} className="space-y-8">
                {aiMessage && (
                  <div className={`p-4 text-sm ${aiMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {aiMessage.text}
                  </div>
                )}

                {/* ── Choix du modèle ────────────────────────────────── */}
                <fieldset className="space-y-3">
                  <legend className="text-[13px] font-medium text-stone-800 mb-2">Modèle</legend>
                  {aiCatalog.map((m) => {
                    const selected = aiModel === m.id;
                    // Coût indicatif d'un article généré (~2 000 tokens en entrée, ~16 000 en sortie).
                    const perArticle = m.inputPricePerMTok * 0.002 + m.outputPricePerMTok * 0.016;
                    return (
                      <label
                        key={m.id}
                        className={`flex gap-3 items-start p-4 border rounded-xl cursor-pointer transition-colors ${selected ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-300'} ${m.available === false ? 'opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name="ai-model"
                          value={m.id}
                          checked={selected}
                          onChange={() => setAiModel(m.id)}
                          className="mt-1 accent-sage cursor-pointer"
                        />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-stone-800">{m.label}</span>
                            {m.badge === 'qualite'    && <span className="text-[12px] bg-stone-900 text-white px-2 py-0.5 rounded-full">Qualité max</span>}
                            {m.badge === 'equilibre'  && <span className="text-[12px] bg-stone-900 text-white px-2 py-0.5 rounded-full">Meilleur rapport</span>}
                            {m.badge === 'economique' && <span className="text-[12px] bg-amber-500 text-white px-2 py-0.5 rounded-full">Le moins cher</span>}
                            {m.available === false && (
                              <span className="text-[12px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                Plus servi par Anthropic
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-stone-500 mt-1">{m.description}</span>
                          <span className="block text-[12.5px] text-stone-500 mt-1 font-mono">
                            ${m.inputPricePerMTok} / M tokens entrée · ${m.outputPricePerMTok} / M sortie
                            {' — '}≈ ${perArticle.toFixed(2)} par article généré
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  <p className="text-[12.5px] text-stone-500">
                    Les balises méta restent générées avec Haiku 4.5 quel que soit ce choix : la tâche est trop
                    courte pour justifier un modèle coûteux.
                  </p>
                </fieldset>

                {/* ── Niveau de réflexion ────────────────────────────── */}
                <fieldset className="space-y-2">
                  <legend className="text-[13px] font-medium text-stone-800 mb-2">
                    Niveau de réflexion
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {AI_EFFORT_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setAiEffort(level.value)}
                        title={level.hint}
                        className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${aiEffort === level.value ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12.5px] text-stone-500">
                    {AI_EFFORT_LEVELS.find((l) => l.value === aiEffort)?.hint}
                  </p>
                  {aiCatalog.find((m) => m.id === aiModel)?.supportsEffort === false && (
                    <p className="text-xs text-amber-600">
                      Ce modèle ne gère pas les niveaux de réflexion : le réglage est ignoré tant qu'il est sélectionné.
                    </p>
                  )}
                </fieldset>

                {/* ── Budget & alerte ────────────────────────────────── */}
                <fieldset className="space-y-4">
                  <legend className="text-[13px] font-medium text-stone-800 mb-2">
                    Budget mensuel &amp; alerte
                  </legend>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="ai-budget" className="block text-xs text-stone-500 font-medium">
                        Budget par mois (USD) — 0 pour désactiver l'alerte
                      </label>
                      <input
                        id="ai-budget"
                        type="number"
                        min="0"
                        step="1"
                        value={aiBudget}
                        onChange={(e) => setAiBudget(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="ai-alert" className="block text-xs text-stone-500 font-medium">
                        Alerter à partir de (% du budget)
                      </label>
                      <input
                        id="ai-alert"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={aiAlertPercent}
                        onChange={(e) => setAiAlertPercent(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-900"
                      />
                    </div>
                  </div>
                  <p className="text-[12.5px] text-stone-500">
                    Anthropic ne publie pas le solde du compte via son API : la dépense est reconstituée à partir des
                    tokens facturés à chaque génération, puis comparée à ce budget. Une bannière apparaît en haut de
                    l'admin dès le seuil atteint. Le rechargement des crédits reste à faire sur console.anthropic.com.
                  </p>
                </fieldset>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {aiLoading ? 'Enregistrement…' : 'Enregistrer les réglages IA'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Consommation du mois ─────────────────────────────── */}
            {aiUsage && (
              <div className="mt-10 border-t border-stone-200 pt-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-[13px] font-medium text-stone-800">
                    Consommation depuis le 1er du mois
                  </h3>
                  <button
                    type="button"
                    onClick={loadAiUsage}
                    className="flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} /> Actualiser
                  </button>
                </div>

                {aiUsage.usage?.unavailable ? (
                  <div className="text-xs text-amber-600 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <p>
                      Journal de consommation indisponible : applique la migration{' '}
                      <code className="font-mono bg-amber-50 px-1 py-0.5 rounded">
                        supabase/migrations/20260729_ai_usage.sql
                      </code>{' '}
                      sur le projet Supabase pour activer le suivi du budget.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-stone-900">
                        ${Number(aiUsage.usage.totalUsd).toFixed(2)}
                      </span>
                      {aiUsage.config.budgetUsd > 0 && (
                        <span className="text-sm text-stone-600">
                          sur ${Number(aiUsage.config.budgetUsd).toFixed(2)} — reste ${Number(aiUsage.remainingUsd ?? 0).toFixed(2)}
                        </span>
                      )}
                      <span className="text-[12.5px] text-stone-500">({aiUsage.usage.calls} appels)</span>
                    </div>

                    {aiUsage.config.budgetUsd > 0 && (
                      <div className="h-2 bg-stone-100 rounded-full mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${aiUsage.level === 'exceeded' ? 'bg-red-500' : aiUsage.level === 'warning' ? 'bg-amber-500' : 'bg-stone-900'}`}
                          style={{ width: `${Math.min(100, aiUsage.percentUsed)}%` }}
                        />
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-6 mt-6">
                      {[
                        { title: 'Par modèle', rows: aiUsage.usage.byModel },
                        { title: 'Par usage', rows: aiUsage.usage.byFeature },
                      ].map((block) => (
                        <div key={block.title}>
                          <p className="text-[12px] text-stone-500 font-bold mb-2">{block.title}</p>
                          {block.rows.length === 0 ? (
                            <p className="text-[12.5px] text-stone-500 italic">Aucune génération ce mois-ci.</p>
                          ) : (
                            <ul className="space-y-1">
                              {block.rows.map((row: any) => (
                                <li key={row.key} className="flex justify-between text-xs text-stone-600 border-b border-stone-50 py-1">
                                  <span className="truncate pr-2">{row.key}</span>
                                  <span className="font-mono shrink-0">${Number(row.costUsd).toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[12.5px] text-stone-500 mt-4">
                      Estimation calculée sur les tarifs publics d'Anthropic ; la facture réelle peut différer
                      légèrement (remises, tarifs de lancement).
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Flotte Multi-Sites ────────────────────────────── */}
        {activeTab === 'fleet' && <FleetManagerPanel />}

        {/* ── Onglet Sécurité (Mot de passe) ──────────────────────── */}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
                <Lock size={16} /> Sécurité
              </h2>

              <form onSubmit={handleUpdatePassword} className="space-y-6">
                {pwdMessage && (
                  <div className={`p-4 text-sm ${pwdMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {pwdMessage.text}
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="new-password" className="block text-[13px] font-medium text-stone-800">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirm-password" className="block text-[13px] font-medium text-stone-800">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    placeholder="••••••••"
                  />
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={pwdLoading || !password}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {pwdLoading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7 animate-fadein space-y-4">
              <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" /> Synchronisation Système & Base Supabase
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Exécutez la vérification automatique pour vous assurer que les tables Supabase possèdent toutes les colonnes requises par les nouvelles fonctionnalités (Hub SIO/GEO, entonnoir, prompts IA).
              </p>

              {migrateLog && (
                <div className={`p-4 text-xs rounded-lg space-y-2 border ${migrateLog.error ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                  <p className="font-semibold">{migrateLog.error ? migrateLog.error : migrateLog.message}</p>
                  {migrateLog.logs && migrateLog.logs.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
                      {migrateLog.logs.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleAutoMigrate}
                disabled={migrating}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <RefreshCw size={14} className={migrating ? 'animate-spin' : ''} />
                {migrating ? 'Synchronisation en cours…' : 'Vérifier & Synchroniser la Base Supabase'}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <EditorialVoiceInterviewModal
        isOpen={isEditorialVoiceModalOpen}
        onClose={() => setIsEditorialVoiceModalOpen(false)}
        initialValues={{
          site_activity_context: siteActivityContext,
          site_target_persona: siteTargetPersona,
          site_tone_of_voice: siteToneOfVoice,
          site_brand_tone: siteBrandTone,
          site_blog_topics: siteBlogTopics,
        }}
        onApply={(data) => {
          if (data.site_activity_context) setSiteActivityContext(data.site_activity_context);
          if (data.site_target_persona) setSiteTargetPersona(data.site_target_persona);
          if (data.site_tone_of_voice) setSiteToneOfVoice(data.site_tone_of_voice);
          if (data.site_brand_tone) setSiteBrandTone(data.site_brand_tone);
          if (data.site_blog_topics) setSiteBlogTopics(data.site_blog_topics);
          setEditorialMessage({
            type: 'success',
            text: 'Ligne éditoriale pré-remplie par l’interview vocale Claude ! N’oubliez pas de cliquer sur "Enregistrer la ligne éditoriale".',
          });
        }}
      />
    </>
  );
}
