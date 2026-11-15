# Recetas de Movimiento CSS, Motion (React/TS) y Microinteracciones Optimistas

Código ejecutable y tokens listos para producción correspondientes a `steven-ui-motion-and-interaction-engineering`.

---

## 1. Tokens Globales CSS de Movimiento + `prefers-reduced-motion`

```css
:root {
  --ease-ui-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-ui-inout: cubic-bezier(0.65, 0, 0.35, 1);

  --dur-tap: 140ms;
  --dur-exit: 180ms;       /* ~20% más corto que entrada */
  --dur-enter: 230ms;
  --dur-move: 280ms;
  --stagger-step: 35ms;    /* Limitar máximo visible a 6 pasos (< 250ms total) */
}

/* Popover origin-aware: el componente fija style={{ transformOrigin }} desde el trigger */
.ui-popover {
  transition:
    transform var(--dur-enter) var(--ease-ui-out),
    opacity var(--dur-enter) var(--ease-ui-out);
  transform: scale(0.95);
  opacity: 0;
}

.ui-popover[data-state="open"] {
  transform: scale(1);
  opacity: 1;
}

.ui-popover[data-state="closed"] {
  transition-duration: var(--dur-exit);
}

/* Press feedback táctil universal */
.ui-pressable {
  transition: transform var(--dur-tap) var(--ease-ui-out);
}
.ui-pressable:active {
  transform: scale(0.97);
}

/* Rechazo físico por error de validación */
@keyframes ui-reject-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-4px); }
}
.ui-shake {
  animation: ui-reject-shake 240ms var(--ease-ui-out) 1;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 2. Configuraciones Exactas de Springs (Motion / Framer Motion)

```ts
import type { Transition } from "motion/react";

export const MOTION_SPRINGS = {
  /** UI diaria (modales, drawers, list reorder): amortiguamiento crítico, sin rebote molesto */
  everyday: {
    type: "spring",
    stiffness: 420,
    damping: 34,
    mass: 0.85,
  } satisfies Transition,

  /** Shared element FLIP (`layoutId`) */
  sharedElement: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.9,
  } satisfies Transition,

  /** Microinteracción social (Like, Star): único uso intencional de overshoot elástico */
  delightOvershoot: {
    duration: 0.34,
    times: [0, 0.25, 0.65, 1],
    ease: [0.22, 1, 0.36, 1],
  } satisfies Transition,

  /** Salida ~20% más rápida que entrada */
  exitFast: {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1],
  } satisfies Transition,
} as const;
```

---

## 3. Segmented Tabs con `clip-path` + Morphing Icon Button

```tsx
"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MOTION_SPRINGS } from "./motion-springs";

export function SegmentedTabsClipPath({
  tabs,
  activeId,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="relative inline-flex items-center rounded-full bg-neutral-100 p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className="relative min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 transition-transform active:scale-[0.97]"
          >
            {isActive && (
              <motion.span
                layoutId="segmented-pill-bg"
                transition={MOTION_SPRINGS.everyday}
                className="absolute inset-0 rounded-full bg-white shadow-sm"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Morphing entre Copy -> Check sin cortes bruscos (`scale + opacity + blur(2px)`) */
export function CopyMorphButton({ textToCopy }: { textToCopy: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    setCopied(true); // 0ms Optimistic UI
    try {
      await navigator.clipboard.writeText(textToCopy);
    } finally {
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copiado" : "Copiar al portapapeles"}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-transform active:scale-[0.97]"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-1 text-emerald-600"
          >
            ✓ Copied
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            Copy
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
```

---

## 4. Botón Like Optimista `0ms` con Odómetro Vertical, Overshoot y Micro-Audio (~50ms)

```tsx
"use client";

import React, { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

function playSubtlePopSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(860, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.052);
  } catch {
    // Bloqueo silencioso si el entorno restringe Web Audio
  }
}

export function OptimisticLikeButton({
  initialLiked,
  initialCount,
  onSyncServer,
  enableAudio = true,
}: {
  initialLiked: boolean;
  initialCount: number;
  onSyncServer: (nextLiked: boolean) => Promise<void>;
  enableAudio?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [burstKey, setBurstKey] = useState(0);
  const pendingRef = useRef(false);

  const toggleLike = useCallback(async () => {
    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;

    // 1. 0ms Optimistic UI update (Doherty < 400ms)
    setDirection(nextLiked ? 1 : -1);
    setLiked(nextLiked);
    setCount(nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    if (nextLiked) {
      setBurstKey((k) => k + 1);
      if (enableAudio) playSubtlePopSound();
    }

    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      await onSyncServer(nextLiked);
    } catch {
      // Rollback limpio si falla servidor
      setDirection(nextLiked ? -1 : 1);
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      pendingRef.current = false;
    }
  }, [liked, count, enableAudio, onSyncServer]);

  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <button
      type="button"
      onClick={toggleLike}
      aria-pressed={liked}
      className="group relative inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: liked ? "oklch(0.63 0.24 25)" : "oklch(0.45 0.01 255)" }}
    >
      <span className="relative inline-flex items-center justify-center">
        {/* Partículas radiales breves al activar */}
        {liked && burstKey > 0 && (
          <span key={burstKey} aria-hidden="true" className="pointer-events-none absolute inset-0">
            {angles.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <motion.span
                  key={deg}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 0.9 }}
                  animate={{
                    x: Math.cos(rad) * 18,
                    y: Math.sin(rad) * 18,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
                />
              );
            })}
          </span>
        )}

        {/* Curva overshoot 1.0 -> 0.85 -> 1.28 -> 1.0 */}
        <motion.svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          animate={liked ? { scale: [1, 0.85, 1.28, 1] } : { scale: [1, 0.92, 1] }}
          transition={{ duration: 0.32, times: liked ? [0, 0.22, 0.65, 1] : [0, 0.4, 1] }}
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </motion.svg>
      </span>

      {/* Odómetro vertical tabular */}
      <span className="relative inline-flex h-5 overflow-hidden tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            initial={{ y: direction * 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: direction * -14, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
```

---

## 5. Helper de Entrada Tolerante (Ley de Postel)

```ts
const MONTH_ALIASES: Record<string, string> = {
  ja: "Jan", jan: "Jan", ene: "Jan",
  fe: "Feb", feb: "Feb",
  ma: "Mar", mar: "Mar",
  ap: "Apr", apr: "Apr", abr: "Apr",
  may: "May",
  ju: "Jun", jun: "Jun",
  jul: "Jul",
  au: "Aug", aug: "Aug", ago: "Aug",
  se: "Sep", sep: "Sep",
  oc: "Oct", oct: "Oct",
  no: "Nov", nov: "Nov",
  de: "Dec", dec: "Dec", dic: "Dec",
};

/** Interpreta "15 ja", "15-ene" o " 15   JAN " sin rechazar al usuario */
export function parseForgivingDayMonth(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[-/.,]+/g, " ").replace(/\s+/g, " ");
  const match = cleaned.match(/^(\d{1,2})\s+([a-z]{2,3})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTH_ALIASES[match[2]] ?? MONTH_ALIASES[match[2].slice(0, 2)];
  if (!month || day < 1 || day > 31) return null;
  return `${day} ${month}`;
}
```
