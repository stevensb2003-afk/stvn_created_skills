# 02 — Esquemas XML v4.4: Todos los Campos, Diferencias por Comprobante y Aritmética Exacta

Referencia técnica exhaustiva extraída directamente de los 10 archivos `.xsd` oficiales v4.4 (`MH-DGT-RES-0027-2024` + actualizaciones vigentes a noviembre 2026) incluidos offline en `resources/xsd/v4.4/`.

---

## 1. ¿Qué cambió de v4.3 a v4.4? (Checklist Anti-Obsolescencia)

Si ves tutoriales o librerías viejas de v4.2/v4.3 en internet, **Hacienda rechazará tus XML** si no cumples estos cambios estructurales de v4.4:

1. **Namespaces nuevos `v4.4`**: Todos los `xmlns` apuntan a `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/...` (jamás `v4.3`).
2. **Nuevo nodo obligatorio `<ProveedorSistemas>`** (justo después de `<Clave>`): Cédula (máx. 20 chars) de quien provee el software de facturación. Si el sistema es propio / auto-hospedado para tu empresa o tu cliente, se coloca la cédula del emisor o la cédula jurídica de tu casa de software.
3. **Renombramiento y separación de Actividad Económica**:
   - Antes (`v4.3`): `<CodigoActividad>` único.
   - Ahora (`v4.4`): `<CodigoActividadEmisor>` (6 dígitos CIIU4) y `<CodigoActividadReceptor>` (6 dígitos CIIU4; condicional en `FE`/`ND`/`NC` cuando el comprador deduce gasto/crédito IVA, **obligatorio** en `FEC`, y **prohibido** en `TE`, `FEE` y `REP`).
4. **Reubicación de `<MedioPago>`**:
   - Antes (`v4.3`): `<MedioPago>` era un string de 2 dígitos en la cabecera después de `<PlazoCredito>`.
   - Ahora (`v4.4`): `<MedioPago>` (hasta 4 ocurrencias) vive **dentro de `<ResumenFactura>`**, justo antes de `<TotalComprobante>`, y contiene `<TipoMedioPago>`, `<MedioPagoOtros>` (si `99`) y `<TotalMedioPago>`. Además incluye **`06` = SINPE Móvil** y **`07` = Plataforma Digital** (Stripe, PayPal, Tilopay, etc.).
5. **Nuevo nodo obligatorio `<TotalDesgloseImpuesto>` en `<ResumenFactura>`**: Agrupa la sumatoria de impuestos netos por cada combinación `(Codigo, CodigoTarifaIVA)`.
6. **Nuevo documento `10` = `ReciboElectronicoPago` (`REP`)**: Comprobante dedicado para registrar pagos recibidos sobre ventas a crédito en IVA hasta 90 días (Art. 27 LIVA) o ventas al Estado.
7. **Nuevos nodos sectoriales y comerciales en `<LineaDetalle>`**:
   - `<CodigoCABYS>` (13 dígitos obligatorios en `FE`, `TE`, `FEC`, `FEE`).
   - `<TipoTransaccion>` (`01` Venta normal, `02` Mercancía autoconsumo, `03` Regalía/bonificación, etc.).
   - `<RegistroMedicamento>` y `<FormaFarmaceutica>` (obligatorios para CABYS de medicamentos humanos).
   - `<DetalleSurtido>` (paquetes/combos de productos con sub-líneas CABYS e IVA individual).
   - `<NumeroVINoSerie>` (vehículos/maquinaria).
   - `<ImpuestoAsumidoEmisorFabrica>` (regalías, bonificaciones o cobro IVA en fábrica — presente en `FE`, `TE`, `NC`, `ND`, pero **ausente** en `FEC` y `FEE`).
8. **Identificaciones Jurídicas Alfanuméricas y Extranjeros (`maxLength="20"`)**: `<Identificacion><Numero>` acepta hasta 20 caracteres alfanuméricos (soportando nuevos identificadores jurídicos del Registro Nacional y pasaportes/TAX IDs extranjeros `Tipo="05"` o No Contribuyentes `Tipo="06"`).

---

## 2. Matriz de Diferencias XSD entre los 8 Tipos de Documento (Validada con `xmllint`)

Esta tabla evita el 99% de los errores `Schemas validity error: Element X is not expected`:

