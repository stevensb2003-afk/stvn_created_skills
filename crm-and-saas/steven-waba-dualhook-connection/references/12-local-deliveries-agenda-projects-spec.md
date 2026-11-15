# Blueprint 12 — Suite Operativa Local del CRM: Entregas, Visitas Técnicas, Proyectos Multi-Día, Garantías y Motor GPS/Rutas (`100% Standalone` + Adaptador Logístico Externo Opcional)

> **Lectura Obligatoria**: Todo agente que implemente, active o extienda el módulo operativo de **Agenda, Entregas, Visitas, Proyectos o Garantías** (`enabledModules.scheduling`) DEBE seguir esta arquitectura **100% local primero (Firestore SSOT)**, libre de acoplamientos a plataformas logísticas propietarias externas y con soporte opcional para conectar un webhook/API externo vía `ExternalLogisticsAdapter`.

---

## 1. Principio Arquitectónico: `Local-First Firestore SSOT` vs. Conector Externo Opcional

En implementaciones heredadas es común cometer el error de depender de un sistema externo para generar el ID del ticket (`ETG-XXXX`) o bloquear cambios de estado si un webhook remoto falla. Esta especificación elimina los **6 bloqueadores de acoplamiento** para que el módulo funcione al **100% de forma autónoma dentro del CRM** desde el Día 1:

1. **Secuencias Atómicas Locales (`crm_settings/operations_counters`)**: Los folios legibles (`ETG-0001`, `VIS-0001`, `PROY-0001`, `GAR-0001`) se acuñan en una transacción local de Firestore **antes** de cualquier notificación externa.
2. **Escritura Primaria en Firestore**: Toda creación, reagendamiento o transición de estado persiste primero en `crm_contacts/{contactId}/{subcolección}/{docId}`. Si el cliente activó `ExternalLogisticsAdapter`, se despacha de forma asíncrona no bloqueante (o vía Outbox).
3. **Catálogo Operativo Local (`crm_settings/logistics_catalog`)**: Choferes, agencias de encomienda y técnicos/instaladores se resuelven desde `users/{uid}` (filtrados por rol/permiso) y/o desde el documento editable `crm_settings/logistics_catalog` en *Configuración CRM*.
4. **Máquinas de Estado Terminales Completas en el CRM**: El propio CRM permite cerrar entregas como **`Entregado`**, avanzar proyectos hasta **`Completado`** (estampando automáticamente `completedAt` para habilitar la ventana de garantía), **convertir una Visita en Proyecto** en 1 clic atómico y **resolver/rechazar Garantías** sin depender de apps externas.
5. **Aislamiento de Namespace en `collectionGroup('projects')`**: Todo documento creado bajo `crm_contacts/{contactId}/projects/{projectId}` incluye obligatoriamente `source: 'CRM'` y `tenantId`, y el lector filtra `where('source', '==', 'CRM')` + verifica `doc.ref.path.includes('crm_contacts')` para jamás colisionar con colecciones raíz `/projects` de otros módulos.
6. **Entrada Directa para Personal de Logística**: Si un usuario autenticado posee `crm.deliveries` o `crm.projects` (o el unificado `crm.scheduling`) pero **no** tiene `crm.chats`, la ruta del CRM abre directamente el **Workspace Global de Agenda y Entregas** a pantalla completa.

---

## 2. Modelo de Datos Canónico en Firestore (`src/lib/types/crm-operations.ts`)

Todas las entidades operativas cuelgan de `crm_contacts/{contactId}/*` para mantener trazabilidad 360° por cliente y se agregan globalmente mediante consultas `collectionGroup`:

