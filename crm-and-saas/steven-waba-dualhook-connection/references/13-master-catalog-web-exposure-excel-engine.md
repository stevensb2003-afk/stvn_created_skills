# Blueprint 13 — Módulo Activable de Catálogo Maestro (`catalogProducts`), Exposición en Catálogo Web (`web_catalog`) y Motor Universal de Plantillas Excel / Edición Masiva (`100% ERP-Agnóstico`)

> **Lectura Obligatoria**: Todo agente que active, construya o extienda el módulo de **Gestión de Catálogo, Exposición Web o Importación/Exportación Masiva en Excel** (`enabledModules.catalog_master` y `enabledModules.web_catalog`) DEBE seguir este diseño **100% independiente de cualquier ERP específico**, alimentando simultáneamente al **POS del CRM**, al **Agente IA de Ventas**, al **Sitio Web Público** y al **Portal Mayorista B2B** (con adaptador `ErpCatalogAdapter` opcional si el cliente usa `Modo B2` como Alegra).

---

## 1. Arquitectura de Doble Colección: `catalogProducts` (SSOT Interno) vs. `web_catalog` (Proyección Pública Segura)

Para proteger costos unitarios, márgenes brutos y metadatos fiscales/contables sin sacrificar velocidad en la web pública ni en el Agente IA, el catálogo opera sobre **2 colecciones sincronizadas atómicamente en el mismo `writeBatch`**:

1. **`catalogProducts/{sku}` (Catálogo Maestro Interno — Document ID = `sku`)**:
   - Contiene la verdad absoluta de precios, impuestos, costos confidenciales (`price_cost`), existencias físicas (`quantity`), clasificación de inventario (`product_kind`), categorías, series de SKU y vínculos opcionales a ERPs (`erp_links`).
   - **Lectura/Escritura**: Restringida estrictamente a personal interno autenticado según RBAC (`inventory` / `crm.pos` / `crm.catalog`).
2. **`web_catalog/{sku}` (Catálogo de Exposición Web & Contexto Comercial IA)**:
   - Se actualiza automáticamente en el **mismo `writeBatch`** de cada alta, edición, cambio de switch o actualización masiva de `catalogProducts` mediante `appendWebCatalogSyncToBatch(batch, db, sku, payload)` usando **`{ merge: true }`**.
   - **Lista Blanca Estricta (`WEB_CATALOG_SYNC_FIELDS`)**: Solo proyecta campos seguros para exposición pública:
     `sku`, `name`, `description`, `category_id`, `category_name`, `unit`, `origin`, `sub_series`, `price_base`, `price_total`, `status`, `active`, `activeWeb`, `in_stock` *(booleano, jamás la cantidad exacta si es confidencial)*, `dealType`, `dealDiscountPercent`, `dealPrice`, `imageUrl`, `images` y `updatedAt`.
   - **Campos Confidenciales PROHIBIDOS en `web_catalog`**: `price_cost`, márgenes, cuentas contables, `erp_links` y `createdBy`.
   - **Preservación de Fotografías Web (`{ merge: true }`)**: Como la galería de alta resolución (`imageUrl`, `images[]`) suele administrarse desde el gestor visual web, usar `{ merge: true }` garantiza que una actualización masiva de precios desde Excel jamás borre las fotos del producto.
   - **Revalidación Instantánea**: Cada mutación que afecte precios, ofertas o visibilidad web invalida en `0 ms` la caché RAM del Agente IA (`invalidateCrmAiContextCache()`) y, si el cliente configuró `webRevalidateWebhookUrl` en la Bóveda/Ajustes, dispara `POST { tag: 'catalog' }` hacia su sitio Next.js/e-commerce.

---

## 2. Esquema Canónico 100% ERP-Agnóstico (`src/lib/types/catalog.ts`)