| Nodo / Regla XSD | `01` FE | `02` ND | `03` NC | `04` TE | `08` FEC | `09` FEE | `10` REP | `05-07` MR |
|---|---|---|---|---|---|---|---|---|
| **Raíz XML** | `FacturaElectronica` | `NotaDebitoElectronica` | `NotaCreditoElectronica` | `TiqueteElectronico` | `FacturaElectronicaCompra` | `FacturaElectronicaExportacion` | `ReciboElectronicoPago` | `MensajeReceptor` |
| `<ProveedorSistemas>` | Sí (Req) | Sí (Req) | Sí (Req) | Sí (Req) | Sí (Req) | Sí (Req) | Sí (Req) | **No** |
| `<CodigoActividadEmisor>` | Sí (Req) | Opc | Opc | Sí (Req) | Opc | Sí (Req) | **No existe** | **No** (`CodigoActividad` opc) |
| `<CodigoActividadReceptor>` | Opc | Opc | Opc | **Prohibido** | **Sí (Req)** | **Prohibido** | **Prohibido** | **No** |
| `<Receptor>` | Sí (Req) | Opc | Opc | Opc | Sí (Req) | Opc | Sí (Req) | `NumeroCedulaReceptor` |
| Campos permitidos en `Emisor` / `Receptor` | Completos | Completos | Completos | Completos |Completos (`OtrasSenasExtranjero` en Emisor) | `Receptor` **sin `<Ubicacion>`** (usa `<OtrasSenasExtranjero>`) | **Solo** `Nombre`, `Identificacion`, `CorreoElectronico` | Solo cédulas |
| `<BaseImponible>` en línea | Opc/Sí | Opc/Sí | Opc/Sí | Opc/Sí | Opc/Sí | **Prohibido** | **Prohibido** | N/A |
| `<ImpuestoAsumidoEmisorFabrica>` en línea | Opc/Sí | Opc/Sí | Opc/Sí | Opc/Sí | **Prohibido** | **Prohibido** | **Prohibido** | N/A |
| `<ImpuestoNeto>` en línea | Sí | Sí | Sí | Sí | Sí | **Prohibido** | Sí | N/A |
| Exonerados y No Sujetos en `ResumenFactura` | Sí | Sí | Sí | Sí | Sí | **Prohibidos** | **Prohibidos** | N/A |
| `<InformacionReferencia>` | Opc (0..10) | **Req (1..10)** | **Req (1..10)** | Opc (0..10) | **Req (1..10)** | Opc (0..10) | **Req (1..10)** | **No** |

> El motor `scripts/sign-and-validate-v44.mjs` aplica automáticamente cada una de estas reglas condicionales según `tipoDoc`.

---

## 3. Catálogos Oficiales Clave v4.4 (Tablas de Referencia Rápida)

### 3.1 Tipos de Identificación (`<Identificacion><Tipo>`)
- `01`: Cédula Física (9 dígitos exactos, sin guiones ni ceros iniciales, ej. `101110222`).
- `02`: Cédula Jurídica (10 caracteres; tradicionalmente `3101XXXXXX`, soporta formato alfanumérico RN vigente).
- `03`: DIMEX (11 o 12 dígitos numéricos, sin ceros iniciales).
- `04`: NITE (10 dígitos numéricos).
- `05`: Extranjero No Domiciliado (hasta 20 caracteres alfanuméricos: pasaporte, EIN, Tax ID).
- `06`: No Contribuyente (hasta 20 caracteres).

### 3.2 Condición de Venta (`<CondicionVenta>`)
- `01`: Contado *(exige al menos 1 `<MedioPago>` en `<ResumenFactura>`)*.
- `02`: Crédito *(exige `<PlazoCredito>` entero en días; si no hay pago inicial no lleva `<MedioPago>`)*.
- `03`: Consignación | `04`: Apartado | `05`: Arrendamiento con opción de compra | `06`: Arrendamiento en función financiera.
- `07`: Cobro a favor de un tercero | `08`: Servicios prestados al Estado a crédito | `09`: Pago del servicio prestado al Estado.
- `10`: Venta a crédito en IVA hasta 90 días (Art. 27, LIVA) *(el IVA se difiere y luego se liquida emitiendo un `REP` tipo `10` con condición `11`)*.
- `11`: Pago de venta a crédito en IVA hasta 90 días (Art. 27, LIVA) *(exclusivo para `REP` / `ND` / `NC`)*.
- `12`: Venta Mercancía No Nacionalizada | `13`: Venta Bienes Usados No Contribuyente | `14`: Arrendamiento Operativo | `15`: Arrendamiento Financiero.
- `99`: Otros *(exige `<CondicionVentaOtros>` de 5 a 100 caracteres)*.

