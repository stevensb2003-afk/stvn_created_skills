# 01 — Protocolo DGT v4.4, Onboarding TRIBU-CR, OAuth2 OIDC, Clave de 50 Dígitos y Endpoints

Referencia normativa y operativa verificada en vivo contra la infraestructura del Ministerio de Hacienda de Costa Rica (`MH-DGT-RES-0027-2024`, ecosistema **TRIBU-CR** vigente tras el apagado de ATV en octubre de 2025).

---

## 1. Desmitificando la Integración con Hacienda (¿Es obligatorio usar PHP?)

**Mito común:** *"Hacienda trabaja en PHP"*.
**Realidad técnica:** El repositorio comunitario `CRLibre/API_Hacienda` fue escrito en PHP hace años, pero **el Ministerio de Hacienda es 100% agnóstico del lenguaje de programación**. Sus servidores exponen únicamente estándares abiertos bancarios/gubernamentales:

1. **Autenticación OAuth2 / OpenID Connect (`Keycloak`)**: Petición `POST` `application/x-www-form-urlencoded` que devuelve un `access_token` JWT (`Bearer`) y un `refresh_token`.
2. **XML v4.4 (`UTF-8`)**: Documento estructurado conforme a los 10 esquemas XSD oficiales versión 4.4 (`MH-DGT-RES-0027-2024`).
3. **Firma Criptográfica `XAdES-EPES` (`RSA-SHA256` + `W3C C14N`)**: Firma digital incrustada (`enveloped`) generada con la **Llave Criptográfica `.p12`** (PKCS#12) del contribuyente y su PIN de 4 dígitos.
4. **Transporte JSON REST sobre TLS 1.2+**: El XML firmado se codifica en `Base64` dentro del atributo `comprobanteXml` y se envía por `POST` a la API de Recepción (`HTTP 202 Accepted` asíncrono).

Puedes implementar tu propio ERP/POS/CRM en **Node.js / TypeScript (Next.js, NestJS, Express, Cloud Run)**, Python, Go, Rust o C# sin tocar PHP ni depender de terceros contables.

---

## 2. Guía Paso a Paso: Cómo Obtener las Credenciales en TRIBU-CR (Pruebas y Producción)

Todo obligado tributario (persona física con actividad lucrativa o persona jurídica) gestiona sus credenciales en el portal **TRIBU-CR** del Ministerio de Hacienda (que sustituyó al antiguo portal ATV):

### Qué necesitas obtener del cliente / emisor (4 artefactos)

| Artefacto | Sandbox / Pruebas (`stag`) | Producción (`prod`) | Uso Técnico |
|---|---|---|---|
| **1. Usuario API (IdP)** | `cpj-3-101-XXXXXX@stag.comprobanteselectronicos.go.cr` *(o `cpf-...` física / `dimex-...`)* | `cpj-3-101-XXXXXX@prod.comprobanteselectronicos.go.cr` | Campo `username` al pedir el JWT OAuth2 (NO es la contraseña del portal web TRIBU-CR). |
| **2. Contraseña API (IdP)** | Generada automáticamente por TRIBU-CR para Sandbox | Generada automáticamente por TRIBU-CR para Producción | Campo `password` al pedir el JWT OAuth2. |
| **3. Llave Criptográfica (`.p12`)** | Archivo `.p12` de Pruebas (Sandbox) descargado en TRIBU-CR | Archivo `.p12` de Producción (validez típica: **2 años**) | Par RSA-2048 + Certificado X.509 emitido por CA Tributaria / SINPE-BCCR para firmar XML (`XAdES-EPES`). **Nota:** No es la tarjeta inteligente de Firma Digital personal para firmar PDFs, sino el archivo `.p12` de *Sello/Llave Criptográfica Tributaria* descargado en TRIBU-CR. |
| **4. PIN de la Llave (`.p12`)** | PIN numérico de 4 dígitos definido al generar el `.p12` de pruebas | PIN numérico de 4 dígitos definido al generar el `.p12` de producción | Desbloquea la llave privada PKCS#12 en memoria al momento de firmar. Si se olvida, no se puede recuperar: hay que revocar y generar un nuevo `.p12`. |

> **Regla Crítica de Ambientes:** Jamás mezcles un `.p12` de Sandbox con credenciales IdP de Producción ni viceversa. Hacienda valida que la cédula del sujeto del certificado X.509 (`SERIALNUMBER=CPJ-3-101-...` o `CPF-...`) coincida exactamente con `<Emisor><Identificacion><Numero>` y con el usuario autenticado en el token Bearer.

---

## 3. Matriz Oficial de Endpoints (Verificados en Vivo)

### 3.1 Autenticación OAuth2 / OIDC (`IdP Keycloak`)

| Parámetro | Ambiente Pruebas (`stag`) | Ambiente Producción (`prod`) |
|---|---|---|
| **Token Endpoint (`POST`)** | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token` | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token` |
| **Logout Endpoint (`POST`)** | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/logout` | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/logout` |
| **OIDC Discovery (`GET`)** | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/.well-known/openid-configuration` | `https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/.well-known/openid-configuration` |
| **`client_id`** | `api-stag` | `api-prod` |
| **`client_secret`** | *(vacío `""` — cliente público)* | *(vacío `""` — cliente público)* |

### 3.2 Recepción y Consulta de Comprobantes (`API Recepción v1`)

| Operación | Ambiente Pruebas (`stag`) | Ambiente Producción (`prod`) |
|---|---|---|
| **Enviar Comprobante (`POST`)** | `https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/` | `https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/` |
| **Consultar Estado (`GET`)** | `https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{clave}` | `https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{clave}` |
| **Listar Comprobantes (`GET`)** | `.../recepcion/v1/comprobantes/?offset=0&limit=50&emisor={id}` | `.../recepcion/v1/comprobantes/?offset=0&limit=50&emisor={id}` |

### 3.3 APIs Públicas Auxiliares de Hacienda (Sin Token — Gratis)

Úsalas para autocompletar datos del cliente en el Frontend/POS, validar códigos CABYS y obtener el Tipo de Cambio oficial del BCCR:

1. **Padrón y Actividades Económicas por Cédula (`GET`)**:
   - `https://api.hacienda.go.cr/fe/ae?identificacion=3101012345`
   - Devuelve `nombre`, `tipoIdentificacion`, `situacion.moroso`, `situacion.omiso`, `situacion.estado`, y `actividades[]`.
   - **Trampa real detectada en producción:** El campo `actividades[].codigo` a veces viene con punto decimal (ej. `"6110.0"` o `"620101"`). Siempre sanitiza (`codigo.replace(/\D/g, '').padStart(6, '0').slice(0, 6)`) y verifica que el contribuyente elija su código CIIU4 de 6 dígitos inscrito en TRIBU-CR.
2. **Catálogo CABYS de 13 dígitos e IVA oficial (`GET`)**:
   - Por texto: `https://api.hacienda.go.cr/fe/cabys?q=software&top=10`
   - Por código exacto: `https://api.hacienda.go.cr/fe/cabys?codigo=4781200000000`
   - Devuelve `{ codigo: "4781200000000", descripcion: "...", impuesto: 13 }`. Úsalo para impedir que un cajero facture un CABYS con tarifa de IVA distinta a la autorizada.
3. **Validación de Exoneraciones EXONET (`GET`)**:
   - `https://api.hacienda.go.cr/fe/ex?autorizacion=AL-00123456-26`
   - Verifica vigencia (`fechaVencimiento`), `porcentajeExoneracion`, `poseeCabys` y lista de CABYS cubiertos antes de aplicar `<Exoneracion>`.
4. **Tipo de Cambio Oficial USD/EUR (`GET`)**:
   - `https://api.hacienda.go.cr/indicadores/tc/dolar` -> `{ venta: { fecha, valor: 448.37 }, compra: { fecha, valor: 442.74 } }`
   - `https://api.hacienda.go.cr/indicadores/tc/euro`
   - **Regla Fiscal IVA/Renta:** Al facturar en `USD`, el `<TipoCambio>` obligatorio en `<CodigoTipoMoneda>` es el tipo de cambio de **VENTA** de referencia del BCCR vigente en el momento de emisión (`fmt5`, ej. `448.37000`).

---

## 4. Gestión Bancaria del Token OAuth2 (Evitando Bloqueos `429` / Límites de Sesión)

El IdP Keycloak de Hacienda tiene límites estrictos de sesiones simultáneas por usuario (`max_active_sessions`). **Error clásico (presente en `CRLibre/API_Hacienda`):** pedir un token nuevo en cada factura sin cachearlo ni cerrarlo provoca bloqueo temporal `HTTP 400/401/429` cuando emites ráfagas de facturas.

### Ciclo de Vida Obligatorio del Token

- `access_token`: dura **300 segundos (5 minutos)** (`expires_in: 300`).
- `refresh_token`: dura **36,000 segundos (10 horas)** (`refresh_expires_in: 36000`).

**Algoritmo recomendado (Cache por `tenantId + environment`):**
1. Si existe `access_token` en memoria/Redis y faltan **más de 60 segundos** para `expiresAt`: **reutilízalo**.
2. Si el `access_token` está por vencer (<60s) pero el `refresh_token` sigue vigente (>120s): haz `POST /token` con `grant_type=refresh_token&client_id={api-stag|api-prod}&refresh_token={rt}`.
3. Solo si no hay sesión o el `refresh_token` expiró: haz `POST /token` con `grant_type=password&client_id={api-stag|api-prod}&username={u}&password={p}`.
4. Usa un **Single-Flight Mutex por Tenant** (`Map<string, Promise<Token>>`) para que si entran 20 ventas concurrentes en el segundo 0, solo 1 petición viaje al IdP y las 19 restantes esperen la misma promesa.

```ts
export async function requestHaciendaToken({ env, username, password, refreshToken }: {
  env: 'stag' | 'prod';
  username: string;
  password?: string;
  refreshToken?: string;
}) {
  const realm = env === 'prod' ? 'rut' : 'rut-stag';
  const clientId = env === 'prod' ? 'api-prod' : 'api-stag';
  const url = `https://idp.comprobanteselectronicos.go.cr/auth/realms/${realm}/protocol/openid-connect/token`;

  const body = new URLSearchParams({ client_id: clientId });
  if (refreshToken) {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);
  } else {
    body.set('grant_type', 'password');
    body.set('username', username);
    body.set('password', password || '');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`IdP Hacienda HTTP ${res.status}: ${errBody}`);
  }
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  }>;
}
```

---

## 5. Anatomía Exacta del `NumeroConsecutivo` (20 dígitos) y `Clave` (50 dígitos)

Cada comprobante emitido (y cada `MensajeReceptor`) tiene dos identificadores numéricos inmutables:

### 5.1 `NumeroConsecutivo` (Exactamente 20 dígitos)

```text
[Sucursal: 3] + [Terminal/Caja: 5] + [TipoComprobante: 2] + [Secuencia: 10]
   001              00001                   01                 0000000042
