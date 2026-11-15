---
name: anti-vibecoding-design-guardrails
description: >-
  Enforces production-grade, bespoke, and distinct UI/UX design. Prevents generic AI "vibecoded" aesthetic clichés and mandates concrete replacements across layout, styling, typography, and copywriting. Use when designing, styling, building UI components, landing pages, or redesigning web interfaces.
version: 1.0.0
globs: ["**/*.tsx", "**/*.jsx", "**/*.html", "**/*.vue", "**/*.svelte", "**/*.css", "tailwind.config.*"]
triggers:
  - "create a landing page"
  - "build a component"
  - "style this page"
  - "redesign the UI"
  - "generate UI"
---

# Anti-Vibecoding Design & Architecture Guardrails

You are an expert design engineer and frontend architect. When writing interface code, generating components, or designing web layouts, you must actively reject boilerplate "AI vibe-coded" aesthetics. Your goal is to deliver software that looks human-crafted, deliberate, accessible, and uniquely tailored to its product domain.

---

## 1. Core Principles

1. **Intention Over Decoration:** Every visual accent (border, shadow, color, typography swap) must serve hierarchy, readability, or state feedback—not decorative filler.
2. **Structural Contrast Over Blurred Shadows:** Prioritize spatial hierarchy, distinct solid surface levels, and sharp borders over heavy glows, multi-layer blur backdrops, and grain overlays.
3. **Typography as Voice:** Never treat typography as an unconfigured default. Typography should express the product's domain rather than mimic standard SaaS templates.
4. **Direct, Concrete Language:** Write copy that describes functionality, metrics, and workflows clearly without synthetic marketing buzzwords.

---

## 2. The 20 Vibecoded Pitfalls & Mandatory Replacements

| # | Pitfall Pattern (STRICTLY BANNED) | Why It Fails | Mandatory Alternative |
|---|---|---|---|
| **01** | **Purple-to-blue linear gradients** | Universally signals template boilerplate and uninspired AI defaults. | Solid, intentional primary brand colors (e.g., International Klein Blue `#002FA7`, Forest `#1B4332`, Signal Amber `#D97706`, or warm slate). |
| **02** | **Gradient hero text** (`bg-clip-text text-transparent`) | Diminishes text contrast, impairs accessibility, and looks dated. | High-contrast solid typography with deliberate weight or size modulation for emphasis. |
| **03** | **Emojis in headings** (e.g., `🚀 Fast Analytics`) | Cheapens technical credibility and produces visual noise. | Strict text-first headings. If iconography is needed, use purpose-built, uniform SVG badges aligned to text metrics. |
| **04** | **Unconfigured Inter everywhere** | Erases brand identity and defaults to generic wireframe styling. | Domain-calibrated type stacks (see Section 3: Typography Presets). |
| **05** | **Colored left-border cards** (`border-l-4 border-l-indigo-500`) | Lazy, template-driven status indicator pattern. | Consistent all-around borders with semantic surface backgrounds, distinct elevation levels, or dedicated status chips. |
| **06** | **Glassmorphism everywhere** (`backdrop-blur-md bg-white/10`) | Impairs readability, causes GPU performance drops, and breaks contrast. | Solid, well-separated surface tokens (e.g., `bg-neutral-900` over `bg-neutral-950` with `border-neutral-800`). |
| **07** | **Low-contrast dark mode** (muddy dark grays, washed-out text) | Fails accessibility (WCAG AA/AAA) and strains user focus. | Deep canvas blacks (`#09090B` or `#0B0F17`) paired with crisp foreground text (`#F8FAFC` and `#94A3B8`). |
| **08** | **3 symmetrical icon boxes in a row** | Predictable, static cadence with zero information density. | Asymmetrical bento grids (e.g., 2/3 + 1/3 splits), interactive component previews, data tables, or horizontal process flows. |
| **09** | **Centered pill badge above headline** | AI template hallmark that clutters the visual hierarchy. | Left-align or incorporate metadata naturally into the heading hierarchy; use a persistent product utility bar if required. |
| **10** | **Lucide icons as decorative filler** in every box | Adds no semantic value; creates monotonous icon-in-a-rounded-square fatigue. | Content-first layouts. Reserve icons exclusively for actionable controls, inputs, and unambiguous status indicators. |
| **11** | **Untouched shadcn/ui defaults** | Makes every application look like an exact clone of the component documentation. | Custom-tailor the border radii, inner padding, border opacity, hover states, and tonal surface palette. |
| **12** | **Fade-in on scroll** applied to every section | Delays content ingestion and creates an annoying, laggy reading experience. | Render critical content immediately. Limit motion to purposeful micro-interactions, tab transitions, or layout expands. |
| **13** | **Cursor-following spotlight beam / glow** | High CPU/GPU overhead with zero usability gain. | High-contrast structural lines, clean grid borders, or subtle static dividers (`border-neutral-800`). |
| **14** | **Slow button opacity fade on hover** (`duration-500`) | Feels sluggish and non-responsive to input. | Snappy, tactile micro-transitions (100–150ms `ease-out`, subtle scale, distinct background shift, or active press state). |
| **15** | **Inconsistent spacing** | Destroys visual rhythm and gives an unpolished finish. | Strict adherence to an 8-point spatial grid (`gap-2`, `gap-4`, `gap-6`, `p-6`, `p-8`). Never mix arbitrary pixel margins. |
| **16** | **Em dashes (`—`) littered in subheadings** | Overused AI writing marker that clutters short marketing copy. | Write clean, succinct, declarative sentences separated by periods or clear line breaks. |
| **17** | **Generic marketing buzzwords** | Vacuous copy that explains nothing about the software. | State what the software actually does, what problem it solves, and exact performance or functional metrics. |
| **18** | **Single italic serif accent word** in headlines | Pretentious template trick that creates jarring visual discordance. | Maintain single-family heading consistency. Use weight, size, tracking, or color contrast for emphasis. |
| **19** | **Space Grotesk + Instrument Serif pairing** | The most overused AI-generated boutique agency cliché. | Authentic editorial or grotesque pairings suited to the product type (see Section 3). |
| **20** | **Grain texture over gradient blobs** | Overdone visual noise that degrades rendering quality. | Clean, solid canvas surfaces, structural geometric grids, or subtle blueprint guides (`border-dashed`). |

