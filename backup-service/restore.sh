#!/usr/bin/env bash
# Restauración de una copia ClubMaster desde Backblaze B2 a una base MySQL nueva/vacía.
#
# Uso:
#   1) Copie .env.example a .env.restore y complete los valores (NO lo suba al repo).
#   2) Para ver las copias disponibles:
#        ./restore.sh --listar
#      Para restaurar la más reciente:
#        ./restore.sh --ultima
#      Para restaurar una copia puntual:
#        ./restore.sh clubmaster-AAAA-MM-DD-HHMM.sql.gz
#
# Requiere: aws CLI v2 (o awscli), gzip y mysql client.
#   Instalación rápida: pip install awscli  |  https://aws.amazon.com/cli/
#
# IMPORTANTE: restaure siempre en una base NUEVA/VACÍA de prueba primero.
#   Este script crea la base si no existe y pregunta confirmación antes de importar.
#   Nunca imprime contraseñas ni claves en pantalla.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Carga .env.restore si existe (formato CLAVE=valor, ignora comentarios).
if [[ -f "$SCRIPT_DIR/.env.restore" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env.restore"
  set +a
fi

: "${BACKUP_S3_ENDPOINT:?Falta BACKUP_S3_ENDPOINT (ej: https://s3.us-west-004.backblazeb2.com)}"
: "${BACKUP_S3_BUCKET:?Falta BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ACCESS_KEY:?Falta BACKUP_S3_ACCESS_KEY}"
: "${BACKUP_S3_SECRET_KEY:?Falta BACKUP_S3_SECRET_KEY}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
# Región S3 (B2 la exige aunque el endpoint ya la contenga).
if [[ -z "${BACKUP_S3_REGION:-}" ]]; then
  if [[ "$BACKUP_S3_ENDPOINT" =~ s3\.([^.]+)\.backblazeb2\.com ]]; then
    BACKUP_S3_REGION="${BASH_REMATCH[1]}"
  else
    BACKUP_S3_REGION="us-east-005"
  fi
fi
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"
PREFIX="${BACKUP_PREFIX:-}"

AWS_ARGS=(--endpoint-url "$BACKUP_S3_ENDPOINT" --region "$BACKUP_S3_REGION")

echo "[restore] Endpoint: $BACKUP_S3_ENDPOINT | Bucket: $BACKUP_S3_BUCKET | Región: $BACKUP_S3_REGION"

listar() {
  echo "[restore] Copias disponibles (más recientes primero):"
  aws s3 ls "s3://$BACKUP_S3_BUCKET/${PREFIX}" "${AWS_ARGS[@]}" \
    | grep -E 'clubmaster-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.sql\.gz' \
    | sort -r
}

ultima_key() {
  local key
  key=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/${PREFIX}" "${AWS_ARGS[@]}" \
    | grep -oE 'clubmaster-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.sql\.gz' \
    | sort -r | head -n 1)
  if [[ -z "$key" ]]; then
    echo "[restore] ERROR: no hay copias clubmaster-*.sql.gz en el bucket." >&2
    exit 1
  fi
  echo "${PREFIX}${key}"
}

if [[ "${1:-}" == "--listar" || "${1:-}" == "-l" ]]; then
  listar
  exit 0
fi

if [[ "${1:-}" == "--ultima" || "${1:-}" == "-u" || -z "${1:-}" ]]; then
  if [[ -z "${1:-}" ]]; then
    echo "Uso: $0 --listar | $0 --ultima | $0 <nombre-del-archivo>"
    echo "Sugerencia: use --listar para ver copias, o --ultima para la más reciente."
    exit 1
  fi
  REMOTE_KEY="$(ultima_key)"
else
  # Acepta tanto el nombre solo como una ruta con prefijo.
  base="$(basename "$1")"
  if [[ ! "$base" =~ ^clubmaster-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.sql\.gz$ ]]; then
    echo "[restore] ERROR: '$1' no tiene el formato clubmaster-AAAA-MM-DD-HHMM.sql.gz" >&2
    exit 1
  fi
  REMOTE_KEY="${PREFIX}${base}"
fi

: "${RESTORE_MYSQLHOST:?Falta RESTORE_MYSQLHOST (host de la base DESTINO, ej: su nuevo MySQL de Railway)}"
RESTORE_MYSQLPORT="${RESTORE_MYSQLPORT:-3306}"
: "${RESTORE_MYSQLUSER:?Falta RESTORE_MYSQLUSER}"
: "${RESTORE_MYSQLPASSWORD:?Falta RESTORE_MYSQLPASSWORD}"
: "${RESTORE_MYSQLDATABASE:?Falta RESTORE_MYSQLDATABASE (base destino, debe estar VACÍA)}"
export MYSQL_PWD="$RESTORE_MYSQLPASSWORD"

TMPDIR="$(mktemp -d -t clubmaster-restore-XXXXXX)"
trap 'rm -rf "$TMPDIR"' EXIT
LOCAL_GZ="$TMPDIR/$(basename "$REMOTE_KEY")"

echo "[restore] Descargando s3://$BACKUP_S3_BUCKET/$REMOTE_KEY ..."
aws s3 cp "s3://$BACKUP_S3_BUCKET/$REMOTE_KEY" "$LOCAL_GZ" "${AWS_ARGS[@]}"

SIZE=$(wc -c < "$LOCAL_GZ" | tr -d ' ')
echo "[restore] Descargado: $LOCAL_GZ ($SIZE bytes)"
if [[ "$SIZE" -eq 0 ]]; then
  echo "[restore] ERROR: el archivo descargado está vacío." >&2
  exit 1
fi
if ! gzip -t "$LOCAL_GZ"; then
  echo "[restore] ERROR: el archivo no es un gzip válido." >&2
  exit 1
fi
echo "[restore] Integridad gzip OK. Primeras tablas del dump:"
gzip -dc "$LOCAL_GZ" | grep -m 5 -E '^CREATE TABLE' || echo "(no se detectaron CREATE TABLE en las primeras líneas)"

echo ""
echo "==============================================================="
echo " Va a restaurar '$REMOTE_KEY'"
echo " en MySQL $RESTORE_MYSQLHOST:$RESTORE_MYSQLPORT / base '$RESTORE_MYSQLDATABASE'"
echo " (la base debe estar VACÍA; se creará si no existe)."
echo "==============================================================="
read -r -p "Escriba SI para continuar: " CONFIRM
if [[ "$CONFIRM" != "SI" ]]; then
  echo "[restore] Cancelado por el usuario."
  exit 1
fi

echo "[restore] Creando base '$RESTORE_MYSQLDATABASE' si no existe..."
mysql -h "$RESTORE_MYSQLHOST" -P "$RESTORE_MYSQLPORT" -u "$RESTORE_MYSQLUSER" \
  -e "CREATE DATABASE IF NOT EXISTS \`$RESTORE_MYSQLDATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[restore] Importando (esto puede tardar varios minutos)..."
gzip -dc "$LOCAL_GZ" | mysql -h "$RESTORE_MYSQLHOST" -P "$RESTORE_MYSQLPORT" \
  -u "$RESTORE_MYSQLUSER" "$RESTORE_MYSQLDATABASE"

echo "[restore] Verificando tablas restauradas..."
mysql -h "$RESTORE_MYSQLHOST" -P "$RESTORE_MYSQLPORT" -u "$RESTORE_MYSQLUSER" \
  -e "SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = '$RESTORE_MYSQLDATABASE';"

echo "[restore] RESTAURACIÓN COMPLETADA en base '$RESTORE_MYSQLDATABASE'."
echo "[restore] Pruebe su app apuntando a esa base antes de tocar producción."
