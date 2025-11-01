FROM python:3.11-slim

WORKDIR /app

# Copier requirements
COPY cloud/services/api-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY cloud/services/api-gateway/ .

ENV PORT=8080
# ✅ Forcer Python à ne pas bufferiser stdout/stderr
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

# ✅ Configuration gunicorn avec capture des logs
CMD exec gunicorn \
    --bind :$PORT \
    --workers 1 \
    --threads 8 \
    --timeout 300 \
    --worker-class gthread \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    --log-level info \
    main:app