# Catálogo de Superficies No Planas, Tokens CSS/OKLCH y Diagramas Neo-Brutalistas

Referencia técnica completa para `steven-ui-craft-anti-slop`. Contiene el catálogo de los **22 fondos por vertical**, recetas CSS/SVG listas para copiar y tokens base de tipografía, color perceptual y geometría concéntrica.

---

## 1. Tokens Base Listos para Copiar (Microtipografía, OKLCH y Geometría)

```css
:root {
  /* Tinted Neutrals en OKLCH (nunca #000 / #FFF puros) */
  --surface-paper: oklch(0.985 0.008 85);
  --surface-card: oklch(0.995 0.004 85);
  --surface-ink: oklch(0.16 0.015 255);
  --surface-muted: oklch(0.48 0.014 255); /* Contraste >= 4.5:1 sobre paper */

  /* Color de acento calibrado (misma L al rotar H ±20deg) */
  --accent-base: oklch(0.62 0.19 35);
  --accent-hover: oklch(0.56 0.20 35);
  --accent-glow-tint: oklch(0.62 0.19 35 / 0.18);

  /* Geometría concéntrica */
  --card-outer-r: 32px;
  --card-pad: 8px;
  --card-inner-r: max(0px, calc(var(--card-outer-r) - var(--card-pad))); /* 24px */

  /* Sombras ambientales multi-capa (teñidas del entorno, sin halo neón) */
  --shadow-ambient-sky:
    0 2px 6px oklch(0.45 0.08 240 / 0.08),
    0 12px 24px -4px oklch(0.45 0.08 240 / 0.12),
    0 32px 64px -12px oklch(0.45 0.08 240 / 0.16);
}

.editorial-h1 {
  line-height: 1.12;
  letter-spacing: -0.025em;
  text-wrap: balance;
}

.editorial-body {
  max-width: 65ch;
  line-height: 1.55;
  text-wrap: pretty;
}

.eyebrow-caps {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em; /* Tracking positivo SOLO en ALL-CAPS */
}

.metric-value {
  font-variant-numeric: tabular-nums;
}

.icon-play-optical {
  transform: translateX(2px); /* Compensa masa visual izquierda del triángulo ▶ */
}

.touch-target {
  min-width: 44px;
  min-height: 44px;
}

.sticky-mobile-bar {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

---

## 2. Catálogo Completo: 22 Fondos para Eliminar Superficies Planas

| # | Fondo / Textura | Categoría Visual | Vertical / Cuándo Usarlo | Implementación / Regla Clave |
|---|---|---|---|---|
| **1** | **Felt (Fieltro)** | Táctil cálido | Craft, educación, hardware consumer | Grano fino de fibras (`fractalNoise` frecuencia alta + color cálido `L ~0.95`) |
| **2** | **Fluted glass** | Vidrio acanalado | Fintech privacidad, cámaras, audio | `repeating-linear-gradient(90deg, ...)` + `backdrop-filter: blur(18px)` |
| **3** | **Thermal** | Mapa térmico | Energía, bio-analytics, IA cómputo | Gradiente multicromático (`azul -> magenta -> ámbar -> crema`) en capa difuminada |
| **4** | **Water ripples** | Ondas fluidas | Bienestar, hidratación, relajación | Mapa de desplazamiento SVG / WebGL suave con baja frecuencia |
| **5** | **Speckled graphite** | Grafito oscuro | DevTools dark mode, IDEs, terminales | Base `#141517` + motas `1px` a `3–4%` de opacidad sin saturar texto |
| **6** | **Single-hue landscapes** | Paisaje monocromo | Viajes, banca calmada, sostenibilidad | Fotografía o silueta duotono filtrada con `grayscale(1) sepia(...)` o tint `mix-blend` |
| **7** | **Blueprint grids** | Plano CAD | Arquitectura, SaaS ingeniería, CAD | Retícula mayor (`80px`) y menor (`16px`) al `8–12%` sobre azul técnico o crema |
| **8** | **Halftone** | Trama de puntos | Cómics, tech editorial, Neo-Brutalismo | `radial-gradient(circle, currentColor 1.5px, transparent 1.6px)` |
| **9** | **Grainy gradients** | Gradiente con ruido | SaaS modernos, heroes, splash screens | Mesh multi-parada + overlay SVG `feTurbulence` al `5–8%` anti-banding |
| **10** | **Grass / Botanical** | Orgánico / natural | AgriTech, climatología, eco | Textura vegetal desenfocada detrás de card con contraste protegido |
| **11** | **Dithered** | Tramado retro 1-bit | Retro-computing, gaming indie, crypto | Matriz Bayer / ruido ordenado sobre 2 tintas con alto contraste |
| **12** | **Paper** | Papel artesanal | Lectura larga, legal, notas, libros | `oklch(0.975 0.012 85)` + filtro `feDiffuseLighting` sutil |
| **13** | **Contour lines** | Curvas topográficas | Logística, mapas, outdoor, geodesia | Líneas vectoriales concéntricas `1px` a `0.08` de opacidad |
| **14** | **Cloud sky** | Cielo atmosférico | Aviación, auth inmersivo, productividad | Gradiente celeste real + nube suave (`filter: blur`) detrás de tarjeta flotante |
| **15** | **Pixel mosaics** | Mosaico pixelado | Media, avatares, seguridad/ofuscación | Celdas cuadradas suaves o Canvas con color promedio por bloque |
| **16** | **Lens distortion** | Óptica / aberración | Cámaras, cine, design tools | Refracción radial sutil en bordes del hero, nunca sobre texto legible |
| **17** | **Stippled gradients** | Puntillismo | Editorial ilustrado, portfolios | Puntos de densidad variable decreciendo hacia zonas limpias de lectura |
| **18** | **Square-dot grids** | Retícula cuadrada | Monitorización, status pages, AI pipelines | Matriz de micro-cuadrados `1.5px` separados `18–24px` (`opacity: 0.14`) |
| **19** | **Blurred photos** | Foto atmosférica | Música, lifestyle, auth inmersivo | Imagen real con `filter: blur(48px) saturate(1.3)` + scrim oscuro/claro encima |
| **20** | **Iridescent shapes** | Iridiscente 3D | Web3 limpio, audio, herramientas creativas | `conic-gradient` rotado + blur como acento lateral, sin texto directo sobre brillo |
| **21** | **Impressionist paintings** | Óleo / pincelada | Cultura, literatura, marcas heritage | Pinceladas pictóricas en marcos o headers con tarjeta opaca para la lectura |
| **22** | **ASCII & pixels** | Matriz ASCII | CLIs, seguridad, infra distribuida | Bloque `<pre aria-hidden="true">` en `font-mono` a `8–12%` opacidad con fade |

