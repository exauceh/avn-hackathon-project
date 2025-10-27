# /cloud/services/websocket-gateway/Dockerfile
# ... (Partie installation) ...

# Ancien CMD :
# CMD exec gunicorn --bind :$PORT --workers 1 main:app

# Nouvel CMD : Pour garantir un seul thread d'exécution pour l'écoute Pub/Sub
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --worker-class gthread main:app