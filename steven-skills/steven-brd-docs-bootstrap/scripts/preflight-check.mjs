#!/usr/bin/env node
/**
 * preflight-check.mjs
 *
 * Compuerta inicial obligatoria (Fase 0) en TODOS los modos de steven-brd-docs-bootstrap:
 * 1. Valida/descubre la carpeta dedicada exclusiva (<proyecto>_ai_agent_docs).
 * 2. Detecta automáticamente el modo: BOOTSTRAP_FIRST_RUN vs INCREMENTAL_OR_NEW_MODULE.
 * 3. Verifica si el plugin externo oficial `egm` (`egm-bootstrap` + `egm-drift-report`) está instalado.
 *    Si NO está instalado y no se pasó `--allow-fallback`, sale con código 2 mostrando los enlaces
 *    y comandos CLI oficiales de instalación global para recomendarlos de inmediato al usuario.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const EGM_INSTALL_GUIDE = {
  website: 'https://egm.dev',
  repository: 'https://github.com/google/elephant-goldfish-model',
  antigravityCli: 'agy plugin install https://github.com/google/elephant-goldfish-model',
  antigravityApp: 'Ejecuta /plugin en el chat o pide: Install https://github.com/google/elephant-goldfish-model',
  manualGlobalShell:
    'git clone https://github.com/google/elephant-goldfish-model.git /tmp/egm && mkdir -p ~/.gemini/config/plugins/egm && cp -R /tmp/egm/{plugin.json,README.md,LICENSE,skills,agents,resources,docs,assets} ~/.gemini/config/plugins/egm/ && rm -rf /tmp/egm',
  claudeCodeCli:
    'claude plugin marketplace add google/elephant-goldfish-model && claude plugin install egm@egm',
  codexCli:
    'codex plugin marketplace add google/elephant-goldfish-model && codex plugin add egm@egm',
};

function parseArgs(argv) {
  const args = argv.slice(2);
  let targetDir = '';
  let allowFallback = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target-dir' && args[i + 1]) {
      targetDir = args[++i];
    } else if (args[i] === '--allow-fallback') {
      allowFallback = true;
    } else if (!args[i].startsWith('--') && !targetDir) {
      targetDir = args[i];
    }
  }

  return { targetDir, allowFallback };
}

function inferDefaultFolderName(cwd) {
  const entries = fs.readdirSync(cwd, { withFileTypes: true });
  const existing = entries.find((e) => e.isDirectory() && e.name.endsWith('_ai_agent_docs'));
  if (existing) return existing.name;

  let baseSlug = path.basename(cwd);
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name && typeof pkg.name === 'string') {
        baseSlug = pkg.name.replace(/^@[^/]+\//, '');
      }
    } catch {
      // ignore malformed package.json
    }
  }
  const cleanSlug =
    baseSlug
      .toLowerCase()
      .replace(/(toolkit|app|web|frontend|backend|monorepo)$/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'app';

  return `${cleanSlug}_ai_agent_docs`;
}

function findEgmSkill(cwd, skillName) {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.gemini', 'config', 'plugins', 'egm', 'skills', skillName, 'SKILL.md'),
    path.join(home, '.gemini', 'config', 'skills', skillName, 'SKILL.md'),
    path.join(cwd, '.agents', 'skills', skillName, 'SKILL.md'),
    path.join(home, '.gemini', 'antigravity', 'builtin', 'skills', skillName, 'SKILL.md'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getModifiedCodeFiles(cwd, relTargetDir) {
  try {
    const out = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .split('\n');
    return out
      .map((l) => l.slice(3).trim())
      .filter((f) => f && !f.startsWith(`${relTargetDir}/`) && !f.startsWith('.agents/'));
  } catch {
    return [];
  }
}

function main() {
  const cwd = process.cwd();
  const { targetDir, allowFallback } = parseArgs(process.argv);
  const folderName = targetDir || inferDefaultFolderName(cwd);
  const resolvedDir = path.resolve(cwd, folderName);
  const relDir = path.relative(cwd, resolvedDir) || folderName;

  if (['docs', 'documentation', '.', 'src'].includes(relDir.replace(/\/+$/, ''))) {
    console.error(
      `❌ Carpeta inválida ("${relDir}"): steven-brd-docs-bootstrap exige SIEMPRE una carpeta dedicada exclusiva (ej. "<proyecto>_ai_agent_docs").`
    );
    process.exit(1);
  }

  const contentTablePath = path.join(resolvedDir, '00-CONTENT-TABLE.md');
  const isBootstrap = !fs.existsSync(contentTablePath);
  const mode = isBootstrap ? 'BOOTSTRAP_FIRST_RUN' : 'INCREMENTAL_OR_NEW_MODULE';
  const egmBootstrapPath = findEgmSkill(cwd, 'egm-bootstrap');
  const egmDriftReportPath = findEgmSkill(cwd, 'egm-drift-report');
  const modifiedFiles = isBootstrap ? [] : getModifiedCodeFiles(cwd, relDir);

  const report = {
    dedicatedFolder: relDir,
    mode,
    requiresEgmInAllModes: true,
    firstRunRequiresGoal: isBootstrap,
    egmBootstrapInstalled: Boolean(egmBootstrapPath),
    egmBootstrapSkillPath: egmBootstrapPath,
    egmDriftReportInstalled: Boolean(egmDriftReportPath),
    egmDriftReportSkillPath: egmDriftReportPath,
    egmInstallGuide: egmBootstrapPath ? undefined : EGM_INSTALL_GUIDE,
    detectedChangedFilesSample: modifiedFiles.slice(0, 25),
    totalChangedFilesDetected: modifiedFiles.length,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!egmBootstrapPath && !allowFallback) {
    console.error(
      '\n⚠️  BLOQUEO PRE-FLIGHT: No se detectó el plugin externo `egm` (`egm-bootstrap`) instalado.\n' +
        '👉 Acción obligatoria del Agente: Detente antes de escribir archivos y muestra al usuario cómo instalarlo:\n' +
        `   • Repositorio oficial: ${EGM_INSTALL_GUIDE.repository} (${EGM_INSTALL_GUIDE.website})\n` +
        `   • Antigravity CLI:     ${EGM_INSTALL_GUIDE.antigravityCli}\n` +
        `   • Antigravity App/IDE: ${EGM_INSTALL_GUIDE.antigravityApp}\n` +
        `   • Terminal global:     ${EGM_INSTALL_GUIDE.manualGlobalShell}\n` +
        `   • Claude Code CLI:     ${EGM_INSTALL_GUIDE.claudeCodeCli}\n` +
        `   • Codex CLI:           ${EGM_INSTALL_GUIDE.codexCli}\n` +
        '   Pregúntale si desea instalar EGM primero (recomendado para máxima calidad tanto en 1ª vez como en actualizaciones)\n' +
        '   o si aprueba explícitamente continuar sin EGM (`--allow-fallback`) sabiendo que la profundidad puede ser menor.'
    );
    process.exit(2);
  }

  if (isBootstrap) {
    console.log(
      `\n✅ Pre-Flight OK [MODO PRIMERA VEZ]: Crear carpeta exclusiva "${relDir}/", usar "${egmBootstrapPath || 'fallback-protocol'}" y ejecutar con /goal activo.`
    );
  } else {
    console.log(
      `\n✅ Pre-Flight OK [MODO INCREMENTAL / NUEVO MÓDULO]: Carpeta "${relDir}/" detectada. Usa "${egmDriftReportPath || egmBootstrapPath || 'fallback-protocol'}" + "${egmBootstrapPath || 'fallback-protocol'}" sobre el sub-árbol afectado y re-indexa con build-llm-toc-index.mjs.`
    );
  }
}

main();
