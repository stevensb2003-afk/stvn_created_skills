# Blueprint 11: Motor Fiscal Nativo Costa Rica (Hacienda DGT v4.4 + XAdES-EPES + Outbox Bancario POS)

> **PROPÓSITO DE ESTE BLUEPRINT**: Integrar de forma 100% autocontenida, libre de PHP/AGPLv3 y lista para producción (Cloud Run / Next.js App Router + Firebase) la emisión, firma criptográfica **XAdES-EPES**, validación **XSD v4.4**, reconciliación por webhooks y archivo legal de **5 años** para Facturación Electrónica de Costa Rica (**TRIBU-CR / DGT v4.4**), conectada como `Modo B1 (hacienda_cr_v44)` dentro del adaptador POS (`PosProviderAdapter`) y protegida por la Bóveda Write-Only **AES-256-GCM**.
>
> **ACTIVOS INCLUIDOS EN ESTA SKILL**:
> - Scripts ejecutables (`./scripts/`):
>   - `hacienda-math-and-clave-v44.mjs` — Clave numérica de 50 dígitos (UTC-6), consecutivo de 20 dígitos, aritmética entera exacta `BigInt` (`5` decimales).
>   - `hacienda-xml-builder-v44.mjs` — Generador XML v4.4 para los 8 tipos documentales (`FE`, `ND`, `NC`, `TE`, `CCE`, `FEC`, `FEE`, `REP`) + `MH` webhook.
>   - `sign-and-validate-v44.mjs` — Firma XML **XAdES-EPES** con política oficial v4.4 + validación offline `xmllint` contra los XSD oficiales + suite 10/10 auto-verificable.
>   - `generate-lab-p12.mjs` — Generador de certificados `.p12` cifrados (`-legacy`) para pruebas en Sandbox.
>   - `preflight-and-drift-sentinel.mjs` — Verificación TLS/OIDC, drift de políticas/esquemas y salud de endpoints DGT.
>   - `dgt-error-humanizer.mjs` — `humanizeDgtError()` y `buildProactiveVisualAlerts()` para traducir rechazos XML/HTTP de Hacienda a acciones claras en UI.
> - Esquemas XSD Oficiales v4.4 (`./resources/`):
>   - `resources/xmldsig-core-schema.xsd`
>   - `resources/xsd/v4.4/*.xsd` (`FacturaElectronica_V4.4.xsd`, `TiqueteElectronico_V4.4.xsd`, `NotaCreditoElectronica_V4.4.xsd`, `NotaDebitoElectronica_V4.4.xsd`, `MensajeReceptor_V4.4.xsd`, `FacturaElectronicaCompra_V4.4.xsd`, `FacturaElectronicaExportacion_V4.4.xsd`, `ReciboElectronicoPago_V4.4.xsd`, `MensajeHacienda_V4.4.xsd`).

---

## 1. Las 7 Leyes de Hierro y el Outbox Transaccional Bancario v4.4

Ninguna llamada a la API de Hacienda debe ejecutarse "en el aire" ni acoplada a un único request HTTP sin persistencia previa. Toda emisión respeta **7 Leyes de Hierro**:

1. **Outbox `PRE_SAVED` Antes de Red**: Toda venta fiscal se escribe primero en `crm_pos_invoices` (estado POS) y `crm_fiscal_documents` (espejo fiscal auditable) con `status: 'PRE_SAVED'` antes de adquirir secuencia o abrir conexión HTTPS hacia TRIBU-CR.
2. **Validación XSD Local Offline Pre-Secuencia**: Ejecutar `validateXmlAgainstXsdV44(xml, tipoDoc)` (`xmllint --nonet --schema`) sobre un payload candidato antes de confirmar consumo definitivo. Si el XML falla esquema local, el documento pasa a `LOCAL_VALIDATION_FAILED` sin enviar basura a Hacienda ni ensuciar el buzón del cliente.
3. **Secuencia Atómica Tolerante a Migraciones**: La numeración oficial de `20` dígitos (`SSS` sucursal + `TTTTT` terminal + `TT` tipo + `NNNNNNNNNN` consecutivo) se asigna dentro de `firestore.runTransaction()` sobre `crm_fiscal_sequences/{tipoDoc}_{sucursal}_{terminal}` mediante `Math.max(lastVal, initialSeq) + 1`, permitiendo migrar emisores existentes desde GTI, Alegra o Facturador Gratuito sin colisiones.
4. **Prohibido Reciclar Clave o Consecutivo Tras Rechazo DGT**: Si la DGT responde `REJECTED_BY_DGT`, la clave y el consecutivo rechazados quedan **quemados permanentemente**. Para reemitir se asigna una **nueva secuencia**, una **nueva clave de 50 dígitos**, y se incluye `<InformacionReferencia>` con `TipoDocIR="10"` (*Sustituye factura electrónica rechazada por el Ministerio de Hacienda*) y `<Codigo>04</Codigo>` apuntando a la clave rechazada. Si el documento estuvo `ACCEPTED`, está prohibido usar `TipoDocIR="10"`; debe emitirse primero una Nota de Crédito (`NC 03`, `<Codigo>01</Codigo>`).
5. **Aritmética Entera Exacta `BigInt` (5 Decimales)**: Todo cálculo de subtotal, descuento, impuesto IVA escalonado, otros cargos y `TotalComprobante` usa `SCALE_5 = 100000n` (`hacienda-math-and-clave-v44.mjs`) evitando errores IEEE-754 que disparan rechazos por diferencia de `₡0.00001`.
6. **OIDC Mutex Single-Flight y Timeouts**: El cliente OAuth2 hacia Keycloak (`rut-stag` en `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token` con `client_id=api-stag`, o `rut` + `api-prod` en producción; `access_token` `300s`, `refresh_token` `36000s`) usa un lock en memoria por `(tenantId, env)` para que múltiples ventas concurrentes compartan un único refresco de token sin invalidar sesiones.
7. **Archivo Legal 5 Años Inmutable (`Art. 109 CNPT`)**: Todo comprobante emitido guarda `signed.xml`, `mh-response.xml` e `invoice.pdf` en Cloud Storage bajo `/crm_fiscal_archive/{clave}/` (Single-Tenant) o `/tenants/{tenantId}/crm_fiscal_archive/{clave}/` (Multi-Tenant) con `allow delete: if false;` en `storage.rules`.

### 1.1 Contrato del Documento Fiscal y Máquina de Estados (`crm_fiscal_documents`)

```typescript
export type HaciendaDocType = 'FE' | 'ND' | 'NC' | 'TE' | 'CCE' | 'FEC' | 'FEE' | 'REP';
export type HaciendaEnvironment = 'stag' | 'prod';
export type HaciendaSandboxLevel = 'SIMULATED_DGT' | 'LIVE_DGT';

export type FiscalOutboxStatus =
  | 'PRE_SAVED'
  | 'LOCAL_VALIDATION_FAILED'
  | 'DISPATCHING'
  | 'SUBMITTED_PENDING_MH'
  | 'ACCEPTED'
  | 'REJECTED_BY_DGT'
  | 'ANULLED_BY_NC'
  | 'CONVERTED_TO_FE';

export interface CrmFiscalDocument {
  id: string;                 // Igual a clave (50 dígitos) una vez asignada, o pre-{uuid} en PRE_SAVED
  tenantId: string;
  posInvoiceId: string;       // Enlace 1-a-1 con crm_pos_invoices/{id}
  environment: HaciendaEnvironment;
  sandboxLevel?: HaciendaSandboxLevel;
  tipoDoc: HaciendaDocType;
  clave: string;
  consecutivo: string;
  sucursal: string;           // '001'..'999'
  terminal: string;           // '00001'..'99999'
  fechaEmision: string;       // ISO UTC-6 ('yyyy-MM-ddTHH:mm:ss-06:00')
  status: FiscalOutboxStatus;
  replacesRejectedClave?: string | null; // Cuando se reemite tras REJECTED_BY_DGT con TipoDocIR='10'
  creditNoteClave?: string | null;       // Si fue anulada o convertida (TE -> NC + FE)
  convertedToFeClave?: string | null;
  receptor?: {
    nombre: string;
    identificacionTipo?: string;
    identificacionNumero?: string;
    correo?: string;
    codigoActividadReceptor?: string;
  } | null;
  currency: 'CRC' | 'USD';
  exchangeRate: string;       // '1.00000' o BCCR 5 decimales
  totalVenta: string;
  totalDescuentos: string;
  totalVentaNeta: string;
  totalImpuesto: string;
  totalComprobante: string;
  storagePaths: {
    signedXmlPath?: string;
    mhResponseXmlPath?: string;
    pdfPath?: string;
  };
  attempts: Array<{
    attemptNumber: number;
    at: string;
    channel: 'pos_sync' | 'webhook_mh' | 'polling_worker' | 'manual_reissue';
    httpStatus?: number;
    dgtState?: string;
    rawMessage?: string;
    humanizedTitle?: string;
    humanizedAction?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 Secuencias Atómicas Tolerantes a Migración

```typescript
// src/lib/hacienda/sequences.ts
import type { Firestore } from 'firebase-admin/firestore';
import { crmPaths } from '@/lib/utils/crm-paths';