```typescript
// src/lib/types/crm-operations.ts
export type DeliveryStatus =
  | 'Pendiente'
  | 'Alistando'
  | 'En Ruta'
  | 'Entregado'
  | 'Cancelado';

export type DeliveryPaymentStatus =
  | 'Pendiente / N/A'
  | 'Pagado'
  | 'Contra Entrega'
  | 'A Crédito';

export interface CrmDeliveryRecord {
  id: string;                 // Igual a ticketId (ej. 'ETG-0042')
  ticketId: string;
  tenantId: string;           // 'default' en Single-Tenant o ID del tenant en SaaS
  source: 'CRM';
  status: DeliveryStatus;
  type: 'directa' | 'encomienda';
  ordernumber: string;        // N.º de factura, cotización u orden (requerido)
  paymentStatus: DeliveryPaymentStatus;
  // Campos modalidad 'directa' (flota / mensajero propio):
  customerName?: string;
  customerPhone?: string;
  addressLink?: string;       // Pin Google Maps / Waze extraído del chat o pegado
  locationdetails?: string;   // Dirección exacta y señas de referencia
  driverId?: string;
  driverName?: string;
  deliveryDate?: string;      // 'YYYY-MM-DD'
  // Campos modalidad 'encomienda' (paquetería / transporte externo):
  shippingAgencyId?: string;
  agencyName?: string;
  destinationCity?: string;   // Requerido en encomienda
  recipientName?: string;     // Requerido en encomienda
  recipientPhone?: string;    // Requerido en encomienda
  trackingNumber?: string;    // N.º de guía
  // Metadatos y atribución:
  notes?: string;
  crmClientId: string;
  externalSyncId?: string | null;
  createdBy: string;          // UID del asesor creador
  createdByName: string;
  createdAt: any;
  updatedAt?: any;
}

export type VisitStatus =
  | 'Programada'
  | 'En Curso'
  | 'Reprogramada'
  | 'Cotizando'
  | 'Completado'
  | 'Cancelada';

export interface CrmVisitRecord {
  id: string;                 // Ej. 'VIS-0015'
  visitId: string;
  tenantId: string;
  source: 'CRM';
  crmClientId: string;
  customerName: string;
  customerPhone: string;
  locationDetails: string;
  locationLat?: number;
  locationLng?: number;
  addressLink?: string;
  visitDate: string;          // 'YYYY-MM-DD'
  visitTime: string;          // 'HH:mm' (default '09:00')
  status: VisitStatus;
  installerIds: string[];     // UIDs o IDs del catálogo técnico
  description?: string;       // Qué medir / evaluar en sitio
  notes?: string;
  convertedToProjectId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt?: any;
}

export type ProjectStatus =
  | 'Pendiente'
  | 'En Progreso'
  | 'Instalado'
  | 'Completado'
  | 'Cancelado';

export interface CrmProjectMaterialLine {
  id: string;
  name: string;               // Configurable desde crm_settings/logistics_catalog.serviceTypes[]
  quantity: number;
  unit: string;               // Ej: 'm²' | 'm lineales' | 'unidades' | 'global'
  description?: string;       // SKU, acabado o especificación
}

export interface CrmProjectRecord {
  id: string;                 // Ej. 'PROY-0028'
  projectId: string;
  tenantId: string;
  source: 'CRM';              // OBLIGATORIO para aislar collectionGroup('projects')
  crmClientId: string;
  name: string;
  customerName: string;
  customerPhone: string;
  locationDetails: string;
  locationLat?: number;
  locationLng?: number;
  addressLink?: string;
  startDate: string;          // 'YYYY-MM-DD'
  startTime?: string;         // 'HH:mm'
  endDate?: string;           // 'YYYY-MM-DD' cuando isOneDay === false
  isOneDay: boolean;
  status: ProjectStatus;
  installerIds: string[];
  description?: string;
  totalAmount?: number;       // Monto total opcional
  laborAmount?: number;       // Mano de obra / servicio opcional
  materials: CrmProjectMaterialLine[];
  sourceVisitId?: string;
  completedAt?: string;       // ISO timestamp autogenerado al pasar a 'Completado'
  warrantyExpiresAt?: string; // ISO timestamp = completedAt + warrantyPolicyDays
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt?: any;
}

export type WarrantyStatus = 'Abierta' | 'En Proceso' | 'Resuelta' | 'Rechazada';

export interface CrmWarrantyRecord {
  id: string;                 // Ej. 'GAR-0004'
  warrantyId: string;
  tenantId: string;
  source: 'CRM';
  crmClientId: string;
  projectId: string;
  projectDisplayId: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  status: WarrantyStatus;
  visitDate?: string;         // 'YYYY-MM-DD'
  visitTime?: string;         // 'HH:mm'
  installerIds?: string[];
  resolution?: string | null;
  warrantyEligibility: {
    eligible: boolean;
    expiresAt: string;
    policyDays: number;       // Configurable en crm_settings/logistics_catalog (default: 90 días)
  };
  createdBy: string;
  createdByName: string;
  createdAt: any;
  updatedAt?: any;
}
```

