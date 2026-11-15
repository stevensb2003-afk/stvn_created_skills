#!/usr/bin/env node
/**
 * analyze-project-architecture.mjs
 * Universal, project-agnostic repository scanner for steven-module-architect.
 * Inspects framework, dependencies, icon library, design tokens, RBAC guards,
 * database/security rules, feature licensing gates, file sizes, and *_ai_agent_docs.
 */

import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.firebase',
]);

function printHelp() {
  console.log(`
analyze-project-architecture.mjs — Escáner Universal de Arquitectura para Nuevos Módulos

Uso:
  node analyze-project-architecture.mjs [ruta_repo] [--json] [--help]

Opciones:
  [ruta_repo]   Directorio del proyecto a analizar (default: directorio actual)
  --json        Imprime la salida en formato JSON estructurado
  --help, -h    Muestra esta ayuda
`);
}

function walkFiles(rootDir, maxDepth = 6) {
  const results = [];
  function visit(currentDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      if (entry.isDirectory()) {
        results.push({ type: 'dir', fullPath, relPath, name: entry.name });
        visit(fullPath, depth + 1);
      } else if (entry.isFile()) {
        results.push({ type: 'file', fullPath, relPath, name: entry.name });
      }
    }
  }
  visit(rootDir, 0);
  return results;
}

function readSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function analyzePackageJson(rootDir) {
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { present: false, framework: 'unknown', icons: ['none'], database: ['unknown'], ui: [] };
  }
  const pkg = JSON.parse(readSafe(pkgPath) || '{}');
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  let framework = 'custom-js';
  if (deps.next) {
    const hasAppDir =
      fs.existsSync(path.join(rootDir, 'src/app')) || fs.existsSync(path.join(rootDir, 'app'));
    framework = hasAppDir ? 'nextjs-app-router' : 'nextjs-pages-router';
  } else if (deps.vite && deps.react) {
    framework = 'vite-react';
  } else if (deps['@angular/core']) {
    framework = 'angular';
  } else if (deps.react) {
    framework = 'react';
  }

  const icons = [];
  if (deps['@phosphor-icons/react']) icons.push('@phosphor-icons/react');
  if (deps['lucide-react']) icons.push('lucide-react');
  if (deps['@tabler/icons-react']) icons.push('@tabler/icons-react');
  if (deps['@heroicons/react']) icons.push('@heroicons/react');

  const database = [];
  if (deps.firebase || deps['firebase-admin']) database.push('firebase-firestore');
  if (deps['@supabase/supabase-js']) database.push('supabase');
  if (deps.prisma || deps['@prisma/client']) database.push('prisma');
  if (deps['drizzle-orm']) database.push('drizzle');

  const ui = Object.keys(deps).filter(
    (k) =>
      k.startsWith('@radix-ui/') ||
      k === 'tailwindcss' ||
      k === 'sonner' ||
      k === 'recharts' ||
      k === 'zod' ||
      k === 'framer-motion' ||
      k === 'motion'
  );

  return {
    present: true,
    name: pkg.name || path.basename(rootDir),
    version: pkg.version || '0.0.0',
    framework,
    icons: icons.length ? icons : ['none-detected'],
    database: database.length ? database : ['none-detected'],
    ui,
    scripts: Object.keys(pkg.scripts || {}),
  };
}

function analyzeCssTokens(rootDir, files) {
  const cssCandidates = files.filter(
    (f) => f.type === 'file' && (f.name === 'globals.css' || f.name === 'index.css' || f.name === 'app.css')
  );
  const tokens = new Set();
  for (const c of cssCandidates) {
    const content = readSafe(c.fullPath);
    const matches = content.match(/--[a-z0-9-]+(?=\s*:)/gi) || [];
    for (const m of matches) tokens.add(m);
  }
  return {
    files: cssCandidates.map((c) => c.relPath),
    hasPrimaryToken: tokens.has('--primary'),
    hasSecondaryToken: tokens.has('--secondary'),
    hasTertiaryToken: tokens.has('--tertiary'),
    tokenCount: tokens.size,
  };
}

function findPatternFiles(files, regex) {
  return files.filter((f) => f.type === 'file' && regex.test(f.relPath)).map((f) => f.relPath);
}

function countLargeCodeFiles(files, threshold = 500) {
  const large = [];
  for (const f of files) {
    if (f.type !== 'file') continue;
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(f.name)) continue;
    const content = readSafe(f.fullPath);
    const lines = content ? content.split('\n').length : 0;
    if (lines > threshold) {
      large.push({ file: f.relPath, lines });
    }
  }
  return large.sort((a, b) => b.lines - a.lines).slice(0, 20);
}

