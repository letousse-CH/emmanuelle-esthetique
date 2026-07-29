#!/usr/bin/env node
/**
 * Outil d'automatisation de duplication du site pour une nouvelle activité.
 * Exemple : Dupliquer le template vers "Emmanuelle Esthétique"
 *
 * Usage : npm run duplicate
 */
import { createInterface } from 'node:readline/promises';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(join(__dirname, '..'));

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(question, { defaultValue = '', required = false } = {}) {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  while (true) {
    const rawAnswer = (await rl.question(`${question}${suffix} : `)).trim();
    if (rawAnswer) return rawAnswer;
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

// Copie récursive de dossier en excluant les dossiers lourds, temporaires ou de destination
function copyDirRecursive(src, dest, ignoreList = ['node_modules', '.next', '.git', '.netlify', 'dist', 'vite_legacy_backup', '.claude', '.gemini', 'scratch', 'ok']) {
  const absSrc = resolve(src);
  const absDest = resolve(dest);

  mkdirSync(absDest, { recursive: true });
  const entries = readdirSync(absSrc, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = resolve(join(absSrc, entry.name));
    const destPath = resolve(join(absDest, entry.name));

    // Empêcher la récursion si la destination se trouve à l'intérieur du dossier source
    if (srcPath === absDest || absDest.startsWith(srcPath)) continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, ignoreList);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('\n━━━ Assistant de Duplication de Site ━━━\n');
  console.log("Cet outil clône le template et configure un nouveau site autonome");
  console.log("pré-rempli avec les coordonnées et l'activité de votre choix (ex: Emmanuelle Esthétique).\n");

  const businessName = await ask("1. Nom de la nouvelle entreprise / du site", { defaultValue: 'Emmanuelle Esthétique', required: true });
  const businessOwner = await ask("2. Nom du propriétaire / praticien", { defaultValue: 'Emmanuelle', required: true });
  const businessEmail = await ask("3. E-mail de contact", { defaultValue: 'contact@emmanuelle-esthetique.com' });
  const businessPhone = await ask("4. Téléphone", { defaultValue: '+41 79 000 00 00' });
  const businessCity = await ask("5. Ville / Canton", { defaultValue: 'Palézieux, Vaud' });
  const siteActivity = await ask("6. Description de l'activité (pour l'IA & le blog)", {
    defaultValue: `${businessName} — Institut de beauté et soins esthétiques spécialisé dans les soins du visage, la relaxation et le bien-être à ${businessCity}.`,
  });

  const parentDir = dirname(ROOT_DIR);
  const defaultFolderName = businessName.replace(/[^a-zA-Z0-9]/g, '');
  const defaultFolder = join(parentDir, defaultFolderName);

  let targetDirInput = await ask(`\n7. Dossier de destination pour le nouveau site`, { defaultValue: defaultFolder });

  // Si l'utilisateur tape "ok" ou "oui" à la question du dossier, utiliser le chemin par défaut
  if (['ok', 'o', 'oui', 'yes', 'y'].includes(targetDirInput.trim().toLowerCase())) {
    targetDirInput = defaultFolder;
  }

  let targetDir = resolve(targetDirInput);

  // Sécurité : si le dossier visé est à l'intérieur du projet courant, le placer à côté
  if (targetDir.startsWith(ROOT_DIR)) {
    targetDir = resolve(defaultFolder);
  }

  console.log(`\n→ Duplication en cours dans le dossier : ${targetDir}...`);

  if (existsSync(targetDir)) {
    const overwrite = await askYesNo(`Le dossier "${targetDir}" existe déjà. Écraser les fichiers ?`, false);
    if (!overwrite) {
      console.log('Duplication annulée.');
      rl.close();
      return;
    }
  }

  // 1. Copie des fichiers
  copyDirRecursive(ROOT_DIR, targetDir);
  console.log('✓ Fichiers source copiés avec succès.');

  // 2. Mise à jour de package.json
  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.name = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // 3. Mise à jour de SETTINGS_DEFAULTS dans src/constants/settings.ts
  const settingsPath = join(targetDir, 'src', 'constants', 'settings.ts');
  if (existsSync(settingsPath)) {
    let content = readFileSync(settingsPath, 'utf8');
    content = content.replace(/business_name:\s*'[^']*'/, `business_name: '${businessName.replace(/'/g, "\\'")}'`);
    content = content.replace(/business_owner:\s*'[^']*'/, `business_owner: '${businessOwner.replace(/'/g, "\\'")}'`);
    content = content.replace(/business_email:\s*'[^']*'/, `business_email: '${businessEmail.replace(/'/g, "\\'")}'`);
    content = content.replace(/business_phone:\s*'[^']*'/, `business_phone: '${businessPhone.replace(/'/g, "\\'")}'`);
    content = content.replace(/business_address_city:\s*'[^']*'/, `business_address_city: '${businessCity.replace(/'/g, "\\'")}'`);
    content = content.replace(/site_activity_context:\s*"[^"]*"/, `site_activity_context: "${siteActivity.replace(/"/g, '\\"')}"`);
    writeFileSync(settingsPath, content);
    console.log('✓ Paramètres par défaut pré-remplis pour la nouvelle activité.');
  }

  // 4. Git init dans le nouveau projet
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    console.log('✓ Nouveau dépôt Git local initialisé.');
  } catch {
    console.warn('⚠ Impossible d\'initialiser Git automatiquement.');
  }

  rl.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 SUCCÈS ! Votre nouveau site "${businessName}" est prêt.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Chemin du nouveau projet : ${targetDir}\n`);
  console.log('📌 ÉTAPES SUIVANTES POUR PUBLIER SUR GITHUB, SUPABASE ET NETLIFY :\n');
  console.log('1️⃣  Nouveau Dépôt GitHub :');
  console.log('    - Créez un dépôt sur https://github.com/new (ex: emmanuelle-esthetique)');
  console.log('    - Dans votre terminal dans le nouveau dossier :');
  console.log(`      cd "${targetDir}"`);
  console.log('      git add .');
  console.log(`      git commit -m "feat: initialisation du site ${businessName}"`);
  console.log('      git remote add origin https://github.com/VOTRE_COMPTE/emmanuelle-esthetique.git');
  console.log('      git push -u origin main\n');

  console.log('2️⃣  Nouveau projet Supabase :');
  console.log('    - Créez un projet sur https://app.supabase.com (ex: emmanuelle-esthetique)');
  console.log('    - Dans SQL Editor : exécutez les fichiers `.sql` situés dans `supabase/migrations/`');
  console.log('    - Récupérez l\'URL Supabase et la clé anon pour la configuration.\n');

  console.log('3️⃣  Nouveau site Netlify :');
  console.log('    - Allez sur https://app.netlify.com > "Add new site" > "Import an existing project"');
  console.log('    - Connectez votre dépôt GitHub `emmanuelle-esthetique`');
  console.log('    - Ajoutez les variables d\'environnement Supabase & Anthropic.\n');

  console.log('4️⃣  Connectez-vous sur votre nouveau site :');
  console.log('    - Allez dans /admin > Paramètres > Éditorial & Marque');
  console.log('    - L\'IA est déjà prête et s\'adaptera instantanément à l\'univers d\'Emmanuelle !\n');
}

main();
