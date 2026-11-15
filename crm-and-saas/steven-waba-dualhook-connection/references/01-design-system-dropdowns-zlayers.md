# Blueprint 01 — Sistema de Diseño White-Label (`globals.css`), Paletas Categóricas, Dropdowns en Portales (`z-[150]`), Capas Z, Sanitización e Idempotencia UI

> **Lectura Obligatoria**: Todo agente que ejecute `MODO A` (Fases 1, 5, 6, 7), `MODO B` (nuevos paneles/submódulos) o `MODO C` (auditoría de frontend) DEBE implementar textualmente los contratos, hojas CSS, configuraciones de Tailwind y componentes base de este manual.

---

## 1. Regla Maestra White-Label: `src/app/globals.css` como Única Fuente de Verdad (Zero Hardcoding)

### 1.1 Principio Arquitectónico (`Single Source of Truth`)
Para que el CRM sea **100% clonable, SaaS-ready y re-brandeable en menos de 2 minutos** para cualquier negocio:
1. **TODOS** los colores de interfaz (modo claro `:root` y modo oscuro `.dark`), superficies, bordes, anillos de foco, colores de marca, estados semánticos, burbujas de conversación WhatsApp, series de gráficas, radios de borde (`--radius`) y variables tipográficas (`--font-sans`, `--font-headline`, `--font-mono`) **viven única y exclusivamente en `src/app/globals.css`** y se mapean en `tailwind.config.ts`.
2. **PROHIBIDO HARDCODEAR COLORES, TIPOGRAFÍAS O RADIOS EN COMPONENTES `.tsx`**:
   - Si se desea cambiar la paleta completa del CRM (ej. pasar de *Dark Slate + Sky Blue* a *Esmeralda Corporativo*, *Minimalista Cálido* o *Violeta SaaS*) o sustituir la tipografía (`Inter` → `Plus Jakarta Sans` o `Geist`), **solo se edita `src/app/globals.css` (y la carga de `next/font` vinculada a `--font-app-sans` / `--font-app-mono` en `src/app/layout.tsx`) sin tocar ni un solo archivo `.tsx`**.

### 1.2 Tabla Estricta de Prohibiciones vs. Tokens Semánticos Obligatorios

| Elemento Visual | ❌ PROHIBIDO en `.tsx` (Hardcoded) | ✅ OBLIGATORIO en `.tsx` (Token Semántico) | Variable Master en `globals.css` |
| :--- | :--- | :--- | :--- |
| Fondo principal de app | `bg-white dark:bg-slate-900`, `bg-[#2a3b4c]` | `bg-background text-foreground` | `--background`, `--foreground` |
| Tarjetas, paneles, filas | `bg-gray-50 dark:bg-slate-800` | `bg-card text-card-foreground` | `--card`, `--card-foreground` |
| Dropdowns, menús, sheets | `bg-white dark:bg-slate-950` | `bg-popover text-popover-foreground` | `--popover`, `--popover-foreground` |
| Píldora activa / CTA primario | `bg-blue-600 text-white`, `bg-sky-300` | `bg-primary text-primary-foreground` | `--primary`, `--primary-foreground` |
| Superficies sutiles / hover | `bg-gray-100 hover:bg-gray-200` | `bg-muted text-muted-foreground` / `hover:bg-accent` | `--muted`, `--accent` |
| Bordes e inputs | `border-gray-200 dark:border-slate-700` | `border-border`, `border-input`, `ring-ring` | `--border`, `--input`, `--ring` |
| Estados (Éxito/Alerta/Error) | `bg-green-600`, `text-red-500`, `bg-amber-500` | `bg-success`, `text-destructive`, `bg-warning` | `--success`, `--warning`, `--destructive` |
| Burbujas de Chat (Saliente/Entrante) | `bg-[#E7FFDB] dark:bg-[#005c4b]` | `bg-chat-outbound text-chat-outbound-foreground` / `bg-chat-inbound` | `--chat-outbound`, `--chat-inbound` |
| Nota interna privada en chat | `bg-yellow-100 text-yellow-900` | `bg-chat-internal-note text-chat-internal-note-foreground` | `--chat-internal-note` |
| Tipografía UI y Código | `font-['Inter']`, `style={{ fontFamily: 'monospace' }}` | `font-body`, `font-headline`, `font-code` | `--font-sans`, `--font-headline`, `--font-mono` |
| Redondeo de contenedores | `rounded-[14px]` arbitrario | `rounded-lg`, `rounded-xl`, `rounded-2xl` | Derivados de `--radius` |