### 2.1 Generador Transaccional de Folios Operativos (`mintOperationSequentialId`)

```typescript
// src/lib/services/crm-operations-counter.ts
import { FieldValue } from 'firebase-admin/firestore';

export type OperationPrefix = 'ETG' | 'VIS' | 'PROY' | 'GAR';

export async function mintOperationSequentialId(
  firestore: FirebaseFirestore.Firestore,
  counterDocPath: string, // crmPaths(tenantId).settingsDoc('operations_counters')
  prefix: OperationPrefix
): Promise<string> {
  const ref = firestore.doc(counterDocPath);
  const nextNum = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = Number(snap.data()?.[prefix] || 0);
    const next = current + 1;
    tx.set(ref, { [prefix]: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}
```

### 2.2 Catálogo Operativo Editable por Cliente (`crm_settings/logistics_catalog`)

En lugar de quemar listas de choferes, transportistas o tipos de instalación en código, expón en *Configuración CRM → Operación y Agenda* el documento `crm_settings/logistics_catalog`:

```typescript
export interface CrmLogisticsCatalogConfig {
  drivers: Array<{ id: string; name: string; phone?: string; active: boolean }>;
  shippingAgencies: Array<{ id: string; name: string; active: boolean }>;
  technicians: Array<{ id: string; name: string; specialty?: string; active: boolean }>;
  serviceMaterialTypes: string[]; // Ej: ['Instalación General', 'Mantenimiento', 'Ensamble']
  measurementUnits: string[];     // Ej: ['m²', 'm lineales', 'unidades', 'horas']
  warrantyPolicyDays: number;     // Default: 90
}
```

---

## 3. Especificación de Interfaz, Botones y Reglas de Negocio en `CrmRightPanel`

### 3.1 Puntos de Entrada desde el Chat
1. **`ChatContextualToolbar` (bajo `ChatInput`)**: Botones rápidos `Notas` (`StickyNote`), `Entrega` (`Truck`), `Proyectos` (`Hammer`), `Cobro` (`CreditCard`), `POS` (`Store`) y `Marketing` (`Image`), filtrados por `useCrmPermissions` y `isModuleLicensed()`.
2. **Extracción 1-Clic desde Burbujas con Ubicación (`Agregar a Entregas`)**:
   - Todo mensaje con `type === 'location'` o texto que coincida con `/https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl|maps\.google\.com|waze\.com)[^\s]*/i` muestra en su menú contextual la acción **"Agregar a Entregas"**.
   - Al pulsarla, inyecta `detectedMapUrl`, abre `CrmRightPanel` en la pestaña `Entrega` (`Nueva`) precargando el link y guarda `metadata.deliveryMapUrl` en el contacto para reutilizarlo en futuras entregas o visitas.

### 3.2 Pestaña `Entrega` (`DeliveryTab` + `DeliveryHistory`)
- **Subtabs**: `Nueva` | `Historial (N)`.
- **Selector de Modalidad (`Directa (Chofer)` vs `Encomienda`)**:
  - **Directa**: `N.º Orden / Factura *`, `Estado del Pago`, `Cliente`, `Teléfono`, `Link Waze / Maps` (con botón abrir externo y autoguardado `onBlur` en `metadata.deliveryMapUrl`), `Dirección Exacta / Señas` (autoguardado `onBlur` en `metadata.deliveryNotes`), `Chofer Asignado`, `Fecha de Entrega` (`min={today}`) y `Notas de Logística`.
  - **Encomienda**: `N.º Orden / Factura *`, `Estado del Pago`, `Agencia de Envío`, `Ciudad / Destino *`, `Nombre de quien recibe *`, `Teléfono *`, `N.º de Guía` y `Notas de Empaque`.
