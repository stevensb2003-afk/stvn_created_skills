# Estrategia de Deploy y Recetas por Framework

## 1. Por qué la Bóveda Local + Extracción Selectiva es ideal para Producción y Deploy

### El antipatrón que debes evitar
Nunca hagas que un proyecto lea archivos de iconos directamente desde una ruta local fuera del repositorio (como `~/.local/share/pictogrammers/`) durante `npm run build` o en tiempo de ejecución. Si haces eso:
- Fallará con `ENOENT` en **GitHub Actions, Vercel, Firebase App Hosting, Cloud Run o Netlify**.
- Fallará en la computadora de cualquier colega o cliente que clone el proyecto sin tener la bóveda instalada.

### La arquitectura correcta: *Bóveda Local Maestra + Vendoring Selectivo*
1. **En tu computadora (fuera de Git):** Vive una única copia maestra de toda la galería (`pictovault.json`, ~4.3 MB con +8,300 iconos).
2. **En cada proyecto (dentro de Git):** Ejecutas `add` para extraer **únicamente los iconos que ese proyecto usa** hacia un archivo tipado (`src/components/ui/mdi-icons.tsx`) o carpeta `public/icons/`.
3. **Al hacer `git push` y Deploy:**
   - **`0 MB` extra en `node_modules`:** `package.json` no depende de `@mdi/js`, `@mdi/svg` ni `@mdi/font`.
   - **CI/CD ultra rápido:** `npm ci` no descarga paquetes pesados ni miles de archivos `.svg`.
   - **Desarrollo local fluido:** TypeScript y Vite/Turbopack no tienen que indexar +7,400 exports por cada proyecto.
   - **Peso mínimo en el bundle final:** Un proyecto con 30 iconos extrae ~7 KB sin comprimir (~2.2 KB gzip), con **0 peticiones HTTP extra**, **Zero-FOUC** (no parpadean iconos al cargar fuentes) y herencia nativa de `currentColor`.
   - **100% autónomo:** El código en Git compila en cualquier servidor o máquina sin necesitar esta skill.

---

## 2. Matriz de Decisión para Proyectos y Deploy

| Escenario | Estrategia Recomendada | Cuándo Elegirla |
| :--- | :--- | :--- |
| **95% de aplicaciones** (CRMs, Dashboards, Landing Pages, Apps Next.js/React, Astro, Vue, Flutter, Emails) | **Extracción Selectiva (`add`)** — *Cero dependencias npm* | Sabes qué iconos usa tu interfaz. Máximo rendimiento y control total. |
| **Selector dinámico para usuario final** (ej. un SaaS donde el cliente elige libremente entre cientos de iconos desde la BD) | **Subconjunto curado (~100-150 iconos en JSON local)** o **Iconify API bajo demanda** (`https://api.iconify.design/mdi/<name>.svg`) | No conoces en *build time* cuál de los 7,447 iconos elegirá el usuario; incluir todos en el bundle principal inflaría el JS inicial. |
| **Equipos que exigen importar paquetes npm completos** | `@iconify-json/mdi` o `@mdi/js` instalado con **`pnpm`** + `optimizePackageImports` | `pnpm` guarda una sola copia en el disco del desarrollador (via *hard links*) y el bundler aplica *tree-shaking* en producción. |

---

## 3. Licencia Comercial y Cuidado con Iconos de Marcas

- **Licencia oficial:** Los 3 packs (`mdi`, `mdi-light`, `memory`) usan **Pictogrammers Free License**:
  - **Iconos y fuentes:** **Apache 2.0**
  - **Código auxiliar:** **MIT**
  - 100% compatible con proyectos comerciales, SaaS cerrados, software de clientes y código abierto.
