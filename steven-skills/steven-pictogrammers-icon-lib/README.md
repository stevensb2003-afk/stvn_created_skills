# `steven-pictogrammers-icon-lib`

Gestor local multiplataforma y extractor selectivo sin dependencias npm para la galería oficial de **Pictogrammers** (`@mdi/svg`, `@mdi/light-svg` y `@pictogrammers/memory-svg`).

---

## 🎯 Cómo Funciona

1. Instala toda la galería una sola vez en una bóveda local compacta fuera de los repositorios (`~/.local/share/pictogrammers/` en macOS/Linux o `%LOCALAPPDATA%\pictogrammers\` en Windows) en ~4 segundos y ~4.3 MB, con validación `SHA-512` desde npm.
2. Busca iconos en **español o inglés** filtrando por estilo (`outline` / `filled`) y evitando iconos deprecados.
3. Extrae e inyecta hacia cada repositorio **únicamente los iconos exactos** que usa la UI (`src/components/ui/mdi-icons.tsx`, SVG o Sprite), logrando `0 MB` extra en `node_modules`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Auto-bootstrap, fuentes oficiales, flujo operativo `status` / `setup` / `search` / `inspect` / `add` / `audit` y reglas visuales.
* [`scripts/mdi.mjs`](./scripts/mdi.mjs) — CLI Node.js 18+ sin dependencias externas.
* [`references/deploy-and-framework-recipes.md`](./references/deploy-and-framework-recipes.md) — Recetas para React/Next, Tailwind, Astro/Sprite, Vue y Flutter.
* [`references/sharing-and-multi-os-guide.md`](./references/sharing-and-multi-os-guide.md) — Guía de portabilidad entre macOS, Linux y Windows.

## 🚀 Instalación y Uso Rápido

```bash
./install.sh --skill steven-pictogrammers-icon-lib

node ~/.gemini/config/skills/steven-pictogrammers-icon-lib/scripts/mdi.mjs status
node ~/.gemini/config/skills/steven-pictogrammers-icon-lib/scripts/mdi.mjs setup
node ~/.gemini/config/skills/steven-pictogrammers-icon-lib/scripts/mdi.mjs search "factura|cajero|seguridad" --style outline
```

**Triggers:** `/steven-pictogrammers-icon-lib`, `/pictogrammers`, `/mdi`, `/iconos-mdi`.
