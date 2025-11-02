# Architecture du Projet AVN Hackathon

## Vue d'ensemble
Projet d'automatisation web basé sur une architecture microservices déployée sur Google Cloud Platform (GCP), avec une extension Chrome comme interface utilisateur.

## Composants principaux

### 1. Frontend - Extension Chrome
**Dossier:** [frontend/](frontend/)

- **Interface utilisateur:** [popup/popup.html](frontend/popup/popup.html) avec styles [popup/popup.css](frontend/popup/popup.css)
- **Scripts principaux:**
  - [scripts/background.js](frontend/scripts/background.js) - Service worker en arrière-plan
  - [scripts/content.js](frontend/scripts/content.js) - Injection dans les pages web
  - [scripts/popup-stt.js](frontend/scripts/popup-stt.js) - Reconnaissance vocale (Speech-to-Text)
  - [popup/popup.js](frontend/popup/popup.js) - Logique du popup
  - [offscreen.js](offscreen.js) - Document offscreen pour traitement en arrière-plan
- **Configuration:** [manifest.json](frontend/manifest.json)

### 2. API Gateway
**Dossier:** [cloud/services/api-gateway/](cloud/services/api-gateway/)

- **Point d'entrée:** [main.py](cloud/services/api-gateway/main.py)
- **Stockage:** [storage.py](cloud/services/api-gateway/storage.py)
- **Framework:** Flask
- **Déploiement:** Cloud Run (région europe-west9)
- **Configuration:**
  - Mémoire: 2Gi
  - Timeout: 300s
  - Max instances: 5
  - Accès non authentifié

### 3. Agents - Backend Intelligence
**Dossier:** [core/agents/](core/agents/)

Microservices spécialisés pour différentes tâches d'automatisation:

- [search_agent.py](core/agents/search_agent.py) - Recherche web
- [navigation_agent.py](core/agents/navigation_agent.py) - Navigation automatisée
- [form_agent.py](core/agents/form_agent.py) - Remplissage de formulaires
- [reading_agent.py](core/agents/reading_agent.py) - Extraction d'informations
- [graph_agent.py](core/agents/graph_agent.py) - Orchestration et graphe d'agents
- [pubsub_listener.py](core/agents/pubsub_listener.py) - Écoute d'événements Pub/Sub

**Déploiement:** Cloud Run
- Mémoire: 4Gi
- CPU: 2 vCPU
- Timeout: 600s
- Max instances: 5

## Infrastructure GCP

### Build et déploiement
**Fichier:** [cloudbuild.yaml](cloudbuild.yaml)

Pipeline CI/CD automatisé:
1. Trigger Cloud Build apres push sur github
2. Build des images Docker (API Gateway + Agents)
3. Push vers Google Container Registry (GCR)
4. Déploiement sur Cloud Run

### Secrets et configuration
- **GOOGLE_API_KEY** - API Gemini
- **CUSTOM_SEARCH_CX** - ID du moteur de recherche personnalisé
- **GOOGLE_SEARCH_API_KEY** - Clé API Google Search
- **Service Account:** `avn-account@avn-hackathon-project.iam.gserviceaccount.com`

### Dockerfiles
- [Dockerfile](Dockerfile) - Image de base Python 3.11
- [cloud/services/api-gateway/Dockerfile](cloud/services/api-gateway/Dockerfile) - Gateway Flask
- [core/agents/Dockerfile](core/agents/Dockerfile) - Services agents

## Flux de données

### Vue d'ensemble
```
┌─────────────────────────────────────────────────────────────────────┐
│                     Extension Chrome (Frontend)                      │
│  popup-stt.js → background.js → content.js                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 1. HTTP POST /api/v1/query
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (Cloud Run)                           │
│  • Reçoit requête + contexte page                                   │
│  • Génère request_id unique                                          │
│  • Stocke dans storage.py (en mémoire)                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 2. Pub/Sub Publish
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Topic: "frontend_input"                           │
│  Message: {request_id, transcription, page_context, graph_state}    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 3. Push Subscription
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  Agents Backend (Cloud Run)                          │
│  pubsub_listener.py                                                  │
│         ↓                                                            │
│  graph_agent.py (orchestrateur)                                      │
│    ├─→ search_agent.py                                              │
│    ├─→ navigation_agent.py                                          │
│    ├─→ form_agent.py                                                │
│    └─→ reading_agent.py                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 4. Pub/Sub Publish
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Topic: "agent-response"                            │
│  Message: {request_id, response_text, audio_base64, actions}        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 5. Push Subscription
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (Cloud Run)                           │
│  • Reçoit réponse via /agent-response                              │
│  • Stocke dans storage.py avec request_id                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 6. Polling HTTP GET
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Extension Chrome (Frontend)                      │
│  background.js → offscreen.js (lecture audio TTS)                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Technologies utilisées

- **Frontend:** JavaScript, Chrome Extension APIs
- **Backend:** Python 3.11, Flask
- **IA:** Google Gemini API
- **Infrastructure:** Google Cloud Run, Container Registry, Cloud Build
- **Orchestration:** Cloud Build, Pub/Sub


## Régions de déploiement
- **Principale:** europe-west9 (Paris)