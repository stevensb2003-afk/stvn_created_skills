#!/usr/bin/env bash
# ==============================================================================
# install.sh — Instalador multi-plataforma de stvn_created_skills para Antigravity
#
# Uso:
#   ./install.sh                         # Instala todas las skills (copia)
#   ./install.sh --category steven-skills
#   ./install.sh --skill steven-oauth-verifier
#   ./install.sh --link                  # Usa symlinks (útil para git pull)
#   ./install.sh --target ./.agents/skills
#   ./install.sh --list
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.gemini/config/skills"
MODE="copy"
CATEGORY=""
SKILL_NAME=""
LIST_ONLY=0

CATEGORIES=("steven-skills" "stevtools" "design-guardrails" "creative-agency-video")

usage() {
  cat <<EOF
Uso: $(basename "$0") [opciones]

Opciones:
  --all                 Instalar todas las categorías (por defecto)
  --category <nombre>   Instalar solo una categoría:
                        steven-skills | stevtools | design-guardrails | creative-agency-video
  --skill <nombre>      Instalar una skill específica por nombre de carpeta
  --target <ruta>       Carpeta destino (por defecto: ~/.gemini/config/skills)
  --link                Crear enlaces simbólicos (symlinks) en vez de copiar
  --list                Listar categorías y skills disponibles sin instalar
  -h, --help            Mostrar esta ayuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) CATEGORY=""; SKILL_NAME=""; shift ;;
    --category) CATEGORY="${2:-}"; shift 2 ;;
    --skill) SKILL_NAME="${2:-}"; shift 2 ;;
    --target) TARGET_DIR="${2:-}"; shift 2 ;;
    --link) MODE="link"; shift ;;
    --list) LIST_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; usage; exit 1 ;;
  esac
done

list_skills() {
  for cat in "${CATEGORIES[@]}"; do
    local cat_dir="${REPO_ROOT}/${cat}"
    [[ -d "$cat_dir" ]] || continue
    echo "[$cat]"
    for d in "$cat_dir"/*/; do
      [[ -f "${d}SKILL.md" ]] || continue
      echo "  - $(basename "$d")"
    done
  done
}

if [[ "$LIST_ONLY" -eq 1 ]]; then
  list_skills
  exit 0
fi

install_one_skill() {
  local src_dir="$1"
  local name
  name="$(basename "$src_dir")"
  local dest_dir="${TARGET_DIR}/${name}"

  if [[ "$MODE" == "link" ]]; then
    rm -rf "$dest_dir"
    ln -s "$src_dir" "$dest_dir"
    echo "  [link] $name -> $dest_dir"
  else
    rm -rf "$dest_dir"
    mkdir -p "$dest_dir"
    cp -R "${src_dir}/." "$dest_dir/"
    find "$dest_dir" -name ".DS_Store" -delete 2>/dev/null || true
    echo "  [copy] $name -> $dest_dir"
  fi
}

mkdir -p "$TARGET_DIR"
COUNT=0

if [[ -n "$SKILL_NAME" ]]; then
  FOUND=""
  for cat in "${CATEGORIES[@]}"; do
    if [[ -f "${REPO_ROOT}/${cat}/${SKILL_NAME}/SKILL.md" ]]; then
      FOUND="${REPO_ROOT}/${cat}/${SKILL_NAME}"
      break
    fi
  done
  if [[ -z "$FOUND" ]]; then
    echo "Error: no se encontró la skill '${SKILL_NAME}'." >&2
    exit 1
  fi
  echo "Instalando skill '${SKILL_NAME}' en ${TARGET_DIR} (modo: ${MODE})..."
  install_one_skill "$FOUND"
  COUNT=1
else
  SELECTED_CATS=("${CATEGORIES[@]}")
  if [[ -n "$CATEGORY" ]]; then
    if [[ ! -d "${REPO_ROOT}/${CATEGORY}" ]]; then
      echo "Error: categoría inválida '${CATEGORY}'." >&2
      exit 1
    fi
    SELECTED_CATS=("$CATEGORY")
  fi

  echo "Instalando skills en ${TARGET_DIR} (modo: ${MODE})..."
  for cat in "${SELECTED_CATS[@]}"; do
    local_cat="${REPO_ROOT}/${cat}"
    [[ -d "$local_cat" ]] || continue
    echo "==> ${cat}"
    for d in "$local_cat"/*/; do
      [[ -f "${d}SKILL.md" ]] || continue
      install_one_skill "${d%/}"
      COUNT=$((COUNT + 1))
    done
  done
fi

echo ""
echo "Listo: ${COUNT} skill(s) instaladas en ${TARGET_DIR}."
