#!/usr/bin/env node
/**
 * sign-and-validate-v44.mjs
 * Motor Criptográfico y Validador Nativo Hacienda Costa Rica v4.4 (Cero PHP, Cero AGPL).
 * Modularizado en 3 archivos (<500 líneas):
 *  - hacienda-math-and-clave-v44.mjs
 *  - hacienda-xml-builder-v44.mjs
 *  - sign-and-validate-v44.mjs (firma XAdES-EPES + validación XSD v4.4 + auto-test CLI 10/10)
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_XSD_DIR,
  DOC_TYPES_V44,
  POLICY_V44,
  escXml,
  generateClaveAndConsecutivo,
} from './hacienda-math-and-clave-v44.mjs';
import { buildComprobanteXmlV44 } from './hacienda-xml-builder-v44.mjs';

export * from './hacienda-math-and-clave-v44.mjs';
export * from './hacienda-xml-builder-v44.mjs';

function hexToDecimalString(hexStr) {
  const clean = hexStr.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
  return BigInt('0x' + (clean || '0')).toString(10);
}

function c14nInclusive(xmlFragment) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c14n-'));
  const inFile = path.join(tmpDir, 'in.xml');
  try {
    fs.writeFileSync(inFile, xmlFragment, 'utf8');
    return execFileSync('xmllint', ['--c14n', inFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function sha256Base64(bufOrStr) {
  return crypto.createHash('sha256').update(bufOrStr).digest('base64');
}

export function extractKeyPairFromP12(p12BufferOrPath, pin) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p12-extract-'));
  const p12Path = typeof p12BufferOrPath === 'string'
    ? p12BufferOrPath
    : path.join(tmpDir, 'cert.p12');
  try {
    if (Buffer.isBuffer(p12BufferOrPath)) {
      fs.writeFileSync(p12Path, p12BufferOrPath);
    }
    const runOssl = (extraArgs) =>
      execFileSync('openssl', ['pkcs12', ...extraArgs, '-in', p12Path, '-nodes', '-passin', `pass:${pin}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

    let bundle = '';
    try {
      bundle = runOssl([]);
    } catch {
      bundle = runOssl(['-legacy']);
    }

    const certMatches = bundle.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
    const keyMatch = bundle.match(/-----BEGIN (?:PRIVATE|RSA PRIVATE) KEY-----[\s\S]+?-----END (?:PRIVATE|RSA PRIVATE) KEY-----/);
    if (!certMatches.length || !keyMatch) {
      throw new Error('El archivo .p12 no contiene par de llave privada + certificado X.509');
    }

    const privKey = crypto.createPrivateKey(keyMatch[0]);
    const pubFromPrivPem = crypto.createPublicKey(privKey).export({ type: 'spki', format: 'pem' });
    let leafPem = certMatches[0];
    for (const candidate of certMatches) {
      const c = new crypto.X509Certificate(candidate);
      if (c.publicKey.export({ type: 'spki', format: 'pem' }) === pubFromPrivPem) {
        leafPem = candidate;
        break;
      }
    }

    const x509 = new crypto.X509Certificate(leafPem);
    const jwk = x509.publicKey.export({ format: 'jwk' });
    const modulusB64 = Buffer.from(jwk.n, 'base64url').toString('base64');
    const exponentB64 = Buffer.from(jwk.e, 'base64url').toString('base64');
    const certDerDigestB64 = crypto.createHash('sha256').update(x509.raw).digest('base64');
    const certCleanB64 = leafPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    const issuerLines = x509.issuer.split('\n').filter(Boolean).reverse().join(', ');
    const serialDecimal = hexToDecimalString(x509.serialNumber);

    return {
      privateKey: privKey,
      x509,
      certCleanB64,
      certDerDigestB64,
      modulusB64,
      exponentB64,
      issuerRfc2253: issuerLines,
      serialDecimal,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function signXmlXadesEpesV44({ unsignedXml, p12BufferOrPath, pin, signingTimeIso = null }) {
  const kp = extractKeyPairFromP12(p12BufferOrPath, pin);

  const rootMatch = unsignedXml.match(/<([A-Za-z0-9_]+)\s+[^>]*xmlns="([^"]+)"/);
  if (!rootMatch) throw new Error('XML de entrada no posee nodo raíz con atributo xmlns v4.4');
  const [, rootTag, rootNs] = rootMatch;

  const uid = crypto.randomUUID();
  const signatureId = `Signature-${uid}`;
  const signatureValueId = `SignatureValue-${uid}`;
  const keyInfoId = `KeyInfoId-${signatureId}`;
  const xadesObjectId = `XadesObjectId-${crypto.randomUUID()}`;
  const qualifyingPropsId = `QualifyingProperties-${crypto.randomUUID()}`;
  const reference0Id = `Reference-${crypto.randomUUID()}`;
  const reference1Id = `ReferenceKeyInfo-${uid}`;
  const signedPropsId = `SignedProperties-${signatureId}`;

  const nowCr = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const signTime = signingTimeIso || `${nowCr.toISOString().slice(0, 19)}-06:00`;

  const docC14n = c14nInclusive(unsignedXml);
  const docDigestB64 = sha256Base64(docC14n);

  const signedPropsInner =
    `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signTime}</xades:SigningTime>` +
      `<xades:SigningCertificate>` +
        `<xades:Cert>` +
          `<xades:CertDigest>` +
            `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
            `<ds:DigestValue>${kp.certDerDigestB64}</ds:DigestValue>` +
          `</xades:CertDigest>` +
          `<xades:IssuerSerial>` +
            `<ds:X509IssuerName>${escXml(kp.issuerRfc2253)}</ds:X509IssuerName>` +
            `<ds:X509SerialNumber>${kp.serialDecimal}</ds:X509SerialNumber>` +
          `</xades:IssuerSerial>` +
        `</xades:Cert>` +
      `</xades:SigningCertificate>` +
      `<xades:SignaturePolicyIdentifier>` +
        `<xades:SignaturePolicyId>` +
          `<xades:SigPolicyId>` +
            `<xades:Identifier>${POLICY_V44.url}</xades:Identifier>` +
            `<xades:Description></xades:Description>` +
          `</xades:SigPolicyId>` +
          `<xades:SigPolicyHash>` +
            `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
            `<ds:DigestValue>${POLICY_V44.digestBase64}</ds:DigestValue>` +
          `</xades:SigPolicyHash>` +
        `</xades:SignaturePolicyId>` +
      `</xades:SignaturePolicyIdentifier>` +
      `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>Emisor</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
    `</xades:SignedSignatureProperties>` +
    `<xades:SignedDataObjectProperties>` +
      `<xades:DataObjectFormat ObjectReference="#${reference0Id}">` +
        `<xades:MimeType>text/xml</xades:MimeType>` +
        `<xades:Encoding>UTF-8</xades:Encoding>` +
      `</xades:DataObjectFormat>` +
    `</xades:SignedDataObjectProperties>`;

  const signedPropsForHash =
    `<xades:SignedProperties xmlns="${rootNs}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="${signedPropsId}">` +
    signedPropsInner +
    `</xades:SignedProperties>`;
  const signedPropsDigestB64 = sha256Base64(c14nInclusive(signedPropsForHash));

  const keyInfoInner =
    `<ds:X509Data><ds:X509Certificate>${kp.certCleanB64}</ds:X509Certificate></ds:X509Data>` +
    `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${kp.modulusB64}</ds:Modulus><ds:Exponent>${kp.exponentB64}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>`;

  const keyInfoForHash =
    `<ds:KeyInfo xmlns="${rootNs}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="${keyInfoId}">` +
    keyInfoInner +
    `</ds:KeyInfo>`;
  const keyInfoDigestB64 = sha256Base64(c14nInclusive(keyInfoForHash));

  const signedInfoInner =
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>` +
    `<ds:Reference Id="${reference0Id}" URI="">` +
      `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
      `<ds:DigestValue>${docDigestB64}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference Id="${reference1Id}" URI="#${keyInfoId}">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
      `<ds:DigestValue>${keyInfoDigestB64}</ds:DigestValue>` +
    `</ds:Reference>` +
    `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropsId}">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod>` +
      `<ds:DigestValue>${signedPropsDigestB64}</ds:DigestValue>` +
    `</ds:Reference>`;

  const signedInfoForSign =
    `<ds:SignedInfo xmlns="${rootNs}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    signedInfoInner +
    `</ds:SignedInfo>`;
  const signedInfoC14n = c14nInclusive(signedInfoForSign);
  const signatureBytes = crypto.sign('sha256', signedInfoC14n, kp.privateKey);
  const signatureValueB64 = signatureBytes.toString('base64');

  const verified = crypto.verify('sha256', signedInfoC14n, kp.x509.publicKey, signatureBytes);
  if (!verified) {
    throw new Error('Fallo de integridad criptográfica interna al verificar firma RSA-SHA256');
  }

  const signatureBlock =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${signatureId}">` +
      `<ds:SignedInfo>${signedInfoInner}</ds:SignedInfo>` +
      `<ds:SignatureValue Id="${signatureValueId}">${signatureValueB64}</ds:SignatureValue>` +
      `<ds:KeyInfo Id="${keyInfoId}">${keyInfoInner}</ds:KeyInfo>` +
      `<ds:Object Id="${xadesObjectId}">` +
        `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${qualifyingPropsId}" Target="#${signatureId}">` +
          `<xades:SignedProperties Id="${signedPropsId}">${signedPropsInner}</xades:SignedProperties>` +
        `</xades:QualifyingProperties>` +
      `</ds:Object>` +
    `</ds:Signature>`;

  const closingTag = `</${rootTag}>`;
  const idx = unsignedXml.lastIndexOf(closingTag);
  if (idx === -1) throw new Error(`No se encontró etiqueta de cierre ${closingTag}`);

  const signedXml = unsignedXml.slice(0, idx) + signatureBlock + closingTag;
  const signedXmlBase64 = Buffer.from(signedXml, 'utf8').toString('base64');

  return {
    signedXml,
    signedXmlBase64,
    cryptoVerified: true,
    digests: {
      documentSha256: docDigestB64,
      keyInfoSha256: keyInfoDigestB64,
      signedPropertiesSha256: signedPropsDigestB64,
      policySha256: POLICY_V44.digestBase64,
    },
    signerSubject: kp.x509.subject,
    signerValidTo: kp.x509.validTo,
  };
}

export function validateXmlAgainstXsdV44(xmlString, tipoDoc = 'FE', xsdDir = DEFAULT_XSD_DIR) {
  if (/<!DOCTYPE|<!ENTITY/i.test(String(xmlString || ''))) {
    return {
      valid: false,
      schema: DOC_TYPES_V44[tipoDoc]?.xsd || 'unknown',
      errors: ['Seguridad XML: Se bloqueó declaración DOCTYPE/ENTITY (protección anti-XXE).'],
    };
  }
  const docDef = DOC_TYPES_V44[tipoDoc];
  if (!docDef) throw new Error(`Tipo de documento inválido para validación XSD: ${tipoDoc}`);
  const xsdPath = path.join(xsdDir, docDef.xsd);
  if (!fs.existsSync(xsdPath)) {
    throw new Error(`No existe el esquema XSD oficial en: ${xsdPath}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xsd-val-'));
  const xmlPath = path.join(tmpDir, 'comprobante.xml');
  try {
    fs.writeFileSync(xmlPath, xmlString, 'utf8');
    execFileSync('xmllint', ['--nonet', '--noout', '--schema', xsdPath, xmlPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { valid: true, schema: docDef.xsd, errors: [] };
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    const lines = stderr.split('\n').map((l) => l.trim()).filter(Boolean);
    return { valid: false, schema: docDef.xsd, errors: lines };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { generateLabP12 } = await import('./generate-lab-p12.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-v44-'));
  const p12Path = path.join(tmpDir, 'demo.p12');
  try {
    generateLabP12({ outPath: p12Path, pin: '1234', cedula: '3101888777', nombre: 'NOVA SISTEMAS COSTA RICA S.A.' });

    const results = {};
    for (const tipo of ['FE', 'ND', 'NC', 'TE', 'CCE', 'FEC', 'FEE', 'REP']) {
      const { clave, consecutivo, fechaEmision } = generateClaveAndConsecutivo({
        tipoDoc: tipo,
        cedulaEmisor: '3101888777',
        sucursal: '001',
        terminal: '00001',
        secuencia: 42,
      });

      const basePayload = {
        tipoDoc: tipo,
        clave,
        consecutivo,
        fechaEmision,
        proveedorSistemas: '3101888777',
        codigoActividadEmisor: '620101',
        codigoActividadReceptor: '620200',
        emisor: {
          nombre: 'NOVA SISTEMAS COSTA RICA SOCIEDAD ANONIMA',
          nombreComercial: 'Nova Sistemas CR',
          identificacionTipo: '02',
          identificacionNumero: '3101888777',
          ubicacion: { provincia: '1', canton: '01', distrito: '01', barrio: 'Barrio Carmen', otrasSenas: 'Avenida Central, 200m Este del Parque' },
          telefono: { codigoPais: '506', numero: '22223333' },
          correo: 'facturacion@novasistemas.cr',
        },
        receptor: tipo === 'FEE'
          ? {
              nombre: 'ACME GLOBAL HOLDINGS INC',
              identificacionTipo: '05',
              identificacionNumero: 'US998877665',
              otrasSenasExtranjero: '742 Evergreen Terrace, Austin, TX, USA',
              correo: 'ap@acmeglobal.example.com',
            }
          : {
              nombre: 'COMERCIALIZADORA DEL VALLE S.A.',
              identificacionTipo: '02',
              identificacionNumero: '3101555444',
              ubicacion: { provincia: '2', canton: '01', distrito: '01', otrasSenas: 'Costado Norte Plaza Real Alajuela' },
              telefono: { codigoPais: '506', numero: '88887777' },
              correo: 'compras@valle.cr',
            },
        condicionVenta: tipo === 'REP' ? '11' : '01',
        moneda: tipo === 'FEE' ? { codigo: 'USD', tipoCambio: '448.37000' } : { codigo: 'CRC', tipoCambio: '1.00000' },
        lineas: tipo === 'REP'
          ? [{ detalle: 'Abono factura crédito #10', montoTotal: '100000.00000', subTotal: '100000.00000', impuestos: [{ codigo: '01', codigoTarifaIVA: '08', tarifa: 13 }] }]
          : [
              {
                codigoCABYS: '4781200000000',
                codigosComerciales: [{ tipo: '01', codigo: 'SW-ERP-01' }],
                cantidad: 2,
                unidadMedida: 'Sp',
                detalle: 'Licencia empresarial ERP Contable Fiscal v4.4',
                precioUnitario: tipo === 'FEE' ? '300.00000' : '75000.00000',
                descuentos: tipo === 'FEE' ? [] : [{ monto: '10000.00000', codigo: '07', naturaleza: 'Descuento corporativo lanzamiento' }],
                impuestos: tipo === 'FEE'
                  ? [{ codigo: '01', codigoTarifaIVA: '10', tarifa: 0 }]
                  : [{ codigo: '01', codigoTarifaIVA: '08', tarifa: 13 }],
              },
            ],
        mediosPago: [{ tipo: tipo === 'FEE' ? '04' : '06' }],
        referencias: ['NC', 'ND', 'REP', 'FEC'].includes(tipo)
          ? [{
              tipoDoc: tipo === 'FEC' ? '14' : '01',
              numero: '50613112600310188877700100001010000000010187654321',
              fechaEmision: '2026-11-10T10:00:00-06:00',
              codigo: tipo === 'NC' ? '01' : (tipo === 'ND' ? '02' : '04'),
              razon: tipo === 'NC' ? 'Anula factura por ajuste comercial' : 'Referencia documental fiscal v4.4',
            }]
          : [],
        claveFacturaOriginal: '50613112600310155544400100001010000000099112345678',
        cedulaEmisorOriginal: '3101555444',
        cedulaReceptor: '3101888777',
        consecutivoReceptor: consecutivo,
        mensaje: '1',
        detalleMensaje: 'Factura de proveedor aceptada totalmente',
        montoTotalImpuesto: '18200.00000',
        codigoActividad: '620101',
        condicionImpuesto: '01',
        montoTotalImpuestoAcreditar: '18200.00000',
        montoTotalDeGastoAplicable: '140000.00000',
        totalFactura: '158200.00000',
      };

      const { xml, resumenMontos } = buildComprobanteXmlV44(basePayload);
      const signed = signXmlXadesEpesV44({ unsignedXml: xml, p12BufferOrPath: p12Path, pin: '1234' });
      const xsdCheck = validateXmlAgainstXsdV44(signed.signedXml, tipo);
      results[tipo] = {
        clave,
        consecutivo,
        cryptoVerified: signed.cryptoVerified,
        xsdValid: xsdCheck.valid,
        xsdSchema: xsdCheck.schema,
        xsdErrors: xsdCheck.errors,
        resumenMontos,
      };
    }

    const teAnonIds = generateClaveAndConsecutivo({ tipoDoc: 'TE', cedulaEmisor: '3101888777', secuencia: 43 });
    const teAnonXml = buildComprobanteXmlV44({
      tipoDoc: 'TE',
      ...teAnonIds,
      proveedorSistemas: '3101888777',
      codigoActividadEmisor: '620101',
      emisor: {
        nombre: 'NOVA SISTEMAS COSTA RICA SOCIEDAD ANONIMA',
        identificacionTipo: '02',
        identificacionNumero: '3101888777',
        ubicacion: { provincia: '1', canton: '01', distrito: '01', otrasSenas: 'Avenida Central San Jose' },
        correo: 'facturacion@novasistemas.cr',
      },
      receptor: null,
      condicionVenta: '01',
      lineas: [{ codigoCABYS: '4781200000000', cantidad: 1, unidadMedida: 'Sp', detalle: 'Venta mostrador POS consumidor final', precioUnitario: '10000.00000', impuestos: [{ codigo: '01', codigoTarifaIVA: '08', tarifa: 13 }] }],
      mediosPago: [{ tipo: '01' }],
    });
    const teAnonSigned = signXmlXadesEpesV44({ unsignedXml: teAnonXml.xml, p12BufferOrPath: p12Path, pin: '1234' });
    const teAnonXsd = validateXmlAgainstXsdV44(teAnonSigned.signedXml, 'TE');
    results.TE_ANONIMO_POS = { clave: teAnonIds.clave, cryptoVerified: teAnonSigned.cryptoVerified, xsdValid: teAnonXsd.valid, xsdErrors: teAnonXsd.errors };

    const mhBuilt = buildComprobanteXmlV44({
      tipoDoc: 'MH',
      clave: teAnonIds.clave,
      emisor: { nombre: 'NOVA SISTEMAS COSTA RICA SOCIEDAD ANONIMA', identificacionTipo: '02', identificacionNumero: '3101888777' },
      accepted: true,
      detalleMensaje: 'Comprobante aceptado por la DGT',
      montoTotalImpuesto: '1300.00000',
      totalFactura: '11300.00000',
    });
    const mhSigned = signXmlXadesEpesV44({ unsignedXml: mhBuilt.xml, p12BufferOrPath: p12Path, pin: '1234' });
    const mhXsd = validateXmlAgainstXsdV44(mhSigned.signedXml, 'MH');
    results.MH_WEBHOOK = { clave: teAnonIds.clave, cryptoVerified: mhSigned.cryptoVerified, xsdValid: mhXsd.valid, xsdErrors: mhXsd.errors };

    console.log(JSON.stringify(results, null, 2));
    const allPass = Object.values(results).every((r) => r.cryptoVerified && r.xsdValid);
    process.exit(allPass ? 0 : 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
