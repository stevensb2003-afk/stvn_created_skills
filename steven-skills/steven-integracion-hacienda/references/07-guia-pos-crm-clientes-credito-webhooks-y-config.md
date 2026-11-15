# 07 — Guía Maestra de Implementación POS/CRM: 4 Modalidades de Venta, Datos de Cliente y Crédito, Webhooks Asíncronos y Configuración Frontend + Secret Manager

Guía práctica de implementación paso a paso para integrar un **Punto de Venta (POS) dentro de un CRM o ERP propio**, respondiendo con exactitud quirúrgica a todos los flujos comerciales, fiscales, asíncronos y de seguridad en **Hacienda Costa Rica v4.4 (`MH-DGT-RES-0027-2024` / TRIBU-CR)**.

---

## 1. Las 4 Modalidades de Venta en el POS de tu CRM (Y el Rol Exacto del Tiquete Electrónico)

### 1.1 Aclaración Conceptual: ¿Qué es el Tiquete Electrónico (`TE` — Código `04`)?
Tu intuición es **100% exacta**:
- Cuando vendes en mostrador o por WhatsApp y el cliente dice *"No ocupo factura electrónica"* (o no te quiere dar su cédula/correo), **tú como comercio inscrito en Hacienda SÍ estás obligado por ley a reportar esa venta y ese IVA al Ministerio de Hacienda**.
- Para eso existe el **Tiquete Electrónico (`TE`, código `04`)**:
  1. **Sí se firma con tu `.p12` (`XAdES-EPES`) y SÍ se transmite al API del Ministerio de Hacienda** exactamente igual que una factura.
  2. **No requiere datos del cliente**: el nodo `<Receptor>` es `minOccurs="0"` en `TiqueteElectronico_V4.4.xsd` (y `<CodigoActividadReceptor>` está prohibido en `TE`). Tampoco requiere enviar nada por email al comprador si no dio correo.
  3. **Efecto tributario**: Declara legalmente tu ingreso y tu débito fiscal IVA ante Hacienda, pero **no le sirve al comprador para deducir gasto ni crédito fiscal**.

### 1.2 Tabla Operativa de las 4 Opciones en la Pantalla de Cobro del POS

Todas viven en **una sola tabla comercial `crm_orders`** (para que un fallo de internet o un rechazo de Hacienda jamás cancele la venta en caja ni pierda el carrito), gobernadas por `posMode`:

| Opción en Caja (`posMode`) | ¿Mueve Caja e Inventario? | ¿Se envía a Hacienda? | ¿Se envía al Cliente? | Numeración | Cuándo se usa |
|---|---|---|---|---|---|
| **1. Cotización (`QUOTE`)** | **No** (solo proforma con fecha de vencimiento) | **No** (`0` consecutivos DGT) | Sí (PDF/Link de cotización) | Interna `COT-000001` | Presupuestos B2B/B2C. Usa el **mismo motor `BigInt` a 5 decimales** para que al aprobarse no descuadre ni `₡0.01`. |
| **2. Factura Interna (`INTERNAL_INVOICE`)** | **Sí** (cierra cobro en CRM y descuenta stock) | **No** (`0` consecutivos DGT) | Recibo interno (`SIN VALIDEZ TRIBUTARIA`) | Interna `INT-000001` | Control interno, regímenes no obligados o pre-facturación administrativa sin transmisión fiscal. Permite *upgrade* posterior a `TE` o `FE`. |
| **3. Tiquete Electrónico (`TE` — `04`)** | **Sí** | **SÍ (Obligatorio DGT)** | Opcional (impreso / WhatsApp; email solo si lo pide) | DGT 20 díg (`...04...`) + Clave 50 díg | **Opción por defecto en POS rápido**: cliente consumidor final que NO pidió Factura Electrónica. |
| **4. Factura Electrónica (`FE` — `01`)** | **Sí** | **SÍ (Obligatorio DGT)** | **SÍ (Obligatorio por ley: PDF + XML Firmado + XML `MensajeHacienda`)** | DGT 20 díg (`...01...`) + Clave 50 díg | Cliente que **SÍ pide Factura Electrónica** para su contabilidad (crédito fiscal IVA / gasto deducible) o ventas a crédito formal. |

