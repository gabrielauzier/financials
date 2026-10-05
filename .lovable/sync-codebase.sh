#!/usr/bin/env bash
# Sincroniza uma versão da codebase exportada do Lovable (.zip) com a pasta web/ do projeto.
#
# Uso:
#   .lovable/sync-codebase.sh [opções] [<zip>]
#
#   <zip>   Caminho de um .zip, ou só o nome dentro de .lovable/codebases
#           (com ou sem ".zip", ex.: v2-accounts-categories). Sem argumento, usa o zip mais recente.
#
# Opções:
#   -n, --dry-run    Mostra o que mudaria e não altera nada.
#   -y, --yes        Não pede confirmação.
#       --no-delete  Não remove de web/ arquivos que não existem no zip (só copia/atualiza).
#   -l, --list       Lista os zips disponíveis e sai.
#   -h, --help       Mostra esta ajuda.
#
# Comportamento:
#   - O zip é extraído em uma pasta temporária; se tiver uma única pasta na raiz, ela é usada como raiz.
#   - web/ vira um espelho do zip (arquivos ausentes no zip são removidos, salvo com --no-delete).
#   - Nunca tocam em web/: node_modules/, .git/, .env* e yarn.lock (configuração e lockfile locais).
#     Se web/ ainda não tiver .env e o zip tiver, o .env do zip é copiado uma única vez.
#   - Tudo que for sobrescrito ou removido é copiado antes para .lovable/backups/<data-hora>/,
#     para recuperar ajustes locais (ex.: correções feitas à mão em package.json).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ZIP_DIR="$SCRIPT_DIR/codebases"
BACKUP_ROOT="$SCRIPT_DIR/backups"
DEST="$PROJECT_ROOT/web"

DRY_RUN=0
ASSUME_YES=0
DELETE=1
ZIP_ARG=""

usage() { sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "erro: $*" >&2; exit 1; }

