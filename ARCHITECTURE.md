# 🏗️ Architecture AVN - Diagrammes ASCII

## 📊 Vue d'Ensemble Globale

```
┌────────────────────────────────────────────────────────────────────┐
│                         UTILISATEUR                                 │
│                    (Personne malvoyante)                            │
└────────────────┬───────────────────────────┬───────────────────────┘
                 │                           │
            🎤 Voix                      👂 Audio
                 │                           │
                 ↓                           ↑
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND - Extension Chrome                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │   Popup      │  │  Background   │  │     Content.js         │  │
│  │   (UI)       │  │  (Worker)     │  │   (Injection DOM)      │  │
│  │              │  │               │  │                        │  │
│  │  • STT       │  │  • Contexte   │  │  • Extract page        │  │
│  │  • Hotword   │  │  • Polling    │  │  • Extract forms       │  │
│  │  • Status    │  │  • Actions    │  │  • Execute actions     │  │
│  └──────┬───────┘  └───────┬───────┘  └──────────┬─────────────┘  │
│         │                  │                      │                │
│         └──────────────────┼──────────────────────┘                │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                        HTTP REST
                    (JSON + Context)
                             │
                             ↓
┌────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY - Flask (Port 8080)                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Endpoints:                          Services:                     │
│  • POST /process        →            • Request pooling             │
│  • GET  /response/:id   →            • Response storage            │
│                                      • Google Cloud TTS            │
│  ┌────────────────┐                                                │
│  │  Pub/Sub       │    Publisher  →  Topic: voice.input            │
│  │  Integration   │    Subscriber →  Topic: avn-agent-response     │
│  └────────────────┘                                                │
│                                                                     │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                        Pub/Sub
                    (Asynchronous)
                             │
                             ↓
┌────────────────────────────────────────────────────────────────────┐
│                    GRAPHE ADK - LangGraph Agents                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              pubsub_listener.py                              │  │
│  │         (Écoute Pub/Sub + Orchestration)                     │  │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                           │                                        │
│                           ↓                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    graph_agent.py                            │  │
│  │              (Orchestrateur LangGraph)                       │  │
│  │                                                              │  │
│  │     ┌─────────┐                                              │  │
│  │     │ Router  │  (LLM décide quel agent activer)             │  │
│  │     └────┬────┘                                              │  │
│  │          │                                                   │  │
│  │  ┌───────┴────────┬────────────┬──────────────┐             │  │
│  │  │                │            │              │             │  │
│  │  ↓                ↓            ↓              ↓             │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │ │  Search  │ │  Navi-   │ │   Form   │ │ Response │       │  │
│  │ │  Agent   │ │  gation  │ │  Agent   │ │ Generator│       │  │
│  │ │          │ │  Agent   │ │          │ │          │       │  │
│  │ │ • Google │ │ • URL    │ │ • Detect │ │ • TTS    │       │  │
│  │ │   Search │ │   match  │ │   forms  │ │ • Audio  │       │  │
│  │ │ • Extract│ │ • Valida-│ │ • Fill   │ │          │       │  │
│  │ │ • Résumé │ │   tion   │ │   fields │ │          │       │  │
│  │ │   LLM    │ │ • Confirm│ │ • Submit │ │          │       │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  LLM Provider:                                                      │
│  • Google Gemini 2.0 (défaut)                                      │
│  • OpenAI GPT-4 (optionnel)                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de Données Détaillé

### Cas d'Usage #1 : Recherche et Résumé

```
┌─────────────┐
│ Utilisateur │  "Recherche les nouvelles sur l'IA"
└──────┬──────┘
       │ 🎤 Voix
       ↓
┌──────────────────┐
│  Web Speech API  │  Transcription STT
└──────┬───────────┘
       │ Text
       ↓
┌──────────────────────────────────────────────────┐
│ background.js                                     │
│                                                   │
│ 1. Capture contexte page:                        │
│    • URL                                          │
│    • Titre                                        │
│    • Contenu DOM                                  │
│                                                   │
│ 2. Envoie à l'API Gateway:                       │
│    POST /process                                  │
│    {                                              │
│      "text": "Recherche les nouvelles sur l'IA", │
│      "context": {                                 │
│        "url": "...",                              │
│        "title": "...",                            │
│        "user_email": "testeur@avn.com"            │
│      }                                            │
│    }                                              │
└──────┬───────────────────────────────────────────┘
       │ HTTP POST
       ↓
┌──────────────────────┐
│   API Gateway        │  Génère request_id
│   main.py            │  Stocke dans pending_responses
└──────┬───────────────┘
       │ Pub/Sub publish (topic: voice.input)
       ↓
┌────────────────────────────────────────────────────┐
│ pubsub_listener.py                                 │
│                                                    │
│ 1. Reçoit message Pub/Sub                         │
│ 2. Extrait: request_id, text, context             │
│ 3. Appelle graph_agent.process_request()          │
└──────┬─────────────────────────────────────────────┘
       │
       ↓
