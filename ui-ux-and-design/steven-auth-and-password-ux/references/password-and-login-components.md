# Componentes React/TypeScript para Auth & Cognitive Password UX

Implementación lista para producción correspondiente a `steven-auth-and-password-ux`: incluye generador criptográfico por chunks (Ley de Miller), máquina de estados *Reward Early, Punish Late*, medidor perimetral SVG (*Gestalt Closure*), toggle de visibilidad Zero-CLS y contenedor concéntrico ambiental.

---

## 1. `<CognitivePasswordInput />` Completo

```tsx
"use client";

import React, { useId, useMemo, useState } from "react";

const COMMON_WEAK_PASSWORDS = new Set([
  "123456",
  "12345678",
  "1234567890",
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "admin",
  "letmein",
  "welcome",
  "iloveyou",
  "abc123",
]);

const CHUNK_CHARSET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Genera 3 bloques de 4 caracteres (ej. 4tdp-a3cV-Uqr2) sin sesgo de módulo */
export function generateChunkedPassword(chunks = 3, chunkLen = 4): string {
  const resultChunks: string[] = [];
  const limit = Math.floor(256 / CHUNK_CHARSET.length) * CHUNK_CHARSET.length;
  const buf = new Uint8Array(1);

  for (let c = 0; c < chunks; c++) {
    let chunk = "";
    while (chunk.length < chunkLen) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) {
        chunk += CHUNK_CHARSET[buf[0] % CHUNK_CHARSET.length];
      }
    }
    resultChunks.push(chunk);
  }
  return resultChunks.join("-");
}

interface PasswordAnalysis {
  score: number; // 0 a 100
  isValid: boolean;
  isCommon: boolean;
  calmHint: string;
  errorMessage: string | null;
}

function analyzePassword(pwd: string, minLength = 12): PasswordAnalysis {
  const normalized = pwd.trim().toLowerCase();
  const isCommon =
    COMMON_WEAK_PASSWORDS.has(normalized) ||
    (pwd.length >= 4 && /^(.)\1+$/.test(pwd));

  if (!pwd.length) {
    return {
      score: 0,
      isValid: false,
      isCommon: false,
      calmHint: `Mínimo ${minLength} caracteres o usa el generador`,
      errorMessage: `Ingresa una contraseña de al menos ${minLength} caracteres.`,
    };
  }

  if (isCommon) {
    return {
      score: 18,
      isValid: false,
      isCommon: true,
      calmHint: "Evita contraseñas comunes o repetidas; prueba con 3 palabras o bloques.",
      errorMessage: "Esta contraseña aparece en listas filtradas comunes. Elige otra más única.",
    };
  }

  const remaining = Math.max(0, minLength - pwd.length);
  const lengthPts = Math.min(60, Math.round((pwd.length / minLength) * 60));
  const varietyPts =
    (/[a-z]/.test(pwd) ? 10 : 0) +
    (/[A-Z]/.test(pwd) ? 10 : 0) +
    (/\d/.test(pwd) ? 10 : 0) +
    (/[^A-Za-z0-9]/.test(pwd) ? 10 : 0);
  const score = Math.min(100, lengthPts + varietyPts);

  if (remaining > 0) {
    return {
      score,
      isValid: false,
      isCommon: false,
      calmHint: `Faltan ${remaining} ${remaining === 1 ? "carácter" : "caracteres"}`,
      errorMessage: `Usa al menos ${minLength} caracteres (faltan ${remaining}).`,
    };
  }

  const label = score >= 85 ? "Contraseña sólida ✓" : "Longitud válida ✓";
  return {
    score,
    isValid: true,
    isCommon: false,
    calmHint: label,
    errorMessage: null,
  };
}

export function CognitivePasswordInput({
  value,
  onChange,
  mode = "signup",
  minLength = 12,
  forceSubmitted = false,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  mode?: "signup" | "login";
  minLength?: number;
  forceSubmitted?: boolean;
}) {
  const inputId = useId();
  const helperId = `${inputId}-helper`;

  const [revealed, setRevealed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [copiedSuggested, setCopiedSuggested] = useState(false);

  const analysis = useMemo(() => analyzePassword(value, minLength), [value, minLength]);

  // Reward Early, Punish Late: solo castiga tras onBlur o submit, y limpia al instante al corregir
  const shouldShowError =
    mode === "signup" && (touched || forceSubmitted) && !analysis.isValid;

  const borderColor = shouldShowError
    ? "oklch(0.60 0.22 25)"
    : analysis.isValid
      ? "oklch(0.62 0.18 150)"
      : "oklch(0.55 0.14 250)";

  const handleSuggestPassword = async () => {
    const generated = generateChunkedPassword(3, 4);
    onChange(generated);
    setRevealed(true);
    try {
      await navigator.clipboard.writeText(generated);
      setCopiedSuggested(true);
      window.setTimeout(() => setCopiedSuggested(false), 1800);
    } catch {
      // Clipboard opcional si no hay permisos
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
          Contraseña
        </label>
        {mode === "signup" && (
          <button
            type="button"
            onClick={handleSuggestPassword}
            className="text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          >
            {copiedSuggested ? "Copiada ✓" : "Sugerir segura (xxxx-xxxx-xxxx)"}
          </button>
        )}
      </div>

      {/* Contenedor con SVG Perimeter Closure + Zero-CLS Mono Input */}
      <div className="relative rounded-[18px] bg-white">
        {mode === "signup" && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx="17"
              ry="17"
              fill="none"
              stroke="oklch(0.90 0.01 250)"
              strokeWidth="1.5"
            />
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx="17"
              ry="17"
              fill="none"
              stroke={borderColor}
              strokeWidth="2"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100 - analysis.score}
              style={{ transition: "stroke-dashoffset 220ms cubic-bezier(0.22, 1, 0.36, 1), stroke 180ms ease" }}
            />
          </svg>
        )}

        <div className="relative flex min-h-[48px] items-center rounded-[18px] px-3.5">
          <input
            id={inputId}
            type={revealed ? "text" : "password"}
            value={value}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            aria-invalid={shouldShowError}
            aria-describedby={helperId}
            onBlur={() => setTouched(true)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={mode === "signup" ? "4tdp-a3cV-Uqr2" : "••••••••••••"}
            className="w-full bg-transparent pr-2 font-mono text-[15px] leading-6 tracking-normal text-neutral-950 outline-none placeholder:text-neutral-400"
          />

          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={revealed}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Redundancy Gain: Color + Estado claro sin saturar */}
      {mode === "signup" && (
        <p
          id={helperId}
          aria-live="polite"
          className="min-h-[20px] text-xs font-medium"
          style={{
            color: shouldShowError
              ? "oklch(0.54 0.21 25)"
              : analysis.isValid
                ? "oklch(0.48 0.16 150)"
                : "oklch(0.48 0.015 255)",
          }}
        >
          {shouldShowError ? analysis.errorMessage : analysis.calmHint}
        </p>
      )}
    </div>
  );
}
```

