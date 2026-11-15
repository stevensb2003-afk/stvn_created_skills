---
name: steven-whitelabel-theming-banners
description: >
  Sistema universal de Personalización Visual en Vivo desde el Frontend (8 paletas WCAG AA/AAA con colores primary, secondary y tertiary + Zero-FOUC), Librería de Íconos Anti-IA (@phosphor-icons/react Duotone con adaptador <AppIcon />), Banner Global Superior estilo Jira (actualizaciones, próximas mejoras, deprecaciones + Drawer What's New) y Copiloto IA de Ayuda Interna en capa gratuita Gemini conectado a /<proyecto>_ai_agent_docs/ (steven-brd-docs-bootstrap).
  Actívalo cuando el usuario escriba "/steven-whitelabel-theming-banners", "/temas-frontend", "/banner-global", "/ayuda-ia", "cambiar colores desde frontend", "paletas de colores", "íconos no genéricos", o quiera agregar un banner tipo Jira y asistente IA de documentación.
---

# Personalización en Vivo, Íconos Anti-IA, Banner Global y Copiloto IA de Ayuda (`steven-whitelabel-theming-banners`)

Este skill eleva cualquier producto B2B para que cada cliente pueda ajustar su marca desde el navegador sin tocar código, luzca con una identidad visual propia lejos del estilo genérico "vibecoded", comunique lanzamientos con un banner global tipo Jira y ofrezca soporte interno instantáneo con costo `$0`.

---

## 1. Entrevista Inicial (`ask_question`)

```json
{
  "questions": [
    {
      "question": "¿Qué capacidades visuales y de soporte deseas integrar en este proyecto?",
      "is_multi_select": true,
      "options": [
        "(Recommended) Estudio de Temas en Vivo desde Frontend (8 paletas + colores Primary/Secondary/Tertiary + Logo)",
        "(Recommended) Sistema de Íconos Anti-IA con @phosphor-icons/react Duotone (<AppIcon />)",
        "(Recommended) Banner Global tipo Jira + Drawer de Novedades conectado a /config/app_version",
        "(Recommended) Copiloto IA de Ayuda Interna (Gemini capa gratuita) leyendo *_ai_agent_docs"
      ]
    }
  ]
}
```

---

## 2. Guías de Implementación

### A. Temas en Vivo & Íconos Anti-IA
Lee [`references/theme-palettes-and-icons.md`](./references/theme-palettes-and-icons.md) para implementar:
1. Tokens `--primary`, `--secondary` y `--tertiary` en `globals.css` + `tailwind.config.ts`.
2. Los 8 presets calibrados (`THEME_PALETTES`) + modo personalizado con cálculo automático WCAG (`getAccessibleForegroundHsl`).
3. `ThemeInjectorProvider` + caché Zero-FOUC en `localStorage` leyendo `crm_settings/branding`.
4. `<AppIcon />` sobre `@phosphor-icons/react` con mapeo automático para nombres legacy de Lucide.

### B. Banner Global, Changelog y Copiloto IA Gratuito
Lee [`references/banners-changelog-and-help-copilot.md`](./references/banners-changelog-and-help-copilot.md) para implementar:
1. `GlobalAnnouncementBanner` escuchando `crm_settings/announcements` (`release`, `upcoming`, `deprecation`, `maintenance`, `alert`).
2. `WhatsNewChangelogDrawer` conectado a `/config/app_version`.
3. `POST /api/help-copilot/ask`: filtra manuales en `/<proyecto>_ai_agent_docs/` por etiquetas `[ROL: ...]` y consulta `gemini-2.5-flash-lite` (capa gratuita Google AI Studio) con límite diario por usuario.

---

## 3. Reglas de Verificación
- Ningún componente `.tsx` debe contener colores HEX quemados (`bg-[#...]`).
- La API Key del Copiloto IA (`helpCopilotAi`) debe residir únicamente en servidor o Bóveda Write-Only, jamás en `NEXT_PUBLIC_*`.
- Si aún no existe `/<proyecto>_ai_agent_docs/`, invoca **`steven-brd-docs-bootstrap`** para generar la base documental antes de probar el Copiloto.
