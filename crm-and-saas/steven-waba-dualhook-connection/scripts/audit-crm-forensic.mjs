#!/usr/bin/env node
/**
 * audit-crm-forensic.mjs
 * Auditor forense automatizado para verificar cumplimiento del CRM v5.4 (12 controles estáticos):
 * - Tamaño modular (< 500 líneas por archivo .ts/.tsx)
 * - Cero colores HEX o escalas fijas Tailwind fuera de globals.css y constantes de paleta
 * - Guardián verifyCrmRequestAuth en rutas privadas /api/crm/**
 * - Binarios WASM Opus en public/opus/
 * - Reglas de seguridad sin correos personales ni fugas públicas en /crm_media
 * - Higiene PKI (.p12/.pfx), preservación Web Push PWA (sin reg.unregister)
 * - Integridad de ordenamiento (0 escrituras lastMessageAt: null) y blindaje 131051 + searchTokens
 * - Aislamiento de costos (price_cost fuera de web_catalog) e higiene *_ai_agent_docs + crm_help_chats
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
audit-crm-forensic.mjs — Auditor Forense de Seguridad, Diseño y Modularidad CRM v5.4

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
  const firestoreRulesNonComment = firestoreRules
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const hasHardcodedEmailInRules = /['"][a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}['"]/i.test(firestoreRulesNonComment);

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

  // 8. Integridad de ordenamiento en Sidebar (prohibido escribir lastMessageAt: null en .ts/.tsx)
  const nullLastMessageAtHits = [];
  for (const f of tsFiles) {
    const rel = path.relative(rootDir, f);
    if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (/\blastMessageAt\s*:\s*null\b/.test(trimmed)) {
        nullLastMessageAtHits.push({ file: rel, line: idx + 1, sample: trimmed.slice(0, 90) });
      }
    });
  }

  // 9. Blindaje 131051 unsupported + índice messages.searchTokens
  const silentUnsupportedHits = [];
  const webhookFiles = tsFiles.filter((f) => /(webhook|inbound)/i.test(f));
  for (const f of webhookFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (/case\s+['"]unsupported['"][\s\S]{0,180}bodyText\s*:\s*['"]{2}/.test(content)) {
      silentUnsupportedHits.push(path.relative(rootDir, f));
    }
  }
  const indexesPath = path.join(rootDir, 'firestore.indexes.json');
  const hasIndexesFile = fs.existsSync(indexesPath);
  const hasSearchTokensIndex = hasIndexesFile
    ? fs.readFileSync(indexesPath, 'utf8').includes('"searchTokens"')
    : true;

  // 10. Aislamiento de costos (price_cost nunca debe proyectarse en whitelist de web_catalog)
  const webCatalogCostLeaks = [];
  for (const f of tsFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (!content.includes('web_catalog')) continue;
    const whitelistMatches = content.match(/(?:WEB_CATALOG_SYNC_FIELDS|allowedKeys)\s*=\s*\[([\s\S]{0,600}?)\]/g) || [];
    for (const block of whitelistMatches) {
      if (/['"]price_cost['"]/.test(block)) {
        webCatalogCostLeaks.push(path.relative(rootDir, f));
      }
    }
  }

  // 11. Higiene base documental *_ai_agent_docs y bóveda crm_help_chats
  const aiDocsOversized = [];
  let missingAiContentTable = false;
  let aiDocsDirFound = '';
  try {
    const aiDir = fs.readdirSync(rootDir, { withFileTypes: true }).find((d) => d.isDirectory() && d.name.endsWith('_ai_agent_docs'));
    if (aiDir) {
      aiDocsDirFound = aiDir.name;
      const aiDirPath = path.join(rootDir, aiDir.name);
      missingAiContentTable = !fs.existsSync(path.join(aiDirPath, '00-CONTENT-TABLE.md'));
      for (const f of fs.readdirSync(aiDirPath).filter((x) => x.endsWith('.md'))) {
        const lineCount = fs.readFileSync(path.join(aiDirPath, f), 'utf8').split('\n').length;
        if (lineCount > 500) aiDocsOversized.push({ file: `${aiDir.name}/${f}`, lines: lineCount });
      }
    }
  } catch {
    // ignore read error
  }
  const hasPublicHelpChatsLeak = /match\s+\/(?:tenants\/\{tenantId\}\/)?crm_help_chats\/[\s\S]{0,160}allow\s+read\s*:\s*if\s+true\s*;/.test(
    firestoreRulesNonComment
  );

  const checks = [
    { name: 'Modularidad (< 500 líneas/archivo)', passed: oversizedFiles.length === 0, detail: `${oversizedFiles.length} excedidos` },
    { name: 'Diseño Token-Pure (0 HEX/Tailwind fijo)', passed: hardcodedColorHits.length === 0, detail: `${hardcodedColorHits.length} hallazgos` },
    { name: 'Auth Guard en /api/crm/*', passed: unguardedRoutes.length === 0, detail: crmApiRoutes.length ? `${unguardedRoutes.length} sin guard` : 'Sin rutas /api/crm detectadas aún' },
    { name: 'Binario Opus WASM en public/opus/', passed: hasOpusWasm, detail: hasOpusWasm ? 'Presente' : 'Faltante (revisar postinstall)' },
    { name: 'Storage Rules sin lectura pública en /crm_media', passed: !hasPublicCrmMediaLeak, detail: hasPublicCrmMediaLeak ? 'FUGA DETECTADA: allow read: if true' : 'Protegido' },
    { name: 'Firestore Rules sin correos quemados', passed: !hasHardcodedEmailInRules, detail: hasHardcodedEmailInRules ? 'Correo quemado detectado' : 'Limpio' },
    { name: 'Higiene PKI (0 llaves .p12/.pfx commiteadas en repo)', passed: committedPkiFiles.length === 0, detail: committedPkiFiles.length ? `${committedPkiFiles.length} detectadas: ${committedPkiFiles.join(', ')}` : 'Limpio' },
    { name: 'Preservación Suscripción Web Push PWA (sin reg.unregister)', passed: swUnregisterHits.length === 0, detail: swUnregisterHits.length ? `Detectado en: ${swUnregisterHits.join(', ')}` : 'Limpio' },
    { name: 'Integridad Sidebar (0 escrituras lastMessageAt: null)', passed: nullLastMessageAtHits.length === 0, detail: nullLastMessageAtHits.length ? `${nullLastMessageAtHits.length} escrituras nulas detectadas` : 'Limpio' },
    {
      name: 'Blindaje 131051 unsupported + Índice messages.searchTokens',
      passed: silentUnsupportedHits.length === 0 && hasSearchTokensIndex,
      detail:
        silentUnsupportedHits.length > 0
          ? `Descarte silencioso en: ${silentUnsupportedHits.join(', ')}`
          : !hasSearchTokensIndex
          ? 'Falta índice searchTokens en firestore.indexes.json'
          : 'Protegido',
    },
    {
      name: 'Aislamiento de Costos en web_catalog (0 price_cost)',
      passed: webCatalogCostLeaks.length === 0,
      detail: webCatalogCostLeaks.length ? `Fuga price_cost en: ${webCatalogCostLeaks.join(', ')}` : 'Protegido',
    },
    {
      name: 'Higiene Base Documental *_ai_agent_docs & Bóveda crm_help_chats',
      passed: !missingAiContentTable && aiDocsOversized.length === 0 && !hasPublicHelpChatsLeak,
      detail: hasPublicHelpChatsLeak
        ? 'FUGA: crm_help_chats legible públicamente'
        : missingAiContentTable
        ? `Falta 00-CONTENT-TABLE.md en ${aiDocsDirFound}`
        : aiDocsOversized.length > 0
        ? `${aiDocsOversized.length} docs > 500 líneas`
        : aiDocsDirFound
        ? `${aiDocsDirFound} OK`
        : 'Sin carpeta *_ai_agent_docs aún (y crm_help_chats seguro)',
    },
  ];

  const score = checks.filter((c) => c.passed).length;
  const output = {
    rootDir,
    score: `${score}/${checks.length}`,
    checks,
    oversizedFiles: oversizedFiles.slice(0, 10),
    hardcodedColorHits: hardcodedColorHits.slice(0, 15),
    unguardedRoutes,
    nullLastMessageAtHits: nullLastMessageAtHits.slice(0, 10),
    silentUnsupportedHits,
    webCatalogCostLeaks,
    aiDocsOversized,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`\n=== Auditoría Forense CRM v5.4 (${output.score}) ===`);
  for (const c of checks) {
    console.log(`${c.passed ? '✅' : '⚠️'} ${c.name}: ${c.detail}`);
  }
  if (oversizedFiles.length) {
    console.log('\nArchivos > 500 líneas:', oversizedFiles.slice(0, 10));
  }
  if (unguardedRoutes.length) {
    console.log('\nRutas API sin verifyCrmRequestAuth:', unguardedRoutes);
  }
  if (nullLastMessageAtHits.length) {
    console.log('\nEscrituras lastMessageAt: null detectadas:', nullLastMessageAtHits.slice(0, 10));
  }
}

main();