- **Máquina de Estados y Candado de Fecha Futura en `DeliveryHistory`**:
  - Transiciones locales completas:
    - `Pendiente` (Ámbar) → `Alistando` | `Cancelado`
    - `Alistando` (Azul) → `En Ruta` | `Entregado` *(útil en encomiendas)* | `Pendiente` | `Cancelado`
    - `En Ruta` (Índigo) → `Entregado` | `Alistando` | `Cancelado`
    - `Entregado` (Esmeralda) y `Cancelado` (Rosa, exige confirmación en `AlertDialog`) → **Estados Terminales**.
  - **Candado Preventivo de Fecha Futura (`isDeliveryFuture`)**: Si `deliveryDate > today`, el selector de estado operativo permanece bloqueado con etiqueta `"En cola para {fecha}"` para impedir que bodega despache por error una orden programada para días futuros (permitiendo siempre reprogramar la fecha en el calendario inline).

### 3.3 Pestaña `Proyectos, Visitas y Garantías` (`ProjectsTab`)
- **Subtabs**: `Historial (N)` (con filtros `Todos | Visitas | Proyectos | Garantías`) | `Nueva` (selector de 3 tarjetas de acción):
  1. **`Agendar Visita Técnica` (`VisitForm`)**:
     - **Candado Anti-Duplicado**: Se deshabilita mostrando `"El contacto ya tiene una visita activa"` si existe alguna visita en estado `Programada`, `En Curso` o `Reprogramada`.
     - En la tarjeta de historial (`VisitCard`), además de reagendar fecha/hora y cambiar estado, incluye el botón **`Convertir a Proyecto`** que abre `ProjectForm` precargando dirección, coordenadas GPS, técnico y `sourceVisitId`, marcando en un `writeBatch` la visita como `Completado` con `convertedToProjectId`.
  2. **`Crear Proyecto / Servicio` (`ProjectForm`)**:
     - Soporta toggle **`Proyecto de 1 día`** (`isOneDay = true` por defecto; al desmarcarlo habilita `Fecha fin *` con `min={startDate}`), arreglo dinámico de materiales/alcances (`+ Agregar línea`), técnico principal y montos opcionales.
     - En `ProjectCard`, cambiar el estado a **`Completado`** estampa automáticamente `completedAt = new Date().toISOString()` y `warrantyExpiresAt = addDays(now, warrantyPolicyDays).toISOString()`.
  3. **`Abrir Garantía` (`WarrantyForm`)**:
     - **Compuerta Determinista de Vigencia**: Solo se habilita si el contacto tiene al menos `1` proyecto con `status === 'Completado'` cuyo `warrantyExpiresAt` siga vigente (`daysLeft > 0`), mostrando en el selector los días restantes (`"42d restantes"`). En `WarrantyCard` permite actualizar estado (`Abierta` → `En Proceso` → `Resuelta` / `Rechazada`) y documentar `resolution`.

---

## 4. Workspace Global de Agenda y Operaciones (`DeliveriesModal`)

1. **Tres Modos de Visualización Responsivos**:
   - **`Tabla` (`table`)**: Tabla operativa densa con cambio de estado inline, reagendador de fecha y columna `Asesor` (`createdByName`).
   - **`Agenda` (`agenda`)**: Izquierda `<DeliveriesCalendar />` mensual con puntos semánticos por día (`azul = entregas`, `ámbar = visitas`, `púrpura = proyectos`, `rosa = garantías`) + Derecha `<AgendaList />` cronológico.
   - **`Split Ultra-Wide` (`split`)**: Activado automáticamente en pantallas `>= 1536px` (`2xl`), combinando Tabla + Calendario + Lista.
2. **Expansión Diaria de Proyectos Multi-Día**:
   - Si un proyecto tiene `isOneDay === false` y abarca del lunes al jueves (`4` días), `useCrmAllProjectsEvents` proyecta entradas virtuales por cada fecha ocupada con badge `"Día 2 de 4"` para que el calendario de capacidad técnica refleje la ocupación real de cada jornada.
3. **Filtros Rápidos + Guardia de Privacidad al Saltar al Chat (`Ir al Chat`)**:
   - Filtros rápidos `Todas | Hoy | Mañana | Próximas`, chip de fecha específica al tocar un día del calendario y buscador `NFD` (folio, cliente, teléfono, ciudad, chofer/técnico y asesor).
   - Al pulsar **`Ir al Chat`** (`MessageSquare`), verifica permisos: si `!isCrmAdmin && targetChat.assignedTo && targetChat.assignedTo !== currentUser.uid`, muestra aviso `"Chat asignado a otro asesor"` en vez de exponer conversaciones privadas de otro vendedor.