export async function allocateNextFiscalSequence(params: {
  firestore: Firestore;
  tenantId: string;
  tipoDocCode: '01' | '02' | '03' | '04' | '05' | '08' | '09' | '10';
  sucursal: string;   // 3 dígitos ej. '001'
  terminal: string;   // 5 dígitos ej. '00001'
  initialSequence?: number; // Consecutivo base si el cliente viene migrado de otro sistema
}): Promise<{ nextNumber: number; consecutivo20: string }> {
  const { firestore, tenantId, tipoDocCode, sucursal, terminal, initialSequence = 0 } = params;
  const suc = sucursal.padStart(3, '0').slice(-3);
  const term = terminal.padStart(5, '0').slice(-5);
  const seqDocId = `${tipoDocCode}_${suc}_${term}`;
  const seqRef = firestore.doc(`${crmPaths.fiscalSequences(tenantId)}/${seqDocId}`);

  const nextNumber = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(seqRef);
    const currentLast = snap.exists ? Number(snap.data()?.lastValue ?? 0) : 0;
    const base = Math.max(currentLast, Math.max(0, Math.floor(initialSequence)));
    const next = base + 1;
    tx.set(
      seqRef,
      {
        tipoDocCode,
        sucursal: suc,
        terminal: term,
        lastValue: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return next;
  });

  const consecutivo20 = `${suc}${term}${tipoDocCode}${String(nextNumber).padStart(10, '0')}`;
  return { nextNumber, consecutivo20 };
}
```

---

## 2. Los 4 Modos del POS en Costa Rica y `HaciendaCrNativePosAdapter`

El POS (`CrmRightPanel` → pestaña `'pos'`) conserva su interfaz desacoplada y opera `Modo B1 (mode: 'hacienda_cr_v44')` soportando **4 comportamientos operativos** desde el mismo carrito:

| Modo Operativo POS | Comportamiento Fiscal | Consecutivo DGT | `<Receptor>` | Endpoint / Acción |
| :--- | :--- | :---: | :--- | :--- |
| **`QUOTE`** (Cotización / Proforma) | Solo guarda estimado en `crm_pos_estimates` + PDF comercial. | No | Opcional | `adapter.createEstimate()` |
| **`INTERNAL_INVOICE`** (Factura Interna) | Registra venta operativa en `crm_pos_invoices` sin envío a Hacienda. | No | Opcional | `adapter.createInvoice({ fiscalDocumentMode: 'INTERNAL_INVOICE' })` |
| **`TE`** (`04` Tiquete Electrónico) | Mostrador / consumidor final; envío oficial v4.4 por Outbox. | Sí (`04`) | Opcional | `adapter.createInvoice({ isElectronic: true, fiscalDocumentMode: 'TE' })` |
| **`FE`** (`01` Factura Electrónica) | Crédito fiscal completo; valida `<Identificacion>`, `<Correo>`, `<CodigoActividadReceptor>`. | Sí (`01`) | **Obligatorio** | `adapter.createInvoice({ isElectronic: true, fiscalDocumentMode: 'FE' })` |

### 2.1 Contrato `HaciendaCrNativePosAdapter`

```typescript
// src/lib/pos/adapters/hacienda-cr-adapter.ts
import type {
  CreatePosEstimateInput,
  CreatePosInvoiceInput,
  PosCatalogItem,
  PosContactMatch,
  PosContactProfile,
  PosProviderAdapter,
} from '@/lib/pos/types';

export class HaciendaCrNativePosAdapter implements PosProviderAdapter {
  readonly mode = 'hacienda_cr_v44' as const;

  constructor(private readonly tenantId: string) {}

  async searchCatalog(query: string): Promise<PosCatalogItem[]> {
    // 1. Consulta productos activos en crmPaths.catalogProducts(this.tenantId)
    // 2. Garantiza cabysCode (13 dígitos) y tarífa IVA v4.4 en cada ítem
    // ...implementación sobre Firestore Admin + cache CABYS...
    return [];
  }

  async lookupContactByIdentification(idNumber: string): Promise<PosContactMatch> {
    // 1. Busca coincidencia exacta en CRM contactos por fiscalId para evitar duplicados
    // 2. Si no existe localmente, consulta https://api.hacienda.go.cr/fe/ae?identificacion=<idNumber>
    //    para autocompletar nombre legal, tipo de cédula y actividades económicas v4.4
    return { matched: false };
  }

