# Architecture de la Gestion de Mémoire du Graphe

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Chrome Extension)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐         ┌──────────────────┐                   │
│  │  Popup UI      │         │  Background.js   │                   │
│  │  - Bouton 🔄   │◄────────┤  - graphState    │                   │
│  │  - Transcript  │         │  - loadState()   │                   │
│  └────────────────┘         │  - saveState()   │                   │
│                              │  - resetState()  │                   │
│                              └────────┬─────────┘                   │
│                                       │                              │
│                                       ▼                              │
│                          ┌─────────────────────┐                    │
│                          │ chrome.storage.local│                    │
│                          │  Persistant         │                    │
│                          │  Illimité           │                    │
│                          └─────────────────────┘                    │
│                                       │                              │
└───────────────────────────────────────┼──────────────────────────────┘
                                        │
                                        │ HTTP POST /process
                                        │ + graph_state dans context
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (API Gateway + Agents)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      main.py (Flask)                          │  │
│  │                                                                │  │
│  │  POST /process                                                │  │
│  │  ├─ Reçoit text + context (avec graph_state)                 │  │
│  │  ├─ Stocke dans storage.graph_states[session_id]            │  │
│  │  └─ Publie sur Pub/Sub                                       │  │
│  │                                                                │  │
│  │  GET /graph_state/<session_id>                               │  │
│  │  └─ Retourne l'état stocké                                   │  │
│  │                                                                │  │
│  │  DELETE /graph_state/<session_id>                            │  │
│  │  └─ Supprime l'état                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    storage.py                                 │  │
│  │                                                                │  │
│  │  graph_states = {                                             │  │
│  │    "session_123": {                                           │  │
│  │      "state": {...},                                          │  │
│  │      "timestamp": 1730105678                                  │  │
│  │    }                                                           │  │
│  │  }                                                             │  │
│  │                                                                │  │
│  │  graph_states_lock = threading.Lock()                        │  │
│  │  GRAPH_STATE_TIMEOUT = 3600 (1h)                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│                           │ Pub/Sub                                 │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               pubsub_listener.py                              │  │
│  │                                                                │  │
│  │  1. Reçoit message Pub/Sub                                   │  │
│  │  2. Extrait graph_state du context                           │  │
│  │  3. Passe à agent.process_request(                           │  │
│  │       user_message,                                           │  │
│  │       context,                                                │  │
│  │       session_id,                                             │  │
│  │       graph_state  ◄── ICI                                   │  │
│  │     )                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  graph_agent.py                               │  │
│  │                                                                │  │
│  │  process_request(user_message, context, session_id,          │  │
│  │                  graph_state):                                │  │
│  │                                                                │  │
│  │    # Restaurer l'historique                                  │  │
│  │    if graph_state and graph_state.get("messages"):           │  │
│  │      messages = []                                            │  │
│  │      for msg in graph_state["messages"][-10:]:  # 10 derniers│  │
│  │        if msg["role"] == "user":                             │  │
│  │          messages.append(HumanMessage(...))                  │  │
│  │        elif msg["role"] == "assistant":                      │  │
│  │          messages.append(AIMessage(...))                     │  │
│  │                                                                │  │
│  │    # Ajouter le message actuel                               │  │
│  │    messages.append(HumanMessage(user_message))               │  │
│  │                                                                │  │
│  │    # Utiliser search_results et last_action précédents       │  │
│  │    previous_search_results = graph_state.get("search_results")│  │
│  │    previous_action = graph_state.get("last_action")          │  │
│  │                                                                │  │
│  │    # Créer l'état initial avec l'historique                  │  │
│  │    initial_state = {                                          │  │
│  │      "messages": messages,  ◄── Historique restauré         │  │
│  │      "search_results": previous_search_results,              │  │
│  │      "action": previous_action,                              │  │
│  │      ...                                                       │  │
│  │    }                                                           │  │
│  │                                                                │  │
│  │    # Exécuter le graphe avec checkpointing                   │  │
│  │    config = {"configurable": {"thread_id": session_id}}      │  │
│  │    final_state = self.graph.invoke(initial_state, config)    │  │
│  │                                                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                          │
│                           │ LangGraph StateGraph                    │
│                           │ + MemorySaver (checkpoint)              │
│                           │                                          │
│  ┌────────────────┬──────┴─────┬────────────────┐                  │
│  │                │            │                 │                  │
│  ▼                ▼            ▼                 ▼                  │
│ SearchAgent   NavigationAgent  FormAgent    ResponseGen            │
│ (Cas #1)      (Cas #2)         (Cas #3)     (Fallback)             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           │ Réponse + audio
                           ▼
                    Pub/Sub Response
                           │
                           ▼
                    API Gateway (listener)
                           │
                           ▼
                    Frontend (polling)
                           │
                           ▼
                    Mise à jour graphState
                    + Sauvegarde chrome.storage.local
```

## Flux de Données Détaillé

### 1. Requête Utilisateur

```
User clicks mic → Speech recorded → Transcript ready
                                    │
                                    ▼
                        background.js: sendTranscriptionToServer()
                                    │
                                    ├─► Ajoute à graphState.messages:
                                    │   {
                                    │     role: "user",
                                    │     content: "Search for AI news",
                                    │     timestamp: "2025-10-28T10:00:00"
                                    │   }
                                    │
                                    ├─► Ajoute à conversation_history:
                                    │   {
                                    │     type: "user_message",
                                    │     content: "...",
                                    │     timestamp: "...",
                                    │     page_context: {url, title}
                                    │   }
                                    │
                                    ├─► saveGraphState()
                                    │   └─► chrome.storage.local.set()
                                    │
                                    └─► POST /process
                                        Body: {
                                          text: "Search for AI news",
                                          context: {
                                            url: "...",
                                            title: "...",
                                            content: {...},
                                            graph_state: {
                                              session_id: "session_xxx",
                                              messages: [...],
                                              search_results: [...],
                                              last_action: {...}
                                            }
                                          }
                                        }
```

### 2. Backend Processing

```
main.py: /process
    │
    ├─► Extrait graph_state du context
    │
    ├─► Stocke dans storage.graph_states[session_id]
    │   {
    │     "state": graph_state,
    │     "timestamp": time.time()
    │   }
    │
    └─► Publie sur Pub/Sub (voice.input)
            │
            ▼
    pubsub_listener.py: process_message()
            │
            ├─► Extrait graph_state du context
            │
            └─► agent.process_request(
                  user_message="Search for AI news",
                  context={...},
                  session_id="session_xxx",
                  graph_state={...}  ◄── Passé ici
                )
                    │
                    ▼
    graph_agent.py: process_request()
            │
            ├─► Restaure les 10 derniers messages:
            │   for msg in graph_state["messages"][-10:]:
            │     if msg["role"] == "user":
            │       messages.append(HumanMessage(msg["content"]))
            │     elif msg["role"] == "assistant":
            │       messages.append(AIMessage(msg["content"]))
            │
            ├─► Ajoute le message actuel:
            │   messages.append(HumanMessage(user_message))
            │
            ├─► Récupère search_results et last_action précédents
            │
            ├─► Crée initial_state avec l'historique
            │
            └─► Exécute le graphe:
                config = {"configurable": {"thread_id": session_id}}
                final_state = graph.invoke(initial_state, config)
                    │
                    │ LangGraph routing + MemorySaver checkpointing
                    │
                    ▼
                Router → SearchAgent → Response
                    │
                    └─► Retourne: {
                          text: "J'ai trouvé 3 articles...",
                          action: {...},
                          search_results: [...]
                        }
```

### 3. Réponse et Mise à Jour

```
pubsub_listener.py
    │
    ├─► Génère audio (TTS)
    │
    └─► Publie sur Pub/Sub (avn-agent-response)
            │
            ▼
API Gateway: pubsub_handler.py
    │
    └─► Stocke dans pending_responses
            │
            ▼
Frontend: background.js (polling)
    │
    ├─► Reçoit la réponse
    │
    ├─► handleAgentResponse()
    │   │
    │   ├─► Ajoute à graphState.messages:
    │   │   {
    │   │     role: "assistant",
    │   │     content: "J'ai trouvé 3 articles...",
    │   │     timestamp: "2025-10-28T10:00:05"
    │   │   }
    │   │
    │   ├─► Ajoute à conversation_history:
    │   │   {
    │   │     type: "agent_response",
    │   │     content: "...",
    │   │     action: {...},
    │   │     timestamp: "..."
    │   │   }
    │   │
    │   ├─► Met à jour search_results
    │   │
    │   ├─► Met à jour last_action
    │   │
    │   └─► saveGraphState()
    │       └─► chrome.storage.local.set()
    │
    └─► Joue l'audio
```

## Points Clés

### Persistance
- **Frontend** : `chrome.storage.local` (permanent)
- **Backend** : Mémoire serveur (1h)
- **LangGraph** : MemorySaver avec thread_id

### Thread-Safety
- **Backend** : `threading.Lock` sur `graph_states`
- **Frontend** : Single-threaded (pas de problème)

### Performance
- **Limite** : 10 derniers messages pour l'agent
- **Overhead** : 2-5 KB par requête
- **Nettoyage** : Automatique côté serveur (1h)

### Isolation
- **Sessions** : Isolées par `session_id`
- **Thread ID** : LangGraph utilise `session_id` comme `thread_id`
- **Pas de conflit** : Chaque session a son propre état

## Avantages

✅ **Continuité conversationnelle** : L'agent se souvient de tout
✅ **Multi-pages** : Contexte conservé lors de la navigation
✅ **Robuste** : Thread-safe, gestion timeouts
✅ **Performant** : Impact minimal
✅ **Extensible** : Facile d'ajouter des champs
✅ **Testable** : Tests complets fournis
