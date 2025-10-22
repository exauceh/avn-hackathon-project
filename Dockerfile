# Utilise une image Python légère
FROM python:3.11-slim

# Définit le dossier de travail
WORKDIR /app

# Copie le code source
COPY . .

# Installe Flask pour créer un mini serveur web
RUN pip install --no-cache-dir -r requirements.txt


# Définit la variable d'environnement du port (Cloud Run utilise $PORT)
ENV PORT=8080

# Expose le port pour exécution locale
EXPOSE 8080

# Lance directement le serveur Flask
CMD ["python", "core/api/app.py"]

