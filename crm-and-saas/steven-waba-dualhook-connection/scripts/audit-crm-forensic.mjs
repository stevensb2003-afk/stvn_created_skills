#!/usr/bin/env node
/**
 * audit-crm-forensic.mjs
 * Auditor forense automatizado para verificar cumplimiento del CRM v5.0:
 * - Tamaño modular (< 500 líneas por archivo .ts/.tsx)
 * - Cero colores HEX o escalas fijas Tailwind fuera de globals.css y constantes de paleta
 * - Guardián verifyCrmRequestAuth en rutas privadas /api/crm/**
 * - Binarios WASM Opus en public/opus/
 * - Reglas de seguridad sin correos personales ni fugas públicas en /crm_media
 */

import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.firebase']);
const PUBLIC_CRM_API_EXCEPTIONS = [
  /\/api\/crm\/webhook(\/|$)/,
  /\/api\/crm\/webhooks\/hacienda(\/|$)/,
  /\/api\/crm\/webhooks\/logistics(\/|$)/,
  /\/api\/crm\/webhooks\/bank-transfer(\/|$)/,
  /\/api\/crm\/system\/license-webhook(\/|$)/,
  /\/api\/crm\/invitations\/accept(\/|$)/,
  /\/api\/crm\/setup\/status(\/|$)/,
  /\/api\/crm\/media\/whatsapp-jpeg(\/|$)/,
  /\/api\/crm\/media\/outbound-bridge(\/|$)/,
];

function printHelp() {
  console.log(`
audit-crm-forensic.mjs — Auditor Forense de Seguridad, Diseño y Modularidad CRM v5.0

Uso:
  node scripts/audit-crm-forensic.mjs [ruta_proyecto] [--json] [--help]
`);
}