  async upsertContactFiscalProfile(profile: PosContactProfile): Promise<{ id: string }> {
    // Valida regex de cédula según tipo (01..05) y persiste en contacto del CRM
    return { id: '' };
  }

  async createEstimate(input: CreatePosEstimateInput) {
    // Crea documento en crm_pos_estimates sin tocar crm_fiscal_sequences
    return { estimateId: '', number: '', pdfUrl: '' };
  }

  async createInvoice(input: CreatePosInvoiceInput) {
    // Orquesta los 7 pasos:
    // 1) Verifica modo ('INTERNAL_INVOICE' | 'TE' | 'FE')
    // 2) Escribe PRE_SAVED en crm_pos_invoices + crm_fiscal_documents
    // 3) Valida CABYS (13 dígitos) y reglas de <Receptor>
    // 4) Ejecuta buildComprobanteXmlV44() + validateXmlAgainstXsdV44()
    // 5) Asigna consecutivo atómico y clave (50 dígitos UTC-6)
    // 6) Firma XAdES-EPES (signXmlXadesEpesV44) y archiva signed.xml en /crm_fiscal_archive/{clave}/
    // 7) Despacha a TRIBU-CR (o SIMULATED_DGT según sandboxLevel) pasando a SUBMITTED_PENDING_MH
    return { invoiceId: '', clave: '', consecutivo: '', status: 'SUBMITTED_PENDING_MH' };
  }
}
```

### 2.2 Flujo Atómico de Conversión `TE -> NC + FE` (`POST /api/crm/pos/convert-te-to-fe`)

Cuando un cliente pidió tiquete de caja (`TE 04`) y luego solicita factura con crédito fiscal (`FE 01`), **NO** se borra el tiquete ni se usa `TipoDocIR="10"`:

1. **Precondición**: Verificar que el documento fiscal `TE` en `crm_fiscal_documents` pertenezca al `tenantId` y tenga `status === 'ACCEPTED'` (si sigue `SUBMITTED_PENDING_MH`, esperar liquidación vía polling antes de anular).
2. **Paso A — Nota de Crédito (`NC 03`)**: Emitir `NC` por el monto total del `TE` con:
   - `<InformacionReferencia><TipoDocIR>04</TipoDocIR><Numero>{claveTE}</Numero><FechaEmisionIR>{fechaTE}</FechaEmisionIR><Codigo>01</Codigo><Razon>Sustitución de Tiquete Electrónico por Factura Electrónica a solicitud del receptor</Razon></InformacionReferencia>`.
   - Marcar `TE.status = 'CONVERTED_TO_FE'` y guardar `TE.creditNoteClave`.
3. **Paso B — Nueva Factura Electrónica (`FE 01`)**: Emitir la nueva `FE` con el perfil completo del `<Receptor>` (`Identificacion`, `CorreoElectronico`, `CodigoActividadReceptor`) y referencia al tiquete anulado usando **`<Codigo>07</Codigo>`** (*Factura electrónica emitida en sustitución de tiquete electrónico*).

---

## 3. Matriz `<Receptor>`, APIs Públicas Hacienda, Reglas de Crédito v4.4 y Medios de Pago

### 3.1 Validación Estricta de `<Receptor>` (v4.4)

| `Identificacion.Tipo` | Documento CR | Regla Longitud / Formato Exacto | Campo XSD Especial en v4.4 |
| :---: | :--- | :--- | :--- |
| **`01`** | Cédula Física | Exactamente `9` dígitos (`^[1-9]\d{8}$`, sin ceros al inicio ni guiones). | `<Identificacion><Tipo>01</Tipo><Numero>...</Numero></Identificacion>` |
| **`02`** | Cédula Jurídica | Exactamente `10` dígitos (`^\d{10}$`). | Obligatorio `<CodigoActividadReceptor>` (6 dígitos) en `FE` si es contribuyente activo. |
| **`03`** | DIMEX | `11` o `12` dígitos (`^\d{11,12}$`). | `<Identificacion><Tipo>03</Tipo>...</Identificacion>` |
| **`04`** | NITE | Exactamente `10` dígitos (`^\d{10}$`). | `<Identificacion><Tipo>04</Tipo>...</Identificacion>` |
| **`05`** | Extranjero No Domiciliado | No usa `<Identificacion>` estándar sino `<IdentificacionExtranjero>` (`1..20` chars). | En `FEE 09` obligatorio; en `FE` usar `<IdentificacionExtranjero>` si aplica. |

> **Cambios clave obligatorios v4.4 en el XML** (implementados en `scripts/hacienda-xml-builder-v44.mjs`):
> - `<ProveedorSistemas>` (`10..12` dígitos) en cabecera raíz.
> - `<CodigoActividadEmisor>` (`6` dígitos) reemplaza a `<CodigoActividad>` antiguo.
> - `<CodigoActividadReceptor>` (`6` dígitos) en `<Receptor>` cuando aplica.
> - `<MedioPago>` vive ahora **dentro de `<ResumenFactura>`** (`01` Efectivo, `02` Tarjeta, `03` Cheque, `04` Transferencia/Depósito, `05` Recaudado por terceros, **`06` SINPE Móvil**, **`07` Plataforma Digital**, `99` Otros).
> - `<TotalDesgloseImpuesto>` obligatorio por tarifa IVA utilizada en `<ResumenFactura>`.

### 3.2 APIs Públicas de Hacienda CR (Cero OAuth Requerido)

Todas deben consultarse desde el backend (`/api/crm/hacienda/public/*`) con timeout corto (`4s`) y caché en memoria/Firestore para no bloquear al cajero:

- **Situación Tributaria y Actividades Económicas**: `GET https://api.hacienda.go.cr/fe/ae?identificacion={id}` → devuelve nombre oficial, estado tributario y arreglo de actividades económicas (`codigo`, `descripcion`) para autocompletar `<CodigoActividadReceptor>`.
- **Catálogo CABYS Oficial (`13` dígitos)**: `GET https://api.hacienda.go.cr/fe/cabys?q={texto}` o `?codigo={13_digitos}` → devuelve códigos CABYS vigentes y tasa IVA oficial.
- **Validación de Exoneraciones**: `GET https://api.hacienda.go.cr/fe/ex?autorizacion={numeroDocumento}`.
- **Tipo de Cambio Dólar BCCR/Hacienda**: `GET https://api.hacienda.go.cr/indicadores/tc/dolar` → autocompleta `<TipoCambio>` (`5` decimales) cuando el POS factura en `USD`.

### 3.3 Reglas de Ventas a Crédito y Recibo Electrónico de Pago (`REP 10`)

| Escenario | `CondicionVenta` Original | `PlazoCredito` | Documento de Cobro Posterior (`REP 10`) | Referencia DGT Obligatoria |
| :--- | :---: | :---: | :--- | :--- |
| **Crédito Estándar** | **`02`** (Crédito) | `1..90` días | No requiere `REP 10`; el IVA se declara al emitir la `FE`. | Pagos internos en `crm_pos_payments`. |
| **Crédito IVA 90 días (Art. 27 LIVA)** | **`10`** | Hasta `90` días | Al recibir el abono/pago se emite **`REP 10`** con **`CondicionVenta="11"`** (*Pago de venta a crédito en IVA 90 días*). | `<TipoDocIR>01</TipoDocIR>`, `<Codigo>04</Codigo>` apuntando a la `clave` de la `FE`. |
| **Venta a Crédito al Estado** | **`08`** | Contractual | Al recibir pago de institución estatal se emite comprobante / abono con **`CondicionVenta="09"`** (*Pago del servicios prestado al Estado*). | Referencia documental al comprobante origen. |

---

## 4. Firma Criptográfica XAdES-EPES v4.4 y Empaquetado Cloud Run

### 4.1 Las 5 Trampas Mortales que Causan Rechazo de Firma en DGT

1. **Policy URI & Hash SHA-256 Incorrecto**: Toda firma v4.4 exige en `<SignaturePolicyIdentifier>` exactamente:
   - URL: `https://cdn.comprobanteselectronicos.go.cr/xml-schemas/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf`
   - DigestValue (SHA-256 Base64): `DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=`
2. **Canonicalización Inclusiva (`C14N`) Obligatoria**: `<SignedInfo>` y los bloques `<SignedProperties>` deben canonicalizarse con W3C `C14N` inclusivo (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`), **nunca** Exclusive C14N sobre todo el nodo raíz.
3. **Byte-Fidelity Post-Firma**: Prohibido usar `prettier`, formateadores XML o cambiar `\n` / BOM UTF-8 tras calcular los digests y firmar `SignedInfo`.
4. **OpenSSL 3 vs `.p12` Legados de BCCR / TRIBU-CR**: Los archivos `.p12` emitidos en Costa Rica suelen usar cifrado `RC2-40-CBC` o `3DES`. En Node/Linux con OpenSSL 3+, cualquier invocación sin **`-legacy`** falla con `unsupported algorithm`.
5. **Conversión del Serial X.509 a Decimal Sin Pérdida**: `<X509SerialNumber>` exige entero decimal (`BigInt('0x' + hexSerial).toString(10)`). Truncarlo como `Number` JS corrompe números serie de `128+` bits.

### 4.2 Dos Rutas de Ejecución y `Dockerfile` Recomendado

| Ruta | Dependencias | Ventajas | Cuándo usarla |
| :--- | :--- | :--- | :--- |
| **Ruta A — Nativa CLI (Recomendada Cloud Run)** | `openssl` + `libxml2-utils` (`xmllint`) | Usa `sign-and-validate-v44.mjs` exacto (`--legacy` + `--c14n` + `--nonet --schema`), verificación criptográfica real con `crypto.createVerify('RSA-SHA256')`. | Cloud Run / Docker / App Hosting con Dockerfile propio. |
| **Ruta B — Pure-JS Serverless** | `node-forge` + `@xmldom/xmldom` + `xml-crypto` | No depende de binarios nativos del SO; ideal si se despliega en runtimes gestionados sin `apt-get`. | Firebase Functions / Cloud Run sin Dockerfile custom. |

Fragmento obligatorio para `Dockerfile` en Cloud Run (Ruta A):

```dockerfile
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl \
  libxml2-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Copiar también resources/xmldsig-core-schema.xsd y resources/xsd/v4.4/*.xsd al runtime
COPY resources ./resources
```

---

## 5. Webhooks Asíncronos Zero-Trust + Reconciliación Idempotente

La DGT nunca procesa facturas síncronamente con garantías de confirmación inmediata: `POST /recepcion/v1/recepcion` retorna `202 Accepted` y notifica el veredicto XML a `callbackUrl` minutos o segundos después (o requiere polling).

### 5.1 Los 4 Anillos de Seguridad del Webhook DGT

Endpoint público: `POST /api/crm/webhooks/hacienda/[tenantId]/[env]/[mac]`

1. **Anillo 1 — Verificación de MAC en URL + Límites de Red**:
   - Validar tamaño máximo de body (`<= 512 KB`) y rate-limit por IP.
   - Calcular `expectedMac = HMAC-SHA256(TENANT_MASTER_KEY, "${tenantId}:${env}:hacienda-cb").slice(0, 32)` y validar con `crypto.timingSafeEqual`. Cualquier discrepancia devuelve `401` antes de leer Firestore.
2. **Anillo 2 — Parsing Seguro y Pertenencia de Clave**:
   - Validar formato de `clave` (`^\d{50}$`), `ind-estado` y decodificar `respuesta-xml` (`Buffer.from(..., 'base64').toString('utf8')`) verificando que no contenga `<!DOCTYPE` ni `<!ENTITY` (protección anti-XXE).
   - Confirmar que exista `crm_fiscal_documents/{clave}` bajo el `tenantId` y `environment === env`.
3. **Anillo 3 — Validación Criptográfica de `<MensajeHacienda>`**:
   - Verificar firma XMLDSig de la respuesta MH (`respuesta-xml`) y consistencia de `<Clave>` + `<Mensaje>` (`1=Aceptado`, `3=Rechazado`) respecto al JSON del payload.
4. **Anillo 4 — Convergencia Atómica (`settleFiscalAttemptAtomically`)**:
   - Tanto el webhook como el **Worker de Polling (`60s` / Cloud Scheduler)** invocan exactamente la misma función transaccional idempotente:
     - Si `status` ya es terminal (`ACCEPTED`, `REJECTED_BY_DGT`, `CONVERTED_TO_FE`, `ANULLED_BY_NC`), ignora duplicados (`idempotent_noop`).
     - Si cambia a `ACCEPTED`: archiva `mh-response.xml` en `/crm_fiscal_archive/{clave}/`, genera y archiva `invoice.pdf`, actualiza `crm_pos_invoices` y encola envío opcional por WhatsApp/Email.
     - Si cambia a `REJECTED_BY_DGT`: humaniza el rechazo con `humanizeDgtError()` de `scripts/dgt-error-humanizer.mjs`, guarda los intentos y activa la alerta en `<FiscalHealthBanner />` con botón de reemisión segura (`TipoDocIR="10"`).

---

## 6. Bóveda Write-Only AES-256-GCM, UI de 3 Tarjetas, `verify-and-activate` y Sandbox Dual

### 6.1 Modos de Custodia de Credenciales y `.p12`

- **Modo A (`.env` / GCP Secret Manager)**: Para infraestructura dedicada por cliente único usando `HACIENDA_STAG_*` / `HACIENDA_PROD_*`.
- **Modo B (Bóveda Write-Only AES-256-GCM + HKDF + AAD)**: El recomendado para despliegues CRM replicables. Extiende `ResolvedCrmIntegrations` con el slot `haciendaCr` con sub-slots `stag` y `prod`:

```typescript
export interface HaciendaEnvSecrets {
  enabled: boolean;
  sandboxLevel?: 'SIMULATED_DGT' | 'LIVE_DGT';
  clientId: 'api-stag' | 'api-prod';
  username: string;
  password: string;
  p12Base64: string;
  p12Pin: string;
  p12ExpiresAt?: string;       // Extraído automáticamente del X.509 al guardar
  p12SubjectCn?: string;
  sucursal: string;            // Default '001'
  terminal: string;            // Default '00001'
  proveedorSistemas: string;   // Cédula del proveedor del sistema
  codigoActividadEmisor: string;
  initialSequences?: Partial<Record<'01' | '02' | '03' | '04' | '08' | '09' | '10', number>>;
  webhookHmacSecret?: string;
}

export interface HaciendaCrSecretsBundle {
  activeEnv: 'stag' | 'prod';
  emisor: {
    nombre: string;
    identificacionTipo: '01' | '02' | '03' | '04';
    identificacionNumero: string;
    correo: string;
    telefonoCodigoPais?: string;
    telefonoNumero?: string;
    ubicacion: { provincia: string; canton: string; distrito: string; otrasSenas: string };
  };
  stag: HaciendaEnvSecrets;
  prod: HaciendaEnvSecrets;
}
```

> **Regla Write-Only estricta**: El endpoint `GET /api/crm/hacienda/settings` **NUNCA** retorna `password`, `p12Base64` ni `p12Pin`; solo retorna metadatos seguros (`hasPassword`, `hasP12Configured`, `p12ExpiresAt`, `p12SubjectCn`, `usernameMasked`, `activeEnv`, `sandboxLevel`).

### 6.2 Interfaz Token-Pure `SettingsFiscalHacienda.tsx` (3 Tarjetas, `< 500` Líneas)

Registrada en `SettingsLayout` bajo el `tabId: 'fiscal_hacienda'` con permiso **`crm.settings.fiscal`** y módulo licenciado **`hacienda_cr`**. Todo ícono usa `<AppIcon name="fiscal" />` y toda clase usa tokens semánticos:

```tsx
// Fragmento estructural token-pure (cero HEX fijos, cero Tailwind de color quemado)
<section className="space-y-6">
  <FiscalHealthBanner alerts={proactiveAlerts} onReissue={(docId) => setDrawerDocId(docId)} />

  <div className="grid gap-4 lg:grid-cols-3">
    {/* Tarjeta 1: Identidad Tributaria y Certificado PKI (.p12) */}
    <article className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-center gap-2.5">
        <AppIcon name="fiscal" className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">1. Identidad y Certificado PKI (.p12)</h3>
      </header>
      {/* Campos Emisor + dropzone .p12 write-only + input PIN + badge p12ExpiresAt + botón Lab .p12 (solo stag) */}
    </article>

    {/* Tarjeta 2: Credenciales TRIBU-CR (Stag / Prod) y Consecutivos Iniciales */}
    <article className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-center gap-2.5">
        <AppIcon name="key" className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">2. Credenciales TRIBU-CR y Secuencias</h3>
      </header>
      {/* Tabs stag/prod, username/password write-only, sucursal/terminal, initialSequences FE/TE/NC/REP */}
    </article>

    {/* Tarjeta 3: Modo Sandbox Dual, Activación y Callback */}
    <article className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-center gap-2.5">
        <AppIcon name="check" className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">3. Verificación y Activación</h3>
      </header>
      {/* Toggle SIMULATED_DGT vs LIVE_DGT (stag) vs Producción + Botón "Verificar y Activar" */}
    </article>
  </div>
