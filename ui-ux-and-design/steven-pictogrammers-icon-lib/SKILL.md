---
name: steven-pictogrammers-icon-lib
description: >
  Gestor local multiplataforma y extractor selectivo sin dependencias npm para la galería oficial de Pictogrammers (MDI estándar '@mdi/svg', MDI Light '@mdi/light-svg' y Memory Icons '@pictogrammers/memory-svg').
  Instala toda la librería una sola vez en una bóveda local compacta fuera de los repositorios (Mac/Linux/Windows), busca iconos en español o inglés por estilo (outline/filled), inspecciona variantes y deprecaciones, e inyecta únicamente los iconos exactos que necesita cada proyecto (React/Next.js, SVG, Sprite, Vue, Flutter) para lograr builds y deploys ligeros con 0 MB extra en node_modules.
  Actívalo cuando el usuario escriba "/steven-pictogrammers-icon-lib", "/pictogrammers", "/mdi", "/iconos-mdi", pida buscar o agregar iconos de Pictogrammers / Material Design Icons, instalar o actualizar la librería local de iconos, o auditar iconos deprecados/sin uso antes de hacer deploy.
---

# Pictogrammers Local Icon Vault & Selective Extractor (`steven-pictogrammers-icon-lib`)

Esta skill reemplaza tener que instalar paquetes pesados (`@mdi/js`, `@mdi/svg` con +7,400 archivos) en cada proyecto. Mantiene **una sola bóveda compacta en tu computadora** (~4.3 MB, 1 archivo índice con +8,300 iconos de las 3 colecciones Pictogrammers) y **extrae hacia cada repositorio únicamente los iconos exactos que esa interfaz usa**.

> **Portabilidad de Rutas (`<SKILL_DIR>`):** Resuelve `<SKILL_DIR>` usando la carpeta padre real desde donde leíste este `SKILL.md` (por ejemplo `~/.gemini/config/skills/steven-pictogrammers-icon-lib` o `.agents/skills/steven-pictogrammers-icon-lib`). Nunca asumas un nombre de usuario fijo. Requiere **Node.js 18+** y cero `npm install`.

---

## 0. Auto-Bootstrap y Ubicación Recomendada en Disco

Al activar esta skill en cualquier computadora nueva o proyecto, verifica primero el estado local:

```bash
node "<SKILL_DIR>/scripts/mdi.mjs" status
```

- Si devuelve `NOT INSTALLED`, ejecuta automáticamente la instalación inicial (descarga los 3 packs oficiales, verifica `SHA-512` e indexa todo en ~4 segundos):
  ```bash
  node "<SKILL_DIR>/scripts/mdi.mjs" setup
  ```
- Si el usuario también necesita SVGs sueltos para Figma/Canva o la fuente tipográfica `.ttf`/`.woff2`:
  ```bash
  node "<SKILL_DIR>/scripts/mdi.mjs" setup --raw-svgs --extract-font
  ```