function walk(dir) {
  const out = [];
  function visit(d) {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.isFile()) out.push(full);
    }
  }
  visit(dir);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const asJson = args.includes('--json');
  const rootDir = path.resolve(args.find((a) => !a.startsWith('-')) || process.cwd());

  if (!fs.existsSync(rootDir)) {
    console.error(`Ruta no encontrada: ${rootDir}`);
    process.exit(1);
  }

  const allFiles = walk(rootDir);
  const tsFiles = allFiles.filter((f) => /\.(ts|tsx)$/.test(f));

  // 1. Archivos > 500 líneas
  const oversizedFiles = [];
  for (const f of tsFiles) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    if (lines > 500) oversizedFiles.push({ file: path.relative(rootDir, f), lines });
  }

  // 2. Hardcodeo de colores HEX o Tailwind fijo en .tsx (excluyendo constantes de paleta/email)
  const hardcodedColorHits = [];
  const colorRegex = /(#[0-9a-fA-F]{3,8}|bg-(?:slate|gray|zinc|neutral|blue|sky|emerald|green|red|amber|yellow|indigo|purple|violet)-\d{2,3})/;
  for (const f of tsFiles.filter((x) => x.endsWith('.tsx'))) {
    const rel = path.relative(rootDir, f);
    if (/(theme-palettes|assignment-colors|tag-colors|invitation-template|mockup)/.test(rel)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (colorRegex.test(line)) {
        hardcodedColorHits.push({ file: rel, line: idx + 1, sample: line.trim().slice(0, 90) });
      }
    });
  }

  // 3. Rutas /api/crm/** sin verifyCrmRequestAuth
  const unguardedRoutes = [];
  const crmApiRoutes = tsFiles.filter((f) => /\/api\/crm\/.*\/route\.ts$/.test(f));
  for (const f of crmApiRoutes) {
    const rel = '/' + path.relative(rootDir, f).replace(/\\/g, '/');
    if (PUBLIC_CRM_API_EXCEPTIONS.some((rx) => rx.test(rel))) continue;
    const content = fs.readFileSync(f, 'utf8');
    if (!content.includes('verifyCrmRequestAuth') && !content.includes('verifyIdToken')) {
      unguardedRoutes.push(rel);
    }
  }

  // 4. WASM Opus Audio
  const hasOpusWasm = fs.existsSync(path.join(rootDir, 'public/opus/OggOpusEncoder.wasm'));

  // 5. Reglas Storage y Firestore
  const storageRulesPath = path.join(rootDir, 'storage.rules');
  const storageRules = fs.existsSync(storageRulesPath) ? fs.readFileSync(storageRulesPath, 'utf8') : '';
  const hasPublicCrmMediaLeak = /match\s+\/(?:tenants\/\{tenantId\}\/)?crm_media\/[\s\S]{0,120}allow\s+read:\s*if\s+true\s*;/.test(storageRules);

  const firestoreRulesPath = path.join(rootDir, 'firestore.rules');
  const firestoreRules = fs.existsSync(firestoreRulesPath) ? fs.readFileSync(firestoreRulesPath, 'utf8') : '';
  const hasHardcodedEmailInRules = /@gmail\.com|@hotmail\.com|@decoinnova/i.test(firestoreRules);

  // 6. Higiene PKI (0 llaves .p12/.pfx commiteadas en el repositorio)
  const committedPkiFiles = allFiles
    .filter((f) => /\.(p12|pfx)$/i.test(f))
    .map((f) => path.relative(rootDir, f));

  // 7. Preservación Web Push en PWA (prohibido reg.unregister() en actualizadores de versión)
  const versionFiles = tsFiles.filter((f) => /(version|sw-catchup|service-worker)/i.test(path.basename(f)));
  const swUnregisterHits = [];
  for (const f of versionFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (/\.unregister\s*\(/.test(content)) {
      swUnregisterHits.push(path.relative(rootDir, f));
    }
  }

  const checks = [
    { name: 'Modularidad (< 500 líneas/archivo)', passed: oversizedFiles.length === 0, detail: `${oversizedFiles.length} excedidos` },
    { name: 'Diseño Token-Pure (0 HEX/Tailwind fijo)', passed: hardcodedColorHits.length === 0, detail: `${hardcodedColorHits.length} hallazgos` },
    { name: 'Auth Guard en /api/crm/*', passed: unguardedRoutes.length === 0, detail: crmApiRoutes.length ? `${unguardedRoutes.length} sin guard` : 'Sin rutas /api/crm detectadas aún' },
    { name: 'Binario Opus WASM en public/opus/', passed: hasOpusWasm, detail: hasOpusWasm ? 'Presente' : 'Faltante (revisar postinstall)' },
    { name: 'Storage Rules sin lectura pública en /crm_media', passed: !hasPublicCrmMediaLeak, detail: hasPublicCrmMediaLeak ? 'FUGA DETECTADA: allow read: if true' : 'Protegido' },
    { name: 'Firestore Rules sin correos quemados', passed: !hasHardcodedEmailInRules, detail: hasHardcodedEmailInRules ? 'Correo quemado detectado' : 'Limpio' },
    { name: 'Higiene PKI (0 llaves .p12/.pfx commiteadas en repo)', passed: committedPkiFiles.length === 0, detail: committedPkiFiles.length ? `${committedPkiFiles.length} detectadas: ${committedPkiFiles.join(', ')}` : 'Limpio' },
    { name: 'Preservación Suscripción Web Push PWA (sin reg.unregister)', passed: swUnregisterHits.length === 0, detail: swUnregisterHits.length ? `Detectado en: ${swUnregisterHits.join(', ')}` : 'Limpio' },
  ];

  const score = checks.filter((c) => c.passed).length;
  const output = {
    rootDir,
    score: `${score}/${checks.length}`,
    checks,
    oversizedFiles: oversizedFiles.slice(0, 10),
    hardcodedColorHits: hardcodedColorHits.slice(0, 15),
    unguardedRoutes,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`\n=== Auditoría Forense CRM v5.0 (${output.score}) ===`);
  for (const c of checks) {
    console.log(`${c.passed ? '✅' : '⚠️'} ${c.name}: ${c.detail}`);
  }
  if (oversizedFiles.length) {
    console.log('\nArchivos > 500 líneas:', oversizedFiles.slice(0, 10));
  }
  if (unguardedRoutes.length) {
    console.log('\nRutas API sin verifyCrmRequestAuth:', unguardedRoutes);
  }
}

main();
