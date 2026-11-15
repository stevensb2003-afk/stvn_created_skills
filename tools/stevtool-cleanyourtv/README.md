# `stevtool-cleanyourtv` — Steven CleanYourTV & Gestor Multi-TV

Gestor aislado de instalaciones, debloat y personalizaciones de **CleanYourTV** para **Android TV / Google TV**, acompañado de la **Edición Personal** de Steven (Wi-Fi Popover, Bluetooth Popover con `%` de batería, Temporizador de reposo en vivo, Modo Ambiente con botón Atrás y pie de página sutil).

---

## 🏗️ Arquitectura de 3 Niveles

```text
~/Documents/Development/Plugins/
├── cleanyourtv-upstream/          # Clon limpio del repo oficial (Gathin23/cleanyourtv)
├── cleanyourtv/                   # Plantilla personal base (código fuente + .toolchain JDK 17 / Android SDK)
└── cleanyourtv-tvs/               # Un directorio aislado por cada televisor instalado
    └── <slug-del-tv>/
        ├── installed/             # Copia editable, compilable y capturas (launcher/, tools/, screenshots/)
        ├── backup/                # Respaldo original del TV (getprop.txt, packages-*.txt)
        ├── tv-profile.json        # Metadatos, IP, serial, marca, modelo y notas
        └── README.md              # Resumen del perfil del televisor
```

> **Privacidad:** Los respaldos reales de televisores (`cleanyourtv-tvs/<slug>/backup/`) se mantienen exclusivamente en local y nunca se incluyen en este repositorio.

---

## ✨ Funciones de la Edición Personal (`resources/`)

* **Encabezado limpio:** reloj grande (`72sp`) + fecha directa (`16sp`) y barra superior (`Wi-Fi` → `Bluetooth` → `Entradas HDMI` → `Temporizador` → `Reordenar` → `Ajustes`).
* **Wi-Fi Popover (`btnWifi`):** lista red conectada, guardadas y cercanas; diálogo nativo para contraseña (con fallback a Ajustes en Android 10+).
* **Bluetooth Popover (`btnBluetooth`):** dispositivos emparejados (filtrando controles HID), conexión directa y `%` de batería.
* **Temporizador de Reposo (`btnTimer`):** presets (`15`–`120 min`), duración personalizada y cuenta regresiva `MM:SS` en vivo.
* **Modo Ambiente con Atrás:** lanza `Somnambulator` / `dreamx` al presionar Atrás en Inicio (con diálogo para activarlo si está deshabilitado).
* **Pie de página sutil:** botones minimalistas `Ajustes del lanzador` y `Editar` pensados para controles remotos sin tecla Menú.

---

## 📂 Contenido de esta Carpeta

| Archivo / Carpeta | Descripción |
| :--- | :--- |
| [`SKILL.md`](./SKILL.md) | Instrucciones completas de la skill, matriz de aislamiento y checklist post-ejecución. |
| [`scripts/tv_manager.py`](./scripts/tv_manager.py) | CLI Python (`check-deps`, `check-compat`, `list`, `find`, `create`, `update`). Soporta variables `CLEANYOURTV_UPSTREAM`, `CLEANYOURTV_BASE` y `CLEANYOURTV_TVS_DIR`. |
| [`resources/cleanyourtv-personal.patch`](./resources/cleanyourtv-personal.patch) | Parche `git diff` completo de la edición personal sobre `Gathin23/cleanyourtv`. |
| [`resources/personal-overrides/`](./resources/personal-overrides/) | Archivos modificados y nuevos drawables (`ic_bluetooth.xml`, `ic_cast.xml`, `ic_timer.xml`, `keep.xml`, `MainActivity.java`, `LauncherSettingsActivity.java`, etc.) listos para aplicar a una copia upstream. |

---

## 🚀 Instalación y Uso Rápido

```bash
# Instalar esta skill desde la raíz de stvn_created_skills:
./install.sh --skill stevtool-cleanyourtv

# 1. Verificar dependencias locales (CleanYourTV, JDK 17, Android SDK, tools/venv)
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py check-deps

# 2. Auditar compatibilidad de un televisor por ADB
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py check-compat --ip <IP_TV>

# 3. Crear perfil aislado para un nuevo televisor
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py create \
  --name "<Nombre del TV>" --serial "<SERIAL>" --ip "<IP_TV>" --brand "<Marca>" --model "<Modelo>"
```

**Triggers:** `/stevtool-cleanyourtv`, `cleanyourtv`, `limpiar tele`, `configurar android tv`, `debloat tv`.