### Dónde se instala por defecto (y por qué)
No guardes la galería maestra dentro de proyectos Git ni dentro de `Documents` o `Desktop` (para evitar sincronización innecesaria de **iCloud Drive** o **OneDrive**). La CLI resuelve automáticamente:
- **macOS / Linux:** `~/.local/share/pictogrammers/` (o `$XDG_DATA_HOME/pictogrammers`)
- **Windows:** `%LOCALAPPDATA%\pictogrammers\` (ej. `C:\Users\<usuario>\AppData\Local\pictogrammers\`)
- **Ruta personalizada:** pasa `--dir <ruta>` en `setup` (se guarda en `~/.pictogrammers-config.json`) o define `PICTOGRAMMERS_VAULT_DIR`.

---

## 1. Fuentes Oficiales de Actualización y Control de Deprecaciones

Para saber **a dónde apuntar cuando Pictogrammers publica nuevos iconos, ajusta trazos o depreca iconos viejos**, la CLI consulta directamente el registro oficial de npm (`Accept: application/vnd.npm.install-v1+json`) con validación `SHA-512`:

| Colección (`--pack`) | Paquete npm Oficial | Endpoint Metadata | Repo GitHub & Catálogo Web | `viewBox` |
| :--- | :--- | :--- | :--- | :--- |
| **`mdi`** *(default, ~7,447 iconos)* | `@mdi/svg` | `https://registry.npmjs.org/@mdi/svg` | `Templarian/MaterialDesign` · `pictogrammers.com/library/mdi/` | `0 0 24 24` |
| **`mdi-light`** *(trazo 1px, ~263 iconos)* | `@mdi/light-svg` | `https://registry.npmjs.org/@mdi/light-svg` | `Templarian/MaterialDesignLight` · `pictogrammers.com/library/mdil/` | `0 0 24 24` |
| **`memory`** *(pixel-art, ~652 iconos)* | `@pictogrammers/memory-svg` | `https://registry.npmjs.org/@pictogrammers/memory-svg` | `Pictogrammers/Memory` · `pictogrammers.com/library/memory/` | **`0 0 22 22`** |
| **Fuente Webfont/TTF** *(opcional)* | `@mdi/font` | `https://registry.npmjs.org/@mdi/font` | `Templarian/MaterialDesign-Webfont` | N/A |

### Cómo actualizar la bóveda local y detectar iconos deprecados
1. **Revisar si hay versiones nuevas sin modificar archivos:**
   ```bash
   node "<SKILL_DIR>/scripts/mdi.mjs" update --check-only
   ```
2. **Actualizar la bóveda y generar diff de cambios (`last-update-diff.json`):**
   ```bash
   node "<SKILL_DIR>/scripts/mdi.mjs" update
   ```
   Reporta exactamente cuántos iconos fueron agregados (`added`), pasados a deprecados (`newlyDeprecated`), modificados en su trazo (`pathModified`) o eliminados (`removed`).
3. **Auditar y actualizar un proyecto tras un `update`:**
   ```bash
   node "<SKILL_DIR>/scripts/mdi.mjs" audit --target src/components/ui/mdi-icons.tsx --src src --refresh-paths
   ```
   - Alerta si algún icono del proyecto quedó `deprecated: true` y sugiere alternativas activas basadas en sus `aliases` y `tags`.
   - Si agregas `--refresh-paths`, actualiza los `<path d="...">` modificados sin perder el resto del archivo.

---

## 2. Estrategia de Deploy (Qué Hacer al Subir a Producción)

- **Regla de Oro:** Los proyectos **NUNCA** deben importar desde `~/.local/share/pictogrammers/` en tiempo de compilación (`build`) o ejecución; eso fallaría en Vercel, GitHub Actions, Firebase App Hosting o Cloud Run.
- **Patrón Recomendado (95% de apps):** Usa `add` para extraer hacia el código del proyecto **solo los iconos que ese proyecto utiliza** (ej. `src/components/ui/mdi-icons.tsx` o `public/icons/`). Resultado: `0 MB` en `node_modules`, ~0.25 KB por icono, `Zero-FOUC`, `currentColor` nativo y repositorio 100% autónomo al desplegar.
- **Excepción (Selector de iconos abierto al usuario final en un SaaS):** Exporta un subconjunto curado (~100–150 iconos) o carga bajo demanda desde Iconify API (`https://api.iconify.design/mdi/<name>.svg`).
- Consulta recetas completas por framework (React/Next, Tailwind, Astro/HTML Sprite, Vue, Flutter) y detalles de licencia (`Apache-2.0` / `MIT`) en [`references/deploy-and-framework-recipes.md`](./references/deploy-and-framework-recipes.md).

---

## 3. Flujo Operativo Paso a Paso (Cómo Buscar y Extraer Solo Lo Necesario)