4. **Paginación Infinita `collectionGroup` Resiliente (`PAGE_SIZE = 25`)**:
   - Usa `IntersectionObserver` (`rootMargin: '120px'`) incrementando de `25` en `25` y captura `failed-precondition` cayendo automáticamente a consulta sin orden con ordenamiento en cliente mientras termina de construirse cualquier índice en Firebase.

---

## 5. Motor Servidor Anti-SSRF de Desenrollado de Links GPS y Distancia Vial (`pricing-route-service.ts`)

Utilidad 100% gratuita y autónoma en servidor para extraer latitud/longitud de links acortados de WhatsApp y calcular kilómetros reales de manejo:

1. **Allowlist Estricta Anti-SSRF**: Solo sigue redirecciones (`redirect: 'manual'`, máx. `6` saltos HTTP `301..308`) hacia dominios permitidos: `maps.app.goo.gl`, `goo.gl`, `google.com`, `maps.google.com`, `waze.com` y `ul.waze.com`.
2. **Prioridad Exacta de Extracción de Coordenadas**:
   - Prioridad 1: Pin exacto del lugar `!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)` *(evita tomar por error el centro de cámara `@lat,lng` desplazado)*.
   - Prioridad 2: Parámetros `[?&](?:q|ll|query|center|destination|daddr)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)`.
   - Prioridad 3: Viewport `@(-?\d+\.\d+),(-?\d+\.\d+)` o par decimal crudo validado dentro del *bounding box* del país configurado.
3. **Ruteo Vial sin Llaves de Pago**: Consulta OSRM (`router.project-osrm.org/route/v1/driving/...`) desde las coordenadas de la bodega/sucursal configurada en `crm_settings/general`, con fallback matemático instantáneo `Haversine × 1.32` si el servicio público no responde en `< 3.5s`.

---

## 6. Interfaz Opcional de Conector Logístico Externo (`ExternalLogisticsAdapter`)

Cuando un cliente empresarial desee sincronizar sus entregas/visitas con un WMS, app de choferes o ERP logístico propio (`schedulingModule.mode === 'external_api'`), implementa este adaptador desacoplado leyendo credenciales desde la tarjeta `externalOpsOrPos` de la Bóveda Cifrada:

```typescript
// src/lib/services/logistics-adapter.ts
export interface ExternalLogisticsAdapter {
  isEnabled(tenantId?: string): Promise<boolean>;
  onDeliveryUpserted?(record: CrmDeliveryRecord): Promise<{ externalId?: string } | void>;
  onVisitUpserted?(record: CrmVisitRecord): Promise<{ externalId?: string } | void>;
  onProjectUpserted?(record: CrmProjectRecord): Promise<{ externalId?: string } | void>;
  onWarrantyUpserted?(record: CrmWarrantyRecord): Promise<{ externalId?: string } | void>;
}
```

- **Webhook Entrante Genérico (`POST /api/crm/webhooks/logistics`)**: Autenticado con `crypto.timingSafeEqual` contra el secreto de la Bóveda, procesa los eventos canónicos `DELIVERY_UPDATED`, `VISIT_UPDATED`, `VISIT_CONVERTED_TO_PROJECT`, `PROJECT_UPDATED` y `WARRANTY_UPDATED` actualizando de forma idempotente la subcolección local correspondiente en `crm_contacts/{contactId}/*`.

---

## 7. Índices Compuestos y `fieldOverrides` Requeridos (`firestore.indexes.json`)

Agrega estos índices `COLLECTION_GROUP` para garantizar consultas globales instantáneas:
- `deliveries`: `(tenantId ASC, deliveryDate ASC, createdAt DESC)` y `(tenantId ASC, status ASC, deliveryDate ASC)` + `fieldOverrides` `createdAt` (`COLLECTION_GROUP` `DESC`).
- `visits`: `(tenantId ASC, visitDate ASC, createdAt DESC)` y `(tenantId ASC, status ASC, createdAt DESC)` + `fieldOverrides` `createdAt` (`COLLECTION_GROUP` `DESC`).
- `projects`: `(tenantId ASC, source ASC, createdAt DESC)` y `(tenantId ASC, status ASC, createdAt DESC)`.
- `warranties`: `(tenantId ASC, status ASC, createdAt DESC)` + `fieldOverrides` `createdAt` (`COLLECTION_GROUP` `DESC`).
