---
name: create_agency_master_guide
description: Instalador Inteligente del Creative Agency OS. Autodetecta el OS, instala dependencias (FFmpeg, Remotion, Whisper), clona el repositorio maestro de skills (HyperFrames, Brandkit) y crea la arquitectura.
---

# 🚀 Creative Agency OS (Smart Setup Skill & Master Guide)

## CONTEXTO Y COMPORTAMIENTO DEL AGENTE
Tú (Antigravity) eres el Arquitecto del Sistema de esta Agencia Creativa. Esta skill es un **instalador automatizado**.
Tu objetivo es preparar una máquina para que tenga capacidades de edición de video, motion graphics, vectorización e IA instaladas. No asumas que el usuario lo hará; **tú debes abrir la terminal y ejecutar todos los comandos**.

---

## PASO 1: DETECCIÓN Y RUTA DESTINO
1. Detecta el Sistema Operativo (Mac, Linux o Windows) usando `run_command`.
2. Pregunta al usuario: *"¿En qué ruta deseas instalar el motor de tu 'Creative Agency OS'? Si no respondes, usaré tu carpeta Documentos."*
3. Si el usuario no provee ruta, utiliza:
   - Mac/Linux: `~/Documents/Creative_Agency_OS`
   - Windows: `%USERPROFILE%\Documents\Creative_Agency_OS`

---

## PASO 2: INSTALACIÓN MASIVA DE DEPENDENCIAS (AUTO-INSTALL)
Abre la terminal y ejecuta estas instalaciones de forma autónoma:

**Si es macOS / Linux:**
```bash
brew install ffmpeg imagemagick yt-dlp potrace node
pip3 install rembg[cli] openai-whisper opencv-python mediapipe
```

**Si es Windows:**
Intenta ejecutar `winget install -e --id Gyan.FFmpeg ImageMagick.ImageMagick yt-dlp.yt-dlp Node.js` y luego el comando de `pip install` de arriba.

---

## PASO 3: SINCRONIZACIÓN DEL REPOSITORIO MAESTRO DE SKILLS
Para que el usuario tenga acceso a HyperFrames, Brandkit y demás herramientas avanzadas, debes descargar el repositorio de skills de la agencia directamente en el cerebro de Antigravity.
Ejecuta este comando exacto en la terminal:

**Para macOS/Linux:**
```bash
mkdir -p ~/.gemini/config/skills
if [ -d "$HOME/.gemini/config/skills/stvn_created_skills" ]; then
    echo "Actualizando skills de la agencia..."
    cd "$HOME/.gemini/config/skills/stvn_created_skills" && git pull
else
    echo "Descargando skills maestras..."
    git clone https://github.com/stevensb2003-afk/stvn_created_skills.git "$HOME/.gemini/config/skills/stvn_created_skills"
fi
```
*(Si es Windows, adapta el script usando `%USERPROFILE%\.gemini\config\skills` y git clone).*

---

## PASO 4: CREACIÓN DE LA ARQUITECTURA (AGENCY HUB)
Usa `mkdir -p` para crear exactamente esta estructura de carpetas en la ruta destino del usuario:
```text
clients/Client_Template/assets/logos/
clients/Client_Template/assets/fonts/
clients/Client_Template/scripts/
clients/Client_Template/raw/
clients/Client_Template/exports/
templates/
pipelines/
remotion_engine/
```

---

## PASO 5: INICIALIZACIÓN DE REMOTION (MOTOR DE MOTION GRAPHICS)
Una vez que `node` esté instalado, entra a la carpeta `remotion_engine` y ejecuta:
```bash
cd remotion_engine && npm init video@latest mi-plantilla-reels -- --template blank --yes
```

---

## PASO 6: ESCRITURA DE SCRIPTS AUTOMATIZADOS (PIPELINES)
Usa `write_to_file` para generar estos archivos exactos:

**Archivo 1: `pipelines/vectorize_logo.sh`**
```bash
#!/bin/bash
INPUT=$1
OUTPUT="${INPUT%.*}.svg"
echo "[Agency OS] Vectorizando $INPUT..."
convert "$INPUT" -threshold 50% pgm:- | potrace -s -o "$OUTPUT"
echo "[Agency OS] ¡Logo SVG generado exitosamente en $OUTPUT!"
```

**Archivo 2: `clients/Client_Template/BRAND.md`**
```markdown
# Memoria de Marca (Brand Core)
- **Tono de Voz:** (Ej. Directo, energético).
- **Arquetipo:** (Ej. El Mago).
- **Paleta de Colores (HEX):**
  - Primario: #000000
  - Secundario: #FFFFFF
  - Acento: #FF0055
- **Tipografía Oficial:** (Ej. Montserrat Bold).
```

---

## PASO 7: GENERACIÓN DEL 'MASTER GUIDE' (MANUAL OPERATIVO COMPLETO)
Crea el archivo `Creative_Agency_OS_Master_Guide.md` en la raíz del proyecto escribiendo EXACTAMENTE este contenido:

<INICIO_DEL_CONTENIDO_MASTER_GUIDE>
# 🚀 Antigravity: Creative Agency OS (Master Guide & Playbook)

Bienvenido a tu Agencia Creativa Autónoma. Este entorno ya ha sido pre-configurado, instalado y estructurado por Antigravity. 

## 🛠️ Herramientas Instaladas en tu Máquina
1. **FFmpeg**: El motor base para cortar videos, unir audios y quemar subtítulos.
2. **ImageMagick**: Procesador masivo de imágenes y filtros.
3. **Potrace**: Motor matemático de vectorización.
4. **Remotion (Node.js)**: Framework de React para programar video en código.
5. **OpenAI Whisper**: Transcripción y subtítulos word-level.
6. **Rembg**: IA local para remover fondos de fotografías.

## 🧠 Skills Nativas de la Agencia (Instaladas vía GitHub)
Durante el setup, Antigravity se conectó al repositorio `stvn_created_skills` y descargó todo tu arsenal creativo. Ahora puedes usar:
- **`talking-head-recut`**: Rótulos y tarjetas sobre videos de personas hablando a cámara.
- **`faceless-explainer`**: Convierte texto en video con motion graphics.
- **`music-to-video`**: Edición sincronizada con la música.
- **`brandkit`**: Genera moodboards y define estéticas.
- **`hyperframes-suite`**: Motor interno para renderizar código web a MP4.

## ⚡ Los Pipelines (Flujos de Trabajo Automatizados)
En la carpeta `pipelines/` encontrarás scripts listos para operar.

### 1. Vectorización de Logos (potrace + ImageMagick)
Ejecuta: `bash pipelines/vectorize_logo.sh logo_cliente.jpg`
Convierte JPGs pixelados en SVGs perfectos.

### 2. Escalabilidad
Recomendamos configurar *Raycast* (Mac) o un *Stream Deck* para disparar estos pipelines y la creación de guiones con atajos de teclado.

**¡Todo está listo para operar! Tu agencia creativa ahora corre sobre código.**
<FIN_DEL_CONTENIDO_MASTER_GUIDE>

---

## PASO 8: REPORTE FINAL AL USUARIO
Termina informándole al usuario que las dependencias fueron instaladas, que el repositorio maestro de skills de GitHub fue clonado y activado, y que la agencia está lista.
