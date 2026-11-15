# Guía Multiplataforma, Actualizaciones Upstream y Distribución de la Skill

## 1. Dónde Instalar la Bóveda Local (y Por Qué)

La librería local de iconos **NO** debe guardarse dentro de tus repositorios Git ni dentro de carpetas sincronizadas con la nube (`~/Documents` o `~/Desktop`), ya que **iCloud Drive (macOS)** y **OneDrive (Windows)** intentan subir cambios innecesariamente.

Además, `scripts/mdi.mjs` compila las 3 colecciones en **1 solo archivo compacto (`pictovault.json`, ~4.3 MB)** en lugar de dejar ~8,400 archivos `.svg` sueltos, evitando sobrecarga de Spotlight, Windows Defender, Time Machine y fragmentación por bloques de 4 KB en disco.

### Rutas Estándar Resueltas Automáticamente por OS

| Sistema Operativo | Ruta por Defecto | Variable / Base Estándar |
| :--- | :--- | :--- |
| **macOS** | `~/.local/share/pictogrammers/` | `$XDG_DATA_HOME/pictogrammers` o `~/.local/share/pictogrammers` |
| **Linux** | `~/.local/share/pictogrammers/` | `$XDG_DATA_HOME/pictogrammers` o `~/.local/share/pictogrammers` |
| **Windows** | `%LOCALAPPDATA%\pictogrammers\` | `C:\Users\<usuario>\AppData\Local\pictogrammers\` |

### Orden de Prioridad para Resolver la Ruta
1. Flag explícito `--dir <ruta>` (si se usa junto con `setup`, guarda esa ruta en `~/.pictogrammers-config.json` para futuros comandos).
2. Variable de entorno `PICTOGRAMMERS_VAULT_DIR`.
3. Archivo de configuración del usuario `~/.pictogrammers-config.json` (`{ "vaultDir": "..." }`).
4. Ruta nativa por defecto del sistema operativo mostrada arriba.

---

## 2. Fuentes Oficiales Upstream: A Dónde Apunta para Instalar y Actualizar

Cuando Pictogrammers publica nuevos iconos, ajusta trazos SVG o depreca iconos viejos, **todo se consulta automáticamente contra el registro oficial de npm** usando metadatos compactos (`Accept: application/vnd.npm.install-v1+json`) y verificación criptográfica **SHA-512** (`dist.integrity`) antes de indexar:

| Colección (`--pack`) | Paquete npm Oficial (Fuente de Instalación / Update) | Endpoint Metadata | Repositorio GitHub Oficial | Catálogo Visual Web |
| :--- | :--- | :--- | :--- | :--- |
| **`mdi`** *(Principal, ~7,447 iconos, `24×24`)* | `@mdi/svg` | `https://registry.npmjs.org/@mdi/svg` | `Templarian/MaterialDesign` / `MaterialDesign-SVG` | `https://pictogrammers.com/library/mdi/` |
| **`mdi-light`** *(Trazo fino 1px, ~263 iconos, `24×24`)* | `@mdi/light-svg` | `https://registry.npmjs.org/@mdi/light-svg` | `Templarian/MaterialDesignLight` | `https://pictogrammers.com/library/mdil/` |
| **`memory`** *(Pixel-art retro, ~652 iconos, **`22×22`**)* | `@pictogrammers/memory-svg` | `https://registry.npmjs.org/@pictogrammers/memory-svg` | `Pictogrammers/Memory` | `https://pictogrammers.com/library/memory/` |
| **Fuente Desktop / Webfont** *(opcional `--extract-font`)* | `@mdi/font` | `https://registry.npmjs.org/@mdi/font` | `Templarian/MaterialDesign-Webfont` | `https://pictogrammers.com/docs/library/mdi/getting-started/webfont/` |

> **Nota técnica importante sobre `memory` y `mdi-light`:**
> - `@mdi/light-svg` incluye encabezados `<?xml ...?><!DOCTYPE svg ...>` en sus archivos fuente; el motor los limpia automáticamente.
> - `@pictogrammers/memory-svg` usa `viewBox="0 0 22 22"` (no `24x24`). La bóveda preserva el `viewBox` exacto por cada icono.

---

## 3. Flujo para Actualizar la Bóveda y Detectar Deprecaciones