```typescript
// src/lib/types/catalog.ts — Cero acoplamiento duro a un ERP específico
export type ProductInventoryKind =
  | 'stocked'      // Inventario físico controlable (descuenta stock al facturar)
  | 'non_stocked'  // Producto bajo pedido o no inventariable (nunca bloquea facturación)
  | 'service';     // Mano de obra, flete o servicio profesional

export type ProductOriginKind = 'imported' | 'local' | 'manufactured';

export interface ErpItemLink {
  externalId: string;
  providerKey: string; // Ej: 'alegra' | 'sap' | 'odoo' | 'custom_erp'
  syncedAt?: any;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface CatalogProduct {
  id: string;                 // Igual a sku (ej. 'PROD1001')
  tenantId: string;           // 'default' o ID del tenant
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id: string;
  category_name: string;
  origin: ProductOriginKind;
  sub_series?: string;        // Ej: '1 - Línea Interior' | '2 - Línea Exterior'
  unit: string;               // Ej: 'Unidad' | 'Metro' | 'Caja' | 'Servicio'
  tax_code?: string;          // Ej: CABYS 13 dígitos en CR, ClaveProdServ SAT en MX, o vacío
  tax_name: string;           // Ej: 'IVA'
  tax_percentage: number;     // Ej: 13, 16, 19, 4, 2, 1, 0
  price_total: number;        // Precio de venta final con impuesto incluido
  price_base: number;         // Precio neto sin impuesto = round2(price_total / (1 + tax_percentage / 100))
  price_cost?: number;        // Costo unitario confidencial
  quantity?: number;          // Existencia actual (cuando product_kind === 'stocked')
  in_stock: boolean;
  product_kind: ProductInventoryKind;
  erp_links?: Record<string, ErpItemLink>; // Vacío en Modo Standalone / Modo Hacienda Nativo
  status: 'active' | 'draft' | 'archived';
  active: boolean;            // Switch maestro de facturación/POS
  activeWeb: boolean;         // Switch de Exposición en Página Web y Bot IA (subordinado a active)
  dealType?: 'regular' | 'promotion' | 'clearance';
  dealDiscountPercent?: number;
  dealPrice?: number;
  imageUrl?: string;
  images?: string[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface ProductCategory {
  id: string;
  name: string;
  sku_prefix: string;         // Prefijo para generador automático de SKU (ej. 'LMP', 'SRV')
  has_sub_series: boolean;
  sub_series?: string[];
  product_kind: ProductInventoryKind;
  default_tax_code?: string;
  default_tax_percentage: number;
  default_unit: string;
  order: number;
  accounting_accounts?: {
    incomeAccount?: string;
    inventoryAccount?: string;
    cogsAccount?: string;
  };
}
```

### 2.1 Jerarquía Determinista de Visibilidad (`active` vs. `activeWeb`)
En toda función de escritura (`createProduct`, `updateProduct`, `toggleProductSwitches`, edición masiva e importación Excel), aplica la invariante:
```typescript
const nextActive = Boolean(input.active);
const nextActiveWeb = nextActive ? Boolean(input.activeWeb) : false;
```
- Si un producto se apaga en el catálogo maestro (`active = false`), se retira automáticamente del sitio web y del Agente IA (`activeWeb = false`).
- Si un producto es solo de venta interna en mostrador/POS, puede mantenerse con `active = true` y `activeWeb = false`.

### 2.2 Generador Inteligente de SKUs con Detección de Huecos y Resumen Financiero en Vivo
1. **Fórmula Configurable (`${sku_prefix}${D1}${D2}${NN}`)**:
   - Escanea los SKUs existentes de la categoría/serie, detecta **huecos disponibles** (ej. si existen `01, 02, 04`, sugiere automáticamente `03 ★ Hueco disponible` antes de `05`) y bloquea duplicados en tiempo real.
2. **Tarjeta `ProductFinancialSummary` en Vivo**:
   - Calcula instantáneamente `price_base = round2(price_total / (1 + tax_percentage / 100))`, `taxAmount`, `profit = price_base - price_cost`, `% Margen sobre Venta = (profit / price_base) * 100` y `% Markup sobre Costo = (profit / price_cost) * 100`, desplegando banner destructivo de advertencia si `price_base < price_cost` (margen negativo).

---

## 3. Interfaz del Módulo de Catálogo (`/products` o Sub-Vista Integrada del CRM)

1. **Navegación Mobile-First**:
   - En `< 768px`, alterna en pantalla completa entre `CategorySidebar` y la grilla/lista de productos con botón `← Categorías`.
2. **Acciones de Cabecera y Filtros (`ProductFilterBar`)**:
   - Acciones: **`Cola de Exportación (N)`** (`ExportPanel`), **`Subir Excel`** (`BulkUpdateDialog`), **`Edición Masiva`** (`/products/mass-update`), **`Configuración de Categorías/Impuestos`** y **`+ Nuevo Producto`** (flujo de 2 pasos con opción de clonar desde producto existente y cola de sesión *"Guardar y crear otro"*).
   - Filtros con debounce `250ms`: búsqueda (`SKU / Nombre / Código Fiscal`), tipo (`Todos | Inventariable | No-Inventariable | Servicio`), origen, estado (`Todos | Activos | Inactivos | Visibles en Web | Ocultos en Web`), estado de sincronización ERP (solo visible si hay un `ErpCatalogAdapter` activo), ordenamiento y paginación de `24` ítems con toggle Galería/Lista.
