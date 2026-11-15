#!/usr/bin/env node
/**
 * Pictogrammers Local Icon Vault & Selective Extractor CLI
 * Zero external npm dependencies — pure Node.js (v18+) built-in modules.
 * Supports: mdi (@mdi/svg), mdi-light (@mdi/light-svg), memory (@pictogrammers/memory-svg),
 * plus optional desktop/webfont extraction (@mdi/font).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const SCHEMA_VERSION = 1;
const CONFIG_FILE = path.join(os.homedir(), '.pictogrammers-config.json');

const PACKS = {
  mdi: {
    id: 'mdi',
    label: 'Material Design Icons',
    npmPackage: '@mdi/svg',
    defaultViewBox: '0 0 24 24',
    repoUrl: 'https://github.com/Templarian/MaterialDesign',
    svgRepoUrl: 'https://github.com/Templarian/MaterialDesign-SVG',
    catalogUrl: 'https://pictogrammers.com/library/mdi/',
    license: 'Apache-2.0 (icons) / MIT (code)',
  },
  'mdi-light': {
    id: 'mdi-light',
    label: 'Material Design Icons Light',
    npmPackage: '@mdi/light-svg',
    defaultViewBox: '0 0 24 24',
    repoUrl: 'https://github.com/Templarian/MaterialDesignLight',
    svgRepoUrl: 'https://github.com/Templarian/MaterialDesignLight',
    catalogUrl: 'https://pictogrammers.com/library/mdil/',
    license: 'Apache-2.0 (icons) / MIT (code)',
  },
  memory: {
    id: 'memory',
    label: 'Pictogrammers Memory Icons',
    npmPackage: '@pictogrammers/memory-svg',
    defaultViewBox: '0 0 22 22',
    repoUrl: 'https://github.com/Pictogrammers/Memory',
    svgRepoUrl: 'https://github.com/Pictogrammers/Memory',
    catalogUrl: 'https://pictogrammers.com/library/memory/',
    license: 'Apache-2.0 (icons) / MIT (code)',
  },
};

const FONT_PACKAGE = {
  npmPackage: '@mdi/font',
  repoUrl: 'https://github.com/Templarian/MaterialDesign-Webfont',
};

const DEFAULT_PACKS = ['mdi', 'mdi-light', 'memory'];

// Bilingual Spanish -> English synonym dictionary for UI, CRM, SaaS, commerce, and system concepts.
const ES_EN_SYNONYMS = {
  usuario: ['account', 'user', 'person'],
  usuarios: ['account-group', 'account-multiple', 'account'],
  cliente: ['account', 'account-tie', 'handshake', 'contacts'],
  clientes: ['account-group', 'account-multiple', 'handshake'],
  perfil: ['account-circle', 'card-account', 'badge-account'],
  persona: ['account', 'human'],
  equipo: ['account-group', 'team'],
  grupo: ['account-group', 'group'],
  factura: ['invoice', 'receipt', 'file-document'],
  facturacion: ['invoice', 'receipt', 'cash-register'],
  comprobante: ['receipt', 'invoice', 'file-check'],
  recibo: ['receipt'],
  boleta: ['receipt', 'ticket'],
  cajero: ['cash-register', 'point-of-sale'],
  caja: ['cash-register', 'package-variant', 'box'],
  pos: ['cash-register', 'point-of-sale'],
  venta: ['point-of-sale', 'sale', 'cart', 'tag'],
  ventas: ['chart-line', 'cash-multiple', 'point-of-sale', 'sale'],
  pago: ['credit-card', 'cash', 'wallet', 'currency-usd'],
  pagos: ['credit-card-multiple', 'cash-multiple', 'wallet'],
  dinero: ['cash', 'currency-usd', 'wallet'],
  efectivo: ['cash', 'cash-multiple'],
  moneda: ['currency-usd', 'coin', 'cash'],
  banco: ['bank', 'credit-card'],
  tarjeta: ['credit-card', 'card'],
  billetera: ['wallet'],
  impuesto: ['percent', 'calculator', 'receipt'],
  descuento: ['sale', 'percent', 'tag'],
  precio: ['tag', 'currency-usd', 'cash'],
  seguridad: ['shield', 'lock', 'security'],
  candado: ['lock', 'lock-open'],
  bloqueado: ['lock', 'cancel', 'block-helper'],
  proteccion: ['shield-check', 'shield-lock', 'shield'],
  llave: ['key', 'key-variant'],
  clave: ['key', 'form-textbox-password', 'lock'],
  contrasena: ['form-textbox-password', 'lock', 'key'],
  permisos: ['shield-account', 'account-key', 'key'],
  rol: ['shield-account', 'badge-account', 'account-cog'],
  admin: ['shield-crown', 'crown', 'account-cog'],
  ajustes: ['cog', 'tune', 'wrench'],
  configuracion: ['cog', 'tune', 'cogs'],
  engranaje: ['cog', 'cogs'],
  herramienta: ['wrench', 'tools', 'hammer'],
  envio: ['truck-delivery', 'truck', 'send'],
  camion: ['truck', 'truck-delivery'],
  entrega: ['truck-delivery', 'package-variant-closed-check', 'handshake'],
  paquete: ['package-variant', 'package', 'gift'],
  inventario: ['warehouse', 'package-variant', 'clipboard-list', 'archive'],
  bodega: ['warehouse', 'store', 'archive'],
  almacen: ['warehouse', 'archive'],
  alerta: ['alert', 'bell-alert'],
  advertencia: ['alert', 'alert-circle'],
  peligro: ['alert-octagon', 'hazard-lights', 'alert'],
  error: ['alert-circle', 'close-circle'],
  fallo: ['alert-circle', 'bug', 'close-circle'],
  exito: ['check-circle', 'check-decagram', 'check'],
  listo: ['check', 'check-circle'],
  confirmar: ['check', 'check-bold', 'check-circle'],
  verificado: ['check-decagram', 'shield-check', 'check-circle'],
  aprobar: ['check-decagram', 'thumb-up', 'check'],
  rechazar: ['close-circle', 'thumb-down', 'cancel'],
  cerrar: ['close', 'close-circle', 'window-close'],
  cancelar: ['cancel', 'close', 'close-circle'],
  borrar: ['delete', 'trash-can', 'eraser'],
  eliminar: ['delete', 'trash-can', 'close'],
  basura: ['trash-can', 'delete'],
  papelera: ['trash-can', 'delete'],
  buscar: ['magnify', 'search', 'file-search'],
  lupa: ['magnify'],
  subir: ['upload', 'cloud-upload', 'arrow-up'],
  cargar: ['upload', 'progress-upload', 'loading'],
  descargar: ['download', 'cloud-download', 'arrow-down'],
  bajar: ['download', 'arrow-down'],
  calendario: ['calendar', 'calendar-month'],
  fecha: ['calendar', 'calendar-today'],
  agenda: ['calendar-clock', 'book-open', 'notebook'],
  cita: ['calendar-check', 'calendar-clock'],
  reloj: ['clock', 'timer', 'watch'],
  hora: ['clock', 'clock-time-four'],
  tiempo: ['clock', 'timer', 'hourglass'],
  historial: ['history', 'clock-outline'],
  tienda: ['store', 'storefront', 'shopping'],
  carrito: ['cart', 'cart-plus', 'shopping'],
  compra: ['cart', 'shopping', 'bag-checked'],
  producto: ['package-variant', 'cube', 'tag', 'shopping'],
  catalogo: ['view-grid', 'book-open-variant', 'store'],
  mensaje: ['message', 'message-text', 'chat'],
  mensajes: ['message-text', 'forum', 'chat'],
  chat: ['chat', 'message-text', 'forum'],
  conversacion: ['forum', 'chat', 'message-reply-text'],
  correo: ['email', 'mail'],
  email: ['email', 'at'],
  bandeja: ['inbox', 'email'],
  estadisticas: ['chart-bar', 'chart-line', 'chart-areaspline', 'poll'],
  grafica: ['chart-line', 'chart-bar', 'chart-pie'],
  grafico: ['chart-bar', 'chart-pie', 'chart-line'],
  reporte: ['file-chart', 'chart-box', 'poll'],
  metricas: ['chart-timeline-variant', 'gauge', 'poll'],
  documento: ['file-document', 'text-box'],
  archivo: ['file', 'file-document', 'archive'],
  carpeta: ['folder', 'folder-open'],
  nota: ['note-text', 'sticky-note', 'notebook'],
  telefono: ['phone', 'cellphone'],
  llamada: ['phone', 'phone-in-talk'],
  celular: ['cellphone', 'smartphone'],
  empresa: ['domain', 'office-building', 'briefcase'],
  oficina: ['office-building', 'desk', 'domain'],
  edificio: ['office-building', 'domain'],
  sucursal: ['storefront', 'domain', 'map-marker'],
  trabajo: ['briefcase', 'hammer-wrench'],
  inicio: ['home', 'view-dashboard'],
  casa: ['home'],
  panel: ['view-dashboard', 'monitor-dashboard'],
  tablero: ['view-dashboard', 'bulletin-board', 'view-kanban'],
  menu: ['menu', 'dots-vertical', 'dots-horizontal'],
  lista: ['format-list-bulleted', 'view-list'],
  tabla: ['table', 'table-large'],
  filtro: ['filter', 'filter-variant'],
  ordenar: ['sort', 'swap-vertical'],
  ojo: ['eye', 'eye-off'],
  ver: ['eye', 'magnify'],
  mostrar: ['eye'],
  ocultar: ['eye-off'],
  editar: ['pencil', 'square-edit', 'file-edit'],
  lapiz: ['pencil'],
  modificar: ['pencil', 'tune'],
  copiar: ['content-copy'],
  duplicar: ['content-duplicate', 'content-copy'],
  pegar: ['content-paste'],
  portapapeles: ['clipboard', 'clipboard-text'],
  compartir: ['share', 'share-variant'],
  enviar: ['send', 'email-send'],
  enlace: ['link', 'link-variant', 'open-in-new'],
  nube: ['cloud', 'cloud-sync'],
  sincronizar: ['sync', 'autorenew', 'cloud-sync'],
  actualizar: ['refresh', 'update', 'sync'],
  impresora: ['printer'],
  imprimir: ['printer'],
  notificacion: ['bell', 'bell-ring', 'bell-badge'],
  campana: ['bell'],
  ubicacion: ['map-marker', 'crosshairs-gps'],
  mapa: ['map', 'map-marker'],
  direccion: ['map-marker', 'directions'],
  estrella: ['star'],
  favorito: ['heart', 'star', 'bookmark'],
  corazon: ['heart'],
  marcador: ['bookmark', 'map-marker'],
  etiqueta: ['tag', 'label'],
  codigo: ['code-tags', 'qrcode', 'barcode'],
  qr: ['qrcode', 'qrcode-scan'],
  barras: ['barcode', 'barcode-scan'],
  escaner: ['qrcode-scan', 'barcode-scan', 'scanner'],
  computadora: ['laptop', 'desktop-classic', 'monitor'],
  pantalla: ['monitor', 'television'],
  escritorio: ['desktop-tower-monitor', 'monitor', 'desk'],
  base: ['database'],
  datos: ['database', 'chart-bar'],
  servidor: ['server', 'nas'],
  ia: ['robot', 'creation', 'auto-fix', 'brain'],
  robot: ['robot'],
  magia: ['auto-fix', 'creation', 'wand'],
  automatizacion: ['robot', 'cogs', 'lightning-bolt', 'workflow'],
  sol: ['weather-sunny', 'white-balance-sunny'],
  luna: ['weather-night', 'moon-waning-crescent'],
  tema: ['theme-light-dark', 'palette'],
  paleta: ['palette', 'swatch'],
  idioma: ['translate', 'web', 'earth'],
  mundo: ['earth', 'web', 'globe-model'],
  ayuda: ['help-circle', 'lifebuoy'],
  pregunta: ['help-circle', 'comment-question'],
  info: ['information', 'information-variant'],
  soporte: ['headset', 'lifebuoy', 'face-agent'],
  agregar: ['plus', 'plus-circle', 'plus-box'],
  nuevo: ['plus', 'new-box', 'creation'],
  crear: ['plus', 'creation', 'pencil-plus'],
  quitar: ['minus', 'minus-circle', 'close'],
  salir: ['logout', 'exit-to-app'],
  entrar: ['login'],
  medico: ['stethoscope', 'hospital-box', 'medical-bag'],
  salud: ['heart-pulse', 'medical-bag', 'hospital'],
  hospital: ['hospital-building', 'hospital-box'],
  foto: ['image', 'camera'],
  imagen: ['image', 'file-image'],
  camara: ['camera', 'video'],
  video: ['video', 'play-circle', 'filmstrip'],
  audio: ['volume-high', 'microphone', 'music'],
  microfono: ['microphone'],
  sonido: ['volume-high', 'music-note'],
  flecha: ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'chevron-right'],
  atras: ['arrow-left', 'chevron-left'],
  siguiente: ['arrow-right', 'chevron-right'],
  arriba: ['arrow-up', 'chevron-up'],
  abajo: ['arrow-down', 'chevron-down'],
  descanso: ['coffee', 'sleep'],
  cafe: ['coffee'],
  cohete: ['rocket-launch', 'rocket'],
  fuego: ['fire'],
  rayo: ['lightning-bolt', 'flash'],
  wifi: ['wifi', 'access-point'],
  bateria: ['battery', 'battery-charging'],
  idioma_web: ['web', 'translate'],
  anuncio: ['bullhorn', 'megaphone'],
  megafono: ['bullhorn'],
  bandera: ['flag'],
  trofeo: ['trophy'],
  regalo: ['gift'],
  suscripcion: ['autorenew', 'credit-card-refresh', 'crown'],
  licencia: ['license', 'certificate', 'key-chain'],
  certificado: ['certificate', 'seal'],
  firma: ['draw', 'pen', 'signature-freehand'],
  calculadora: ['calculator', 'calculator-variant'],
};

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeJsonAtomic(filePath, data, pretty = false) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = pretty ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(data);
  fs.writeFileSync(tmpPath, payload, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function writeTextAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function getDefaultNativeVaultDir() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'pictogrammers');
  }
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'pictogrammers');
}

function resolveVaultDir(dirArg) {
  if (dirArg) return path.resolve(expandHome(dirArg));
  if (process.env.PICTOGRAMMERS_VAULT_DIR) {
    return path.resolve(expandHome(process.env.PICTOGRAMMERS_VAULT_DIR));
  }
  const cfg = readConfig();
  if (cfg.vaultDir) return path.resolve(expandHome(cfg.vaultDir));
  return getDefaultNativeVaultDir();
}

function parseCliArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        const k = token.slice(2, eqIdx);
        flags[k] = token.slice(eqIdx + 1);
      } else {
        const k = token.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[k] = next;
          i += 1;
        } else {
          flags[k] = true;
        }
      }
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

function fetchBuffer(urlStr, headers = {}, redirectsLeft = 10) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const client = urlObj.protocol === 'http:' ? http : https;
    const req = client.request(
      urlObj,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'steven-pictogrammers-icon-lib/1.0',
          ...headers,
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects fetching ${urlStr}`));
            return;
          }
          const nextUrl = new URL(res.headers.location, urlObj).toString();
          resolve(fetchBuffer(nextUrl, headers, redirectsLeft - 1));
          return;
        }
        if (status < 200 || status >= 300) {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const msg = Buffer.concat(chunks).toString('utf8').slice(0, 300);
            reject(new Error(`HTTP ${status} fetching ${urlStr}: ${msg}`));
          });
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.setTimeout(35000, () => {
      req.destroy(new Error(`Request timeout fetching ${urlStr}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchNpmPackageMeta(npmPackage) {
  const url = `https://registry.npmjs.org/${npmPackage}`;
  const buf = await fetchBuffer(url, {
    Accept: 'application/vnd.npm.install-v1+json',
  });
  const data = JSON.parse(buf.toString('utf8'));
  const latest = data['dist-tags']?.latest;
  if (!latest || !data.versions?.[latest]?.dist?.tarball) {
    throw new Error(`Invalid npm metadata returned for ${npmPackage}`);
  }
  const dist = data.versions[latest].dist;
  return {
    version: latest,
    tarball: dist.tarball,
    integrity: dist.integrity || null,
    shasum: dist.shasum || null,
    unpackedSize: dist.unpackedSize || null,
    fileCount: dist.fileCount || null,
  };
}

function verifyIntegrity(buffer, expectedIntegrity, expectedShasum, pkgName) {
  if (expectedIntegrity && expectedIntegrity.startsWith('sha512-')) {
    const expectedB64 = expectedIntegrity.slice('sha512-'.length);
    const actualB64 = crypto.createHash('sha512').update(buffer).digest('base64');
    if (actualB64 !== expectedB64) {
      throw new Error(
        `SHA-512 integrity check failed for ${pkgName}: expected ${expectedB64}, got ${actualB64}`
      );
    }
    return 'sha512-verified';
  }
  if (expectedShasum) {
    const actualHex = crypto.createHash('sha1').update(buffer).digest('hex');
    if (actualHex !== expectedShasum) {
      throw new Error(`SHA-1 checksum mismatch for ${pkgName}`);
    }
    return 'sha1-verified';
  }
  return 'unverified';
}

function readTarStr(buf, start, length) {
  const slice = buf.subarray(start, start + length);
  const zeroIdx = slice.indexOf(0);
  const end = zeroIdx === -1 ? length : zeroIdx;
  return slice.subarray(0, end).toString('utf8');
}

function parsePaxRecords(paxBuf) {
  const result = {};
  const str = paxBuf.toString('utf8');
  let pos = 0;
  while (pos < str.length) {
    const spaceIdx = str.indexOf(' ', pos);
    if (spaceIdx === -1) break;
    const len = parseInt(str.slice(pos, spaceIdx), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = str.slice(pos, pos + len);
    const eqIdx = record.indexOf('=', spaceIdx - pos + 1);
    if (eqIdx !== -1) {
      const key = record.slice(spaceIdx - pos + 1, eqIdx);
      const val = record.slice(eqIdx + 1).replace(/\n$/, '');
      result[key] = val;
    }
    pos += len;
  }
  return result;
}

function parseTgzEntries(tgzBuffer) {
  const tarBuf = zlib.gunzipSync(tgzBuffer);
  const entries = new Map();
  let offset = 0;
  let nextPaxPath = null;
  let nextGnuPath = null;

  while (offset + 512 <= tarBuf.length) {
    const hdr = tarBuf.subarray(offset, offset + 512);
    if (hdr.every((b) => b === 0)) break;

    const rawName = readTarStr(hdr, 0, 100);
    const rawPrefix = readTarStr(hdr, 345, 155);
    const ustarName = rawPrefix ? `${rawPrefix}/${rawName}` : rawName;
    const typeByte = hdr[156];
    const typeflag = typeByte === 0 ? '0' : String.fromCharCode(typeByte);
    const sizeOctal = readTarStr(hdr, 124, 12).trim();
    const size = parseInt(sizeOctal || '0', 8) || 0;
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const dataBuf = tarBuf.subarray(dataStart, dataEnd);

    if (typeflag === 'L') {
      nextGnuPath = dataBuf.toString('utf8').replace(/\0.*$/, '');
    } else if (typeflag === 'x') {
      const pax = parsePaxRecords(dataBuf);
      if (pax.path) nextPaxPath = pax.path;
    } else if (typeflag === '0') {
      const resolvedName = nextPaxPath || nextGnuPath || ustarName;
      nextPaxPath = null;
      nextGnuPath = null;
      entries.set(resolvedName, dataBuf);
    } else {
      nextPaxPath = null;
      nextGnuPath = null;
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function cleanSvgBody(rawSvg) {
  return rawSvg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim();
}

function parseSvgData(rawSvg, defaultViewBox) {
  const cleaned = cleanSvgBody(rawSvg);
  const vbMatch = cleaned.match(/\bviewBox\s*=\s*"([^"]+)"/i);
  const viewBox = vbMatch ? vbMatch[1].trim() : defaultViewBox;
  const paths = [];
  const pathRegex = /<path\b[^>]*\bd\s*=\s*"([^"]+)"[^>]*>/gi;
  let match;
  while ((match = pathRegex.exec(cleaned)) !== null) {
    paths.push(match[1].trim());
  }
  if (paths.length === 0) {
    return null;
  }
  return {
    viewBox,
    d: paths.length === 1 ? paths[0] : paths,
  };
}

function buildPackFromEntries(packCfg, entries) {
  let metaRaw = null;
  for (const [entryName, buf] of entries.entries()) {
    if (entryName === 'package/meta.json' || entryName.endsWith('/meta.json')) {
      metaRaw = buf;
      break;
    }
  }
  const metaByName = new Map();
  if (metaRaw) {
    const metaList = JSON.parse(metaRaw.toString('utf8'));
    for (const item of metaList) {
      if (item && item.name) {
        metaByName.set(item.name, item);
      }
    }
  }

  const icons = {};
  let deprecatedCount = 0;
  let svgCount = 0;

  for (const [entryName, buf] of entries.entries()) {
    const m = entryName.match(/(?:^|\/)svg\/([^/]+)\.svg$/);
    if (!m) continue;
    const iconName = m[1];
    const parsed = parseSvgData(buf.toString('utf8'), packCfg.defaultViewBox);
    if (!parsed) continue;

    svgCount += 1;
    const meta = metaByName.get(iconName);
    const record = { d: parsed.d };
    if (parsed.viewBox && parsed.viewBox !== packCfg.defaultViewBox) {
      record.vb = parsed.viewBox;
    }
    if (meta?.codepoint) record.cp = meta.codepoint;
    if (Array.isArray(meta?.aliases) && meta.aliases.length > 0) record.al = meta.aliases;
    if (Array.isArray(meta?.tags) && meta.tags.length > 0) record.tg = meta.tags;
    if (meta?.version) record.v = meta.version;
    if (meta?.deprecated === true) {
      record.dep = true;
      deprecatedCount += 1;
    }
    icons[iconName] = record;
  }

  return {
    pack: {
      defaultViewBox: packCfg.defaultViewBox,
      icons,
    },
    stats: {
      svgCount,
      deprecatedCount,
      activeCount: svgCount - deprecatedCount,
    },
  };
}

function formatSvgMarkup(d, viewBox, extraAttrs = '') {
  const paths = Array.isArray(d) ? d : [d];
  const pathNodes = paths.map((p) => `<path d="${p}"/>`).join('');
  const attrs = extraAttrs ? ` ${extraAttrs.trim()}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor"${attrs}>${pathNodes}</svg>`;
}

function writeRawSvgsForPack(vaultDir, packId, packData) {
  const outDir = path.join(vaultDir, 'svg', packId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, icon] of Object.entries(packData.icons)) {
    const vb = icon.vb || packData.defaultViewBox;
    const svg = formatSvgMarkup(icon.d, vb) + '\n';
    fs.writeFileSync(path.join(outDir, `${name}.svg`), svg, 'utf8');
  }
}

async function installOrRefreshFont(vaultDir) {
  const meta = await fetchNpmPackageMeta(FONT_PACKAGE.npmPackage);
  const tgzBuf = await fetchBuffer(meta.tarball);
  const integrityStatus = verifyIntegrity(tgzBuf, meta.integrity, meta.shasum, FONT_PACKAGE.npmPackage);
  const entries = parseTgzEntries(tgzBuf);
  const fontsDir = path.join(vaultDir, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });

  const extracted = [];
  for (const [entryName, buf] of entries.entries()) {
    if (
      entryName.endsWith('.ttf') ||
      entryName.endsWith('.woff2') ||
      entryName.endsWith('.css')
    ) {
      const base = path.basename(entryName);
      if (base.startsWith('materialdesignicons-webfont')) {
        const dest = path.join(fontsDir, base);
        fs.writeFileSync(dest, buf);
        extracted.push(base);
      }
    }
  }
  return {
    npmPackage: FONT_PACKAGE.npmPackage,
    version: meta.version,
    integrityStatus,
    fontsDir,
    files: extracted,
  };
}

function parsePacksFlag(rawPacks) {
  if (!rawPacks || rawPacks === true) return [...DEFAULT_PACKS];
  const list = String(rawPacks)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of list) {
    if (!PACKS[p]) {
      throw new Error(`Unknown pack "${p}". Valid packs: ${Object.keys(PACKS).join(', ')}`);
    }
  }
  return list;
}

function loadVault(vaultDir) {
  const manifestPath = path.join(vaultDir, 'vault-manifest.json');
  const vaultPath = path.join(vaultDir, 'pictovault.json');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(vaultPath)) {
    throw new Error(
      `Local Pictogrammers vault not found at "${vaultDir}". Run "setup" first to install it.`
    );
  }
  return {
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    vault: JSON.parse(fs.readFileSync(vaultPath, 'utf8')),
  };
}

function samePathData(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function computePackDiff(oldPack, newPack) {
  const oldIcons = oldPack?.icons || {};
  const newIcons = newPack?.icons || {};
  const added = [];
  const removed = [];
  const newlyDeprecated = [];
  const pathModified = [];

  for (const [name, newRec] of Object.entries(newIcons)) {
    const oldRec = oldIcons[name];
    if (!oldRec) {
      added.push(name);
    } else {
      if (!oldRec.dep && newRec.dep) {
        newlyDeprecated.push(name);
      }
      if (!samePathData(oldRec.d, newRec.d) || (oldRec.vb || '') !== (newRec.vb || '')) {
        pathModified.push(name);
      }
    }
  }
  for (const name of Object.keys(oldIcons)) {
    if (!newIcons[name]) removed.push(name);
  }

  return { added, removed, newlyDeprecated, pathModified };
}

async function cmdStatus(flags) {
  const vaultDir = resolveVaultDir(flags.dir);
  const manifestPath = path.join(vaultDir, 'vault-manifest.json');
  const vaultPath = path.join(vaultDir, 'pictovault.json');
  const installed = fs.existsSync(manifestPath) && fs.existsSync(vaultPath);

  if (!installed) {
    const out = {
      installed: false,
      platform: process.platform,
      vaultDir,
      configFile: CONFIG_FILE,
      recommendedDefaultDir: getDefaultNativeVaultDir(),
    };
    if (flags.json) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`Pictogrammers Vault: NOT INSTALLED`);
      console.log(`Platform: ${process.platform}`);
      console.log(`Target Vault Dir: ${vaultDir}`);
      console.log(`Run "node <skill>/scripts/mdi.mjs setup" to install.`);
    }
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const vaultStat = fs.statSync(vaultPath);
  const remoteUpdates = {};

  if (flags['check-remote']) {
    for (const [packId, pInfo] of Object.entries(manifest.packs || {})) {
      const cfg = PACKS[packId];
      if (!cfg) continue;
      try {
        const remote = await fetchNpmPackageMeta(cfg.npmPackage);
        remoteUpdates[packId] = {
          localVersion: pInfo.version,
          remoteVersion: remote.version,
          status: pInfo.version === remote.version ? 'UP_TO_DATE' : 'UPDATE_AVAILABLE',
        };
      } catch (err) {
        remoteUpdates[packId] = {
          localVersion: pInfo.version,
          status: 'CHECK_FAILED',
          error: err.message,
        };
      }
    }
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          installed: true,
          platform: process.platform,
          vaultDir,
          vaultSizeBytes: vaultStat.size,
          manifest,
          remoteUpdates: flags['check-remote'] ? remoteUpdates : undefined,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Pictogrammers Vault: INSTALLED`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Vault Dir: ${vaultDir}`);
  console.log(`Vault File Size: ${(vaultStat.size / (1024 * 1024)).toFixed(2)} MB (1 compact file)`);
  console.log(`Updated At: ${manifest.updatedAt}`);
  console.log('');
  for (const [packId, pInfo] of Object.entries(manifest.packs || {})) {
    const r = remoteUpdates[packId];
    const remoteTag = r ? ` | remote: ${r.remoteVersion || '?'} (${r.status})` : '';
    console.log(
      `  - ${packId} (${pInfo.npmPackage} v${pInfo.version}): ${pInfo.iconCount} icons (${pInfo.activeCount} active, ${pInfo.deprecatedCount} deprecated), viewBox "${pInfo.defaultViewBox}"${remoteTag}`
    );
  }
  if (manifest.font?.files?.length) {
    console.log(`  - font (${manifest.font.npmPackage} v${manifest.font.version}): ${manifest.font.files.join(', ')}`);
  }
}

async function cmdSetup(flags) {
  const vaultDir = resolveVaultDir(flags.dir);
  const packsToInstall = parsePacksFlag(flags.packs);
  const manifestPath = path.join(vaultDir, 'vault-manifest.json');
  const vaultPath = path.join(vaultDir, 'pictovault.json');

  if (flags.dir) {
    const existingCfg = readConfig();
    writeJsonAtomic(CONFIG_FILE, { ...existingCfg, vaultDir }, true);
  }

  let existingManifest = null;
  let existingVault = { schemaVersion: SCHEMA_VERSION, packs: {} };
  if (fs.existsSync(manifestPath) && fs.existsSync(vaultPath)) {
    existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    existingVault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
  }

  const nowIso = new Date().toISOString();
  const nextManifest = {
    schemaVersion: SCHEMA_VERSION,
    installedAt: existingManifest?.installedAt || nowIso,
    updatedAt: nowIso,
    vaultDir,
    rawSvgsExtracted: Boolean(flags['raw-svgs'] || existingManifest?.rawSvgsExtracted),
    packs: { ...(existingManifest?.packs || {}) },
    font: existingManifest?.font || null,
  };
  const nextVault = {
    schemaVersion: SCHEMA_VERSION,
    packs: { ...(existingVault.packs || {}) },
  };

  for (const packId of packsToInstall) {
    const cfg = PACKS[packId];
    console.log(`[setup] Fetching ${cfg.npmPackage} metadata from registry.npmjs.org...`);
    const remote = await fetchNpmPackageMeta(cfg.npmPackage);
    const localPackManifest = existingManifest?.packs?.[packId];

    if (
      !flags.force &&
      localPackManifest?.version === remote.version &&
      existingVault.packs?.[packId]
    ) {
      console.log(`[setup] ${packId} v${remote.version} already installed and verified.`);
      if (flags['raw-svgs']) {
        console.log(`[setup] Writing raw SVGs for ${packId}...`);
        writeRawSvgsForPack(vaultDir, packId, existingVault.packs[packId]);
      }
      continue;
    }

    console.log(`[setup] Downloading ${cfg.npmPackage}@${remote.version}...`);
    const tgzBuf = await fetchBuffer(remote.tarball);
    const integrityStatus = verifyIntegrity(tgzBuf, remote.integrity, remote.shasum, cfg.npmPackage);
    console.log(`[setup] Integrity ${integrityStatus} (${(tgzBuf.length / (1024 * 1024)).toFixed(2)} MB). Indexing...`);

    const entries = parseTgzEntries(tgzBuf);
    const { pack, stats } = buildPackFromEntries(cfg, entries);
    nextVault.packs[packId] = pack;
    nextManifest.packs[packId] = {
      id: packId,
      label: cfg.label,
      npmPackage: cfg.npmPackage,
      version: remote.version,
      integrity: remote.integrity,
      tarball: remote.tarball,
      repoUrl: cfg.repoUrl,
      svgRepoUrl: cfg.svgRepoUrl,
      catalogUrl: cfg.catalogUrl,
      license: cfg.license,
      defaultViewBox: cfg.defaultViewBox,
      iconCount: stats.svgCount,
      activeCount: stats.activeCount,
      deprecatedCount: stats.deprecatedCount,
      installedAt: nowIso,
    };

    if (flags['raw-svgs']) {
      console.log(`[setup] Extracting ${stats.svgCount} normalized raw SVGs to ${path.join(vaultDir, 'svg', packId)}...`);
      writeRawSvgsForPack(vaultDir, packId, pack);
    }
  }

  if (flags['extract-font']) {
    console.log(`[setup] Fetching ${FONT_PACKAGE.npmPackage} fonts...`);
    nextManifest.font = await installOrRefreshFont(vaultDir);
  }

  writeJsonAtomic(vaultPath, nextVault, false);
  writeJsonAtomic(manifestPath, nextManifest, true);

  const vaultSizeMB = (fs.statSync(vaultPath).size / (1024 * 1024)).toFixed(2);
  console.log('');
  console.log(`[setup] Done! Vault ready at: ${vaultDir} (${vaultSizeMB} MB compact index)`);
  for (const packId of Object.keys(nextManifest.packs)) {
    const p = nextManifest.packs[packId];
    console.log(`  - ${packId} v${p.version}: ${p.iconCount} icons (${p.activeCount} active, ${p.deprecatedCount} deprecated)`);
  }
}

async function cmdUpdate(flags) {
  const vaultDir = resolveVaultDir(flags.dir);
  const { manifest, vault } = loadVault(vaultDir);
  const targetPacks = flags.packs
    ? parsePacksFlag(flags.packs)
    : Object.keys(manifest.packs || {}).filter((p) => PACKS[p]);

  if (targetPacks.length === 0) targetPacks.push(...DEFAULT_PACKS);

  const checkResults = [];
  for (const packId of targetPacks) {
    const cfg = PACKS[packId];
    const localVer = manifest.packs?.[packId]?.version || null;
    const remote = await fetchNpmPackageMeta(cfg.npmPackage);
    const hasUpdate = localVer !== remote.version;
    checkResults.push({
      packId,
      npmPackage: cfg.npmPackage,
      localVersion: localVer,
      remoteVersion: remote.version,
      status: hasUpdate ? 'UPDATE_AVAILABLE' : 'UP_TO_DATE',
      remote,
    });
  }

  if (flags['check-only']) {
    if (flags.json) {
      console.log(JSON.stringify(checkResults.map(({ remote: _r, ...rest }) => rest), null, 2));
    } else {
      console.log('Pictogrammers Upstream Version Check:');
      for (const item of checkResults) {
        console.log(
          `  - ${item.packId} (${item.npmPackage}): local v${item.localVersion || 'none'} -> remote v${item.remoteVersion} [${item.status}]`
        );
      }
    }
    return;
  }

  const nowIso = new Date().toISOString();
  const diffReport = {
    updatedAt: nowIso,
    packs: {},
  };
  let anyChanged = false;

  for (const item of checkResults) {
    if (item.status === 'UP_TO_DATE' && !flags.force) {
      console.log(`[update] ${item.packId} v${item.localVersion} is already up to date.`);
      continue;
    }

    const cfg = PACKS[item.packId];
    console.log(
      `[update] Updating ${item.packId} (${item.npmPackage}): v${item.localVersion || 'none'} -> v${item.remoteVersion}...`
    );
    const tgzBuf = await fetchBuffer(item.remote.tarball);
    verifyIntegrity(tgzBuf, item.remote.integrity, item.remote.shasum, cfg.npmPackage);
    const entries = parseTgzEntries(tgzBuf);
    const { pack, stats } = buildPackFromEntries(cfg, entries);

    const oldPack = vault.packs?.[item.packId];
    const diff = computePackDiff(oldPack, pack);
    diffReport.packs[item.packId] = {
      fromVersion: item.localVersion,
      toVersion: item.remoteVersion,
      counts: {
        added: diff.added.length,
        removed: diff.removed.length,
        newlyDeprecated: diff.newlyDeprecated.length,
        pathModified: diff.pathModified.length,
      },
      ...diff,
    };

    vault.packs[item.packId] = pack;
    manifest.packs[item.packId] = {
      id: item.packId,
      label: cfg.label,
      npmPackage: cfg.npmPackage,
      version: item.remote.version,
      integrity: item.remote.integrity,
      tarball: item.remote.tarball,
      repoUrl: cfg.repoUrl,
      svgRepoUrl: cfg.svgRepoUrl,
      catalogUrl: cfg.catalogUrl,
      license: cfg.license,
      defaultViewBox: cfg.defaultViewBox,
      iconCount: stats.svgCount,
      activeCount: stats.activeCount,
      deprecatedCount: stats.deprecatedCount,
      installedAt: nowIso,
    };

    if (manifest.rawSvgsExtracted || flags['raw-svgs']) {
      writeRawSvgsForPack(vaultDir, item.packId, pack);
    }
    anyChanged = true;
  }

  if (anyChanged || flags.force) {
    manifest.updatedAt = nowIso;
    writeJsonAtomic(path.join(vaultDir, 'pictovault.json'), vault, false);
    writeJsonAtomic(path.join(vaultDir, 'vault-manifest.json'), manifest, true);
    writeJsonAtomic(path.join(vaultDir, 'last-update-diff.json'), diffReport, true);
    console.log(`[update] Saved diff report to ${path.join(vaultDir, 'last-update-diff.json')}`);
  }

  if (flags.json) {
    console.log(JSON.stringify(diffReport, null, 2));
  } else if (anyChanged) {
    for (const [pId, d] of Object.entries(diffReport.packs)) {
      console.log(
        `  - ${pId} (${d.fromVersion} -> ${d.toVersion}): +${d.counts.added} added, ${d.counts.newlyDeprecated} newly deprecated, ${d.counts.pathModified} path modified, -${d.counts.removed} removed`
      );
    }
  }
}

function expandSearchTerm(term) {
  const norm = normalizeText(term);
  const hyphenated = norm.replace(/\s+/g, '-');
  const words = norm.split(/[\s_-]+/).filter(Boolean);
  const expanded = new Set([norm, hyphenated]);

  if (ES_EN_SYNONYMS[norm]) {
    for (const syn of ES_EN_SYNONYMS[norm]) expanded.add(syn);
  }
  for (const w of words) {
    if (ES_EN_SYNONYMS[w]) {
      for (const syn of ES_EN_SYNONYMS[w]) expanded.add(syn);
    }
  }
  return { raw: term, norm, hyphenated, words, expanded: [...expanded] };
}

function matchesStyleFilter(packId, iconName, allIcons, styleMode) {
  if (!styleMode || styleMode === 'all') return true;
  if (styleMode === 'outline') {
    if (packId === 'mdi-light') return true;
    if (packId === 'memory') return !iconName.endsWith('-fill');
    // For main mdi: if an outline sibling exists for this solid icon, exclude the solid version.
    if (allIcons[`${iconName}-outline`]) return false;
    return true;
  }
  if (styleMode === 'filled') {
    if (packId === 'mdi-light') return false;
    if (packId === 'memory') {
      if (allIcons[`${iconName}-fill`]) return false;
      return true;
    }
    if (iconName.endsWith('-outline')) return false;
    return true;
  }
  return true;
}

function scoreIconForTerm(packId, name, icon, termInfo, styleMode) {
  const normName = normalizeText(name);
  const nameWords = normName.split('-');
  const aliases = (icon.al || []).map(normalizeText);
  const tags = (icon.tg || []).map(normalizeText);
  let best = 0;

  for (let idx = 0; idx < termInfo.expanded.length; idx += 1) {
    const q = termInfo.expanded[idx];
    const isDirect = q === termInfo.norm || q === termInfo.hyphenated;
    const weight = isDirect ? 1.0 : Math.max(0.8, 0.95 - idx * 0.02);
    let s = 0;

    if (normName === q) s = 120;
    else if (normName.startsWith(`${q}-`)) s = 95;
    else if (normName.startsWith(q)) s = 82;
    else if (aliases.some((a) => a === q)) s = 88;
    else if (aliases.some((a) => a.startsWith(q))) s = 74;
    else if (nameWords.includes(q)) s = 72;
    else if (normName.includes(q)) s = 56;
    else if (aliases.some((a) => a.includes(q))) s = 48;
    else if (tags.some((t) => t.includes(q))) s = 28;

    const weighted = s * weight;
    if (weighted > best) best = weighted;
  }

  if (best === 0 && termInfo.words.length > 1) {
    if (termInfo.words.every((w) => normName.includes(w))) {
      best = 64;
    }
  }

  if (best === 0) return 0;

  if (styleMode === 'outline') {
    if (name.endsWith('-outline')) best += 26;
    else if (packId === 'mdi-light') best += 12;
  } else if (styleMode === 'filled') {
    if (!name.endsWith('-outline')) best += 14;
    if (name.endsWith('-fill')) best += 18;
  }

  // Slight preference for canonical shorter icon names over 4-word variants.
  const baseWordCount = name.endsWith('-outline') ? nameWords.length - 1 : nameWords.length;
  if (baseWordCount > 1) {
    best -= Math.min(8, (baseWordCount - 1) * 2);
  }

  if (icon.dep) {
    best -= 65;
  }
  return Math.round(best);
}

function cmdSearch(positionals, flags) {
  const rawQuery = positionals.join(' ').trim();
  if (!rawQuery) {
    throw new Error('Usage: search "<query1|query2>" [--pack mdi|mdi-light|memory|all] [--style outline|filled|all] [--limit 20]');
  }

  const vaultDir = resolveVaultDir(flags.dir);
  const { vault } = loadVault(vaultDir);

  const packFilter = flags.pack || 'mdi';
  const targetPacks =
    packFilter === 'all'
      ? Object.keys(vault.packs || {})
      : packFilter
          .split(',')
          .map((s) => s.trim())
          .filter((p) => vault.packs?.[p]);

  if (targetPacks.length === 0) {
    throw new Error(`No matching installed packs for --pack "${packFilter}".`);
  }

  const styleMode = flags.style || 'all';
  const excludeDeprecated = Boolean(flags['exclude-deprecated']);
  const tagFilter = flags.tag ? normalizeText(flags.tag) : null;
  const limit = Math.max(1, parseInt(flags.limit || '20', 10) || 20);

  const terms = rawQuery
    .split(/[|,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(expandSearchTerm);

  const perTermBuckets = terms.map((termInfo) => {
    const matches = [];
    for (const packId of targetPacks) {
      const packData = vault.packs[packId];
      const allIcons = packData.icons || {};
      for (const [name, icon] of Object.entries(allIcons)) {
        if (excludeDeprecated && icon.dep) continue;
        if (tagFilter && !(icon.tg || []).some((t) => normalizeText(t).includes(tagFilter))) {
          continue;
        }
        if (!matchesStyleFilter(packId, name, allIcons, styleMode)) continue;

        const score = scoreIconForTerm(packId, name, icon, termInfo, styleMode);
        if (score > 0) {
          matches.push({
            pack: packId,
            name,
            id: packId === 'mdi' ? name : `${packId}:${name}`,
            score,
            matchedTerm: termInfo.raw,
            viewBox: icon.vb || packData.defaultViewBox,
            deprecated: Boolean(icon.dep),
            aliases: icon.al || [],
            tags: icon.tg || [],
          });
        }
      }
    }
    matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return matches;
  });

  // Interleave round-robin across terms using independent cursors so every concept surfaces.
  const combined = [];
  const seen = new Set();
  const cursors = perTermBuckets.map(() => 0);
  while (combined.length < limit) {
    let addedInRound = false;
    for (let bIdx = 0; bIdx < perTermBuckets.length; bIdx += 1) {
      const bucket = perTermBuckets[bIdx];
      while (cursors[bIdx] < bucket.length) {
        const item = bucket[cursors[bIdx]];
        cursors[bIdx] += 1;
        const uniqKey = `${item.pack}:${item.name}`;
        if (!seen.has(uniqKey)) {
          seen.add(uniqKey);
          combined.push(item);
          addedInRound = true;
          break;
        }
      }
      if (combined.length >= limit) break;
    }
    if (!addedInRound) break;
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          query: rawQuery,
          expandedTerms: terms,
          style: styleMode,
          packs: targetPacks,
          count: combined.length,
          results: combined,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    `Search "${rawQuery}" (packs: ${targetPacks.join(',')}, style: ${styleMode}) -> ${combined.length} results:`
  );
  for (const r of combined) {
    const depTag = r.deprecated ? ' [DEPRECATED]' : '';
    const tagsStr = r.tags.length ? ` | tags: ${r.tags.slice(0, 2).join(', ')}` : '';
    const aliasStr = r.aliases.length ? ` | aliases: ${r.aliases.slice(0, 3).join(', ')}` : '';
    console.log(
      `  - ${r.id} (score:${r.score}, term:"${r.matchedTerm}", vb:${r.viewBox})${depTag}${tagsStr}${aliasStr}`
    );
  }
}

function parseIconSpec(spec, defaultPack = 'mdi') {
  const trimmed = String(spec || '').trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    const packId = trimmed.slice(0, colonIdx).trim();
    const name = trimmed.slice(colonIdx + 1).trim();
    if (!PACKS[packId]) {
      throw new Error(`Unknown pack prefix "${packId}" in "${spec}".`);
    }
    return { packId, name, canonicalId: packId === 'mdi' ? name : `${packId}:${name}` };
  }
  return {
    packId: defaultPack,
    name: trimmed,
    canonicalId: defaultPack === 'mdi' ? trimmed : `${defaultPack}:${trimmed}`,
  };
}

function resolveIconFromVault(vault, spec, defaultPack = 'mdi') {
  const parsed = parseIconSpec(spec, defaultPack);
  const packData = vault.packs?.[parsed.packId];
  if (!packData) {
    throw new Error(`Pack "${parsed.packId}" is not installed in the local vault.`);
  }
  const icon = packData.icons?.[parsed.name];
  if (!icon) {
    return null;
  }
  return {
    ...parsed,
    icon,
    viewBox: icon.vb || packData.defaultViewBox,
  };
}

function findReplacementsForDeprecated(packData, iconName, icon) {
  const queries = [
    ...(icon.al || []),
    ...iconName.split('-').filter((w) => w.length > 2),
  ];
  const candidates = [];
  for (const [name, candidate] of Object.entries(packData.icons || {})) {
    if (name === iconName || candidate.dep) continue;
    let score = 0;
    for (const q of queries) {
      if (name === q) score += 60;
      else if (name.includes(q)) score += 25;
      else if ((candidate.al || []).includes(q)) score += 20;
    }
    if (
      score > 0 &&
      (icon.tg || []).some((t) => (candidate.tg || []).includes(t))
    ) {
      score += 10;
    }
    if (score > 0) candidates.push({ name, score });
  }
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return candidates.slice(0, 6).map((c) => c.name);
}

function cmdInspect(positionals, flags) {
  const spec = positionals[0];
  if (!spec) {
    throw new Error('Usage: inspect <icon-name|pack:icon-name> [--pack mdi]');
  }
  const vaultDir = resolveVaultDir(flags.dir);
  const { vault } = loadVault(vaultDir);
  const defaultPack = flags.pack || 'mdi';
  const resolved = resolveIconFromVault(vault, spec, defaultPack);

  if (!resolved) {
    throw new Error(`Icon "${spec}" not found in pack "${defaultPack}". Try "search" first.`);
  }

  const packData = vault.packs[resolved.packId];
  const baseRoot = resolved.name.replace(/-(outline|fill|off|plus|minus|check|alert)$/, '');
  const siblings = Object.keys(packData.icons)
    .filter((n) => n !== resolved.name && (n === baseRoot || n.startsWith(`${baseRoot}-`)))
    .sort()
    .slice(0, 20);

  const alsoInPacks = [];
  if (!spec.includes(':')) {
    for (const pId of Object.keys(vault.packs)) {
      if (pId !== resolved.packId && vault.packs[pId].icons?.[resolved.name]) {
        alsoInPacks.push(pId);
      }
    }
  }

  const replacements = resolved.icon.dep
    ? findReplacementsForDeprecated(packData, resolved.name, resolved.icon)
    : [];

  const svgMarkup = formatSvgMarkup(resolved.icon.d, resolved.viewBox);

  const out = {
    id: resolved.canonicalId,
    pack: resolved.packId,
    name: resolved.name,
    viewBox: resolved.viewBox,
    codepoint: resolved.icon.cp || null,
    version: resolved.icon.v || null,
    deprecated: Boolean(resolved.icon.dep),
    aliases: resolved.icon.al || [],
    tags: resolved.icon.tg || [],
    svgBytes: Buffer.byteLength(svgMarkup, 'utf8'),
    alsoInPacks,
    siblings,
    suggestedReplacements: replacements,
    svg: svgMarkup,
  };

  if (flags.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(`Icon: ${out.id} (pack: ${out.pack})`);
  console.log(`  viewBox: ${out.viewBox} | size: ${out.svgBytes} bytes | version: ${out.version || 'n/a'} | codepoint: ${out.codepoint || 'n/a'}`);
  console.log(`  deprecated: ${out.deprecated ? 'YES (WARNING: do not use in new UI)' : 'no'}`);
  if (out.aliases.length) console.log(`  aliases: ${out.aliases.join(', ')}`);
  if (out.tags.length) console.log(`  tags: ${out.tags.join(', ')}`);
  if (out.alsoInPacks.length) console.log(`  also exists in packs: ${out.alsoInPacks.join(', ')}`);
  if (out.siblings.length) console.log(`  sibling variants (${out.siblings.length}): ${out.siblings.join(', ')}`);
  if (out.deprecated) {
    if (out.suggestedReplacements.length) {
      console.log(`  suggested active alternatives: ${out.suggestedReplacements.join(', ')}`);
    } else if (out.tags.includes('Brand / Logo')) {
      console.log(
        `  suggested active alternatives: none in MDI (Brand/Logo icon removed/deprecated by Pictogrammers — use official brand SVG or Simple Icons)`
      );
    }
  }
  console.log(`  svg: ${out.svg}`);
}

function toSafeFileStem(canonicalId) {
  return canonicalId.replace(/:/g, '--');
}

function toCamelIdentifier(canonicalId) {
  const cleaned = canonicalId.replace(/:/g, '-');
  const parts = cleaned.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'icon';
  const camel = parts
    .map((p, idx) => (idx === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join('');
  return /^[0-9]/.test(camel) ? `icon${camel}` : camel;
}

function readMarkedBlockEntries(content, startMarker, endMarker, mode) {
  const sIdx = content.indexOf(startMarker);
  const eIdx = content.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) return {};

  const block = content.slice(sIdx + startMarker.length, eIdx);
  const map = {};

  if (mode === 'ts-map') {
    const entryRegex = /'([^']+)':\s*\{\s*d:\s*(\[[^\]]*\]|'[^']*')\s*,\s*vb:\s*'([^']+)'\s*,?\s*\}/g;
    let m;
    while ((m = entryRegex.exec(block)) !== null) {
      const key = m[1];
      const rawD = m[2].trim();
      let d;
      if (rawD.startsWith('[')) {
        d = [...rawD.matchAll(/'([^']+)'/g)].map((x) => x[1]);
      } else {
        d = rawD.slice(1, -1);
      }
      map[key] = { d, vb: m[3] };
    }
    return map;
  }

  if (mode === 'sprite') {
    const symRegex = /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/gi;
    let m;
    while ((m = symRegex.exec(block)) !== null) {
      const attrs = m[1];
      const inner = m[2];
      const idMatch = attrs.match(/\bid="([^"]+)"/i);
      const dataIconMatch = attrs.match(/\bdata-icon="([^"]+)"/i);
      const vbMatch = attrs.match(/\bviewBox="([^"]+)"/i);
      const key = dataIconMatch
        ? dataIconMatch[1]
        : (idMatch ? idMatch[1].replace(/^icon-/, '').replace(/--/g, ':') : null);
      if (!key) continue;
      const paths = [...inner.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/gi)].map((p) => p[1]);
      if (paths.length > 0) {
        map[key] = {
          d: paths.length === 1 ? paths[0] : paths,
          vb: vbMatch ? vbMatch[1] : '0 0 24 24',
        };
      }
    }
    return map;
  }

  if (mode === 'flutter') {
    const byNameRegex = /'([^']+)':\s*([a-zA-Z0-9_]+)\s*,/g;
    const constRegex = /static const String\s+([a-zA-Z0-9_]+)\s*=\s*\n?\s*'([^']+)';/g;
    const svgsByIdent = {};
    let cm;
    while ((cm = constRegex.exec(block)) !== null) {
      svgsByIdent[cm[1]] = cm[2];
    }
    let bm;
    while ((bm = byNameRegex.exec(block)) !== null) {
      const key = bm[1];
      const ident = bm[2];
      const rawSvg = svgsByIdent[ident];
      if (!rawSvg) continue;
      const parsed = parseSvgData(rawSvg, '0 0 24 24');
      if (parsed) {
        map[key] = { d: parsed.d, vb: parsed.viewBox };
      }
    }
    return map;
  }

  return map;
}

function renderReactMapFile(entriesMap) {
  const keys = Object.keys(entriesMap).sort();
  const bodyLines = keys.map((k) => {
    const { d, vb } = entriesMap[k];
    const dLiteral = Array.isArray(d)
      ? `[${d.map((p) => `'${p}'`).join(', ')}]`
      : `'${d}'`;
    return `  '${k}': {\n    d: ${dLiteral},\n    vb: '${vb}',\n  },`;
  });

  return `/**
 * Pictogrammers MDI Icon Registry (Zero-Dependency Vendored Subset)
 * Generated & maintained by steven-pictogrammers-icon-lib.
 * License: Pictogrammers Free License (Apache-2.0 icons / MIT code).
 * Edit entries via scripts/mdi.mjs (add / remove / audit).
 */
