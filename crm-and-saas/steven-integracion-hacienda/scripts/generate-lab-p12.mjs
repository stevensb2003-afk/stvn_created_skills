#!/usr/bin/env node
/**
 * generate-lab-p12.mjs
 * Genera una Llave Criptográfica PKCS#12 (.p12) de Laboratorio (self-signed RSA-2048)
 * compatible con pruebas locales de firmado XAdES-EPES v4.4 sin consumir ni exponer
 * certificados reales de TRIBU-CR / BCCR.
 *
 * Uso:
 *   node generate-lab-p12.mjs [--out ./lab-emisor.p12] [--pin 1234] [--cedula 3101999999] [--nombre "EMPRESA DEMO CR S.A."]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    out: path.resolve(process.cwd(), 'lab-hacienda-cr.p12'),
    pin: '1234',
    cedula: '3101999999',
    nombre: 'EMPRESA DEMO LABORATORIO CR S.A.',
    days: '730',
  };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--out' && val) { args.out = path.resolve(process.cwd(), val); i++; }
    else if (key === '--pin' && val) { args.pin = val; i++; }
    else if (key === '--cedula' && val) { args.cedula = val; i++; }
    else if (key === '--nombre' && val) { args.nombre = val; i++; }
    else if (key === '--days' && val) { args.days = val; i++; }
  }
  return args;
}

export function generateLabP12({ outPath, pin = '1234', cedula = '3101999999', nombre = 'EMPRESA DEMO LABORATORIO CR S.A.', days = '730' }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hacienda-p12-'));
  const keyPath = path.join(tmpDir, 'key.pem');
  const certPath = path.join(tmpDir, 'cert.pem');
  try {
    const safeName = nombre.replace(/[/=+]/g, ' ').trim();
    const subj = `/C=CR/O=PERSONA JURIDICA/OU=CPJ-${cedula}/CN=${safeName}/serialNumber=CPJ-${cedula}`;
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-sha256',
      '-days', String(days), '-nodes',
      '-keyout', keyPath,
      '-out', certPath,
      '-subj', subj,
    ], { stdio: 'pipe' });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    execFileSync('openssl', [
      'pkcs12', '-export',
      '-out', outPath,
      '-inkey', keyPath,
      '-in', certPath,
      '-name', 'Llave Criptografica Laboratorio CR',
      '-passout', `pass:${pin}`,
    ], { stdio: 'pipe' });

    const stat = fs.statSync(outPath);
    return {
      ok: true,
      outPath,
      bytes: stat.size,
      pin,
      subject: subj,
      note: 'SOLO PARA PRUEBAS LOCALES XAdES-EPES / XSD v4.4. Para enviar al Sandbox real de Hacienda (api-stag), usa la Llave Criptográfica de Pruebas generada en TRIBU-CR.',
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  const res = generateLabP12({
    outPath: args.out,
    pin: args.pin,
    cedula: args.cedula,
    nombre: args.nombre,
    days: args.days,
  });
  console.log(JSON.stringify(res, null, 2));
}
