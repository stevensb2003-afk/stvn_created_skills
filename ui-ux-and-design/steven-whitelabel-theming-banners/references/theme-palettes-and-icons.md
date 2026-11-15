# Motor de Temas en Vivo desde Frontend (`--primary`/`--secondary`/`--tertiary`), Zero-FOUC y Sistema Anti-IA `@phosphor-icons/react`

---

## 1. Contrato Maestro CSS + Tailwind (`globals.css` & `tailwind.config.ts`)

Todo componente `.tsx` usa **únicamente** clases semánticas (`bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-background`, `bg-card`). El sistema permite que un cliente elija un tema desde el Frontend y modifique estas variables CSS en tiempo real sin recompilar.

### Extensión en `tailwind.config.ts`
```typescript
colors: {
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
  // ...background, foreground, card, popover, muted, accent, destructive, border, input, ring
}
```

---

## 2. Catálogo de 8 Paletas Calibradas WCAG AA/AAA (`src/lib/constants/theme-palettes.ts`)

```typescript
export interface ThemeTokenSet {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  tertiary: string;
  tertiaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  background?: string;
  card?: string;
}

export interface ThemePalettePreset {
  id: string;
  name: string;
  description: string;
  swatches: [string, string, string]; // Vista previa rápida [primary, secondary, tertiary]
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
  radius: string;
}

export const THEME_PALETTES: ThemePalettePreset[] = [
  {
    id: 'sky-slate',
    name: 'Sky Slate Signature',
    description: 'Azul cielo nítido con pizarra oscura de alto contraste.',
    swatches: ['#4EC0EE', '#E2E8F0', '#0F766E'],
    radius: '0.65rem',
    light: {
      primary: '197 71% 52%',
      primaryForeground: '222 84% 5%',
      secondary: '210 40% 94%',
      secondaryForeground: '215 25% 18%',
      tertiary: '174 72% 34%',
      tertiaryForeground: '0 0% 100%',
      accent: '207 44% 92%',
      accentForeground: '222 84% 5%',
      ring: '197 71% 52%',
    },
    dark: {
      primary: '197 71% 70%',
      primaryForeground: '222 84% 5%',
      secondary: '217 33% 20%',
      secondaryForeground: '210 40% 98%',
      tertiary: '172 66% 50%',
      tertiaryForeground: '222 84% 5%',
      accent: '211 29% 32%',
      accentForeground: '210 40% 98%',
      ring: '197 71% 70%',
    },
  },
  {
    id: 'emerald-executive',
    name: 'Emerald Executive',
    description: 'Verde esmeralda corporativo con acentos ámbar cálidos.',
    swatches: ['#059669', '#ECFDF5', '#D97706'],
    radius: '0.65rem',
    light: {
      primary: '160 84% 32%',
      primaryForeground: '0 0% 100%',
      secondary: '152 40% 94%',
      secondaryForeground: '160 50% 14%',
      tertiary: '32 95% 44%',
      tertiaryForeground: '0 0% 100%',
      accent: '154 45% 91%',
      accentForeground: '160 60% 12%',
      ring: '160 84% 32%',
    },
    dark: {
      primary: '158 64% 52%',
      primaryForeground: '160 80% 7%',
      secondary: '164 28% 18%',
      secondaryForeground: '152 40% 96%',
      tertiary: '38 92% 55%',
      tertiaryForeground: '24 80% 8%',
      accent: '162 25% 24%',
      accentForeground: '152 40% 98%',
      ring: '158 64% 52%',
    },
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    description: 'Índigo arquitectónico con cian técnico terciario.',
    swatches: ['#4F46E5', '#EEF2FF', '#0891B2'],
    radius: '0.75rem',
    light: {
      primary: '243 75% 54%',
      primaryForeground: '0 0% 100%',
      secondary: '234 60% 95%',
      secondaryForeground: '243 47% 20%',
      tertiary: '192 91% 36%',
      tertiaryForeground: '0 0% 100%',
      accent: '236 52% 92%',
      accentForeground: '243 50% 18%',
      ring: '243 75% 54%',
    },
    dark: {
      primary: '238 84% 70%',
      primaryForeground: '243 60% 9%',
      secondary: '240 28% 20%',
      secondaryForeground: '234 60% 97%',
      tertiary: '190 80% 54%',
      tertiaryForeground: '196 80% 7%',
      accent: '240 25% 26%',
      accentForeground: '234 60% 98%',
      ring: '238 84% 70%',
    },
  },
  {
    id: 'terracotta-editorial',
    name: 'Warm Terracotta',
    description: 'Terracota cálido estilo estudio con oliva profundo.',
    swatches: ['#C2410C', '#FFF7ED', '#4D7C0F'],
    radius: '0.5rem',
    light: {
      primary: '17 88% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '33 100% 94%',
      secondaryForeground: '20 60% 16%',
      tertiary: '84 78% 28%',
      tertiaryForeground: '0 0% 100%',
      accent: '28 70% 91%',
      accentForeground: '17 70% 15%',
      ring: '17 88% 40%',
    },
    dark: {
      primary: '20 90% 60%',
      primaryForeground: '20 80% 8%',
      secondary: '24 22% 18%',
      secondaryForeground: '33 60% 95%',
      tertiary: '84 62% 52%',
      tertiaryForeground: '84 80% 7%',
      accent: '24 22% 24%',
      accentForeground: '33 60% 97%',
      ring: '20 90% 60%',
    },
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Luxe',
    description: 'Carbón sobrio con acentos dorado bronce y azul acero.',
    swatches: ['#18181B', '#F4F4F5', '#B45309'],
    radius: '0.5rem',
    light: {
      primary: '240 6% 14%',
      primaryForeground: '0 0% 98%',
      secondary: '240 5% 93%',
      secondaryForeground: '240 6% 14%',
      tertiary: '32 95% 37%',
      tertiaryForeground: '0 0% 100%',
      accent: '240 5% 89%',
      accentForeground: '240 6% 14%',
      ring: '32 95% 37%',
    },
    dark: {
      primary: '43 85% 58%',
      primaryForeground: '240 10% 8%',
      secondary: '240 6% 18%',
      secondaryForeground: '0 0% 96%',
      tertiary: '210 60% 62%',
      tertiaryForeground: '240 10% 8%',
      accent: '240 6% 24%',
      accentForeground: '0 0% 98%',
      ring: '43 85% 58%',
    },
  },
  {
    id: 'ocean-teal',
    name: 'Nordic Ocean Teal',
    description: 'Turquesa marino sereno y limpio para equipos de soporte.',
    swatches: ['#0D9488', '#F0FDFA', '#2563EB'],
    radius: '0.75rem',
    light: {
      primary: '175 84% 32%',
      primaryForeground: '0 0% 100%',
      secondary: '166 76% 94%',
      secondaryForeground: '175 70% 14%',
      tertiary: '221 83% 53%',
      tertiaryForeground: '0 0% 100%',
      accent: '170 60% 90%',
      accentForeground: '175 75% 14%',
      ring: '175 84% 32%',
    },
    dark: {
      primary: '172 66% 52%',
      primaryForeground: '175 85% 7%',
      secondary: '178 28% 18%',
      secondaryForeground: '166 60% 95%',
      tertiary: '217 91% 66%',
      tertiaryForeground: '222 84% 6%',
      accent: '178 24% 24%',
      accentForeground: '166 60% 97%',
      ring: '172 66% 52%',
    },
  },
  {
    id: 'violet-graphite',
    name: 'Modern Violet',
    description: 'Violeta profundo con contraste esmeralda para SaaS creativos.',
    swatches: ['#7C3AED', '#F5F3FF', '#10B981'],
    radius: '0.85rem',
    light: {
      primary: '262 83% 54%',
      primaryForeground: '0 0% 100%',
      secondary: '250 100% 96%',
      secondaryForeground: '262 55% 22%',
      tertiary: '160 84% 35%',
      tertiaryForeground: '0 0% 100%',
      accent: '255 75% 93%',
      accentForeground: '262 60% 20%',
      ring: '262 83% 54%',
    },
    dark: {
      primary: '262 90% 72%',
      primaryForeground: '262 75% 8%',
      secondary: '262 28% 20%',
      secondaryForeground: '250 80% 97%',
      tertiary: '158 64% 52%',
      tertiaryForeground: '160 85% 7%',
      accent: '262 25% 26%',
      accentForeground: '250 80% 98%',
      ring: '262 90% 72%',
    },
  },
  {
    id: 'crimson-studio',
    name: 'Crimson Studio',
    description: 'Carmesí editorial con pizarra neutral y azul petróleo.',
    swatches: ['#BE123C', '#FFF1F2', '#0369A1'],
    radius: '0.5rem',
    light: {
      primary: '345 83% 41%',
      primaryForeground: '0 0% 100%',
      secondary: '350 100% 95%',
      secondaryForeground: '345 65% 18%',
      tertiary: '201 96% 32%',
      tertiaryForeground: '0 0% 100%',
      accent: '348 80% 92%',
      accentForeground: '345 70% 16%',
      ring: '345 83% 41%',
    },
    dark: {
      primary: '345 82% 65%',
      primaryForeground: '345 80% 8%',
      secondary: '345 26% 19%',
      secondaryForeground: '350 70% 96%',
      tertiary: '199 89% 58%',
      tertiaryForeground: '201 85% 7%',
      accent: '345 24% 25%',
      accentForeground: '350 70% 98%',
      ring: '345 82% 65%',
    },
  },
];

export function hexToHslTuple(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '197 71% 52%';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function getAccessibleForegroundHsl(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '0 0% 100%';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.54 ? '222 84% 5%' : '0 0% 100%';
}
```

