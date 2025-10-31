FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les requirements
COPY core/agents/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copier le code
COPY core/agents/ .

ENV PORT=8080
EXPOSE 8080

# Utiliser gunicorn pour la production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 4 --timeout 600 pubsub_listener:app