import * as React from 'react';

export interface MdiIconEntry {
  readonly d: string | readonly string[];
  readonly vb: string;
}

// @pictogrammers-icons:start
export const MDI_ICONS = {
${bodyLines.join('\n')}
} as const satisfies Record<string, MdiIconEntry>;
// @pictogrammers-icons:end

export type MdiIconName = keyof typeof MDI_ICONS;

export interface MdiIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'name' | 'children'> {
  name: MdiIconName;
  size?: number | string;
  title?: string;
}

export function MdiIcon({
  name,
  size = 24,
  title,
  className,
  ...props
}: MdiIconProps) {
  const entry = MDI_ICONS[name];
  if (!entry) return null;
  const paths = Array.isArray(entry.d) ? entry.d : [entry.d];
  const ariaHidden = title ? undefined : (props['aria-hidden'] ?? true);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={entry.vb}
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={ariaHidden}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, idx) => (
        <path key={idx} d={d} />
      ))}
    </svg>
  );
}
`;
}

function renderVueMapFile(entriesMap) {
  const keys = Object.keys(entriesMap).sort();
  const bodyLines = keys.map((k) => {
    const { d, vb } = entriesMap[k];
    const dLiteral = Array.isArray(d)
      ? `[${d.map((p) => `'${p}'`).join(', ')}]`
      : `'${d}'`;
    return `  '${k}': {\n    d: ${dLiteral},\n    vb: '${vb}',\n  },`;
  });

  return `/**
 * Pictogrammers MDI Icon Registry for Vue / Astro / Vanilla TS
 * Generated & maintained by steven-pictogrammers-icon-lib.
 * License: Pictogrammers Free License (Apache-2.0 icons / MIT code).
 */