---

## 3. Typography Presets by Product Domain

Select and declare a typography stack that reinforces the app's purpose:

### Preset A: Developer Tools, Infrastructure & Terminal Interfaces
* **Display / Headings:** `Geist Sans`, `Plus Jakarta Sans`, or `Space Grotesk` (only when unmixed)
* **Body:** `Geist Sans`, `Inter` (with custom tracking: `tracking-tight`), or `IBM Plex Sans`
* **Code / Technical Data:** `JetBrains Mono`, `Geist Mono`, or `Fira Code`

### Preset B: High-End Enterprise, B2B SaaS & Operations
* **Display / Headings:** `Manrope`, `Satoshi`, or `DM Sans`
* **Body:** `Satoshi`, `Plus Jakarta Sans`, or `General Sans`
* **Data / Metrics:** `Tabular figures` (`font-mono` or `font-variant-numeric: tabular-nums`)

### Preset C: Editorial, Publishing & Premium Consumer
* **Display / Headings:** `Newsreader`, `Fraunces`, or `Playfair Display`
* **Body:** `General Sans`, `Source Serif 4`, or `Merriweather`
* **Accents / Micro-copy:** Clean neutral sans with uppercase tracking (`tracking-widest uppercase text-xs`)

---

## 4. Banned Code Patterns (Lint Rules)

### Banned Tailwind Snippets
```regex
# Banned gradient text
bg-clip-text\s+text-transparent\s+bg-gradient-to-r\s+from-purple-[0-9]+\s+to-blue-[0-9]+

# Banned glassmorphism
backdrop-blur-(sm|md|lg)\s+bg-white\/[0-9]+(\s+border\s+border-white\/[0-9]+)?

# Banned left-border card indicator
border-l-[2-8]\s+border-l-(indigo|purple|blue|violet)-[0-9]+

# Banned sluggish hover transition
transition-(all|opacity)\s+duration-(500|700|1000)
```

### Approved Interactive Button Pattern
```tsx
// Compliant CTA pattern with crisp tactile feedback
<button
  type="button"
  className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-50 shadow-sm transition-all duration-150 ease-out hover:bg-neutral-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
>
  Deploy Pipeline
</button>
```

---

## 5. Copywriting Strict Banned List

Never generate copy containing any of the following buzzwords or sentence structures:

- ❌ "Supercharge your workflow"
- ❌ "Unleash the power of..."
- ❌ "Elevate your productivity"
- ❌ "Seamless / Frictionless experience"
- ❌ "All-in-one platform for modern teams"
- ❌ "Next-gen / Game-changing solution"
- ❌ "Magical DX" / "Built for the modern web"

### Copywriting Replacement Examples
* **Bad:** "Supercharge your database performance with frictionless, AI-driven speed."
* **Good:** "Run analytical queries under 12ms. Automated read-replica distribution with zero downtime failover."

* **Bad:** "Elevate your team's code review workflow seamlessly."
* **Good:** "Inline PR summaries, real-time schema validation, and automated GitHub status checks."

---

## 6. Pre-Generation Self-Check Protocol

Before finalizing and presenting any code or layout, the AI agent must verify against this 5-point checklist:

1. **The Hero Layout Check:** Is the hero section centered with a floating pill badge and a purple-to-blue gradient headline? If yes, refactor to an asymmetrical or left-aligned high-contrast layout.
2. **The Grid Variation Check:** Does the feature section rely on three identical cards with Lucide icons in rounded squares? If yes, replace it with an asymmetric bento grid or interactive UI preview.
3. **The Contrast Check:** In dark mode, is body text easily readable without visual strain? (Ensure contrast meets WCAG AA standards: `#94A3B8` / `#E2E8F0` on `#09090B`).
4. **The Animation Check:** Is content locked behind scroll-fade animations? If yes, remove scroll triggers so content renders immediately.
5. **The Tone Check:** Are there generic buzzwords, decorative emojis in headings, or excessive em dashes in the copy? If yes, rewrite into precise, technical, value-driven statements.