### 1.3 Código Canónico Completo de `src/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Tipografía Master (inyectada por next/font en layout.tsx o fallback de sistema) */
    --font-sans: var(--font-app-sans, 'Inter'), system-ui, -apple-system, sans-serif;
    --font-headline: var(--font-app-headline, var(--font-sans));
    --font-mono: var(--font-app-mono, 'Source Code Pro'), ui-monospace, monospace;

    /* Superficies Base (Light Mode) */
    --background: 208 100% 97%;
    --foreground: 222.2 84% 4.9%;
    --card: 208 100% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 208 100% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Identidad de Marca & Navegación Activa (Sky Blue Signature + Tertiary White-Label) */
    --primary: 197 71% 63%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 210 40% 9%;
    --tertiary: 162 63% 41%;
    --tertiary-foreground: 0 0% 100%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 210 3.9% 45.1%;
    --accent: 207 44% 92%;
    --accent-foreground: 222.2 84% 4.9%;

    /* Semánticos de Operación */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --success: 152 69% 38%;
    --success-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 222.2 84% 4.9%;
    --info: 207 90% 54%;
    --info-foreground: 210 40% 98%;

    /* Burbujas del Workspace de Chat (WhatsApp Coexistence) */
    --chat-canvas: 210 30% 95%;
    --chat-outbound: 100 100% 93%;
    --chat-outbound-foreground: 222.2 84% 4.9%;
    --chat-inbound: 0 0% 100%;
    --chat-inbound-foreground: 222.2 84% 4.9%;
    --chat-internal-note: 45 96% 89%;
    --chat-internal-note-foreground: 28 73% 26%;

    /* Bordes, Foco, Gráficos y Radio Maestro */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 197 71% 53%;
    --radius: 0.65rem;
    --chart-1: 197 71% 50%;
    --chart-2: 160 60% 42%;
    --chart-3: 38 92% 50%;
    --chart-4: 262 65% 58%;
    --chart-5: 340 75% 55%;
    color-scheme: light;
  }

  .dark {
    color-scheme: dark;
    /* Superficies Base (Dark Slate Signature) */
    --background: 211 29% 23%;
    --foreground: 210 40% 98%;
    --card: 211 29% 28%;
    --card-foreground: 210 40% 98%;
    --popover: 211 29% 18%;
    --popover-foreground: 210 40% 98%;

    /* Píldora Activa Sky Blue (Alto contraste sobre Dark Slate + Tertiary) */
    --primary: 197 71% 73%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --tertiary: 162 60% 50%;
    --tertiary-foreground: 222.2 84% 4.9%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 211 29% 32%;
    --accent-foreground: 210 40% 98%;

    /* Semánticos Dark */
    --destructive: 0 62.8% 45%;
    --destructive-foreground: 210 40% 98%;
    --success: 152 60% 42%;
    --success-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 222.2 84% 4.9%;
    --info: 199 89% 62%;
    --info-foreground: 222.2 84% 4.9%;

    /* Burbujas Chat Dark */
    --chat-canvas: 213 32% 16%;
    --chat-outbound: 169 100% 18%;
    --chat-outbound-foreground: 210 40% 98%;
    --chat-inbound: 211 29% 28%;
    --chat-inbound-foreground: 210 40% 98%;
    --chat-internal-note: 38 55% 22%;
    --chat-internal-note-foreground: 45 93% 88%;

    --border: 217.2 32.6% 20%;
    --input: 217.2 32.6% 20%;
    --ring: 197 71% 73%;
    --chart-1: 197 71% 65%;
    --chart-2: 160 60% 48%;
    --chart-3: 38 90% 58%;
    --chart-4: 280 65% 62%;
    --chart-5: 340 75% 58%;
  }

  * {
    @apply border-border;
  }
  html, body {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    font-family: var(--font-sans);
  }
  body {
    @apply bg-background text-foreground font-body antialiased;
  }
  /* Anti-Auto-Zoom obligatorio en Safari iOS y Chrome Mobile */
  input, textarea, select {
    font-size: 16px !important;
    touch-action: manipulation;
  }
  @media (min-width: 640px) {
    input, textarea, select {
      font-size: inherit !important;
    }
  }
}

