# `steven-whitelabel-theming-banners`

Sistema universal de **Personalización Visual en Vivo desde el Frontend** (8 paletas WCAG AA/AAA con `--primary`, `--secondary`, `--tertiary` y Zero-FOUC), **Iconografía Anti-IA** (`@phosphor-icons/react` con `<AppIcon />`), **Banner Global estilo Jira** + Drawer *What's New* y **Copiloto IA de Ayuda Interna** en capa gratuita Gemini (`gemini-2.5-flash-lite`) conectado a `/*_ai_agent_docs/`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Entrevista inicial `ask_question`, guía en 2 bloques y reglas de verificación (cero colores HEX quemados en `.tsx`).
* [`references/theme-palettes-and-icons.md`](./references/theme-palettes-and-icons.md) — 8 presets `THEME_PALETTES`, `getAccessibleForegroundHsl`, `ThemeInjectorProvider` Zero-FOUC y adaptador `<AppIcon />`.
* [`references/banners-changelog-and-help-copilot.md`](./references/banners-changelog-and-help-copilot.md) — `GlobalAnnouncementBanner`, `WhatsNewChangelogDrawer` y endpoint `POST /api/help-copilot/ask`.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-whitelabel-theming-banners
```

**Triggers:** `/steven-whitelabel-theming-banners`, `/temas-frontend`, `/banner-global`, `/ayuda-ia`.
