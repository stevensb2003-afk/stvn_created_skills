# Blueprint 14 — Módulos Comerciales Activables por Plan (`pricing_approvals`, `b2b_wholesale_portal`, `web_leads`, `cash_reconciliation`) y Blindaje Crítico PWA / Radix UI / Web Push (`v5.2`)

> **Lectura Obligatoria**: Todo agente que configure planes por cliente en `/developer` (`crm_system/tenant_license`), extienda el CRM con módulos comerciales de valor agregado o audite la estabilidad móvil/PWA DEBE aplicar estos contratos modulares y patrones de resiliencia.

---

## 1. Catálogo de Módulos Activables por Plan (`CrmTenantLicense['enabledModules']`)

Cada módulo comercial se enciende o apaga en caliente por cliente desde el panel `/developer` (`platformDev === true`) o durante el Wizard Interactivo (`Fase 0.5`), ocultando limpiamente sus pestañas, rutas y permisos en el Constructor de Roles cuando está desactivado:

| Clave en `enabledModules` | Sub-Permisos RBAC Asociados | Superficies que Habilita |
| :--- | :--- | :--- |
| `catalog_master` | `crm.catalog`, `crm.catalog.admin` | Catálogo Maestro (`catalogProducts`), generador SKU, plantillas Excel, actualización 3 pasos y hoja masiva ([Blueprint 13](./13-master-catalog-web-exposure-excel-engine.md)). |
| `web_catalog` | `crm.catalog.admin` | Proyección pública segura `web_catalog` (`activeWeb`), gestor de ofertas y webhook `/api/revalidate` hacia e-commerce ([Blueprint 13](./13-master-catalog-web-exposure-excel-engine.md)). |
| `pricing_approvals` | `crm.pricing`, `crm.pricing.admin` | Cotizador B2C por escalas (`Sugerido / Máx. Vendedor / Personalizado`), solicitudes a gerencia, aprobación inline desde Campana `<Popover>` y Web Push FCM. |
| `b2b_wholesale_portal` | `crm.b2b`, `crm.b2b.admin` | Tarjeta `ContactB2bAccessCard` en CRM, panel `/distribuidores` (6 bandas de margen) y portal externo autoservicio `/portal-distribuidores` conectado a borradores POS. |
| `web_leads` | `crm.webLeads` | Bandeja dual `WebLeadsModal` (`B2B` vs `B2C`), KPIs y apertura 1-clic en WhatsApp con nota automática. |
| `cash_reconciliation` | `crm.payments`, `crm.cash`, `crm.cash.admin` | Pestaña `Cobro` (links de pago en el chat), Control de Caja física bimoneda (`/caja`) y conciliación de comprobantes/transferencias (`/sinpe`). |

---

## 2. Módulo Activable 1: Motor de Escalas de Descuento B2C, Transporte Vial y Aprobaciones Gerenciales en Vivo (`pricing_approvals`)

### 2.1 Separación Estricta de Costos Confidenciales (`Seller` vs. `Pricing Manager`)
- **Vendedor (`crm.pricing`)**: Opera pestañas `Cotizaciones` y `Simulador`; aplica descuentos automáticos hasta `sellerAutoMaxPct` (ej. `5%` en líneas elegibles); envía solicitudes cuando supera el tope o cotiza líneas restringidas. **JAMÁS recibe `price_cost`, utilidad neta ni márgenes** desde la API ni desde Firestore.
- **Gerente (`crm.pricing.admin`)**: Desbloquea `Aprobaciones`, `Reporte Mensual de Auditoría` y `Configuración de Reglas`; visualiza la colección aislada `pricing_approval_metrics/{requestId}` (`allow read: if isPricingAdmin();`) y aprueba/ajusta/rechaza en 1 clic.

### 2.2 Motor Determinístico `evaluateB2cCart` (`pricing_settings/b2c_rules`)
1. **Reglas por Categoría, Combo y Volumen de Factura**:
   - Evalúa cantidad acumulada por categoría → `categoryTierPct`.
   - **Regla Combo**: Las categorías marcadas `isAccessoryCategory: true` heredan el porcentaje de descuento del producto principal activo en el carrito (acotado por `maxSellerCapPct` del accesorio).
   - **Bono por Monto Global**: Suma tramos adicionales (`+1% / +1.5% / +2%`) según subtotal elegible.
2. **Piso Inquebrantable de Margen Bruto**:
   - Calcula `minNetPrice = unitCost / (1 - minGrossMarginPct / 100)` y recorta cualquier escala automática a `maxMarginSafePct` para impedir ventas bajo el piso financiero.