export interface MdiIconEntry {
  readonly d: string | readonly string[];
  readonly vb: string;
}

// @pictogrammers-icons:start
export const MDI_ICONS = {
${bodyLines.join('\n')}
} as const satisfies Record<string, MdiIconEntry>;
// @pictogrammers-icons:end

export type MdiIconName = keyof typeof MDI_ICONS;

export function getMdiIconPaths(name: MdiIconName): readonly string[] {
  const entry = MDI_ICONS[name];
  return Array.isArray(entry.d) ? entry.d : [entry.d];
}
`;
}

function renderSpriteFile(entriesMap) {
  const keys = Object.keys(entriesMap).sort();
  const symbols = keys.map((k) => {
    const { d, vb } = entriesMap[k];
    const paths = (Array.isArray(d) ? d : [d]).map((p) => `<path d="${p}"/>`).join('');
    const symId = `icon-${toSafeFileStem(k)}`;
    return `  <symbol id="${symId}" viewBox="${vb}" data-icon="${k}">${paths}</symbol>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <!-- @pictogrammers-icons:start -->
${symbols.join('\n')}
  <!-- @pictogrammers-icons:end -->
</svg>
`;
}

function renderFlutterFile(entriesMap) {
  const keys = Object.keys(entriesMap).sort();
  const usedIdents = new Set();
  const identForKey = {};

  for (const k of keys) {
    let ident = toCamelIdentifier(k);
    while (usedIdents.has(ident)) {
      ident = `${ident}Alt`;
    }
    usedIdents.add(ident);
    identForKey[k] = ident;
  }

  const constLines = keys.map((k) => {
    const { d, vb } = entriesMap[k];
    const svg = formatSvgMarkup(d, vb);
    return `  static const String ${identForKey[k]} =\n      '${svg}';`;
  });

  const mapLines = keys.map((k) => `    '${k}': ${identForKey[k]},`);

  return `// Pictogrammers MDI Icon Registry (Zero-Dependency Vendored Subset)
