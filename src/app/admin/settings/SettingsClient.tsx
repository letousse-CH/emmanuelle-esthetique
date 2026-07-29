"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { Save, Lock, Tag, Image, X, Check, Sun, Moon, Palette, Type, Sliders, Eye, RefreshCw, Share2, Puzzle, Building2, Sparkles, AlertTriangle, BookOpen } from 'lucide-react';
import { settingsCache } from '../../../hooks/useSettings';
import { SETTINGS_DEFAULTS } from '../../../constants/settings';
import { AI_EFFORT_LEVELS, AI_MODELS, AiEffort, AiModelSpec, DEFAULT_AI_EFFORT, DEFAULT_AI_MODEL } from '../../../constants/aiModels';

interface MediaAsset {
  id: string;
  url: string;
  alt_text: string;
}

const GOOGLE_FONTS_SERIF = [
  'Playfair Display',
  'Cormorant Garamond',
  'Lora',
  'Merriweather',
  'Cinzel',
  'EB Garamond',
  'Libre Baskerville',
  'Spectral'
];

const GOOGLE_FONTS_SANS = [
  'Inter',
  'Outfit',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Open Sans',
  'Roboto',
  'Raleway'
];

export default function Settings() {

  // ── Mot de passe ─────────────────────────────────────────
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading]           = useState(false);
  const [pwdMessage, setPwdMessage]           = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  // ── Réseaux sociaux ──────────────────────────────────────
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialLinkedin, setSocialLinkedin]   = useState('');
  const [socialYoutube, setSocialYoutube]     = useState('');
  const [socialSpotify, setSocialSpotify]     = useState('');
  const [socialLoading, setSocialLoading]     = useState(false);
  const [socialFetching, setSocialFetching]   = useState(true);
  const [socialMessage, setSocialMessage]     = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
  const [headingFont, setHeadingFont]                 = useState('Cormorant Garamond');
  const [customHeadingFont, setCustomHeadingFont]       = useState('');
  const [bodyFont, setBodyFont]                       = useState('Inter');
  const [customBodyFont, setCustomBodyFont]             = useState('');
  const [primaryColor, setPrimaryColor]               = useState('#8A9A7B');
  
  const [btnDarkBg, setBtnDarkBg]                     = useState('#3A3730');
  const [btnDarkText, setBtnDarkText]                 = useState('#ffffff');
  const [btnDarkHoverBg, setBtnDarkHoverBg]           = useState('#433e37');
  
  const [btnLightBg, setBtnLightBg]                   = useState('#ffffff');
  const [btnLightText, setBtnLightText]               = useState('#3A3730');
  const [btnLightBorder, setBtnLightBorder]           = useState('#E2D9CB');
  const [btnLightHoverBg, setBtnLightHoverBg]         = useState('#F5F0E8');
  const [btnLightHoverText, setBtnLightHoverText]     = useState('#8A9A7B');
  const [btnLightHoverBorder, setBtnLightHoverBorder] = useState('#8A9A7B');
  
  const [textH2Color, setTextH2Color]                 = useState('#3A3730');
  const [textBodyColor, setTextBodyColor]             = useState('#3A3730');
  
  const [borderRadiusBase, setBorderRadiusBase]       = useState('8px');
  
  const [styleLoading, setStyleLoading]               = useState(false);
  const [styleFetching, setStyleFetching]             = useState(true);
  const [styleMessage, setStyleMessage]               = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // ── Modules ───────────────────────────────────────────────
  const [moduleBlogEnabled, setModuleBlogEnabled]           = useState(true);
  const [moduleAiEnabled, setModuleAiEnabled]               = useState(true);
  const [moduleEventsEnabled, setModuleEventsEnabled]       = useState(true);
  const [moduleNewsletterEnabled, setModuleNewsletterEnabled] = useState(true);
  const [moduleSocialEnabled, setModuleSocialEnabled]       = useState(true);
  const [modulesLoading, setModulesLoading]                 = useState(false);
  const [modulesFetching, setModulesFetching]               = useState(true);
  const [modulesMessage, setModulesMessage]                 = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  const [activeTab, setActiveTab]                     = useState<'general' | 'business' | 'editorial' | 'modules' | 'ai' | 'style' | 'security'>('general');

  // Preview button hovers
  const [darkBtnHover, setDarkBtnHover]               = useState(false);
  const [lightBtnHover, setLightBtnHover]             = useState(false);

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

  useEffect(() => {
    loadHero();
    loadPromo();
    loadStyles();
    loadSocials();
    loadAuthor();
    loadHeaderRegisterLink();
    loadModules();
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
      setAiMessage({ type: 'success', text: 'Réglages IA enregistrés. Les prochaines générations utilisent ce modèle (délai maximum : 1 minute).' });
      await loadAiUsage();
    }
    setAiLoading(false);
  };

  const loadModules = async () => {
    setModulesFetching(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['module_blog_enabled', 'module_ai_generation_enabled', 'module_events_enabled', 'module_newsletter_enabled', 'module_social_enabled']);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.module_blog_enabled !== undefined)          setModuleBlogEnabled(map.module_blog_enabled !== 'false');
      if (map.module_ai_generation_enabled !== undefined) setModuleAiEnabled(map.module_ai_generation_enabled !== 'false');
      if (map.module_events_enabled !== undefined)        setModuleEventsEnabled(map.module_events_enabled !== 'false');
      if (map.module_newsletter_enabled !== undefined)    setModuleNewsletterEnabled(map.module_newsletter_enabled !== 'false');
      if (map.module_social_enabled !== undefined)        setModuleSocialEnabled(map.module_social_enabled !== 'false');
    }
    setModulesFetching(false);
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
      .in('key', ['social_instagram', 'social_linkedin', 'social_youtube', 'social_spotify']);
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      if (map.social_instagram) setSocialInstagram(map.social_instagram);
      if (map.social_linkedin)  setSocialLinkedin(map.social_linkedin);
      if (map.social_youtube)   setSocialYoutube(map.social_youtube);
      if (map.social_spotify)   setSocialSpotify(map.social_spotify);
    }
    setSocialFetching(false);
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

  const handleSaveSocials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialMessage(null);
    setSocialLoading(true);
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'social_instagram', value: socialInstagram.trim() },
        { key: 'social_linkedin',  value: socialLinkedin.trim() },
        { key: 'social_youtube',   value: socialYoutube.trim() },
        { key: 'social_spotify',   value: socialSpotify.trim() },
      ], { onConflict: 'key' });
    if (error) {
      setSocialMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setSocialMessage({ type: 'success', text: 'Réseaux sociaux mis à jour !' });
    }
    setSocialLoading(false);
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

  const loadStyles = async () => {
    setStyleFetching(true);
    const keys = [
      'style_font_headings',
      'style_font_body',
      'style_color_primary',
      'style_color_btn_dark_bg',
      'style_color_btn_dark_text',
      'style_color_btn_dark_hover_bg',
      'style_color_btn_light_bg',
      'style_color_btn_light_text',
      'style_color_btn_light_border',
      'style_color_btn_light_hover_bg',
      'style_color_btn_light_hover_text',
      'style_color_btn_light_hover_border',
      'style_border_radius_base',
      'style_color_text_h2',
      'style_color_text_body'
    ];
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);
      
    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      
      if (map.style_font_headings) {
        if (GOOGLE_FONTS_SERIF.includes(map.style_font_headings)) {
          setHeadingFont(map.style_font_headings);
        } else {
          setHeadingFont('custom');
          setCustomHeadingFont(map.style_font_headings);
        }
      }
      if (map.style_font_body) {
        if (GOOGLE_FONTS_SANS.includes(map.style_font_body)) {
          setBodyFont(map.style_font_body);
        } else {
          setBodyFont('custom');
          setCustomBodyFont(map.style_font_body);
        }
      }
      if (map.style_color_primary) setPrimaryColor(map.style_color_primary);
      
      if (map.style_color_btn_dark_bg) setBtnDarkBg(map.style_color_btn_dark_bg);
      if (map.style_color_btn_dark_text) setBtnDarkText(map.style_color_btn_dark_text);
      if (map.style_color_btn_dark_hover_bg) setBtnDarkHoverBg(map.style_color_btn_dark_hover_bg);
      
      if (map.style_color_btn_light_bg) setBtnLightBg(map.style_color_btn_light_bg);
      if (map.style_color_btn_light_text) setBtnLightText(map.style_color_btn_light_text);
      if (map.style_color_btn_light_border) setBtnLightBorder(map.style_color_btn_light_border);
      if (map.style_color_btn_light_hover_bg) setBtnLightHoverBg(map.style_color_btn_light_hover_bg);
      if (map.style_color_btn_light_hover_text) setBtnLightHoverText(map.style_color_btn_light_hover_text);
      if (map.style_color_btn_light_hover_border) setBtnLightHoverBorder(map.style_color_btn_light_hover_border);
      
      if (map.style_color_text_h2) setTextH2Color(map.style_color_text_h2);
      if (map.style_color_text_body) setTextBodyColor(map.style_color_text_body);
      
      if (map.style_border_radius_base) setBorderRadiusBase(map.style_border_radius_base);
    }
    setStyleFetching(false);
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

  const handleSaveStyles = async (e: React.FormEvent) => {
    e.preventDefault();
    setStyleMessage(null);
    setStyleLoading(true);

    const actualHeadingFont = headingFont === 'custom' ? customHeadingFont : headingFont;
    const actualBodyFont = bodyFont === 'custom' ? customBodyFont : bodyFont;

    if (!actualHeadingFont.trim() || !actualBodyFont.trim()) {
      setStyleMessage({ type: 'error', text: 'Veuillez renseigner les polices.' });
      setStyleLoading(false);
      return;
    }

    const updates = [
      { key: 'style_font_headings', value: actualHeadingFont.trim() },
      { key: 'style_font_body', value: actualBodyFont.trim() },
      { key: 'style_color_primary', value: primaryColor },
      { key: 'style_color_btn_dark_bg', value: btnDarkBg },
      { key: 'style_color_btn_dark_text', value: btnDarkText },
      { key: 'style_color_btn_dark_hover_bg', value: btnDarkHoverBg },
      { key: 'style_color_btn_light_bg', value: btnLightBg },
      { key: 'style_color_btn_light_text', value: btnLightText },
      { key: 'style_color_btn_light_border', value: btnLightBorder },
      { key: 'style_color_btn_light_hover_bg', value: btnLightHoverBg },
      { key: 'style_color_btn_light_hover_text', value: btnLightHoverText },
      { key: 'style_color_btn_light_hover_border', value: btnLightHoverBorder },
      { key: 'style_color_text_h2', value: textH2Color },
      { key: 'style_color_text_body', value: textBodyColor },
      { key: 'style_border_radius_base', value: borderRadiusBase },
    ];

    const { error } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'key' });

    if (error) {
      setStyleMessage({ type: 'error', text: 'Erreur lors de la sauvegarde : ' + error.message });
    } else {
      setStyleMessage({ type: 'success', text: 'Styles globaux sauvegardés avec succès ! Rechargement de la page...' });
      
      const localMap = Object.fromEntries(updates.map(u => [u.key, u.value]));
      localStorage.setItem('site_global_styles', JSON.stringify(localMap));
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    setStyleLoading(false);
  };

  const activeHeadingFont = headingFont === 'custom' ? customHeadingFont : headingFont;
  const activeBodyFont = bodyFont === 'custom' ? customBodyFont : bodyFont;

  const previewHeadingFontUrl = activeHeadingFont ? activeHeadingFont.replace(/ /g, '+') : 'Playfair+Display';
  const previewBodyFontUrl = activeBodyFont ? activeBodyFont.replace(/ /g, '+') : 'Inter';
  const previewGoogleFontsUrl = `https://fonts.googleapis.com/css2?family=${previewHeadingFontUrl}:wght@300;400;500;600;700;800&family=${previewBodyFontUrl}:wght@300;400;500;600;700&display=swap`;

  return (
    <>
      {activeTab === 'style' && (
        <link rel="stylesheet" href={previewGoogleFontsUrl} />
      )}

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
            className="bg-white w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden outline-none"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h3 id="media-picker-title" className="font-bold text-stone-900 uppercase tracking-widest text-sm">Choisir une image</h3>
              <button onClick={() => setShowPicker(false)} aria-label="Fermer la médiathèque" className="p-2 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {mediaLoading ? (
                <p className="text-center text-stone-400 italic py-12">Chargement des médias…</p>
              ) : mediaAssets.length === 0 ? (
                <p className="text-center text-stone-400 italic py-12">Aucune image dans la médiathèque.</p>
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
                        className={`relative group aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected ? 'border-sage shadow-lg' : 'border-stone-200 hover:border-sage/50'}`}
                      >
                        <img src={asset.url} alt={asset.alt_text} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-sage/20 flex items-center justify-center">
                            <div className="bg-sage text-white rounded-full p-1.5">
                              <Check size={14} />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-stone-900/60 text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className={`transition-all duration-300 ${activeTab === 'style' ? 'max-w-5xl' : 'max-w-2xl'} space-y-10`}>
        <div className="mb-2">
          <h1 className="text-2xl font-light text-stone-900 uppercase tracking-widest">
            Paramètres du site & design
          </h1>
          <p className="text-stone-500 mt-2">Gérez la charte graphique globale et les paramètres généraux de votre site.</p>
        </div>

        {/* Navigation Onglets */}
        <div role="tablist" aria-label="Sections des paramètres" className="flex flex-wrap gap-1.5 bg-stone-100 p-1.5 rounded-xl w-fit">
          <button
            role="tab"
            aria-selected={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'general' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Tag size={14} /> Général
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'business'}
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'business' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Building2 size={14} /> Entreprise
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'editorial'}
            onClick={() => setActiveTab('editorial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'editorial' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <BookOpen size={14} /> Éditorial &amp; Marque
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'modules'}
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'modules' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Puzzle size={14} /> Modules
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'ai'}
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'ai' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Sparkles size={14} /> IA &amp; Budget
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'style'}
            onClick={() => setActiveTab('style')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'style' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Palette size={14} /> Design & Style
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'security'}
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${activeTab === 'security' ? 'bg-white text-sage shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <Lock size={14} /> Sécurité
          </button>
        </div>

        {/* ── Onglet Général (Hero + Code promo) ────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-10 animate-fadein">
            {/* Logo Section */}
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
                <Image size={16} /> Identité visuelle — Logo du site
              </h2>

              {heroFetching ? (
                <p className="text-stone-400 italic text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveLogo} className="space-y-8">
                  {logoMessage && (
                    <div className={`p-4 text-sm ${logoMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {logoMessage.text}
                    </div>
                  )}

                  {/* Logo Image */}
                  {/* Favicon */}
                  <div className="space-y-3 pb-6 border-b border-stone-100">
                    <label htmlFor="settings-favicon" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
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
                        className="flex-1 px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('favicon', e.currentTarget)}
                        className="flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-400">Pris en compte au prochain déploiement (rendu côté serveur).</p>
                  </div>

                  <div className="space-y-3">
                    <label htmlFor="settings-logo" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
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
                        className="flex-1 px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('logo', e.currentTarget)}
                        className="flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  {/* Logo du Footer Image */}
                  <div className="space-y-3 pt-6 border-t border-stone-100">
                    <label htmlFor="settings-footer-logo" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
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
                        className="flex-1 px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('footerLogo', e.currentTarget)}
                        className="flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  {/* Image footer (colonne gauche) */}
                  <div className="space-y-3 pt-6 border-t border-stone-100">
                    <label htmlFor="settings-footer-image" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
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
                        className="flex-1 px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => openPicker('footerImage', e.currentTarget)}
                        className="flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-widest transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Image size={14} /> Médiathèque
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-stone-100 pt-6">
                    <button
                      type="submit"
                      disabled={logoLoading || !logoImage.trim()}
                      className="flex items-center gap-2 bg-stone-900 hover:bg-sage text-white px-8 py-4 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {logoLoading ? (
                        <>Enregistrement…</>
                      ) : (
                        <><Save size={14} /> Enregistrer le logo</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Code Promo */}
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
                <Tag size={16} /> Email de bienvenue — Code promo
              </h2>

              {promoFetching ? (
                <p className="text-stone-400 italic text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSavePromo} className="space-y-6">
                  {promoMessage && (
                    <div className={`p-4 text-sm ${promoMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {promoMessage.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="promo-code" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
                      Code promo
                    </label>
                    <input
                      id="promo-code"
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white font-mono text-lg tracking-widest uppercase"
                      placeholder="BIENVENUE"
                    />
                    <p className="text-xs text-stone-400">Le code sera automatiquement mis en majuscules.</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="promo-amount" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
                      Montant de la réduction
                    </label>
                    <input
                      id="promo-amount"
                      type="text"
                      value={promoAmount}
                      onChange={(e) => setPromoAmount(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white"
                      placeholder="20 CHF"
                    />
                    <p className="text-xs text-stone-400">Exemples : 20 CHF, 15 €, 10%</p>
                  </div>
                  <div className="border-2 border-dashed border-sage/40 bg-sage/5 rounded-lg p-5 text-center space-y-1">
                    <p className="text-xs uppercase tracking-widest text-stone-400">Aperçu dans l'email</p>
                    <p className="font-mono text-2xl font-bold text-stone-900 tracking-widest">{promoCode || 'BIENVENUE'}</p>
                    <p className="text-sm text-stone-500">Réduction de <strong>{promoAmount || '20 CHF'}</strong> sur la première séance individuelle</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={promoLoading}
                      className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      <Save size={16} />
                      {promoLoading ? 'Sauvegarde…' : 'Sauvegarder'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            {/* Bouton S'inscrire */}
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
                <Sliders size={16} /> Bouton d'action du Menu (Header)
              </h2>

              {headerRegisterFetching ? (
                <p className="text-stone-400 italic text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveHeaderRegisterLink} className="space-y-6">
                  {headerRegisterMessage && (
                    <div className={`p-4 text-sm ${headerRegisterMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {headerRegisterMessage.text}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="header-register-link" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
                      Lien du bouton "S'inscrire" (Menu principal)
                    </label>
                    <input
                      id="header-register-link"
                      type="text"
                      value={headerRegisterLink}
                      onChange={(e) => setHeaderRegisterLink(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      placeholder="/contact"
                    />
                    <p className="text-xs text-stone-400">Exemple : /contact, /programme-complet, ou un lien externe complet https://...</p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={headerRegisterLoading}
                      className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      <Save size={16} />
                      {headerRegisterLoading ? 'Sauvegarde…' : 'Sauvegarder le lien'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Réseaux sociaux */}
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
                <Share2 size={16} /> Réseaux sociaux
              </h2>
              {socialFetching ? (
                <p className="text-stone-400 italic text-sm">Chargement…</p>
              ) : (
                <form onSubmit={handleSaveSocials} className="space-y-5">
                  {socialMessage && (
                    <div className={`p-4 text-sm ${socialMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {socialMessage.text}
                    </div>
                  )}
                  {[
                    { label: 'Instagram', value: socialInstagram, setter: setSocialInstagram, placeholder: 'https://www.instagram.com/votre-compte/' },
                    { label: 'LinkedIn',  value: socialLinkedin,  setter: setSocialLinkedin,  placeholder: 'https://www.linkedin.com/in/votre-profil/' },
                    { label: 'YouTube',   value: socialYoutube,   setter: setSocialYoutube,   placeholder: 'https://www.youtube.com/@votre-chaine' },
                    { label: 'Spotify',   value: socialSpotify,   setter: setSocialSpotify,   placeholder: 'https://open.spotify.com/show/...' },
                  ].map(({ label, value, setter, placeholder }) => (
                    <div key={label} className="space-y-1.5">
                      <label htmlFor={`settings-social-${label.toLowerCase()}`} className="block text-xs uppercase tracking-widest text-stone-500 font-bold">{label}</label>
                      <input
                        id={`settings-social-${label.toLowerCase()}`}
                        type="url"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                      />
                    </div>
                  ))}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={socialLoading}
                      className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                    >
                      <Save size={16} />
                      {socialLoading ? 'Sauvegarde…' : 'Sauvegarder les réseaux'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Auteur (bio + lien) */}
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
                <Share2 size={16} /> Auteur — Bio & lien (affiché en bas des articles)
              </h2>
              <form onSubmit={handleSaveAuthor} className="space-y-5">
                {authorMessage && (
                  <div className={`p-4 text-sm ${authorMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {authorMessage.text}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="settings-author-bio" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Description / Bio</label>
                  <textarea
                    id="settings-author-bio"
                    rows={4}
                    value={authorBio}
                    onChange={(e) => setAuthorBio(e.target.value)}
                    placeholder="Courte présentation de l'auteur affichée sous chaque article…"
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="settings-author-link" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Lien « En savoir plus »</label>
                  <input
                    id="settings-author-link"
                    type="text"
                    value={authorLink}
                    onChange={(e) => setAuthorLink(e.target.value)}
                    placeholder="/about"
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm"
                  />
                  <p className="text-[11px] text-stone-400">URL relative (ex : /about) ou absolue.</p>
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authorLoading}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {authorLoading ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Onglet Design & Style ──────────────────────────────── */}
        {activeTab === 'style' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadein">
            {/* Form Panel */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-4 flex items-center gap-2">
                  <Palette size={16} /> Personnalisation du Design
                </h2>
                
                {styleFetching ? (
                  <p className="text-stone-400 italic text-sm">Chargement des styles...</p>
                ) : (
                  <form onSubmit={handleSaveStyles} className="space-y-8">
                    {styleMessage && (
                      <div className={`p-4 text-sm ${styleMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {styleMessage.text}
                      </div>
                    )}

                    {/* Section 1: Typographie */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-widest text-stone-500 font-bold border-b border-stone-50 pb-1 flex items-center gap-2">
                        <Type size={14} /> 1. Typographie
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Heading Font */}
                        <div className="space-y-1.5">
                          <label className="block text-xs text-stone-600 font-medium">Police des Titres (H1...H6)</label>
                          <select
                            value={headingFont}
                            onChange={(e) => setHeadingFont(e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-stone-50 outline-none focus:border-sage"
                          >
                            {GOOGLE_FONTS_SERIF.map(font => (
                              <option key={font} value={font}>{font}</option>
                            ))}
                            <option value="custom">Autre police (Google Fonts)...</option>
                          </select>
                          {headingFont === 'custom' && (
                            <input
                              type="text"
                              value={customHeadingFont}
                              onChange={(e) => setCustomHeadingFont(e.target.value)}
                              placeholder="Nom exact Google Font (ex: Lora)"
                              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded text-sm outline-none focus:border-sage"
                            />
                          )}
                        </div>

                        {/* Body Font */}
                        <div className="space-y-1.5">
                          <label className="block text-xs text-stone-600 font-medium">Police du Texte (Paragraphes)</label>
                          <select
                            value={bodyFont}
                            onChange={(e) => setBodyFont(e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded text-sm bg-stone-50 outline-none focus:border-sage"
                          >
                            {GOOGLE_FONTS_SANS.map(font => (
                              <option key={font} value={font}>{font}</option>
                            ))}
                            <option value="custom">Autre police (Google Fonts)...</option>
                          </select>
                          {bodyFont === 'custom' && (
                            <input
                              type="text"
                              value={customBodyFont}
                              onChange={(e) => setCustomBodyFont(e.target.value)}
                              placeholder="Nom exact Google Font (ex: Lato)"
                              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded text-sm outline-none focus:border-sage"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Couleur Principale */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-widest text-stone-500 font-bold border-b border-stone-50 pb-1 flex items-center gap-2">
                        <Palette size={14} /> 2. Couleur principale du site
                      </h3>
                      <div className="space-y-3">
                        <label className="block text-xs text-stone-600 font-medium">Actuellement le vert sauge. Modifie également les éléments utilisant la couleur principale.</label>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-full border border-stone-200 overflow-hidden shrink-0 shadow-inner">
                              <input 
                                type="color" 
                                value={primaryColor} 
                                onChange={(e) => {
                                  setPrimaryColor(e.target.value);
                                  if (btnDarkBg === primaryColor) setBtnDarkBg(e.target.value);
                                }} 
                                className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none p-0"
                              />
                            </div>
                            <input 
                              type="text" 
                              value={primaryColor} 
                              onChange={(e) => setPrimaryColor(e.target.value)} 
                              className="w-24 px-3 py-1.5 border border-stone-200 text-xs font-mono rounded"
                            />
                          </div>
                          {/* Presets */}
                          {renderPresets((val) => {
                            setPrimaryColor(val);
                            setBtnDarkBg(val);
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Boutons */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-widest text-stone-500 font-bold border-b border-stone-50 pb-1 flex items-center gap-2">
                        <Sliders size={14} /> 3. Boutons
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Dark Button */}
                        <div className="space-y-3 p-4 bg-stone-50/50 border border-stone-100 rounded-xl">
                          <h4 className="text-xs uppercase tracking-wider text-stone-700 font-bold">Bouton Foncé / Primaire</h4>
                          
                          {/* BG */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Arrière-plan</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnDarkBg} 
                                  onChange={(e) => setBtnDarkBg(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnDarkBg} 
                                  onChange={(e) => setBtnDarkBg(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnDarkBg)}
                          </div>

                          {/* Text */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Couleur texte</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnDarkText} 
                                  onChange={(e) => setBtnDarkText(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnDarkText} 
                                  onChange={(e) => setBtnDarkText(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnDarkText)}
                          </div>

                          {/* Hover BG */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Survol (Hover BG)</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnDarkHoverBg} 
                                  onChange={(e) => setBtnDarkHoverBg(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnDarkHoverBg} 
                                  onChange={(e) => setBtnDarkHoverBg(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnDarkHoverBg)}
                          </div>
                        </div>

                        {/* Light Button */}
                        <div className="space-y-3 p-4 bg-stone-50/50 border border-stone-100 rounded-xl">
                          <h4 className="text-xs uppercase tracking-wider text-stone-700 font-bold">Bouton Clair / Secondaire</h4>
                          
                          {/* BG */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Arrière-plan</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightBg} 
                                  onChange={(e) => setBtnLightBg(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightBg} 
                                  onChange={(e) => setBtnLightBg(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightBg)}
                          </div>

                          {/* Text */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Couleur texte</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightText} 
                                  onChange={(e) => setBtnLightText(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightText} 
                                  onChange={(e) => setBtnLightText(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightText)}
                          </div>

                          {/* Border */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Couleur bordure</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightBorder} 
                                  onChange={(e) => setBtnLightBorder(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightBorder} 
                                  onChange={(e) => setBtnLightBorder(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightBorder)}
                          </div>

                          {/* Hover BG */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Survol (Hover BG)</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightHoverBg} 
                                  onChange={(e) => setBtnLightHoverBg(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightHoverBg} 
                                  onChange={(e) => setBtnLightHoverBg(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightHoverBg)}
                          </div>

                          {/* Hover Text */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Survol Texte</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightHoverText} 
                                  onChange={(e) => setBtnLightHoverText(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightHoverText} 
                                  onChange={(e) => setBtnLightHoverText(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightHoverText)}
                          </div>

                          {/* Hover Border */}
                          <div className="space-y-1 border-t border-stone-100 pt-2">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs text-stone-500">Survol Bordure</span>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={btnLightHoverBorder} 
                                  onChange={(e) => setBtnLightHoverBorder(e.target.value)} 
                                  className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                                />
                                <input 
                                  type="text" 
                                  value={btnLightHoverBorder} 
                                  onChange={(e) => setBtnLightHoverBorder(e.target.value)} 
                                  className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                                />
                              </div>
                            </div>
                            {renderPresets(setBtnLightHoverBorder)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Couleurs du Texte */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-widest text-stone-500 font-bold border-b border-stone-50 pb-1 flex items-center gap-2">
                        <Palette size={14} /> 4. Couleurs du Texte
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Heading H2 Color */}
                        <div className="space-y-3 p-4 bg-stone-50/50 border border-stone-100 rounded-xl">
                          <h4 className="text-xs uppercase tracking-wider text-stone-700 font-bold">Titres H2</h4>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-stone-500">Couleur</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="color" 
                                value={textH2Color} 
                                onChange={(e) => setTextH2Color(e.target.value)} 
                                className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                              />
                              <input 
                                type="text" 
                                value={textH2Color} 
                                onChange={(e) => setTextH2Color(e.target.value)} 
                                className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                              />
                            </div>
                          </div>
                          {renderPresets(setTextH2Color)}
                        </div>

                        {/* Paragraph Body Color */}
                        <div className="space-y-3 p-4 bg-stone-50/50 border border-stone-100 rounded-xl">
                          <h4 className="text-xs uppercase tracking-wider text-stone-700 font-bold">Texte de paragraphe</h4>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-stone-500">Couleur</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="color" 
                                value={textBodyColor} 
                                onChange={(e) => setTextBodyColor(e.target.value)} 
                                className="w-7 h-7 rounded border-0 cursor-pointer p-0"
                              />
                              <input 
                                type="text" 
                                value={textBodyColor} 
                                onChange={(e) => setTextBodyColor(e.target.value)} 
                                className="w-20 px-2 py-1 border border-stone-200 text-[10px] font-mono rounded"
                              />
                            </div>
                          </div>
                          {renderPresets(setTextBodyColor)}
                        </div>
                      </div>
                    </div>

                    {/* Section 5: Border Radius */}
                    <div className="space-y-4">
                      <h3 className="text-xs uppercase tracking-widest text-stone-500 font-bold border-b border-stone-50 pb-1 flex items-center gap-2">
                        <Sliders size={14} /> 5. Arrondi des angles (Border Radius)
                      </h3>
                      
                      <div className="space-y-4 p-4 bg-stone-50/50 border border-stone-100 rounded-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <span className="text-xs text-stone-600">Base de l'arrondi : <strong>{borderRadiusBase}</strong></span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { name: 'Sharp', val: '0px' },
                              { name: 'Subtle', val: '4px' },
                              { name: 'Standard', val: '8px' },
                              { name: 'Rounded', val: '12px' },
                              { name: 'Extra', val: '16px' }
                            ].map(p => (
                              <button
                                type="button"
                                key={p.val}
                                onClick={() => setBorderRadiusBase(p.val)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${borderRadiusBase === p.val ? 'bg-sage border-sage text-white' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'}`}
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="24"
                            step="1"
                            value={parseInt(borderRadiusBase) || 0}
                            onChange={(e) => setBorderRadiusBase(e.target.value + 'px')}
                            className="flex-1 accent-sage cursor-pointer"
                          />
                          <span className="text-xs font-mono bg-white border border-stone-200 px-2.5 py-1 rounded">
                            {borderRadiusBase}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-4 border-t border-stone-100">
                      <button
                        type="submit"
                        disabled={styleLoading}
                        className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3.5 uppercase tracking-widest text-xs font-bold hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                      >
                        <Save size={16} />
                        {styleLoading ? 'Sauvegarde...' : 'Sauvegarder les styles globaux'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Live Preview Panel */}
            <div className="lg:col-span-5 lg:sticky lg:top-8 space-y-6">
              <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 flex items-center gap-2">
                  <Eye size={16} /> Aperçu en temps réel
                </h2>
                
                <div 
                  style={{
                    '--preview-color-sage': primaryColor,
                    '--preview-font-headings': `'${activeHeadingFont}', serif`,
                    '--preview-font-body': `'${activeBodyFont}', sans-serif`,
                    '--preview-radius-base': borderRadiusBase,
                  } as React.CSSProperties}
                  className="space-y-6"
                >
                  {/* Card Preview */}
                  <div 
                    style={{ 
                      borderRadius: `calc(${borderRadiusBase} * 1.5)`,
                      borderColor: 'rgba(231, 229, 228, 0.7)'
                    }} 
                    className="p-6 bg-stone-50 border border-stone-200/70 shadow-sm transition-all"
                  >
                    <span 
                      style={{ fontFamily: 'var(--preview-font-body)', color: 'var(--preview-color-sage)' }} 
                      className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2 block"
                    >
                      Exemple de tag
                    </span>
                    
                    <h3 
                      style={{ fontFamily: 'var(--preview-font-headings)' }} 
                      className="text-2xl font-bold text-stone-900 mb-3 leading-snug"
                    >
                      Titre principal d'exemple
                    </h3>
                    
                    <p 
                      style={{ fontFamily: 'var(--preview-font-body)' }} 
                      className="text-sm text-stone-600 leading-relaxed mb-6 font-light"
                    >
                      Voici un paragraphe de démonstration. Il utilise la police du texte de corps pour afficher un contenu de lecture fluide et agréable.
                    </p>

                    {/* Buttons Preview */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onMouseEnter={() => setDarkBtnHover(true)}
                        onMouseLeave={() => setDarkBtnHover(false)}
                        style={{
                          backgroundColor: darkBtnHover ? btnDarkHoverBg : btnDarkBg,
                          color: btnDarkText,
                          borderRadius: borderRadiusBase,
                          fontFamily: 'var(--preview-font-body)',
                        }}
                        className="px-6 py-3 text-xs uppercase tracking-widest font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Bouton Foncé
                      </button>

                      <button
                        type="button"
                        onMouseEnter={() => setLightBtnHover(true)}
                        onMouseLeave={() => setLightBtnHover(false)}
                        style={{
                          backgroundColor: lightBtnHover ? btnLightHoverBg : btnLightBg,
                          color: lightBtnHover ? btnLightHoverText : btnLightText,
                          borderColor: lightBtnHover ? btnLightHoverBorder : btnLightBorder,
                          borderWidth: '1px',
                          borderRadius: borderRadiusBase,
                          fontFamily: 'var(--preview-font-body)',
                        }}
                        className="px-6 py-3 text-xs uppercase tracking-widest font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Bouton Clair
                      </button>
                    </div>
                  </div>

                  {/* Div Content Alert Preview */}
                  <div 
                    style={{ 
                      borderRadius: borderRadiusBase,
                      borderLeftWidth: '4px',
                      borderLeftColor: 'var(--preview-color-sage)',
                      backgroundColor: `${primaryColor}0c`
                    }} 
                    className="p-5 border border-stone-200/40 text-stone-700 italic text-sm font-light leading-relaxed"
                  >
                    <span style={{ fontFamily: 'var(--preview-font-headings)' }} className="font-bold block text-stone-900 not-italic mb-1">Citation ou Témoignage</span>
                    « Un vrai moment pour soi, dans un cadre chaleureux. On ressort le teint reposé et la tête légère. »
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Onglet Entreprise ────────────────────────────────────── */}
        {activeTab === 'business' && (
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 animate-fadein">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
              <Building2 size={16} /> Coordonnées d'entreprise
            </h2>

            {bizFetching ? (
              <p className="text-stone-400 text-sm italic">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveBusiness} className="space-y-6">
                {bizMessage && (
                  <div className={`p-4 text-sm ${bizMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {bizMessage.text}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="biz-name" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Nom de l'entreprise / du site</label>
                    <input id="biz-name" value={bizName} onChange={(e) => setBizName(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-owner" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Nom du propriétaire / praticien</label>
                    <input id="biz-owner" value={bizOwner} onChange={(e) => setBizOwner(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-email" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">E-mail de contact</label>
                    <input id="biz-email" type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-phone" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Téléphone</label>
                    <input id="biz-phone" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="biz-street" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Rue et numéro</label>
                    <input id="biz-street" value={bizAddressStreet} onChange={(e) => setBizAddressStreet(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-postal" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Code postal</label>
                    <input id="biz-postal" value={bizAddressPostal} onChange={(e) => setBizAddressPostal(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-city" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Ville</label>
                    <input id="biz-city" value={bizAddressCity} onChange={(e) => setBizAddressCity(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-region" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Région / Canton</label>
                    <input id="biz-region" value={bizAddressRegion} onChange={(e) => setBizAddressRegion(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-country" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Pays (code ISO, ex : CH)</label>
                    <input id="biz-country" value={bizAddressCountry} onChange={(e) => setBizAddressCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="biz-price-range" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">Gamme de prix (SEO, ex : CHF 450–CHF 1295)</label>
                    <input id="biz-price-range" value={bizPriceRange} onChange={(e) => setBizPriceRange(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white" />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={bizLoading}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {bizLoading ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Onglet Éditorial & Marque ───────────────────────────── */}
        {activeTab === 'editorial' && (
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 animate-fadein space-y-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-2 flex items-center gap-2">
                <BookOpen size={16} /> Ligne Éditoriale, Ton &amp; Branding
              </h2>
              <p className="text-stone-500 text-sm">
                Décrivez l'activité, le positionnement, le persona cible, le ton de voix et les piliers thématiques. Ces informations sont pré-remplies avec vos paramètres actuels et seront réutilisées par l'intelligence artificielle pour suggérer des sujets de blog, rédiger des articles et concevoir des contenus alignés avec votre marque.
              </p>
            </div>

            {editorialFetching ? (
              <p className="text-stone-400 text-sm italic">Chargement des paramètres éditoriaux…</p>
            ) : (
              <form onSubmit={handleSaveEditorial} className="space-y-6">
                {editorialMessage && (
                  <div className={`p-4 text-sm ${editorialMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {editorialMessage.text}
                  </div>
                )}

                {/* Champ 1 : Activité et Contexte */}
                <div className="space-y-2">
                  <label htmlFor="editorial-activity" className="block text-xs uppercase tracking-widest text-stone-700 font-bold flex items-center justify-between">
                    <span>1. Activité &amp; Contexte général du site</span>
                    <span className="text-[10px] text-stone-400 font-normal">Description du métier, de la spécialisation et de l'offre</span>
                  </label>
                  <textarea
                    id="editorial-activity"
                    rows={4}
                    value={siteActivityContext}
                    onChange={(e) => setSiteActivityContext(e.target.value)}
                    placeholder="Présentation globale du site et de son secteur..."
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 2 : Public Cible et Persona */}
                <div className="space-y-2">
                  <label htmlFor="editorial-target" className="block text-xs uppercase tracking-widest text-stone-700 font-bold flex items-center justify-between">
                    <span>2. Public Cible &amp; Persona</span>
                    <span className="text-[10px] text-stone-400 font-normal">Profil des lecteurs/clients, douleurs et attentes</span>
                  </label>
                  <textarea
                    id="editorial-target"
                    rows={4}
                    value={siteTargetPersona}
                    onChange={(e) => setSiteTargetPersona(e.target.value)}
                    placeholder="Profil démographique, psychologique et problématiques du public visé..."
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 3 : Ton de voix */}
                <div className="space-y-2">
                  <label htmlFor="editorial-tone" className="block text-xs uppercase tracking-widest text-stone-700 font-bold flex items-center justify-between">
                    <span>3. Ton de voix &amp; Style d'écriture</span>
                    <span className="text-[10px] text-stone-400 font-normal">Registre de langue, tutoiement/vouvoiement, posture</span>
                  </label>
                  <textarea
                    id="editorial-tone"
                    rows={4}
                    value={siteToneOfVoice}
                    onChange={(e) => setSiteToneOfVoice(e.target.value)}
                    placeholder="Direct, conversationnel, tutoiement, parole de cabinet..."
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 4 : Ton de marque & Vocabulaire */}
                <div className="space-y-2">
                  <label htmlFor="editorial-brand" className="block text-xs uppercase tracking-widest text-stone-700 font-bold flex items-center justify-between">
                    <span>4. Ton de marque, Promesse &amp; Vocabulaire</span>
                    <span className="text-[10px] text-stone-400 font-normal">Mots clés de marque, termes privilégiés et mots interdits</span>
                  </label>
                  <textarea
                    id="editorial-brand"
                    rows={4}
                    value={siteBrandTone}
                    onChange={(e) => setSiteBrandTone(e.target.value)}
                    placeholder="Promesse phare, expressions fortes de la marque, mots interdits..."
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                {/* Champ 5 : Piliers & Thématiques du Blog */}
                <div className="space-y-2">
                  <label htmlFor="editorial-topics" className="block text-xs uppercase tracking-widest text-stone-700 font-bold flex items-center justify-between">
                    <span>5. Piliers &amp; Thématiques majeures du Blog</span>
                    <span className="text-[10px] text-stone-400 font-normal">Grandes thématiques pour les idées et articles de blog</span>
                  </label>
                  <textarea
                    id="editorial-topics"
                    rows={5}
                    value={siteBlogTopics}
                    onChange={(e) => setSiteBlogTopics(e.target.value)}
                    placeholder="1. Thématique A...\n2. Thématique B..."
                    className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white text-sm resize-y font-sans leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={editorialLoading}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
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
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 animate-fadein">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-2 flex items-center gap-2">
              <Puzzle size={16} /> Modules du site
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              Active ou désactive les fonctionnalités du site. Un module désactivé disparaît du site public
              (pages, menu, plan du site) mais reste modifiable dans l'admin.
            </p>

            {modulesFetching ? (
              <p className="text-stone-400 text-sm italic">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveModules} className="space-y-6">
                {modulesMessage && (
                  <div className={`p-4 text-sm ${modulesMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {modulesMessage.text}
                  </div>
                )}

                {[
                  { label: 'Blog / Articles', desc: 'Pages /blog, admin Articles et publication programmée.', value: moduleBlogEnabled, setter: setModuleBlogEnabled },
                  { label: "Génération IA d'article", desc: "Bouton de rédaction assistée par IA dans l'éditeur d'articles.", value: moduleAiEnabled, setter: setModuleAiEnabled },
                  { label: 'Événements / Ateliers', desc: 'Pages /ateliers, admin Événements et inscriptions/paiement.', value: moduleEventsEnabled, setter: setModuleEventsEnabled },
                  { label: 'Newsletter', desc: "Admin Newsletter (envoi d'e-mails), formulaires d'inscription et bannière sur le site.", value: moduleNewsletterEnabled, setter: setModuleNewsletterEnabled },
                  { label: 'Réseaux Sociaux', desc: "Génération de contenu Instagram/LinkedIn/Facebook (articles, flux RSS, suggestions), calendrier et automatisation.", value: moduleSocialEnabled, setter: setModuleSocialEnabled },
                ].map((mod) => (
                  <div key={mod.label} className="flex items-start gap-4 py-3 border-b border-stone-50 last:border-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mod.value}
                      aria-label={`${mod.value ? 'Désactiver' : 'Activer'} le module ${mod.label}`}
                      onClick={() => mod.setter(!mod.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors mt-0.5 cursor-pointer ${mod.value ? 'bg-sage' : 'bg-stone-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mod.value ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span>
                      <span className="block text-sm font-medium text-stone-800">{mod.label}</span>
                      <span className="block text-xs text-stone-400">{mod.desc}</span>
                    </span>
                  </div>
                ))}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={modulesLoading}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {modulesLoading ? 'Enregistrement…' : 'Enregistrer les modules'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Onglet IA & Budget ──────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 animate-fadein">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-2 flex items-center gap-2">
              <Sparkles size={16} /> Modèle IA &amp; budget
            </h2>
            <p className="text-stone-500 text-sm mb-6">
              Choisis le modèle Claude utilisé par toutes les générations (articles, pages, SEO, réseaux sociaux)
              et surveille la dépense du mois. Les tarifs sont ceux d'Anthropic, en dollars par million de tokens.
            </p>

            {aiFetching ? (
              <p className="text-stone-400 text-sm italic">Chargement…</p>
            ) : (
              <form onSubmit={handleSaveAi} className="space-y-8">
                {aiMessage && (
                  <div className={`p-4 text-sm ${aiMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {aiMessage.text}
                  </div>
                )}

                {/* ── Choix du modèle ────────────────────────────────── */}
                <fieldset className="space-y-3">
                  <legend className="text-xs uppercase tracking-widest text-stone-500 font-bold mb-2">Modèle</legend>
                  {aiCatalog.map((m) => {
                    const selected = aiModel === m.id;
                    // Coût indicatif d'un article généré (~2 000 tokens en entrée, ~16 000 en sortie).
                    const perArticle = m.inputPricePerMTok * 0.002 + m.outputPricePerMTok * 0.016;
                    return (
                      <label
                        key={m.id}
                        className={`flex gap-3 items-start p-4 border rounded-xl cursor-pointer transition-colors ${selected ? 'border-sage bg-sage/5' : 'border-stone-200 hover:border-stone-300'} ${m.available === false ? 'opacity-60' : ''}`}
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
                            {m.badge === 'qualite'    && <span className="text-[10px] uppercase tracking-wider bg-stone-900 text-white px-2 py-0.5 rounded-full">Qualité max</span>}
                            {m.badge === 'equilibre'  && <span className="text-[10px] uppercase tracking-wider bg-sage text-white px-2 py-0.5 rounded-full">Meilleur rapport</span>}
                            {m.badge === 'economique' && <span className="text-[10px] uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">Le moins cher</span>}
                            {m.available === false && (
                              <span className="text-[10px] uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                Plus servi par Anthropic
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-stone-500 mt-1">{m.description}</span>
                          <span className="block text-xs text-stone-400 mt-1 font-mono">
                            ${m.inputPricePerMTok} / M tokens entrée · ${m.outputPricePerMTok} / M sortie
                            {' — '}≈ ${perArticle.toFixed(2)} par article généré
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  <p className="text-xs text-stone-400">
                    Les balises méta restent générées avec Haiku 4.5 quel que soit ce choix : la tâche est trop
                    courte pour justifier un modèle coûteux.
                  </p>
                </fieldset>

                {/* ── Niveau de réflexion ────────────────────────────── */}
                <fieldset className="space-y-2">
                  <legend className="text-xs uppercase tracking-widest text-stone-500 font-bold mb-2">
                    Niveau de réflexion
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {AI_EFFORT_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setAiEffort(level.value)}
                        title={level.hint}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-colors cursor-pointer ${aiEffort === level.value ? 'bg-sage text-white border-sage' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-stone-400">
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
                  <legend className="text-xs uppercase tracking-widest text-stone-500 font-bold mb-2">
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
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage"
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
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-stone-400">
                    Anthropic ne publie pas le solde du compte via son API : la dépense est reconstituée à partir des
                    tokens facturés à chaque génération, puis comparée à ce budget. Une bannière apparaît en haut de
                    l'admin dès le seuil atteint. Le rechargement des crédits reste à faire sur console.anthropic.com.
                  </p>
                </fieldset>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                  >
                    <Save size={16} />
                    {aiLoading ? 'Enregistrement…' : 'Enregistrer les réglages IA'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Consommation du mois ─────────────────────────────── */}
            {aiUsage && (
              <div className="mt-10 border-t border-stone-100 pt-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                    Consommation depuis le 1er du mois
                  </h3>
                  <button
                    type="button"
                    onClick={loadAiUsage}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-stone-400 hover:text-sage transition-colors cursor-pointer"
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
                        <span className="text-sm text-stone-400">
                          sur ${Number(aiUsage.config.budgetUsd).toFixed(2)} — reste ${Number(aiUsage.remainingUsd ?? 0).toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-stone-400">({aiUsage.usage.calls} appels)</span>
                    </div>

                    {aiUsage.config.budgetUsd > 0 && (
                      <div className="h-2 bg-stone-100 rounded-full mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${aiUsage.level === 'exceeded' ? 'bg-red-500' : aiUsage.level === 'warning' ? 'bg-amber-500' : 'bg-sage'}`}
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
                          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-2">{block.title}</p>
                          {block.rows.length === 0 ? (
                            <p className="text-xs text-stone-400 italic">Aucune génération ce mois-ci.</p>
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

                    <p className="text-[11px] text-stone-400 mt-4">
                      Estimation calculée sur les tarifs publics d'Anthropic ; la facture réelle peut différer
                      légèrement (remises, tarifs de lancement).
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Onglet Sécurité (Mot de passe) ──────────────────────── */}
        {activeTab === 'security' && (
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-6 md:p-8 animate-fadein">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sage border-b border-stone-100 pb-2 mb-6 flex items-center gap-2">
              <Lock size={16} /> Sécurité
            </h2>

            <form onSubmit={handleUpdatePassword} className="space-y-6">
              {pwdMessage && (
                <div className={`p-4 text-sm ${pwdMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {pwdMessage.text}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
                  Nouveau mot de passe
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-xs uppercase tracking-widest text-stone-500 font-bold">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 focus:border-sage focus:ring-1 focus:ring-sage outline-none transition-all bg-stone-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={pwdLoading || !password}
                  className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-sage transition-colors disabled:opacity-50 w-full sm:w-auto cursor-pointer"
                >
                  <Save size={16} />
                  {pwdLoading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