---

## 3. Inyector en Vivo + Script Anti-Parpadeo Zero-FOUC

Guarda la configuración en Firestore `crm_settings/branding` (`allow read: if true;` porque no contiene secretos y así el `/login` también muestra el logo y tema del cliente).

```tsx
// src/components/branding/ThemeInjectorProvider.tsx
'use client';

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase/client';
import {
  THEME_PALETTES,
  hexToHslTuple,
  getAccessibleForegroundHsl,
} from '@/lib/constants/theme-palettes';

export interface BrandingConfigDoc {
  businessName: string;
  logoUrl?: string;
  faviconUrl?: string;
  paletteId: string; // 'custom' o uno de THEME_PALETTES[].id
  customColors?: {
    primaryHex: string;
    secondaryHex: string;
    tertiaryHex: string;
  };
  radius?: string;
}

export function applyBrandingCssVariables(cfg: BrandingConfigDoc, isDark: boolean) {
  const root = document.documentElement;
  if (cfg.paletteId === 'custom' && cfg.customColors) {
    root.style.setProperty('--primary', hexToHslTuple(cfg.customColors.primaryHex));
    root.style.setProperty('--primary-foreground', getAccessibleForegroundHsl(cfg.customColors.primaryHex));
    root.style.setProperty('--secondary', hexToHslTuple(cfg.customColors.secondaryHex));
    root.style.setProperty('--secondary-foreground', getAccessibleForegroundHsl(cfg.customColors.secondaryHex));
    root.style.setProperty('--tertiary', hexToHslTuple(cfg.customColors.tertiaryHex));
    root.style.setProperty('--tertiary-foreground', getAccessibleForegroundHsl(cfg.customColors.tertiaryHex));
    root.style.setProperty('--ring', hexToHslTuple(cfg.customColors.primaryHex));
  } else {
    const preset = THEME_PALETTES.find((p) => p.id === cfg.paletteId) || THEME_PALETTES[0];
    const tokens = isDark ? preset.dark : preset.light;
    root.style.setProperty('--primary', tokens.primary);
    root.style.setProperty('--primary-foreground', tokens.primaryForeground);
    root.style.setProperty('--secondary', tokens.secondary);
    root.style.setProperty('--secondary-foreground', tokens.secondaryForeground);
    root.style.setProperty('--tertiary', tokens.tertiary);
    root.style.setProperty('--tertiary-foreground', tokens.tertiaryForeground);
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--accent-foreground', tokens.accentForeground);
    root.style.setProperty('--ring', tokens.ring);
    root.style.setProperty('--radius', cfg.radius || preset.radius);
  }
}

export function ThemeInjectorProvider() {
  const firestore = useFirestore();

  useEffect(() => {
    const cached = localStorage.getItem('crm_branding_cache');
    const isDark = document.documentElement.classList.contains('dark');
    if (cached) {
      try {
        applyBrandingCssVariables(JSON.parse(cached), isDark);
      } catch {
        // Ignorar caché corrupto
      }
    }

    if (!firestore) return;
    const unsub = onSnapshot(doc(firestore, 'crm_settings', 'branding'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as BrandingConfigDoc;
      localStorage.setItem('crm_branding_cache', JSON.stringify(data));
      const darkNow = document.documentElement.classList.contains('dark');
      applyBrandingCssVariables(data, darkNow);
      if (data.businessName) document.title = data.businessName;
    });

    return () => unsub();
  }, [firestore]);

  return null;
}
```