┌────────────────────────────────────────────────────┐
│ graph_agent.py (LangGraph)                         │
│                                                    │
│ État initial:                                      │
│ {                                                  │
│   "messages": [HumanMessage("Recherche...")],     │
│   "current_url": "...",                            │
│   "user_email": "testeur@avn.com",                │
│   "search_results": [],                            │
│   ...                                              │
│ }                                                  │
│                                                    │
│ ┌──────────────────────────────────────┐          │
│ │ Node: Router                         │          │
│ │ • Analyse le message avec LLM        │          │
│ │ • Détecte mot-clé "Recherche"        │          │
│ │ • Décide: next_agent = "search"      │          │
│ └──────┬───────────────────────────────┘          │
│        │                                           │
│        ↓                                           │
│ ┌──────────────────────────────────────┐          │
│ │ Node: SearchAgent                    │          │
│ │                                      │          │
│ │ 1. Effectue Google Search (3 URLs)  │          │
│ │    • Résultat 1: "Google Gemini..." │          │
│ │    • Résultat 2: "Régulations UE"   │          │
│ │    • Résultat 3: "OpenAI GPT-5"     │          │
│ │                                      │          │
│ │ 2. Extrait pour chaque:              │          │
│ │    • Titre                           │          │
│ │    • URL                             │          │
│ │    • Snippet (BeautifulSoup)         │          │
│ │                                      │          │
│ │ 3. Génère résumé avec LLM:           │          │
│ │    Prompt: "Résume ces 3 articles    │          │
│ │             de manière concise..."   │          │
│ │                                      │          │
│ │ 4. Met à jour l'état:                │          │
│ │    state["search_results"] = [...]   │          │
│ │    state["response_text"] = "J'ai    │          │
│ │      trouvé 3 articles..."           │          │
│ │    state["needs_confirmation"] = True│          │
│ └──────┬───────────────────────────────┘          │
│        │                                           │
│        ↓                                           │
│ ┌──────────────────────────────────────┐          │
│ │ Node: Response                       │          │
│ │ • Retourne la réponse finale         │          │
│ └──────────────────────────────────────┘          │
│                                                    │
│ État final:                                        │
│ {                                                  │
│   "response_text": "J'ai trouvé 3 articles...",   │
│   "search_results": [{rank:1, title, url}, ...],  │
│   "action": {"type": "info", "data": [...]},      │
│   "needs_confirmation": true                       │
│ }                                                  │
└──────┬─────────────────────────────────────────────┘
       │ Retourne résultat
       ↓
┌────────────────────────────────────────────────────┐
│ pubsub_listener.py                                 │
│                                                    │
│ 1. Reçoit résultat du graphe                      │
│ 2. Génère TTS avec Google Cloud:                  │
│    text_to_speech("J'ai trouvé 3 articles...")    │
│    → audio_base64                                  │
│ 3. Publie sur Pub/Sub (topic: avn-agent-response):│
│    {                                               │
│      "request_id": "req_abc123",                   │
│      "text": "J'ai trouvé 3 articles...",         │
│      "audio": "base64...",                         │
│      "action": {"type": "info"},                   │
│      "search_results": [...]                       │
│    }                                               │
└──────┬─────────────────────────────────────────────┘
       │ Pub/Sub publish
       ↓
┌──────────────────────┐
│ API Gateway          │  Reçoit via Pub/Sub subscriber
│ pubsub_handler.py    │  Stocke dans pending_responses[request_id]
└──────┬───────────────┘
       │ Response prête
       ↓
┌──────────────────────────────────────────────────┐
│ background.js (polling)                           │
│                                                   │
│ Boucle toutes les secondes:                      │
│   GET /response/req_abc123                       │
│                                                   │
│ Reçoit:                                           │
│ {                                                 │
│   "text": "J'ai trouvé 3 articles...",           │
│   "audio": "base64...",                           │
│   "action": {"type": "info"},                    │
│   "search_results": [...]                         │
│ }                                                 │
│                                                   │
│ 1. Stocke search_results en session              │
│ 2. Décode audio base64                            │
│ 3. Joue audio via offscreen.js                   │
└──────┬───────────────────────────────────────────┘
       │ 🔊 Audio
       ↓
┌─────────────┐
│ Utilisateur │  Écoute : "J'ai trouvé 3 articles..."
└─────────────┘
```

---

## 🧭 Cas d'Usage #2 : Navigation Guidée (Simplifié)

```
User: "Ouvre le premier article"
  ↓
Router (LLM) → next_agent = "navigation"
  ↓
NavigationAgent:
  • Récupère search_results du contexte
  • Identifie article #1 via LLM
  • Génère action: {
      type: "navigate",
      url: "https://blog.google/...",
      method: "direct"
    }
  • Génère réponse avec confirmation
  ↓
background.js reçoit l'action
  ↓
Exécute: chrome.tabs.update(tabId, { url: "..." })
  ↓
content.js détecte page_loaded
  • Extrait nouveau document.title
  • Envoie au background
  ↓
Agent confirme: "Vous êtes sur Google. Titre: 'Lancement Gemini'..."
  ↓
