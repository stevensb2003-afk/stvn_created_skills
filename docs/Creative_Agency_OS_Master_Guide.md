# 🚀 Antigravity: Creative Agency OS (Master Setup Guide & Automation Playbook)

Este documento es el plano arquitectónico avanzado para transformar una instalación limpia de **Google Antigravity** en un sistema autónomo de producción audiovisual, gestión de agencia creativa y automatización de contenidos.

---

## 🛠️ FASE 1: Motor Base y Dependencias del Sistema
Para que Antigravity pueda hacer magia sin depender de software pesado, necesita un motor de herramientas de terminal (CLI). 

**Instalación (vía Terminal/Homebrew y Python):**
Abre tu terminal y ejecuta estos comandos. Antigravity utilizará estas librerías en segundo plano para procesar todo:

```bash
# 1. Herramientas Core de Video, Imagen y Vectores
brew install ffmpeg imagemagick yt-dlp potrace

# 2. Entorno Node.js (Necesario para Remotion y Motion Canvas)
brew install node

# 3. Herramientas de IA locales (Python)
pip install rembg[cli]
pip install -U openai-whisper
# Opcional (para recorte inteligente de rostros):
pip install opencv-python mediapipe
```

### ¿Qué hace exactamente cada herramienta en tu Agencia?
* **`ffmpeg`**: La navaja suiza del video. Corta silencios, renderiza, extrae audio, une clips y quema subtítulos sin abrir Premiere.
* **`imagemagick`**: Edición masiva de imágenes. Redimensiona fotos para historias, monta carruseles y aplica filtros de color automáticos.
* **`potrace`**: **(Motor de Vectorización)**. Convierte archivos JPG/PNG (como logos pixelados de clientes) en archivos `.svg` vectoriales y escalables perfectos.
* **`yt-dlp`**: Descarga de assets, música de fondo de bibliotecas, o videos de referencia en máxima calidad.
* **`rembg`**: IA local para remover fondos de fotografías con un solo comando. Fundamental para armar portadas y miniaturas.
* **`whisper`**: Motor de IA de OpenAI para transcripción ultra-precisa y generación de subtítulos con marcas de tiempo (word-level).

---

## 🧠 FASE 2: Ecosistema de Skills y Frameworks

### A. Skills Nativas de Antigravity
Estas ya vienen integradas, solo debes pedirle a Antigravity que las use:
1. **`talking-head-recut`**: Añade rótulos, títulos cinéticos, tarjetas informativas y *lower-thirds* sincronizados sobre videos donde la persona habla a cámara.
2. **`faceless-explainer`**: Convierte guiones en videos explicativos con tipografía cinética y motion graphics (sin necesidad de salir a cámara).
3. **`music-to-video`**: Edición *beat-synced* (sincronizada al ritmo de la música) para transiciones rápidas y reels de alta retención.
4. **`brandkit`**: Crea tableros de inspiración, paletas de colores e identidad visual de la agencia o de clientes nuevos.
5. **`gemini-omni-flash-api`**: Edición generativa. Sirve para inpainting de video, generar B-roll suplementario y transiciones.
6. **`hyperframes-suite`**: Un motor nativo para crear motion graphics mediante código web y exportarlos a MP4.

