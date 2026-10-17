#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Respaldo ClubMaster: mysqldump (MySQL 9) -> gzip -> Backblaze B2 (API S3).

Ejecución única: termina con código 0 en éxito, != 0 en cualquier fallo.
NUNCA imprime contraseñas ni claves en los logs.

Variables de entorno (todas obligatorias salvo las marcadas opcional):
  MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE
  BACKUP_S3_ENDPOINT   (ej: https://s3.us-west-004.backblazeb2.com)
  BACKUP_S3_BUCKET
  BACKUP_S3_ACCESS_KEY (keyID de B2)
  BACKUP_S3_SECRET_KEY (applicationKey de B2)
  BACKUP_S3_REGION     (opcional; si no se da se deriva del endpoint, ej: us-west-004)
  MIN_DUMP_BYTES       (opcional, default 10240 = 10 KB)
  RETENTION_DAILY      (opcional, default 7)
  RETENTION_WEEKLY     (opcional, default 4)
  BACKUP_PREFIX        (opcional, default "" ; ej: "clubmaster/")
"""

import gzip
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
except ImportError:
    print("[backup] ERROR: falta boto3. El Dockerfile debe instalar requirements.txt", flush=True)
    sys.exit(1)


FILENAME_RE = re.compile(r"^clubmaster-(\d{4})-(\d{2})-(\d{2})-(\d{4})\.sql\.gz$")
DEFAULT_MIN_BYTES = 10240  # 10 KB: un dump gzip real de ClubMaster es mucho mayor


def log(msg):
    print(f"[backup] {msg}", flush=True)


def fail(msg, code=1):
    # Mensaje claro, sin secretos.
    print(f"[backup] ERROR: {msg}", flush=True)
    sys.exit(code)


def get_env(name, default=None, required=True):
    val = os.environ.get(name, default)
    if required and (val is None or str(val).strip() == ""):
        fail(f"falta la variable de entorno obligatoria {name} (revise README de backup-service)")
    return str(val).strip() if val is not None else val


def derive_region(endpoint, explicit):
    if explicit and explicit.strip():
        return explicit.strip()
    m = re.search(r"s3\.([^.]+)\.backblazeb2\.com", endpoint or "")
    if m:
        return m.group(1)
    return "us-east-005"  # región S3 genérica de B2 como fallback


def build_s3_client(endpoint, bucket, access_key, secret_key, region):
    # s3v4 es obligatorio para B2. address_style 'auto' funciona con virtual-hosted de B2.
    cfg = Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"})
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=cfg,
    )


def run_mysqldump(host, port, user, password, database, dest_gz_path):
    """mysqldump --single-transaction --routines --triggers, comprimido con gzip."""
    cmd = [
        "mysqldump",
        f"--host={host}",
        f"--port={port}",
        f"--user={user}",
        "--single-transaction",
        "--routines",
        "--triggers",
        "--events",
        "--set-gtid-purged=OFF",
        "--hex-blob",
        database,
    ]
    log(f"generando volcado de '{database}' desde '{host}:{port}' "
        f"(mysqldump --single-transaction --routines --triggers --events | gzip)...")
    env = dict(os.environ)
    env["MYSQL_PWD"] = password  # evita exponer la clave en la línea de comandos / ps
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env
        )
    except FileNotFoundError:
        fail("no se encontró el binario 'mysqldump' en el PATH (la imagen debe ser mysql:9)")
    with gzip.open(dest_gz_path, "wb", compresslevel=6) as gz:
        assert proc.stdout is not None
        shutil.copyfileobj(proc.stdout, gz)
    _, stderr = proc.communicate()
    if proc.returncode != 0:
        err = (stderr or b"").decode("utf-8", "replace")[:500]
        # Nunca incluimos la contraseña: el mensaje de mysqldump no la trae, pero por
        # seguridad reemplazamos cualquier coincidencia accidental.
        err = err.replace(password, "***")
        fail(f"mysqldump terminó con código {proc.returncode}. Detalle: {err or 'sin detalle'}")
    log("mysqldump terminó OK (código 0).")


def verify_local_file(path, min_bytes):
    if not os.path.exists(path):
        fail(f"no se generó el archivo local {path}")
    size = os.path.getsize(path)
    log(f"archivo local: {os.path.basename(path)} ({size} bytes)")
    if size == 0:
        fail("el volcado quedó VACÍO (0 bytes). No se sube nada. Revise credenciales/conectividad MySQL.")
    if size < min_bytes:
        fail(f"volcado sospechosamente pequeño ({size} bytes < mínimo {min_bytes}). "
             f"Posible dump incompleto o base vacía. No se sube nada.")
    # Validez del gzip: intenta leer el encabezado y un bloque.
    try:
        with gzip.open(path, "rb") as f:
            chunk = f.read(1024)
            if not chunk:
                fail("el .gz descomprime vacío (0 bytes reales). No se sube nada.")
    except OSError as e:
        fail(f"el archivo no es un gzip válido: {e}. No se sube nada.")
    return size


def verify_dump_content(path):
    """Verifica que el volcado esté COMPLETO antes de subirlo:
    - mysqldump con código 0 (ya validado en run_mysqldump)
    - línea final '-- Dump completed' (pie de un volcado completo)
    - al menos un 'CREATE TABLE' (contiene tablas)
    - al menos un 'INSERT INTO' (contiene datos)
    Cualquier fallo termina el proceso con error y NO se sube nada."""
    n_tables = 0
    n_inserts = 0
    last_line = b""
    try:
        with gzip.open(path, "rb") as f:
            for line in f:
                if line.startswith(b"CREATE TABLE"):
                    n_tables += 1
                elif line.startswith(b"INSERT INTO"):
                    n_inserts += 1
                stripped = line.strip()
                if stripped:
                    last_line = stripped
    except (OSError, EOFError) as e:
        fail(f"el volcado está dañado o truncado al descomprimirlo: {e}. No se sube nada.")
    if n_tables == 0:
        fail("el volcado NO contiene ninguna sentencia 'CREATE TABLE' "
             "(dump incompleto o base equivocada). No se sube nada.")
    if n_inserts == 0:
        fail("el volcado NO contiene ninguna sentencia 'INSERT INTO' "
             "(dump sin datos o incompleto). No se sube nada.")
    if not last_line.startswith(b"-- Dump completed"):
        tail = last_line[:80].decode("utf-8", "replace")
        fail(f"el volcado NO termina correctamente: falta la línea final "
             f"'-- Dump completed' (última línea: '{tail}'). Dump truncado. No se sube nada.")
    log(f"volcado íntegro: {n_tables} tablas (CREATE TABLE), {n_inserts} sentencias "
        f"INSERT, pie '-- Dump completed' presente.")


def upload_and_verify(s3, bucket, local_path, key):
    size_local = os.path.getsize(local_path)
    log(f"subiendo a s3://{bucket}/{key} ...")
    try:
        s3.upload_file(local_path, bucket, key)
    except ClientError as e:
        fail(f"falló la subida a B2 (bucket '{bucket}'). Detalle: {e} "
             f"(verifique BACKUP_S3_ENDPOINT/BUCKET/KEYS y CORS del bucket)")
    except Exception as e:  # noqa: BLE001
        fail(f"falló la subida a B2 (bucket '{bucket}'). Detalle: {type(e).__name__}")
    # Verificación post-subida: el objeto debe existir y el tamaño debe coincidir.
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except ClientError as e:
        fail(f"la subida no se pudo confirmar: HeadObject falló para '{key}'. Detalle: {e}")
    size_remote = int(head.get("ContentLength", -1))
    log(f"verificación remota: s3://{bucket}/{key} existe ({size_remote} bytes)")
    if size_remote != size_local:
        fail(f"el tamaño remoto ({size_remote}) NO coincide con el local ({size_local}). "
             f"Copia descartada como no confiable; bórrela del bucket si es necesario.")
    log("verificación OK: el tamaño remoto coincide con el local.")
    return size_remote


def list_backups(s3, bucket, prefix):
    paginator = s3.get_paginator("list_objects_v2")
    items = []
    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix or ""):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                base = key[len(prefix):] if prefix and key.startswith(prefix) else key.rsplit("/", 1)[-1]
                m = FILENAME_RE.match(base)
                if not m:
                    continue
                try:
                    dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                                  int(m.group(4)[:2]), int(m.group(4)[2:]), tzinfo=timezone.utc)
                except ValueError:
                    continue
                items.append({"Key": key, "dt": dt, "Size": obj.get("Size", 0)})
    except ClientError as e:
        fail(f"no se pudo listar el bucket '{bucket}' para la retención. Detalle: {e}")
    items.sort(key=lambda x: x["dt"], reverse=True)
    return items


def apply_retention(s3, bucket, prefix, daily, weekly):
    """Conserva las últimas `daily` copias + 4 semanales (1 por semana ISO), borra el resto."""
    backups = list_backups(s3, bucket, prefix)
    log(f"copias encontradas en el bucket: {len(backups)} "
        f"(política: {daily} diarias + {weekly} semanales)")
    if len(backups) <= daily:
        log("retención: nada que borrar (hay menos copias que el mínimo diario).")
        return

    keep_keys = set()
    daily_keep = backups[:daily]
    for b in daily_keep:
        keep_keys.add(b["Key"])

    # Semanales: de las copias MÁS ANTIGUAS que la ventana diaria, 1 por semana ISO.
    seen_weeks = set()
    weekly_keep = []
    for b in backups[daily:]:
        iso_year, iso_week, _ = b["dt"].isocalendar()
        wk = (iso_year, iso_week)
        if wk in seen_weeks:
            continue
        seen_weeks.add(wk)
        weekly_keep.append(b)
        keep_keys.add(b["Key"])
        if len(weekly_keep) >= weekly:
            break

    to_delete = [b for b in backups if b["Key"] not in keep_keys]
    if not to_delete:
        log("retención: nada que borrar.")
        return

    log(f"retención: se conservan {len(keep_keys)} "
        f"({len(daily_keep)} diarias + {len(weekly_keep)} semanales), "
        f"se borrarán {len(to_delete)}.")
    for b in to_delete:
        key = b["Key"]
        log(f"retención: borrando {key} ...")
        try:
            s3.delete_object(Bucket=bucket, Key=key)
        except ClientError as e:
            fail(f"no se pudo borrar '{key}' del bucket. Detalle: {e}")
        # Verificación del borrado (importante en B2): el objeto ya no debe existir.
        # Con "Keep only the last version", este delete libera el espacio de inmediato.
        try:
            s3.head_object(Bucket=bucket, Key=key)
            # Si head responde, el objeto SIGUE ahí: el borrado no fue efectivo.
            fail(f"el borrado de '{key}' no fue efectivo: el objeto sigue existiendo "
                 f"(revise versionado/lifecycle del bucket en B2).")
        except ClientError as e:
            code = str(e.response.get("ResponseMetadata", {}).get("HTTPStatusCode", ""))
            err_code = str(e.response.get("Error", {}).get("Code", ""))
            if code == "404" or err_code in ("404", "NoSuchKey", "NotFound"):
                log(f"retención: borrado confirmado para {key} (ya no existe en B2, espacio liberado).")
            else:
                fail(f"no se pudo confirmar el borrado de '{key}'. Detalle: {e}")


def main():
    log("inicio del respaldo ClubMaster (MySQL 9 -> B2)")

    host = get_env("MYSQLHOST")
    port = get_env("MYSQLPORT", default="3306", required=False)
    user = get_env("MYSQLUSER")
    password = os.environ.get("MYSQLPASSWORD", "")
    if not password:
        fail("falta la variable de entorno obligatoria MYSQLPASSWORD")
    database = get_env("MYSQLDATABASE")

    endpoint = get_env("BACKUP_S3_ENDPOINT")
    bucket = get_env("BACKUP_S3_BUCKET")
    access_key = get_env("BACKUP_S3_ACCESS_KEY")
    secret_key = get_env("BACKUP_S3_SECRET_KEY")
    region = derive_region(endpoint, os.environ.get("BACKUP_S3_REGION", ""))
    prefix = os.environ.get("BACKUP_PREFIX", "").strip()
    if prefix and not prefix.endswith("/"):
        prefix += "/"

    try:
        min_bytes = int(os.environ.get("MIN_DUMP_BYTES", str(DEFAULT_MIN_BYTES)))
    except ValueError:
        min_bytes = DEFAULT_MIN_BYTES
    try:
        daily = int(os.environ.get("RETENTION_DAILY", "7"))
        weekly = int(os.environ.get("RETENTION_WEEKLY", "4"))
    except ValueError:
        daily, weekly = 7, 4

    # Nombre con fecha y hora (UTC): clubmaster-AAAA-MM-DD-HHMM.sql.gz
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M")
    filename = f"clubmaster-{stamp}.sql.gz"
    key = f"{prefix}{filename}" if prefix else filename

    s3 = build_s3_client(endpoint, bucket, access_key, secret_key, region)
    log(f"destino: {endpoint} / bucket '{bucket}' / región '{region}'")

    tmpdir = tempfile.mkdtemp(prefix="clubmaster-backup-")
    local_path = os.path.join(tmpdir, filename)
    try:
        run_mysqldump(host, port, user, password, database, local_path)
        verify_local_file(local_path, min_bytes)
        verify_dump_content(local_path)
        upload_and_verify(s3, bucket, local_path, key)
        apply_retention(s3, bucket, prefix, daily, weekly)
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass

    log(f"respaldo COMPLETADO: {key}")
    sys.exit(0)


if __name__ == "__main__":
    main()
