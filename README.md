# 🛠️ Steven's AI Skills Hub (`stvn_created_skills`)

Repositorio maestro y respaldo en la nube de skills personalizadas para **Google Antigravity** (y agentes compatibles con `SKILL.md`), ordenadas **por tipo y con una carpeta autocontenida por skill** para mantener separadas las skills de **código/arquitectura**, **diseño UI/UX**, **herramientas de dispositivos** y **producción audiovisual**.

---

## 📁 Organización por Tipo (46 Skills)

```text
stvn_created_skills/
├── README.md                          # Portal principal, instalación y catálogo por tipo
├── install.sh                         # Instalador macOS / Linux (--all, --type, --skill, --link)
├── install.ps1                        # Instalador Windows PowerShell
├── docs/                              # Manuales maestros del ecosistema
│   ├── ECOSYSTEM_STEVEN_CRM_GUIDE.md  # Mapa completo del ecosistema steven-* (v5.2) + playbooks
│   └── Creative_Agency_OS_Master_Guide.md
│
├── crm-and-saas/                      # [CÓDIGO] 6 skills: CRM Omnicanal, SaaS, RBAC, Meta, Hacienda CR y Docs IA
├── cloud-deploy-and-security/         # [CÓDIGO & INFRA] 5 skills: Firebase Bootstrap, Deploy, OAuth, SEO/A+ y HTTP Compression
├── ui-ux-and-design/                  # [DISEÑO & FRONTEND] 7 skills: Anti-Vibecoding, UI Craft, Motion, Theming, Iconos, AI UX y Auth UX
├── tools/                             # [TOOLS] 1 skill: CleanYourTV Multi-TV Manager (stevtool-cleanyourtv)
└── creative-agency-video/             # [VIDEO & MARCA] 27 skills: Creative Agency OS, Brandkit y HyperFrames
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

### Opción 2: Instalar por tipo o una skill específica

```bash
# Listar todos los tipos y skills disponibles
./install.sh --list

# Instalar por tipo:
./install.sh --type crm-and-saas
./install.sh --type cloud-deploy-and-security
./install.sh --type ui-ux-and-design
./install.sh --type tools
./install.sh --type creative-agency-video

# Instalar una única skill específica
./install.sh --skill steven-waba-dualhook-connection

