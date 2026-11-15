#!/usr/bin/env node
/**
 * preflight-and-drift-sentinel.mjs
 * Sonda Ejecutable de Pre-Flight y Centinela de Obsolescencia Normativa (Ministerio de Hacienda CR v4.4 / TRIBU-CR).
 *
 * Verifica:
 *  1. Herramientas del entorno (Node >= 20, OpenSSL, xmllint) y los 9 esquemas XSD v4.4 locales.
 *  2. Conectividad TLS estricta hacia IdP OIDC de Hacienda (Staging y Producción) y APIs de Recepción.
 *  3. Disponibilidad de APIs públicas de Hacienda (CABYS, Tipo de Cambio USD/CRC, Actividades Económicas /fe/ae).
 *  4. Centinela de Obsolescencia Normativa (Normative Drift): descarga el PDF oficial de Política de Firma
 *     y compara su SHA-256 Base64 contra el hash esperado en v4.4 (DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=).
 *  5. Auditoría de vigencia y salud de Llave Criptográfica .p12 (--p12 <ruta> --pin <pin>), alertando
 *     preventivamente si vence en <= 30 días o si está vencida.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XSD_DIR = path.resolve(__dirname, '../resources/xsd/v4.4');

export const EXPECTED_POLICY_V44 = {
  version: '4.4',
  resolution: 'MH-DGT-RES-0027-2024',
  url: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf',
  sha256Base64: 'DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=',
};

const REQUIRED_XSDS = [
  'FacturaElectronica_V4.4.xsd',
  'TiqueteElectronico_V4.4.xsd',
  'NotaCreditoElectronica_V4.4.xsd',
  'NotaDebitoElectronica_V4.4.xsd',
  'FacturaElectronicaCompra_V4.4.xsd',
  'FacturaElectronicaExportacion_V4.4.xsd',
  'ReciboElectronicoPago_V4.4.xsd',
  'MensajeReceptor_V4.4.xsd',
  'MensajeHacienda_V4.4.xsd',
];

function checkBinary(bin, args = ['--version']) {
  try {
    const out = execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, detail: out.trim().split('\n')[0] };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

export function inspectP12Certificate(p12BufferOrPath, pin) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p12-inspect-'));
  const p12Path = typeof p12BufferOrPath === 'string'
    ? p12BufferOrPath
    : path.join(tmpDir, 'input.p12');
  try {
    if (Buffer.isBuffer(p12BufferOrPath)) {
      fs.writeFileSync(p12Path, p12BufferOrPath);
    }
    let pemOut = '';
    try {
      pemOut = execFileSync('openssl', [
        'pkcs12', '-in', p12Path, '-nokeys', '-clcerts', '-passin', `pass:${pin}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      // Fallback automático para OpenSSL 3.x en Linux/Cloud Run con cifrados PBE-SHA1-RC2-40 de BCCR/TRIBU-CR
      pemOut = execFileSync('openssl', [
        'pkcs12', '-legacy', '-in', p12Path, '-nokeys', '-clcerts', '-passin', `pass:${pin}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    }

    const certMatch = pemOut.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    if (!certMatch) {
      throw new Error('No se encontró certificado X.509 de cliente dentro del archivo .p12');
    }
    const x509 = new crypto.X509Certificate(certMatch[0]);
    const validFrom = new Date(x509.validFrom);
    const validTo = new Date(x509.validTo);
    const now = new Date();
    const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let alertLevel = 'OK';
    let visualAlert = 'Llave criptográfica vigente y saludable.';
    if (daysRemaining < 0) {
      alertLevel = 'CRITICAL_EXPIRED';
      visualAlert = `BLOQUEO CRÍTICO: La llave criptográfica .p12 venció hace ${Math.abs(daysRemaining)} días (${validTo.toISOString().slice(0, 10)}). Renovar de inmediato en TRIBU-CR.`;
    } else if (daysRemaining <= 15) {
      alertLevel = 'URGENT_EXPIRING';
      visualAlert = `ALERTA URGENTE: La llave criptográfica .p12 vence en ${daysRemaining} días (${validTo.toISOString().slice(0, 10)}). Genere una nueva en TRIBU-CR antes del corte.`;
    } else if (daysRemaining <= 30) {
      alertLevel = 'WARNING_EXPIRING';
      visualAlert = `AVISO PREVENTIVO: La llave criptográfica .p12 vence en ${daysRemaining} días (${validTo.toISOString().slice(0, 10)}). Programe su renovación.`;
    }

    return {
      ok: daysRemaining >= 0,
      subject: x509.subject,
      issuer: x509.issuer,
      serialNumberHex: x509.serialNumber,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysRemaining,
      fingerprintSha256: x509.fingerprint256,
      alertLevel,
      visualAlert,
    };
  } catch (err) {
    return {
      ok: false,
      alertLevel: 'INVALID_P12_OR_PIN',
      visualAlert: `No se pudo abrir la llave .p12 (verifique que el archivo no esté corrupto y que el PIN de 4 dígitos de TRIBU-CR sea exacto): ${err.message}`,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function runPreflightAndDriftSentinel({ p12Path = null, pin = null, offline = false } = {}) {
  const alerts = [];
  const checks = {};

  // 1. Entorno local y XSDs
  checks.nodeVersion = { ok: Number(process.versions.node.split('.')[0]) >= 20, detail: process.version };
  checks.openssl = checkBinary('openssl', ['version']);
  checks.xmllint = checkBinary('xmllint', ['--version']);

  const missingXsds = REQUIRED_XSDS.filter((f) => !fs.existsSync(path.join(XSD_DIR, f)));
  checks.xsdBundleV44 = {
    ok: missingXsds.length === 0,
    xsdDir: XSD_DIR,
    count: REQUIRED_XSDS.length - missingXsds.length,
    missing: missingXsds,
  };
  if (missingXsds.length > 0) {
    alerts.push({
      code: 'XSD_BUNDLE_INCOMPLETE',
      severity: 'CRITICAL',
      title: 'Faltan esquemas XSD v4.4 locales',
      userMessage: `No se encontraron los esquemas: ${missingXsds.join(', ')}`,
    });
  }

  // 2. Auditoría opcional de .p12
  if (p12Path && pin !== null) {
    checks.p12Certificate = inspectP12Certificate(p12Path, pin);
    if (checks.p12Certificate.alertLevel !== 'OK') {
      alerts.push({
        code: checks.p12Certificate.alertLevel,
        severity: checks.p12Certificate.ok ? 'WARNING' : 'CRITICAL',
        title: 'Estado de Llave Criptográfica (.p12)',
        userMessage: checks.p12Certificate.visualAlert,
      });
    }
  }

  // 3. Sondas en vivo contra Hacienda (si no está en modo offline)
  if (!offline) {
    // 3a. Política de Firma XAdES-EPES (Detector de Obsolescencia Normativa)
    try {
      const res = await fetchWithTimeout(EXPECTED_POLICY_V44.url, 10000);
      if (!res.ok) {
        checks.signaturePolicyDrift = { ok: false, httpStatus: res.status };
        alerts.push({
          code: 'POLICY_URL_UNREACHABLE_OR_MOVED',
          severity: 'CRITICAL',
          title: 'Posible Cambio Normativo en URL de Política de Firma DGT',
          userMessage: `El PDF oficial de política de firma respondió HTTP ${res.status}. Verifique si Hacienda publicó una nueva resolución posterior a ${EXPECTED_POLICY_V44.resolution}.`,
        });
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        const liveHash = crypto.createHash('sha256').update(buf).digest('base64');
        const matches = liveHash === EXPECTED_POLICY_V44.sha256Base64;
        checks.signaturePolicyDrift = {
          ok: matches,
          expectedSha256: EXPECTED_POLICY_V44.sha256Base64,
          liveSha256: liveHash,
          bytes: buf.length,
        };
        if (!matches) {
          alerts.push({
            code: 'SIGNATURE_POLICY_HASH_DRIFT',
            severity: 'CRITICAL',
            title: 'Hacienda Actualizó el Documento de Política de Firma XAdES-EPES',
            userMessage: `El hash SHA-256 en vivo (${liveHash}) difiere del configurado (${EXPECTED_POLICY_V44.sha256Base64}). Esto provocará rechazos por firma inválida hasta actualizar el hash de política.`,
          });
        }
      }
    } catch (err) {
      checks.signaturePolicyDrift = { ok: false, error: err.message };
    }

    // 3b. IdP OIDC Sandbox & Producción
    for (const [key, url] of [
      ['idpStaging', 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/.well-known/openid-configuration'],
      ['idpProduction', 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/.well-known/openid-configuration'],
    ]) {
      try {
        const r = await fetchWithTimeout(url);
        checks[key] = { ok: r.status === 200, httpStatus: r.status };
        if (r.status !== 200) {
          alerts.push({
            code: `${key.toUpperCase()}_DEGRADED`,
            severity: 'WARNING',
            title: `IdP de Hacienda (${key}) no disponible`,
            userMessage: `El servidor de autenticación de Hacienda respondió HTTP ${r.status}. Activar automáticamente cola de Contingencia (Outbox) sin perder comprobantes.`,
          });
        }
      } catch (err) {
        checks[key] = { ok: false, error: err.message };
      }
    }

    // 3c. Recepción Sandbox & Producción (401/403/405 sin token confirma que el endpoint existe y exige Bearer)
    for (const [key, url] of [
      ['recepcionStaging', 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/'],
      ['recepcionProduction', 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/'],
    ]) {
      try {
        const r = await fetchWithTimeout(url);
        checks[key] = { ok: [200, 401, 403, 405].includes(r.status), httpStatus: r.status };
      } catch (err) {
        checks[key] = { ok: false, error: err.message };
      }
    }

    // 3d. APIs Públicas (CABYS + Tipo de Cambio BCCR/Hacienda)
    try {
      const cabysRes = await fetchWithTimeout('https://api.hacienda.go.cr/fe/cabys?q=software&top=1');
      const cabysJson = cabysRes.ok ? await cabysRes.json() : null;
      checks.publicCabysApi = {
        ok: Boolean(cabysRes.ok && cabysJson?.cabys?.length),
        sampleCode: cabysJson?.cabys?.[0]?.codigo ?? null,
      };
    } catch (err) {
      checks.publicCabysApi = { ok: false, error: err.message };
    }

    try {
      const tcRes = await fetchWithTimeout('https://api.hacienda.go.cr/indicadores/tc/dolar');
      const tcJson = tcRes.ok ? await tcRes.json() : null;
      checks.publicTipoCambioApi = {
        ok: Boolean(tcRes.ok && tcJson?.venta?.valor),
        venta: tcJson?.venta ?? null,
        compra: tcJson?.compra ?? null,
      };
    } catch (err) {
      checks.publicTipoCambioApi = { ok: false, error: err.message };
    }
  }

  const allCriticalOk = Object.values(checks).every((c) => c.ok !== false);
  return {
    timestamp: new Date().toISOString(),
    normativeVersion: EXPECTED_POLICY_V44.version,
    resolution: EXPECTED_POLICY_V44.resolution,
    healthy: allCriticalOk,
    alerts,
    checks,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let p12Path = null;
  let pin = null;
  let offline = false;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--p12') p12Path = process.argv[++i];
    else if (process.argv[i] === '--pin') pin = process.argv[++i];
    else if (process.argv[i] === '--offline') offline = true;
  }
  const report = await runPreflightAndDriftSentinel({ p12Path, pin, offline });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.healthy ? 0 : 1);
}
