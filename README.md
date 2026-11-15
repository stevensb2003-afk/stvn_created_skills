# 🛠️ Steven's AI Skills Hub (`stvn_created_skills`)

Repositorio maestro y respaldo en la nube de skills personalizadas para **Google Antigravity** (y agentes compatibles con `SKILL.md`), organizadas por categoría y con **una carpeta autocontenida por skill** para instalar, versionar y compartir fácilmente con colaboradores u otros equipos.

---

## 📁 Organización del Repositorio

```text
stvn_created_skills/
├── README.md                          # Portal principal e índice completo del catálogo
├── install.sh                         # Instalador automático macOS / Linux (copia o symlink)
├── install.ps1                        # Instalador automático Windows PowerShell
├── docs/                              # Guías maestras del ecosistema
│   ├── ECOSYSTEM_STEVEN_CRM_GUIDE.md  # Manual del ecosistema steven-* (17 skills + CRM v5.2)
│   └── Creative_Agency_OS_Master_Guide.md
├── steven-skills/                     # 17 skills del ecosistema /steven-* (CRM, Cloud, Hacienda, UI/UX)
├── stevtools/                         # Herramientas /stevtool-* (ej. CleanYourTV multi-televisor)
├── design-guardrails/                 # Guardrails estrictos anti-"vibecoding" UI/UX
└── creative-agency-video/             # 27 skills de producción audiovisual, Brandkit y HyperFrames
```

---

## 📦 Instalación Rápida

### Opción 1: Instalar todas las skills (macOS / Linux)

```bash
git clone https://github.com/stevensb2003-afk/stvn_created_skills.git ~/.gemini/config/stvn_created_skills
cd ~/.gemini/config/stvn_created_skills
./install.sh --all
```

*(Si prefieres que `git pull` actualice tus skills automáticamente sin volver a copiar, usa `./install.sh --all --link` para crear symlinks en `~/.gemini/config/skills/`).*

### Opción 2: Instalar solo una categoría o una skill puntual

```bash
# Listar todas las categorías y skills disponibles
./install.sh --list

# Instalar solo las 17 skills /steven-*
./install.sh --category steven-skills

# Instalar solo herramientas /stevtool-* o guardrails
./install.sh --category stevtools
./install.sh --category design-guardrails

# Instalar una única skill específica
./install.sh --skill steven-waba-dualhook-connection

# Instalar dentro de un proyecto específico (.agents/skills/)
./install.sh --category steven-skills --target /ruta/a/tu-proyecto/.agents/skills
```

### Opción 3: Windows (PowerShell)

```powershell
git clone https://github.com/stevensb2003-afk/stvn_created_skills.git "$env:USERPROFILE\.gemini\config\stvn_created_skills"
cd "$env:USERPROFILE\.gemini\config\stvn_created_skills"
.\install.ps1 -All
# O por categoría / skill:
.\install.ps1 -Category steven-skills
.\install.ps1 -Skill steven-oauth-verifier
```

### Actualizar a la última versión

```bash
cd ~/.gemini/config/stvn_created_skills
git pull
./install.sh --all   # (No necesario si instalaste con --link)
```

---

## 🗂️ Catálogo Completo por Carpeta (46 Skills)

### 1. [`steven-skills/`](./steven-skills/README.md) — Ecosistema `/steven-*` (17 Skills)

#### A. CRM Omnicanal, Firebase, RBAC, Módulos & Facturación Costa Rica
| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`steven-waba-dualhook-connection`](./steven-skills/steven-waba-dualhook-connection/) | Arquitectura maestra v5.2 de CRM Omnicanal (WhatsApp Dualhook + IG + Messenger), POS 4 modos, Hacienda CR v4.4, SaaS `/developer` y auditoría forense. | `SKILL.md`, 14 `references/`, 8 `scripts/*.mjs`, `resources/xsd/v4.4/` |
| [`steven-firebase-client-bootstrap`](./steven-skills/steven-firebase-client-bootstrap/) | Provisioner automatizado GCP/Firebase + App Check + CI/CD 2 ramas (`demo` → `main`) multi-cliente. | `SKILL.md`, `references/`, `scripts/provision-firebase-project.mjs` |
| [`steven-module-architect`](./steven-skills/steven-module-architect/) | Escáner de arquitectura y protocolo guiado para agregar módulos respetando tokens CSS, RBAC y docs IA. | `SKILL.md`, `references/`, `scripts/analyze-project-architecture.mjs` |
| [`steven-rbac-invitations-licensing`](./steven-skills/steven-rbac-invitations-licensing/) | RBAC dinámico en 3 planos (`platformDev` / Owner / `roles/{roleId}`), invitaciones SHA-256 72h, `/developer` y webhooks HMAC. | `SKILL.md`, 2 `references/` |
| [`steven-meta-omnichannel-identity`](./steven-skills/steven-meta-omnichannel-identity/) | Integración nativa Meta Graph v25.0 (Instagram Direct + Messenger), Auto-Discovery 1-Token y unificación 360°. | `SKILL.md`, 2 `references/` |
| [`steven-integracion-hacienda`](./steven-skills/steven-integracion-hacienda/) | Motor nativo de Facturación Electrónica Hacienda CR v4.4 / TRIBU-CR en Node.js (`XAdES-EPES` + validación offline XSD, cero PHP/AGPL). | `SKILL.md`, 7 `references/`, 3 `scripts/*.mjs`, `resources/xsd/v4.4/` |
| [`steven-brd-docs-bootstrap`](./steven-skills/steven-brd-docs-bootstrap/) | Generador y actualizador de bases documentales BRD multi-rol (`/*_ai_agent_docs/`) con EGM y compilador de líneas `Lxxx-Lyyy`. | `SKILL.md`, 2 `references/`, 2 `scripts/*.mjs` |