3. **Barra Flotante de Selección Múltiple (`BulkActionBar`)**:
   - Al marcar checkboxes: `Seleccionar todos (N)` | `Actualizar Masivamente` (precarga los SKUs en `sessionStorage` y abre `/products/mass-update`) | `Exportar Excel (.xlsx)` | `Enviar a Cola de Exportación` | `Sincronizar ERP` *(opcional)* | `Eliminar lote`.

---

## 4. Motor Completo de Plantillas Excel (`.xlsx`), Actualización en 3 Pasos y Hoja Interactiva Masiva (`product-excel.ts`)

> [!IMPORTANT]
> **PARIDAD FUNCIONAL 100% SIN DEPENDENCIA DE ALEGRA**:
> Toda la potencia de exportación en plantillas `.xlsx`, importación con mapeo inteligente de columnas, previsualización de diferencias y tabla de edición masiva funciona **nativamente contra Firestore (`catalogProducts` + `web_catalog`)** usando `xlsx` (SheetJS). Si el cliente activa un ERP externo (`Modo B2`), el `ErpCatalogAdapter` habilita adicionalmente las plantillas específicas de ese ERP.

### 4.1 Tres Plantillas Oficiales de Exportación (`.xlsx` — `src/lib/product-excel.ts`)

1. **Plantilla Universal Maestra + Web (`HEADERS_UNIVERSAL_CATALOG` — Por Defecto en Modo Nativo / Hacienda)**:
   - Columnas canónicas listas para re-importar sin pérdida:
     `SKU | Nombre | Categoría | Tipo (Inventariable/No-Inv/Servicio) | Unidad | Código Fiscal (CABYS/SAT) | Impuesto % | Costo Unitario | Precio Base (Sin Imp.) | Precio Total (Imp. Inc.) | Stock Actual | Activo POS (Sí/No) | Visible en Web (Sí/No) | Oferta % | Descripción | URL Imagen Principal`
2. **Cola Inteligente de Exportación (`ExportPanel` — Alta vs. Actualización)**:
   - Divide automáticamente los productos en cola entre:
     - **Productos Existentes (Actualización Masiva)** → Descarga en 1 clic con precios, costos, impuestos y visibilidad actual.
     - **Productos Nuevos (Creación Inicial)** → Agrupados por `stocked` vs `non_stocked`/`service`, permitiendo editar inline el **Stock Inicial** de cada ítem inventariable justo antes de generar el archivo `.xlsx`.
3. **Adaptador Opcional de Plantilla ERP (`ErpExcelProfile` — Ej. Perfil Alegra 27 Columnas cuando `Modo B2 = Alegra`)**:
   - Cuando el cliente opera con Alegra, expone el perfil exacto de creación (`19 cols` inventariable / `14 cols` servicio en hoja `'Productos'`) y actualización (`27 cols` en hoja `'Worksheet'` con números formateados a 5 decimales con coma `formatDecimal5Comma(n)`, ej. `"5221,24000"`).

### 4.2 Asistente de Actualización Masiva por Excel en 3 Pasos (`BulkUpdateDialog`)

1. **Paso 1 — Carga y Autodetección (`BulkStepUpload.tsx`)**:
   - Drag-and-drop para archivos `.xlsx`, `.xls` o `.csv`. Lee encabezados con `XLSX.read` y autodetecta nombres equivalentes (`SKU` / `Referencia` / `Código`, `Precio total` / `PVP`, `Precio base`, `Costo`, `Stock` / `Cantidad`, `Visible en tienda` / `Visible en Web`, `Estado`).
2. **Paso 2 — Mapeo Flexible con Presets y Badges de Impacto (`BulkStepMapping.tsx`)**:
   - Exige únicamente **`1` columna llave obligatoria (`skuCol`)** y permite mapear cualquiera de los **11 campos destino opcionales** (`externalErpIdCol`, `nameCol`, `descriptionCol`, `priceTotalCol`, `priceBaseCol`, `priceCostCol`, `taxPercentageCol`, `taxCodeCol`, `quantityCol`, `activeCol`, `activeWebCol`).
   - Incluye **Presets en 1 clic** (`Plantilla Universal`, `Solo Lista de Precios`, `Solo Inventario y Costos`, `Perfil ERP 27 cols`, `Limpiar`) y muestra en cada fila un badge indicando si el cambio impacta **`Catálogo + Web`** o **`Solo Catálogo Interno`**.