- **Iconos `deprecated: true` y Logos de Marcas (`Brand / Logo`):**
  - En MDI v7 hay ~259 iconos marcados como `deprecated` (en su mayoría logos de marcas registradas de terceros como `android`, `angular`, `facebook`, etc., que Pictogrammers va retirando de la librería principal).
  - La CLI advierte cuando buscas o agregas un icono deprecado y `inspect` / `audit` sugieren reemplazos activos. Para logos oficiales de marcas (WhatsApp, Google, Meta, etc.), es mejor usar el SVG oficial de marca o [Simple Icons](https://simpleicons.org/) en lugar de depender de iconos deprecados de MDI.

---

## 4. Recetas por Framework (Listas para Copiar)

### A. React / Next.js / Vite + Tailwind CSS (`--format react-map`)

Extraer iconos:
```bash
node <SKILL_DIR>/scripts/mdi.mjs add \
  rocket-launch-outline shield-check-outline invoice-text-outline memory:account \
  --format react-map \
  --out src/components/ui/mdi-icons.tsx
```

Uso en componentes (respeta colores de Tailwind y temas white-label con `var(--primary)`):
```tsx
import { MdiIcon } from '@/components/ui/mdi-icons';

export function HeaderAction() {
  return (
    <button className="inline-flex items-center gap-2 text-[var(--primary)]">
      <MdiIcon name="rocket-launch-outline" size={20} className="shrink-0" />
      <span>Lanzar campaña</span>
    </button>
  );
}

// Icono informativo (no decorativo): agrega `title` para lectores de pantalla
<MdiIcon name="shield-check-outline" size={18} title="Conexión verificada" />
```

> El componente `<MdiIcon />` lee el `viewBox` por cada icono automáticamente (`0 0 24 24` para `mdi`/`mdi-light` y `0 0 22 22` para `memory`).

---

### B. HTML / Astro / Sitios Estáticos con SVG Sprite (`--format sprite`)

Ideal si renderizas cientos de filas en una tabla SSR sin duplicar `<path>` en el HTML:

```bash
node <SKILL_DIR>/scripts/mdi.mjs add \
  account-outline cash-register check-circle-outline \
  --format sprite \
  --out public/icons/mdi-sprite.svg
```

Uso en HTML o Astro:
```html
<svg class="w-5 h-5 text-emerald-600" aria-hidden="true">
  <use href="/icons/mdi-sprite.svg#icon-check-circle-outline"></use>
</svg>
```
*(Si el icono pertenece a otro pack, ej. `memory:account`, su ID en el sprite es `#icon-memory--account` para evitar `:` en selectores CSS y nombres de archivo Windows).*

---

### C. SVGs Individuales (`--format svg`)

Útil para emails, OG images, favicons, videos programáticos (HyperFrames / Remotion) o diseño:
```bash
node <SKILL_DIR>/scripts/mdi.mjs add \
  invoice-text-outline truck-delivery-outline \
  --format svg \
  --out public/icons
```
Nota de portabilidad: Los packs con prefijo (`memory:account`) se guardan como `memory--account.svg` para ser 100% válidos en Windows (que prohíbe `:` en rutas).

---

### D. Vue 3 (`--format vue`)

```bash
node <SKILL_DIR>/scripts/mdi.mjs add \
  view-dashboard-outline account-group-outline \
  --format vue \
  --out src/components/ui/mdi-icons.ts
```

Componente ligero en Vue (`AppIcon.vue`):
```vue
<script setup lang="ts">
import { computed } from 'vue';
import { MDI_ICONS, getMdiIconPaths, type MdiIconName } from './mdi-icons';

const props = withDefaults(defineProps<{ name: MdiIconName; size?: number | string }>(), {
  size: 24,
});
const entry = computed(() => MDI_ICONS[props.name]);
const paths = computed(() => getMdiIconPaths(props.name));
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="entry.vb"
    :width="size"
    :height="size"
    fill="currentColor"
    aria-hidden="true"
  >
    <path v-for="(d, idx) in paths" :key="idx" :d="d" />
  </svg>
</template>
```

---

### E. Flutter (`--format flutter`)

Evita empaquetar fuentes `.ttf` de ~600 KB cuando solo usas 15–40 iconos:

```bash
node <SKILL_DIR>/scripts/mdi.mjs add \
  cash-register invoice-text-outline shield-check-outline \
  --format flutter \
  --out lib/core/icons/mdi_icons.dart
```

Uso con `flutter_svg`:
```dart
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mi_app/core/icons/mdi_icons.dart';

SvgPicture.string(
  PictogrammersIcons.invoiceTextOutline,
  width: 24,
  height: 24,
  colorFilter: ColorFilter.mode(
    Theme.of(context).colorScheme.primary,
    BlendMode.srcIn,
  ),
)
```

---

## 5. Checklist Pre-Deploy (Auditoría Rápida)

Antes de hacer merge a `main` o desplegar:
```bash
node <SKILL_DIR>/scripts/mdi.mjs audit \
  --target src/components/ui/mdi-icons.tsx \
  --src src \
  --prune
```
1. Detecta iconos marcados como `deprecated` en Pictogrammers y sugiere reemplazos.
2. Verifica si los trazos SVG cambiaron respecto a tu bóveda local (`--refresh-paths`).
3. Poda (`--prune`) cualquier icono que agregaste durante pruebas y ya no se referencia en `src/`.
