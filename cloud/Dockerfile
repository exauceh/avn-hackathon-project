# Utilise une image Python légère
FROM python:3.11-slim

# Définit le dossier de travail
WORKDIR /app

# Copie le code source
COPY . .

# Installe Flask pour créer un mini serveur web
RUN pip install --no-cache-dir -r requirements.txt

ENV FLASK_APP=src/main.py
# Définit la variable d'environnement du port (Cloud Run utilise $PORT)
ENV PORT=8080

# Expose le port pour exécution locale
EXPOSE 8080

# Commande de démarrage (mini serveur Flask)
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8080"]