### 1.3 Caso Clásico de Mostrador: *"Emití Tiquete Electrónico (`TE`) y luego el cliente pidió Factura Electrónica (`FE`)"*
**Regla de oro contable:** Jamás crees una segunda orden en el POS (duplicarías ingresos en caja y rebajarías doble inventario) y jamás emitas una `FE` suelta dejando vivo el `TE` (pagarías doble IVA a Hacienda).

**Flujo automático en 1 clic (`POST /api/orders/:id/convert-te-to-fe`) sobre la MISMA orden del CRM:**
1. **Pre-validación en seco (Dry-Run en RAM)**: Verifica que los datos fiscales nuevos del cliente (`Nombre`, `Identificacion`, `CodigoActividadReceptor`, `Correo`) pasen XSD antes de tocar secuencias.
2. **Paso A — Anular el `TE` con `NotaCreditoElectronica` (`NC`, tipo `03`)**:
   - Reserva consecutivo serie `03` (`NC`), copia idénticas las líneas del `TE` y agrega `<InformacionReferencia>`:
     `<TipoDocIR>04</TipoDocIR>`, `<Numero>{Clave50DelTE}</Numero>`, `<Codigo>01</Codigo>` (*Anula documento de referencia*).
3. **Paso B — Emitir la nueva `FacturaElectronica` (`FE`, tipo `01`)**:
   - Reserva consecutivo serie `01` (`FE`) con los datos completos del receptor y agrega `<InformacionReferencia>`:
     `<TipoDocIR>04</TipoDocIR>`, `<Numero>{Clave50DelTE}</Numero>`, `<Codigo>07</Codigo>` (*Sustituye comprobante electrónico*).
4. **Resultado neto perfecto**: Caja CRM = `1 venta`. Hacienda = `+1 TE - 1 NC + 1 FE = 1 venta neta`.

---

## 2. Qué Datos del Cliente Recolectar, Formatos Exactos y Reglas de Crédito (Auditoría XSD v4.4)

### 2.1 Datos del Cliente (`<Receptor>`) según el Documento

> **Truco UX de Velocidad en POS:** En Costa Rica, el cajero **solo digita la Cédula** y tu sistema consulta `GET https://api.hacienda.go.cr/fe/ae?identificacion={cedula}` en `200ms`. Eso autocompleta automáticamente **`Nombre`**, **`TipoIdentificacion`** y la lista oficial de **`Actividades Económicas CIIU4` (6 dígitos)** del cliente. El cajero solo pide el **Correo Electrónico** (una única vez y queda guardado en la ficha del contacto CRM).

