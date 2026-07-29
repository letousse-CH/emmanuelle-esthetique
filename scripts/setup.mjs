#!/usr/bin/env node
/**
 * Assistant d'installation du template.
 * Pose les questions de configuration (coordonnées d'entreprise, modules,
 * clés de service), écrit .env.local et seed la table Supabase `settings`
 * si les identifiants sont fournis.
 *
 * Usage : npm run setup
 */
import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env.local');

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question, { defaultValue = '', required = false } = {}) {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  while (true) {
    const answer = (await rl.question(`${question}${suffix} : `)).trim();
    if (answer) return answer;
    if (defaultValue) return defaultValue;
    if (!required) return '';
    console.log('  → requis, merci de renseigner une valeur.');
  }
}

async function askYesNo(question, defaultYes = true) {
  const suffix = defaultYes ? 'O/n' : 'o/N';
  const answer = (await rl.question(`${question} (${suffix}) : `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === 'o' || answer === 'oui' || answer === 'y' || answer === 'yes';
}

function mergeEnvFile(existingContent, values) {
  const lines = existingContent ? existingContent.split('\n') : [];
  const seen = new Set();
  const output = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match && Object.prototype.hasOwnProperty.call(values, match[1])) {
      seen.add(match[1]);
      const value = values[match[1]];
      return value ? `${match[1]}=${value}` : line;
    }
    return line;
  });
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key) && value) {
      output.push(`${key}=${value}`);
    }
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

