#!/usr/bin/env node
/**
 * build-llm-toc-index.mjs
 *
 * Compilador determinista de Tablas de Contenido con coordenadas exactas de línea (Lxxx-Lyyy)
 * para bases de conocimiento Markdown orientadas a Agentes de IA (LLMs / RAG / Help Centers).
 *
 * Uso:
 *   node build-llm-toc-index.mjs <carpeta-kb> [--root-doc <ruta-docs.md>] [--max-lines 500]
 *
 * Ejemplo:
 *   node .agents/skills/steven-brd-docs-bootstrap/scripts/build-llm-toc-index.mjs docs/ai-kb --root-doc docs.md
 */

import fs from 'node:fs';
import path from 'node:path';

const TOC_START = '<!-- TOC:START -->';
const TOC_END = '<!-- TOC:END -->';
const MASTER_START = '<!-- MASTER-INDEX:START -->';
const MASTER_END = '<!-- MASTER-INDEX:END -->';
const ROOT_START = '<!-- ROOT-DOCS-INDEX:START -->';
const ROOT_END = '<!-- ROOT-DOCS-INDEX:END -->';

function parseArgs(argv) {
  const args = argv.slice(2);
  let kbDir = '';
  let rootDoc = '';
  let maxLines = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root-doc' && args[i + 1]) {
      rootDoc = args[++i];
    } else if (args[i] === '--max-lines' && args[i + 1]) {
      maxLines = Number(args[++i]) || 500;
    } else if (!args[i].startsWith('--') && !kbDir) {
      kbDir = args[i];
    }
  }

  if (!kbDir) {
    console.error('Uso: node build-llm-toc-index.mjs <carpeta_ai_agent_docs> [--root-doc <carpeta>/docs.md] [--max-lines 500]');
    process.exit(1);
  }

  const resolvedKbDir = path.resolve(process.cwd(), kbDir);
  const autoRootCandidate = path.join(resolvedKbDir, 'docs.md');
  const resolvedRootDoc = rootDoc
    ? path.resolve(process.cwd(), rootDoc)
    : fs.existsSync(autoRootCandidate)
      ? autoRootCandidate
      : '';

  return {
    kbDir: resolvedKbDir,
    rootDoc: resolvedRootDoc,
    maxLines,
  };
}

function padLine(n) {
  return `L${String(n).padStart(3, '0')}`;
}

function escapeTableCell(text) {
  return text.replace(/\|/g, '\\|').trim();
}

function extractHeaderMeta(rawContent, fileName) {
  const lines = rawContent.split('\n');
  const titleLine = lines.find((l) => l.startsWith('# ')) || `# ${fileName}`;
  const title = titleLine.replace(/^#\s+/, '').trim();

  let docId = fileName.replace(/\.md$/, '');
  let moduleId = 'transversal';
  let routes = 'N/A';
  let roles = 'Según sección';
  let purpose = '';

  for (const line of lines.slice(0, 18)) {
    const idMatch = line.match(/\*\*ID Documento\*\*:\s*`([^`]+)`/);
    if (idMatch) docId = idMatch[1];

    const modMatch = line.match(/\*\*Módulo(?:s)?(?:\s+Sistema)?\*\*:\s*`([^`]+)`/);
    if (modMatch) moduleId = modMatch[1];

    const routeMatch = line.match(/\*\*Rutas?\*\*:\s*(.+)$/);
    if (routeMatch) routes = routeMatch[1].trim();

    const roleMatch = line.match(/\*\*Roles con Acceso\*\*:\s*(.+)$/);
    if (roleMatch) roles = roleMatch[1].trim();

    const purposeMatch = line.match(/\*\*Propósito(?: LLM)?\*\*:\s*(.+)$/);
    if (purposeMatch) purpose = purposeMatch[1].trim();
  }

  return { title, docId, moduleId, routes, roles, purpose };
}

function parseHeadings(content) {
  const lines = content.split('\n');
  const headings = [];
  let inFence = false;
  let inToc = false;
  let currentH2Role = 'GENERAL';

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (trimmed === TOC_START) {
      inToc = true;
      continue;
    }
    if (trimmed === TOC_END) {
      inToc = false;
      continue;
    }
    if (inToc) continue;

    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length; // 2 or 3
    const rawHeading = match[2].trim();
    const roleMatch = rawHeading.match(/\[ROL:\s*([^\]]+)\]/i);
    let role = roleMatch ? roleMatch[1].trim() : level === 2 ? 'GENERAL' : currentH2Role;
    if (level === 2) currentH2Role = role;

    const cleanTitle = rawHeading.replace(/\s*\[ROL:\s*[^\]]+\]\s*/gi, '').trim();

    headings.push({
      level,
      rawLine: line,
      cleanTitle,
      role,
      lineNumber: idx + 1,
      endLine: idx + 1,
    });
  }

  const totalLines =
    content.endsWith('\n') && lines.length > 1 ? lines.length - 1 : lines.length;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    let end = totalLines;
    for (let j = i + 1; j < headings.length; j++) {
      if (h.level === 2 && headings[j].level === 2) {
        end = headings[j].lineNumber - 1;
        break;
      }
      if (h.level === 3 && (headings[j].level === 2 || headings[j].level === 3)) {
        end = headings[j].lineNumber - 1;
        break;
      }
    }
    h.endLine = Math.max(h.lineNumber, end);
  }

  return { headings, totalLines };
}

