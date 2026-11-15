#!/usr/bin/env node
/**
 * sign-and-validate-v44.mjs
 * Motor Criptográfico y Generador/Validador Nativo Hacienda Costa Rica v4.4 (Cero PHP, Cero AGPL).
 *
 * Capacidades:
 *  1. Generación determinista de NumeroConsecutivo (20 dígitos) y Clave Numérica (50 dígitos)
 *     soportando los 10 tipos de documento v4.4 (01 FE, 02 ND, 03 NC, 04 TE, 05-07 MR, 08 FEC, 09 FEE, 10 REP).
 *  2. Aritmética fiscal exacta a 5 decimales (escala entera BigInt x 100_000 — cero errores IEEE-754).
 *  3. Construcción completa de XML v4.4 (FacturaElectronica, TiqueteElectronico, NotaCreditoElectronica,
 *     NotaDebitoElectronica, ReciboElectronicoPago, MensajeReceptor) con todos los nodos de MH-DGT-RES-0027-2024.
 *  4. Firma Digital Criptográfica XAdES-EPES (RSA-SHA256 + W3C C14N + Política v4.4 SHA-256) usando .p12 + PIN.
 *  5. Validación estricta offline contra los esquemas XSD v4.4 oficiales de Hacienda vía xmllint +
 *     verificación matemática RSA-SHA256 de la firma generada.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_XSD_DIR = path.resolve(__dirname, '../resources/xsd/v4.4');

export const DOC_TYPES_V44 = {
  FE:  { code: '01', root: 'FacturaElectronica',            ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',            xsd: 'FacturaElectronica_V4.4.xsd' },
  ND:  { code: '02', root: 'NotaDebitoElectronica',         ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica',         xsd: 'NotaDebitoElectronica_V4.4.xsd' },
  NC:  { code: '03', root: 'NotaCreditoElectronica',        ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica',        xsd: 'NotaCreditoElectronica_V4.4.xsd' },
  TE:  { code: '04', root: 'TiqueteElectronico',            ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico',            xsd: 'TiqueteElectronico_V4.4.xsd' },
  CCE: { code: '05', root: 'MensajeReceptor',               ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor',               xsd: 'MensajeReceptor_V4.4.xsd' },
  CPCE:{ code: '06', root: 'MensajeReceptor',               ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor',               xsd: 'MensajeReceptor_V4.4.xsd' },
  RCE: { code: '07', root: 'MensajeReceptor',               ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor',               xsd: 'MensajeReceptor_V4.4.xsd' },
  FEC: { code: '08', root: 'FacturaElectronicaCompra',      ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra',      xsd: 'FacturaElectronicaCompra_V4.4.xsd' },
  FEE: { code: '09', root: 'FacturaElectronicaExportacion', ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaExportacion', xsd: 'FacturaElectronicaExportacion_V4.4.xsd' },
  REP: { code: '10', root: 'ReciboElectronicoPago',         ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/reciboElectronicoPago',         xsd: 'ReciboElectronicoPago_V4.4.xsd' },
  MH:  { code: 'MH', root: 'MensajeHacienda',               ns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeHacienda',               xsd: 'MensajeHacienda_V4.4.xsd' },
};

const POLICY_V44 = {
  url: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf',
  digestBase64: 'DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=',
};

// ============================================================================
// 1. Aritmética Fiscal Exacta (5 decimales = escala entera 100_000n)
// ============================================================================
const SCALE = 100_000n;

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
// 3. Constructor Determinista de XML v4.4 con Cálculo Automático Exacto
// ============================================================================
const SERVICE_UNITS = new Set(['Sp', 'Spe', 'St', 'Al', 'Alc', 'Cm', 'I', 'Os', 'h', 'D']);

export function buildComprobanteXmlV44(payload) {
  const tipoDoc = payload.tipoDoc || 'FE';
  const docDef = DOC_TYPES_V44[tipoDoc];
  if (!docDef) throw new Error(`Tipo de documento inválido: ${tipoDoc}`);

  if (['CCE', 'CPCE', 'RCE'].includes(tipoDoc)) {
    return buildMensajeReceptorXmlV44(payload, docDef);
  }
  if (tipoDoc === 'REP') {
    return buildReciboPagoXmlV44(payload, docDef);
  }
  if (tipoDoc === 'MH') {
    return buildMensajeHaciendaXmlV44(payload, docDef);
  }

  const {
    clave,
    consecutivo,
    fechaEmision,
    proveedorSistemas,
    codigoActividadEmisor,
    codigoActividadReceptor,
    emisor,
    receptor,
    condicionVenta = '01',
    condicionVentaOtros,
    plazoCredito,
    moneda = { codigo: 'CRC', tipoCambio: '1.00000' },
    lineas = [],
    otrosCargos = [],
    mediosPago = [{ tipo: '01' }],
    referencias = [],
    otrosTexto = [],
  } = payload;

  let totalServGravados = 0n;
  let totalServExentos = 0n;
  let totalServExonerado = 0n;
  let totalServNoSujeto = 0n;
  let totalMercGravadas = 0n;
  let totalMercExentas = 0n;
  let totalMercExonerada = 0n;
  let totalMercNoSujeta = 0n;
  let totalDescuentos = 0n;
  let totalImpuesto = 0n;
  let totalImpAsumEmisor = 0n;
  let totalOtrosCargos = 0n;
  const desgloseMap = new Map();

  const lineasXml = lineas.map((item, idx) => {
    const numLinea = idx + 1;
    const isService = item.esServicio !== undefined ? Boolean(item.esServicio) : SERVICE_UNITS.has(item.unidadMedida || 'Unid');
    const montoTotal = mulDecimal(item.cantidad, item.precioUnitario);

    let descLinea = 0n;
    const descuentosXml = (item.descuentos || []).slice(0, 5).map((d) => {
      const m = toScaled(d.monto);
      descLinea += m;
      const cod = d.codigo || '07'; // 07 = Descuento Comercial
      return `<Descuento>` +
        `<MontoDescuento>${fmt5(m)}</MontoDescuento>` +
        `<CodigoDescuento>${escXml(cod)}</CodigoDescuento>` +
        (cod === '99' && d.otros ? `<CodigoDescuentoOTRO>${escXml(d.otros)}</CodigoDescuentoOTRO>` : '') +
        (d.naturaleza ? `<NaturalezaDescuento>${escXml(d.naturaleza)}</NaturalezaDescuento>` : '') +
        `</Descuento>`;
    }).join('');

    totalDescuentos += descLinea;
    const subTotal = montoTotal - descLinea;
    const baseImponible = item.baseImponible !== undefined ? toScaled(item.baseImponible) : subTotal;

    let impBrutoLinea = 0n;
    let impExonLinea = 0n;
    const impuestos = item.impuestos || [];

    const impuestosXml = impuestos.map((imp) => {
      const codImp = imp.codigo || '01';
      const codTarifa = imp.codigoTarifaIVA || '08';
      const tarifaNum = imp.tarifa !== undefined ? imp.tarifa : 13;
      const montoImp = imp.monto !== undefined
        ? toScaled(imp.monto)
        : mulDecimal(baseImponible, String(Number(tarifaNum) / 100));

      let exonXml = '';
      let montoExon = 0n;
      if (imp.exoneracion) {
        const ex = imp.exoneracion;
        montoExon = ex.montoExoneracion !== undefined
          ? toScaled(ex.montoExoneracion)
          : mulDecimal(baseImponible, String(Number(ex.tarifaExonerada) / 100));
        impExonLinea += montoExon;
        exonXml = `<Exoneracion>` +
          `<TipoDocumentoEX1>${escXml(ex.tipoDocumento)}</TipoDocumentoEX1>` +
          (ex.tipoDocumento === '99' && ex.tipoDocumentoOtro ? `<TipoDocumentoOTRO>${escXml(ex.tipoDocumentoOtro)}</TipoDocumentoOTRO>` : '') +
          `<NumeroDocumento>${escXml(ex.numeroDocumento)}</NumeroDocumento>` +
          (ex.articulo !== undefined ? `<Articulo>${escXml(ex.articulo)}</Articulo>` : '') +
          (ex.inciso !== undefined ? `<Inciso>${escXml(ex.inciso)}</Inciso>` : '') +
          `<NombreInstitucion>${escXml(ex.nombreInstitucion || '01')}</NombreInstitucion>` +
          (ex.nombreInstitucion === '99' && ex.nombreInstitucionOtros ? `<NombreInstitucionOtros>${escXml(ex.nombreInstitucionOtros)}</NombreInstitucionOtros>` : '') +
          `<FechaEmisionEX>${escXml(ex.fechaEmision)}</FechaEmisionEX>` +
          `<TarifaExonerada>${Number(ex.tarifaExonerada).toFixed(2)}</TarifaExonerada>` +
          `<MontoExoneracion>${fmt5(montoExon)}</MontoExoneracion>` +
          `</Exoneracion>`;
      }

      const impNetoItem = montoImp - montoExon;
      impBrutoLinea += montoImp;

      const key = `${codImp}|${codImp === '01' ? codTarifa : ''}`;
      desgloseMap.set(key, (desgloseMap.get(key) || 0n) + impNetoItem);

      // Clasificación del monto base (MontoTotal de la línea) para ResumenFactura
      if (codImp === '01' && codTarifa === '10') {
        if (isService) totalServExentos += montoTotal; else totalMercExentas += montoTotal;
      } else if (montoExon > 0n && Number(tarifaNum) > 0) {
        const ratioExon = (montoExon * SCALE) / (montoImp || 1n);
        const parteExonerada = (montoTotal * ratioExon + SCALE / 2n) / SCALE;
        const parteGravada = montoTotal - parteExonerada;
        if (isService) {
          totalServExonerado += parteExonerada;
          totalServGravados += parteGravada;
        } else {
          totalMercExonerada += parteExonerada;
          totalMercGravadas += parteGravada;
        }
      } else {
        if (isService) totalServGravados += montoTotal; else totalMercGravadas += montoTotal;
      }

      return `<Impuesto>` +
        `<Codigo>${escXml(codImp)}</Codigo>` +
        (codImp === '99' && imp.codigoOtro ? `<CodigoImpuestoOTRO>${escXml(imp.codigoOtro)}</CodigoImpuestoOTRO>` : '') +
        (codImp === '01' ? `<CodigoTarifaIVA>${escXml(codTarifa)}</CodigoTarifaIVA>` : '') +
        `<Tarifa>${Number(tarifaNum).toFixed(2)}</Tarifa>` +
        (imp.factorCalculoIVA !== undefined ? `<FactorCalculoIVA>${Number(imp.factorCalculoIVA).toFixed(4)}</FactorCalculoIVA>` : '') +
        `<Monto>${fmt5(montoImp)}</Monto>` +
        exonXml +
        `</Impuesto>`;
    }).join('');

    if (impuestos.length === 0) {
      if (item.noSujeto) {
        if (isService) totalServNoSujeto += montoTotal; else totalMercNoSujeta += montoTotal;
      } else {
        if (isService) totalServExentos += montoTotal; else totalMercExentas += montoTotal;
      }
    }

    const impAsumido = item.impuestoAsumidoEmisorFabrica !== undefined ? toScaled(item.impuestoAsumidoEmisorFabrica) : 0n;
    totalImpAsumEmisor += impAsumido;
    const impuestoNeto = impBrutoLinea - impExonLinea - impAsumido;
    totalImpuesto += impuestoNeto;
    const montoTotalLinea = subTotal + impuestoNeto;

    const codComercialXml = (item.codigosComerciales || []).slice(0, 5).map((c) =>
      `<CodigoComercial><Tipo>${escXml(c.tipo || '01')}</Tipo><Codigo>${escXml(c.codigo)}</Codigo></CodigoComercial>`
    ).join('');

    return `<LineaDetalle>` +
      `<NumeroLinea>${numLinea}</NumeroLinea>` +
      (tipoDoc === 'FEE' && item.partidaArancelaria ? `<PartidaArancelaria>${escXml(String(item.partidaArancelaria).padStart(12, '0'))}</PartidaArancelaria>` : '') +
      `<CodigoCABYS>${escXml(String(item.codigoCABYS).padStart(13, '0'))}</CodigoCABYS>` +
      codComercialXml +
      `<Cantidad>${fmtQty3(item.cantidad)}</Cantidad>` +
      `<UnidadMedida>${escXml(item.unidadMedida || 'Unid')}</UnidadMedida>` +
      (item.tipoTransaccion && tipoDoc !== 'TE' ? `<TipoTransaccion>${escXml(item.tipoTransaccion)}</TipoTransaccion>` : '') +
      (item.unidadMedidaComercial ? `<UnidadMedidaComercial>${escXml(item.unidadMedidaComercial)}</UnidadMedidaComercial>` : '') +
      `<Detalle>${escXml(item.detalle)}</Detalle>` +
      `<PrecioUnitario>${fmt5(item.precioUnitario)}</PrecioUnitario>` +
      `<MontoTotal>${fmt5(montoTotal)}</MontoTotal>` +
      descuentosXml +
      `<SubTotal>${fmt5(subTotal)}</SubTotal>` +
      (tipoDoc !== 'FEE' ? `<BaseImponible>${fmt5(baseImponible)}</BaseImponible>` : '') +
      impuestosXml +
      (!['FEE', 'FEC'].includes(tipoDoc) ? `<ImpuestoAsumidoEmisorFabrica>${fmt5(impAsumido)}</ImpuestoAsumidoEmisorFabrica>` : '') +
      (tipoDoc !== 'FEE' ? `<ImpuestoNeto>${fmt5(impuestoNeto)}</ImpuestoNeto>` : '') +
      `<MontoTotalLinea>${fmt5(montoTotalLinea)}</MontoTotalLinea>` +
      `</LineaDetalle>`;
  }).join('');

  const otrosCargosXml = otrosCargos.slice(0, 15).map((oc) => {
    const m = toScaled(oc.montoCargo);
    totalOtrosCargos += m;
    return `<OtrosCargos>` +
      `<TipoDocumentoOC>${escXml(oc.tipoDocumentoOC)}</TipoDocumentoOC>` +
      (oc.tipoDocumentoOC === '99' && oc.tipoDocumentoOTROS ? `<TipoDocumentoOTROS>${escXml(oc.tipoDocumentoOTROS)}</TipoDocumentoOTROS>` : '') +
      (oc.tercero ? `<IdentificacionTercero><Tipo>${escXml(oc.tercero.tipo)}</Tipo><Numero>${escXml(oc.tercero.numero)}</Numero></IdentificacionTercero><NombreTercero>${escXml(oc.tercero.nombre)}</NombreTercero>` : '') +
      `<Detalle>${escXml(oc.detalle)}</Detalle>` +
      (oc.porcentaje !== undefined ? `<PorcentajeOC>${Number(oc.porcentaje).toFixed(5)}</PorcentajeOC>` : '') +
      `<MontoCargo>${fmt5(m)}</MontoCargo>` +
      `</OtrosCargos>`;
  }).join('');

  const totalGravado = totalServGravados + totalMercGravadas;
  const totalExento = totalServExentos + totalMercExentas;
  const totalExonerado = totalServExonerado + totalMercExonerada;
  const totalNoSujeto = totalServNoSujeto + totalMercNoSujeta;
  const totalVenta = totalGravado + totalExento + totalExonerado + totalNoSujeto;
  const totalVentaNeta = totalVenta - totalDescuentos;
  const totalIVADevuelto = payload.totalIVADevuelto ? toScaled(payload.totalIVADevuelto) : 0n;
  const totalComprobante = totalVentaNeta + totalImpuesto + totalOtrosCargos - totalIVADevuelto;

  const desgloseXml = Array.from(desgloseMap.entries()).map(([key, totalMonto]) => {
    const [cod, codTarifa] = key.split('|');
    return `<TotalDesgloseImpuesto>` +
      `<Codigo>${escXml(cod)}</Codigo>` +
      (codTarifa ? `<CodigoTarifaIVA>${escXml(codTarifa)}</CodigoTarifaIVA>` : '') +
      `<TotalMontoImpuesto>${fmt5(totalMonto)}</TotalMontoImpuesto>` +
      `</TotalDesgloseImpuesto>`;
  }).join('');

  // En v4.4 MedioPago va dentro de ResumenFactura (no aplica cuando es crédito puro 02 salvo abono inicial)
  const mediosPagoXml = (condicionVenta === '02' ? [] : mediosPago.slice(0, 4)).map((mp) => {
    const montoMp = mp.monto !== undefined
      ? toScaled(mp.monto)
      : (mediosPago.length === 1 ? totalComprobante : 0n);
    return `<MedioPago>` +
      `<TipoMedioPago>${escXml(mp.tipo || '01')}</TipoMedioPago>` +
      (mp.tipo === '99' && mp.otros ? `<MedioPagoOtros>${escXml(mp.otros)}</MedioPagoOtros>` : '') +
      `<TotalMedioPago>${fmt5(montoMp)}</TotalMedioPago>` +
      `</MedioPago>`;
  }).join('');

  const emisorXml = buildPartyXml('Emisor', emisor, true, { tipoDoc });
  const receptorXml = receptor && String(receptor.nombre || '').trim()
    ? buildPartyXml('Receptor', receptor, false, { tipoDoc })
    : '';

  const referenciasXml = referencias.slice(0, 10).map((r) =>
    `<InformacionReferencia>` +
    `<TipoDocIR>${escXml(r.tipoDoc)}</TipoDocIR>` +
    (r.tipoDoc === '99' && r.tipoDocOtro ? `<TipoDocRefOTRO>${escXml(r.tipoDocOtro)}</TipoDocRefOTRO>` : '') +
    (r.numero ? `<Numero>${escXml(r.numero)}</Numero>` : '') +
    `<FechaEmisionIR>${escXml(r.fechaEmision)}</FechaEmisionIR>` +
    (r.codigo ? `<Codigo>${escXml(r.codigo)}</Codigo>` : '') +
    (r.codigo === '99' && r.codigoOtro ? `<CodigoReferenciaOTRO>${escXml(r.codigoOtro)}</CodigoReferenciaOTRO>` : '') +
    (r.razon ? `<Razon>${escXml(r.razon)}</Razon>` : '') +
    `</InformacionReferencia>`
  ).join('');

  const otrosXml = otrosTexto.length > 0
    ? `<Otros>${otrosTexto.map((o) => `<OtroTexto${o.codigo ? ` codigo="${escXml(o.codigo)}"` : ''}>${escXml(o.texto)}</OtroTexto>`).join('')}</Otros>`
    : '';

  const provSistemas = escXml(proveedorSistemas || emisor.identificacionNumero);
  const actEmisor = String(codigoActividadEmisor).replace(/\D/g, '').padStart(6, '0');
  const actReceptorXml = codigoActividadReceptor && !['TE', 'FEE'].includes(tipoDoc)
    ? `<CodigoActividadReceptor>${escXml(String(codigoActividadReceptor).replace(/\D/g, '').padStart(6, '0'))}</CodigoActividadReceptor>`
    : '';

  const isExport = tipoDoc === 'FEE';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<${docDef.root} xmlns="${docDef.ns}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<Clave>${escXml(clave)}</Clave>` +
    `<ProveedorSistemas>${provSistemas}</ProveedorSistemas>` +
    `<CodigoActividadEmisor>${escXml(actEmisor)}</CodigoActividadEmisor>` +
    actReceptorXml +
    `<NumeroConsecutivo>${escXml(consecutivo)}</NumeroConsecutivo>` +
    `<FechaEmision>${escXml(fechaEmision)}</FechaEmision>` +
    emisorXml +
    receptorXml +
    `<CondicionVenta>${escXml(condicionVenta)}</CondicionVenta>` +
    (condicionVenta === '99' && condicionVentaOtros ? `<CondicionVentaOtros>${escXml(condicionVentaOtros)}</CondicionVentaOtros>` : '') +
    (plazoCredito !== undefined && plazoCredito !== null && String(plazoCredito) !== '' ? `<PlazoCredito>${escXml(plazoCredito)}</PlazoCredito>` : '') +
    `<DetalleServicio>${lineasXml}</DetalleServicio>` +
    otrosCargosXml +
    `<ResumenFactura>` +
      `<CodigoTipoMoneda><CodigoMoneda>${escXml(moneda.codigo || 'CRC')}</CodigoMoneda><TipoCambio>${fmt5(moneda.tipoCambio ?? '1')}</TipoCambio></CodigoTipoMoneda>` +
      `<TotalServGravados>${fmt5(totalServGravados)}</TotalServGravados>` +
      `<TotalServExentos>${fmt5(totalServExentos)}</TotalServExentos>` +
      (!isExport ? `<TotalServExonerado>${fmt5(totalServExonerado)}</TotalServExonerado>` : '') +
      (!isExport ? `<TotalServNoSujeto>${fmt5(totalServNoSujeto)}</TotalServNoSujeto>` : '') +
      `<TotalMercanciasGravadas>${fmt5(totalMercGravadas)}</TotalMercanciasGravadas>` +
      `<TotalMercanciasExentas>${fmt5(totalMercExentas)}</TotalMercanciasExentas>` +
      (!isExport ? `<TotalMercExonerada>${fmt5(totalMercExonerada)}</TotalMercExonerada>` : '') +
      (!isExport ? `<TotalMercNoSujeta>${fmt5(totalMercNoSujeta)}</TotalMercNoSujeta>` : '') +
      `<TotalGravado>${fmt5(totalGravado)}</TotalGravado>` +
      `<TotalExento>${fmt5(totalExento)}</TotalExento>` +
      (!isExport ? `<TotalExonerado>${fmt5(totalExonerado)}</TotalExonerado>` : '') +
      (!isExport ? `<TotalNoSujeto>${fmt5(totalNoSujeto)}</TotalNoSujeto>` : '') +
      `<TotalVenta>${fmt5(totalVenta)}</TotalVenta>` +
      `<TotalDescuentos>${fmt5(totalDescuentos)}</TotalDescuentos>` +
      `<TotalVentaNeta>${fmt5(totalVentaNeta)}</TotalVentaNeta>` +
      desgloseXml +
      `<TotalImpuesto>${fmt5(totalImpuesto)}</TotalImpuesto>` +
      `<TotalImpAsumEmisorFabrica>${fmt5(totalImpAsumEmisor)}</TotalImpAsumEmisorFabrica>` +
      (!isExport && totalIVADevuelto > 0n ? `<TotalIVADevuelto>${fmt5(totalIVADevuelto)}</TotalIVADevuelto>` : '') +
      (otrosCargos.length > 0 ? `<TotalOtrosCargos>${fmt5(totalOtrosCargos)}</TotalOtrosCargos>` : '') +
      mediosPagoXml +
      `<TotalComprobante>${fmt5(totalComprobante)}</TotalComprobante>` +
    `</ResumenFactura>` +
    referenciasXml +
    otrosXml +
    `</${docDef.root}>`;

  return {
    xml,
    resumenMontos: {
      totalVenta: fmt5(totalVenta),
      totalDescuentos: fmt5(totalDescuentos),
      totalVentaNeta: fmt5(totalVentaNeta),
      totalImpuesto: fmt5(totalImpuesto),
      totalOtrosCargos: fmt5(totalOtrosCargos),
      totalComprobante: fmt5(totalComprobante),
    },
  };
}

function buildPartyXml(tagName, party, isEmisor, opts = {}) {
  const { tipoDoc = 'FE', minimalParty = false } = opts;
  const emails = Array.isArray(party.correos) ? party.correos : (party.correo ? [party.correo] : []);
  const emailXml = emails.filter((e) => String(e || '').trim()).slice(0, isEmisor && !minimalParty ? 4 : 1).map((e) => `<CorreoElectronico>${escXml(e.trim())}</CorreoElectronico>`).join('');
  const hasIdNum = Boolean(String(party.identificacionNumero || '').trim());
  const idXml = (isEmisor || hasIdNum || ['FE', 'FEC', 'REP'].includes(tipoDoc))
    ? `<Identificacion><Tipo>${escXml(party.identificacionTipo || '02')}</Tipo><Numero>${escXml(party.identificacionNumero)}</Numero></Identificacion>`
    : '';

  // En ReciboElectronicoPago_V4.4.xsd, Emisor y Receptor SOLO permiten Nombre, Identificacion y CorreoElectronico
  if (minimalParty || tipoDoc === 'REP') {
    return `<${tagName}>` +
      `<Nombre>${escXml(party.nombre)}</Nombre>` +
      idXml +
      emailXml +
      `</${tagName}>`;
  }

  // En FacturaElectronicaExportacion (FEE), ReceptorType no admite <Ubicacion> nacional, sino <OtrasSenasExtranjero>
  const allowUbicacion = !(tipoDoc === 'FEE' && !isEmisor);
  const ub = party.ubicacion;
  const ubicacionXml = allowUbicacion && ub && ub.provincia && ub.canton && ub.distrito && ub.otrasSenas
    ? `<Ubicacion>` +
      `<Provincia>${escXml(String(ub.provincia))}</Provincia>` +
      `<Canton>${escXml(String(ub.canton).padStart(2, '0'))}</Canton>` +
      `<Distrito>${escXml(String(ub.distrito).padStart(2, '0'))}</Distrito>` +
      (ub.barrio && String(ub.barrio).length >= 5 ? `<Barrio>${escXml(ub.barrio)}</Barrio>` : '') +
      `<OtrasSenas>${escXml(ub.otrasSenas)}</OtrasSenas>` +
      `</Ubicacion>`
    : '';

  const allowOtrasSenasExtranjero = tipoDoc === 'FEC' ? isEmisor : !isEmisor;
  const telXml = party.telefono?.numero
    ? `<Telefono><CodigoPais>${escXml(party.telefono.codigoPais || '506')}</CodigoPais><NumTelefono>${escXml(String(party.telefono.numero).replace(/\D/g, ''))}</NumTelefono></Telefono>`
    : '';

  return `<${tagName}>` +
    `<Nombre>${escXml(party.nombre)}</Nombre>` +
    idXml +
    (isEmisor && party.registroFiscal8707 ? `<Registrofiscal8707>${escXml(party.registroFiscal8707)}</Registrofiscal8707>` : '') +
    (party.nombreComercial ? `<NombreComercial>${escXml(party.nombreComercial)}</NombreComercial>` : '') +
    ubicacionXml +
    (allowOtrasSenasExtranjero && party.otrasSenasExtranjero ? `<OtrasSenasExtranjero>${escXml(party.otrasSenasExtranjero)}</OtrasSenasExtranjero>` : '') +
    telXml +
    emailXml +
    `</${tagName}>`;
}

function buildReciboPagoXmlV44(payload, docDef) {
  const { clave, consecutivo, fechaEmision, proveedorSistemas, emisor, receptor, condicionVenta = '11', moneda = { codigo: 'CRC', tipoCambio: '1' }, lineas = [], mediosPago = [{ tipo: '04' }], referencias = [] } = payload;
  if (!referencias.length) throw new Error('ReciboElectronicoPago (REP) exige al menos 1 nodo InformacionReferencia a la factura original');

  let totalVenta = 0n;
  let totalImpuesto = 0n;
  const desgloseMap = new Map();

  const lineasXml = lineas.map((item, idx) => {
    const montoTotal = toScaled(item.montoTotal);
    const subTotal = toScaled(item.subTotal ?? item.montoTotal);
    let impLinea = 0n;
    const impXml = (item.impuestos || []).map((imp) => {
      const cod = imp.codigo || '01';
      const codTarifa = imp.codigoTarifaIVA || '08';
      const tarifa = imp.tarifa ?? 13;
      const m = imp.monto !== undefined ? toScaled(imp.monto) : mulDecimal(subTotal, String(Number(tarifa) / 100));
      impLinea += m;
      const k = `${cod}|${cod === '01' ? codTarifa : ''}`;
      desgloseMap.set(k, (desgloseMap.get(k) || 0n) + m);
      return `<Impuesto><Codigo>${escXml(cod)}</Codigo>${cod === '01' ? `<CodigoTarifaIVA>${escXml(codTarifa)}</CodigoTarifaIVA>` : ''}<Tarifa>${Number(tarifa).toFixed(2)}</Tarifa><Monto>${fmt5(m)}</Monto></Impuesto>`;
    }).join('');

    totalVenta += montoTotal;
    totalImpuesto += impLinea;
    const totalLinea = subTotal + impLinea;
    return `<LineaDetalle>` +
      `<NumeroLinea>${idx + 1}</NumeroLinea>` +
      `<Detalle>${escXml(item.detalle)}</Detalle>` +
      `<MontoTotal>${fmt5(montoTotal)}</MontoTotal>` +
      `<SubTotal>${fmt5(subTotal)}</SubTotal>` +
      impXml +
      `<ImpuestoNeto>${fmt5(impLinea)}</ImpuestoNeto>` +
      `<MontoTotalLinea>${fmt5(totalLinea)}</MontoTotalLinea>` +
      `</LineaDetalle>`;
  }).join('');

  const totalComprobante = totalVenta + totalImpuesto;
  const desgloseXml = Array.from(desgloseMap.entries()).map(([k, v]) => {
    const [cod, codTarifa] = k.split('|');
    return `<TotalDesgloseImpuesto><Codigo>${escXml(cod)}</Codigo>${codTarifa ? `<CodigoTarifaIVA>${escXml(codTarifa)}</CodigoTarifaIVA>` : ''}<TotalMontoImpuesto>${fmt5(v)}</TotalMontoImpuesto></TotalDesgloseImpuesto>`;
  }).join('');

  const mpXml = mediosPago.slice(0, 4).map((mp) =>
    `<MedioPago><TipoMedioPago>${escXml(mp.tipo || '04')}</TipoMedioPago>${mp.tipo === '99' && mp.otros ? `<MedioPagoOtros>${escXml(mp.otros)}</MedioPagoOtros>` : ''}<TotalMedioPago>${fmt5(mp.monto ?? totalComprobante)}</TotalMedioPago></MedioPago>`
  ).join('');

  const refXml = referencias.slice(0, 10).map((r) =>
    `<InformacionReferencia><TipoDocIR>${escXml(r.tipoDoc || '01')}</TipoDocIR><Numero>${escXml(r.numero)}</Numero><FechaEmisionIR>${escXml(r.fechaEmision)}</FechaEmisionIR><Codigo>${escXml(r.codigo || '04')}</Codigo><Razon>${escXml(r.razon || 'Abono / Cancelación de factura a crédito')}</Razon></InformacionReferencia>`
  ).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<${docDef.root} xmlns="${docDef.ns}" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<Clave>${escXml(clave)}</Clave>` +
    `<ProveedorSistemas>${escXml(proveedorSistemas || emisor.identificacionNumero)}</ProveedorSistemas>` +
    `<NumeroConsecutivo>${escXml(consecutivo)}</NumeroConsecutivo>` +
    `<FechaEmision>${escXml(fechaEmision)}</FechaEmision>` +
    buildPartyXml('Emisor', emisor, true, { minimalParty: true }) +
    buildPartyXml('Receptor', receptor, false, { minimalParty: true }) +
    `<CondicionVenta>${escXml(condicionVenta)}</CondicionVenta>` +
    `<DetalleServicio>${lineasXml}</DetalleServicio>` +
    `<ResumenFactura>` +
      `<CodigoTipoMoneda><CodigoMoneda>${escXml(moneda.codigo || 'CRC')}</CodigoMoneda><TipoCambio>${fmt5(moneda.tipoCambio ?? '1')}</TipoCambio></CodigoTipoMoneda>` +
      `<TotalVenta>${fmt5(totalVenta)}</TotalVenta>` +
      `<TotalVentaNeta>${fmt5(totalVenta)}</TotalVentaNeta>` +
      desgloseXml +
      `<TotalImpuesto>${fmt5(totalImpuesto)}</TotalImpuesto>` +
      mpXml +
      `<TotalComprobante>${fmt5(totalComprobante)}</TotalComprobante>` +
    `</ResumenFactura>` +
    refXml +
    `</${docDef.root}>`;

  return { xml, resumenMontos: { totalVenta: fmt5(totalVenta), totalImpuesto: fmt5(totalImpuesto), totalComprobante: fmt5(totalComprobante) } };
}

function buildMensajeReceptorXmlV44(payload, docDef) {
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

export function computeResumenMontosV44({ lineas = [], otrosCargos = [], moneda = { codigo: 'CRC', tipoCambio: '1.00000' } }) {
  const dummy = buildComprobanteXmlV44({
    tipoDoc: 'TE',
    clave: '50601012600310100000000100001040000000001112345678',
    consecutivo: '00100001040000000001',
    fechaEmision: '2026-01-01T00:00:00-06:00',
    proveedorSistemas: '3101000000',
    codigoActividadEmisor: '620101',
    emisor: {
      nombre: 'COTIZADOR INTERNO',
      identificacionTipo: '02',
      identificacionNumero: '3101000000',
      ubicacion: { provincia: '1', canton: '01', distrito: '01', otrasSenas: 'Costa Rica' },
      correo: 'info@empresa.cr',
    },
    receptor: null,
    condicionVenta: '01',
    moneda,
    lineas,
    otrosCargos,
    mediosPago: [{ tipo: '01' }],
  });
  return dummy.resumenMontos;
}

// ============================================================================
// 4. Firma Criptográfica XAdES-EPES Exacta (RSA-SHA256 + W3C C14N)
// ============================================================================
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

    // Seleccionar el certificado hoja (que corresponde a la llave privada)
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

    // Formatear Issuer RFC2253 en orden inverso estándar X.509 (CN=..., OU=..., O=..., C=...)
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

  // Detectar nodo raíz y namespace v4.4
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

  // 1. Digest del documento completo canonizado (enveloped-signature equivale al XML antes de insertar <ds:Signature>)
  const docC14n = c14nInclusive(unsignedXml);
  const docDigestB64 = sha256Base64(docC14n);

  // 2. Construir <xades:SignedProperties> y calcular su digest C14N heredando namespaces del árbol padre
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

  // 3. Construir <ds:KeyInfo> y calcular su digest C14N heredando namespaces del árbol padre
  const keyInfoInner =
    `<ds:X509Data><ds:X509Certificate>${kp.certCleanB64}</ds:X509Certificate></ds:X509Data>` +
    `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${kp.modulusB64}</ds:Modulus><ds:Exponent>${kp.exponentB64}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>`;

  const keyInfoForHash =
    `<ds:KeyInfo xmlns="${rootNs}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="${keyInfoId}">` +
    keyInfoInner +
    `</ds:KeyInfo>`;
  const keyInfoDigestB64 = sha256Base64(c14nInclusive(keyInfoForHash));

  // 4. Construir <ds:SignedInfo>, canonizarlo y firmarlo con RSA-SHA256
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

  // Auto-verificación criptográfica inmediata en memoria antes de devolver el documento
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

// ============================================================================
// 5. Validador Offline contra Esquemas XSD v4.4 Oficiales (xmllint)
// ============================================================================
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

// Ejecución directa por CLI para demostración / smoke test completo
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
        mediosPago: [{ tipo: tipo === 'FEE' ? '04' : '06' }], // 04=Transferencia, 06=SINPE Móvil
        referencias: ['NC', 'ND', 'REP', 'FEC'].includes(tipo)
          ? [{
              tipoDoc: tipo === 'FEC' ? '14' : '01',
              numero: '50613112600310188877700100001010000000010187654321',
              fechaEmision: '2026-11-10T10:00:00-06:00',
              codigo: tipo === 'NC' ? '01' : (tipo === 'ND' ? '02' : '04'),
              razon: tipo === 'NC' ? 'Anula factura por ajuste comercial' : 'Referencia documental fiscal v4.4',
            }]
          : [],
        // Campos exclusivos de MensajeReceptor (CCE)
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

    // Caso adicional POS: Tiquete Electrónico (TE) 100% anónimo (sin <Receptor>) + MensajeHacienda (MH) firmado
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