1. **Verificar si existen versiones nuevas sin modificar nada:**
   ```bash
   node <SKILL_DIR>/scripts/mdi.mjs update --check-only
   ```
2. **Descargar nuevas versiones y generar reporte de diferencias:**
   ```bash
   node <SKILL_DIR>/scripts/mdi.mjs update
   ```
   Al actualizar, se guarda `<VAULT_DIR>/last-update-diff.json` con 4 listas exactas por cada pack:
   - `added`: iconos nuevos recién publicados.
   - `newlyDeprecated`: iconos que pasaron a `deprecated: true` en esta versión.
   - `removed`: iconos retirados por Pictogrammers.
   - `pathModified`: iconos cuyos trazos SVG fueron refinados.
3. **Propagar cambios o detectar deprecados dentro de un proyecto existente:**
   ```bash
   node <SKILL_DIR>/scripts/mdi.mjs audit \
     --target src/components/ui/mdi-icons.tsx \
     --src src \
     --refresh-paths
   ```
   - Si algún icono del proyecto quedó marcado `deprecated`, la CLI imprime qué alternativas activas recomiendan sus `aliases` y `tags`.
   - Si cambiaron los trazos vectoriales, `--refresh-paths` actualiza `d` y `viewBox` sin perder los demás iconos.

---

## 4. Cómo Compartir Esta Skill con Otras Personas o Equipos

Esta carpeta de skill **no contiene** `pictovault.json` adentro: pesa menos de **80 KB** porque separa las instrucciones + script (`scripts/mdi.mjs`, 0 dependencias npm) de los datos descargados en cada computadora.

### Paso 1: Entregar la carpeta o el `.zip`
Comparte `steven-pictogrammers-icon-lib/` (o `steven-pictogrammers-icon-lib.zip`) y pide a la otra persona que la coloque en la carpeta de skills de su agente:

| Agente / Entorno | Ruta Global (para todos sus proyectos) | Ruta por Proyecto (compartida en Git) |
| :--- | :--- | :--- |
| **Antigravity** | `~/.gemini/config/skills/steven-pictogrammers-icon-lib/` | `.agents/skills/steven-pictogrammers-icon-lib/` |
| **Claude Code** | `~/.claude/skills/steven-pictogrammers-icon-lib/` | `.claude/skills/steven-pictogrammers-icon-lib/` |
| **Cursor / Otros** | `~/.agents/skills/steven-pictogrammers-icon-lib/` | `.agents/skills/steven-pictogrammers-icon-lib/` |

*(En Windows, `~` equivale a `%USERPROFILE%`, por ejemplo `C:\Users\TuNombre\.gemini\config\skills\`).*

### Paso 2: Auto-instalación en la máquina nueva
**Requisito único:** Tener **Node.js 18+** instalado (no hace falta `npm install` dentro de la skill).

Cuando el otro usuario le diga a su agente:
> *"Usa la skill `steven-pictogrammers-icon-lib` e instala la galería local"*

El agente ejecutará automáticamente:
```bash
node <SKILL_DIR>/scripts/mdi.mjs status
```
Al detectar `NOT INSTALLED`, correrá:
```bash
node <SKILL_DIR>/scripts/mdi.mjs setup
```
En ~3–5 segundos descargará `@mdi/svg`, `@mdi/light-svg` y `@pictogrammers/memory-svg`, verificará SHA-512 y dejará la bóveda lista en la ruta nativa de su computadora (Mac, Linux o Windows).

---

## 5. Extras Opcionales para Diseño Gráfico (Figma, Illustrator, Canva)

Aunque para programación basta el archivo compacto `pictovault.json`, si alguien también quiere usar los iconos manualmente fuera del código:

- **Extraer carpeta de `.svg` individuales + fuente `.ttf`/`.woff2` en la bóveda:**
  ```bash
  node <SKILL_DIR>/scripts/mdi.mjs setup --raw-svgs --extract-font --force
  ```
  Esto crea `<VAULT_DIR>/svg/<pack>/*.svg` y `<VAULT_DIR>/fonts/materialdesignicons-webfont.ttf`.
- **Instalar la fuente directamente en macOS con Homebrew (para Figma/Keynote/Photoshop):**
  ```bash
  brew install --cask font-material-design-icons-webfont
  ```