</section>
```

### 6.3 Endpoint `POST /api/crm/admin/hacienda/verify-and-activate` (5 Checks, 0 Secuencias Quemadas)

Antes de habilitar el switch `hacienda_cr` para los cajeros POS, este endpoint ejecuta **5 verificaciones** sin enviar ningún comprobante real a la DGT:

1. **Check PKI `.p12`**: Decodifica el `.p12` guardado con el `p12Pin`, extrae `notAfter` y `serialNumber`, falla si está vencido o si el PIN es incorrecto.
2. **Check Preflight TLS/DNS (`preflight-and-drift-sentinel.mjs`)**: Verifica conectividad limpia y versión de política XAdES v4.4.
3. **Check OIDC Keycloak (`rut-stag` o `rut`)**: Ejecuta autenticación OAuth2 ROPC real obteniendo un `access_token` válido (salvo si el cliente eligió `SIMULATED_DGT`).
4. **Check Firma + XSD en Memoria**: Construye un borrador sintético de `TE` con secuencia `0`, lo firma con `signXmlXadesEpesV44()` y lo valida localmente contra `TiqueteElectronico_V4.4.xsd` (`validateXmlAgainstXsdV44()`), verificando además `cryptoVerified: true`.
5. **Check Permisos Firebase**: Valida escritura/lectura en `crm_fiscal_sequences` y existencia del prefijo de archivo `/crm_fiscal_archive/` en Cloud Storage.

### 6.4 Dos Niveles de Sandbox

- **`SIMULATED_DGT` (Lab Instantáneo)**: Corre Build XML + Firma XAdES-EPES + Validación XSD v4.4 real en local, guarda el `.xml` firmado y dispara localmente el ciclo `SUBMITTED_PENDING_MH` -> `ACCEPTED`/`REJECTED_BY_DGT` para capacitar cajeros y probar flujos `TE -> NC + FE` o `REP 10` sin internet ni credenciales TRIBU-CR reales.
- **`LIVE_DGT` (`env: 'stag'`)**: Firma con `.p12` de sandbox y transmite al endpoint real `https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion` esperando el callback real del Ministerio de Hacienda.

---

## 7. UX de Alertas Proactivas, Traductor DGT y Troubleshooting

Toda UI POS y de Configuración consume `humanizeDgtError()` y `buildProactiveVisualAlerts()` de `scripts/dgt-error-humanizer.mjs` para evitar mostrar trazas SOAP/XML crudas al usuario:

```tsx
// Componente Token-Pure <FiscalHealthBanner />
import { AppIcon } from '@/components/crm/AppIcon';