# Instalar dentro de un proyecto específico (.agents/skills/)
./install.sh --type ui-ux-and-design --target /ruta/a/tu-proyecto/.agents/skills
```

### Opción 3: Windows (PowerShell)

```powershell
git clone https://github.com/stevensb2003-afk/stvn_created_skills.git "$env:USERPROFILE\.gemini\config\stvn_created_skills"
cd "$env:USERPROFILE\.gemini\config\stvn_created_skills"
.\install.ps1 -All
# O por tipo / skill:
.\install.ps1 -Category ui-ux-and-design
.\install.ps1 -Skill steven-oauth-verifier
```

### Actualizar a la última versión

```bash
cd ~/.gemini/config/stvn_created_skills
git pull
./install.sh --all   # (No necesario si instalaste con --link)
```

---

## 🗂️ Catálogo Completo por Tipo

### 1. [`crm-and-saas/`](./crm-and-saas/README.md) — Código: CRM, SaaS, RBAC, Meta & Facturación CR (6 Skills)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`steven-waba-dualhook-connection`](./crm-and-saas/steven-waba-dualhook-connection/) | Arquitectura maestra v5.2 de CRM Omnicanal (WhatsApp Dualhook + IG + Messenger), POS 4 modos, Hacienda CR v4.4, SaaS `/developer` y auditoría forense. | `SKILL.md`, `README.md`, 14 `references/`, 8 `scripts/*.mjs`, `resources/xsd/v4.4/` |
| [`steven-module-architect`](./crm-and-saas/steven-module-architect/) | Escáner de arquitectura y protocolo guiado para agregar módulos respetando tokens CSS, RBAC y docs IA. | `SKILL.md`, `README.md`, `references/`, `scripts/analyze-project-architecture.mjs` |
| [`steven-rbac-invitations-licensing`](./crm-and-saas/steven-rbac-invitations-licensing/) | RBAC dinámico en 3 planos (`platformDev` / Owner / `roles/{roleId}`), invitaciones SHA-256 72h, `/developer` y webhooks HMAC. | `SKILL.md`, `README.md`, 2 `references/` |
| [`steven-meta-omnichannel-identity`](./crm-and-saas/steven-meta-omnichannel-identity/) | Integración nativa Meta Graph v25.0 (Instagram Direct + Messenger), Auto-Discovery 1-Token y unificación 360°. | `SKILL.md`, `README.md`, 2 `references/` |
| [`steven-integracion-hacienda`](./crm-and-saas/steven-integracion-hacienda/) | Motor nativo de Facturación Electrónica Hacienda CR v4.4 / TRIBU-CR en Node.js (`XAdES-EPES` + validación offline XSD, cero PHP/AGPL). | `SKILL.md`, `README.md`, 7 `references/`, 3 `scripts/*.mjs`, `resources/xsd/v4.4/` |
| [`steven-brd-docs-bootstrap`](./crm-and-saas/steven-brd-docs-bootstrap/) | Generador y actualizador de bases documentales BRD multi-rol (`/*_ai_agent_docs/`) con EGM y compilador de líneas `Lxxx-Lyyy`. | `SKILL.md`, `README.md`, 2 `references/`, 2 `scripts/*.mjs` |

---

### 2. [`cloud-deploy-and-security/`](./cloud-deploy-and-security/README.md) — Código & Infra: Firebase, Deploy, OAuth, SEO & Performance (5 Skills)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`steven-firebase-client-bootstrap`](./cloud-deploy-and-security/steven-firebase-client-bootstrap/) | Provisioner automatizado GCP/Firebase + App Check + CI/CD 2 ramas (`demo` → `main`) multi-cliente. | `SKILL.md`, `README.md`, `references/`, `scripts/provision-firebase-project.mjs` |
| [`steven-project-deploy`](./cloud-deploy-and-security/steven-project-deploy/) | Protocolo universal de release SemVer y Version Gate reactivo para Firebase App Hosting (SSR) y Classic Hosting. | `SKILL.md`, `README.md` |
| [`steven-oauth-verifier`](./cloud-deploy-and-security/steven-oauth-verifier/) | Dominio personalizado, Google Search Console, Google OAuth Consent, anti-fugas `firebaseapp.com` y cumplimiento CR (Ley 8968/7472). | `SKILL.md`, `README.md` |
| [`steven-seo-seguridad-web`](./cloud-deploy-and-security/steven-seo-seguridad-web/) | Clasificador Fase 0, SEO On-Page, GEO/LLMO (`/llms.txt`), cabeceras HTTP Grado `A+`, accesibilidad, PWA y GA4/Meta Pixel. | `SKILL.md`, `README.md` |
| [`steven-web-performance-http-compression`](./cloud-deploy-and-security/steven-web-performance-http-compression/) | Ingeniería de compresión HTTP (`br` / `gzip` / `zstd`), Nginx/Express/Fastify/Vite/Cloud Run, SSE y prevención `ERR_CONTENT_DECODING_FAILED`. | `SKILL.md`, `README.md`, `references/` |

---

### 3. [`ui-ux-and-design/`](./ui-ux-and-design/README.md) — Diseño & Frontend: Anti-Slop, Motion, Theming, Iconos & UX (7 Skills)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`anti-vibecoding-design-guardrails`](./ui-ux-and-design/anti-vibecoding-design-guardrails/) | Guardrails estrictos anti-vibecoding: 20 anti-patrones prohibidos, presets tipográficos por dominio, regex lint y copywriting limpio. | `SKILL.md`, `README.md` |
| [`steven-ui-craft-anti-slop`](./ui-ux-and-design/steven-ui-craft-anti-slop/) | Auditoría y reconstrucción visual anti-AI slop: color perceptual `OKLCH`, microtipografía, radios concéntricos, sombras ambientales y 22 superficies. | `SKILL.md`, `README.md`, `references/` |
| [`steven-ui-motion-and-interaction-engineering`](./ui-ux-and-design/steven-ui-motion-and-interaction-engineering/) | Ingeniería cuantitativa de movimiento UI: curvas, springs, principios Disney, leyes UX y microinteracciones optimistas de `0ms`. | `SKILL.md`, `README.md`, `references/` |
| [`steven-whitelabel-theming-banners`](./ui-ux-and-design/steven-whitelabel-theming-banners/) | Estudio de paletas WCAG en vivo (`--primary`/`--secondary`/`--tertiary`), `<AppIcon />` Phosphor, Banner Global tipo Jira y Copiloto IA gratis. | `SKILL.md`, `README.md`, 2 `references/` |
| [`steven-pictogrammers-icon-lib`](./ui-ux-and-design/steven-pictogrammers-icon-lib/) | Bóveda local compartida y extractor selectivo sin peso npm para `@mdi/svg`, `@mdi/light-svg` y `@pictogrammers/memory-svg`. | `SKILL.md`, `README.md`, 2 `references/`, `scripts/mdi.mjs` |
| [`steven-agentic-ai-interface-ux`](./ui-ux-and-design/steven-agentic-ai-interface-ux/) | Patrones UX para chats y agentes IA: empty states accionables, *Labor Illusion*, citas *origin-aware*, streaming Zero-CLS, *Brushing & Linking* y HITL. | `SKILL.md`, `README.md`, `references/` |
| [`steven-auth-and-password-ux`](./ui-ux-and-design/steven-auth-and-password-ux/) | Diseño cognitivo de login y creación de contraseñas: 1 CTA, sin Confirm Password, *Reward Early / Punish Late*, SVG Closure y Zero-CLS. | `SKILL.md`, `README.md`, `references/` |

---

### 4. [`tools/`](./tools/README.md) — Herramientas & Dispositivos (`/stevtool-*`) (1 Skill)

| Skill | Propósito Principal | Recursos Incluidos |
| :--- | :--- | :--- |
| [`stevtool-cleanyourtv`](./tools/stevtool-cleanyourtv/) | Gestor aislado multi-televisor de **CleanYourTV** (Android TV / Google TV): `check-deps`, `check-compat`, perfiles por TV, debloat, compilación APK y edición personal (Wi-Fi/Bluetooth/Timer/Ambient). | `SKILL.md`, `README.md`, `scripts/tv_manager.py`, `resources/cleanyourtv-personal.patch`, `resources/personal-overrides/` |

---

### 5. [`creative-agency-video/`](./creative-agency-video/README.md) — Video, Marca & HyperFrames (27 Skills)

Suite audiovisual para generar, editar y renderizar video en código (**HyperFrames** / **Remotion** / **FFmpeg** / **Whisper** / **Brandkit**), encabezada por [`create_agency_master_guide`](./creative-agency-video/create_agency_master_guide/). Consulta el índice completo en [`creative-agency-video/README.md`](./creative-agency-video/README.md).

---

## 📖 Documentación Maestra

* **[`docs/ECOSYSTEM_STEVEN_CRM_GUIDE.md`](./docs/ECOSYSTEM_STEVEN_CRM_GUIDE.md)** — Manual maestro del ecosistema, arquitectura CRM v5.2, Facturación Hacienda CR v4.4 y playbooks operativos.
* **[`docs/Creative_Agency_OS_Master_Guide.md`](./docs/Creative_Agency_OS_Master_Guide.md)** — Manual de arquitectura para producción audiovisual automatizada, dependencias (`ffmpeg`, `imagemagick`, `potrace`, `whisper`, `remotion`) y pipelines.