3. **Tres Modos de Acción en UI**:
   - **`Sugerido (X%)`** y **`Máx. Directo Vendedor (Y%)`**: Mutan inmediatamente la Cotización abierta en el POS/ERP.
   - **`Personalizado (> tope o línea bloqueada)`**: Crea `pricing_approvals/{REQ-XXXXXXXX}` marcando atómicamente cualquier solicitud `PENDING` previa del mismo documento como `SUPERSEDED`.
4. **Calculadora de Flete por Kilómetros Libres**:
   - Desenrolla el pin GPS del cliente ([Blueprint 12 Sección 5](./12-local-deliveries-agenda-projects-spec.md)), calcula distancia desde la sucursal origen (`crm_settings/general.originCoords`), descuenta los km gratuitos ganados según el monto del carrito (`freeKmTiers`) e inserta el SKU de flete en la proforma mostrando avisos de *upselling* cuando el cliente está cerca del siguiente tramo de envío gratis.

### 2.3 Campana Unificada `<Popover>` con Aprobación Inline y Notificador Global
- **Campana en Header (`UserNotificationsPopover`)**: Implementada obligatoriamente sobre Radix **`<Popover>`** (nunca `<Dialog>` modal para evitar bloqueos de `body`). Fusiona `user_notifications` + solicitudes `PENDING` en vivo y despliega para gerentes el widget **`QuickApprovalInline`** (`Aprobar X%` | `Aprobar Tope` | `Rechazar` con vista previa de margen neto sin abandonar la pantalla actual).
- **Feedback Instantáneo al Vendedor (`PricingGlobalNotifier`)**: Listener `onSnapshot` que reproduce chime sintetizado por Web Audio API y muestra confirmación visual apenas gerencia aprueba, dejando la cotización lista para pulsar **`Facturar`** en `PosTab → Historial`.

---

## 3. Módulo Activable 2: Distribuidores B2B y Portal Mayorista Autoservicio (`b2b_wholesale_portal`)

Permite que clientes mayoristas consulten sus precios por volumen y armen pedidos 24/7 sin requerir cuentas en Firebase Auth, inyectando cada pedido directamente como un **Borrador POS (`B2B-XXXX`)** en su chat del CRM.

### 3.1 Seguridad Dual y Sesión Mayorista sin Fricción (`/portal-distribuidores`)
1. **Credenciales Amigables Crockford Base32**:
   - Código único por distribuidor (ej. `B2B-XXXX-XXXX` usando alfabeto `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` sin caracteres ambiguos `0/O/1/I`) + **últimos 4 dígitos del teléfono WhatsApp** registrado en `crm_contacts/{contactId}`.
2. **Protección Anti-Fuerza Bruta y Control de Dispositivos**:
   - Límite en `b2b_rate_limits/{sha256(ip)}`: máximo **`5` intentos fallidos cada `15` minutos** (`HTTP 429`).
   - Cookie `HttpOnly; SameSite=Strict; Secure` firmada con `HMAC-SHA256` (`30` días) y tope de **`3` dispositivos simultáneos** (`activeDevices[]` con desalojo FIFO del más antiguo).
   - **Revocación Global en `<= 25s`**: Pausar o rotar el código incrementa `b2bSessionVersion` y actualiza `b2b_config/access_pulse`, invalidando las sesiones activas en todas las instancias Cloud Run.
3. **Aislamiento Total en `firestore.rules`**:
   - Todas las colecciones `b2b_config`, `b2b_access_codes`, `b2b_rate_limits`, `b2b_orders` y `b2b_order_metrics` tienen `allow write: if false;` para clientes; toda lectura/escritura del portal externo ocurre vía Route Handlers de servidor.
   - `layout.tsx` del portal declara `robots: { index: false, follow: false }`.

### 3.2 Motor Mayorista de 6 Bandas de Margen y Doble Escala (`Mejor Beneficio`)
- Clasifica los SKUs elegibles en **6 Bandas Automáticas** según su margen bruto (`Banda A >= 50%` hasta `Banda D < 15%`), asignando a cada banda tres niveles de descuento (`Base`, `Nivel 1`, `Nivel 2`) configurables en `/distribuidores → Reglas & Bandas` (con overrides por SKU y lista `hiddenSkus`).
- Compila `b2b_config/catalog_snapshot` conteniendo **únicamente** PVP de referencia, precios redondeados por nivel y umbrales de unidades (**cero exposición de costos internos, márgenes ni nombres de banda**).
- Al evaluar el carrito del distribuidor, aplica siempre el mayor beneficio entre volumen por categoría y monto global del pedido:
  `effectiveTier = Math.max(categoryVolumeTier, globalOrderAmountTier)`.