export function FiscalHealthBanner({ alerts, onOpenSettings, onInspectDoc }: Props) {
  if (!alerts.length) return null;
  const top = alerts[0];
  const toneClass =
    top.severity === 'critical'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-warning/40 bg-warning/15 text-warning';

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${toneClass}`}>
      <div className="flex items-center gap-2.5">
        <AppIcon name={top.severity === 'critical' ? 'shieldAlert' : 'warning'} className="h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{top.title}</p>
          <p className="opacity-90">{top.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {top.actionLabel && (
          <button
            type="button"
            onClick={() => (top.targetDocId ? onInspectDoc(top.targetDocId) : onOpenSettings())}
            className="rounded-md bg-card px-2.5 py-1 font-medium text-foreground shadow-sm hover:bg-muted"
          >
            {top.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

### Checklist Rápido de Troubleshooting v4.4

| Síntoma / Error DGT | Causa Raíz Usual | Solución Aplicada en este Blueprint |
| :--- | :--- | :--- |
| `Error HTTP 400 - XML no cumple con el esquema XSD` (`<MedioPago>` / `<CodigoActividad>`) | Estructura v4.3 mezclada con v4.4. | Usar `hacienda-xml-builder-v44.mjs` + `validateXmlAgainstXsdV44()` previo al envío. |
| `Error HTTP 400 - Firma inválida` | C14N incorrecto, SHA-256 de política antiguo v4.3 o formateo post-firma. | Usar `signXmlXadesEpesV44()` con `POLICY_V44` (`DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=`) y cero alteración del XML firmado. |
| `openssl pkcs12: unsupported algorithm` | OpenSSL 3 en Linux rechazando cifrado `RC2` del `.p12` BCCR. | Flag `-legacy` ya incluido en `sign-and-validate-v44.mjs` (o fallback Pure-JS `node-forge`). |
| `El comprobante ya fue recibido anteriormente` | Reintento enviando la misma `clave` de 50 dígitos tras un `REJECTED_BY_DGT`. | Prohibido reutilizar clave; emitir nueva secuencia referenciando la clave anterior con `TipoDocIR="10"`. |
| Diferencia de montos `TotalComprobante` | Redondeos `float` JS en líneas con descuento + IVA. | Usar `sumScaled5()` y `BigInt` (`SCALE_5`) de `hacienda-math-and-clave-v44.mjs`. |
