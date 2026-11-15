# Blueprint 13 — Módulo Activable de Catálogo Maestro Parametrizable (`catalogProducts`), Buscador CABYS Hacienda CR, Cuentas Contables, Exposición Web (`web_catalog`) y Motor Excel / Edición Masiva (`100% ERP-Agnóstico`)

> **Lectura Obligatoria**: Todo agente que active, construya o extienda el módulo de **Gestión de Catálogo, Códigos Fiscales CABYS, Cuentas Contables, Exposición Web o Importación/Exportación Masiva en Excel** (`enabledModules.catalog_master` y `enabledModules.web_catalog`) DEBE seguir este diseño **100% parametrizable por cliente e independiente de cualquier ERP específico**, alimentando simultáneamente al **POS del CRM**, al **Agente IA de Ventas**, al **Sitio Web Público** y al **Portal Mayorista B2B** (con adaptador `ErpCatalogAdapter` opcional si el cliente usa `Modo B2` como Alegra).

---

## 1. Arquitectura de Doble Colección: `catalogProducts` (SSOT Interno) vs. `web_catalog` (Proyección Pública Segura)

Para proteger costos unitarios, márgenes brutos y metadatos fiscales/contables sin sacrificar velocidad en la web pública ni en el Agente IA, el catálogo opera sobre **2 colecciones sincronizadas atómicamente en el mismo `writeBatch`**:

1. **`catalogProducts/{sku}` (Catálogo Maestro Interno — Document ID = `sku`)**:
   - Contiene la verdad absoluta de precios, impuestos, costos confidenciales (`price_cost`), existencias físicas (`quantity`), clasificación de inventario (`product_kind`), categorías, orígenes configurables, códigos fiscales (`tax_code`), cuentas contables resueltas y vínculos opcionales a ERPs (`erp_links`).
   - **Lectura/Escritura**: Restringida estrictamente a personal interno autenticado según RBAC (`inventory` / `crm.catalog` / `crm.pos`).
2. **`web_catalog/{sku}` (Catálogo de Exposición Web & Contexto Comercial IA)**:
   - Se actualiza automáticamente en el **mismo `writeBatch`** de cada alta, edición, cambio de switch o actualización masiva de `catalogProducts` mediante `appendWebCatalogSyncToBatch(batch, db, sku, payload)` usando **`{ merge: true }`**.
   - **Lista Blanca Estricta (`WEB_CATALOG_SYNC_FIELDS`)**: Solo proyecta campos seguros para exposición pública:
     `sku`, `name`, `description`, `category_id`, `category_name`, `unit`, `origin`, `sub_series`, `price_base`, `price_total`, `status`, `active`, `activeWeb`, `in_stock` *(booleano, jamás la cantidad exacta si es confidencial)*, `dealType`, `dealDiscountPercent`, `dealPrice`, `imageUrl`, `images` y `updatedAt`.
   - **Campos Confidenciales PROHIBIDOS en `web_catalog`**: `price_cost`, márgenes, cuentas contables, `erp_links`, `tax_code` interno y `createdBy`.
   - **Preservación de Fotografías Web (`{ merge: true }`)**: Como la galería de alta resolución (`imageUrl`, `images[]`) suele administrarse desde el gestor visual web, usar `{ merge: true }` garantiza que una actualización masiva de precios desde Excel jamás borre las fotos del producto.
   - **Revalidación Instantánea**: Cada mutación que afecte precios, ofertas o visibilidad web invalida en `0 ms` la caché RAM del Agente IA (`invalidateCrmAiContextCache()`) y, si el cliente configuró `webRevalidateWebhookUrl` en Ajustes, dispara `POST { tag: 'catalog' }` hacia su sitio Next.js/e-commerce.

---

## 1.5 Esquema de Catálogo Parametrizable por Cliente (`crm_settings/catalog_config`)

No todos los clientes necesitan la misma complejidad de ficha de producto. Mientras la naturaleza base del ítem (`stocked | non_stocked | service`) y sus precios son **universales**, campos avanzados como **Origen**, **Sub-series**, **CABYS**, **Cuentas Contables** o la **Fórmula estricta de SKU** se encienden o apagan en tiempo real desde `crm_settings/catalog_config` sin modificar código:

