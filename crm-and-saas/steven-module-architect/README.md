# `steven-module-architect`

Arquitecto universal e independiente del proyecto para diseñar e implementar **nuevos módulos o features completos** sin romper el sistema de diseño, la seguridad RBAC ni la documentación de ayuda IA.

---

## 🔄 Flujo de Trabajo

1. **Fase 0 — Escaneo Automático:** ejecuta `scripts/analyze-project-architecture.mjs` para detectar framework, base de datos, tokens CSS (`--primary`, `--tertiary`), librería de íconos, guardias RBAC, licenciamiento `tenant_license` y carpeta `/*_ai_agent_docs/`.
2. **Fase 1 — Entrevista `ask_question`:** alinea montaje (navegación global, submódulo contextual o add-on comercial), permisos y bóveda de secretos.
3. **Fases 2–4 — Ejecución Guiada:** contratos TypeScript/Zod, permisos RBAC, endpoints protegidos y UI modular (`< 500` líneas por archivo) con estados Carga/Vacío/Error/Bloqueado.
4. **Fase 5 — Sincronización Documental:** actualiza `/*_ai_agent_docs/` vía `steven-brd-docs-bootstrap` (Modo C) y valida `typecheck` + `build`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Protocolo completo en 5 fases.
* [`references/module-integration-checklists.md`](./references/module-integration-checklists.md) — Patrones de integración RBAC, UI y sincronización BRD.
* [`scripts/analyze-project-architecture.mjs`](./scripts/analyze-project-architecture.mjs) — Escáner automático del repositorio destino.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-module-architect
```

**Triggers:** `/steven-module-architect`, `/nuevo-modulo`, `/crear-modulo`, `agregar nuevo módulo`.