// Generated & maintained by steven-pictogrammers-icon-lib.
// License: Pictogrammers Free License (Apache-2.0 icons / MIT code).

class PictogrammersIcons {
  PictogrammersIcons._();

  // @pictogrammers-icons:start
${constLines.join('\n\n')}

  static const Map<String, String> byName = {
${mapLines.join('\n')}
  };
  // @pictogrammers-icons:end

  static String? get(String name) => byName[name];
}
`;
}

function writeTargetMapFile(targetPath, format, entriesMap) {
  if (format === 'react-map') {
    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const startMarker = '// @pictogrammers-icons:start';
      const endMarker = '// @pictogrammers-icons:end';
      const sIdx = existing.indexOf(startMarker);
      const eIdx = existing.indexOf(endMarker);
      if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
        const freshFull = renderReactMapFile(entriesMap);
        const fsIdx = freshFull.indexOf(startMarker);
        const feIdx = freshFull.indexOf(endMarker);
        const updatedBlock = freshFull.slice(fsIdx, feIdx + endMarker.length);
        const merged =
          existing.slice(0, sIdx) + updatedBlock + existing.slice(eIdx + endMarker.length);
        writeTextAtomic(targetPath, merged);
        return;
      }
    }
    writeTextAtomic(targetPath, renderReactMapFile(entriesMap));
    return;
  }

  if (format === 'vue') {
    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const startMarker = '// @pictogrammers-icons:start';
      const endMarker = '// @pictogrammers-icons:end';
      const sIdx = existing.indexOf(startMarker);
      const eIdx = existing.indexOf(endMarker);
      if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
        const freshFull = renderVueMapFile(entriesMap);
        const fsIdx = freshFull.indexOf(startMarker);
        const feIdx = freshFull.indexOf(endMarker);
        const updatedBlock = freshFull.slice(fsIdx, feIdx + endMarker.length);
        const merged =
          existing.slice(0, sIdx) + updatedBlock + existing.slice(eIdx + endMarker.length);
        writeTextAtomic(targetPath, merged);
        return;
      }
    }
    writeTextAtomic(targetPath, renderVueMapFile(entriesMap));
    return;
  }

  if (format === 'sprite') {
    writeTextAtomic(targetPath, renderSpriteFile(entriesMap));
    return;
  }

  if (format === 'flutter') {
    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const startMarker = '// @pictogrammers-icons:start';
      const endMarker = '// @pictogrammers-icons:end';
      const sIdx = existing.indexOf(startMarker);
      const eIdx = existing.indexOf(endMarker);
      if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
        const freshFull = renderFlutterFile(entriesMap);
        const fsIdx = freshFull.indexOf(startMarker);
        const feIdx = freshFull.indexOf(endMarker);
        const updatedBlock = freshFull.slice(fsIdx, feIdx + endMarker.length);
        const merged =
          existing.slice(0, sIdx) + updatedBlock + existing.slice(eIdx + endMarker.length);
        writeTextAtomic(targetPath, merged);
        return;
      }
    }
    writeTextAtomic(targetPath, renderFlutterFile(entriesMap));
    return;
  }

  throw new Error(`Unsupported target format: ${format}`);
}

function detectTargetFormat(targetPath, explicitFormat) {
  if (explicitFormat) return explicitFormat;
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) return 'svg';
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === '.svg') return 'sprite';
  if (ext === '.dart') return 'flutter';
  if (ext === '.tsx' || ext === '.jsx') return 'react-map';
  if (ext === '.ts' || ext === '.js') {
    if (fs.existsSync(targetPath)) {
      const body = fs.readFileSync(targetPath, 'utf8');
      if (body.includes('getMdiIconPaths')) return 'vue';
    }
    return 'react-map';
  }
  return 'svg';
}

function loadTargetEntries(targetPath, format) {
  if (format === 'svg') {
    const map = {};
    if (!fs.existsSync(targetPath)) return map;
    for (const file of fs.readdirSync(targetPath)) {
      if (!file.endsWith('.svg')) continue;
      const body = fs.readFileSync(path.join(targetPath, file), 'utf8');
      const dataIconMatch = body.match(/\bdata-icon="([^"]+)"/i);
      const key = dataIconMatch
        ? dataIconMatch[1]
        : file.replace(/\.svg$/i, '').replace(/--/g, ':');
      const parsed = parseSvgData(body, '0 0 24 24');
      if (parsed) map[key] = { d: parsed.d, vb: parsed.viewBox };
    }
    return map;
  }

  if (!fs.existsSync(targetPath)) return {};
  const content = fs.readFileSync(targetPath, 'utf8');
  if (format === 'sprite') {
    return readMarkedBlockEntries(
      content,
      '<!-- @pictogrammers-icons:start -->',
      '<!-- @pictogrammers-icons:end -->',
      'sprite'
    );
  }
  if (format === 'flutter') {
    return readMarkedBlockEntries(
      content,
      '// @pictogrammers-icons:start',
      '// @pictogrammers-icons:end',
      'flutter'
    );
  }
  return readMarkedBlockEntries(
    content,
    '// @pictogrammers-icons:start',
    '// @pictogrammers-icons:end',
    'ts-map'
  );
}

function cmdAdd(positionals, flags) {
  if (positionals.length === 0) {
    throw new Error(
      'Usage: add <icon1> [icon2 ...] --format <react-map|svg|sprite|vue|flutter> --out <path> [--pack mdi]'
    );
  }
  const format = flags.format || 'react-map';
  const defaultOutByFormat = {
    'react-map': 'src/components/ui/mdi-icons.tsx',
    vue: 'src/components/ui/mdi-icons.ts',
    svg: 'public/icons',
    sprite: 'public/icons/mdi-sprite.svg',
    flutter: 'lib/core/icons/mdi_icons.dart',
  };
  if (!defaultOutByFormat[format]) {
    throw new Error(
      `Invalid --format "${format}". Supported: ${Object.keys(defaultOutByFormat).join(', ')}`
    );
  }

  const outPath = path.resolve(flags.out || defaultOutByFormat[format]);
  const defaultPack = flags.pack || 'mdi';
  const vaultDir = resolveVaultDir(flags.dir);
  const { vault } = loadVault(vaultDir);

  const resolvedIcons = [];
  const missing = [];
  const deprecatedWarnings = [];

  for (const spec of positionals) {
    const res = resolveIconFromVault(vault, spec, defaultPack);
    if (!res) {
      missing.push(spec);
      continue;
    }
    if (res.icon.dep) {
      const packData = vault.packs[res.packId];
      const alts = findReplacementsForDeprecated(packData, res.name, res.icon);
      deprecatedWarnings.push({ id: res.canonicalId, alternatives: alts });
    }
    resolvedIcons.push(res);
  }

  if (missing.length > 0) {
    throw new Error(
      `Icon(s) not found in vault: ${missing.join(', ')}. Use "search" to find exact icon names.`
    );
  }

  if (format === 'svg') {
    fs.mkdirSync(outPath, { recursive: true });
    for (const r of resolvedIcons) {
      const filename = `${toSafeFileStem(r.canonicalId)}.svg`;
      const svg = formatSvgMarkup(r.icon.d, r.viewBox, `data-icon="${r.canonicalId}"`) + '\n';
      writeTextAtomic(path.join(outPath, filename), svg);
    }
    console.log(`[add] Exported ${resolvedIcons.length} SVG file(s) to ${outPath}`);
  } else {
    const existing = loadTargetEntries(outPath, format);
    for (const r of resolvedIcons) {
      existing[r.canonicalId] = { d: r.icon.d, vb: r.viewBox };
    }
    writeTargetMapFile(outPath, format, existing);
    console.log(
      `[add] Added/updated ${resolvedIcons.length} icon(s) in ${outPath} (total in registry: ${Object.keys(existing).length})`
    );
  }

  for (const w of deprecatedWarnings) {
    const altMsg = w.alternatives.length ? ` Suggested: ${w.alternatives.join(', ')}` : '';
    console.warn(`[WARNING] "${w.id}" is marked DEPRECATED in Pictogrammers.${altMsg}`);
  }
}

function cmdRemove(positionals, flags) {
  if (positionals.length === 0 || !flags.target) {
    throw new Error('Usage: remove <icon1> [icon2 ...] --target <file-or-svg-dir>');
  }
  const targetPath = path.resolve(flags.target);
  const format = detectTargetFormat(targetPath, flags.format);

  if (format === 'svg') {
    let removedCount = 0;
    for (const spec of positionals) {
      const parsed = parseIconSpec(spec, flags.pack || 'mdi');
      const candidates = [
        path.join(targetPath, `${toSafeFileStem(parsed.canonicalId)}.svg`),
        path.join(targetPath, `${parsed.name}.svg`),
      ];
      for (const fp of candidates) {
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
          removedCount += 1;
          break;
        }
      }
    }
    console.log(`[remove] Removed ${removedCount} SVG file(s) from ${targetPath}`);
    return;
  }

  const entries = loadTargetEntries(targetPath, format);
  let removed = 0;
  for (const spec of positionals) {
    const parsed = parseIconSpec(spec, flags.pack || 'mdi');
    if (entries[parsed.canonicalId]) {
      delete entries[parsed.canonicalId];
      removed += 1;
    } else if (entries[spec]) {
      delete entries[spec];
      removed += 1;
    }
  }
  writeTargetMapFile(targetPath, format, entries);
  console.log(
    `[remove] Removed ${removed} icon(s) from ${targetPath} (remaining: ${Object.keys(entries).length})`
  );
}

function collectSourceFiles(srcDir, ignoreAbsPath) {
  const allowedExts = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.vue',
    '.astro',
    '.svelte',
    '.html',
    '.dart',
    '.css',
    '.scss',
  ]);
  const skipDirs = new Set([
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    '.astro',
    'dist',
    'build',
    'out',
    '.dart_tool',
    'coverage',
  ]);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (full === ignoreAbsPath) continue;
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(full);
      } else if (entry.isFile() && allowedExts.has(path.extname(entry.name).toLowerCase())) {
        files.push(full);
      }
    }
  }
  walk(srcDir);
  return files;
}

function cmdAudit(flags) {
  if (!flags.target) {
    throw new Error(
      'Usage: audit --target <file-or-svg-dir> [--src <source-dir>] [--refresh-paths] [--prune]'
    );
  }
  const targetPath = path.resolve(flags.target);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target does not exist: ${targetPath}`);
  }

  const format = detectTargetFormat(targetPath, flags.format);
  const entries = loadTargetEntries(targetPath, format);
  const totalInspected = Object.keys(entries).length;
  const vaultDir = resolveVaultDir(flags.dir);
  const { vault } = loadVault(vaultDir);

  const deprecated = [];
  const pathChanged = [];
  const missingInVault = [];
  const unused = [];

  for (const [key, localEntry] of Object.entries(entries)) {
    const resolved = resolveIconFromVault(vault, key, 'mdi');
    if (!resolved) {
      missingInVault.push(key);
      continue;
    }
    if (resolved.icon.dep) {
      const alts = findReplacementsForDeprecated(
        vault.packs[resolved.packId],
        resolved.name,
        resolved.icon
      );
      deprecated.push({ id: key, suggestedReplacements: alts });
    }
    if (!samePathData(localEntry.d, resolved.icon.d) || localEntry.vb !== resolved.viewBox) {
      pathChanged.push({
        id: key,
        newEntry: { d: resolved.icon.d, vb: resolved.viewBox },
      });
    }
  }

  if (flags.src) {
    const srcDir = path.resolve(flags.src);
    if (!fs.existsSync(srcDir)) {
      throw new Error(`--src directory does not exist: ${srcDir}`);
    }
    const sourceFiles = collectSourceFiles(srcDir, targetPath);
    const corpus = sourceFiles.map((fp) => fs.readFileSync(fp, 'utf8')).join('\n');

    for (const key of Object.keys(entries)) {
      const safeStem = toSafeFileStem(key);
      const camel = toCamelIdentifier(key);
      const patterns = [
        `'${key}'`,
        `"${key}"`,
        `\`${key}\``,
        `#icon-${safeStem}`,
        `${safeStem}.svg`,
        `PictogrammersIcons.${camel}`,
      ];
      if (format === 'svg' && !key.includes(':')) {
        patterns.push(`${key}.svg`);
      }
      const isUsed = patterns.some((p) => corpus.includes(p));
      if (!isUsed) unused.push(key);
    }
  }

  let mutated = false;
  if (flags['refresh-paths'] && pathChanged.length > 0) {
    for (const ch of pathChanged) {
      entries[ch.id] = ch.newEntry;
    }
    mutated = true;
  }

  if (flags.prune) {
    if (!flags.src) {
      throw new Error('--prune requires --src <source-dir> so usage can be verified safely.');
    }
    for (const u of unused) {
      if (format === 'svg') {
        const fp = path.join(targetPath, `${toSafeFileStem(u)}.svg`);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } else {
        delete entries[u];
      }
    }
    if (unused.length > 0) mutated = true;
  }

  if (mutated) {
    if (format === 'svg') {
      for (const ch of pathChanged) {
        if (!unused.includes(ch.id)) {
          const filename = `${toSafeFileStem(ch.id)}.svg`;
          const svg = formatSvgMarkup(ch.newEntry.d, ch.newEntry.vb, `data-icon="${ch.id}"`) + '\n';
          writeTextAtomic(path.join(targetPath, filename), svg);
        }
      }
    } else {
      writeTargetMapFile(targetPath, format, entries);
    }
  }

  const report = {
    target: targetPath,
    format,
    totalInspected,
    deprecated,
    pathChanged: pathChanged.map((p) => p.id),
    missingInVault,
    unused: flags.src ? unused : null,
    refreshedPaths: Boolean(flags['refresh-paths'] && pathChanged.length > 0),
    prunedCount: flags.prune ? unused.length : 0,
  };

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Audit Report (${format}): ${targetPath}`);
  console.log(`  Icons checked: ${report.totalInspected}`);
  console.log(`  Deprecated: ${deprecated.length}`);
  for (const d of deprecated) {
    console.log(`    ! ${d.id} -> suggested: ${d.suggestedReplacements.join(', ') || 'none'}`);
  }
  console.log(`  Outdated vector paths: ${pathChanged.length}${report.refreshedPaths ? ' (REFRESHED)' : ''}`);
  console.log(`  Missing in local vault: ${missingInVault.length}`);
  if (flags.src) {
    console.log(`  Unused in ${flags.src}: ${unused.length}${flags.prune ? ' (PRUNED)' : ''}`);
    if (unused.length > 0) console.log(`    - ${unused.join(', ')}`);
  }
}

function printHelp() {
  console.log(`Pictogrammers Local Icon Vault CLI (Zero-Dependency)

