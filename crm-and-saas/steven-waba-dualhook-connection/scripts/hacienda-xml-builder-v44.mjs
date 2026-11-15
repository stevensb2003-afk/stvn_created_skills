/**
 * hacienda-xml-builder-v44.mjs
 * Constructor Determinista de XML v4.4 para los 8 tipos de comprobante DGT Costa Rica
 * (FE, ND, NC, TE, CCE/CPCE/RCE, FEC, FEE, REP y MensajeHacienda) con cálculo exacto BigInt.
 */
import {
  DOC_TYPES_V44,
  SCALE,
  buildMensajeHaciendaXmlV44,
  buildMensajeReceptorXmlV44,
  escXml,
  fmt5,
  fmtQty3,
  mulDecimal,
  toScaled,
} from './hacienda-math-and-clave-v44.mjs';

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

  if (minimalParty || tipoDoc === 'REP') {
    return `<${tagName}><Nombre>${escXml(party.nombre)}</Nombre>${idXml}${emailXml}</${tagName}>`;
  }

  const allowUbicacion = !(tipoDoc === 'FEE' && !isEmisor);
  const ub = party.ubicacion;
  const ubicacionXml = allowUbicacion && ub && ub.provincia && ub.canton && ub.distrito && ub.otrasSenas
    ? `<Ubicacion><Provincia>${escXml(String(ub.provincia))}</Provincia><Canton>${escXml(String(ub.canton).padStart(2, '0'))}</Canton><Distrito>${escXml(String(ub.distrito).padStart(2, '0'))}</Distrito>` +
      (ub.barrio && String(ub.barrio).length >= 5 ? `<Barrio>${escXml(ub.barrio)}</Barrio>` : '') +
      `<OtrasSenas>${escXml(ub.otrasSenas)}</OtrasSenas></Ubicacion>`
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

export function buildReciboPagoXmlV44(payload, docDef = DOC_TYPES_V44.REP) {
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
    return `<LineaDetalle><NumeroLinea>${idx + 1}</NumeroLinea><Detalle>${escXml(item.detalle)}</Detalle><MontoTotal>${fmt5(montoTotal)}</MontoTotal><SubTotal>${fmt5(subTotal)}</SubTotal>${impXml}<ImpuestoNeto>${fmt5(impLinea)}</ImpuestoNeto><MontoTotalLinea>${fmt5(totalLinea)}</MontoTotalLinea></LineaDetalle>`;
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
    `<ResumenFactura><CodigoTipoMoneda><CodigoMoneda>${escXml(moneda.codigo || 'CRC')}</CodigoMoneda><TipoCambio>${fmt5(moneda.tipoCambio ?? '1')}</TipoCambio></CodigoTipoMoneda><TotalVenta>${fmt5(totalVenta)}</TotalVenta><TotalVentaNeta>${fmt5(totalVenta)}</TotalVentaNeta>${desgloseXml}<TotalImpuesto>${fmt5(totalImpuesto)}</TotalImpuesto>${mpXml}<TotalComprobante>${fmt5(totalComprobante)}</TotalComprobante></ResumenFactura>` +
    refXml +
    `</${docDef.root}>`;

  return { xml, resumenMontos: { totalVenta: fmt5(totalVenta), totalImpuesto: fmt5(totalImpuesto), totalComprobante: fmt5(totalComprobante) } };
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
