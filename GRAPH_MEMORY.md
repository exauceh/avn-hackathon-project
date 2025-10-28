# Gestion de la Mémoire du Graphe

## Architecture

### Frontend (Extension Chrome)
- **Stockage** : `chrome.storage.local` via `background.js`
- **Structure** : 
  ```javascript
  {
    session_id: "session_...",
    messages: [{role, content, timestamp}],
    conversation_history: [{type, content, timestamp, page_context}],
    search_results: [],
    user_email: "user@example.com",
    user_preferences: {},
    last_action: {type, timestamp, ...}
  }
  ```

### Backend (API Gateway + Agents)
- **Stockage temporaire** : Mémoire serveur (`storage.py`)
- **Durée de vie** : 1 heure par session
- **Structure** : Identique au frontend + métadonnées serveur

## Flux de données

1. **Requête utilisateur** :
   - Frontend : Ajoute message à `graphState.messages`
   - Envoie `graph_state` complet dans le contexte
   - Sauvegarde dans `chrome.storage.local`

2. **Traitement backend** :
   - `pubsub_listener.py` : Extrait `graph_state` du contexte
   - `graph_agent.py` : Restaure historique des messages (10 derniers)
   - Utilise `session_id` pour LangGraph checkpointing

3. **Réponse agent** :
   - Frontend : Ajoute réponse à `graphState.messages`
   - Met à jour `last_action` et `search_results`
   - Sauvegarde état mis à jour

## API Endpoints

### `/process` (POST)
Envoie transcription + contexte incluant `graph_state`

### `/graph_state/<session_id>` (GET)
Récupère l'état du graphe depuis le serveur

### `/graph_state/<session_id>` (DELETE)
Supprime l'état du graphe (fin de session)

## Messages Chrome Runtime

### `reset_graph_state`
Réinitialise la session (nouveau `session_id`)

### `get_graph_state`
Récupère l'état actuel du graphe

### `set_user_email`
Met à jour l'email utilisateur

## Persistance

- **Frontend** : Persistant entre fermetures de popup
- **Backend** : Temporaire (1h), nettoyage automatique
- **LangGraph** : MemorySaver avec checkpoint par `thread_id`

## Avantages

✅ Continuité conversationnelle
✅ Contexte multi-pages
✅ Résultats de recherche persistants
✅ Actions précédentes disponibles
✅ Sync frontend/backend
