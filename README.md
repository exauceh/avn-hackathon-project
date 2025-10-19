# AVN Hackathon Project - Assistant Vocal Numérique

## Description du Projet

Projet de hackathon développant un Assistant Vocal Numérique (AVN) avec architecture microservices. Notre équipe (Équipe A) est responsable de l'Agent de Planification ML utilisant Google Gemini AI.

## Architecture Générale

### Organisation des Équipes

- **Équipe A** (nous) : Agent de Planification ML (modules 3.1, 3.2, 3.5, 3.6)
- **Équipe B** : Orchestrateur et Interface Web
- **Équipe C** : Gestion Vocale (Input/Output)  
- **Équipe D** : Base de Données et Persistance

### Flux de Données

```
Équipe C (Voice Input) → Équipe A (ML Processing) → Équipe B (Orchestration) → Interface Utilisateur
```

## Configuration Requise

### Prérequis

- Python 3.8+
- Compte Google Cloud Platform
- Service Account avec permissions Vertex AI
- Docker (optionnel)

### Variables d'Environnement

Créer un fichier `.env` à la racine du projet :

```env
# Configuration GCP pour l'équipe A - Agent de Planification ML
GOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json
GOOGLE_CLOUD_PROJECT=avn-hackathon-project
GOOGLE_CLOUD_REGION=europe-west9

# Configuration Agent ML
AGENT_NAME=planning_agent_ml
GEMINI_MODEL=gemini-2.0-flash-001
LOG_LEVEL=INFO
```

### Installation

1. Cloner le repository
```bash
git clone https://github.com/exauceh/avn-hackathon-project.git
cd avn-hackathon-project
```

2. Installer les dépendances
```bash
pip install -r requirements.txt
```

3. Configurer les credentials GCP
   - Placer le fichier JSON du service account dans le dossier racine
   - Créer le fichier `.env` avec la configuration ci-dessus

### Tests et Utilisation

#### Interface Web (Recommandé)
```bash
# Lancer l'interface web complète
python tests/server.py
```
Puis ouvrir http://localhost:5000

**Fonctionnalités disponibles :**
- Mode automatique : Questions aléatoires à intervalles configurables
- Mode manuel : Saisie directe de questions
- Historique conversationnel avec sidebar
- Contrôles de timing en temps réel
- API REST pour intégration

#### Tests en ligne de commande
```bash
# Test unitaire de l'agent ML
python tests/test_agent.py

# Test programmatique direct
python -c "
from core.agents.ml_agent import PlanningAgent
agent = PlanningAgent()
result = agent.process_voice_input({'text': 'Quelle est la météo ?'})
print(f'Intent: {result.intent}, Action: {result.action}')
"
```

## Structure du Projet

```
avn-hackathon-project/
├── core/
│   ├── agents/
│   │   ├── ml_agent.py            # Agent principal ML avec Gemini
│   │   ├── credentials.py         # Gestionnaire GCP
│   │   ├── voice_input_mock.py    # Mock équipe C pour simulation
│   │   └── README.md              # Documentation technique détaillée
├── tests/
│   ├── interface.html             # Interface web avec sidebar historique
│   ├── server.py                  # Serveur Flask avec API REST
│   └── test_agent.py              # Tests unitaires
├── requirements.txt               # Dépendances Python
├── Dockerfile                     # Configuration Docker
├── cloudbuild.yaml               # CI/CD Google Cloud
└── .env                          # Configuration (à créer)
```

## Technologies Utilisées

- **Google Vertex AI / Gemini AI** : Traitement du langage naturel et génération de réponses
- **Python Flask** : Serveur web et API REST
- **HTML/CSS/JavaScript** : Interface web professionnelle
- **Git** : Contrôle de version avec branches feature
- **Google Cloud Platform** : Infrastructure et authentification

## Développement

### État Actuel (Sprint 1 - Terminé)

**Agent ML fonctionnel** avec Gemini AI intégré
**Interface web complète** avec historique conversationnel  
**Tests unitaires** avec suppression des warnings GCP
**Documentation** technique exhaustive
**API REST** pour intégration future avec équipes B et C

### Structure de Tests

#### Interface Web (`tests/server.py` + `tests/interface.html`)
- Serveur Flask avec endpoints API
- Interface style Claude AI avec sidebar historique
- Modes automatique et manuel
- Gestion des intervalles de timing configurables
- Stockage local des conversations (50 dernières)

#### Tests Unitaires (`tests/test_agent.py`)
- Tests de l'agent ML avec validation des réponses
- Suppression des warnings Google Cloud
- Validation de la configuration GCP

### Déploiement

```bash
# Build Docker
docker build -t avn-agent-ml .

# Déploiement via Google Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## Configuration GCP

### APIs Requises

- Vertex AI API
- Generative Language API
- Cloud Resource Manager API

### Permissions Service Account

- `Vertex AI User`
- `AI Platform Developer`
- `Project Viewer`

### Modèles Supportés

- gemini-2.0-flash-001 (recommandé)
- gemini-2.5-flash
- gemini-2.5-pro


### Deliverables Sprint 1 - Réalisés

- **Agent de planification ML** : Intégration complète Gemini AI avec gestion des intentions
- **Interface web professionnelle** : Simulation temps réel avec historique conversationnel
- **Tests complets** : Unitaires (ligne de commande) + Interface web interactive
- **Documentation technique** : Setup GCP, configuration
- **Architecture sécurisée** : Credentials protégés, warnings supprimés 
- **API REST** : Endpoints pour historique, questions et traitement ML

### API Endpoints Disponibles

L'interface web expose plusieurs endpoints REST pour l'intégration future :

- `GET /` : Interface web principale
- `GET /api/history` : Récupération de l'historique des conversations
- `POST /api/history/clear` : Vider l'historique
- `GET /api/random-question` : Génération de question aléatoire
- `POST /api/process-question` : Traitement d'une question par l'agent ML
- `GET /api/status` : Statut du serveur et configuration

**Format de réponse type :**
```json
{
  "intent": "weather_query",
  "action": "get_weather_info", 
  "confidence": 0.95,
  "response": "Je peux vous aider avec la météo...",
  "processing_time_ms": 150
}
```

## Dépannage

### Erreurs Communes

**404 Publisher Model not found**
- Vérifier que l'API Generative Language est activée
- Confirmer les permissions du service account
- Vérifier la région configurée


## Contact

**Équipe A - Agent ML**
- Repository : https://github.com/exauceh/avn-hackathon-project
- Branch : feat/agent-ml

## Licence

Projet de hackathon ESIGELEC - Usage académique