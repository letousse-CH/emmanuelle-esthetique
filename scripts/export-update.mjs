#!/usr/bin/env node
/**
 * Outil d'exportation et de mise à jour automatique des sites clients.
 * Copie les évolutions du code pilote vers un autre projet (ex: audeladeschaines.com)
 * sans toucher à ses identifiants Supabase ni à son fichier .env.local.
 *
 * Usage : npm run export-update
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

function copyDirRecursive(src, dest, ignoreList = [
  'node_modules', '.next', '.git', '.netlify', 'dist',
  'vite_legacy_backup', '.claude', '.gemini', 'scratch', 'ok', '.env.local'
], preserveIfExists = [
  'src/components/home',
  'src/components/decodeur',
  'src/data/decodeur-quiz.json',
  'src/services/quizProfiles.ts'
]) {
  const absSrc = resolve(src);
  const absDest = resolve(dest);

  mkdirSync(absDest, { recursive: true });
  const entries = readdirSync(absSrc, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = resolve(join(absSrc, entry.name));
    const destPath = resolve(join(absDest, entry.name));

    // Si le fichier/dossier est propre au client et existe déjà chez lui, on le conserve intact
    const relPath = srcPath.replace(resolve(ROOT_DIR) + '/', '');
    if (preserveIfExists.some(p => relPath.startsWith(p)) && existsSync(destPath)) {
      continue;
    }

    if (srcPath === absDest || absDest.startsWith(srcPath)) continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, ignoreList, preserveIfExists);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('\n━━━ Assistant de Mise à Jour Automatique ━━━\n');
  console.log("Cet outil déploie les dernières fonctionnalités du dossier pilote");
  console.log("vers un autre site client (ex: audeladeschaines.com).\n");

  const targetInput = await ask("Dossier du site à mettre à jour", {
    defaultValue: '../audeladeschaines',
    required: true
  });

  const targetDir = resolve(targetInput);

  if (!existsSync(targetDir)) {
    console.log(`\n⚠ Le dossier "${targetDir}" n'existe pas encore.`);
    const create = await askYesNo('Voulez-vous créer ce dossier et y installer le site ?', true);
    if (!create) {
      console.log('Mise à jour annulée.');
      rl.close();
      return;
    }
    mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n→ Copie des mises à jour du code dans : ${targetDir}...`);

  // Copie des fichiers en préservant .env.local du client
  copyDirRecursive(ROOT_DIR, targetDir);

  console.log('✓ Code mis à jour avec succès.');
  console.log('✓ Fichier .env.local du client conservé intact (aucune modification des clés Supabase).');

  rl.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 MISE À JOUR TERMINÉE AVEC SUCCÈS !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Chemin du site mis à jour : ${targetDir}`);
  console.log('\n📌 Prochaines étapes :\n');
  console.log('1️⃣  Déploiement du code :');
  console.log(`    cd "${targetDir}"`);
  console.log('    git add . && git commit -m "feat: mise à jour système & SIO" && git push');
  console.log('\n2️⃣  Migration de la base Supabase (Automatique) :');
  console.log('    - Connectez-vous sur l\'admin du site mis à jour.');
  console.log('    - La base se synchronise automatiquement (ou via Réglages > Sécurité > Auto-Migration).\n');
}

main();