| Campo del Cliente en UI | Etiqueta XML v4.4 | ¿Obligatorio en `TE` (`04`)? | ¿Obligatorio en `FE` (`01`) Nacional? | ¿Obligatorio en `FE` (`01`) Extranjero (`Tipo=05`)? | Formato Exacto, Regex y Trampas Mortales XSD v4.4 |
|---|---|---|---|---|---|
| **Tipo de Identificación** | `Receptor/Identificacion/Tipo` | **No** (Opcional) | **SÍ** (`01`, `02`, `03`, `04`) | **SÍ** (`05` Extranjero o `06` No Contrib.) | Enum cerrado `"01"`..`"06"`. |
| **Número de Identificación** | `Receptor/Identificacion/Numero` | **No** *(puedes emitir TE sin cliente, o solo con Nombre+Correo sin cédula)* | **SÍ** | **SÍ** (Pasaporte / Tax ID / EIN) | **Sin guiones, sin espacios, sin ceros al inicio**:<br>• `01` Física: **9 dígitos** (`^[1-9]\d{8}$`)<br>• `02` Jurídica: **10 caracteres** (`^[A-Za-z0-9]{10}$`)<br>• `03` DIMEX: **11 o 12 dígitos** (`^[1-9]\d{10,11}$`)<br>• `04` NITE: **10 dígitos** (`^\d{10}$`)<br>• `05`/`06`: **1 a 20 chars** alfanuméricos. |
| **Razón Social / Nombre Completo** | `Receptor/Nombre` | Solo si abres `<Receptor>` | **SÍ** | **SÍ** | `3` a `100` caracteres (`minLength="3"`). Textos de 1–2 letras rompen XSD. |
| **Actividad Económica Cliente** | `<CodigoActividadReceptor>` *(en raíz, fuera de Receptor)* | **PROHIBIDO EN XSD** *(rompe `xmllint` si lo envías en TE)* | **SÍ** *(obligatorio DGT para que el cliente deduzca gasto/IVA)* | **OMITIR** *(extranjero `05` o no contribuyente `06` no tiene CIIU en CR)* | Exactamente **6 dígitos** CIIU4 (`minLength="6"`, `maxLength="6"`). Sanitizar siempre `String(cod).replace(/\D/g,'').padStart(6,'0').slice(0,6)`. |
| **Correo Electrónico** | `Receptor/CorreoElectronico` | Opcional | **SÍ** *(para envío legal de los 3 archivos)* | Opcional / Recomendado | **Máximo 1 correo en `<Receptor>`** (`maxOccurs="1"`, `<= 160` chars). **PROHIBIDO separar varios correos con `;` o `,` en XML** (manda copias adicionales por tu SMTP, pero en el XML pon solo el principal). Regex DGT: `^[A-Za-z0-9_]+([-+.'][A-Za-z0-9_]+)*@[A-Za-z0-9_]+([-.][A-Za-z0-9_]+)*\.[A-Za-z0-9_]+([-.][A-Za-z0-9_]+)*$`. Si está vacío, **omite el tag**. |
| **Provincia / Cantón / Distrito** | `Receptor/Ubicacion/*` | Opcional | Opcional XSD *(Recomendado en crédito B2B)* | **OMITIR `<Ubicacion>`** en `Tipo=05` | Si envías `<Ubicacion>`, son obligatorios:<br>• `Provincia`: **1 dígito** (`1`..`7`)<br>• `Canton`: **2 dígitos con cero inicial** (`"01"`..`"20"`, enviar `"1"` rompe XSD)<br>• `Distrito`: **2 dígitos con cero inicial** (`"01"`..`"99"`)<br>• `OtrasSenas`: **`5` a `250` chars** (`"N/A"` rompe XSD).<br>• **Trampa `Barrio` en v4.4**: ya NO es código `"01"` como en v4.3; ahora es texto de **`5` a `50` chars** (si no lo tienes, omite `<Barrio>`). |
| **Dirección Extranjero** | `Receptor/OtrasSenasExtranjero` | No | **OMITIR** | Opcional (`5` a `300` chars) | Exclusivo para `Tipo="05"`. *(Nota: si el servicio/bien se exporta fuera de CR, usa `FEE 09`; si el extranjero consume dentro de CR, usa `FE 01` con `Tipo=05`).* |
| **Teléfono** | `Receptor/Telefono` | Opcional | Opcional | Opcional | `CodigoPais`: entero `1..3` dígitos sin `+` (`506`). `NumTelefono`: entero puro sin guiones `>= 10000000` (mínimo 8 dígitos reales; si no, omitir `<Telefono>`). |

---

### 2.2 Cómo Estructurar las Ventas a Crédito (`02` vs `10` vs `08`) y Cuándo Emitir `REP` (`10`)

En v4.4 existen **3 tipos distintos de crédito** y confundirlos causa rechazos inmediatos en Hacienda:

