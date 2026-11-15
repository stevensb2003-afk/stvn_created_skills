---
name: stevtool-cleanyourtv
description: >
  Gestor de instalaciones, debloat y personalizaciones aisladas de CleanYourTV por cada televisor (Android TV / Google TV).
  Parte de la plantilla base personalizada en ~/Documents/Development/Plugins/cleanyourtv (o $CLEANYOURTV_BASE) y crea una carpeta única por tele en ~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/ para evitar colisiones entre dispositivos.
  Verifica dependencias obligatorias (CleanYourTV, tools/venv, launcher/, JDK 17 y Android SDK), detecta por ADB si el televisor es nuevo o ya existe, guía la personalización visual, debloat, compilación del APK, captura de screenshots y actualización de tv-profile.json.
  Actívalo cuando el usuario escriba "/stevtool-cleanyourtv", "cleanyourtv", "limpiar tele", "configurar android tv", "debloat tv" o pida personalizar/instalar el launcher en un televisor.
---

# Gestor Aislado de CleanYourTV por Televisor (`stevtool-cleanyourtv`)

Este skill gestiona instalaciones, debloat y personalizaciones de **CleanYourTV** con una arquitectura de **3 niveles** para mantener intacto tanto el repositorio oficial como tu versión personal y cada televisor instalado:

1. **Archivo Madre (Upstream Oficial de GitHub):**
   `~/Documents/Development/Plugins/cleanyourtv-upstream`
   * Clon limpio de `https://github.com/Gathin23/cleanyourtv` (se puede actualizar con `git pull` en cualquier momento sin conflictos para consultar nuevos temas, `examples/` de modelos recientes o mejoras del launcher).
2. **Versión Personal (Plantilla Principal Instalable):**
   `~/Documents/Development/Plugins/cleanyourtv`
   * **Esta es la plantilla que el skill duplica** para cada televisor nuevo. Contiene tus personalizaciones propias (botones de Bluetooth/Cast, `LauncherSettingsActivity`, `config.xml` base, `.toolchain/` con JDK 17 + Android SDK y `tools/venv/`).
3. **Teles Instalados (1 Carpeta por TV con `installed/` + `backup/`):**
   `~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/`
   * Cada televisor nuevo recibe **1 carpeta única** (`<slug>/`) con **2 subcarpetas internas**:
     * `installed/`: su copia aislada e instalable (`launcher/`, `themes/`, `tools/`, `debloat.txt`, `screenshots/`, más symlinks a `.toolchain/` y `tools/venv/`).
     * `backup/`: el respaldo exclusivo de ese TV (`getprop.txt`, `packages-all.txt`, `packages-enabled.txt`, `packages-disabled.txt`, `packages-3rdparty.txt`, copia de `recovery-*.json`).
   * En la raíz de `<slug>/` viven `tv-profile.json` y `README.md`.

---

## 1. Prerrequisitos y Dependencias Obligatorias

Antes de ejecutar cualquier acción sobre un televisor, es **obligatorio** verificar que la computadora cuente con **CleanYourTV** previamente clonado e instalado, además del toolchain necesario:

1. **Versión Personal Instalable** (`~/Documents/Development/Plugins/cleanyourtv`) y/o **Repositorio oficial de CleanYourTV** (`https://github.com/Gathin23/cleanyourtv`, recomendado tenerlo también como archivo madre en `~/Documents/Development/Plugins/cleanyourtv-upstream`):
   * Debe existir `tools/venv` (entorno Python con `adb-shell` / utilidades) y `launcher/` (proyecto Android del launcher).
   * Para compilar el APK del launcher: **JDK 17** y **Android SDK** (ya sea dentro de `.toolchain/` en el proyecto o instalados en el sistema).
2. **Requisito en el Televisor:**
   * Debe correr **Android TV** o **Google TV** (no funciona en Samsung Tizen, LG webOS ni TVs Smart Linux / NetRange).
   * Debe tener **Opciones de desarrollador** y **Depuración USB / Depuración de red (ADB puerto `5555`)** activadas.

### Verificación Inicial Obligatoria

Ejecuta siempre este comando al inicio:

```bash
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py check-deps
```

> **Compuerta de Detención:** Si `check-deps` reporta que falta **CleanYourTV** (o `tools/venv`, `launcher/`, JDK 17 / Android SDK para compilación), **detente inmediatamente**. Informa qué falta y guía al usuario para clonar e instalar el proyecto desde el repositorio oficial: `https://github.com/Gathin23/cleanyourtv`.

---

## 2. Regla de Oro de Aislamiento