function replaceStandaloneBlock(rawContent, startMarker, endMarker, replacementBlock) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(
    `^${esc(startMarker)}[ \\t]*\\n[\\s\\S]*?^${esc(endMarker)}[ \\t]*$`,
    'm'
  );
  if (blockRe.test(rawContent)) {
    return rawContent.replace(blockRe, () => replacementBlock);
  }
  return null;
}

function renderTocBlock(headings, usePlaceholder = false) {
  const rows = headings.map((h, i) => {
    const indent = h.level === 3 ? '↳ ' : '';
    const range = usePlaceholder
      ? 'L000-L000'
      : `${padLine(h.lineNumber)}-${padLine(h.endLine)}`;
    return `| ${i + 1} | ${indent}${escapeTableCell(h.cleanTitle)} | \`${escapeTableCell(h.role)}\` | \`${range}\` |`;
  });

  return [
    TOC_START,
    '## Índice de Navegación Rápida por Líneas (Para IA y Lectura Directa)',
    '> **Instrucción para Agentes IA**: Lee únicamente el rango `Lxxx-Lyyy` correspondiente al subtema y rol del usuario para ahorrar contexto.',
    '',
    '| # | Sección / Subtema / Proceso | Nivel de Rol | Líneas |',
    '| :--- | :--- | :--- | :--- |',
    ...rows,
    TOC_END,
  ].join('\n');
}

function upsertTocBlock(rawContent, tocBlock) {
  const replaced = replaceStandaloneBlock(rawContent, TOC_START, TOC_END, tocBlock);
  if (replaced !== null) {
    return replaced.endsWith('\n') ? replaced : `${replaced}\n`;
  }

  const lines = rawContent.split('\n');
  let insertAt = 1;
  while (insertAt < lines.length && (lines[insertAt].startsWith('>') || lines[insertAt].trim() === '')) {
    insertAt++;
  }
  const before = lines.slice(0, insertAt).join('\n').replace(/\s+$/, '');
  const after = lines.slice(insertAt).join('\n').replace(/^\s+/, '');
  const combined = `${before}\n\n${tocBlock}\n\n${after}`;
  return combined.endsWith('\n') ? combined : `${combined}\n`;
}

function indexMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const original = raw.endsWith('\n') ? raw : `${raw}\n`;

  // Pass 1: Insert TOC with fixed-height placeholders
  const initialScan = parseHeadings(original);
  const placeholderToc = renderTocBlock(initialScan.headings, true);
  const pass1Content = upsertTocBlock(original, placeholderToc);

  // Pass 2: Compute exact final line numbers now that TOC height is stabilized
  const finalScan = parseHeadings(pass1Content);
  const exactToc = renderTocBlock(finalScan.headings, false);
  const finalContent = upsertTocBlock(pass1Content, exactToc);

  // Pass 3: Strict Verification Assertion
  const verifyLines = finalContent.split('\n');
  const verifyScan = parseHeadings(finalContent);
  for (let i = 0; i < verifyScan.headings.length; i++) {
    const expected = finalScan.headings[i];
    const actualLine = verifyLines[expected.lineNumber - 1];
    if (actualLine !== expected.rawLine) {
      throw new Error(
        `Error de verificación de línea en ${path.basename(filePath)}: esperaba "${expected.rawLine}" en L${expected.lineNumber}, encontró "${actualLine}"`
      );
    }
  }

  fs.writeFileSync(filePath, finalContent, 'utf8');
  const meta = extractHeaderMeta(finalContent, path.basename(filePath));

  return {
    fileName: path.basename(filePath),
    filePath,
    totalLines: verifyScan.totalLines,
    meta,
    headings: verifyScan.headings,
  };
}