| Regla / Campo XML | A. Crédito Comercial Normal (`CondicionVenta = "02"`) | B. Crédito PYME / Independiente IVA Diferido <= 90 días (`CondicionVenta = "10"`, Art. 27 LIVA) | C. Venta a Crédito al Estado (`CondicionVenta = "08"`) |
|---|---|---|---|
| **¿Cuándo pagas el IVA a Hacienda?** | **En el mismo mes que emites la `FE`**, aunque el cliente te pague en 30 o 60 días. | **Diferido hasta que el cliente te pague** (o máximo al día 90). Requiere estar inscrito como PYME (MEIC/MAG) o régimen autorizado Art. 27 LIVA. | **Diferido hasta que la institución estatal te deposite**. |
| **`<PlazoCredito>` en la `FE` inicial** | **Obligatorio** — **Entero puro en días** (`<PlazoCredito>30</PlazoCredito>`). **¡Jamás envíes `"30 dias"` con letras: rompe XSD v4.4!** | **Obligatorio** — Entero entre **`1` y `90`** (`<PlazoCredito>60</PlazoCredito>`). Si supera 90 días, usa `"02"`. | **Obligatorio** — Entero en días según contrato (`<PlazoCredito>30</PlazoCredito>`). |
| **`<MedioPago>` en la `FE` inicial** | **OMITIR `<MedioPago>`** (porque al momento de emitir a crédito puro no entró dinero en ningún medio de pago). | **OMITIR `<MedioPago>`** en la `FE`. | **OMITIR `<MedioPago>`** en la `FE`. |
| **¿Qué haces cuando el cliente abona o cancela la factura?** | **Recibo de Caja Interno en tu CRM (CxC)**. **PROHIBIDO enviar `REP (10)` a Hacienda** (`ReciboElectronicoPago_V4.4.xsd` rechaza `CondicionVenta="02"` porque el IVA ya fue declarado). | **OBLIGATORIO emitir `ReciboElectronicoPago` (`REP`, código `10`) a Hacienda** en cada abono parcial o pago total con `<CondicionVenta>11</CondicionVenta>`, `<MedioPago>` obligatorio y `<InformacionReferencia>` apuntando a los 50 dígitos de la `FE`. | **OBLIGATORIO emitir `ReciboElectronicoPago` (`REP`, código `10`) a Hacienda** con `<CondicionVenta>09</CondicionVenta>`, `<MedioPago>` obligatorio y `<InformacionReferencia>` a la `FE`. |

---

## 3. Arquitectura Asíncrona del Webhook de Hacienda (`callbackUrl`) + Worker de Respaldo

### 3.1 Cómo funciona exactamente la asincronía de Hacienda
Tal como leíste, **Hacienda NUNCA devuelve el resultado de validación XML en la misma llamada `POST /recepcion/v1/recepcion/`**:
1. **Milisegundo 200 (`POST /recepcion`)**: Hacienda solo verifica tu token OAuth2 y el sobre JSON exterior, mete el comprobante en su cola interna y te responde **`HTTP 202 Accepted` con cuerpo vacío** (estado = `SUBMITTED_PROCESSING`).
2. **Segundos o minutos después**: El motor validador de Hacienda procesa la firma `XAdES-EPES` y las reglas de negocio, y hace un **`POST` saliente hacia tu `callbackUrl`** (para **cualquier** documento: `FE`, `TE`, `NC`, `ND`, `FEC`, `FEE`, `REP` y `MensajeReceptor`) con este JSON exacto (`kebab-case`):
   ```json
   {
     "clave": "50613112600310188877700100001010000000042168916456",
     "fecha": "2026-11-13T17:25:14-06:00",
     "ind-estado": "aceptado",
     "respuesta-xml": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48TWVuc2FqZUhhY2llbmRh..."
   }
   ```
   *(Nota especial para `MensajeReceptor` `05/06/07`: `clave` viene con **71 caracteres** en formato `{claveFacturaOriginal50}-{consecutivoReceptor20}`).*

### 3.2 ¿Necesitas un endpoint abierto por cada factura?
**No uno por factura, sino UN ÚNICO endpoint público HTTPS en tu backend** que sirve para todas las empresas y todos los tipos de documento:
`POST https://api.tu-crm.com/api/webhooks/hacienda/:tenantId/:env/:mac`

### 3.3 Los 4 Anillos de Seguridad para Blindar ese Endpoint Abierto (Zero-Trust)
Como Hacienda **no envía headers `Authorization` ni HMAC propio** cuando llama a tu webhook, debes proteger tu endpoint abierto así:
1. **Anillo 1 — Firma `HMAC-SHA256` en la propia URL (`:mac`)**: Cuando envías el comprobante a Hacienda (sobre HTTPS cifrado), calculas `mac = HMAC_SHA256(masterKey, "${tenantId}:${env}:${clave}")` y mandas esa URL única en `"callbackUrl"`. Como nadie fuera de tu servidor y Hacienda conoce ese `callbackUrl`, cuando entra el `POST` recalculas el HMAC con `crypto.timingSafeEqual` en `0.1ms`: cualquier intento falso de internet rebota con `HTTP 401` sin siquiera tocar tu base de datos.
2. **Anillo 2 — Validación `xmllint --nonet` contra `MensajeHacienda_V4.4.xsd` + Match de Estado**: Decodificas `respuesta-xml`, validas contra el XSD oficial de `MensajeHacienda` (bloqueando ataques XXE), verificas que `<Clave>` y `<TotalFactura>` coincidan con tu orden en estado `SUBMITTED_PROCESSING` y que `ind-estado` coincida con `<Mensaje>` (`1` = aceptado, `3` = rechazado).
3. **Anillo 3 — Verificación Criptográfica de `<ds:Signature>` del Ministerio de Hacienda**: El XML `MensajeHacienda` viene firmado con el certificado institucional del Ministerio de Hacienda (`RSA-SHA256`).
4. **Anillo 4 — Confirmación Cruzada `GET /recepcion/{clave}` + Worker de Polling de Respaldo**:
   - **Nunca dependas solo del Webhook**: si un día tu servidor se reinicia justo cuando Hacienda dispara el callback (o cuando programas en `localhost` sin dominio público), un **Worker de Respaldo** revisa cada 15–60s cualquier comprobante que lleve `> 15s` en `SUBMITTED_PROCESSING` y consulta `GET /recepcion/v1/recepcion/{clave}` directamente a Hacienda.
   - Tanto el Webhook como el Worker llaman a la misma función idempotente `settleAttemptAtomically()`, garantizando que el correo al cliente y el archivado legal a **5 años** ocurran **exactamente una vez**.