* **NUNCA** edites `config.xml`, `strings.xml`, layouts, drawables, `debloat.txt`, `backup/` ni `screenshots/` directamente en la plantilla base (`~/Documents/Development/Plugins/cleanyourtv`), a menos que el usuario pida explícitamente actualizar el template base.
* **TODAS** las ediciones, compilaciones y capturas de un televisor se realizan **únicamente dentro de su subcarpeta `installed/`**:
  `~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/installed/`
* **TODOS** los respaldos previos de paquetes y propiedades de ese TV se guardan **únicamente dentro de su subcarpeta `backup/`**:
  `~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/backup/`

---

## 3. Flujo de Detección: ¿Tele Nuevo o Existente?

### Paso 1: Listar televisores registrados

```bash
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py list
```

### Paso 2: Conectar por ADB (via `tools/tv.py`) y leer propiedades reales del televisor

Si no conoces la IP del televisor, pídesela al usuario. En macOS usa el cliente Python de CleanYourTV (`tools/tv.py`) para evitar el bloqueo de red local de `adb`:

```bash
cd ~/Documents/Development/Plugins/cleanyourtv
TV_HOST=<IP_TV> tools/venv/bin/python -I tools/tv.py "getprop ro.serialno; getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.build.version.release"
```

### Paso 2.5: Auditar compatibilidad del televisor (`check-compat`)

Antes de crear el perfil o compilar, ejecuta `check-compat` para verificar qué funciones de tu edición personalizada de CleanYourTV soporta ese televisor (SDK de Android, Modo Ambiente/Somnambulator, Wi-Fi directo vs fallback, Bluetooth, entradas HDMI e intents de Ajustes):

```bash
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py check-compat --ip "<IP_TV>"
```

### Paso 3: Buscar si el televisor ya tiene carpeta única

```bash
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py find --serial "<SERIAL>" --ip "<IP_TV>"
```

* **Si YA existe una carpeta para ese tele:**
  Pregunta al usuario con `ask_question` si desea trabajar sobre la carpeta existente o crear una nueva carpeta independiente:
  ```json
  {
    "questions": [
      {
        "question": "Este televisor ya tiene una carpeta registrada. ¿Cómo deseas proceder?",
        "is_multi_select": false,
        "options": [
          "(Recommended) Trabajar sobre la carpeta existente (cleanyourtv-tvs/<slug>/)",
          "Crear una nueva carpeta duplicando la plantilla base"
        ]
      }
    ]
  }
  ```

* **Si es un tele NUEVO:**
  Pide al usuario el **nombre descriptivo del tele** (ej. `"Sala Familiar Xiaomi"`, `"Cuarto Sony Bravia"`) y duplica la plantilla base en su propia carpeta única:
  ```bash
  python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py create \
    --name "<NOMBRE_DEL_TELE>" \
    --serial "<SERIAL>" \
    --ip "<IP_TV>" \
    --brand "<MANUFACTURER>" \
    --model "<MODEL>"
  ```

---

## 4. Menú Interactivo: Personalización, Features, Debloat y Compilación

Una vez posicionado en `~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/`, presenta el menú de trabajo con `ask_question`:

```json
{
  "questions": [
    {
      "question": "¿Qué acciones deseas aplicar en este televisor?",
      "is_multi_select": false,
      "options": [
        "(Recommended) Launcher completo + debloat + animaciones",
        "Solo debloat + optimización de animaciones (sin reemplazar launcher)",
        "Ajustes posteriores sobre un tele existente (editar config, UI o paquetes)"
      ]
    }
  ]
}
```

### A. Personalización Visual y Features del Launcher (dentro de `cleanyourtv-tvs/<slug>/installed/`)

Edita exclusivamente los archivos dentro de `installed/` del tele:
* **Configuración general y features (`launcher/.../config.xml`):** número de columnas, filas/dock, visibilidad de reloj (`72sp`) + fecha debajo (`EEEE d MMMM`), saludo personalizado y barra superior (`Wi-Fi`, `Bluetooth`, `Entradas HDMI`, `Temporizador`, `Reordenar`, `Ajustes`).
* **Funciones propias de esta edición (`MainActivity.java`):**
  * **Popovers Glass UI con sub-vistas animadas (`transitionPopover` / `AutoTransition`):** navegación interna in-place dentro del mismo popover con botón **Volver**, sin saltar a diálogos externos ni salir de Inicio.
  * **Wi-Fi Popover (`btnWifi`):** lista red conectada, guardadas y cercanas detectadas (con ícono de candado `ic_lock` en `item_input.xml` para redes seguras). Al seleccionar una red conectada o guardada abre la vista de detalle con `%` de señal, velocidad (`Mbps`), banda (`2.4 GHz` / `5 GHz`), dirección `IP` y acciones **Conectar** / **Desconectar** u **Olvidar red**, además de acceso a Ajustes del sistema y app VPN.
  * **Bluetooth Popover (`btnBluetooth`):** lista accesorios emparejados (filtrando controles HID como controles remotos, mostrando `%` de batería cuando aplica) y al seleccionar uno abre su vista de detalle con **Conectar** / **Desconectar** y **Desvincular** (`removeBond`), más acceso a Ajustes de Bluetooth.
  * **Temporizador de reposo (`btnTimer`):** popover nativo con presets (`15`–`120 min`) y selector **Personalizado** integrado in-place (`-5` / `+5` min, rango `5`–`360 min`) con botones **Iniciar** y **Volver**; cuenta regresiva `MM:SS` en vivo en la barra superior (si está activo muestra **Cancelar temporizador**).
  * **Botón Atrás → Modo Ambiente:** al presionar Atrás en Inicio lanza `Somnambulator` / `dreamx`; si está desactivado, muestra un diálogo para activarlo.
  * **Pie de página sutil:** botones de texto minimalistas (`Ajustes del lanzador` y `Editar`) con subrayado y negrita al enfocar, para controles remotos sin botón de menú/largo.