### 3.3 Conexión Nativa con el Chat CRM y el POS
1. **Tarjeta en Ficha del Contacto (`ContactB2bAccessCard.tsx`)**:
   - Permite activar `isDistributor`, ver dispositivos `X/3`, copiar `Código`, copiar `Enlace directo` (`?acceso=...`, limpiado al cargar con `history.replaceState`), copiar `Mensaje de invitación para WhatsApp`, `Pausar/Activar` y `Rotar código`.
2. **Inyección Atómica a Borrador POS (`createB2bOrder`)**:
   - En una sola transacción Firestore crea `b2b_orders/{orderId}`, `b2b_order_metrics/{orderId}` (solo visible para admins) y **`crm_pos_drafts/DRAFT_{orderId}`** (`draftNumber: 'B2B-XXXX'`, `source: 'b2b_portal'`, `useExplicitBase: true`), enviando notificación Web Push al asesor asignado con deep-link `/crm?chatId=...&posFilter=draft`.
3. **Asistente IA Mayorista (`PortalAiDrawer` + FAB Flotante Safe-Area)**:
   - Lanzador flotante `bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-4 sm:right-6 z-40` que se oculta automáticamente cuando `aiOpen || cartOpen` para jamás traslaparse con drawers abiertos, manteniendo el botón de carrito del header compacto (`formatCurrency(evaluation.totalDist)` cuando `totalUnits > 0`).
   - Alimentado exclusivamente por la guía mayorista oficial + `catalog_snapshot` enriquecido hasta `180` SKUs con `Unidad:${unitLabel}`, `Spec:${description.slice(0, 80)}` y estado de inventario seguro (`Stock:Disponible` vs `Stock:ConsultarStock` cuando `showStockToDistributors` está activo, **jamás exponiendo cantidades físicas de bodega, costos de importación ni nombres internos `BANDA_A..D`**), más el delta exacto del carrito para desbloquear `Nivel Global 1 / 2` y límite de `20 consultas / 10 min`, devolviendo 3 chips de seguimiento (`---SUGERENCIAS---`).
4. **Modo Vista Previa Admin Zero-Impersonation (`mode: 'admin_preview'` — `v4.23.2`)**:
   - El botón **Vista Previa** en `/distribuidores` abre `about:blank` de forma síncrona (evitando bloqueadores de popups) e invoca `POST /api/b2b/portal/auth` con `{ mode: 'admin_preview' }` + Bearer token (`isModuleAdmin`).
   - Acuña una cookie `HttpOnly` HMAC de `8h` con `cid: '__preview_${uid}'` e `isPreview: true`: **cero escrituras en Firestore**, sin contacto ficticio y sin desalojar los `3` dispositivos reales de ningún distribuidor. Bloquea `POST /api/b2b/orders` (`HTTP 403`) y muestra banner de solo lectura en el carrito permitiendo probar escalas y el asistente IA en vivo.
5. **Paginación Resiliente (`B2bPaginationBar`), KPIs Ligeros (`?mode=summary`), Firma de Config e Imágenes SSOT (`v4.23.1–v4.23.3`)**:
   - `B2bPaginationBar` unifica paginación por cursores en servidor (`count().get()` + `startAfter` + lookahead `limit + 1` + fallback `FAILED_PRECONDITION` en memoria mientras compilan índices) y paginación local en Simulador/Overrides.
   - `toPortalSafeOrder()` purga `internalNotes`, `assignedSellerUid`, `createdByUid`, `idempotencyKey`, `posDraftId` y `conversationId` antes de responder al portal externo.
   - `B2bHeaderKpis` (`?mode=summary`) usa agregaciones `.count()` y difiere la carga pesada del catálogo mediante `visitedTabs` lazy-mount; `buildB2bConfigSignature()` omite escrituras y reconstrucciones de snapshot cuando las reglas guardadas no cambiaron (`deduplicated: true`), usando `web_catalog` como única fuente de imágenes (cero archivos estáticos `/public/images/b2b/`).
   - `PortalCatalogFilters` comparte un mismo `FilterBody` entre barra lateral sticky desktop (`lg:block w-64 sticky top-28`) y `Sheet` móvil izquierdo (`w-[86vw] max-w-xs` con autocierre al elegir categoría y inputs numéricos sin spinners `text-[16px] sm:text-xs`).