---

## 4. Módulo de Configuración Frontend del CRM + Flujo "Activar en Hacienda" + Secret Manager

### 4.1 Estructura Exacta de la Pantalla de Configuración Fiscal en tu CRM

Divide la pantalla en **3 tarjetas claras**:

1. **Tarjeta 1 — Identidad Tributaria del Emisor (Editable y Visible)**:
   - Tipo y Número de Identificación + botón **"Autocompletar con Padrón Hacienda"** (`GET /fe/ae`).
   - Razón Social, Nombre Comercial, Actividad Económica Principal (6 dígitos CIIU4) y Secundarias.
   - Provincia, Cantón (`01`), Distrito (`01`), Barrio (texto `>=5` chars), Otras Señas, Teléfono y Correo Emisor.
   - Modalidad por defecto en Caja POS (`Tiquete Electrónico TE` una vez activo en Hacienda; `Factura Interna` mientras esté sin activar).
2. **Tarjeta 2 — Sucursales, Cajas (Terminales) y Migración de Consecutivos**:
   - Código de Sucursal (`001`) y Terminal (`00001` para Caja 1, `00002` para Caja 2).
   - **Consecutivos Iniciales de Migración (`initialSequences`)**: Si tu cliente antes facturaba en GTI/Alegra/Qupos e iba por la factura `4582`, escribe `4582` en `FE` (o mejor aún, le asignas `Terminal 00002` nueva para arrancar desde `1` con cero riesgo de choque). En backend se guarda siempre con **`GREATEST(actual, inicial)`** para que jamás pueda retroceder un consecutivo por accidente.
3. **Tarjeta 3 — Conexión Criptográfica TRIBU-CR (100% Write-Only / Secret Manager)**:
   - Selector de Ambiente: `Pruebas (Sandbox TRIBU-CR)` vs `Producción (TRIBU-CR)`.
   - Inputs **Write-Only** (se envían por `POST` HTTPS y se limpian del DOM; el endpoint `GET` jamás los devuelve):
     - Archivo **Llave Criptográfica `.p12`** (drag & drop).
     - **PIN de 4 dígitos** del `.p12`.
     - **Usuario API IdP** (`cpj-3-101-...@stag.comprobanteselectronicos.go.cr` o `@prod...`).
     - **Contraseña API IdP**.
   - **Botón Principal: `"Verificar en Hacienda y Activar Cuenta"` (`POST /api/settings/verify-and-activate`)**:
     Ejecuta **5 validaciones reales en el backend (~1 segundo, sin quemar consecutivos)** antes de encender el sello verde `"ACTIVO EN HACIENDA"`:
     1. Abre el `.p12` con el `PIN` en RAM (si el PIN es erróneo, avisa de inmediato).
     2. Comprueba que el certificado `.p12` no esté vencido y que la cédula dentro del certificado X.509 **coincida con la cédula del Emisor** (evita subir por error el `.p12` de otra empresa).
     3. Ejecuta una firma de prueba `XAdES-EPES` + validación `xmllint` contra `FacturaElectronica_V4.4.xsd` con los datos reales del Emisor (detecta si falta dirección o si el correo del emisor está mal escrito antes de vender).
     4. Verifica coherencia de ambiente (`@stag` vs `@prod`).
     5. Hace login OAuth2 real contra `idp.comprobanteselectronicos.go.cr` confirmando que Hacienda devuelve un `access_token` válido.
     - Cuando los 5 pasos pasan -> guarda en el **Secret Manager / Vault**, marca `activationStatus = "ACTIVE"` y muestra en UI únicamente: estado **Activo**, titular del certificado, fecha de vencimiento y usuario enmascarado.