* **Textos y saludo (`launcher/.../strings.xml`):** nombre del espacio, saludo de bienvenida y etiquetas visibles.
* **Apariencia, fondo, tema e íconos:** `layouts/`, `drawables/` y recursos de tema dentro de `launcher/` del tele.

### B. Respaldo, Debloat y Restauración de Paquetes

Antes de deshabilitar paquetes, guarda el respaldo del estado original del tele (`getprop`, `pm list packages`, etc.) dentro de `cleanyourtv-tvs/<slug>/backup/`. Luego ajusta `installed/debloat.txt` y ejecuta los scripts desde `installed/`:

```bash
cd ~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/installed
TV_HOST=<IP_TV> ./tools/disable.sh debloat.txt
```

Si algún paquete deshabilitado causa problemas o el usuario desea revertirlo:

```bash
cd ~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/installed
TV_HOST=<IP_TV> ./tools/restore.sh debloat.txt
```

### C. Compilación e Instalación del Launcher

Compila e instala el APK personalizado desde la subcarpeta `installed/` del tele:

```bash
cd ~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/installed
TV_HOST=<IP_TV> ./launcher/build-and-install.sh
```

### D. Verificación Visual por ADB (Screenshots)

Captura la pantalla real del televisor y guárdala en `installed/screenshots/` dentro de la carpeta del tele para inspeccionar visualmente el resultado (y corregir detalles de alineación, contraste o botones si hace falta):

```bash
cd ~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/installed
SHOT="verify-$(date +%Y%m%d-%H%M%S).png"
TV_HOST=<IP_TV> tools/venv/bin/python -I tools/tv.py "screencap -p /sdcard/$SHOT"
TV_HOST=<IP_TV> tools/venv/bin/python -I tools/tv.py --pull "/sdcard/$SHOT" "screenshots/$SHOT"
TV_HOST=<IP_TV> tools/venv/bin/python -I tools/tv.py "rm -f /sdcard/$SHOT"
```

### E. Actualización del Perfil del Televisor (`tv-profile.json`)

Al finalizar los cambios, registra el estado actual en `tv-profile.json` usando `tv_manager.py update`:

```bash
python3 ~/.gemini/config/skills/stevtool-cleanyourtv/scripts/tv_manager.py update --slug "<slug>"
```

---

## 5. Checklist de Verificación Post-Ejecución

Antes de dar por terminada la sesión con el televisor, confirma cada punto:

- [ ] `tv_manager.py check-deps` pasó sin errores (CleanYourTV, `tools/venv`, `launcher/`, y JDK 17 + Android SDK si hubo compilación).
- [ ] El televisor objetivo fue identificado por ADB (`ro.serialno`, fabricante, modelo, versión de Android) y asociado a su carpeta única en `~/Documents/Development/Plugins/cleanyourtv-tvs/<slug>/`.
- [ ] **Aislamiento verificado:** la plantilla base `~/Documents/Development/Plugins/cleanyourtv` permanece intacta (sin ediciones accidentales).
- [ ] Se guardó el respaldo original del tele en `cleanyourtv-tvs/<slug>/backup/` y se ejecutó `tools/disable.sh` desde `cleanyourtv-tvs/<slug>/installed/`.
- [ ] Si se eligió launcher completo o cambios visuales, `launcher/build-and-install.sh` compiló e instaló el APK sin errores desde `installed/`.
- [ ] Se tomó y revisó al menos un screenshot por ADB en `cleanyourtv-tvs/<slug>/installed/screenshots/`.
- [ ] `tv-profile.json` quedó actualizado mediante `tv_manager.py update`.
