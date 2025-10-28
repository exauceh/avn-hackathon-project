"""
Module de stockage partagé pour les réponses en attente.
Utilisé par main.py et pubsub_handler.py.
"""
import threading

# Stockage global thread-safe pour les réponses
pending_responses = {}
pending_lock = threading.Lock()
RESPONSE_TIMEOUT = 60  # secondes

# Stockage de l'état du graphe par session (optionnel, backup côté serveur)
graph_states = {}
graph_states_lock = threading.Lock()
GRAPH_STATE_TIMEOUT = 3600  # 1 heure