### 3.3 Códigos de Impuesto (`<Impuesto><Codigo>`) y Tarifas IVA (`<CodigoTarifaIVA>`)

**Códigos de Impuesto (`CodigoImpuestoType`):**
- `01`: **Impuesto al Valor Agregado (IVA)** *(exige `<CodigoTarifaIVA>`)*
- `02`: Impuesto Selectivo de Consumo
- `03`: Impuesto Único a los Combustibles
- `04`: Impuesto específico de Bebidas Alcohólicas
- `05`: Impuesto Específico sobre las bebidas envasadas sin contenido alcohólico y jabones de tocador
- `06`: Impuesto a los Productos de Tabaco
- `07`: IVA (cálculo especial — ej. bienes usados con `<FactorCalculoIVA>`)
- `08`: IVA Régimen de Bienes Usados (Factor)
- `12`: Impuesto Específico al Cemento
- `99`: Otros *(exige `<CodigoImpuestoOTRO>`)*

**Códigos de Tarifa IVA (`CodigoTarifaIVAType` cuando `Codigo="01"`):**
- `01`: Tarifa `0%` (Artículo 32, num 1, RLIVA — exportaciones / zonas francas con derecho a crédito)
- `02`: Tarifa reducida `1%` (Canasta básica tributaria, maquinaria agropecuaria/veterinaria)
- `03`: Tarifa reducida `2%` (Medicamentos registrados, educación privada, seguros personales)
- `04`: Tarifa reducida `4%` (Servicios de salud privados, boletos aéreos)
- `05`: Transitorio `0%`
- `06`: Transitorio `4%`
- `07`: Tarifa transitoria `8%`
- `08`: **Tarifa general `13%`** *(la estándar para software, consultoría, comercio y servicios generales)*
- `09`: Tarifa reducida `0.5%`
- `10`: **Tarifa Exenta (`0%` sin derecho a crédito pleno)** *(Art. 8 LIVA)*
- `11`: Tarifa `0%` sin derecho a crédito

### 3.4 Medios de Pago (`<ResumenFactura><MedioPago><TipoMedioPago>`)
- `01`: Efectivo
- `02`: Tarjeta (crédito / débito / datáfono)
- `03`: Cheque
- `04`: Transferencia — depósito bancario
- `05`: Recaudado por terceros
- `06`: **SINPE Móvil**
- `07`: **Plataforma Digital** (pasarelas online, wallets digitales)
- `99`: Otros *(exige `<MedioPagoOtros>` de 3 a 100 caracteres)*

### 3.5 Información de Referencia (`<InformacionReferencia>`) — Vital para Anulaciones, Contingencias y Rechazos

**`<TipoDocIR>` (`TipoDocReferenciaType`):**
- `01`: Factura electrónica | `02`: Nota de débito electrónica | `03`: Nota de crédito electrónica | `04`: Tiquete electrónico
- `05`: Nota de despacho | `06`: Contrato | `07`: Procedimiento | `08`: **Comprobante emitido en contingencia** (talonario preimpreso)
- `09`: Devolución mercadería | `10`: **Comprobante electrónico rechazado por el Ministerio de Hacienda** *(¡OBLIGATORIO cuando re-emites una venta cuyo consecutivo anterior fue rechazado por Hacienda!)*
- `11`: Sustituye factura rechazada por el Receptor del comprobante (`RCE`)
- `12`: Sustituye Factura de exportación
- `13`: Facturación mes vencido
- `14`: Comprobante aportado por contribuyente de Régimen Especial *(usado en `FEC` `08`)*
- `15`: Sustituye una Factura electrónica de Compra
- `16`: Comprobante de Proveedor No Domiciliado | `17`: Nota de Crédito a Proveedor No Domiciliado | `18`: Nota de Débito a Proveedor No Domiciliado
- `99`: Otros *(exige `<TipoDocRefOTRO>`)*

**`<Codigo>` (`CodigoReferenciaType`):**
- `01`: Anula documento de referencia *(típico en `NC` total)*
- `02`: Corrige monto *(típico en `NC` parcial o `ND`)*
- `04`: Referencia a otro documento *(usado al referenciar una factura rechazada `TipoDocIR="10"` o al pagar en `REP`)*
- `05`: Sustituye comprobante provisional por contingencia (`TipoDocIR="08"`)
- `99`: Otros *(exige `<CodigoReferenciaOTRO>`)*