TTS → Audio → Utilisateur
```

---

## 📝 Cas d'Usage #3 : Formulaire (Simplifié)

```
User: "Inscris-toi à la newsletter"
  ↓
Router → next_agent = "form"
  ↓
FormAgent:
  • Analyse page_content.forms du contexte
  • Identifie formulaire de newsletter
  • Récupère user_email du contexte
  • Génère confirmation
  ↓
User: "Oui, soumets"
  ↓
FormAgent:
  • Génère action: {
      type: "fill_and_submit",
      form_id: "newsletter-form",
      fields: [{name: "email", value: "testeur@avn.com"}]
    }
  ↓
content.js reçoit l'action
  • Trouve le formulaire
  • Remplit le champ email
  • Soumet le formulaire
  ↓
Confirmation: "Formulaire soumis avec succès"
```

---

## 🔁 État Partagé (AgentState)

```
AgentState = {
  // Conversation
  "messages": [
    HumanMessage("Recherche..."),
    AIMessage("J'ai trouvé...")
  ],
  
  // Contexte de page
  "current_url": "https://example.com",
  "page_title": "Example Page",
  "page_content": {
    "main_sections": [...],
    "forms": [...]
  },
  
  // Résultats de recherche (session)
  "search_results": [
    {rank: 1, title: "...", url: "...", snippet: "..."},
    ...
  ],
  
  // Article sélectionné
  "selected_article": {
    "url": "...",
    "title": "..."
  },
  
  // Contexte utilisateur
  "user_email": "testeur@avn.com",
  "user_preferences": {},
  
  // Routing
  "next_agent": "search" | "navigation" | "form" | "response",
  
  // Action à exécuter
  "action": {
    "type": "navigate" | "scroll" | "fill_and_submit" | "info",
    "data": {...}
  },
  
  // Réponse finale
  "response_text": "J'ai trouvé 3 articles...",
  "needs_confirmation": true | false
}
```

---

## 🎯 Décisions du Router (LLM)

```
User Input                    → Router Decision
────────────────────────────────────────────────────
"Recherche ..."               → search
"Trouve ..."                  → search
"Cherche ..."                 → search

"Ouvre ..."                   → navigation
"Va sur ..."                  → navigation
"Lis l'article ..."           → navigation
"Retour"                      → navigation
"Monte" / "Descends"          → navigation

"Inscris-toi ..."             → form
"Remplis le formulaire"       → form
"Soumets"                     → form

"Oui" / "Non" (après action)  → response (confirmation)
Questions générales           → response (défaut)
```

---

## 📡 Pub/Sub Topics & Messages

### Topic: `voice.input` (User → Agent)

```json
{
  "request_id": "req_abc123",
  "session_id": "req_abc123",
  "text": "Recherche les nouvelles sur l'IA",
  "context": {
    "url": "https://example.com",
    "title": "Example Page",
    "content": {...},
    "user_email": "testeur@avn.com",
    "search_results": []
  },
  "timestamp": "2025-10-27T10:30:00Z"
}
```

### Topic: `avn-agent-response` (Agent → User)

```json
{
  "request_id": "req_abc123",
  "text": "J'ai trouvé 3 articles principaux...",
  "audio": "base64_encoded_mp3_data",
  "action": {
    "type": "info",
    "data": [...]
  },
  "needs_confirmation": true,
  "search_results": [...],
  "context": {
    "url": "https://example.com",
    "title": "Example Page"
  }
}
```

---

## 🔄 Cycle de Vie d'une Requête

```
1. USER ACTION
   └─> Voix détectée (hotword ou Ctrl+Shift+L)

2. STT (Web Speech API)
   └─> Transcription textuelle

3. CONTEXT CAPTURE (content.js)
   └─> Extraction page (URL, titre, formulaires, etc.)

4. REQUEST (background.js → API Gateway)
   └─> POST /process avec text + context

5. POOLING (API Gateway)
   └─> Génère request_id, stocke en mémoire

6. PUB/SUB PUBLISH (voice.input)
   └─> Message avec request_id + text + context

7. AGENT PROCESSING (pubsub_listener.py)
   └─> Écoute Pub/Sub, traite avec graphe

8. GRAPH EXECUTION (graph_agent.py)
   ├─> Router: Décide de l'agent
   ├─> Agent: Traite la requête
   └─> Response: Génère le résultat

9. TTS GENERATION (Google Cloud)
   └─> text_to_speech() → audio base64

10. PUB/SUB PUBLISH (avn-agent-response)
    └─> Message avec text + audio + action

11. RESPONSE STORAGE (API Gateway)
    └─> pending_responses[request_id] = {...}

12. POLLING (background.js)
    └─> GET /response/:id toutes les secondes

13. ACTION EXECUTION (content.js)
    └─> Exécute navigate, scroll, fill_and_submit

14. AUDIO PLAYBACK (offscreen.js)
    └─> Joue l'audio base64

15. USER FEEDBACK
    └─> Écoute la réponse vocale
```

---

**📘 Pour plus de détails, consultez [README_DEMO.md](README_DEMO.md)**
