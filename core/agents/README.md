# Équipe A - Agent de Planification ML

## Rôle
Traitement des commandes vocales avec Gemini AI pour génération d'intentions structurées et réponses automatiques.

## Flux de données
```
Équipe C (Mock Input) → Équipe A (Gemini AI) → Interface Web → Équipe B (Future)
```

## Setup complet

### 1. Installation des dépendances
```bash
pip install -r requirements.txt
```

### 2. Configuration Google Cloud Platform

#### A. Créer un projet GCP
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un existant
3. Noter l'ID du projet (ex: `avn-hackathon-project`)

#### B. Activer les APIs nécessaires
```bash
# Dans Cloud Shell ou avec gcloud CLI
gcloud services enable aiplatform.googleapis.com
gcloud services enable vertexai.googleapis.com
```

#### C. Créer un compte de service
1. Aller dans "IAM et administration" > "Comptes de service"
2. Cliquer "Créer un compte de service"
3. Nom: `vertex-ai-agent` 
4. Rôles requis:
   - `Vertex AI User`
   - `AI Platform Developer`
5. Créer et télécharger la clé JSON

#### D. Configuration du fichier .env
Créer un fichier `.env` à la racine du projet :
```bash
# Credentials Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=avn-hackathon-project-[ID].json
GOOGLE_CLOUD_PROJECT=avn-hackathon-project

# Configuration Vertex AI
VERTEX_AI_REGION=europe-west1
VERTEX_AI_MODEL=gemini-1.5-flash

# Configuration serveur (optionnel)
FLASK_PORT=5000
FLASK_DEBUG=true

# Logging (optionnel)
LOG_LEVEL=INFO
SUPPRESS_GCP_WARNINGS=true
```

#### E. Sécurité - Important !
Le fichier JSON contient des credentials sensibles :
- Déjà ajouté dans `.gitignore` 
- Ne JAMAIS commiter ce fichier
- Ne pas partager le contenu

### 3. Lancement de l'interface web
```bash
python tests/server.py
```
Puis ouvrir http://localhost:5000

### 4. Test de l'agent seul
```bash
python tests/test_agent.py
```

## Structure équipe A
```
core/agents/
├── credentials.py          # Gestionnaire credentials GCP
├── ml_agent.py            # Agent principal avec Gemini
├── voice_input_mock.py    # Mock équipe C pour simulation
└── README.md              # Documentation

tests/
├── interface.html         # Interface web avec sidebar historique
├── server.py             # Serveur Flask avec API
└── test_agent.py         # Tests unitaires
```

## Fonctionnalités Interface

### Mode Automatique
- Questions aléatoires envoyées à intervalles réguliers
- Réponses instantanées de l'IA Gemini
- Contrôle de l'intervalle en temps réel (1-60 secondes)

### Mode Manuel
- Saisie directe de questions personnalisées
- Traitement immédiat par l'agent ML

### Historique
- Sidebar à gauche style Claude AI
- Conservation des 50 dernières conversations
- Navigation simple dans l'historique
- Métadonnées : source (Manuel/Auto), timestamp

### API Endpoints
- `GET /api/history` : Récupération historique
- `POST /api/history/clear` : Vider l'historique
- `GET /api/random-question` : Question aléatoire
- `POST /api/process-question` : Traitement par IA

## Gestion des coûts et ressources

### Facturation Google Cloud
- **Vertex AI Gemini** : Facturé par token de requête/réponse uniquement
- **Pas de services permanents** : Aucun coût en arrière-plan
- **Coût estimé** : ~0.001€ par question-réponse (très faible)

### Surveillance des coûts
1. **Google Cloud Console** > "Facturation" > "Budgets et alertes"
2. Créer une alerte à 5€/mois pour être prévenu
3. Monitoring usage : Cloud Console > "Vertex AI" > "Quotas"

### Arrêt du projet
**Rien à arrêter !** Le projet n'utilise que des APIs à la demande :
- Pas de VM, clusters ou services permanents
- Pas de base de données cloud
- Coût = 0€ quand non utilisé

### Optimisation des coûts
- Limiter l'intervalle automatique pour réduire les appels
- Mode manuel pour contrôler précisément l'usage
- Historique local (pas de stockage cloud)

## Sécurité
- Fichier JSON dans .gitignore
- Variables sensibles dans .env (pas dans le code)
- Authentification via service account
- Suppression des warnings GCP en production

## Tests disponibles
- `tests/test_agent.py` : Tests unitaires avec suppression warnings
- `tests/server.py` : Interface web complète avec historique
- Mode simulation automatique et manuel