async function main() {
  console.log('\n━━━ Installation du site ━━━\n');
  console.log("Cet assistant configure les coordonnées d'entreprise, les modules activés");
  console.log("et les clés de service. Laisse un champ vide pour passer (configurable plus");
  console.log('tard dans .env.local ou depuis Paramètres > Entreprise / Modules).\n');

  // ── Coordonnées d'entreprise ─────────────────────────────
  console.log('── Coordonnées d\'entreprise ──');
  const businessName = await ask("Nom de l'entreprise / du site");
  const businessOwner = await ask('Nom du propriétaire / praticien');
  const businessEmail = await ask('E-mail de contact');
  const businessPhone = await ask('Téléphone');
  const businessAddressStreet = await ask('Rue et numéro');
  const businessAddressPostal = await ask('Code postal');
  const businessAddressCity = await ask('Ville');
  const businessAddressRegion = await ask('Région / Canton');
  const businessAddressCountry = await ask('Pays (code ISO, ex : CH)', { defaultValue: 'CH' });

  // ── Modules ───────────────────────────────────────────────
  console.log('\n── Modules ──');
  const moduleBlog = await askYesNo('Activer le module Blog / Articles ?', true);
  const moduleAiGeneration = await askYesNo("Activer la génération IA d'article ?", true);
  const moduleEvents = await askYesNo('Activer le module Événements / Ateliers ?', true);

  // ── Supabase ──────────────────────────────────────────────
  console.log('\n── Supabase (laisse vide pour configurer plus tard) ──');
  const supabaseUrl = await ask('URL du projet Supabase');
  const supabaseAnonKey = await ask('Clé anon Supabase');
  const supabaseServiceRoleKey = await ask('Clé service_role Supabase (nécessaire pour le seed automatique ci-dessous)');

  // ── Clés optionnelles ─────────────────────────────────────
  console.log('\n── Clés de service optionnelles (laisse vide pour ignorer) ──');
  const stripeSecretKey = await ask('Stripe — clé secrète (STRIPE_SECRET_KEY)');
  const stripeWebhookSecret = await ask('Stripe — secret webhook (STRIPE_WEBHOOK_SECRET)');
  const r2AccountId = await ask('Cloudflare R2 — Account ID');
  const r2AccessKeyId = await ask('Cloudflare R2 — Access Key ID');
  const r2SecretAccessKey = await ask('Cloudflare R2 — Secret Access Key');
  const r2BucketName = await ask('Cloudflare R2 — Bucket name');
  const r2PublicUrl = await ask('Cloudflare R2 — URL publique du bucket');
  const resendApiKey = await ask('Resend — clé API (envoi d\'e-mails)');
  const anthropicApiKey = await ask('Anthropic — clé API (génération IA)');
  const googlePlacesApiKey = await ask('Google Places — clé API (avis Google)');
  const googlePlaceId = await ask('Google Places — Place ID');
  const cronSecret = await ask('Secret pour les tâches planifiées (CRON_SECRET)');

  rl.close();

  // ── .env.local ────────────────────────────────────────────
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  const envValues = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    NEXT_PUBLIC_SITE_URL: '',
    CONTACT_EMAIL: businessEmail,
    STRIPE_SECRET_KEY: stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
    R2_ACCOUNT_ID: r2AccountId,
    R2_ACCESS_KEY_ID: r2AccessKeyId,
    R2_SECRET_ACCESS_KEY: r2SecretAccessKey,
    R2_BUCKET_NAME: r2BucketName,
    NEXT_PUBLIC_R2_PUBLIC_URL: r2PublicUrl,
    RESEND_API_KEY: resendApiKey,
    RESEND_FROM_EMAIL: '',
    ANTHROPIC_API_KEY: anthropicApiKey,
    GOOGLE_PLACES_API_KEY: googlePlacesApiKey,
    GOOGLE_PLACE_ID: googlePlaceId,
    CRON_SECRET: cronSecret,
  };
  writeFileSync(ENV_PATH, mergeEnvFile(existing, envValues));
  console.log(`\n✓ .env.local écrit (${ENV_PATH})`);

  // ── Seed Supabase `settings` ──────────────────────────────
  if (supabaseUrl && supabaseServiceRoleKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      const rows = [
        ['module_blog_enabled', String(moduleBlog)],
        ['module_ai_generation_enabled', String(moduleAiGeneration)],
        ['module_events_enabled', String(moduleEvents)],
        ...(businessName ? [['business_name', businessName]] : []),
        ...(businessOwner ? [['business_owner', businessOwner]] : []),
        ...(businessEmail ? [['business_email', businessEmail]] : []),
        ...(businessPhone ? [['business_phone', businessPhone]] : []),
        ...(businessAddressStreet ? [['business_address_street', businessAddressStreet]] : []),
        ...(businessAddressPostal ? [['business_address_postal', businessAddressPostal]] : []),
        ...(businessAddressCity ? [['business_address_city', businessAddressCity]] : []),
        ...(businessAddressRegion ? [['business_address_region', businessAddressRegion]] : []),
        ...(businessAddressCountry ? [['business_address_country', businessAddressCountry]] : []),
      ].map(([key, value]) => ({ key, value }));

      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) {
        console.error(`\n✗ Erreur lors du seed Supabase : ${error.message}`);
        console.error('  Les tables existent-elles ? Applique d\'abord les migrations dans supabase/migrations/.');
      } else {
        console.log(`✓ ${rows.length} réglages écrits dans la table Supabase "settings"`);
      }
    } catch (err) {
      console.error(`\n✗ Erreur lors du seed Supabase : ${err.message}`);
    }
  } else {
    console.log('\n⚠ Pas de clé service_role fournie — les modules/coordonnées ne sont pas encore');
    console.log('  enregistrés en base. Configure-les depuis /admin/settings après le premier déploiement,');
    console.log('  ou relance `npm run setup` avec les clés Supabase renseignées.');
  }

  console.log('\n━━━ Prochaines étapes ━━━');
  console.log('1. Applique les migrations SQL (supabase/migrations/*.sql) sur ton projet Supabase');
  console.log('   — via `supabase db push` ou en les collant dans le SQL Editor du dashboard.');
  console.log('2. Vérifie/complète .env.local (les clés non fournies sont laissées vides).');
  console.log('3. Crée un compte Supabase Auth (email/mot de passe) pour te connecter à /login.');
  console.log('4. npm run dev, puis connecte-toi à /admin pour affiner Modules / Entreprise / Design.');
  console.log('5. Connecte le dépôt à Netlify et reporte les mêmes variables dans ses paramètres.\n');
}

main();