### 4.2 ¿Google/AWS Secret Manager vs. Bóveda `AES-256-GCM` en Base de Datos? (¿Cuál es mejor?)

| Criterio | Opción 1: Cloud Secret Manager Puro por Cliente (GCP / AWS) | Opción 2 (Recomendada para SaaS / Plantilla Replicable): Envelope Encryption (`VAULT_MASTER_KEY` en Secret Manager + Blobs `AES-256-GCM` en DB) |
|---|---|---|
| **Seguridad** | Máxima (IAM + Cloud Audit Logs). | **Idéntica de grado bancario**: la llave maestra vive en Google Secret Manager / AWS KMS / `.env` protegido del servidor, y cada cliente tiene su propia sub-llave derivada con `HKDF-SHA256` + `AAD = tenantId` en `AES-256-GCM`. |
| **Costo Mensual** | En GCP: `\$0.06`/secreto/mes. En AWS: `\$0.40`/secreto/mes (con 500 clientes x 2 ambientes = `\$400/mes` fijos). | **`\$0.00` por cliente nuevo** (1 solo secreto maestro en Cloud Secret Manager para miles de comercios). |
| **Velocidad en Caja POS** | `20–60ms` de llamada de red al API de GCP/AWS (requiere cachear en RAM). | **`0.05ms` instantáneo en RAM**, cero latencia externa al cobrar en horas pico. |
| **Facilidad al Clonar Proyecto** | Requiere crear permisos IAM de escritura de secretos en cada proyecto cloud clonado. | **Clonas el repo, defines `VAULT_MASTER_KEY`, abres el Frontend y subes el `.p12` en 30 segundos** en cualquier hosting (Cloud Run, Railway, Render, Vercel, VPS). |

> Por eso diseñamos la interfaz `FiscalSecretProvider`: usa por defecto **Envelope Encryption (`AES-256-GCM + HKDF` con `VAULT_MASTER_KEY` alojada en tu Secret Manager de infraestructura)** y permite cambiar a un adaptador directo de GCP Secret Manager sin tocar ni una línea de tus controladores ni del Frontend.

---

## 5. Los Dos Niveles de Sandbox: Simulador Local vs. Sandbox Oficial de Hacienda (`stag`)

Para que no quede ninguna duda sobre cómo funciona el entorno de pruebas:

1. **Nivel 1 — Simulador Local (`SIMULATED_DGT` / `ASYNC_202_WEBHOOK` en `sandbox-v44`)**:
   - **No necesitas cuenta en Hacienda ni `.p12` real**: ya incluye una llave `.p12` RSA-2048 de laboratorio pre-cargada.
   - Genera **exactamente el mismo XML v4.4 de producción**, aplica la **misma firma criptográfica `XAdES-EPES`** y lo pasa por el **validador oficial `xmllint` con los `.xsd` reales de Hacienda**. Además simula tanto respuestas inmediatas como el webhook asíncrono (`HTTP 202` -> callback posterior firmando un `MensajeHacienda_V4.4.xsd` real).
2. **Nivel 2 — Sandbox Real del Ministerio de Hacienda (`LIVE_DGT` + `stag`)**:
   - Apunta a los servidores reales de pruebas de Tributación (`idp.../rut-stag` + `api-sandbox.comprobanteselectronicos.go.cr`).
   - Las facturas que envíes ahí son evaluadas por el **servidor real del Ministerio de Hacienda** (y Hacienda dispara el webhook real hacia tu URL si expones el puerto con Cloudflare Tunnel / ngrok o en tu dominio de staging), pero **tienen valor fiscal cero** (no generan impuestos reales). Solo necesitas subir en la pestaña *Bóveda Fiscal* el `.p12` gratuito de Pruebas (`stag`) descargado desde **TRIBU-CR**.