function analyzeDocsAndSkills(rootDir, files) {
  const aiDocDirs = files
    .filter((f) => f.type === 'dir' && f.name.endsWith('_ai_agent_docs'))
    .map((f) => f.relPath);
  const hasContentTable = aiDocDirs.some((dir) =>
    fs.existsSync(path.join(rootDir, dir, '00-CONTENT-TABLE.md'))
  );
  const brdSkillInstalled = fs.existsSync(
    path.join(process.env.HOME || '', '.gemini/config/skills/steven-brd-docs-bootstrap/SKILL.md')
  );
  return {
    aiDocDirs,
    hasContentTable,
    brdSkillInstalled,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  const asJson = args.includes('--json');
  const targetArg = args.find((a) => !a.startsWith('-')) || process.cwd();
  const rootDir = path.resolve(targetArg);

  if (!fs.existsSync(rootDir)) {
    console.error(`Error: La ruta no existe: ${rootDir}`);
    process.exit(1);
  }

  const files = walkFiles(rootDir);
  const pkgInfo = analyzePackageJson(rootDir);
  const cssInfo = analyzeCssTokens(rootDir, files);
  const rbacFiles = findPatternFiles(files, /(permission|rbac|auth-guard|role|licensing|license|tenant_license)/i);
  const rulesAndSchemaFiles = findPatternFiles(
    files,
    /(firestore\.rules|storage\.rules|firestore\.indexes\.json|schema\.prisma|drizzle|migrations\/)/i
  );
  const apiRoutes = findPatternFiles(files, /(^|\/)(api|server|actions)\//i).slice(0, 30);
  const largeFiles = countLargeCodeFiles(files, 500);
  const docsInfo = analyzeDocsAndSkills(rootDir, files);

  const report = {
    rootDir,
    package: pkgInfo,
    designTokens: cssInfo,
    rbacAndLicensingFiles: rbacFiles,
    rulesAndSchemas: rulesAndSchemaFiles,
    sampleBackendFiles: apiRoutes,
    filesExceeding500Lines: largeFiles,
    aiKnowledgeDocs: docsInfo,
    recommendations: [
      !cssInfo.hasTertiaryToken
        ? 'Agregar --tertiary y --tertiary-foreground a globals.css / tailwind.config si el módulo requiere acentos terciarios.'
        : 'Tokens de color listos en CSS.',
      pkgInfo.icons.includes('lucide-react') && !pkgInfo.icons.includes('@phosphor-icons/react')
        ? 'Considerar migrar o envolver íconos nuevos en @phosphor-icons/react (<AppIcon />) para evitar estética genérica.'
        : 'Sistema de íconos detectado.',
      largeFiles.length > 0
        ? `Existen ${largeFiles.length} archivos >500 líneas: mantener el nuevo módulo estrictamente modular (<500 líneas/archivo).`
        : 'Higiene modular saludable (todos los archivos <=500 líneas).',
      docsInfo.aiDocDirs.length > 0
        ? `Base documental IA detectada (${docsInfo.aiDocDirs.join(', ')}): ejecutar steven-brd-docs-bootstrap Modo C tras terminar el módulo.`
        : 'Sin carpeta *_ai_agent_docs detectada aún: considerar ejecutar steven-brd-docs-bootstrap al concluir.',
    ],
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n=== Escáner Arquitectónico: ${report.package.name || path.basename(rootDir)} ===`);
  console.log(`Ruta: ${report.rootDir}`);
  console.log(`Framework: ${report.package.framework} | Íconos: ${report.package.icons.join(', ')} | DB: ${report.package.database.join(', ')}`);
  console.log(`Design Tokens: ${report.designTokens.files.join(', ') || 'No detectado'} (primary=${report.designTokens.hasPrimaryToken}, tertiary=${report.designTokens.hasTertiaryToken})`);
  console.log(`RBAC / Licensing: ${report.rbacAndLicensingFiles.length} archivos (${report.rbacAndLicensingFiles.slice(0, 8).join(', ') || 'ninguno'})`);
  console.log(`Reglas / Esquemas DB: ${report.rulesAndSchemas.join(', ') || 'ninguno'}`);
  console.log(`Docs IA (*_ai_agent_docs): ${report.aiKnowledgeDocs.aiDocDirs.join(', ') || 'no detectado'} | BRD Skill: ${report.aiKnowledgeDocs.brdSkillInstalled ? 'Instalado' : 'No instalado'}`);
  console.log(`Archivos > 500 líneas: ${report.filesExceeding500Lines.length}`);
  console.log('\nRecomendaciones:');
  for (const r of report.recommendations) console.log(`  - ${r}`);
}

main();
