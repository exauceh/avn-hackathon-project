"""
Module de stockage partagé pour les réponses en attente.
Utilisé par main.py et pubsub_handler.py.
"""
import threading

# Stockage global thread-safe
pending_responses = {}
pending_lock = threading.Lock()
RESPONSE_TIMEOUT = 60  # secondes
