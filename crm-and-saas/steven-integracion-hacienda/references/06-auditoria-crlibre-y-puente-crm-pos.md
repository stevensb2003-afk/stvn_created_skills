# 06 — Auditoría Forense de `CRLibre/API_Hacienda` y Puente nativo con CRM / POS

Referencia permanente sobre el repositorio clonado localmente en `~/.gemini/antigravity/scratch/hacienda-cr/API_Hacienda` (rama `v4.4`, commit `28a080a`) y cómo conectar el motor nativo v4.4 en tus sistemas contables, CRMs o POS.

---

## 1. Mapa Completo del Repositorio Local `CRLibre/API_Hacienda`

El repositorio quedó guardado permanentemente en tu Mac en:
`~/.gemini/antigravity/scratch/hacienda-cr/API_Hacienda`

| Ruta en `API_Hacienda` | Qué hace | Veredicto Técnico de nuestra Auditoría |
|---|---|---|
| `www/xsd/*_V4.4.xsd` + `xmldsig-core-schema.xsd` | Los **10 esquemas XSD oficiales v4.4** de Hacienda (`FE`, `ND`, `NC`, `TE`, `FEC`, `FEE`, `REP`, `MR`, `MH`, `Tipos`). | **ORO PURO.** Ya están copiados también dentro de este skill (`resources/xsd/v4.4/`) porque el CDN directo de Hacienda bloquea descargas de `.xsd` con CloudFront `403`. |
| `www/api.php` | Router HTTP único (`?w=modulo&r=metodo`) que recibe parámetros por `POST`/`GET`. | **Inseguro para producción:** expone `Access-Control-Allow-Origin: *` y `ini_set('display_errors', 1)`. |
| `api/contrib/clave/clave.php` | Arma el consecutivo de 20 dígitos y la clave de 50 dígitos. | **Incompleto en v4.4:** soporta `FE`, `ND`, `NC`, `TE`, `CCE`, `CPCE`, `RCE`, `FEC`, `FEE`, pero **olvidó agregar `REP` (`10`)**. |
| `api/contrib/genXML/xmlGenerator.php` | Genera el XML de los comprobantes en PHP con `DOMDocument`. | **Útil como referencia de lectura**, pero **no soporta `REP` (`10`)** y delega al llamador cuadrar varios totales sin aritmética entera a 5 decimales. |
| `api/contrib/firmarXML/` (`firmar.php` + `hacienda/firmador.php` + `xmlseclibs/`) | Firmador XAdES-EPES que actualmente sí usa `firmar` en v4.4 (`setSignPolicy` con el hash `DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=`). | **Referencia criptográfica clave.** De aquí confirmamos el URL y el hash SHA-256 de la política v4.4 (que además verificamos en vivo descargando el PDF oficial de Hacienda). |
| `api/contrib/signXML/Firmadohaciendacr.php` | Firmador viejo heredado de versiones anteriores y de facturación DIAN Colombia (`sts.dian.gov.co`). | **CÓDIGO ROTO / LEGACY — NO USAR:** línea 175 llama `stringHex2StringDec()` sin `$this->` (Fatal Error en PHP 8+), no conoce tipos `08`, `09` ni `10`, y arrastra namespaces colombianos. |
| `api/contrib/token/mhToken.php` | Pide token OAuth2 a `idp.comprobanteselectronicos.go.cr`. | **Riesgo de Seguridad MITM + Bug cURL:** tiene `CURLOPT_SSL_VERIFYPEER => false` y `CURLOPT_SSL_VERIFYHOST => false`, y asigna un string a `CURLOPT_HEADER` (que en PHP espera booleano) en vez de `CURLOPT_HTTPHEADER`. |
| `api/contrib/send/send.php` y `api/contrib/consultar/consultar.php` | Envían y consultan comprobantes en `api-sandbox` / `api`. | **Riesgos y bugs:** SSL deshabilitado (`VERIFYPEER = false`), typo `function consutar()`, variable indefinida `$apiTo` en `consultar.php`, y header `Postman-Token` hardcodeado. |
| `api/contrib/crlibreall/crlibreall.php` | Supuesto endpoint "todo en uno" (`allFE`, `allNC`, `allND`). | **VACÍO (Stubs sin implementar):** `function allFE() {}` está literalmente en blanco. |
| `api/modules/crypto/crypto.php` | Cifrado interno de archivos temporales. | **Criptográficamente débil y con bug:** usa `aes-256-cbc` sin autenticación MAC y pasa `$key` en Base64 crudo a `openssl_encrypt` en vez de `$encryption_key` decodificado. |
| `LICENSE` | Licencia **GNU AGPL v3**. | **Riesgo Legal SaaS:** AGPLv3 obliga a liberar el código fuente completo de cualquier aplicación web/SaaS que incorpore o modifique directamente su código PHP. |

### Conclusión Estratégica
- **Conservamos `CRLibre/API_Hacienda` en tu Mac** como enciclopedia de consulta y fuente de los XSD v4.4.
- **Para tus aplicaciones reales**, usa **nuestro motor nativo clean-room en Node.js/TypeScript (`scripts/sign-and-validate-v44.mjs`)**: cero PHP, cero licencia viral AGPLv3, TLS verificado al 100%, bóveda `AES-256-GCM`, y **8 de 8 tipos de comprobante v4.4 pasando XSD al 100%**.