```typescript
// src/lib/types/catalog.ts — Configuración dinámica por cliente (crm_settings/catalog_config)
export interface CatalogOriginOption {
  id: string;        // Ej: 'imported' | 'local' | cualquier origen custom agregado por el cliente
  label: string;     // Ej: 'Importado' | 'Compra Local' | 'Manufactura Propia'
  skuDigit: string;  // Dígito identificador D1 cuando skuPolicyMode === 'prefix_origin_sub_seq' (ej. '1', '2', '3')
}

export type SkuPolicyMode =
  | 'prefix_origin_sub_seq' // ${PREFIJO}${D1_ORIGEN}${D2_SUBSERIE}${NN} (ej. LMP1041)
  | 'prefix_seq'            // ${PREFIJO}${NNN} o ${PREFIJO}-${NNN} (ej. CAM001)
  | 'manual_free';          // Libre normalizado trim().toUpperCase(), validando solo unicidad

export type FiscalCodeMode =
  | 'cabys_cr_api'     // Buscador en vivo contra API Hacienda CR + IVA automático + favoritos offline
  | 'custom_tax_code'  // Campo texto/catálogo para otro país (SAT ClaveProdServ, DIAN, UNSPSC)
  | 'disabled';        // Oculto en UI, filtros y plantillas Excel

export interface CatalogSchemaConfig {
  // Capacidades activables/desactivables por cliente desde Wizard Día 0 o /products/settings
  enableOriginField: boolean;
  origins: CatalogOriginOption[]; // Default White-Label: imported (1) y local (2)
  enableSubSeries: boolean;
  skuPolicyMode: SkuPolicyMode;
  sequencePadDigits: 2 | 3;       // 2 => 01..99 | 3 => 001..999
  fiscalCodeMode: FiscalCodeMode;
  fiscalCodeLabel: string;        // Ej: 'CABYS' | 'ClaveProdServ' | 'Código Fiscal'
  enableAccountingAccounts: boolean;
  enableCostAndMargins: boolean;
  enableBarcode: boolean;
  enableWebCatalogSync: boolean;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_CATALOG_SCHEMA_CONFIG: CatalogSchemaConfig = {
  enableOriginField: true,
  origins: [
    { id: 'imported', label: 'Importado', skuDigit: '1' },
    { id: 'local', label: 'Compra Local', skuDigit: '2' },
  ],
  enableSubSeries: false,
  skuPolicyMode: 'prefix_origin_sub_seq',
  sequencePadDigits: 2,
  fiscalCodeMode: 'cabys_cr_api',
  fiscalCodeLabel: 'CABYS',
  enableAccountingAccounts: true,
  enableCostAndMargins: true,
  enableBarcode: false,
  enableWebCatalogSync: true,
};
```

### Núcleo Universal vs. Matriz de Reacción en 4 Superficies

- **Núcleo Universal Siempre Activo (No desactivable)**: `product_kind` (`stocked` Inventariable / `non_stocked` No Inventariable / `service` Servicio), `sku`, `name`, `category_id`, `unit`, `tax_name`, `tax_percentage`, `price_base`, `price_total`, `active`.
- **Hook Compartido `useCatalogSchemaConfig()`**: Se suscribe una sola vez a `crm_settings/catalog_config` (con caché memoria y fallback seguro a `DEFAULT_CATALOG_SCHEMA_CONFIG`).
- **Matriz de Reacción Automática al Apagar un Flag**:

| Flag en `crm_settings/catalog_config` | 1. Creación `/products/new` & Edición | 2. Filtros `/products` (`ProductFilterBar`) | 3. Hoja Masiva `/products/mass-update` | 4. Plantillas & Asistente Excel (`3 Pasos`) |
| :--- | :--- | :--- | :--- | :--- |
| `enableOriginField = false` | Oculta selector Origen (asigna `origin: 'general'` por defecto) | Oculta píldora de filtro por Origen | Oculta columna Origen | Omite columna Origen y baja skuPolicy a `prefix_seq` si estaba atado a origen |
| `enableSubSeries = false` | Oculta selector Sub-serie en Paso 2 y en creación de categoría | Sin impacto (usa categoría raíz) | No muestra sub-serie | No pide mapeo de sub-serie |
| `fiscalCodeMode = 'disabled'` | Oculta `<CabysAutocomplete />` y deja `tax_code` vacío | Buscador no exige código fiscal | Oculta píldora/columna `Código Fiscal` | Excluye columna Fiscal de plantillas universales |
| `enableAccountingAccounts = false` | Oculta vista previa de cuentas contables | Sin cambios | Sin cambios | Oculta `/products/settings → Cuentas Contables` |
| `enableCostAndMargins = false` | Oculta `price_cost` y tarjeta de margen en `ProductFinancialSummary` | Oculta métricas de costo en detalle | Bloquea/oculta columna `Costo Unitario` | Excluye `Costo Unitario` de plantilla por defecto |
| `enableBarcode = true` | Habilita campo `Código de Barras (EAN/UPC)` + lector USB/cámara | Buscador también coincide por `barcode` | Habilita columna opcional `Código Barras` | Agrega columna `Código Barras` mapeable |

---

## 2. Esquema Canónico & Motor Polimórfico de SKUs (`src/lib/types/catalog.ts` y `src/lib/product-utils.ts`)

