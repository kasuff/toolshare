# DORA-Exporter mit eingebackener App (analog zu prometheus/grafana/loki).
FROM python:3.12-slim

WORKDIR /app

# Nur requirements zuerst kopieren → bessere Layer-Caches.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dora.py report.py app.py ./

# Matplotlib-Cache in beschreibbares Verzeichnis legen (Container läuft non-root-fähig).
ENV MPLCONFIGDIR=/tmp/mpl

EXPOSE 9110

# State-Volume (persistente Counter); wird in docker-compose gemountet.
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:9110/health').status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9110"]
