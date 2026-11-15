# `anti-vibecoding-design-guardrails`

Guardrails estrictos de diseño UI/UX y arquitectura frontend para eliminar clichés visuales genéricos generados por IA ("vibecoded") y aplicar estándares de producción intencionales y accesibles.

---

## 🎯 Qué Incluye

* **4 Principios Base:** Intención sobre decoración, contraste estructural sobre blur/glow excesivo, tipografía con voz de dominio y copy concreto sin relleno.
* **20 Anti-Patrones Prohibidos y Reemplazos Obligatorios:** prohíbe gradientes púrpura-azul genéricos, `bg-clip-text` en héroes, emojis en títulos, `backdrop-blur` abusivo, `border-l-4` decorativo, grids simétricos repetitivos, cursores spotlight, etc.
* **3 Presets Tipográficos por Dominio:**
  * *Preset A:* DevTools, Infraestructura y Terminales (`Geist Sans`, `IBM Plex Sans`, `JetBrains Mono`).
  * *Preset B:* Enterprise, B2B SaaS y Operaciones (`Manrope`, `Satoshi`, `DM Sans` + `tabular-nums`).
  * *Preset C:* Editorial y Consumer Premium (`Newsreader`, `Fraunces`, `Source Serif 4`).
* **Patrones Prohibidos (Regex Lint) + CTA Aprobado** y lista negra de copywriting genérico.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Especificación completa, tabla de los 20 anti-patrones, presets, reglas regex y protocolo de auto-chequeo previo a generar UI.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill anti-vibecoding-design-guardrails
```

**Globs:** `**/*.tsx`, `**/*.jsx`, `**/*.html`, `**/*.vue`, `**/*.svelte`, `**/*.css`, `tailwind.config.*`  
**Triggers:** `create a landing page`, `build a component`, `style this page`, `redesign the UI`, `generate UI`.