```typescript
// src/lib/types/catalog.ts — Modelos canónicos 100% ERP-agnósticos
export type ProductInventoryKind = 'stocked' | 'non_stocked' | 'service';
export type ProductOriginKind = string; // 'imported' | 'local' | 'general' | orígenes custom

export interface SubSeries {
  id: string;    // Ej: '100', '200'
  label: string; // Ej: 'Línea Estándar', 'Línea Premium'
  digit: number; // Dígito D2 para SKU estructurado
}

export interface ErpItemLink {
  externalId: string;
  providerKey: string; // Ej: 'alegra' | 'sap' | 'odoo' | 'custom_erp'
  syncedAt?: any;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface CabysItem {
  code: string;         // 13 dígitos oficiales Hacienda CR
  description: string;
  taxPercentage?: number; // 13 | 4 | 2 | 1 | 0 extraído directo del API Hacienda
  categories?: string[];
  usageCount?: number;
}

export interface CatalogProduct {
  id: string;
  tenantId: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id: string;
  category_name: string;
  origin: ProductOriginKind;
  sub_series?: string;
  unit: string;
  tax_code?: string;          // CABYS / ClaveProdServ / UNSPSC
  tax_code_description?: string;
  tax_name: string;
  tax_percentage: number;
  price_total: number;
  price_base: number;
  price_cost?: number;
  quantity?: number;
  in_stock: boolean;
  product_kind: ProductInventoryKind;
  erp_links?: Record<string, ErpItemLink>;
  status: 'active' | 'draft' | 'archived';
  active: boolean;
  activeWeb: boolean;
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
  sku_prefix: string;
  has_sub_series: boolean;
  sub_series?: SubSeries[];
  sku_series: Record<string, { last_consecutive: number }>;
  product_kind: ProductInventoryKind;
  default_tax_code?: string;
  default_tax_percentage: number;
  default_unit: string;
  order: number;
  accounting_accounts?: CategoryAccountingConfig;
}
```

### 2.1 Jerarquía Determinista de Visibilidad (`active` vs. `activeWeb`)
En toda función de escritura (`saveProduct`, `bulkUpdateCatalogProducts`, `bulkCreateCatalogProducts`, toggle rápido):
```typescript
const nextActive = Boolean(input.active);
const nextActiveWeb = nextActive ? Boolean(input.activeWeb) : false;
```
- Si `active = false`, `activeWeb` se fuerza a `false` antes de escribir `catalogProducts` y `web_catalog`.

### 2.2 Motor Polimórfico de SKUs y Detección de Huecos (`src/lib/product-utils.ts`)
Soporta los 3 modos configurables por cliente preservando siempre la detección de huecos libres y validación anti-colisión:

```typescript
// src/lib/product-utils.ts — Funciones puras (sin dependencias Firebase/React)
export interface SkuSeriesStatus {
  nextSuggestedSku: string; // Primer hueco libre (★ recomendado) o siguiente al máximo
  nextEndSku: string;       // Consecutivo estricto al final
  gaps: string[];           // Todos los huecos intermedios libres
  occupiedSkus: Set<string>;
  isGap: boolean;
  maxConsecutive: number;
}

export function resolveSeriesPrefix(params: {
  categoryPrefix: string;
  schema: CatalogSchemaConfig;
  originId?: string;
  subSeries?: string;
}): string {
  const prefix = (params.categoryPrefix || 'PRD').trim().toUpperCase();
  if (params.schema.skuPolicyMode !== 'prefix_origin_sub_seq') {
    return prefix; // Modo 'prefix_seq' o 'manual_free': prefijo directo + NNN
  }
  const matchedOrigin = params.schema.origins.find((o) => o.id === params.originId);
  const d1 = params.schema.enableOriginField ? (matchedOrigin?.skuDigit || '2') : '0';
  const sub = params.schema.enableSubSeries ? (params.subSeries || '000') : '000';
  const d2 = sub === '000' ? '0' : sub[0];
  return `${prefix}${d1}${d2}`;
}

export function getSkuSeriesStatus(params: {
  categoryPrefix: string;
  schema: CatalogSchemaConfig;
  originId?: string;
  subSeries?: string;
  allProducts: CatalogProduct[];
  storedLastConsecutive?: number;
}): SkuSeriesStatus {
  const seriesPrefix = resolveSeriesPrefix(params);
  const padLen = params.schema.skuPolicyMode === 'prefix_seq'
    ? Math.max(3, params.schema.sequencePadDigits)
    : params.schema.sequencePadDigits;

  const occupiedNumbers = new Set<number>();
  const occupiedSkus = new Set<string>();
  const seqRegex = new RegExp(`^\\d{${padLen}}$`);

  for (const p of params.allProducts) {
    if (p.status === 'archived') continue;
    const sku = (p.sku || '').trim().toUpperCase();
    if (sku.startsWith(seriesPrefix) && sku.length === seriesPrefix.length + padLen) {
      const tail = sku.slice(seriesPrefix.length);
      if (seqRegex.test(tail)) {
        occupiedNumbers.add(parseInt(tail, 10));
        occupiedSkus.add(sku);
      }
    }
  }

  const highest = occupiedNumbers.size > 0 ? Math.max(...occupiedNumbers) : 0;
  const maxConsecutive = Math.max(highest, params.storedLastConsecutive || 0);
  const gaps: string[] = [];
  for (let i = 1; i <= maxConsecutive; i++) {
    if (!occupiedNumbers.has(i)) {
      gaps.push(`${seriesPrefix}${String(i).padStart(padLen, '0')}`);
    }
  }

  let firstAvailable = 1;
  while (occupiedNumbers.has(firstAvailable)) firstAvailable++;

  return {
    nextSuggestedSku: `${seriesPrefix}${String(firstAvailable).padStart(padLen, '0')}`,
    nextEndSku: `${seriesPrefix}${String(maxConsecutive + 1).padStart(padLen, '0')}`,
    gaps,
    occupiedSkus,
    isGap: firstAvailable <= maxConsecutive,
    maxConsecutive,
  };
}

export function validateSkuFormat(
  skuRaw: string,
  categoryPrefix: string,
  schema: CatalogSchemaConfig,
  originId?: string
): { valid: boolean; warning?: string; error?: string } {
  const sku = (skuRaw || '').trim().toUpperCase();
  if (!sku) return { valid: false, error: 'El SKU es obligatorio.' };
  if (schema.skuPolicyMode === 'manual_free') {
    return /^[A-Z0-9._-]{2,32}$/.test(sku)
      ? { valid: true }
      : { valid: false, error: 'Usa solo letras, números, "." o "-" (2 a 32 caracteres).' };
  }
  const prefix = categoryPrefix.trim().toUpperCase();
  if (!sku.startsWith(prefix)) return { valid: false, error: `El SKU debe empezar con "${prefix}".` };
  const rest = sku.slice(prefix.length);
  if (schema.skuPolicyMode === 'prefix_seq') {
    const padLen = Math.max(3, schema.sequencePadDigits);
    return new RegExp(`^\\d{${padLen},5}$`).test(rest)
      ? { valid: true }
      : { valid: false, error: `Ingresa al menos ${padLen} dígitos después de "${prefix}".` };
  }
  const expectedTail = 2 + schema.sequencePadDigits;
  if (!new RegExp(`^\\d{${expectedTail}}$`).test(rest)) {
    return { valid: false, error: `El SKU debe tener exactamente ${expectedTail} dígitos después de "${prefix}".` };
  }
  const matchedOrigin = schema.origins.find((o) => o.id === originId);
  if (schema.enableOriginField && matchedOrigin && rest[0] !== matchedOrigin.skuDigit) {
    return { valid: true, warning: `El dígito "${rest[0]}" no coincide con el origen "${matchedOrigin.label}" (${matchedOrigin.skuDigit}).` };
  }
  return { valid: true };
}

export function calcPriceBase(priceTotal: number, taxPct = 13): number {
  return Math.round((priceTotal / (1 + taxPct / 100)) * 100) / 100;
}

export function getNameSuggestions(query: string, products: CatalogProduct[], limit = 5): CatalogProduct[] {
  if (!query || query.trim().length < 3) return [];
  const q = query.trim().toUpperCase();
  return products.filter((p) => p.status !== 'archived' && p.name.toUpperCase().includes(q)).slice(0, limit);
}

export function isNameDuplicate(name: string, products: CatalogProduct[], excludeSku?: string): boolean {
  const norm = name.trim().toUpperCase();
  if (!norm) return false;
  return products.some((p) => p.status !== 'archived' && p.sku !== excludeSku && p.name.trim().toUpperCase() === norm);
}
```
- **Tarjeta `ProductFinancialSummary` en Vivo**: Calcula `price_base`, `taxAmount = max(0, price_total - price_base)`, `marginAmount = price_base - price_cost` y `(marginAmount / price_base) * 100`, desplegando alerta roja cuando `price_base < price_cost` (visible solo si `enableCostAndMargins === true`).

---

## 2.5 Buscador CABYS en Vivo desde API Público de Hacienda CR + Favoritos Offline (`fiscalCodeMode === 'cabys_cr_api'`)

El Ministerio de Hacienda de Costa Rica expone el catálogo oficial de bienes y servicios sin token previo. Para evitar latencia repetitiva, problemas CORS y caídas externas, la UI consulta siempre al proxy privado del CRM que combina **Favoritos Locales (`crm_settings/cabys_favorites`) + Caché RAM (`30 min`) + API Oficial Hacienda**:

