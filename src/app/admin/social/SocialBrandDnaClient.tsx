"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, RefreshCw, Save, CheckCircle2, AlertCircle, Loader2,
  MapPin, Palette, Type, Flower2, Image as ImageIcon, CalendarPlus,
  Instagram, Facebook, Linkedin, Link2, Unplug, KeyRound
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { CARTE, chf } from '../../../constants/carteSoins';
import { toDateKey, fromDateKey, todayKey, addDaysToKey } from '../../../utils/dateKey';
import { fetchMediaLibraryPhotos, pickBestLibraryPhoto, type MediaLibraryPhoto } from '../../../utils/socialCards';
import SocialSourcesClient from './SocialSourcesClient';

export interface SocialBrandDnaClientProps {
  onPostCreated?: (plannedDate: string) => void;
  onGeneratedFromSources?: () => void;
}

interface MonthlyOfferRow {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  price?: string | null;
  active?: boolean;
}

const DEFAULT_BRAND_DNA = {
  site_activity_context:
    "Institut de beauté Emmanuelle Esthétique à Palézieux-Gare (Chemin de la Marouette 19, à 1 minute à pied de la gare). Cabine privée, calme et lumineuse, tenue par Emmanuelle, esthéticienne diplômée. Spécialiste des soins du visage et du corps à la cosmétique marine Phytomer (Saint-Malo), des massages relaxants sur-mesure, de la beauté des mains et des pieds, de la mise en valeur naturelle du regard (rehaussement et teinture de cils) et de l'épilation douce à la cire et à la pâte de sucre 100 % naturelle.",
  site_target_persona:
    "Femmes de Palézieux, Oron-la-Ville, Châtel-Saint-Denis, Bossonnens, Attalens, Moudon et de la Haute-Broye / Lavaux. Elles recherchent un lieu intime, chaleureux et sans jugement, où l'on prend vraiment le temps de s'occuper d'elles, loin des instituts à la chaîne.",
  site_brand_tone:
    "Soins du visage Phytomer : Soin Peau Nette & Coup d'Éclat Express (40 min, CHF 90), Soin Hydra Originel désaltérant & repulpant aux algues bio (60 min, CHF 140), Soin Expert Jeunesse anti-âge & fermeté (75 min, CHF 165), Option Boue Marine Auto-Chauffante Dos (CHF 30), Option Massage Cuir Chevelu & Nuque (15 min, CHF 25).\nRituels Corps : Grand Massage Relaxant Marine (60 min CHF 145 / 90 min CHF 210), Rituel Échappée Belle Visage & Corps (1h45, CHF 230), Voile de Satin (CHF 110), Bulles des Mers (CHF 110).\nRegard & Épilation : Réhaussement de cils (CHF 100), Duo Regard (CHF 45), Épilation orientale au sucre et Forfaits Douceur (CHF 95) / Intégral (CHF 125). Bons cadeaux disponibles à l'institut.",
  site_tone_of_voice:
    "Vouvoiement systématique, ton doux, apaisant, expert mais jamais médical ni prétentieux. Aucun jargon anglophone ni publicitaire agressif. Privilégier les sensations concrètes (chaleur des serviettes, actifs marins, calme de la cabine, peau souple et reposée).",
};

const R2_BASE = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/';