list_zips() {
  [ -d "$ZIP_DIR" ] || die "pasta $ZIP_DIR não existe"
  local found=0
  # mais recentes primeiro
  while IFS= read -r f; do
    found=1
    printf '  %s\n' "$(basename "$f")"
  done < <(ls -1t "$ZIP_DIR"/*.zip 2>/dev/null || true)
  [ "$found" -eq 1 ] || echo "  (nenhum .zip em $ZIP_DIR)"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run) DRY_RUN=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    --no-delete) DELETE=0 ;;
    -l|--list) echo "Zips em .lovable/codebases (mais recentes primeiro):"; list_zips; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "opção desconhecida: $1 (use --help)" ;;
    *) [ -z "$ZIP_ARG" ] || die "informe apenas um zip"; ZIP_ARG="$1" ;;
  esac
  shift
done

command -v ditto >/dev/null 2>&1 || command -v unzip >/dev/null || die "ditto ou unzip não encontrado"
command -v rsync >/dev/null || die "rsync não encontrado"
[ -d "$DEST" ] || die "pasta de destino não existe: $DEST"

# --- resolve o zip --------------------------------------------------------
resolve_zip() {
  local arg="$1"
  if [ -z "$arg" ]; then
    local latest
    latest="$(ls -1t "$ZIP_DIR"/*.zip 2>/dev/null | head -n1 || true)"
    [ -n "$latest" ] || die "nenhum .zip em $ZIP_DIR"
    echo "$latest"; return
  fi
  local candidate
  for candidate in "$arg" "$arg.zip" "$ZIP_DIR/$arg" "$ZIP_DIR/$arg.zip"; do
    if [ -f "$candidate" ]; then
      (cd "$(dirname "$candidate")" && echo "$PWD/$(basename "$candidate")"); return
    fi
  done
  echo "zip não encontrado: $arg" >&2
  echo "Disponíveis:" >&2
  list_zips >&2
  exit 1
}

ZIP_FILE="$(resolve_zip "$ZIP_ARG")"
if command -v unzip >/dev/null 2>&1; then
  unzip -tq "$ZIP_FILE" >/dev/null 2>&1 || die "arquivo zip inválido ou corrompido: $ZIP_FILE"
fi

# --- extrai em pasta temporária --------------------------------------------
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lovable-sync.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
# No macOS o `ditto` extrai nomes com acento (UTF-8) corretamente; o `unzip` do sistema falha neles.
if command -v ditto >/dev/null 2>&1; then
  ditto -x -k --norsrc --noextattr "$ZIP_FILE" "$TMP_DIR" || die "falha ao extrair $ZIP_FILE"
else
  unzip -q -o "$ZIP_FILE" -d "$TMP_DIR" || die "falha ao extrair $ZIP_FILE"
fi
rm -rf "$TMP_DIR/__MACOSX"
find "$TMP_DIR" -name '.DS_Store' -type f -delete

# se houver uma única pasta na raiz do zip (e nenhum arquivo solto), usa-a como raiz
SRC="$TMP_DIR"
entries=("$TMP_DIR"/* "$TMP_DIR"/.[!.]*)
real=()
for e in "${entries[@]}"; do [ -e "$e" ] && real+=("$e"); done
if [ "${#real[@]}" -eq 1 ] && [ -d "${real[0]}" ]; then SRC="${real[0]}"; fi

[ -f "$SRC/package.json" ] || die "o zip não parece uma codebase web (sem package.json na raiz): $(basename "$ZIP_FILE")"

# --- rsync ------------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
# -c: compara por conteúdo (as datas dentro do zip são todas 1980, então só tamanho/data não serve).
# Itens protegidos (nunca sobrescritos nem removidos): dependências, git, configuração local (.env*) e o
# lockfile do gerenciador usado localmente (yarn.lock).
RSYNC_ARGS=(-a -c --itemize-changes --exclude 'node_modules/' --exclude '.git/' --exclude '.env*' --exclude 'yarn.lock')
[ "$DELETE" -eq 1 ] && RSYNC_ARGS+=(--delete)

plan="$(rsync "${RSYNC_ARGS[@]}" --dry-run "$SRC"/ "$DEST"/ | grep -E '^(>f|\*deleting)' || true)"
created="$(printf '%s\n' "$plan" | grep -c '^>f+++' || true)"
deleted="$(printf '%s\n' "$plan" | grep -c '^\*deleting' || true)"
# ">f+++++++++" é criação; ">f.st......" etc. é atualização
updated=$(( $(printf '%s\n' "$plan" | grep -c '^>f') - created ))

echo "Zip:      $(basename "$ZIP_FILE")"
echo "Destino:  $DEST"
echo "Resumo:   $created novos, $updated atualizados, $deleted removidos$([ "$DELETE" -eq 0 ] && echo ' (remoção desligada)')"
echo
if [ -n "$plan" ]; then
  printf '%s\n' "$plan" | sed -E -e 's/^>f\+{3,} /  + /' -e 's/^>f[^ ]* /  ~ /' -e 's/^\*deleting +/  - /' | head -n 80
  total="$(printf '%s\n' "$plan" | wc -l | tr -d ' ')"
  [ "$total" -le 80 ] || echo "  … e mais $((total - 80)) arquivo(s)"
else
  echo "  (nenhuma diferença)"
fi
echo

if [ "$DRY_RUN" -eq 1 ]; then
  echo "dry-run: nada foi alterado."
  exit 0
fi

[ -n "$plan" ] || { echo "web/ já está igual ao zip."; exit 0; }

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Aplicar em web/? Arquivos sobrescritos/removidos vão para .lovable/backups/%s [s/N] ' "$STAMP"
  read -r answer
  case "$answer" in s|S|y|Y) ;; *) echo "cancelado."; exit 1 ;; esac
fi

if [ ! -e "$DEST/.env" ] && [ -f "$SRC/.env" ]; then
  cp "$SRC/.env" "$DEST/.env"
  echo "web/.env não existia: copiado do zip."
fi

mkdir -p "$BACKUP_DIR"
rsync "${RSYNC_ARGS[@]}" --backup --backup-dir="$BACKUP_DIR" "$SRC"/ "$DEST"/ >/dev/null

backed="$(find "$BACKUP_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [ "$backed" -eq 0 ]; then rmdir "$BACKUP_DIR" 2>/dev/null || true; fi

echo "ok: web/ sincronizado com $(basename "$ZIP_FILE")."
[ "$backed" -eq 0 ] || echo "backup de $backed arquivo(s) em .lovable/backups/$STAMP"
echo "Próximos passos: cd web && yarn install && yarn typecheck && yarn lint && yarn test"