=> "00100001010000000042"
```

- **Posiciones 1–3 (`Sucursal`)**: `001` casa matriz, `002` sucursal 2, etc.
- **Posiciones 4–8 (`Terminal`)**: `00001` punto de venta / servidor backend 1, `00002` caja 2, etc. *(Tip multi-instancia: asignar una terminal distinta a cada caja física elimina colisiones offline).*
- **Posiciones 9–10 (`TipoComprobante`)** — Catálogo completo v4.4:
  - `01` = **FE** (`FacturaElectronica` — da derecho a crédito fiscal, receptor requerido)
  - `02` = **ND** (`NotaDebitoElectronica` — aumenta saldo o corrige cargos sobre referencia)
  - `03` = **NC** (`NotaCreditoElectronica` — anula o disminuye monto de FE/TE/FEC/FEE previo)
  - `04` = **TE** (`TiqueteElectronico` — consumidor final B2C; receptor opcional)
  - `05` = **CCE** (`MensajeReceptor` — Confirmación de Aceptación Total del comprobante, `Mensaje=1`)
  - `06` = **CPCE** (`MensajeReceptor` — Confirmación de Aceptación Parcial, `Mensaje=2`)
  - `07` = **RCE** (`MensajeReceptor` — Rechazo Total del comprobante, `Mensaje=3`)
  - `08` = **FEC** (`FacturaElectronicaCompra` — emitida por el comprador cuando adquiere bienes/servicios a un no obligado tributario / régimen simplificado)
  - `09` = **FEE** (`FacturaElectronicaExportacion` — venta de bienes o servicios al exterior, tarifa exenta `0%`)
  - `10` = **REP** (`ReciboElectronicoPago` — **NUEVO EN v4.4**: obligatorio al recibir pagos parciales o totales en ventas a crédito de IVA hasta 90 días Art. 27 LIVA o ventas a crédito al Estado)
- **Posiciones 11–20 (`Secuencia`)**: Entero de `0000000001` a `9999999999` independiente por cada combinación `(cedulaEmisor, sucursal, terminal, tipoComprobante)`.

### 5.2 `Clave` Numérica (Exactamente 50 dígitos)

```text
[País:3] [Día:2] [Mes:2] [Año:2] [CédulaEmisor:12] [Consecutivo:20] [Situación:1] [CódigoSeguridad:8]
  506      13      11      26      003101888777    00100001010000000042     1           68916456