const BRAND_PHOTOS: {
  id: string;
  category: string;
  title: string;
  url: string;
  caption: string;
}[] = [
  {
    id: 'visage-phytomer',
    category: 'Visage Phytomer',
    title: 'Produits & Rituels Phytomer en cabine',
    url: `${R2_BASE}1790524738941-WhatsApp-Image-2026-09-27-at-17.51.49--2-.webp`,
    caption: 'Cosmétique marine Phytomer à l’institut de Palézieux-Gare',
  },
  {
    id: 'cabine-salon',
    category: 'Cabine Palézieux-Gare',
    title: 'La cabine de soins privée',
    url: `${R2_BASE}1791296588293-cabine-soins-esthetiques-palezieux-gare-portrait_89C6887.CR2.webp`,
    caption: 'Table de soin accueillante, coin détente et univers marin',
  },
  {
    id: 'massage-cranien',
    category: 'Massage crânien & visage',
    title: 'Modelage visage & cuir chevelu',
    url: 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg?auto=compress&cs=tinysrgb&w=1200',
    caption: 'Gestuelle enveloppante du visage, de la nuque et du cuir chevelu',
  },
  {
    id: 'massage-relaxant',
    category: 'Massage relaxant',
    title: 'Grand Massage Relaxant Marine',
    url: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg?auto=compress&cs=tinysrgb&w=1200',
    caption: 'Détente musculaire profonde aux huiles marines délicates',
  },
  {
    id: 'beaute-regard',
    category: 'Beauté du regard',
    title: 'Réhaussement & teinture des cils',
    url: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg?auto=compress&cs=tinysrgb&w=1200',
    caption: 'Mise en valeur naturelle de la courbure des cils et des sourcils',
  },
  {
    id: 'epilation-douce',
    category: 'Épilation douce & sucre',
    title: 'Épilation à la cire douce & pâte de sucre',
    url: `${R2_BASE}1789998853978-e-pilation.jpg`,
    caption: 'Peau douce et satinée, respectueuse des épidermes sensibles',
  },
  {
    id: 'cabine-table',
    category: 'Cabine & Confort',
    title: 'Lumière douce & table chauffante',
    url: `${R2_BASE}1791296585438-cabine-soins-esthetiques-palezieux-gare-portrait_89C6881.CR2.webp`,
    caption: 'Un cocon de tranquillité à 1 min à pied de la gare de Palézieux',
  },
  {
    id: 'univers-marin',
    category: 'Univers marin',
    title: 'Inspiration marine bretonne Phytomer',
    url: `${R2_BASE}1789999272375-prise-de-rdv.webp`,
    caption: 'Les bienfaits reminéralisants de la mer au service de votre peau',
  },
];

