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

## Structure du Projet

```
avn-hackathon-project/
├── core/
│   ├── agents/
│   │   ├── ml_agent.py            # Agent principal ML
│   │   ├── credentials.py         # Gestionnaire GCP
│   │   └── voice_input_mock.py    # Mock équipe C pour tests
├── tests/
│   └── test_ml_agent.py           # Tests de l'agent
├── requirements.txt               # Dépendances Python
├── Dockerfile                     # Configuration Docker
├── cloudbuild.yaml               # CI/CD Google Cloud
└── .env                          # Configuration (à créer)
```

## Utilisation

### Test de l'Agent

```bash
python -m tests.test_ml_agent
```

### Utilisation Programmatique

```python
from core.agents.ml_agent import PlanningAgent

# Initialiser l'agent
agent = PlanningAgent()

# Traiter une entrée vocale
voice_input = {"text": "Quelle est la météo aujourd'hui ?"}
result = agent.process_voice_input(voice_input)

print(f"Intent: {result.intent}")
print(f"Action: {result.action}")
```

## Technologies Utilisées

- **Google Vertex AI / Gemini 2.0** : Traitement du langage naturel
- **Python Flask** : Framework web
- **Google Cloud Pub/Sub** : Communication inter-équipes
- **Docker** : Conteneurisation
- **Google Cloud Build** : CI/CD

## Développement

### Sprints

Le projet est organisé en 4 sprints (voir `sprints_file.txt` pour les détails).

### Tests

```bash
# Exécuter tous les tests
python -m pytest tests/

# Test spécifique de l'agent
python -m tests.test_ml_agent
```

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

## Équipe A - Responsabilités

### Modules Assignés

- **3.1** : Réception des données équipe C
- **3.2** : Traitement ML avec Gemini
- **3.5** : Génération des intents structurés
- **3.6** : Communication avec équipe B

### Deliverables Sprint 1

- Agent de planification fonctionnel
- Intégration Gemini AI
- Tests unitaires
- Documentation technique

## Dépannage

### Erreurs Communes

**404 Publisher Model not found**
- Vérifier que l'API Generative Language est activée
- Confirmer les permissions du service account
- Vérifier la région configurée

**Credentials manquants**
- Vérifier le fichier `.env`
- Confirmer le chemin vers le fichier JSON
- Tester avec `python -m tests.test_ml_agent`

## Contact

**Équipe A - Agent ML**
- Repository : https://github.com/exauceh/avn-hackathon-project
- Branch : feat/agent-ml

## Licence

Projet de hackathon ESIGELEC - Usage académique