function buildMasterSection(indexedDocs) {
  const fileRows = indexedDocs.map((d) => {
    return `| \`${d.fileName}\` | \`${escapeTableCell(d.meta.docId)}\` | \`${escapeTableCell(d.meta.moduleId)}\` | \`${d.totalLines}\` | ${escapeTableCell(d.meta.purpose || d.meta.title)} |`;
  });

  const sectionRows = [];
  for (const d of indexedDocs) {
    for (const h of d.headings) {
      if (h.level !== 2) continue;
      sectionRows.push(
        `| \`${d.fileName}\` | ${escapeTableCell(h.cleanTitle)} | \`${escapeTableCell(h.role)}\` | \`${padLine(h.lineNumber)}-${padLine(h.endLine)}\` |`
      );
    }
  }

  return [
    MASTER_START,
    '### Catálogo Maestro de Archivos de Documentación',
    '',
    '| Archivo | ID | Módulo Sistema | Líneas | Contenido Funcional Principal |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...fileRows,
    '',
    '### Mapa Directo de Secciones `H2` y Coordenadas de Línea por Archivo',
    '',
    '| Archivo Destino | Tema / Bloque Funcional | Nivel de Rol | Rango Exacto |',
    '| :--- | :--- | :--- | :--- |',
    ...sectionRows,
    MASTER_END,
  ].join('\n');
}

function main() {
  const { kbDir, rootDoc, maxLines } = parseArgs(process.argv);
  if (!fs.existsSync(kbDir)) {
    console.error(`No existe el directorio: ${kbDir}`);
    process.exit(1);
  }

  const excludedFiles = new Set(['00-CONTENT-TABLE.md', 'docs.md']);
  if (rootDoc && path.dirname(rootDoc) === kbDir) {
    excludedFiles.add(path.basename(rootDoc));
  }

  const allMdFiles = fs
    .readdirSync(kbDir)
    .filter((f) => f.endsWith('.md') && !excludedFiles.has(f))
    .sort();

  const indexedDocs = [];
  const warnings = [];

  for (const file of allMdFiles) {
    const fullPath = path.join(kbDir, file);
    const info = indexMarkdownFile(fullPath);
    indexedDocs.push(info);
    if (info.totalLines > maxLines) {
      warnings.push(`⚠️  ${file} tiene ${info.totalLines} líneas (límite recomendado: ${maxLines}). Divide en Parte A / Parte B.`);
    }
  }

  const masterPath = path.join(kbDir, '00-CONTENT-TABLE.md');
  if (fs.existsSync(masterPath)) {
    let masterRaw = fs.readFileSync(masterPath, 'utf8').replace(/\r\n/g, '\n');
    const masterBlock = buildMasterSection(indexedDocs);
    const replacedMaster = replaceStandaloneBlock(masterRaw, MASTER_START, MASTER_END, masterBlock);
    if (replacedMaster !== null) {
      masterRaw = replacedMaster.endsWith('\n') ? replacedMaster : `${replacedMaster}\n`;
    } else {
      masterRaw = `${masterRaw.trimEnd()}\n\n${masterBlock}\n`;
    }
    fs.writeFileSync(masterPath, masterRaw, 'utf8');
    const masterInfo = indexMarkdownFile(masterPath);
    if (masterInfo.totalLines > maxLines) {
      warnings.push(`⚠️  00-CONTENT-TABLE.md tiene ${masterInfo.totalLines} líneas (límite recomendado: ${maxLines}).`);
    }
  }

  if (rootDoc && fs.existsSync(rootDoc)) {
    let rootRaw = fs.readFileSync(rootDoc, 'utf8').replace(/\r\n/g, '\n');
    const summaryRows = indexedDocs.map(
      (d) =>
        `| [\`${d.fileName}\`](./${path.relative(path.dirname(rootDoc), d.filePath).replace(/\\/g, '/')}) | \`${escapeTableCell(d.meta.moduleId)}\` | \`${d.totalLines}\` | ${escapeTableCell(d.meta.purpose || d.meta.title)} |`
    );
    const rootBlock = [
      ROOT_START,
      '| Documento | Módulo | Líneas | Alcance Funcional |',
      '| :--- | :--- | :--- | :--- |',
      ...summaryRows,
      ROOT_END,
    ].join('\n');
    const replacedRoot = replaceStandaloneBlock(rootRaw, ROOT_START, ROOT_END, rootBlock);
    if (replacedRoot !== null) {
      rootRaw = replacedRoot.endsWith('\n') ? replacedRoot : `${replacedRoot}\n`;
      fs.writeFileSync(rootDoc, rootRaw, 'utf8');
    }
    const rootInfo = indexMarkdownFile(rootDoc);
    if (rootInfo.totalLines > maxLines) {
      warnings.push(`⚠️  ${path.basename(rootDoc)} tiene ${rootInfo.totalLines} líneas (límite recomendado: ${maxLines}).`);
    }
  }

  console.log(`✅ Indexados y verificados ${indexedDocs.length} documentos funcionales con coordenadas exactas de línea.`);
  if (warnings.length > 0) {
    for (const w of warnings) console.warn(w);
  }
}

main();