3. **Paso 3 — Parser Tolerante, Diff Preview y Creación de Faltantes (`BulkStepPreview.tsx`)**:
   - **Normalizador Numérico Internacional**: Soporta tanto formato anglosajón (`12,500.50`) como formato europeo/latinoamericano de coma decimal (`5.221,24000`) y símbolos de moneda (`₡`, `$`).
   - **Derivación Bidireccional de Impuestos**: Si el Excel trae solo `price_total`, calcula `price_base` automáticamente según el `tax_percentage` de la fila o del producto actual (y viceversa); marca `hasNameConflict` cuando el nombre del Excel difiere del nombre registrado.
   - **4 Pestañas KPI de Auditoría Pre-Ejecución**: `Por Actualizar (N)` (mostrando diff `antes → después`), `No Encontrados en Catálogo (N)`, `Sin Cambios (N)` y `Sin SKU (N)`.
   - **Acción 1-Clic para SKUs Faltantes**: Permite exportar los no encontrados a `.xlsx` **o crear los `N` productos nuevos directamente en el catálogo** infiriendo categoría y serie desde el prefijo del SKU.
   - **Ejecución Atómica por Lotes**: Aplica las mutaciones en `writeBatch` particionados de `100` productos (`200` operaciones por batch sumando `catalogProducts` + `web_catalog` con `removeUndefined()`).

### 4.3 Hoja de Cálculo Interactiva de Edición Masiva (`/products/mass-update`)

Para ajustes rápidos de precios, stock o exposición web sin abrir Excel:
1. **Panel Izquierdo (`MassUpdateSelectorPanel`)**: Acumula productos de distintas categorías o búsquedas (`+ Agregar filtrados (N)`) o hidrata la selección traída desde `/products`.
2. **Tabla Derecha Tipo Spreadsheet (`MassUpdateTable`)**:
   - Mantiene fijas (`sticky left`) las 3 primeras columnas (`Checkbox`, `SKU`, `Nombre`) y ofrece píldoras superiores para mostrar/ocultar columnas (`Categoría`, `Precio Total`, `Precio Base`, `Costo`, `Impuesto %`, `Stock`, `Código Fiscal`, `Unidad`, `Activo POS`, `Visible Web`, `Descripción`).
   - Toda celda modificada se ilumina en ámbar mostrando en tooltip el valor original (`Antes → Ahora`), recalculando en vivo `Precio Total ↔ Precio Base`.
3. **Barra Superior de Fórmulas por Lote (`MassUpdateBatchBar`)**:
   - Permite aplicar transformaciones matemáticas sobre todas las filas seleccionadas con **5 operadores**:
     - `=` Asignar valor exacto
     - `+%` Incremento porcentual (ej. `+8%` por inflación/ajuste de lista, con redondeo configurable)
     - `-%` Reducción porcentual
     - `+` Suma fija
     - `-` Resta fija
   - Botón `Revertir cambios` y **3 modos de guardado**: **`Solo Descargar Excel`** | **`Guardar en Catálogo + Descargar Excel`** | **`Guardar en Catálogo (+ Sync ERP si está activo)`**.

---

## 5. Reglas de Seguridad `firestore.rules` para el Módulo de Catálogo y Exposición Web

```javascript
// Catálogo Maestro Interno: confidencial (contiene costos y márgenes)
match /catalogProducts/{sku} {
  allow read: if hasCrmAccess() && (
    isModuleLicensed('catalog_master') || isModuleLicensed('pos')
  );
  allow write: if isCrmAdmin() && (
    isModuleLicensed('catalog_master') || isModuleLicensed('pos')
  );
}

match /productCategories/{categoryId} {
  allow read: if hasCrmAccess();
  allow write: if isCrmAdmin() && isModuleLicensed('catalog_master');
}

// Proyección Pública Segura (sin costos ni datos sensibles):
// Si el cliente expone catálogo web público, permite lectura abierta solo a ítems activos en web;
// si no tiene web pública, restringe lectura a miembros autenticados del CRM.
match /web_catalog/{sku} {
  allow read: if (
    isModuleLicensed('web_catalog') &&
    resource.data.get('active', false) == true &&
    resource.data.get('activeWeb', false) == true
  ) || hasCrmAccess();
  allow write: if isCrmAdmin() && (
    isModuleLicensed('catalog_master') || isModuleLicensed('web_catalog')
  );
}
```