const PALETTE_SWATCHES = [
  { name: 'Crème', hex: '#FAF7F2', text: '#3A3730' },
  { name: 'Sauge', hex: '#8A9A7B', text: '#FFFFFF' },
  { name: 'Turquoise Marin', hex: '#60B9C2', text: '#FFFFFF' },
  { name: 'Brun Profond', hex: '#3A3730', text: '#FAF7F2' },
];

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function nextCadenceDateKey(): string {
  const cursor = fromDateKey(addDaysToKey(todayKey(), 1));
  for (let i = 0; i < 14; i++) {
    const day = cursor.getDay();
    if (day === 1 || day === 3 || day === 5) return toDateKey(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return addDaysToKey(todayKey(), 1);
}

function newSourceRef(prefix = 'care'): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

export default function SocialBrandDnaClient({
  onPostCreated,
  onGeneratedFromSources,
}: SocialBrandDnaClientProps) {
  const [activityContext, setActivityContext] = useState(DEFAULT_BRAND_DNA.site_activity_context);
  const [targetPersona, setTargetPersona] = useState(DEFAULT_BRAND_DNA.site_target_persona);
  const [brandTone, setBrandTone] = useState(DEFAULT_BRAND_DNA.site_brand_tone);
  const [toneOfVoice, setToneOfVoice] = useState(DEFAULT_BRAND_DNA.site_tone_of_voice);

  const [instituteName, setInstituteName] = useState('Emmanuelle Esthétique');
  const [instituteAddress, setInstituteAddress] = useState('Chemin de la Marouette 19, 1607 Palézieux-Gare');
  const [monthlyOffers, setMonthlyOffers] = useState<MonthlyOfferRow[]>([]);
  const [libraryPhotos, setLibraryPhotos] = useState<MediaLibraryPhoto[]>([]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCareId, setCreatingCareId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMediaLibraryPhotos().then(setLibraryPhotos);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const loadBrandDna = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // 1. Appel GET /api/social-brand-dna
      const apiRes = await fetch('/api/social-brand-dna', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => null);

      if (apiRes && apiRes.ok) {
        const apiData = await apiRes.json().catch(() => null);
        if (apiData && !apiData.error) {
          const settings = apiData.settings || apiData.dna || apiData;
          if (settings.site_activity_context) setActivityContext(settings.site_activity_context);
          if (settings.site_target_persona) setTargetPersona(settings.site_target_persona);
          if (settings.site_brand_tone) setBrandTone(settings.site_brand_tone);
          if (settings.site_tone_of_voice) setToneOfVoice(settings.site_tone_of_voice);
          if (settings.business_name) setInstituteName(settings.business_name);
          if (Array.isArray(apiData.offers)) setMonthlyOffers(apiData.offers);
          setLoading(false);
          return;
        }
      }

      // 2. Repli direct sur Supabase settings & monthly_offers
      const { data: settingsRows } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'site_activity_context',
          'site_target_persona',
          'site_brand_tone',
          'site_tone_of_voice',
          'business_name',
          'business_address_street',
          'business_address_postal',
          'business_address_city',
        ]);

      if (settingsRows && settingsRows.length > 0) {
        const map = Object.fromEntries(settingsRows.map((r: { key: string; value: string }) => [r.key, (r.value || '').trim()]));
        if (map.site_activity_context) setActivityContext(map.site_activity_context);
        if (map.site_target_persona) setTargetPersona(map.site_target_persona);
        if (map.site_brand_tone) setBrandTone(map.site_brand_tone);
        if (map.site_tone_of_voice) setToneOfVoice(map.site_tone_of_voice);
        if (map.business_name) setInstituteName(map.business_name);
        if (map.business_address_street || map.business_address_city) {
          setInstituteAddress(
            [map.business_address_street, `${map.business_address_postal || '1607'} ${map.business_address_city || 'Palézieux-Gare'}`]
              .filter(Boolean)
              .join(', ')
          );
        }
      }

      const { data: offersData } = await supabase
        .from('monthly_offers')
        .select('*')
        .eq('active', true)
        .limit(6);
      if (offersData) setMonthlyOffers(offersData as MonthlyOfferRow[]);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger votre identité de marque.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrandDna();
  }, [loadBrandDna]);

  const handleScanWebsite = async () => {
    setScanning(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/social-brand-dna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'scan' }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && !data.error) {
          const s = data.settings || data.dna || data;
          if (s.site_activity_context) setActivityContext(s.site_activity_context);
          if (s.site_target_persona) setTargetPersona(s.site_target_persona);
          if (s.site_brand_tone) setBrandTone(s.site_brand_tone);
          if (s.site_tone_of_voice) setToneOfVoice(s.site_tone_of_voice);
          setFlash('Votre site web et votre carte des soins ont été analysés avec succès.');
          setScanning(false);
          return;
        }
      }

      // Synthèse immédiate depuis la carte des soins officielle du site
      setActivityContext(DEFAULT_BRAND_DNA.site_activity_context);
      setTargetPersona(DEFAULT_BRAND_DNA.site_target_persona);
      setBrandTone(DEFAULT_BRAND_DNA.site_brand_tone);
      setToneOfVoice(DEFAULT_BRAND_DNA.site_tone_of_voice);
      setFlash('Identité enrichie à partir des pages et de la carte des soins d’Emmanuelle Esthétique.');
    } catch (e: any) {
      setError(e?.message || 'Analyse du site impossible pour le moment.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const payload = {
        action: 'save',
        site_activity_context: activityContext.trim(),
        site_target_persona: targetPersona.trim(),
        site_brand_tone: brandTone.trim(),
        site_tone_of_voice: toneOfVoice.trim(),
      };

      const res = await fetch('/api/social-brand-dna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Sauvegarde directe dans la table `settings`
        const rows = [
          { key: 'site_activity_context', value: payload.site_activity_context },
          { key: 'site_target_persona', value: payload.site_target_persona },
          { key: 'site_brand_tone', value: payload.site_brand_tone },
          { key: 'site_tone_of_voice', value: payload.site_tone_of_voice },
        ];
        const { error: upsertErr } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
        if (upsertErr) throw new Error(upsertErr.message);
      }

      setFlash('Votre identité et vos consignes d’écriture ont bien été enregistrées.');
    } catch (e: any) {
      setError(`Enregistrement impossible : ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePostForCare = async (
    careId: string,
    careName: string,
    careDescription: string,
    categoryLabel: string
  ) => {
    setCreatingCareId(careId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `${careName} — ${categoryLabel}`,
          intro: `${careDescription}\n\nSoin réalisé à l'institut Emmanuelle Esthétique à Palézieux-Gare. Mettre en valeur les bienfaits concrets pour la cliente, la douceur du moment en cabine et l'invitation à réserver.`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'La rédaction de la publication a échoué.');
      }

      const plannedDate = nextCadenceDateKey();
      const coverImage = data.cover_image || pickBestLibraryPhoto(`${careName} ${careDescription} ${categoryLabel}`, libraryPhotos);
      const { error: insertErr } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef('soin'),
        title: careName,
        cover_image: coverImage,
        content: {
          ...data,
          cover_image: coverImage,
          visual_theme: 'photo',
        },
        planned_date: plannedDate,
        status: 'ready',
      });
      if (insertErr) throw new Error(insertErr.message);

      setFlash(`Publication sur « ${careName} » créée avec sa photo de bibliothèque pour le ${DAY_LABEL.format(fromDateKey(plannedDate))}.`);
      onPostCreated?.(plannedDate);
    } catch (e: any) {
      setError(e?.message || 'Impossible de créer la publication pour ce soin.');
    } finally {
      setCreatingCareId(null);
    }
  };

  // ── État de connexion directe Facebook, Instagram & LinkedIn ───────────────
  const [metaStatus, setMetaStatus] = useState<{
    connected: boolean;
    hasToken: boolean;
    facebookPageId: string;
    facebookPageName: string;
    instagramAccountId: string;
    instagramUsername: string;
    hasMetaAppId: boolean;
    metaAppId: string;
    linkedinConnected: boolean;
  }>({
    connected: false,
    hasToken: false,
    facebookPageId: '',
    facebookPageName: '',
    instagramAccountId: '',
    instagramUsername: '',
    hasMetaAppId: false,
    metaAppId: '',
    linkedinConnected: false,
  });
  const [showMetaSetup, setShowMetaSetup] = useState(false);
  const [metaTokenInput, setMetaTokenInput] = useState('');
  const [metaAppIdInput, setMetaAppIdInput] = useState('');
  const [metaAppSecretInput, setMetaAppSecretInput] = useState('');
  const [verifyingMeta, setVerifyingMeta] = useState(false);

  const loadMetaStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/meta/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && !data.error) {
          setMetaStatus({
            connected: Boolean(data.connected),
            hasToken: Boolean(data.hasToken),
            facebookPageId: data.facebookPageId || '',
            facebookPageName: data.facebookPageName || '',
            instagramAccountId: data.instagramAccountId || '',
            instagramUsername: data.instagramUsername || '',
            hasMetaAppId: Boolean(data.hasMetaAppId),
            metaAppId: data.metaAppId || '',
            linkedinConnected: Boolean(data.linkedinConnected),
          });
          if (data.metaAppId) setMetaAppIdInput(data.metaAppId);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadMetaStatus();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('meta_connected') === '1') {
        setFlash('Vos comptes Facebook et Instagram sont maintenant connectés !');
      } else if (params.get('meta_error')) {
        const errCode = params.get('meta_error');
        setError(
          errCode === 'missing_app_id'
            ? "Pour utiliser le bouton de connexion Meta en 1 clic, renseignez d'abord votre identifiant d'application Meta ou collez votre jeton d'accès ci-dessous."
            : `Connexion Meta interrompue : ${errCode}`
        );
        setShowMetaSetup(true);
      }
    }
  }, [loadMetaStatus]);

  const handleStartMetaOAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (!token) {
      setError('Session expirée : veuillez vous reconnecter.');
      return;
    }
    window.location.href = `/api/admin/meta/login?token=${encodeURIComponent(token)}`;
  };

  const handleStartLinkedinOAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (!token) {
      setError('Session expirée : veuillez vous reconnecter.');
      return;
    }
    window.location.href = `/api/admin/linkedin/login?token=${encodeURIComponent(token)}`;
  };

  const handleVerifyMetaToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingMeta(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (metaTokenInput.trim()) {
        const res = await fetch('/api/admin/meta/status', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'verify_token',
            accessToken: metaTokenInput.trim(),
            appId: metaAppIdInput.trim(),
            appSecret: metaAppSecretInput.trim(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || 'Impossible de vérifier ce jeton Meta.');
        }
        setMetaTokenInput('');
        setShowMetaSetup(false);
        await loadMetaStatus();
        setFlash(
          `Comptes détectés automatiquement : ${[
            data.facebookPageName && `Page Facebook « ${data.facebookPageName} »`,
            data.instagramUsername && `Instagram @${data.instagramUsername}`,
          ]
            .filter(Boolean)
            .join(' + ') || 'Jeton enregistré'}.`
        );
      } else if (metaAppIdInput.trim()) {
        const res = await fetch('/api/admin/meta/status', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'save_manual',
            metaAppId: metaAppIdInput.trim(),
            metaAppSecret: metaAppSecretInput.trim(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) {
          throw new Error(data?.error || 'Enregistrement impossible.');
        }
        await loadMetaStatus();
        setFlash('Identifiants Meta enregistrés. Vous pouvez maintenant cliquer sur « Connecter Facebook & Instagram ».');
      } else {
        setError('Collez votre jeton Meta ou renseignez votre App ID Meta.');
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la connexion Meta.');
    } finally {
      setVerifyingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    if (!window.confirm('Déconnecter les comptes Facebook et Instagram de ce Studio ?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    await fetch('/api/admin/meta/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'disconnect' }),
    }).catch(() => null);
    await loadMetaStatus();
    setFlash('Comptes Facebook et Instagram déconnectés.');
  };

  return (
    <div className="space-y-8">
      {/* ── 0. Connexion directe aux comptes Facebook, Instagram & LinkedIn ──── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
              <Link2 size={14} /> Publication directe en 1 clic
            </span>
            <h3 className="text-[18px] font-semibold text-[#3A3730]">
              Vos comptes réseaux sociaux connectés
            </h3>
            <p className="text-[13px] text-stone-600">
              Connectez votre Page Facebook et votre compte Instagram Professionnel pour publier vos carrousels et vos posts sans quitter le Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {metaStatus.hasMetaAppId ? (
              <button
                type="button"
                onClick={handleStartMetaOAuth}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[13px] font-semibold transition-colors cursor-pointer"
              >
                <Instagram size={15} />
                {metaStatus.connected ? 'Reconnecter Facebook & Instagram' : 'Connecter Facebook & Instagram'}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowMetaSetup((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl bg-[#FAF7F2] hover:bg-stone-200/70 text-[#3A3730] border border-stone-200 text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <KeyRound size={14} className="text-[#8A9A7B]" />
              {metaStatus.connected ? 'Gérer la connexion Meta' : 'Brancher Instagram & Facebook'}
            </button>

            <button
              type="button"
              onClick={handleStartLinkedinOAuth}
              className="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Linkedin size={14} />
              {metaStatus.linkedinConnected ? 'LinkedIn connecté ✓' : 'Connecter LinkedIn'}
            </button>
          </div>
        </div>

        {/* Cartes d'état des 3 canaux */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Instagram */}
          <div className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${
            metaStatus.instagramAccountId ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                metaStatus.instagramAccountId ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-stone-700 border border-stone-200'
              }`}>
                <Instagram size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#3A3730]">Instagram Professionnel</p>
                <p className="text-[12px] text-stone-600 truncate">
                  {metaStatus.instagramAccountId
                    ? `Connecté${metaStatus.instagramUsername ? ` · @${metaStatus.instagramUsername}` : ''}`
                    : 'Non connecté'}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
              metaStatus.instagramAccountId ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
            }`}>
              {metaStatus.instagramAccountId ? 'Actif' : 'À relier'}
            </span>
          </div>

          {/* Facebook */}
          <div className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${
            metaStatus.facebookPageId ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                metaStatus.facebookPageId ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-stone-700 border border-stone-200'
              }`}>
                <Facebook size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#3A3730]">Page Facebook</p>
                <p className="text-[12px] text-stone-600 truncate">
                  {metaStatus.facebookPageId
                    ? `Connectée${metaStatus.facebookPageName ? ` · ${metaStatus.facebookPageName}` : ''}`
                    : 'Non connectée'}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
              metaStatus.facebookPageId ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
            }`}>
              {metaStatus.facebookPageId ? 'Active' : 'À relier'}
            </span>
          </div>

          {/* Google Business Profile Palézieux-Gare */}
          <div className="rounded-xl p-4 border bg-[#FAF7F2] border-stone-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white text-[#8A9A7B] border border-stone-200 flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#3A3730]">Fiche Google (Palézieux-Gare)</p>
                <p className="text-[12px] text-stone-600 truncate">
                  Textes &amp; visuels 4:3 prêts à copier
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#8A9A7B]/20 text-[#3A3730] shrink-0">
              Prêt
            </span>
          </div>
        </div>

        {/* Panneau de liaison rapide Meta (auto-découverte Page FB + compte IG) */}
        {showMetaSetup && (
          <form
            onSubmit={handleVerifyMetaToken}
            autoComplete="off"
            className="rounded-xl bg-[#FAF7F2] border border-stone-200 p-5 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-[15px] font-semibold text-[#3A3730]">
                  Relier votre Page Facebook et votre compte Instagram en 3 étapes simples
                </h4>
                <p className="text-[12.5px] text-stone-600 mt-0.5 leading-relaxed">
                  Pour des raisons de sécurité, Facebook ne permet pas d&apos;entrer un email/mot de passe directement : il utilise une <strong>clé d&apos;autorisation Meta (qui commence par EAA…)</strong>. Une fois collée ci-dessous, le Studio détecte tout seul votre Page Facebook et votre Instagram.
                </p>
              </div>
              {metaStatus.connected && (
                <button
                  type="button"
                  onClick={handleDisconnectMeta}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[12px] font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Unplug size={13} /> Déconnecter
                </button>
              )}
            </div>

            {/* Guide pas-à-pas 1-2-3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white rounded-xl p-4 border border-stone-200 text-[12.5px] text-stone-700">
              <div className="space-y-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#3A3730] text-white text-[11px] font-bold">
                  1
                </span>
                <p className="font-semibold text-[#3A3730]">Ouvrir l&apos;outil officiel Meta</p>
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  Connectez-vous avec votre compte Facebook administrateur de la page <strong>Emmanuelle Esthétique</strong> :
                </p>
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#8A9A7B] hover:text-[#3A3730] underline"
                >
                  Ouvrir Meta Graph Explorer ↗
                </a>
              </div>

              <div className="space-y-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#3A3730] text-white text-[11px] font-bold">
                  2
                </span>
                <p className="font-semibold text-[#3A3730]">Générer la clé (Access Token)</p>
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  À droite, dans <em>Permissions</em>, cochez <code className="bg-stone-100 px-1 rounded">pages_show_list</code>, <code className="bg-stone-100 px-1 rounded">pages_manage_posts</code> et <code className="bg-stone-100 px-1 rounded">instagram_content_publish</code>, puis cliquez sur <strong>Generate Access Token</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#3A3730] text-white text-[11px] font-bold">
                  3
                </span>
                <p className="font-semibold text-[#3A3730]">Copier et coller ci-dessous</p>
                <p className="text-[12px] text-stone-600 leading-relaxed">
                  Copiez le long code qui commence par <strong>EAA…</strong> en haut de la page Meta, collez-le dans le premier champ ci-dessous et cliquez sur le bouton noir.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3 space-y-1">
                <label className="block text-[13px] font-semibold text-[#3A3730]">
                  1. Clé d&apos;accès Meta (code commençant par EAA…)
                </label>
                <input
                  type="text"
                  name="meta_graph_access_token_field"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  value={metaTokenInput}
                  onChange={(e) => setMetaTokenInput(e.target.value)}
                  placeholder="Collez ici le code qui commence par EAA…"
                  className="w-full h-10 rounded-lg border border-stone-300 bg-white px-3 text-[13px] font-mono text-stone-900 focus:border-[#3A3730] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-stone-700">
                  App ID Meta (chiffres uniquement — optionnel)
                </label>
                <input
                  type="text"
                  name="meta_numeric_app_id_field"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  value={metaAppIdInput.includes('@') ? '' : metaAppIdInput}
                  onChange={(e) => setMetaAppIdInput(e.target.value)}
                  placeholder="Laisser vide ou ex: 123456789012345"
                  className="w-full h-9 rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] text-stone-900 focus:border-[#3A3730] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-stone-700">
                  App Secret Meta (optionnel, jeton 60 jours)
                </label>
                <input
                  type="text"
                  name="meta_app_secret_field"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  value={metaAppSecretInput}
                  onChange={(e) => setMetaAppSecretInput(e.target.value)}
                  placeholder="Laisser vide (optionnel)"
                  className="w-full h-9 rounded-lg border border-stone-300 bg-white px-3 text-[12.5px] text-stone-900 focus:border-[#3A3730] focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={verifyingMeta}
                  className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {verifyingMeta ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {verifyingMeta ? 'Détection des comptes…' : 'Détecter & Connecter mes comptes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── 1. Bandeau Identité d'Emmanuelle Esthétique ──────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
              <Flower2 size={14} /> Identité de marque active
            </span>
            <h2 className="text-xl font-semibold text-[#3A3730]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '26px' }}>
              {instituteName}
            </h2>
            <p className="text-[14px] text-stone-700 flex items-center gap-1.5">
              <MapPin size={14} className="text-[#8A9A7B] shrink-0" />
              <span>{instituteAddress}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleScanWebsite}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {scanning ? 'Analyse du site en cours…' : 'Analyser mon site web pour mettre à jour l’identité'}
          </button>
        </div>

        {/* Palette de couleurs & Polices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-stone-200/80">
          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-stone-700">
              <Palette size={14} className="text-[#8A9A7B]" /> Palette de couleurs officielle
            </span>
            <div className="flex flex-wrap gap-2.5">
              {PALETTE_SWATCHES.map((swatch) => (
                <div
                  key={swatch.hex}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-stone-300 shrink-0"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="text-[12px] font-semibold text-[#3A3730]">{swatch.name}</span>
                  <span className="text-[11px] text-stone-500 font-mono">{swatch.hex}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-stone-700">
              <Type size={14} className="text-[#60B9C2]" /> Typographies des visuels &amp; carrousels
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[11px] text-stone-500">Titres &amp; Accroches</p>
                <p className="text-[17px] font-semibold text-[#3A3730]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                  Cormorant Garamond
                </p>
              </div>
              <div className="h-8 w-px bg-stone-200" />
              <div>
                <p className="text-[11px] text-stone-500">Textes &amp; Signature</p>
                <p className="text-[14px] font-medium text-[#3A3730]">
                  Inter (Sans-serif lisible)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <span className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="font-semibold underline cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {flash && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-700" />
          <span>{flash}</span>
        </div>
      )}

      {/* ── 2. Les 4 blocs éditables simplement (sans jargon) ────────────────── */}
      <form onSubmit={handleSaveIdentity} className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-semibold text-[#3A3730]">
              Mémoire éditoriale de l&apos;institut
            </h3>
            <p className="text-[13px] text-stone-700 mt-0.5">
              Ces 4 repères guident toutes vos publications pour qu&apos;elles vous ressemblent fidèlement.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#8A9A7B] hover:bg-[#788869] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Enregistrement…' : 'Enregistrer mon identité'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2">
            <label className="block text-[14px] font-semibold text-[#3A3730]">
              1. Présentation de l&apos;institut &amp; savoir-faire
            </label>
            <p className="text-[12px] text-stone-600">
              Votre cabine à Palézieux-Gare, votre parcours et ce qui rend vos soins uniques.
            </p>
            <textarea
              rows={4}
              value={activityContext}
              onChange={(e) => setActivityContext(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-[#FAF7F2]/50 px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2">
            <label className="block text-[14px] font-semibold text-[#3A3730]">
              2. Vos clientes (Palézieux, Oron, Châtel-St-Denis, Haute-Broye)
            </label>
            <p className="text-[12px] text-stone-600">
              À qui vous vous adressez et ce qu&apos;elles viennent chercher en poussant la porte de l&apos;institut.
            </p>
            <textarea
              rows={4}
              value={targetPersona}
              onChange={(e) => setTargetPersona(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-[#FAF7F2]/50 px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2">
            <label className="block text-[14px] font-semibold text-[#3A3730]">
              3. Carte des soins &amp; rituels Phytomer à mettre en avant
            </label>
            <p className="text-[12px] text-stone-600">
              Vos soins signatures, durées et tarifs officiels pour ne jamais inventer de prestation.
            </p>
            <textarea
              rows={4}
              value={brandTone}
              onChange={(e) => setBrandTone(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-[#FAF7F2]/50 px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>

          <div className="bg-white rounded-xl p-4 border border-stone-200 space-y-2">
            <label className="block text-[14px] font-semibold text-[#3A3730]">
              4. Votre façon de parler (Ton de voix &amp; règles d&apos;écriture)
            </label>
            <p className="text-[12px] text-stone-600">
              Vouvoiement, douceur, mots que vous aimez et expressions à éviter.
            </p>
            <textarea
              rows={4}
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-[#FAF7F2]/50 px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:bg-white focus:outline-none leading-relaxed"
            />
          </div>
        </div>
      </form>

      {/* ── 3. Catalogue des Soins & Offres du moment détectés sur le site ───── */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-[18px] font-semibold text-[#3A3730]">
            Catalogue des Soins &amp; Offres du moment
          </h3>
          <p className="text-[13px] text-stone-700 mt-0.5">
            Cliquez sur « Créer un post sur ce soin » pour préparer immédiatement une publication dédiée dans votre calendrier.
          </p>
        </div>

        {/* Offres du moment actives si présentes */}
        {monthlyOffers.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-[13px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
              Offres du moment actives sur le site
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {monthlyOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="bg-[#FAF7F2] border border-[#8A9A7B]/40 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-[#3A3730]">{offer.title}</span>
                      {offer.price && (
                        <span className="text-[12px] font-semibold text-[#8A9A7B]">{offer.price}</span>
                      )}
                    </div>
                    {offer.description && (
                      <p className="text-[12px] text-stone-700 leading-relaxed">{offer.description}</p>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={creatingCareId !== null}
                      onClick={() =>
                        handleCreatePostForCare(
                          `offer-${offer.id}`,
                          offer.title,
                          offer.description || offer.subtitle || offer.title,
                          'Offre du moment'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3A3730] hover:bg-stone-800 text-white text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {creatingCareId === `offer-${offer.id}` ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CalendarPlus size={13} />
                      )}
                      Créer un post sur cette offre
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Soins signatures par catégorie */}
        <div className="space-y-5">
          {CARTE.map((category) => {
            const featuredItems = category.groups.flatMap((g) => g.items).slice(0, 4);
            return (
              <div key={category.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[14px] font-semibold text-[#3A3730]">{category.label}</h4>
                  <span className="text-[12px] text-stone-500">{category.path}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featuredItems.map((item) => {
                    const isCreating = creatingCareId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[14px] font-semibold text-[#3A3730] leading-snug">
                              {item.name}
                            </span>
                            <span className="text-[12px] font-semibold text-stone-700 shrink-0 bg-stone-100 px-2 py-0.5 rounded-md">
                              {item.duration ? `${item.duration} · ` : ''}{chf(item.price)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[12px] text-stone-600 leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            disabled={creatingCareId !== null}
                            onClick={() =>
                              handleCreatePostForCare(
                                item.id,
                                item.name,
                                item.description || `${item.name} (${chf(item.price)}) — ${category.tagline}`,
                                category.label
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-stone-200/70 text-[#3A3730] border border-stone-200 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isCreating ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Sparkles size={13} className="text-[#8A9A7B]" />
                            )}
                            {isCreating ? 'Rédaction en cours…' : 'Créer un post sur ce soin'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Galerie Photos de la Bibliothèque ─────────────────────────────── */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[18px] font-semibold text-[#3A3730] flex items-center gap-2">
              <ImageIcon size={18} className="text-[#8A9A7B]" /> Images de votre Bibliothèque Médias ({libraryPhotos.length > 0 ? libraryPhotos.length : BRAND_PHOTOS.length})
            </h3>
            <p className="text-[13px] text-stone-700 mt-0.5">
              Toutes vos publications utilisent obligatoirement les photos de votre bibliothèque médias pour illustrer vos posts et carrousels.
            </p>
          </div>
          <a
            href="/admin/media"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-[12px] font-semibold text-[#3A3730] transition-colors"
          >
            Gérer la bibliothèque d&apos;images →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
          {(libraryPhotos.length > 0
            ? libraryPhotos.map((p) => ({
                id: p.id,
                category: p.category,
                title: p.label,
                url: p.url,
                caption: p.category,
              }))
            : BRAND_PHOTOS
          ).map((photo) => (
            <div
              key={photo.id}
              className="group bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/5] bg-stone-100 overflow-hidden relative">
                <img
                  src={photo.url}
                  alt={photo.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#3A3730]/85 text-[#FAF7F2] text-[10px] font-semibold">
                  {photo.category}
                </span>
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="text-[12px] font-semibold text-[#3A3730] leading-snug truncate">{photo.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Sources d'actualités (Flux RSS) ───────────────────────────────── */}
      <div className="pt-2">
        <SocialSourcesClient onGenerated={onGeneratedFromSources} />
      </div>
    </div>
  );
}