### Paso 1: Buscar conceptos en lote (Español o Inglés)
La CLI incluye traductor automático Español → Inglés de conceptos UI/negocio y filtro de estilo:
```bash
node "<SKILL_DIR>/scripts/mdi.mjs" search "factura|cajero|seguridad|envio" --style outline --exclude-deprecated --limit 20
```
- Flags útiles:
  - `--pack mdi|mdi-light|memory|all` (por defecto `mdi`).
  - `--style outline|filled|all` (**regla visual:** elige un estilo dominante por proyecto y mantente consistente; no mezcles iconos sólidos y de línea arbitrariamente).
  - `--tag "<categoría>"` (ej. `"Finance"`, `"Account / User"`).

### Paso 2: Inspeccionar variantes antes de elegir (Opcional)
Para confirmar variantes hermanas (`-outline`, `-plus`, `-check`, `-off`), tamaño exacto o validar que no esté deprecado:
```bash
node "<SKILL_DIR>/scripts/mdi.mjs" inspect invoice-text-outline
```
*(Si inspeccionas un icono con nombre prefijado de otro pack, usa `memory:account` o `mdi-light:account`)*

### Paso 3: Extraer al proyecto de forma incremental (`add`)
Cada ejecución de `add` **preserva** los iconos ya existentes en el archivo destino y solo agrega o actualiza los nuevos:

```bash
# React / Next.js / Vite (crea o actualiza src/components/ui/mdi-icons.tsx con <MdiIcon />)
node "<SKILL_DIR>/scripts/mdi.mjs" add \
  invoice-text-outline cash-register shield-check-outline \
  --format react-map \
  --out src/components/ui/mdi-icons.tsx

# Agregar iconos de otra colección (respetando viewBox 0 0 22 22 de memory)
node "<SKILL_DIR>/scripts/mdi.mjs" add memory:account mdi-light:home \
  --format react-map \
  --out src/components/ui/mdi-icons.tsx

# Otras salidas soportadas:
# --format svg     --out public/icons
# --format sprite  --out public/icons/mdi-sprite.svg
# --format vue     --out src/components/ui/mdi-icons.ts
# --format flutter --out lib/core/icons/mdi_icons.dart
```

### Paso 4: Quitar iconos o podar huérfanos antes de Deploy
```bash
# Quitar iconos puntuales
node "<SKILL_DIR>/scripts/mdi.mjs" remove cash-register --target src/components/ui/mdi-icons.tsx

# Auditar deprecados, rutas desactualizadas y podar iconos sin uso en src/
node "<SKILL_DIR>/scripts/mdi.mjs" audit \
  --target src/components/ui/mdi-icons.tsx \
  --src src \
  --refresh-paths \
  --prune
```

---

## 4. Reglas de Calidad Visual y Accesibilidad

1. **Consistencia de trazo:** Si el proyecto usa estilo `outline`, busca con `--style outline` y reserva el estilo sólido solo para estados activos (ej. estrella de favorito o pestaña seleccionada).
2. **Respeta el `viewBox` nativo:** `mdi` y `mdi-light` usan `0 0 24 24`, pero `memory` usa `0 0 22 22`. Usa siempre el componente o SVG generado por `add` para no recortar iconos de `memory`.
3. **Color dinámico (`currentColor`):** Todo SVG generado usa `fill="currentColor"` para heredar colores de texto, Tailwind o variables CSS (`var(--primary)`).
4. **Accesibilidad:** Iconos decorativos junto a texto llevan `aria-hidden="true"`; iconos interactivos sin texto (ej. botón cerrar o editar) deben recibir `title="..."` o `aria-label`.
5. **Cero iconos deprecados nuevos:** Nunca extraigas iconos marcados `deprecated: true` en UI nueva (muchos son logos de marcas en vías de retiro); si necesitas logos de marcas externas, usa SVGs oficiales de la marca o Simple Icons.

---

## 5. Cómo Compartir Esta Skill con Otros Usuarios o Máquinas

Esta carpeta de skill es ultraligera (< 80 KB) porque **no incluye los datos de la galería dentro**. Para compartirla (en `.zip` o Git) y que cualquier compañero o cliente la instale en Mac, Linux o Windows con auto-setup automático, sigue [`references/sharing-and-multi-os-guide.md`](./references/sharing-and-multi-os-guide.md).