```typescript
// src/app/api/crm/catalog/cabys/route.ts — Proxy seguro + Caché RAM + Favoritos Offline
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import type { CabysItem } from '@/lib/types/catalog';

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_KEYS = 200;
const queryCache = new Map<string, { expiresAt: number; items: CabysItem[] }>();

function normalizeHaciendaItem(raw: any): CabysItem | null {
  const code = String(raw?.codigo || raw?.code || '').replace(/\D/g, '');
  if (code.length !== 13) return null;
  const tax = Number(raw?.impuesto ?? raw?.taxPercentage);
  return {
    code,
    description: String(raw?.descripcion || raw?.description || '').trim(),
    taxPercentage: Number.isFinite(tax) ? tax : undefined,
    categories: Array.isArray(raw?.categorias) ? raw.categorias.map(String) : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.catalog');
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const cacheKey = q.toLowerCase();

    // 1. Leer favoritos guardados en Firestore (permite autocompletar frecuente en 0 ms / fallback offline)
    const { firestore } = initializeFirebaseAdmin();
    const favSnap = await firestore.doc('crm_settings/cabys_favorites').get();
    const favorites: CabysItem[] = Array.isArray(favSnap.data()?.codes) ? favSnap.data()!.codes : [];
    const matchingFavs = !q
      ? favorites.slice(0, 20)
      : favorites.filter(
          (f) => f.code.includes(q) || f.description.toLowerCase().includes(cacheKey)
        );

    if (!q || q.length < 2) {
      return NextResponse.json({ ok: true, items: matchingFavs, source: 'favorites' });
    }

    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ok: true, items: cached.items, source: 'ram_cache' });
    }

    // 2. Consultar API oficial de Hacienda CR (?codigo=... si son 13 dígitos o ?q=... por texto)
    const isExactCode = /^\d{6,13}$/.test(q);
    const haciendaUrl = isExactCode
      ? `https://api.hacienda.go.cr/fe/cabys?codigo=${encodeURIComponent(q)}&top=25`
      : `https://api.hacienda.go.cr/fe/cabys?q=${encodeURIComponent(q)}&top=25`;

    let remoteItems: CabysItem[] = [];
    let haciendaReachable = true;
    try {
      const hRes = await fetch(haciendaUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (hRes.ok) {
        const json = await hRes.json();
        const rawList = Array.isArray(json?.cabys) ? json.cabys : Array.isArray(json) ? json : [json];
        remoteItems = rawList.map(normalizeHaciendaItem).filter(Boolean) as CabysItem[];
      } else {
        haciendaReachable = false;
      }
    } catch {
      haciendaReachable = false;
    }

    // 3. Deduplicar priorizando favoritos locales del negocio arriba
    const mergedMap = new Map<string, CabysItem>();
    for (const item of [...matchingFavs, ...remoteItems]) {
      if (!mergedMap.has(item.code)) mergedMap.set(item.code, item);
    }
    const items = Array.from(mergedMap.values()).slice(0, 30);

    if (haciendaReachable && items.length > 0) {
      if (queryCache.size >= MAX_CACHE_KEYS) {
        const firstKey = queryCache.keys().next().value;
        if (firstKey) queryCache.delete(firstKey);
      }
      queryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, items });
    }

    return NextResponse.json({
      ok: true,
      items,
      source: haciendaReachable ? 'hacienda_live' : 'offline_favorites_fallback',
      degraded: !haciendaReachable,
      requestedBy: caller.uid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error consultando CABYS' }, { status: err.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyCrmRequestAuth(req, 'crm.catalog.admin');
    const body = await req.json();
    const normalized = normalizeHaciendaItem(body);
    if (!normalized || !normalized.description) {
      return NextResponse.json({ error: 'Código CABYS de 13 dígitos y descripción requeridos.' }, { status: 400 });
    }
    const { firestore } = initializeFirebaseAdmin();
    const ref = firestore.doc('crm_settings/cabys_favorites');
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const list: CabysItem[] = Array.isArray(snap.data()?.codes) ? snap.data()!.codes : [];
      const idx = list.findIndex((x) => x.code === normalized.code);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...normalized, usageCount: (list[idx].usageCount || 1) + 1 };
      } else {
        list.unshift({ ...normalized, usageCount: 1 });
      }
      tx.set(ref, { codes: list.slice(0, 300), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return NextResponse.json({ ok: true, code: normalized.code });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error guardando favorito CABYS' }, { status: err.statusCode || 500 });
  }
}
```

### Integración Obligatoria del `<CabysAutocomplete />` + `<CabysBadge />`:
1. **`<CabysAutocomplete />`**: Se monta en `/products/new`, `ProductEditForm`, `CategoryFormDialog` (`default_tax_code`) y columnas de `/products/mass-update` siempre que `schema.fiscalCodeMode === 'cabys_cr_api'`.
   - Debounce `280ms`, fuente `text-[16px] sm:text-sm`, despliega descripción oficial + badge con tarifa IVA (`13%`, `4%`, `2%`, `1%`, `Exento 0%`).
   - **Autocompletado Inteligente de Impuesto**: Al seleccionar un código CABYS devuelto por Hacienda con `taxPercentage !== undefined`, actualiza automáticamente `tax_percentage` en el formulario y recalcula `price_base` al instante (mostrando aviso discreto si cambió el % IVA), además de disparar en background `POST /api/crm/catalog/cabys` para enriquecer los favoritos offline del cliente.
2. **`<CabysBadge />`**: Muestra el código en `font-mono` + descripción truncada y copia el código al portapapeles con confirmación visual en 1 clic.

---

## 3. Interfaz del Módulo de Catálogo (`/products` o Sub-Vista Integrada del CRM)

1. **Navegación Mobile-First**:
   - En `< 768px`, alterna en pantalla completa entre `CategorySidebar` y la grilla/lista de productos con botón `← Categorías`.
2. **Acciones de Cabecera y Filtros (`ProductFilterBar`)**:
   - Acciones: **`Cola de Exportación (N)`** (`ExportPanel`), **`Subir Excel`** (`BulkUpdateDialog`), **`Edición Masiva`** (`/products/mass-update`), **`Configuración Contable & Reglas`** (`/products/settings` — icono engranaje) y **`+ Nuevo Producto`** (flujo guiado con clonación desde producto de referencia y cola de sesión *"Guardar y crear otro"*).
   - Filtros con debounce `250ms`: búsqueda (`SKU / Nombre / Código Fiscal / Código Barras`), tipo (`Todos | Inventariable | No-Inventariable | Servicio`), origen *(solo visible si `enableOriginField === true`)*, estado (`Todos | Activos | Inactivos | Visibles en Web | Ocultos en Web`), estado ERP *(solo visible si hay `ErpCatalogAdapter` activo)*, ordenamiento y paginación de `24` ítems con toggle Galería/Lista.
3. **Barra Flotante de Selección Múltiple (`BulkActionBar`)**:
   - Al marcar checkboxes: `Seleccionar todos (N)` | `Actualizar Masivamente` (precarga los SKUs en `sessionStorage` y abre `/products/mass-update`) | `Exportar Excel (.xlsx)` | `Enviar a Cola de Exportación` | `Sincronizar ERP` *(opcional)* | `Eliminar lote`.

---

## 3.5 Catálogo de Cuentas Contables y Matriz por Categoría, Tipo y Origen (`/products/settings`)

Completamente independiente de Alegra u otro ERP (sirve tanto para contabilidad interna/exportación contable como para mapear cuentas hacia cualquier software fiscal):

```typescript
// src/lib/types/catalog.ts — Plan de Cuentas & Matriz Adaptativa
export type AccountingAccountType = 'income' | 'inventory' | 'cost' | 'expense';

