# Servicio de respaldos ClubMaster — MySQL 9 -> Backblaze B2 (S3)
# Se ejecuta UNA sola vez y termina (ideal para el Cron Schedule de Railway).
# NO es un daemon: hace dump -> gzip -> sube a B2 -> verifica -> aplica retención -> sale.
FROM mysql:9

# Dependencias mínimas: Python 3.11 + pip + gzip + certificados.
# Python 3.11 explícito (no el 3.9 por defecto de Oracle Linux 9): boto3 dejó de
# soportar Python 3.9 en 2026-04-29. Patrón oficial de Oracle para OL9:
#   microdnf install -y python3.11 python3.11-pip && python3.11 -m pip install ...
# La imagen oficial mysql:9 está basada en Oracle Linux (microdnf),
# pero se deja el fallback a apt-get por si la base cambia a Debian.
RUN if command -v microdnf >/dev/null 2>&1; then \
      microdnf install -y python3.11 python3.11-pip gzip ca-certificates && microdnf clean all; \
    elif command -v dnf >/dev/null 2>&1; then \
      dnf install -y python3.11 python3.11-pip gzip ca-certificates && dnf clean all; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y --no-install-recommends python3 python3-pip gzip ca-certificates && rm -rf /var/lib/apt/lists/*; \
    else \
      echo "ERROR: no se encontró microdnf/dnf/apt-get" >&2; exit 1; \
    fi

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python3.11 -m pip install --no-cache-dir -r /app/requirements.txt

COPY backup.py /app/backup.py
RUN chmod 644 /app/backup.py

# Una sola ejecución y termina. Railway lo invoca con su Cron Schedule.
CMD ["python3.11", "/app/backup.py"]