---

## 2. Puente Directo con tu Arquitectura CRM / POS (`PosProviderAdapter`)

Si estás integrando Hacienda dentro de un CRM con módulo POS (como el contrato `PosProviderAdapter` de `steven-waba-dualhook-connection`) o dentro de tu propio sistema contable standalone, aquí tienes el adaptador limpio que une tu carrito de ventas con el Outbox Fiscal de Hacienda:

```ts
export interface FiscalSaleInput {
  tenantId: string;
  crmOrderId: string;           // ID permanente de tu orden/venta en CRM
  idempotencyKey: string;       // UUID generado por la UI al pulsar Cobrar
  tipoDoc: 'FE' | 'TE' | 'NC' | 'ND' | 'FEC' | 'FEE' | 'REP';
  receptor?: {
    nombre: string;
    identificacionTipo: '01' | '02' | '03' | '04' | '05' | '06';
    identificacionNumero: string;
    codigoActividad?: string;   // 6 dígitos CIIU4 si deduce gasto/crédito en FE
    correo?: string;
    telefono?: { codigoPais?: string; numero: string };
    ubicacion?: { provincia: string; canton: string; distrito: string; barrio?: string; otrasSenas: string };
    otrasSenasExtranjero?: string;
  };
  condicionVenta: '01' | '02' | '10' | '11' | '99';
  plazoCredito?: number;
  moneda?: { codigo: 'CRC' | 'USD' | 'EUR'; tipoCambio: string };
  mediosPago: Array<{ tipo: '01' | '02' | '03' | '04' | '06' | '07' | '99'; monto?: string; otros?: string }>;
  items: Array<{
    sku?: string;
    codigoCABYS: string;        // 13 dígitos validados contra /fe/cabys
    detalle: string;
    cantidad: number;
    unidadMedida: string;       // 'Sp' servicios, 'Unid' mercancías, etc.
    precioUnitario: string;     // Decimal exacto en string, ej. "25000.00000"
    descuentoMonto?: string;
    tarifaIVA?: 0 | 0.5 | 1 | 2 | 4 | 8 | 13;
    codigoTarifaIVA?: '01' | '02' | '03' | '04' | '07' | '08' | '09' | '10';
  }>;
  replacesRejectedClave?: {     // Se llena automáticamente al pulsar "Corregir y Re-emitir"
    clave: string;
    fechaEmision: string;
  };
}
```

### Flujo Exacto de `emitOrQueueInvoice(input)` (7 Pasos Atómicos)
1. **Upsert Idempotente en CRM (`PRE_SAVED`)**: Si `idempotencyKey` ya existe, devuelve el estado actual sin duplicar nada. Si es nueva, guarda la orden comercial en firme en DB.
2. **Resolución de Credenciales (`resolveHaciendaCredentials(tenantId)`)**: Obtiene `.p12`, `PIN`, `IdP` y datos del emisor desde la Bóveda `AES-256-GCM` (Modo B) o desde `.env` (Modo A).
3. **Pre-Chequeo de Certificado**: Si el `.p12` está vencido o no está configurado, deja la orden en `QUEUED_CONTINGENCY`, dispara alerta visual roja y **termina sin perder la venta**.
4. **Pre-Validación XSD en Borrador**: Construye un borrador con secuencia simulada, lo firma en memoria o valida estructura y montos `BigInt` antes de tocar el contador real. Si hay un error de formato local (ej. CABYS de 10 dígitos en vez de 13), marca `LOCAL_VALIDATION_FAILED` con mensaje amigable **sin quemar consecutivo**.
5. **Reserva Atómica de Consecutivo + Firma `XAdES-EPES` (`SIGNED_LOCKED`)**: Incrementa `fiscal_sequences` en transacción atómica, genera `Clave` (50) y `Consecutivo` (20) definitivos, inyecta `<InformacionReferencia>` `TipoDocIR="10"` si `replacesRejectedClave` está presente, firma con `signXmlXadesEpesV44`, valida contra XSD oficial con `validateXmlAgainstXsdV44`, y persiste el XML firmado en DB + Object Storage.
6. **Transmisión Resiliente a Hacienda**: Obtiene JWT cacheado (`IdP`) y envía `POST /recepcion/v1/recepcion/`.
   - `202 Accepted` -> `SUBMITTED_PROCESSING` + encola job de consulta (`GET /recepcion/{clave}`).
   - Error de red / `5xx` / `429` -> `QUEUED_CONTINGENCY` (reintento automático con la **misma `Clave`**).
7. **Resolución Final (`ACCEPTED` o `REJECTED_BY_HACIENDA`)**: Guarda `MensajeHacienda` XML decodificado en `attemptHistory[]`, actualiza alertas de obsolescencia si aplica, y si fue `ACCEPTED`, genera PDF con QR y envía el trío legal (`PDF + XML Firmado + XML Respuesta Hacienda`) al correo del cliente.