---

## 2. `<AuthCardShell />` con Radios Concéntricos, Sombra Ambiental y Botón Submit con Estados

```tsx
"use client";

import React, { useState } from "react";
import { CognitivePasswordInput } from "./CognitivePasswordInput";

type SubmitState = "idle" | "submitting" | "success";

export function AuthCardShell({
  brandName = "Window Seat",
  onSubmitCredentials,
}: {
  brandName?: string;
  onSubmitCredentials: (payload: { email: string; password: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [status, setStatus] = useState<SubmitState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    setSubmittedOnce(true);
    setServerError(null);
    if (!email.includes("@") || password.length < 12) return;

    setStatus("submitting");
    try {
      await onSubmitCredentials({ email, password });
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setServerError(err instanceof Error ? err.message : "No pudimos completar el acceso.");
    }
  };

  return (
    <div
      className="w-full max-w-md bg-white/95 p-2 backdrop-blur-md"
      style={
        {
          "--outer-r": "32px",
          "--pad": "8px",
          "--inner-r": "max(0px, calc(var(--outer-r) - var(--pad)))",
          borderRadius: "var(--outer-r)",
          boxShadow:
            "0 4px 12px oklch(0.55 0.08 235 / 0.10), 0 24px 48px -12px oklch(0.55 0.08 235 / 0.20)",
        } as React.CSSProperties
      }
    >
      <div
        className="border border-neutral-200/80 bg-white p-6"
        style={{ borderRadius: "var(--inner-r)" }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 text-balance">
          Log in to {brandName}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium text-neutral-800">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="min-h-[48px] w-full rounded-[18px] border border-neutral-300 px-3.5 text-[15px] text-neutral-950 outline-none focus:border-neutral-900"
            />
          </div>

          <CognitivePasswordInput
            value={password}
            onChange={setPassword}
            mode="signup"
            forceSubmitted={submittedOnce}
          />

          {serverError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {serverError}
            </p>
          )}

          {/* Ciclo explícito del CTA sin doble clic */}
          <button
            type="submit"
            disabled={status !== "idle"}
            className="min-h-[48px] w-full rounded-[18px] bg-neutral-950 px-4 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
          >
            {status === "idle" && "Create account"}
            {status === "submitting" && "Creating account..."}
            {status === "success" && "✔ Account created"}
          </button>
        </form>

        {/* OAuth compacto al pie: jerarquía subordinada */}
        <div className="mt-6 flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          <span>or</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {["Google", "Apple", "Passkey"].map((provider) => (
            <button
              key={provider}
              type="button"
              className="min-h-[44px] rounded-[14px] border border-neutral-200 bg-neutral-50/70 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
            >
              {provider}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```