### B. Frameworks Open-Source (Para Programar Plantillas)
Antigravity puede escribir código en estos frameworks para escalar tu producción:
1. **[Remotion](https://www.remotion.dev/)**: Framework en React para programar videos. **Escalabilidad:** Puedes diseñar un reel una sola vez (con animaciones, colores, tipografía) y decirle a un script que lea un Excel con 50 frases para renderizar 50 videos distintos automáticamente.
2. **[Motion Canvas](https://motioncanvas.io/)**: Para motion graphics técnicos y vectoriales ultra fluidos (60fps) programados en TypeScript.
3. **AutoCrop / Face-Tracking (MediaPipe + OpenCV)**: Scripts que leen un video horizontal (16:9), detectan dónde está el rostro del sujeto en cada frame, y recortan dinámicamente el video a vertical (9:16) manteniendo a la persona siempre en el centro.

---

## 📂 FASE 3: Arquitectura Avanzada de Carpetas (Agency Hub)
Crea una carpeta llamada `agency-os`. Esta será la "memoria" de Antigravity. Si organizas los clientes aquí, la IA nunca mezclará la tipografía de un cliente con los colores de otro.

```text
agency-os/
├── .gemini/
│   ├── rules/                 # Reglas base: Ej. "Siempre exportar vertical a 1080x1920"
│   └── skills/                # Skills personalizadas
├── clients/
│   ├── [Nombre_Cliente_1]/
│   │   ├── BRAND.md           # [VITAL] Define el tono, arquetipo, colores HEX y tipografía.
│   │   ├── assets/
│   │   │   ├── fonts/         # Archivos .ttf / .otf del cliente
│   │   │   ├── logos/         # Logos en PNG y SVG
│   │   │   └── audio/         # SFX propios, música de fondo aprobada
│   │   ├── scripts/           # Guiones generados (.md)
│   │   ├── raw/               # Videos crudos (.mp4) listos para procesar
│   │   └── exports/           # Reels y carruseles terminados
│   └── [Nombre_Cliente_2]/
├── templates/
│   ├── scripts/               # Fórmulas de Copywriting (Hooks, VSL, Storytelling)
│   └── remotion/              # Componentes de video reutilizables
└── pipelines/                 # (Scripts de Automatización - Ver Fase 4)
```

---

## ⚡ FASE 4: Flujos de Automatización y Escalabilidad (Pipelines)
En lugar de editar a mano, Antigravity orquestará estos "Pipelines" (Scripts de Python/Bash que viven en tu carpeta `pipelines/`):

### Pipeline 1: El Convertidor de Logos (De JPG a SVG Vectorial)
Cuando un cliente te envía un logo pixelado:
1. Pones el archivo en `raw/logo.jpg`.
2. Antigravity ejecuta `imagemagick` para pasar la imagen a blanco y negro de alto contraste (umbralizado).
3. Luego, pasa esa imagen procesada por `potrace`, trazando matemáticamente los bordes.
4. Entrega un `.svg` perfecto en la carpeta `assets/logos/` listo para escalar a cualquier tamaño sin perder calidad.

### Pipeline 2: El Motor de Reels Virales (1-Click Workflow)
1. **Limpieza (Jump-Cuts):** Un script de Python (`pydub` + `ffmpeg`) analiza los decibelios del crudo y corta automáticamente todos los espacios en blanco.
2. **Subtítulos Inteligentes:** `Whisper` procesa el audio y genera un `.ass` sincronizando las palabras (word-level). 
3. **Estilización:** Antigravity inyecta los colores del `BRAND.md` a los subtítulos.
4. **Recorte (AutoCrop):** Si el crudo es horizontal, OpenCV centra el rostro y lo pasa a 9:16.
5. **Overlays:** Se aplican animaciones y stickers del cliente.
6. **Exportación:** `ffmpeg` renderiza el MP4 final.

### Pipeline 3: Thumbnail A/B Tester
Toma 2 fotos tuyas, aplica `rembg` para eliminar el fondo, utiliza plantillas de `imagemagick` para añadir contornos (strokes), coloca un título con la fuente de tu marca y renderiza 3 opciones de miniatura para que pruebes cuál tiene mejor CTR (Click-Through Rate).

### 🚀 Escalabilidad con Teclado (Raycast / Stream Deck)
Para no tener que escribir comandos largos, puedes asignar los pipelines a tu teclado:
* `Cmd + Shift + V` -> Dispara: `python pipelines/reel_engine.py --client=MiMarca`
* `Cmd + Shift + L` -> Dispara: `bash pipelines/vectorize_logo.sh logo.jpg`

---

## 🤖 FASE 5: Prompt Maestro de Inicialización

**Instrucción Final:** Cuando instales Antigravity en la computadora y abras esta carpeta, cópiale este bloque exacto en el chat para que estructure la agencia por ti:

> **"Hola Antigravity. Eres mi Director de Producción Técnica y el núcleo de mi Creative Agency OS. Por favor, lee meticulosamente este documento maestro (`Creative_Agency_OS_Master_Guide.md`). Quiero que ejecutes este setup inicial:
> 1. Crea la estructura completa de carpetas (`clients/`, `templates/`, `pipelines/`) detallada en la Fase 3.
> 2. Crea un archivo `BRAND.md` de ejemplo dentro de `clients/TestClient/` con una estructura profesional para llenarla luego.
> 3. Abre la terminal e instala las dependencias de la Fase 1 (`ffmpeg`, `imagemagick`, `potrace`, `yt-dlp`, `rembg`, `whisper`). Confirma si falta algo.
> 4. Escríbeme un script bash (`pipelines/vectorize_logo.sh`) que tome un JPG, use ImageMagick para el contraste y Potrace para convertirlo a SVG, tal como se explica en la Fase 4.
> 5. A partir de ahora operaremos bajo estas reglas de escalabilidad. Confirma cuando el setup haya finalizado."**