export interface AccountingAccount {
  id: string;
  code?: string;     // Código contable opcional (ej. '4101-01')
  name: string;      // Nombre exacto de la cuenta
  type: AccountingAccountType;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface OriginAccountingMapping {
  income_account?: string;
  inventory_account?: string;
  cost_account?: string;
}

export interface CategoryAccountingConfig {
  stocked?: Record<string, OriginAccountingMapping>;       // Key = originId o 'general'
  non_stocked?: Record<string, { income_account?: string }>;
  service?: { income_account?: string };
}

export interface DefaultAccountingAccounts {
  income: string;    // Ej: 'Ingresos por ventas'
  inventory: string; // Ej: 'Inventario de mercadería'
  cost: string;      // Ej: 'Costo de ventas'
}

export function resolveProductAccounts(
  productKind: ProductInventoryKind,
  originId: string,
  category?: ProductCategory,
  defaults: DefaultAccountingAccounts = {
    income: 'Ingresos por ventas',
    inventory: 'Inventario de mercadería',
    cost: 'Costo de ventas',
  }
) {
  if (productKind === 'service') {
    return {
      incomeAccount: category?.accounting_accounts?.service?.income_account || defaults.income,
      inventoryAccount: defaults.inventory,
      costAccount: defaults.cost,
    };
  }
  const key = originId || 'general';
  if (productKind === 'non_stocked') {
    const m = category?.accounting_accounts?.non_stocked?.[key] ?? category?.accounting_accounts?.non_stocked?.general;
    return {
      incomeAccount: m?.income_account || defaults.income,
      inventoryAccount: defaults.inventory,
      costAccount: defaults.cost,
    };
  }
  const m = category?.accounting_accounts?.stocked?.[key] ?? category?.accounting_accounts?.stocked?.general;
  return {
    incomeAccount: m?.income_account || defaults.income,
    inventoryAccount: m?.inventory_account || defaults.inventory,
    costAccount: m?.cost_account || defaults.cost,
  };
}
```

### Las 3 Pestañas de `/products/settings` (Condicionales al Schema y RBAC):
1. **Pestaña 1 — Esquema del Catálogo (`crm_settings/catalog_config`)**:
   - Switches en vivo para activar/desactivar `enableOriginField` (más gestor para agregar/editar orígenes personalizados), `enableSubSeries`, `skuPolicyMode` (`prefix_origin_sub_seq` | `prefix_seq` | `manual_free`), `fiscalCodeMode` (`cabys_cr_api` | `custom_tax_code` | `disabled`), `enableAccountingAccounts`, `enableCostAndMargins`, `enableBarcode` y `enableWebCatalogSync`.
2. **Pestaña 2 — Cuentas Contables (`accountingAccounts` — visible si `enableAccountingAccounts === true`)**:
   - Alta manual con tipo (`Ingreso`, `Inventario`, `Costo de Venta`, `Gasto`), código opcional y nombre; filtro por tipo; edición inline con ventana de confirmación **`Valor Anterior → Valor Nuevo`**; exportación `.xlsx` e **Importador Excel en 3 pasos** (`Subir → Mapear columnas Tipo y Nombre → Preview deduplicando duplicados`).
3. **Pestaña 3 — Asignación por Categoría (`ProductCategory.accounting_accounts`)**:
   - Acordeón por cada categoría adaptativo según `schema.enableOriginField`:
     - Si la categoría es **`service`**: pide solo Cuenta de Ingreso.
     - Si `enableOriginField === true`: despliega bloques separados para cada origen activo en `schema.origins` (*Inventariable* pide Ingreso + Inventario + Costo; *No Inventariable* pide Ingreso).
     - Si `enableOriginField === false`: muestra un único bloque simplificado `General`.
   - Elegir `"Por defecto"` limpia la regla especial y usa `DefaultAccountingAccounts`.

---

## 4. Motor Completo de Plantillas Excel (`.xlsx`), Actualización en 3 Pasos y Hoja Interactiva Masiva (`product-excel.ts`)

> [!IMPORTANT]
> **PARIDAD FUNCIONAL 100% SIN DEPENDENCIA DE ALEGRA**:
> Toda la potencia de exportación en plantillas `.xlsx`, importación con mapeo inteligente de columnas, previsualización de diferencias y tabla de edición masiva funciona **nativamente contra Firestore (`catalogProducts` + `web_catalog`)** usando `xlsx` (SheetJS). Si el cliente activa un ERP externo (`Modo B2`), el `ErpCatalogAdapter` habilita adicionalmente las plantillas específicas de ese ERP.

### 4.1 Tres Plantillas Oficiales de Exportación (`.xlsx` — `src/lib/product-excel.ts`)

1. **Plantilla Universal Maestra + Web Dinámica (`buildUniversalCatalogHeaders(schema)`)**:
   - Genera únicamente las columnas activas en `CatalogSchemaConfig` listas para re-importar sin pérdida:
     - Núcleo fijo: `SKU | Nombre | Categoría | Tipo (Inventariable/No-Inv/Servicio) | Unidad | Impuesto % | Precio Base (Sin Imp.) | Precio Total (Imp. Inc.) | Stock Actual | Activo POS (Sí/No) | Descripción`
     - Columnas condicionales: `Origen` *(si `enableOriginField`)*, `Sub-serie` *(si `enableSubSeries`)*, `{fiscalCodeLabel}` *(si `fiscalCodeMode !== 'disabled'`)*, `Código Barras` *(si `enableBarcode`)*, `Costo Unitario` *(si `enableCostAndMargins`)*, `Visible en Web (Sí/No) | Oferta % | URL Imagen Principal` *(si `enableWebCatalogSync`)*.
2. **Cola Inteligente de Exportación (`ExportPanel` — Alta vs. Actualización)**:
   - Divide automáticamente los productos en cola entre:
     - **Productos Existentes (Actualización Masiva)** → Descarga en 1 clic con precios, impuestos y visibilidad actual.
     - **Productos Nuevos (Creación Inicial)** → Agrupados por `stocked` vs `non_stocked`/`service`, permitiendo editar inline el **Stock Inicial** de cada ítem inventariable justo antes de generar el archivo `.xlsx`.
3. **Adaptador Opcional de Plantilla ERP (`ErpExcelProfile` — Ej. Perfil Alegra 27 Columnas cuando `Modo B2 = Alegra`)**:
   - Cuando el cliente opera con Alegra, expone el perfil exacto de creación (`19 cols` inventariable / `14 cols` servicio en hoja `'Productos'`) y actualización (`27 cols` en hoja `'Worksheet'` con números formateados a 5 decimales con coma `formatDecimal5Comma(n)`, ej. `"5221,24000"`).

### 4.2 Asistente de Actualización Masiva por Excel en 3 Pasos (`BulkUpdateDialog`)

1. **Paso 1 — Carga y Autodetección (`BulkStepUpload.tsx`)**:
   - Drag-and-drop para `.xlsx`, `.xls` o `.csv`. Lee encabezados con `XLSX.read` y autodetecta nombres equivalentes (`SKU`/`Referencia`/`Código`, `Precio total`/`PVP`, `Precio base`, `Costo`, `Stock`/`Cantidad`, `CABYS`, `Visible en tienda`/`Visible en Web`, `Estado`).
2. **Paso 2 — Mapeo Flexible con Presets y Badges de Impacto (`BulkStepMapping.tsx`)**:
   - Exige únicamente **`1` columna llave obligatoria (`skuCol`)** y permite mapear cualquiera de los campos destino habilitados (`externalErpIdCol`, `barcodeCol`, `nameCol`, `descriptionCol`, `priceTotalCol`, `priceBaseCol`, `priceCostCol`, `taxPercentageCol`, `taxCodeCol`, `quantityCol`, `activeCol`, `activeWebCol`).
   - Incluye **Presets en 1 clic** (`Plantilla Universal`, `Solo Lista de Precios`, `Solo Inventario y Costos`, `Perfil ERP 27 cols`, `Limpiar`) y muestra en cada fila un badge indicando si el cambio impacta **`Catálogo + Web`** o **`Solo Catálogo Interno`**.
3. **Paso 3 — Parser Tolerante, Diff Preview y Creación de Faltantes (`BulkStepPreview.tsx`)**:
   - **Normalizador Numérico Internacional**: Soporta tanto formato anglosajón (`12,500.50`) como europeo/latinoamericano (`5.221,24000`) y símbolos (`₡`, `$`).
   - **Derivación Bidireccional de Impuestos**: Recalcula `price_base ↔ price_total` usando `tax_percentage`; marca `hasNameConflict` cuando el nombre del Excel difiere del registrado.
   - **4 Pestañas KPI de Auditoría Pre-Ejecución**: `Por Actualizar (N)` (diff `antes → después`), `No Encontrados (N)`, `Sin Cambios (N)` y `Sin SKU (N)`.
   - **Acción 1-Clic para SKUs Faltantes**: Permite exportar no encontrados o **crear los `N` productos nuevos directamente** infiriendo categoría, origen (si `enableOriginField === true`) y serie desde el prefijo del SKU.
   - **Ejecución Atómica por Lotes**: Aplica `writeBatch` particionados de `100` productos (`200` ops sumando `catalogProducts` + `web_catalog` tras `removeUndefined()`).

### 4.3 Hoja de Cálculo Interactiva de Edición Masiva (`/products/mass-update`)

1. **Panel Izquierdo (`MassUpdateSelectorPanel`)**: Filtra por Categoría, Tipo, Origen *(condicional)*, Sincronización ERP o texto y acumula lotes en mesa de trabajo (`+ Agregar filtrados`).
2. **Tabla Derecha Tipo Spreadsheet (`MassUpdateTable`)**:
   - Columnas fijas (`sticky left`) `Checkbox`, `SKU`, `Nombre`, más píldoras dinámicas adaptadas a `CatalogSchemaConfig` (`Categoría`, `Precio Total`, `Precio Base`, `Costo`, `Impuesto %`, `Stock`, `{fiscalCodeLabel}`, `Código Barras`, `Unidad`, `Activo POS`, `Visible Web`, `Descripción`). En ítems `non_stocked`/`service` las celdas de `Stock` y `Costo` muestran `No aplica`.
   - Toda celda editada se resalta mostrando `Antes → Ahora` con botón revertir por fila (`↺`) y recálculo en vivo `Precio Total ↔ Precio Base`.
3. **Barra Superior de Fórmulas por Lote (`MassUpdateBatchBar`)**:
   - **5 operadores matemáticos** para columnas numéricas (`=`, `+%`, `-%`, `+`, `-`, con piso `>= 0` en resta) y asignación directa para campos categóricos/switches (`Categoría`, `{fiscalCodeLabel}` con `<CabysAutocomplete />`, `Unidad`, `Impuesto %`, `Activo POS`, `Visible Web`).
   - **3 modos de guardado**: `Solo Descargar Excel` | `Guardar en Catálogo + Descargar Excel` | `Guardar en Catálogo (+ Sync ERP si está activo)`.

---

## 5. Seguridad `firestore.rules`, Índices `firestore.indexes.json` y Manejo de `failed-precondition`

### 5.1 Reglas de Seguridad `firestore.rules` (O(1) Pase Único — Sin Correos/Roles Quemados)

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
  allow write: if isCrmAdmin() && (isModuleLicensed('catalog_master') || isModuleLicensed('pos'));
}

// Plan de Cuentas Contables: lectura por admins de catálogo/caja, escritura restringida a Admin de Caja o Admin Global
match /accountingAccounts/{accountId} {
  allow read: if isCrmAdmin() || isAnyModuleAdmin(['inventory', 'caja']);
  allow write: if isGlobalAdmin() || isAnyModuleAdmin(['caja']);
}

// Configuración de esquema del catálogo y favoritos CABYS (sin secretos)
match /crm_settings/catalog_config {
  allow read: if hasCrmAccess();
  allow write: if isCrmAdmin() && isModuleLicensed('catalog_master');
}

match /crm_settings/cabys_favorites {
  allow read: if hasCrmAccess();
  allow write: if false; // Solo Admin SDK desde /api/crm/catalog/cabys
}

// Proyección Pública Segura (sin costos ni datos sensibles)
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

### 5.2 Índices Compuestos Obligatorios (`firestore.indexes.json`)
Toda consulta filtrada con `where` + `orderBy` en el catálogo y cuentas contables DEBE contar con estas definiciones exactas en `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "catalogProducts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "catalogProducts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "accountingAccounts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 5.3 Captura Obligatoria de `failed-precondition` en Consultas del Catálogo
En todo servicio cliente o servidor del catálogo (`getProductsByCategory`, `getAllActiveProducts`, `getAccountingAccounts`), envuelve la lectura en un bloque que extraiga y loguee la URL de creación directa del índice faltante:

```typescript
export function logMissingIndexIfPrecondition(scope: string, err: unknown): void {
  const e = err as { code?: string | number; message?: string };
  if (e?.code === 'failed-precondition' || e?.code === 9) {
    const createUrl = e?.message?.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
    console.error(`[ÍNDICE FALTANTE · ${scope}] Créalo en 1 clic:`, createUrl || e?.message);
  }
}
```