---

## 3. Recetas CSS / SVG Copiables por Superficie

### A. Grainy Gradient (Anti-Banding + Film Grain `6%`)

```css
.bg-grainy-hero {
  position: relative;
  isolation: isolate;
  background-color: oklch(0.97 0.01 80);
  background-image:
    radial-gradient(60% 70% at 15% 20%, oklch(0.86 0.12 55 / 0.45), transparent),
    radial-gradient(50% 60% at 85% 25%, oklch(0.84 0.10 295 / 0.35), transparent);
}

.bg-grainy-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### B. Fluted Glass (Cristal Acanalado Funcional)

```css
.surface-fluted-glass {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid oklch(1 0 0 / 0.25);
  background-color: oklch(0.98 0.005 240 / 0.55);
  backdrop-filter: blur(18px) saturate(1.2);
}

.surface-fluted-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    oklch(1 0 0 / 0.18) 0px,
    oklch(1 0 0 / 0.18) 3px,
    oklch(0 0 0 / 0.06) 3px,
    oklch(0 0 0 / 0.06) 8px
  );
}
```

### C. Speckled Graphite & Blueprint / Square-Dot Grids

```css
/* Speckled Graphite (Dark DevTools) */
.bg-speckled-graphite {
  background-color: #141517;
  background-image:
    radial-gradient(oklch(1 0 0 / 0.05) 1px, transparent 0),
    radial-gradient(oklch(1 0 0 / 0.03) 1px, transparent 0);
  background-size: 32px 32px, 19px 19px;
  background-position: 0 0, 11px 7px;
}

/* Blueprint CAD Grid */
.bg-blueprint-grid {
  background-color: oklch(0.98 0.008 245);
  background-image:
    linear-gradient(to right, oklch(0.55 0.10 245 / 0.10) 1px, transparent 1px),
    linear-gradient(to bottom, oklch(0.55 0.10 245 / 0.10) 1px, transparent 1px),
    linear-gradient(to right, oklch(0.55 0.10 245 / 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, oklch(0.55 0.10 245 / 0.05) 1px, transparent 1px);
  background-size: 96px 96px, 96px 96px, 24px 24px, 24px 24px;
}

/* Square-Dot Matrix (Telemetry / Observability) */
.bg-square-dots {
  background-color: oklch(0.99 0.004 250);
  background-image:
    linear-gradient(to right, oklch(0.2 0.02 250 / 0.14) 2px, transparent 2px),
    linear-gradient(to bottom, oklch(0.2 0.02 250 / 0.14) 2px, transparent 2px);
  background-size: 20px 20px;
}
```

### D. Tarjeta Neo-Brutalista con Sombra Halftone y Barra Rayada a 45° (`MÍNIMO` vs `EXTRAS`)

```css
.neobrutal-card {
  position: relative;
  background: oklch(0.985 0.012 85);
  border: 2px solid #111111;
  border-radius: 10px;
  padding: 1.25rem;
}

.neobrutal-card::after {
  content: "";
  position: absolute;
  inset: 6px -6px -6px 6px;
  z-index: -1;
  border-radius: 10px;
  background-image: radial-gradient(#111111 1.4px, transparent 1.4px);
  background-size: 6px 6px;
}

.hatched-bar {
  height: 28px;
  border: 2px solid #111111;
  background-color: oklch(0.84 0.14 95);
  background-image: repeating-linear-gradient(
    45deg,
    #111111 0px,
    #111111 2px,
    transparent 2px,
    transparent 8px
  );
}
```

---

## 4. Regla de Oro de Aislamiento WCAG

1. Toda textura con contraste interno (`Thermal`, `Blueprint`, `Halftone`, `Blurred photos`, `ASCII`) **debe quedar confinada al canvas de fondo** o detrás de una tarjeta sólida / `backdrop-filter` con contraste verificado `>= 4.5:1`.
2. Cualquier capa puramente atmosférica (`::before`, `<pre>` ASCII o SVG noise) debe llevar `pointer-events: none` y `aria-hidden="true"` para no interferir con selección de texto ni lectores de pantalla.