---

## 4. Sistema de Íconos Anti-IA (`@phosphor-icons/react` + `<AppIcon />`)

Para romper la estética genérica de trazo fino uniforme (`lucide-react`), estandariza todos los íconos en **`@phosphor-icons/react`**:
- Usa peso **`duotone`** en navegación lateral, tarjetas KPI, encabezados de configuración y estados vacíos.
- Usa peso **`regular`** o **`bold`** en botones de toolbar densa y acciones de chat.
- Usa peso **`fill`** en estados activos o badges de canal.

```tsx
// src/components/ui/app-icon.tsx
'use client';

import React from 'react';
import {
  Robot,
  ChatsCircle,
  UsersThree,
  GearSix,
  Tag,
  Megaphone,
  Lightning,
  Truck,
  CalendarCheck,
  Storefront,
  ChartLineUp,
  Sparkle,
  Palette,
  ShieldCheck,
  PaperPlaneTilt,
  BellRinging,
  EnvelopeSimple,
  BookOpenText,
  Key,
  WarningCircle,
  type IconProps,
} from '@phosphor-icons/react';

export const APP_ICONS = {
  Robot,
  ChatsCircle,
  UsersThree,
  GearSix,
  Tag,
  Megaphone,
  Lightning,
  Truck,
  CalendarCheck,
  Storefront,
  ChartLineUp,
  Sparkle,
  Palette,
  ShieldCheck,
  PaperPlaneTilt,
  BellRinging,
  EnvelopeSimple,
  BookOpenText,
  Key,
  WarningCircle,
} as const;

export type AppIconName = keyof typeof APP_ICONS;

// Compatibilidad automática con nombres Lucide guardados en Firestore
const LEGACY_LUCIDE_ALIASES: Record<string, AppIconName> = {
  Bot: 'Robot',
  MessageSquare: 'ChatsCircle',
  Users: 'UsersThree',
  Settings: 'GearSix',
  Zap: 'Lightning',
  KeyRound: 'Key',
  Image: 'Sparkle',
  ShieldAlert: 'WarningCircle',
};

export interface AppIconProps extends Omit<IconProps, 'ref'> {
  name: string;
  variant?: 'duotone' | 'regular' | 'bold' | 'fill';
}

export function AppIcon({ name, variant = 'duotone', size = 18, className, ...rest }: AppIconProps) {
  const resolvedName = (LEGACY_LUCIDE_ALIASES[name] || name) as AppIconName;
  const Component = APP_ICONS[resolvedName] || Sparkle;
  return <Component weight={variant} size={size} className={className} {...rest} />;
}
```