Commands:
  status [--check-remote] [--json]
      Check local vault path, OS, installed packs, and optionally upstream npm versions.

  setup [--dir <path>] [--packs mdi,mdi-light,memory] [--raw-svgs] [--extract-font] [--force]
      Download & verify SHA-512 from registry.npmjs.org and build compact pictovault.json.

  update [--packs mdi,mdi-light,memory] [--check-only] [--force] [--json]
      Check/update packs from registry.npmjs.org and write last-update-diff.json.

  search "<query1|query2>" [--pack mdi|mdi-light|memory|all] [--style outline|filled|all] [--tag <tag>] [--exclude-deprecated] [--limit 20] [--json]
      Bilingual (ES->EN) search across local Pictogrammers icons.

  inspect <icon-name|pack:icon-name> [--pack mdi] [--json]
      Show viewBox, codepoint, aliases, tags, sibling variants, and active alternatives if deprecated.

  add <icon1> [icon2 ...] --format <react-map|svg|sprite|vue|flutter> --out <path> [--pack mdi]
      Extract only selected icons into the target project (incremental & zero npm dependencies).

  remove <icon1> [icon2 ...] --target <file-or-svg-dir> [--pack mdi]
      Remove selected icons from the project's extracted registry or SVG folder.

  audit --target <file-or-svg-dir> [--src <source-dir>] [--refresh-paths] [--prune] [--json]
      Audit project icons for deprecations, vector path updates, and unused entries.
`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positionals, flags } = parseCliArgs(rest);

  switch (cmd) {
    case 'status':
      await cmdStatus(flags);
      break;
    case 'setup':
      await cmdSetup(flags);
      break;
    case 'update':
      await cmdUpdate(flags);
      break;
    case 'search':
      cmdSearch(positionals, flags);
      break;
    case 'inspect':
      cmdInspect(positionals, flags);
      break;
    case 'add':
      cmdAdd(positionals, flags);
      break;
    case 'remove':
      cmdRemove(positionals, flags);
      break;
    case 'audit':
      cmdAudit(flags);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[ERROR] ${err.message}`);
  process.exitCode = 1;
});