---

## 4. Módulo Activable 3: Bandeja Dual de Prospectos Web (`web_leads` — `B2B` vs `B2C`)

1. **Modelo `web_leads/{leadId}`**:
   - Escritura en `firestore.rules` bloqueada al SDK cliente (`allow create: if false;`, alimentado vía Admin SDK desde formularios del sitio web); lectura/actualización protegida por `crm.webLeads`.
   - Clasifica automáticamente prospectos **Mayoristas `B2B`** (`companyName` presente o tipo/origen distribuidor) vs **Retail `B2C`**, compartiendo un único listener `useWebLeads` desde la raíz del CRM.
2. **Interfaz `WebLeadsModal`**:
   - Selector segmentado superior **`B2B [pendientes]`** | **`B2C [pendientes]`** con punto ámbar pulsante cuando existen leads `status === 'new'`, grilla de 4 KPIs con marca de agua, filtro por giro comercial en `B2B` y tarjetas con copia en 1 clic de teléfono/correo.
3. **Conversión Segura 1-Clic a WhatsApp (`startChatFromWebLead`)**:
   - Normaliza el teléfono a E.164 e invoca `POST /api/crm/conversations/create` (marcando automáticamente `isDistributor: true` si el lead es `B2B`).
   - En el primer enlace, inserta una **nota interna contextual** en `crm_contacts/{contactId}/notes` con empresa/giro o área estimada y mensaje original del formulario, avanzando el lead a `'contacted'`.
   - **Guardia Anti-Secuestro de Cartera**: Si el chat ya existía y pertenece a otro asesor (`res.assignedTo !== currentUserId && !isCrmAdmin`), bloquea la redirección con aviso informativo en vez de reasignar o exponer el hilo ajeno.

---

## 5. Módulo Activable 4: Links de Pago en el Chat, Control de Caja Bimoneda y Conciliación de Transferencias (`cash_reconciliation`)

### 5.1 Pestaña `Cobro` en `CrmRightPanel` (`PaymentsTab` — Pasarela de Links de Pago)
- Suscribe en tiempo real a `payment_links` filtrados por el teléfono del contacto.
- El asesor genera un link de cobro (`Tilopay` / `Stripe` / pasarela configurada en Bóveda) y el callback `onSendToChat(url)` **despacha automáticamente el enlace al chat de WhatsApp**.
- Incluye botón de verificación bajo demanda (`/consult`), anulación segura si `status !== 'paid'` y webhook entrante que marca `status: 'paid'`.

### 5.2 Control de Efectivo Bimoneda (`/caja`) y Puente desde el POS
- Gestiona sesiones `cashSessions` (`open | closed`) con **bolsillos físicos separados** para moneda local (ej. `CRC`) y dólares (`USD`), sin mezclar saldos por tipo de cambio.
- **Evaluador Estricto de 4 Reglas para Efectivo Físico (`evaluatePhysicalCashPayment`)**: Solo sincroniza pagos hacia `cashTransactions` cuando: `1)` es ingreso (`type === 'in'`), `2)` está activo y `amount > 0`, `3)` el método es efectivo físico (`01` / `CASH`), y `4)` la cuenta destino es una caja física (jamás cuentas bancarias, datáfonos ni pasarelas digitales).
- **Sala de Espera**: Si entra un cobro en efectivo mientras la caja está cerrada, se guarda con `status: 'pending'` (`sessionId: null`) y se aplica automáticamente al abrir el siguiente turno; anular un pago en el POS reversa su movimiento en `/caja`.

### 5.3 Conciliación Automática de Transferencias Instantáneas / SINPE (`/sinpe`)
- `POST /api/crm/webhooks/bank-transfer` (autenticado con `timingSafeEqual` sobre secreto de Bóveda) parsea notificaciones bancarias entrantes y crea de forma idempotente `transfer_vouchers/{referenceNumber}` con `status: 'unclaimed'`.
- `GlobalTransferNotifier` muestra un toast en tiempo real a los cajeros/asesores autorizados cuando ingresa un comprobante nuevo y permite vincular la referencia con la factura o entrega del contacto en el CRM.

---

## 6. Blindaje Obligatorio PWA, Radix UI, Service Worker y `ChatSidebarTopBar` (`Core Platform Hardening`)

Todo proyecto generado o auditado con esta skill debe incluir estas **5 defensas estructurales** probadas en producción:

### 6.1 Defensa de 3 Capas contra el Congelamiento `pointer-events: none` de Radix UI
Al encadenar un `DropdownMenu` con un `Dialog` modal o ejecutar `router.push()` mientras una capa Radix se cierra, el navegador puede dejar huérfano `document.body.style.pointerEvents = 'none'` bloqueando todos los clics de la app:
1. **Regla `<Popover>` en Notificaciones**: Los centros de notificaciones en la cabecera usan `<Popover>` no modal, jamás `<Dialog>`.
2. **Watchdog de Limpieza en `Header` / Layout (`150ms`)**:
   ```typescript
   useEffect(() => {
     if (!anyOverlayOpen && typeof document !== 'undefined') {
       const t = setTimeout(() => {
         if (document.body.style.pointerEvents === 'none') {
           document.body.style.pointerEvents = '';
         }
         document.body.removeAttribute('data-scroll-locked');
       }, 150);
       return () => clearTimeout(t);
     }
   }, [pathname, anyOverlayOpen]);
   ```
3. **Guardia de Historial Móvil (`useCrmMobileBackLayer`)**: Antes de llamar a `window.history.back()` al desmontar una sub-vista móvil, comprueba `if (window.history.state?.crmLayer === layerId)` para jamás expulsar al usuario fuera de `/crm` durante navegaciones programáticas.

### 6.2 Prevención de Bucles `DefaultLane` que Congelan `startTransition` en Next.js App Router
En cualquier `useEffect` que sincronice mapas locales desde un listener `onSnapshot`, **nunca** retornes un objeto clonado `{ ...prev }` si ninguna llave cambió:
```typescript
setLocalMap((prev) => {
  let changed = false;
  const next = { ...prev };
  for (const item of snapshotItems) {
    if (!(item.id in next)) {
      next[item.id] = item.defaultValue;
      changed = true;
    }
  }
  return changed ? next : prev; // Preserva referencia exacta y evita inanición de transiciones RSC
});
```

### 6.3 Exclusión Estricta de Payloads RSC y APIs en Workbox (`next.config.ts`)
Para evitar que el Service Worker secuestre navegaciones App Router o devuelva estados obsoletos:
- Configura `cacheStartUrl: false`, `dynamicStartUrl: false`, `reloadOnOnline: false`, `skipWaiting: true`, `clientsClaim: true`.
- **Elimina de `runtimeCaching`** las reglas por defecto `pages-rsc-prefetch`, `pages-rsc`, `pages`, `next-data` y `others`.
- Excluye explícitamente todos los dominios `*.googleapis.com`, `*.firebaseio.com`, `*.cloudfunctions.net`, `*.run.app` y todas las rutas `/api/*`.
- En el montaje inicial del cliente (`useServiceWorkerCatchup`), purga una vez por sesión cualquier caché antigua con esos nombres mediante `window.caches.delete()`.

### 6.4 Preservación de Suscripción Web Push al Actualizar Versión PWA
- **PROHIBIDO llamar a `registration.unregister()`** en los actualizadores de versión (`VersionGate`), ya que destruye la suscripción `PushManager` e invalida el token FCM del dispositivo en cada despliegue.
- Purga únicamente `window.caches` y ejecuta `await reg.update()` + `reg.waiting?.postMessage({ type: 'SKIP_WAITING' })`.
- Envía notificaciones FCM **100% `data-only`** (`Urgency: 'high'`, `suppressWhenVisible: 'true'`) con mapa LRU de `8s` por `tag` en `public/firebase-messaging-sw.js` para evitar banners duplicados cuando la PWA ya está enfocada en pantalla, limpiando automáticamente tokens vencidos (`registration-token-not-registered`).

### 6.5 Cabecera Compacta Anti-Desborde en Móvil (`ChatSidebarTopBar` — `360px` Safe)
Para evitar filas de 7 íconos apretados o recortados en pantallas de `360px`–`420px`:
- **Izquierda**: Botón de retorno opcional + título de marca (`whitespace-nowrap`).
- **Derecha (máximo 3 controles)**:
  1. Acceso directo `<Globe />` a **Prospectos Web** (si `web_leads` está licenciado, con badge ámbar de pendientes).
  2. Botón `<HelpAgentCrmButton />` del **Copiloto IA de Ayuda**.
  3. Menú compacto **`<Menu />` (`Popover`)** con punto indicador activo que agrupa limpiamente: *Estadísticas*, *Agenda / Operaciones*, *Directorio de Contactos*, *Configuraciones* y *Modo Claro/Oscuro*.