---

## 4. Aritmética Bancaria Exacta a 5 Decimales (`BigInt x 100_000`)

**PROHIBIDO USAR `number` (`float` IEEE-754) PARA DINERO.**
En JavaScript, `0.1 + 0.2 === 0.30000000000000004` y `19.99 * 100 === 1998.9999999999998`. Hacienda valida cada suma de línea y de `<ResumenFactura>` con precisión decimal de **hasta 5 decimales** (`DecimalDineroType`: `totalDigits=18`, `fractionDigits=5`); una diferencia mal redondeada dispara rechazo inmediato por descuadre aritmético.

### Fórmulas Oficiales Línea por Línea (`LineaDetalle`)

Trabajando en unidades escaladas enteras (`1.00000` = `100_000n`):

1. `MontoTotal = round5(Cantidad * PrecioUnitario)`
2. `TotalDescuentosLinea = sum(Descuento[i].MontoDescuento)` *(máx. 5 descuentos por línea)*
3. `SubTotal = MontoTotal - TotalDescuentosLinea`
4. `BaseImponible = SubTotal` *(salvo recargos selectivos especiales donde la base incluye otro impuesto)*
5. Para cada `<Impuesto>`:
   - `Monto = round5(BaseImponible * (Tarifa / 100))`
   - Si existe `<Exoneracion>`: `MontoExoneracion = round5(BaseImponible * (TarifaExonerada / 100))` *(nota: `TarifaExonerada` nunca puede superar `Tarifa`)*
6. `ImpuestoNeto = sum(Impuesto[i].Monto) - sum(Exoneracion[i].MontoExoneracion) - ImpuestoAsumidoEmisorFabrica`
7. `MontoTotalLinea = SubTotal + ImpuestoNeto`

### Fórmulas Oficiales de `<ResumenFactura>`

Clasifica el `MontoTotal` bruto (antes de descuento) de cada línea según si es **Servicio** (`Sp`, `Spe`, `St`, `Al`, `Alc`, `Cm`, `I`, `Os`, `h`, `D`) o **Mercancía** (`Unid`, `kg`, `m`, `L`, etc.):

- Si la línea no tiene impuestos y es `noSujeto`: suma a `TotalServNoSujeto` o `TotalMercNoSujeta`.
- Si tiene IVA con `CodigoTarifaIVA = "10"` (Exento) o sin impuestos exento: suma a `TotalServExentos` o `TotalMercanciasExentas`.
- Si tiene `<Exoneracion>` parcial (ej. tarifa `13%` y exoneración `10%`):
  - Proporción exonerada: `parteExonerada = round5(MontoTotal * (MontoExoneracion / MontoImpuesto))` -> va a `TotalServExonerado` o `TotalMercExonerada`.
  - Proporción gravada: `parteGravada = MontoTotal - parteExonerada` -> va a `TotalServGravados` o `TotalMercanciasGravadas`.
- Si es gravada normal (incluyendo tarifa `0%` con derecho a crédito `01` o reducidas `1%`, `2%`, `4%`, `13%`): suma a `TotalServGravados` o `TotalMercanciasGravadas`.

Luego los subtotales del resumen cuadran de forma cerrada:

```text
TotalGravado      = TotalServGravados + TotalMercanciasGravadas
TotalExento       = TotalServExentos + TotalMercanciasExentas
TotalExonerado    = TotalServExonerado + TotalMercExonerada
TotalNoSujeto     = TotalServNoSujeto + TotalMercNoSujeta
TotalVenta        = TotalGravado + TotalExento + TotalExonerado + TotalNoSujeto
TotalDescuentos   = sum(Descuento.MontoDescuento de todas las líneas)
TotalVentaNeta    = TotalVenta - TotalDescuentos
TotalImpuesto     = sum(LineaDetalle.ImpuestoNeto de todas las líneas)
TotalOtrosCargos  = sum(OtrosCargos.MontoCargo)
TotalComprobante  = TotalVentaNeta + TotalImpuesto + TotalOtrosCargos - TotalIVADevuelto
```

> **Validación de Medios de Pago:** Si hay más de 1 `<MedioPago>`, la suma de todos los `<TotalMedioPago>` debe ser igual a `TotalComprobante` (en ventas de contado). `TotalIVADevuelto` solo se usa cuando un comercio (ej. clínica privada) devuelve el 4% de IVA por pago con tarjeta (datáfono) conforme a la Ley 9635.
