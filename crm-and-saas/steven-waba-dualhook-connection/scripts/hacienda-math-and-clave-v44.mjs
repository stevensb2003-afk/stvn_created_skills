/**
 * hacienda-math-and-clave-v44.mjs
 * Utilidades de precisión BigInt (5 decimales), catálogos DGT v4.4, Clave (50 dígitos),
 * NumeroConsecutivo (20 dígitos) y constructores XML para MensajeReceptor y MensajeHacienda.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_XSD_DIR = path.resolve(__dirname, '../resources/xsd/v4.4');

export const DOC_TYPES_V44 = {
  FE: { code: '01', root: 'FacturaElectronica', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica', xsd: 'FacturaElectronica_V4.4.xsd' },
  ND: { code: '02', root: 'NotaDebitoElectronica', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica', xsd: 'NotaDebitoElectronica_V4.4.xsd' },
  NC: { code: '03', root: 'NotaCreditoElectronica', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica', xsd: 'NotaCreditoElectronica_V4.4.xsd' },
  TE: { code: '04', root: 'TiqueteElectronico', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico', xsd: 'TiqueteElectronico_V4.4.xsd' },
  CCE: { code: '05', root: 'MensajeReceptor', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor', xsd: 'MensajeReceptor_V4.4.xsd' },
  CPCE: { code: '06', root: 'MensajeReceptor', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor', xsd: 'MensajeReceptor_V4.4.xsd' },
  RCE: { code: '07', root: 'MensajeReceptor', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor', xsd: 'MensajeReceptor_V4.4.xsd' },
  FEC: { code: '08', root: 'FacturaElectronicaCompra', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra', xsd: 'FacturaElectronicaCompra_V4.4.xsd' },
  FEE: { code: '09', root: 'FacturaElectronicaExportacion', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaExportacion', xsd: 'FacturaElectronicaExportacion_V4.4.xsd' },
  REP: { code: '10', root: 'ReciboElectronicoPago', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/reciboElectronicoPago', xsd: 'ReciboElectronicoPago_V4.4.xsd' },
  MH: { code: 'MH', root: 'MensajeHacienda', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeHacienda', xsd: 'MensajeHacienda_V4.4.xsd' },
};

export const POLICY_V44 = {
  url: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf',
  digestBase64: 'DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=',
};

// ============================================================================
// 1. Aritmética Fiscal Exacta (5 decimales = escala entera 100_000n)
// ============================================================================
export const SCALE = 100_000n;

export function toScaled(val) {
  if (typeof val === 'bigint') return val;
  const s = String(val ?? '0').trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Monto fiscal inválido: "${val}"`);
  const neg = s.startsWith('-');
  const [intPart, fracPart = ''] = (neg ? s.slice(1) : s).split('.');
  const padded = (fracPart + '000000').slice(0, 6);
  const fifth = BigInt(intPart) * SCALE + BigInt(padded.slice(0, 5));
  const sixthDigit = Number(padded[5]);
  const rounded = sixthDigit >= 5 ? fifth + 1n : fifth;
  return neg ? -rounded : rounded;
}

export function mulDecimal(a, b) {
  const sa = toScaled(a);
  const sb = toScaled(b);
  const prod = sa * sb;
  const half = SCALE / 2n;
  return prod >= 0n ? (prod + half) / SCALE : (prod - half) / SCALE;
}

export function fmt5(scaled) {
  const v = typeof scaled === 'bigint' ? scaled : toScaled(scaled);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const intPart = abs / SCALE;
  const fracPart = String(abs % SCALE).padStart(5, '0');
  return `${neg ? '-' : ''}${intPart}.${fracPart}`;
}

export function fmtQty3(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Cantidad inválida: ${val}`);
  return n.toFixed(3);
}

export function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// 2. Generador de Consecutivo (20 dígitos) y Clave (50 dígitos)
// ============================================================================
export function generateClaveAndConsecutivo({
  tipoDoc = 'FE',
  cedulaEmisor,
  sucursal = '001',
  terminal = '00001',
  secuencia = 1,
  situacion = '1', // '1'=Normal, '2'=Contingencia, '3'=Sin Internet
  codigoPais = '506',
  fecha = new Date(),
  codigoSeguridad = null,
}) {
  const docDef = DOC_TYPES_V44[tipoDoc];
  if (!docDef) throw new Error(`Tipo de documento no soportado: ${tipoDoc}`);

  const cleanCedula = String(cedulaEmisor).replace(/\D/g, '');
  if (cleanCedula.length < 9 || cleanCedula.length > 12) {
    throw new Error(`Cédula de emisor inválida para Clave numérica (9-12 dígitos): "${cedulaEmisor}"`);
  }
  const idPadded12 = cleanCedula.padStart(12, '0');
  const suc3 = String(sucursal).replace(/\D/g, '').padStart(3, '0');
  const term5 = String(terminal).replace(/\D/g, '').padStart(5, '0');
  const seq10 = String(secuencia).replace(/\D/g, '').padStart(10, '0');
  const sitMap = { normal: '1', '1': '1', contingencia: '2', '2': '2', sininternet: '3', '3': '3' };
  const sit1 = sitMap[String(situacion).toLowerCase()];
  if (!sit1) throw new Error(`Situación de comprobante inválida: ${situacion}`);

  const sec8 = codigoSeguridad
    ? String(codigoSeguridad).replace(/\D/g, '').padStart(8, '0').slice(0, 8)
    : String(crypto.randomInt(10_000_000, 99_999_999));

  // Fecha en zona horaria de Costa Rica (UTC-6 fijo todo el año, sin horario de verano)
  const crMs = fecha.getTime() - 6 * 60 * 60 * 1000;
  const crDate = new Date(crMs);
  const dd = String(crDate.getUTCDate()).padStart(2, '0');
  const mm = String(crDate.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(crDate.getUTCFullYear()).slice(-2);
  const isoCostaRica = `${crDate.getUTCFullYear()}-${mm}-${dd}T${String(crDate.getUTCHours()).padStart(2, '0')}:${String(crDate.getUTCMinutes()).padStart(2, '0')}:${String(crDate.getUTCSeconds()).padStart(2, '0')}-06:00`;

  const consecutivo = `${suc3}${term5}${docDef.code}${seq10}`; // 20 dígitos
  const clave = `${String(codigoPais).padStart(3, '0')}${dd}${mm}${yy}${idPadded12}${consecutivo}${sit1}${sec8}`; // 50 dígitos

  if (consecutivo.length !== 20 || clave.length !== 50) {
    throw new Error(`Error interno de longitud: consecutivo=${consecutivo.length}, clave=${clave.length}`);
  }
  return { clave, consecutivo, fechaEmision: isoCostaRica, tipoCodigo: docDef.code };
}

// ============================================================================
// 3. Mensajes Auxiliares v4.4 (MensajeReceptor 05-07 y MensajeHacienda MH)
// ============================================================================
export function buildMensajeReceptorXmlV44(payload, docDef = DOC_TYPES_V44[payload.tipoDoc || 'CCE']) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<MensajeReceptor xmlns="${docDef.ns}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<Clave>${escXml(payload.claveFacturaOriginal)}</Clave>` +
    `<NumeroCedulaEmisor>${escXml(String(payload.cedulaEmisorOriginal).replace(/\D/g, '').padStart(12, '0'))}</NumeroCedulaEmisor>` +
    `<FechaEmisionDoc>${escXml(payload.fechaEmision)}</FechaEmisionDoc>` +
    `<Mensaje>${escXml(payload.mensaje || '1')}</Mensaje>` +
    (payload.detalleMensaje ? `<DetalleMensaje>${escXml(payload.detalleMensaje)}</DetalleMensaje>` : '') +
    (payload.montoTotalImpuesto !== undefined ? `<MontoTotalImpuesto>${fmt5(payload.montoTotalImpuesto)}</MontoTotalImpuesto>` : '') +
    (payload.codigoActividad ? `<CodigoActividad>${escXml(String(payload.codigoActividad).padStart(6, '0'))}</CodigoActividad>` : '') +
    (payload.condicionImpuesto ? `<CondicionImpuesto>${escXml(payload.condicionImpuesto)}</CondicionImpuesto>` : '') +
    (payload.montoTotalImpuestoAcreditar !== undefined ? `<MontoTotalImpuestoAcreditar>${fmt5(payload.montoTotalImpuestoAcreditar)}</MontoTotalImpuestoAcreditar>` : '') +
    (payload.montoTotalDeGastoAplicable !== undefined ? `<MontoTotalDeGastoAplicable>${fmt5(payload.montoTotalDeGastoAplicable)}</MontoTotalDeGastoAplicable>` : '') +
    `<TotalFactura>${fmt5(payload.totalFactura)}</TotalFactura>` +
    `<NumeroCedulaReceptor>${escXml(String(payload.cedulaReceptor).replace(/\D/g, '').padStart(12, '0'))}</NumeroCedulaReceptor>` +
    `<NumeroConsecutivoReceptor>${escXml(payload.consecutivoReceptor)}</NumeroConsecutivoReceptor>` +
    `</MensajeReceptor>`;
  return { xml, resumenMontos: { totalComprobante: fmt5(payload.totalFactura) } };
}

export function buildMensajeHaciendaXmlV44(payload, docDef = DOC_TYPES_V44.MH) {
  const accepted = payload.accepted !== false && String(payload.mensaje || '1') === '1';
  const mensajeCode = accepted ? '1' : '3';
  const estadoMensaje = accepted ? 'aceptado' : 'rechazado';
  const recNumClean = String(payload.receptor?.identificacionNumero || '').replace(/\D/g, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<MensajeHacienda xmlns="${docDef.ns}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<Clave>${escXml(payload.clave)}</Clave>` +
    `<NombreEmisor>${escXml(payload.emisor.nombre)}</NombreEmisor>` +
    `<TipoIdentificacionEmisor>${escXml(payload.emisor.identificacionTipo || '02')}</TipoIdentificacionEmisor>` +
    `<NumeroCedulaEmisor>${escXml(String(payload.emisor.identificacionNumero).replace(/\D/g, '').padStart(12, '0'))}</NumeroCedulaEmisor>` +
    (payload.receptor?.nombre ? `<NombreReceptor>${escXml(payload.receptor.nombre)}</NombreReceptor>` : '') +
    (recNumClean.length >= 9 ? `<TipoIdentificacionReceptor>${escXml(payload.receptor.identificacionTipo || '02')}</TipoIdentificacionReceptor>` : '') +
    (recNumClean.length >= 9 ? `<NumeroCedulaReceptor>${escXml(recNumClean.padStart(12, '0'))}</NumeroCedulaReceptor>` : '') +
    `<Mensaje>${mensajeCode}</Mensaje>` +
    `<EstadoMensaje>${estadoMensaje}</EstadoMensaje>` +
    `<DetalleMensaje>${escXml(payload.detalleMensaje || (accepted ? 'Aceptado' : 'Rechazado'))}</DetalleMensaje>` +
    (payload.montoTotalImpuesto !== undefined ? `<MontoTotalImpuesto>${fmt5(payload.montoTotalImpuesto)}</MontoTotalImpuesto>` : '') +
    `<TotalFactura>${fmt5(payload.totalFactura)}</TotalFactura>` +
    `</MensajeHacienda>`;
  return { xml, resumenMontos: { totalImpuesto: fmt5(payload.montoTotalImpuesto ?? 0), totalComprobante: fmt5(payload.totalFactura) } };
}