#### B. Deploy, OAuth, SEO, Seguridad & Performance Web
| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`steven-project-deploy`](./steven-skills/steven-project-deploy/) | Protocolo universal de release SemVer y Version Gate reactivo para Firebase App Hosting (SSR) y Classic Hosting. | `SKILL.md` |
| [`steven-oauth-verifier`](./steven-skills/steven-oauth-verifier/) | Dominio personalizado, Google Search Console, Google OAuth Consent, anti-fugas `firebaseapp.com` y cumplimiento CR (Ley 8968/7472). | `SKILL.md` |
| [`steven-seo-seguridad-web`](./steven-skills/steven-seo-seguridad-web/) | Auditoría y construcción universal SEO, GEO/LLMO (`/llms.txt`), cabeceras HTTP Grado `A+`, accesibilidad, PWA y GA4/Meta Pixel. | `SKILL.md` |
| [`steven-web-performance-http-compression`](./steven-skills/steven-web-performance-http-compression/) | Ingeniería de compresión HTTP (`br` / `gzip` / `zstd`), Nginx/Express/Fastify/Vite/Cloud Run, SSE y prevención `ERR_CONTENT_DECODING_FAILED`. | `SKILL.md`, `references/` |

#### C. UI/UX, Theming White-Label, Iconografía & Motion Engineering
| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`steven-whitelabel-theming-banners`](./steven-skills/steven-whitelabel-theming-banners/) | Estudio de paletas WCAG en vivo (`--primary`/`--secondary`/`--tertiary`), `<AppIcon />` Phosphor, Banner Global tipo Jira y Copiloto IA gratis. | `SKILL.md`, 2 `references/` |
| [`steven-pictogrammers-icon-lib`](./steven-skills/steven-pictogrammers-icon-lib/) | Bóveda local compartida y extractor selectivo sin peso npm para `@mdi/svg`, `@mdi/light-svg` y `@pictogrammers/memory-svg`. | `SKILL.md`, 2 `references/`, `scripts/mdi.mjs` |
| [`steven-ui-craft-anti-slop`](./steven-skills/steven-ui-craft-anti-slop/) | Auditoría y reconstrucción visual anti-AI slop: color perceptual `OKLCH`, microtipografía, radios concéntricos, sombras ambientales y superficies. | `SKILL.md`, `references/` |
| [`steven-ui-motion-and-interaction-engineering`](./steven-skills/steven-ui-motion-and-interaction-engineering/) | Ingeniería cuantitativa de movimiento UI: curvas, springs, principios Disney, leyes UX y microinteracciones optimistas de `0ms`. | `SKILL.md`, `references/` |
| [`steven-agentic-ai-interface-ux`](./steven-skills/steven-agentic-ai-interface-ux/) | Patrones UX para chats y agentes IA: empty states accionables, *Labor Illusion*, citas *origin-aware*, streaming Zero-CLS, *Brushing & Linking* y HITL. | `SKILL.md`, `references/` |
| [`steven-auth-and-password-ux`](./steven-skills/steven-auth-and-password-ux/) | Diseño cognitivo de login y creación de contraseñas: 1 CTA, sin Confirm Password, *Reward Early / Punish Late*, SVG Closure y Zero-CLS. | `SKILL.md`, `references/` |

---

### 2. [`stevtools/`](./stevtools/README.md) — Utilidades `/stevtool-*` (1 Skill)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`stevtool-cleanyourtv`](./stevtools/stevtool-cleanyourtv/) | Gestor aislado multi-televisor de **CleanYourTV** (Android TV / Google TV): `check-deps`, `check-compat`, perfiles por TV, debloat, compilación APK y edición personal (Wi-Fi/Bluetooth/Timer/Ambient). | `SKILL.md`, `README.md`, `scripts/tv_manager.py`, `resources/cleanyourtv-personal.patch`, `resources/personal-overrides/` |

---

### 3. [`design-guardrails/`](./design-guardrails/README.md) — Guardrails UI/UX (1 Skill)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`anti-vibecoding-design-guardrails`](./design-guardrails/anti-vibecoding-design-guardrails/) | Reglas estrictas contra clichés visuales "vibecoded" (20 anti-patrones prohibidos y reemplazos), presets tipográficos por dominio, regex lint y copywriting limpio. | `SKILL.md`, `README.md` |

---

### 4. [`creative-agency-video/`](./creative-agency-video/README.md) — Creative Agency OS & HyperFrames (27 Skills)

Suite audiovisual para generar, editar y renderizar video en código (**HyperFrames** / **Remotion** / **FFmpeg** / **Whisper** / **Brandkit**), encabezada por [`create_agency_master_guide`](./creative-agency-video/create_agency_master_guide/). Consulta el índice completo en [`creative-agency-video/README.md`](./creative-agency-video/README.md).

---

## 📖 Documentación Maestra

* **[`docs/ECOSYSTEM_STEVEN_CRM_GUIDE.md`](./docs/ECOSYSTEM_STEVEN_CRM_GUIDE.md)** — Manual maestro del ecosistema `/steven-*`, arquitectura CRM v5.2, Facturación Hacienda CR v4.4 y playbooks operativos.
* **[`docs/Creative_Agency_OS_Master_Guide.md`](./docs/Creative_Agency_OS_Master_Guide.md)** — Manual de arquitectura para producción audiovisual automatizada, dependencias (`ffmpeg`, `imagemagick`, `potrace`, `whisper`, `remotion`) y pipelines.