@layer utilities {
  .scrollbar-discreet {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
  .scrollbar-discreet::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .scrollbar-discreet::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.3);
    border-radius: 9999px;
  }
}
```

### 1.4 Código Canónico Completo de `tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-sans)'],
        headline: ['var(--font-headline)'],
        code: ['var(--font-mono)'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          foreground: 'hsl(var(--tertiary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        chat: {
          canvas: 'hsl(var(--chat-canvas))',
          outbound: 'hsl(var(--chat-outbound))',
          'outbound-foreground': 'hsl(var(--chat-outbound-foreground))',
          inbound: 'hsl(var(--chat-inbound))',
          'inbound-foreground': 'hsl(var(--chat-inbound-foreground))',
          'internal-note': 'hsl(var(--chat-internal-note))',
          'internal-note-foreground': 'hsl(var(--chat-internal-note-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

---

## 2. Las 2 Únicas Paletas Categóricas de Datos Aisladas

### 2.1 Paleta Determinística de 32 Colores WCAG AA para Asesores (`src/components/crm/crm-assignment-colors.ts`)
Garantiza `0` colisiones visuales hasta para 32 asesores simultáneos en `ChatList` y `ChatHeader`:
```typescript
export interface AssignmentColorStyle {
  id: string;
  name: string;
  badgeClass: string;
  dotClass: string;
}

export const CRM_ASSIGNMENT_PALETTE: AssignmentColorStyle[] = [
  { id: 'indigo', name: 'Índigo', badgeClass: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60', dotClass: 'bg-indigo-500' },
  { id: 'emerald', name: 'Esmeralda', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60', dotClass: 'bg-emerald-500' },
  { id: 'violet', name: 'Violeta', badgeClass: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60', dotClass: 'bg-violet-500' },
  { id: 'amber', name: 'Ámbar', badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60', dotClass: 'bg-amber-500' },
  { id: 'sky', name: 'Celeste', badgeClass: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60', dotClass: 'bg-sky-500' },
  { id: 'rose', name: 'Rosa', badgeClass: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60', dotClass: 'bg-rose-500' },
  { id: 'teal', name: 'Teal', badgeClass: 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60', dotClass: 'bg-teal-500' },
  { id: 'orange', name: 'Naranja', badgeClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60', dotClass: 'bg-orange-500' },
  { id: 'cyan', name: 'Cian', badgeClass: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/60', dotClass: 'bg-cyan-500' },
  { id: 'purple', name: 'Púrpura', badgeClass: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60', dotClass: 'bg-purple-500' },
  { id: 'fuchsia', name: 'Fucsia', badgeClass: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200/80 dark:border-fuchsia-800/60', dotClass: 'bg-fuchsia-500' },
  { id: 'lime', name: 'Lima', badgeClass: 'bg-lime-50 dark:bg-lime-950/50 text-lime-800 dark:text-lime-300 border border-lime-200/80 dark:border-lime-800/60', dotClass: 'bg-lime-600 dark:bg-lime-500' },
  { id: 'blue', name: 'Azul Real', badgeClass: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60', dotClass: 'bg-blue-500' },
  { id: 'pink', name: 'Magenta', badgeClass: 'bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/60', dotClass: 'bg-pink-500' },
  { id: 'green', name: 'Verde Bosque', badgeClass: 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200/80 dark:border-green-800/60', dotClass: 'bg-green-500' },
  { id: 'red', name: 'Rojo Carmín', badgeClass: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-800/60', dotClass: 'bg-red-500' },
  { id: 'yellow', name: 'Amarillo Mostaza', badgeClass: 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200/80 dark:border-yellow-800/60', dotClass: 'bg-yellow-500' },
  { id: 'slate', name: 'Pizarra', badgeClass: 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/60', dotClass: 'bg-slate-500' },
  { id: 'zinc', name: 'Zinc', badgeClass: 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-300/80 dark:border-zinc-700/60', dotClass: 'bg-zinc-500' },
  { id: 'stone', name: 'Piedra', badgeClass: 'bg-stone-100 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 border border-stone-300/80 dark:border-stone-700/60', dotClass: 'bg-stone-500' },
  { id: 'cobalt', name: 'Cobalto', badgeClass: 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700/60', dotClass: 'bg-blue-600' },
  { id: 'mint', name: 'Menta', badgeClass: 'bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60', dotClass: 'bg-emerald-600' },
  { id: 'ruby', name: 'Rubí', badgeClass: 'bg-rose-100/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60', dotClass: 'bg-rose-600' },
  { id: 'coral', name: 'Coral', badgeClass: 'bg-orange-100/70 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-700/60', dotClass: 'bg-orange-600' },
  { id: 'lavender', name: 'Lavanda', badgeClass: 'bg-purple-100/70 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/60', dotClass: 'bg-purple-600' },
  { id: 'ocean', name: 'Océano', badgeClass: 'bg-cyan-100/70 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700/60', dotClass: 'bg-cyan-600' },
  { id: 'bronze', name: 'Bronce', badgeClass: 'bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60', dotClass: 'bg-amber-600' },
  { id: 'aqua', name: 'Aqua', badgeClass: 'bg-teal-100/70 dark:bg-teal-900/40 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700/60', dotClass: 'bg-teal-600' },
  { id: 'plum', name: 'Ciruela', badgeClass: 'bg-fuchsia-100/70 dark:bg-fuchsia-900/40 text-fuchsia-900 dark:text-fuchsia-200 border border-fuchsia-300 dark:border-fuchsia-700/60', dotClass: 'bg-fuchsia-600' },
  { id: 'sage', name: 'Salvia', badgeClass: 'bg-green-100/70 dark:bg-green-900/40 text-green-900 dark:text-green-200 border border-green-300 dark:border-green-700/60', dotClass: 'bg-green-600' },
  { id: 'cerulean', name: 'Cerúleo', badgeClass: 'bg-sky-100/70 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700/60', dotClass: 'bg-sky-600' },
  { id: 'crimson', name: 'Carmesí', badgeClass: 'bg-red-100/70 dark:bg-red-900/40 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700/60', dotClass: 'bg-red-600' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAdvisorBadgeColor(
  assignedToId?: string | null,
  allAssignedIds?: string[]
): AssignmentColorStyle {
  if (!assignedToId) return CRM_ASSIGNMENT_PALETTE[0];
  if (allAssignedIds && allAssignedIds.length > 0) {
    const index = allAssignedIds.indexOf(assignedToId);
    if (index !== -1) return CRM_ASSIGNMENT_PALETTE[index % CRM_ASSIGNMENT_PALETTE.length];
  }
  return CRM_ASSIGNMENT_PALETTE[hashString(assignedToId) % CRM_ASSIGNMENT_PALETTE.length];
}
```

### 2.2 Catálogo Único de 18 Colores para Etiquetas (`src/lib/constants/crm-tag-colors.ts`)
```typescript
export interface CrmTagColorPreset {
  id: string;
  badgeClass: string;
  dotClass: string;
}

export const CRM_TAG_COLOR_PALETTE: CrmTagColorPreset[] = [
  { id: 'slate', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', dotClass: 'bg-slate-500' },
  { id: 'red', badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-200 dark:border-red-800', dotClass: 'bg-red-500' },
  { id: 'orange', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800', dotClass: 'bg-orange-500' },
  { id: 'amber', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800', dotClass: 'bg-amber-500' },
  { id: 'yellow', badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/70 dark:text-yellow-200 dark:border-yellow-800', dotClass: 'bg-yellow-500' },
  { id: 'lime', badgeClass: 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/70 dark:text-lime-200 dark:border-lime-800', dotClass: 'bg-lime-500' },
  { id: 'green', badgeClass: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/70 dark:text-green-200 dark:border-green-800', dotClass: 'bg-green-500' },
  { id: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800', dotClass: 'bg-emerald-500' },
  { id: 'teal', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-800', dotClass: 'bg-teal-500' },
  { id: 'cyan', badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-800', dotClass: 'bg-cyan-500' },
  { id: 'sky', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800', dotClass: 'bg-sky-500' },
  { id: 'blue', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800', dotClass: 'bg-blue-500' },
  { id: 'indigo', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800', dotClass: 'bg-indigo-500' },
  { id: 'violet', badgeClass: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-800', dotClass: 'bg-violet-500' },
  { id: 'purple', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800', dotClass: 'bg-purple-500' },
  { id: 'fuchsia', badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950/70 dark:text-fuchsia-200 dark:border-fuchsia-800', dotClass: 'bg-fuchsia-500' },
  { id: 'pink', badgeClass: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/70 dark:text-pink-200 dark:border-pink-800', dotClass: 'bg-pink-500' },
  { id: 'rose', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800', dotClass: 'bg-rose-500' },
];
```

---

## 3. Ingeniería Propia de Dropdowns en Portales Anti-Recorte (`z-[150]`) y Aislamiento de Eventos

### 3.1 Implementación Completa de `ChatFilterMultiSelect.tsx` (100% Tokens Semánticos + `PopoverPortal` `z-[150]`)
```tsx
// src/components/crm/chat-filter-multiselect.tsx
'use client';

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, Search, X } from 'lucide-react';

export interface MultiSelectItem {
  id: string;
  label: string;
  color?: string;
}

interface ChatFilterMultiSelectProps {
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
  items: MultiSelectItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClearAll?: () => void;
  onSelectAll?: () => void;
  isMobile?: boolean;
}

export function ChatFilterMultiSelect({
  placeholder,
  icon,
  items,
  selectedIds,
  onToggle,
  onClearAll,
  onSelectAll,
  isMobile = false,
}: ChatFilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const selectedCount = selectedIds.length;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  const triggerLabel = useMemo(() => {
    if (selectedCount === 0) return placeholder;
    if (selectedCount === 1) {
      const selectedItem = items.find((i) => i.id === selectedIds[0]);
      return selectedItem ? selectedItem.label : '1 seleccionado';
    }
    return `${selectedCount} seleccionados`;
  }, [selectedCount, items, selectedIds, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={`w-full flex items-center justify-between gap-2 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left shadow-2xs ${
            isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-2 text-xs'
          } ${
            selectedCount > 0
              ? 'bg-primary/15 border-primary/50 text-foreground font-medium'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
            <span className="truncate">{triggerLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCount > 0 && (
              <>
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {selectedCount}
                </span>
                {onClearAll && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Limpiar selección"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAll();
                    }}
                    className="p-0.5 rounded-full hover:bg-destructive/15 hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-crm-filter-popover="true"
        align="start"
        sideOffset={6}
        onEscapeKeyDown={(e) => {
          // CRÍTICO: cierra únicamente el sub-dropdown, jamás el panel o sheet padre
          e.stopPropagation();
        }}
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-2.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-[150]"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-xs">
          <span className="font-semibold text-foreground">{placeholder}</span>
          <div className="flex items-center gap-2">
            {onSelectAll && !isAllSelected && items.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAll();
                }}
                className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                Todos
              </button>
            )}
            {selectedCount > 0 && onClearAll && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {items.length > 5 && (
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-[16px] sm:text-xs bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-discreet">
          {filteredItems.length === 0 ? (
            <p className="text-center py-3 text-xs text-muted-foreground">No se encontraron opciones</p>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => onToggle(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      onToggle(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                    isSelected
                      ? 'bg-primary/15 text-foreground font-semibold'
                      : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {item.color ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium truncate max-w-[165px] ${item.color}`}>
                        {item.label}
                      </span>
                    ) : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 3.2 Guardián Anti-Cierre Fantasma en `ChatFilterPanel` (Desktop `z-50` / Mobile Portal `z-[100]`)
```typescript
// Hook obligatorio en cualquier panel padre o Bottom Sheet que anide PopoverPortals:
export function isClickInsideNestedCrmPortal(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest('[data-crm-filter-popover="true"]') ||
    el.closest('[data-radix-popper-content-wrapper]') ||
    el.closest('[data-radix-portal]') ||
    el.closest('[role="dialog"]') ||
    el.closest('[role="listbox"]')
  );
}
```
En móvil (`< 768px`), `ChatFilterPanel` se monta con `createPortal(..., document.body)` usando backdrop `fixed inset-0 z-[99] bg-black/60 backdrop-blur-xs` y contenedor `fixed inset-x-0 bottom-0 z-[100] max-h-[85dvh] rounded-t-2xl bg-popover border-t border-border p-4`, permitiendo que `ChatFilterMultiSelect` (`z-[150]`) se despliegue limpio encima de él.

---

## 4. Mapa Oficial Completo de Capas Z (`Z-Index Hierarchy`)

| Nivel `z-index` | Uso Exacto en el CRM | Justificación de Apilamiento |
| :--- | :--- | :--- |
| `z-10` – `z-20` | Cabeceras `sticky top-0` (`ChatHeader`, `DirectoryLayout`, barras de subtabs) | Se mantiene sobre el scroll de mensajes o tablas sin tapar menús. |
| `z-30` | FAB móvil *"Nuevo Chat"* en `ChatSidebar` y menú contextual `⋮` de `ChatHeader` | Flota sobre la lista de chats. |
| `z-40` | Popover inline **`+ Etiqueta`** en `ChatHeader` y `CrmRightPanel` fullscreen móvil | Supera al menú `⋮` (`z-30`) y al lienzo de mensajes. |
| `z-50` | Primitivas flotantes desktop (`SelectContent`, `DropdownMenuContent`, `PopoverContent`), `ChatFilterPanel` (desktop), `QuickRepliesPopup` (`/`), dropdown `@variable` | Estándar de menús flotantes sobre vistas de escritorio. |
| `z-[99]` | Backdrop oscuro (`bg-black/60`) de Bottom Sheets y Lightboxes en `createPortal` | Bloquea interacción con el workspace inferior. |
| `z-[100]` | Bottom Sheets móviles (`ChatFilterPanel` móvil, `PermissionsSheet`), `MarketingImageLightbox`, `MediaLightboxModal`, `ImageEditorModal`, modales de transferencia/reenvío | Cubre barras superiores e inferiores en `100dvh`. |
| `z-[150]` | **`ChatFilterMultiSelect` (`PopoverPortal`)** y notificaciones `Toaster` críticas | **Regla de Oro**: Debe ser `> 100` para desplegarse *encima* de cualquier Bottom Sheet o Modal `z-[100]`. |
| `z-[9999]` | Constructores Fullscreen en `createPortal` (`TemplateBuilderModal` con mockup de teléfono) | Capa suprema aislada sobre toda la aplicación. |

---

## 5. Utilidades Base de Sanitización Firestore y Compresión Cliente `.webp`

### 5.1 Sanitizador Recursivo `removeUndefined` (`src/lib/utils/sanitize-firestore.ts`)
Obligatorio antes de cualquier `setDoc`, `updateDoc` o `writeBatch`:
```typescript
export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date || typeof (obj as any).toMillis === 'function') return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefined(item)) as unknown as T;
  }
  // Preservar centinelas FieldValue de Firestore (serverTimestamp, increment, arrayUnion)
  if ((obj as any)._methodName || (obj as any).constructor?.name !== 'Object') {
    return obj;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val !== undefined) {
      cleaned[key] = removeUndefined(val);
    }
  }
  return cleaned as T;
}
```

### 5.2 Motor Cliente de Compresión a `.webp` (`src/lib/utils/webp-compressor.ts`)
Usado en subidas de Marketing, adjuntos de chat y salida de `ImageEditorModal` (ahorro de ~60–75% en Cloud Storage):
```typescript
export async function compressImageToWebp(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82 } = options;
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });

    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob) return file;

    const cleanBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return new File([blob], `${cleanBase}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(bitmapUrl); // Prevención estricta de fugas de memoria
  }
}
```

---

## 6. Matriz de Sanitización de Inputs e Idempotencia de Doble Capa

1. **Regex de Sanitización en Vivo**:
   - Atajos `/shortcut`: `val.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()`.
   - Nombres de Plantillas Meta WABA: `val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`.
   - Teléfonos / Whitelist: `val.replace(/\D/g, '')` normalizado con `defaultCountryCode`.
   - Categorías: `Array.from(new Set(list.map((c) => c.trim()).filter(Boolean)))`.
2. **Idempotencia Cliente + Servidor**:
   - **Mensajes Optimistas**: Pre-generar `const msgRef = doc(collection(firestore, ...))` y usar `msgRef.id` como clave de la burbuja optimista para que `onSnapshot` reconcilie en sitio sin duplicar.
   - **Configuración IA (`SettingsBot`)**: `isDirty = serializeComparableConfig(draft) !== savedSnapshot` bloquea guardados redundantes.
   - **Locks por Fila**: `updatingUserId`, `deletingId`, `isBatchDeleting`, `isTriggering` impiden condiciones de carrera por doble clic.
   - **Servidor**: `crm_webhook_log/{dedupKey}.create()` (`code === 6`), `runTransaction` en `lastAssignedIndex` Round-Robin y ventana anti-ráfaga en bienvenida IA.


---

## 7. Paleta de 18 Etiquetas WCAG AAA Purge-Proof en `src/app/globals.css` y Helper Zero-Migration (`crm-tag-colors.ts`)

Cuando las clases de color de etiquetas se guardan como strings dinámicos en Firestore (`crm_tags.color`), el compilador JIT de Tailwind puede purgar variantes `dark:bg-*-900/40` no referenciadas estáticamente, provocando etiquetas ilegibles en modo oscuro o claro. Para garantizar **contraste WCAG AAA (`>= 7.97:1` en Light y `>= 10.47:1` en Dark)** e inmunidad total al purge:

### 7.1 Reglas Semánticas `.crm-tag-{hue}` y `.crm-tag-dot-{hue}` en `src/app/globals.css`
```css
/* ============================================================================
 * ETIQUETAS CRM — 18 TONOS WCAG AAA (LIGHT >= 7.97:1 / DARK >= 10.47:1)
 * Inmunes al purge JIT de Tailwind cuando el string viene desde Firestore
 * ============================================================================ */
.crm-tag-slate   { background-color: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
.crm-tag-red     { background-color: #ffe4e6; color: #7f1d1d; border-color: #f87171; }
.crm-tag-orange  { background-color: #ffedd5; color: #7c2d12; border-color: #fb923c; }
.crm-tag-amber   { background-color: #fef3c7; color: #78350f; border-color: #f59e0b; }
.crm-tag-yellow  { background-color: #fef9c3; color: #713f12; border-color: #eab308; }
.crm-tag-lime    { background-color: #ecfccb; color: #365314; border-color: #84cc16; }
.crm-tag-green   { background-color: #dcfce7; color: #14532d; border-color: #4ade80; }
.crm-tag-emerald { background-color: #d1fae5; color: #064e3b; border-color: #34d399; }
.crm-tag-teal    { background-color: #ccfbf1; color: #134e4a; border-color: #2dd4bf; }
.crm-tag-cyan    { background-color: #cffafe; color: #164e63; border-color: #22d3ee; }
.crm-tag-sky     { background-color: #e0f2fe; color: #0c4a6e; border-color: #38bdf8; }
.crm-tag-blue    { background-color: #dbeafe; color: #1e3a8a; border-color: #60a5fa; }
.crm-tag-indigo  { background-color: #e0e7ff; color: #1e1b4b; border-color: #818cf8; }
.crm-tag-violet  { background-color: #ede9fe; color: #2e1065; border-color: #a78bfa; }
.crm-tag-purple  { background-color: #f3e8ff; color: #3b0764; border-color: #c084fc; }
.crm-tag-fuchsia { background-color: #fae8ff; color: #4a044e; border-color: #e879f9; }
.crm-tag-pink    { background-color: #fce7f3; color: #500724; border-color: #f472b6; }
.crm-tag-rose    { background-color: #ffe4e6; color: #4c0519; border-color: #fb7185; }

.dark .crm-tag-slate   { background-color: #1e293b; color: #f8fafc; border-color: #64748b; }
.dark .crm-tag-red     { background-color: #450a0a; color: #fecaca; border-color: #f87171; }
.dark .crm-tag-orange  { background-color: #431407; color: #fed7aa; border-color: #fb923c; }
.dark .crm-tag-amber   { background-color: #451a03; color: #fde68a; border-color: #fbbf24; }
.dark .crm-tag-yellow  { background-color: #422006; color: #fef08a; border-color: #facc15; }
.dark .crm-tag-lime    { background-color: #1a2e05; color: #d9f99d; border-color: #a3e635; }
.dark .crm-tag-green   { background-color: #052e16; color: #bbf7d0; border-color: #4ade80; }
.dark .crm-tag-emerald { background-color: #022c22; color: #a7f3d0; border-color: #34d399; }
.dark .crm-tag-teal    { background-color: #042f2e; color: #99f6e4; border-color: #2dd4bf; }
.dark .crm-tag-cyan    { background-color: #083344; color: #a5f3fc; border-color: #22d3ee; }
.dark .crm-tag-sky     { background-color: #082f49; color: #bae6fd; border-color: #38bdf8; }
.dark .crm-tag-blue    { background-color: #172554; color: #bfdbfe; border-color: #60a5fa; }
.dark .crm-tag-indigo  { background-color: #1e1b4b; color: #c7d2fe; border-color: #818cf8; }
.dark .crm-tag-violet  { background-color: #2e1065; color: #ddd6fe; border-color: #a78bfa; }
.dark .crm-tag-purple  { background-color: #3b0764; color: #e9d5ff; border-color: #c084fc; }
.dark .crm-tag-fuchsia { background-color: #4a044e; color: #f5d0fe; border-color: #e879f9; }
.dark .crm-tag-pink    { background-color: #500724; color: #fbcfe8; border-color: #f472b6; }
.dark .crm-tag-rose    { background-color: #4c0519; color: #fecdd3; border-color: #fb7185; }

.crm-tag-dot-slate   { background-color: #64748b; }
.crm-tag-dot-red     { background-color: #ef4444; }
.crm-tag-dot-orange  { background-color: #f97316; }
.crm-tag-dot-amber   { background-color: #f59e0b; }
.crm-tag-dot-yellow  { background-color: #eab308; }
.crm-tag-dot-lime    { background-color: #84cc16; }
.crm-tag-dot-green   { background-color: #22c55e; }
.crm-tag-dot-emerald { background-color: #10b981; }
.crm-tag-dot-teal    { background-color: #14b8a6; }
.crm-tag-dot-cyan    { background-color: #06b6d4; }
.crm-tag-dot-sky     { background-color: #0ea5e9; }
.crm-tag-dot-blue    { background-color: #3b82f6; }
.crm-tag-dot-indigo  { background-color: #6366f1; }
.crm-tag-dot-violet  { background-color: #8b5cf6; }
.crm-tag-dot-purple  { background-color: #a855f7; }
.crm-tag-dot-fuchsia { background-color: #d946ef; }
.crm-tag-dot-pink    { background-color: #ec4899; }
.crm-tag-dot-rose    { background-color: #f43f5e; }
```

### 7.2 Catálogo y Resolutor Zero-Migration (`src/lib/constants/crm-tag-colors.ts`)
Convierte en tiempo de lectura cualquier clase heredada (`bg-blue-100 text-blue-700...`) o nombre de tono en su clase `.crm-tag-{hue}` correspondiente sin requerir scripts de migración en Firestore:

```typescript
// src/lib/constants/crm-tag-colors.ts
export type CrmTagHue =
  | 'slate' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime'
  | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue'
  | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';

export interface CrmTagColorOption {
  hue: CrmTagHue;
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const CRM_TAG_COLOR_OPTIONS: CrmTagColorOption[] = [
  { hue: 'slate',   label: 'Gris Pizarra', badgeClass: 'crm-tag-slate',   dotClass: 'crm-tag-dot-slate' },
  { hue: 'red',     label: 'Rojo',         badgeClass: 'crm-tag-red',     dotClass: 'crm-tag-dot-red' },
  { hue: 'orange',  label: 'Naranja',      badgeClass: 'crm-tag-orange',  dotClass: 'crm-tag-dot-orange' },
  { hue: 'amber',   label: 'Ámbar',        badgeClass: 'crm-tag-amber',   dotClass: 'crm-tag-dot-amber' },
  { hue: 'yellow',  label: 'Amarillo',     badgeClass: 'crm-tag-yellow',  dotClass: 'crm-tag-dot-yellow' },
  { hue: 'lime',    label: 'Lima',         badgeClass: 'crm-tag-lime',    dotClass: 'crm-tag-dot-lime' },
  { hue: 'green',   label: 'Verde',        badgeClass: 'crm-tag-green',   dotClass: 'crm-tag-dot-green' },
  { hue: 'emerald', label: 'Esmeralda',    badgeClass: 'crm-tag-emerald', dotClass: 'crm-tag-dot-emerald' },
  { hue: 'teal',    label: 'Turquesa',     badgeClass: 'crm-tag-teal',    dotClass: 'crm-tag-dot-teal' },
  { hue: 'cyan',    label: 'Cian',         badgeClass: 'crm-tag-cyan',    dotClass: 'crm-tag-dot-cyan' },
  { hue: 'sky',     label: 'Celeste',      badgeClass: 'crm-tag-sky',     dotClass: 'crm-tag-dot-sky' },
  { hue: 'blue',    label: 'Azul',         badgeClass: 'crm-tag-blue',    dotClass: 'crm-tag-dot-blue' },
  { hue: 'indigo',  label: 'Índigo',       badgeClass: 'crm-tag-indigo',  dotClass: 'crm-tag-dot-indigo' },
  { hue: 'violet',  label: 'Violeta',      badgeClass: 'crm-tag-violet',  dotClass: 'crm-tag-dot-violet' },
  { hue: 'purple',  label: 'Púrpura',      badgeClass: 'crm-tag-purple',  dotClass: 'crm-tag-dot-purple' },
  { hue: 'fuchsia', label: 'Fucsia',       badgeClass: 'crm-tag-fuchsia', dotClass: 'crm-tag-dot-fuchsia' },
  { hue: 'pink',    label: 'Rosa',         badgeClass: 'crm-tag-pink',    dotClass: 'crm-tag-dot-pink' },
  { hue: 'rose',    label: 'Coral',        badgeClass: 'crm-tag-rose',    dotClass: 'crm-tag-dot-rose' },
];

const HUE_MAP = new Map<CrmTagHue, CrmTagColorOption>(
  CRM_TAG_COLOR_OPTIONS.map((opt) => [opt.hue, opt])
);

export function resolveTagHue(rawColor?: string | null): CrmTagHue {
  if (!rawColor) return 'blue';
  const normalized = rawColor.toLowerCase();
  for (const opt of CRM_TAG_COLOR_OPTIONS) {
    if (normalized.includes(opt.hue)) return opt.hue;
  }
  if (normalized.includes('gray') || normalized.includes('zinc') || normalized.includes('neutral')) {
    return 'slate';
  }
  return 'blue';
}

export function resolveTagColorClass(rawColor?: string | null): string {
  const hue = resolveTagHue(rawColor);
  return HUE_MAP.get(hue)?.badgeClass ?? 'crm-tag-blue';
}

export function resolveTagDotClass(rawColor?: string | null): string {
  const hue = resolveTagHue(rawColor);
  return HUE_MAP.get(hue)?.dotClass ?? 'crm-tag-dot-blue';
}
```

---

## 8. Blindaje contra Minificación SWC en `removeUndefined()` y Bypass Workbox PWA

### 8.1 `isPlainPojo()` + `removeUndefined()` Resistente a Minificación SWC (`src/lib/utils.ts`)
En builds de producción de Next.js, el minificador SWC renombra `val.constructor.name` (ej. `FieldValue` → `t`, `Timestamp` → `r`). Si `removeUndefined` solo comprueba `constructor?.name !== 'Object'`, tratará los objetos `FieldValue.serverTimestamp()` o `Timestamp` como objetos planos o los vaciará a `{}`. Es **obligatorio** usar `Object.getPrototypeOf(val) === Object.prototype` combinado con *duck-typing* de métodos internos del SDK:

```typescript
// src/lib/utils.ts
export function isPlainPojo(val: unknown): val is Record<string, unknown> {
  if (typeof val !== 'object' || val === null) return false;
  if (Array.isArray(val) || val instanceof Date || val instanceof RegExp) return false;

  const v = val as Record<string, unknown>;
  // Preservar centinelas de Firestore Client SDK y Firebase Admin SDK aunque SWC minifique las clases
  if (
    typeof v.toDate === 'function' ||
    typeof v.toMillis === 'function' ||
    typeof v.isEqual === 'function' ||
    typeof v._toFieldTransform === 'function' ||
    typeof v.toProto === 'function' ||
    typeof v._toProto === 'function' ||
    typeof v._methodName === 'string'
  ) {
    return false;
  }

  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((v) => v !== undefined)
      .map((v) => (isPlainPojo(v) || Array.isArray(v) ? removeUndefined(v) : v)) as unknown as T;
  }
  if (!isPlainPojo(obj)) {
    return obj;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = isPlainPojo(value) || Array.isArray(value) ? removeUndefined(value) : value;
    }
  }
  return result as T;
}
```

### 8.2 Bypass Explícito de Service Worker / Workbox (`next.config.ts`)
Workbox serializa las funciones `urlPattern` con `Function.prototype.toString()`. Nunca referencies variables externas fuera del callback `urlPattern`, y excluye siempre los endpoints de Firebase, Auth y `/api/crm/*` para impedir respuestas cacheadas obsoletas o bloqueos de streams gRPC:

```typescript
// Fragmento obligatorio para runtimeCaching en next.config.ts (next-pwa / Workbox)
const runtimeCaching = [
  {
    urlPattern: ({ url }: { url: URL }) => {
      const host = url.hostname;
      const path = url.pathname;
      if (
        host.includes('firestore.googleapis.com') ||
        host.includes('identitytoolkit.googleapis.com') ||
        host.includes('securetoken.googleapis.com') ||
        host.includes('firebasestorage.googleapis.com') ||
        host.endsWith('.firebaseio.com') ||
        host.endsWith('.cloudfunctions.net') ||
        host.endsWith('.run.app')
      ) {
        return true;
      }
      return path.startsWith('/api/auth/') || path.startsWith('/api/crm/');
    },
    handler: 'NetworkOnly' as const,
  },
];
```

---

## 9. Motor de Iconografía Bespoke (`<AppIcon />` con `@phosphor-icons/react`) & Estándar Anti-Genérico

Para eliminar la estética genérica de IA asociada al uso uniforme de `lucide-react` plano en toda la UI, todo proyecto v5.0 adopta **`@phosphor-icons/react`** (estilo `duotone` para íconos de navegación/tarjetas/estados vacíos y `regular` o `bold` para acciones compactas de 14–16 px), complementado dinámicamente por los tokens `--primary`, `--secondary` y `--tertiary` explicados en [Blueprint 09](./09-global-banners-theming-and-help-copilot.md).

### 9.1 Componente Canónico `src/components/ui/app-icon.tsx`

```tsx
'use client';

import React from 'react';
import {
  ArrowLeft,
  Bell,
  Buildings,
  CalendarCheck,
  CaretRight,
  ChatCircleDots,
  Check,
  Copy,
  CreditCard,
  FileText,
  GlobeHemisphereWest,
  ImageSquare,
  Key,
  Lightning,
  Palette,
  PaperPlaneTilt,
  Plus,
  Receipt,
  Robot,
  ShieldWarning,
  SlidersHorizontal,
  Sparkle,
  SpinnerGap,
  Tag,
  Trash,
  UsersThree,
  WarningCircle,
  type IconProps,
  type IconWeight,
} from '@phosphor-icons/react';

export type AppIconName =
  | 'chats'
  | 'bot'
  | 'ai'
  | 'directory'
  | 'scheduling'
  | 'pos'
  | 'metrics'
  | 'settings'
  | 'credentials'
  | 'branding'
  | 'roles'
  | 'templates'
  | 'autoAssign'
  | 'marketing'
  | 'quickReplies'
  | 'tags'
  | 'globe'
  | 'bell'
  | 'copy'
  | 'check'
  | 'arrowLeft'
  | 'chevronRight'
  | 'shieldAlert'
  | 'spinner'
  | 'plus'
  | 'fiscal'
  | 'trash'
  | 'send'
  | 'warning';

const PHOSPHOR_MAP = {
  chats: ChatCircleDots,
  bot: Robot,
  ai: Sparkle,
  directory: Buildings,
  scheduling: CalendarCheck,
  pos: CreditCard,
  metrics: Lightning,
  settings: SlidersHorizontal,
  credentials: Key,
  branding: Palette,
  roles: UsersThree,
  templates: FileText,
  autoAssign: SlidersHorizontal,
  marketing: ImageSquare,
  quickReplies: ChatCircleDots,
  tags: Tag,
  globe: GlobeHemisphereWest,
  bell: Bell,
  copy: Copy,
  check: Check,
  arrowLeft: ArrowLeft,
  chevronRight: CaretRight,
  shieldAlert: ShieldWarning,
  spinner: SpinnerGap,
  plus: Plus,
  trash: Trash,
  send: PaperPlaneTilt,
  warning: WarningCircle,
  fiscal: Receipt,
} as const;

/** Compatibilidad hacia atrás para nombres legados almacenados en Firestore (operationalDivisions/templates) */
export const LEGACY_LUCIDE_ALIASES: Record<string, AppIconName> = {
  MessageSquare: 'chats',
  Bot: 'bot',
  Sparkles: 'ai',
  Briefcase: 'directory',
  Building2: 'directory',
  CalendarClock: 'scheduling',
  CreditCard: 'pos',
  Settings: 'settings',
  KeyRound: 'credentials',
  Palette: 'branding',
  Users: 'roles',
  FileText: 'templates',
  ImageIcon: 'marketing',
  Image: 'marketing',
  Tag: 'tags',
  Globe: 'globe',
  ShieldAlert: 'shieldAlert',
  Receipt: 'fiscal',
};

export interface AppIconProps extends Omit<IconProps, 'weight'> {
  name: AppIconName | string;
  weight?: IconWeight;
}

export function AppIcon({ name, weight = 'duotone', className, ...rest }: AppIconProps) {
  const normalized = (LEGACY_LUCIDE_ALIASES[name] ?? name) as AppIconName;
  const IconComp = PHOSPHOR_MAP[normalized] ?? WarningCircle;
  return <IconComp weight={weight} className={className} {...rest} />;
}
```

> **Nota para los Blueprints 02–06**: Aunque dichos blueprints muestran ejemplos con `lucide-react` por compatibilidad histórica con repos existentes, toda pantalla nueva o refactorizada **DEBE** usar `<AppIcon />` (`@phosphor-icons/react`) o resolver nombres guardados en Firestore vía `LEGACY_LUCIDE_ALIASES`.