=> "50613112600310188877700100001010000000042168916456" (50 dígitos)
```

- **`País` (3)**: `506` para Costa Rica.
- **`Día` (2) + `Mes` (2) + `Año` (2)**: Fecha de emisión en hora de Costa Rica (`America/Costa_Rica`, UTC-6 permanente). Ej: 13 de noviembre de 2026 -> `131126`.
- **`CédulaEmisor` (12)**: Número de identificación del emisor rellenado con ceros a la izquierda (`padStart(12, '0')`).
  - Física `101110222` (9 dígitos) -> `000101110222`
  - Jurídica `3101888777` (10 dígitos) -> `003101888777`
  - NITE `4000123456` (10 dígitos) -> `004000123456`
  - DIMEX `155812345678` (11 o 12 dígitos) -> `155812345678`
- **`Consecutivo` (20)**: Los 20 dígitos exactos de `<NumeroConsecutivo>`.
- **`Situación` (1)**:
  - `1` = **Normal** (en línea).
  - `2` = **Contingencia** (falla del sistema interno del emisor; se emitió comprobante provisional preimpreso y luego se transmite con `<InformacionReferencia>` código `08`).
  - `3` = **Sin Internet** (caída de conectividad a internet o caída de los servidores de Hacienda).
- **`CódigoSeguridad` (8)**: 8 dígitos pseudoaleatorios criptográficos (`crypto.randomInt(10_000_000, 99_999_999)`) generados por tu sistema para impedir que terceros adivinen claves consecutivas de tu empresa.

---

## 6. Contrato JSON de Envío (`POST /recepcion/v1/recepcion/`) y Respuesta Asíncrona

### 6.1 Payload de Envío (`FE`, `ND`, `NC`, `TE`, `FEC`, `FEE`, `REP`)

```json
{
  "clave": "50613112600310188877700100001010000000042168916456",
  "fecha": "2026-11-13T16:45:12-06:00",
  "emisor": {
    "tipoIdentificacion": "02",
    "numeroIdentificacion": "3101888777"
  },
  "receptor": {
    "tipoIdentificacion": "02",
    "numeroIdentificacion": "3101555444"
  },
  "callbackUrl": "https://tu-dominio.com/api/hacienda/webhook",
  "comprobanteXml": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48RmFjdHVyYUVsZWN0cm9uaWNh..."
}
```

> **Notas críticas del JSON de Recepción:**
> 1. **En `TiqueteElectronico` (`TE` `04`) sin cliente identificado**, **omite** el objeto `"receptor"` del JSON exterior (no envíes strings vacíos `""` porque Hacienda responde `HTTP 400`).
> 2. **En `FacturaElectronicaExportacion` (`FEE` `09`) con receptor extranjero (`tipo 05`)**, si el receptor no tiene identificación nacional, verifica si lleva `sinReceptor` o omite `receptor` en el sobre JSON cuando `tipoIdentificacion === '05'` según guía de recepción vigente (en el XML interno sí viaja `<Receptor>` completo).
> 3. **En `MensajeReceptor` (`05`, `06`, `07`)**, el JSON añade `"consecutivoReceptor": "00100001050000000042"`, `"clave"` es la clave de 50 dígitos de la **factura original del proveedor**, `"emisor"` es el proveedor que emitió la factura original, y `"receptor"` eres tú (quien acepta o rechaza el gasto).

### 6.2 Interpretación de Códigos HTTP en `POST /recepcion`

| Código HTTP | Significado Real | Acción en tu Máquina de Estados |
|---|---|---|
| **`202 Accepted` / `201`** | **Recibido en cola de validación** (*¡OJO: AÚN NO ESTÁ ACEPTADO FISCALMENTE!*) | Marcar `SUBMITTED_PROCESSING`. Iniciar worker de consulta (`GET /recepcion/{clave}`) o esperar webhook en `callbackUrl`. |
| **`400 Bad Request`** | Error de sobre JSON o pre-validación inmediata (`X-Error-Cause` en headers de respuesta). Ej: `clave` ya fue recibida antes, fecha desfasada, cédula no coincide con token. | Leer header `X-Error-Cause` + body. Si el mensaje dice `"El comprobante [clave] ya fue recibido anteriormente"`, **NO quemes otro consecutivo**: pasa directo a `GET /recepcion/{clave}` (idempotencia ante reintento de red). |
| **`401 Unauthorized`** | Token JWT vencido o credenciales IdP inválidas. | Refrescar token una vez y reintentar con la **misma `Clave`**. El comprobante no llegó a Hacienda. |
| **`429 Too Many Requests` / `5xx` / Timeout** | Saturación o mantenimiento de Hacienda. | **NO generar nueva clave ni borrar venta**. Pasar a `QUEUED_CONTINGENCY` y reintentar con backoff exponencial (`5s, 15s, 60s, 5m`). Si supera ventana operativa, re-emitir bajo `Situacion = 3` (Sin Internet). |

### 6.3 Consulta de Estado (`GET /recepcion/v1/recepcion/{clave}`)

Devuelve HTTP `200` con:

```json
{
  "clave": "50613112600310188877700100001010000000042168916456",
  "fecha": "2026-11-13T16:45:15-06:00",
  "ind-estado": "aceptado",
  "respuesta-xml": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48TWVuc2FqZUhhY2llbmRh..."
}
```

Valores posibles de `"ind-estado"`:
- `"recibido"` / `"procesando"`: Sigue en cola de Hacienda. Re-consultar con backoff (`3s -> 8s -> 20s -> 60s`).
- `"aceptado"`: **Válido tributariamente**. Decodifica `respuesta-xml` (`MensajeHacienda_V4.4.xsd`), guárdalo íntegro por **5 años** junto al XML firmado, marca `ACCEPTED` y dispara envío de correo al cliente (adjuntando PDF + XML firmado + XML de `MensajeHacienda`).
- `"rechazado"`: **Inválido tributariamente (ese consecutivo y esa clave quedan quemados ante Hacienda)**. Decodifica `respuesta-xml`, extrae `<DetalleMensaje>`, tradúcelo con el **Humanizador de Errores DGT**, mantén la orden/venta intacta en tu CRM en estado `REJECTED_BY_HACIENDA` y habilita el botón **"Corregir y Re-emitir"** (que asignará un nuevo consecutivo e inyectará automáticamente `<InformacionReferencia>` con `TipoDocIR="10"` *"Sustituye factura rechazada por el Ministerio de Hacienda"* y `Codigo="04"` o el aplicable según corrección).
- `"error"`: Error interno del validador de Hacienda; inspeccionar `respuesta-xml` antes de re-emitir.
