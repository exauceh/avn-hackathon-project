# 🚀 AVN Hackathon Project - Navigateur Vocal Agentique# AVN Planning Agent# AVN Planning Agent# 🤖 AVN Planning Agent - JavaScript# AVN Hackathon Project - Assistant Vocal Numérique



## 📖 Description



**AVN (Agent Vocal Navigator)** est un projet de hackathon développant un navigateur vocal intelligent utilisant des agents IA pour l'automation web. Le système permet aux utilisateurs de contrôler un navigateur web par commandes vocales, avec une orchestration intelligente des actions.Générateur de plans JSON pour l'orchestrateur web. Analyse les commandes vocales et produit des plans structurés pour l'équipe B (Orchestration).



## 🏗️ Architecture



### 🧠 Agent de Planification (Planning Agent)## Rôle et ResponsabilitésAgent de planification intelligent pour l'automatisation d'interactions web avec intégration Gemini AI.

- **Localisation** : `core/agents/PlanningAgent.js`

- **Rôle** : Génère des plans JSON structurés pour l'orchestrateur

- **Intégration** : Vertex AI (Gemini) avec fallback JavaScript

- **Mémoire** : Système de mémoire persistante pour éviter les analyses redondantes### Ce que fait cet agent



### 📁 Structure du Projet- **Analyse** les commandes vocales transcrites



```- **Génère** des plans JSON structurés ## Installation et DémarrageAgent de planification intelligent pour l'automatisation d'interactions web avec intégration Gemini AI.## Description du Projet

avn-hackathon-project/

├── core/- **Transmet** les plans à l'orchestrateur via API REST

│   └── agents/

│       ├── PlanningAgent.js      # Agent principal de planification- **Supporte** Gemini AI avec fallback sans IA

│       ├── MemoryManager.js      # Gestionnaire de mémoire

│       ├── credentials.js        # Configuration GCP/Vertex AI

│       └── data/

│           └── conversation_memory.txt### Ce que l'agent NE fait PAS### Prérequis

├── tests/

│   ├── server.js                 # Serveur Express de test- N'exécute pas les actions (rôle de l'orchestrateur)

│   ├── interface.html            # Interface web de test

│   └── test.js                   # Tests automatisés- Ne gère pas les outils web (rôle des équipes spécialisées)- Node.js (version 16 ou supérieure)

└── frontend/                     # Extension Chrome (Team D)

```- Ne gère pas STT/TTS (rôle de l'équipe B)



## 🎯 Fonctionnalités- Compte Google Cloud avec Vertex AI activé## 🚀 Démarrage RapideProjet de hackathon développant un Assistant Vocal Numérique (AVN) avec architecture microservices. Notre équipe (Équipe A) est responsable de l'Agent de Planification ML utilisant Google Gemini AI.



### ✅ Implémentées## Installation

- **Plans JSON structurés** avec actions numérotées

- **Gestion de mémoire** pour éviter les analyses DOM redondantes- Fichier de credentials GCP

- **Intégration Vertex AI** avec modèle Gemini 2.0 Flash

- **Fallback intelligent** sans IA```bash

- **Interface de test** web complète

- **API REST** pour orchestrationnpm install



### 🔄 Format de Plannpm test



```jsonnpm start### Installation

{

  "intent": "mot_cle_court",```

  "actions": {

    "1": "scroll_page",```bash```bash## Architecture Générale

    "2": "click_element", 

    "3": "speak_to_user"## API pour l'Orchestrateur

  },

  "arguments": {npm install

    "1": {"direction": "down", "amount": "medium"},

    "2": {"selector": "#login", "text": "connexion"},### Endpoint Principal

    "3": {"message": "J'ai fait défiler et cliqué sur connexion"}

  }```bash```# 1. Installation

}

```POST /agent/plan



### 🛠️ Actions DisponiblesContent-Type: application/json

- **Navigation** : `scroll_page`, `navigate_to`, `click_element`

- **Saisie** : `type_text`, `wait_element`

- **Extraction** : `extract_dom`, `extract_page_info`

- **Analyse** : `analyze_data` (délégué aux agents spécialisés){### Configurationnpm install### Organisation des Équipes

- **Communication** : `speak_to_user`, `clarify_question`

- **Orchestration** : `plan_next_steps` (rebouclage intelligent)  "text": "Descends sur la page puis clique sur connexion"



## 🚀 Installation & Démarrage}Configurez le fichier `.env` avec vos credentials Google Cloud :



### Prérequis```

- Node.js 18+

- Compte GCP avec Vertex AI activé```bash

- Fichier `.env` avec configuration GCP

### Réponse

### Configuration

```bash```jsonGOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json

# Cloner le projet

git clone https://github.com/exauceh/avn-hackathon-project.git{

cd avn-hackathon-project

  "intent": "scroll_and_click",GOOGLE_CLOUD_PROJECT=avn-hackathon-project# 2. Test de configuration- **Équipe A** (nous) : Agent de Planification ML (modules 3.1, 3.2, 3.5, 3.6)

# Installer les dépendances

npm install  "action": "scroll_page",



# Configurer l'environnement  "arguments": {GOOGLE_CLOUD_LOCATION=us-central1

cp .env.example .env

# Éditer .env avec vos credentials GCP    "direction": "down",

```

    "amount": "medium"GEMINI_MODEL=gemini-2.0-flash-001npm run test:quick- **Équipe B** : Orchestrateur et Interface Web

### Variables d'environnement (.env)

```env  },

GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account.json

GOOGLE_CLOUD_PROJECT_ID=your-project-id  "metadata": {PORT=5000

GOOGLE_CLOUD_LOCATION=us-central1

GEMINI_MODEL=gemini-2.0-flash-001    "processed_at": "2025-01-20T10:30:00Z",

```

    "agent_version": "1.0.0"```- **Équipe C** : Gestion Vocale (Input/Output)  

### Lancement

```bash  }

# Tests automatisés

npm test}



# Serveur de développement```

npm start

# Interface accessible sur http://localhost:5000/interface.html### Démarrage# 3. Démarrage du serveur- **Équipe D** : Base de Données et Persistance

```

## Structure des Plans JSON

## 🧪 API Endpoints

```bash

- `POST /api/plan` - Génération de plan principal

- `GET /api/history` - Consultation de l'historique### Actions Disponibles

- `DELETE /api/clear-memory` - Effacement de la mémoire

- `GET /api/stats` - Statistiques d'utilisation- **scroll_page** : `{direction: "up/down", amount: "small/medium/large"}`# Test de configurationnpm start

- `GET /api/health` - État de santé du service

- **click_element** : `{text: "bouton", selector: ".class"}`

## 🔧 Configuration Avancée

- **type_text** : `{selector: "input", text: "contenu"}`npm run test:quick

### Vertex AI Integration

- Modèle : Gemini 2.0 Flash 001- **navigate_to** : `{url: "https://example.com"}`

- Température : 0.3 (précision)

- Max tokens : 2048- **analyze_page** : `{focus: "all/forms/links"}`### Flux de Données

- TopP : 0.8

- **extract_info** : `{target: "title/text/links"}`

### Système de Mémoire

- **Stockage** : Fichier texte local- **wait_element** : `{selector: ".element", timeout: 5000}`# Démarrage du serveur

- **Limite** : Estimation de tokens pour éviter l'overflow

- **Format** : JSON structuré avec timestamps



## 🎯 Principes de Conception### Format Standardisénpm start# 4. Interface web



### 🚫 Règles StrictesTous les plans suivent cette structure :

- **Aucun à priori** sur les sélecteurs, pixels, ou éléments

- **Extraction DOM** avant action (si nécessaire)```json

- **Utilisation intelligente de la mémoire** pour éviter les redondances

- **Rebouclage planificateur** via `plan_next_steps` si besoin{



### 🔄 Workflow  "intent": "description_intention",# Interface web disponible sur http://localhost:5000# Ouvrir http://localhost:5000```

1. **Commande utilisateur** → Agent de planification

2. **Vérification mémoire** → Réutilisation si possible  "action": "nom_action", 

3. **Extraction DOM** → Si structure inconnue

4. **Plan d'actions** → Orchestrateur  "arguments": {```

5. **Exécution** → Retour utilisateur via TTS

    "param1": "valeur1"

## 🤝 Équipes & Responsabilités

  }```Équipe C (Voice Input) → Équipe A (ML Processing) → Équipe B (Orchestration) → Interface Utilisateur

- **Team A** : Agentique & ML (ce repository)

- **Team B** : GCP & Orchestration}

- **Team C** : Voix & I/O (STT/TTS)

- **Team D** : Frontend & Extension Chrome```## Architecture



## 📝 Exemples d'Usage



```javascript## Intégration avec l'Orchestrateur```

// Plan simple

"Descends sur la page" → scroll_page + speak_to_user



// Plan complexe (DOM connu)L'agent s'intègre dans le pipeline défini par l'équipe B :### Composants principaux

"Descends, clique produits, cherche laptop" → 

scroll + click + type + speak (6 actions)



// Plan avec extraction```- **PlanningAgent** : Agent principal de planification## 📋 Fonctionnalités

"Clique sur connexion" (DOM inconnu) → 

extract_dom + plan_next_stepsSTT → /agent/plan → Orchestrateur → Outils Web → TTS



// Plan avec analyse```- **GeminiProcessor** : Interface avec Vertex AI Gemini

"Combien de produits ?" → 

extract_dom + analyze_data + speak_to_user

```

### Flux de données- **ToolRegistry** : Registre des outils d'interaction web## Configuration Requise

## 📈 Statistiques

1. **STT** transcrit la voix en texte

Le système track automatiquement :

- Nombre total de requêtes2. **Agent** reçoit le texte via `/agent/plan`- **Serveur Express** : API REST et interface web

- Plans réussis/échoués

- Taux de succès3. **Agent** génère un plan JSON structuré

- Disponibilité Gemini

4. **Orchestrateur** exécute le plan via les outils appropriés### ✨ Agent de Planification

## 🔍 Développement

5. **TTS** verbalise la réponse

### Tests

```bash### Structure des fichiers

npm test              # Tests complets

npm run test:memory   # Tests mémoire seulement## Configuration

npm run test:plans    # Tests génération plans

``````- **Analyse de commandes vocales** en langage naturel### Prérequis



### Debug### Variables .env

```bash

npm run dev           # Mode développement avec logs```bashcore/agents/

npm run lint          # Vérification code style

```GOOGLE_CLOUD_PROJECT=avn-hackathon-project



## 📄 LicenceGOOGLE_CLOUD_LOCATION=europe-west9├── PlanningAgent.js      # Agent principal- **Génération de plans d'actions** séquentiels 



Projet hackathon - Usage éducatif et démonstrationGEMINI_MODEL=gemini-2.0-flash-001



---PORT=5000├── GeminiProcessor.js    # Interface Gemini



**🏆 AVN Hackathon Project** - Navigateur Vocal Agentique avec IA```

*Team A - Agentique & Machine Learning*
├── credentials.js        # Gestion credentials GCP- **Validation et optimisation** des plans- Python 3.8+

### Mode dégradé

Si Gemini n'est pas disponible, l'agent utilise une analyse par mots-clés.└── tools/ToolRegistry.js # Outils disponibles



## Tests- **Intégration Gemini AI** pour l'analyse d'intention- Compte Google Cloud Platform



### Test localtests/

```bash

npm test├── planning-server.js    # Serveur Express- Service Account avec permissions Vertex AI

```

├── planning-interface.html # Interface web

### Test via API

```bash└── agent.test.js         # Tests unitaires### 🛠️ Outils d'Interaction Web- Docker (optionnel)

# Démarrer le serveur

npm start```



# Test de santé- **Navigation** : scroll, navigation, attente

curl http://localhost:5000/api/health

## Utilisation

# Test de plan

curl -X POST http://localhost:5000/agent/plan \- **Interaction** : clic, saisie, activation d'éléments### Variables d'Environnement

  -H "Content-Type: application/json" \

  -d '{"text": "Descends sur la page"}'### API REST

```

**Traitement de commande :**- **Analyse** : extraction de contenu, analyse de page

## Interface de développement

```bash

Interface web disponible sur `http://localhost:5000` pour :

- Tester la génération de plansPOST /api/process-command- **Communication** : feedback utilisateur, questionsCréer un fichier `.env` à la racine du projet :

- Vérifier la santé du système  

- Valider les réponses JSONContent-Type: application/json



## Architecture



```{

core/agents/

├── SimplePlanningAgent.js    # Agent principal  "text": "Descends sur la page puis clique sur le bouton connexion",### 🌐 Interface Web Moderne```env

├── credentials.js            # Gestion GCP

└── GeminiProcessor.js        # (Legacy - non utilisé)  "context": { "interface_type": "web" }



tests/}- **Design professionnel** avec sidebar d'historique# Configuration GCP pour l'équipe A - Agent de Planification ML

├── simple-server.js         # Serveur Express

├── simple-interface.html    # Interface de test```

└── simple-test.js           # Tests unitaires

```- **Traitement temps réel** des commandesGOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json



## Exemples d'Utilisation**Réponse :**



### Commandes de Navigation```json- **Monitoring** et statistiques intégrésGOOGLE_CLOUD_PROJECT=avn-hackathon-project

```json

// "Descends sur la page"{

{

  "intent": "scroll_down",  "intent": "navigation_and_interaction",- **API REST** complèteGOOGLE_CLOUD_REGION=europe-west9

  "action": "scroll_page",

  "arguments": {"direction": "down", "amount": "medium"}  "confidence": 0.85,

}

  "actions": [

// "Va sur google.com"  

{    {

  "intent": "navigation",

  "action": "navigate_to",       "tool": "scroll_page",## 🏗️ Architecture# Configuration Agent ML

  "arguments": {"url": "https://google.com"}

}      "parameters": { "direction": "down", "amount": "medium" }

```

    },AGENT_NAME=planning_agent_ml

### Commandes d'Interaction

```json    {

// "Clique sur connexion"

{      "tool": "click_element",```GEMINI_MODEL=gemini-2.0-flash-001

  "intent": "click_element",

  "action": "click_element",      "parameters": { "selector": ".login-btn" }

  "arguments": {"text": "connexion"}

}    }core/LOG_LEVEL=INFO



// "Analyse cette page"  ]

{

  "intent": "analyze_page", }├── agents/```

  "action": "analyze_page",

  "arguments": {"focus": "all"}```

}

```│   ├── PlanningAgent.js      # Agent principal de planification



## Support### Autres endpoints



- **Santé** : `GET /api/health`- `GET /api/health` - État du système│   ├── GeminiProcessor.js    # Interface Vertex AI Gemini### Installation

- **Tests** : `POST /api/test`

- **Logs** : Console du serveur Node.js- `GET /api/tools` - Outils disponibles



Le système est conçu pour être simple, fiable et compatible avec l'architecture d'orchestration de l'équipe B.- `GET /api/history` - Historique des plans│   ├── credentials.js        # Gestionnaire credentials GCP



## Outils disponibles│   └── tools/1. Cloner le repository



### Navigation│       └── ToolRegistry.js   # Registre des outils disponibles```bash

- **scroll_page** : Faire défiler la page

- **navigate** : Naviguer vers une URLtests/git clone https://github.com/exauceh/avn-hackathon-project.git

- **go_back** : Retourner à la page précédente

- **wait** : Attendre un délai├── planning-server.js        # Serveur Express.jscd avn-hackathon-project



### Interaction├── planning-interface.html   # Interface web```

- **click** : Cliquer sur un élément

- **type_text** : Saisir du texte├── agent.test.js             # Tests unitaires

- **find_elements** : Trouver des éléments

└── quick-start-test.js       # Test de démarrage2. Installer les dépendances

### Analyse

- **analyze_page** : Analyser le contenu de la page``````bash

- **extract_text** : Extraire du texte

pip install -r requirements.txt

### Communication

- **ask_user** : Poser une question## 📊 Exemple d'Utilisation```

- **inform_user** : Informer l'utilisateur



## Tests

### Commande d'Entrée3. Configurer les credentials GCP

```bash

# Test rapide du système```javascript   - Placer le fichier JSON du service account dans le dossier racine

npm run test:quick

{   - Créer le fichier `.env` avec la configuration ci-dessus

# Tests unitaires

npm test  "text": "Descends sur la page puis clique sur le bouton connexion",



# Tests en mode watch  "context": { "interface_type": "web" }### Tests et Utilisation

npm run test:watch

```}



## Développement```#### Interface Web (Recommandé)



### Structure du code```bash

Le système utilise une architecture modulaire avec :

- Séparation des responsabilités### Plan d'Actions Généré# Lancer l'interface web complète

- Validation des paramètres

- Gestion d'erreurs robuste```jsonpython tests/server.py

- Mode dégradé en cas de problème Gemini

{```

### Ajout d'un nouvel outil

```javascript  "intent": "navigation_and_interaction",Puis ouvrir http://localhost:5000

// Dans ToolRegistry.js

this.registerTool('nouveau_outil', {  "confidence": 0.85,

    description: 'Description de l\'outil',

    parameters: {  "actions": [**Fonctionnalités disponibles :**

        param1: { type: 'string', required: true }

    },    {- Mode automatique : Questions aléatoires à intervalles configurables

    execute: async (params) => {

        // Logique d'exécution      "tool": "scroll_page",- Mode manuel : Saisie directe de questions

        return { success: true };

    }      "parameters": { "direction": "down", "amount": "medium" }- Historique conversationnel avec sidebar

});

```    },- Contrôles de timing en temps réel



## Configuration avancée    {- API REST pour intégration



### Variables d'environnement      "tool": "click_element", 

```bash

# Gemini      "parameters": { "selector": ".login-btn" }#### Tests en ligne de commande

GEMINI_TEMPERATURE=0.3      # Créativité (0.0-1.0)

GEMINI_MAX_TOKENS=8192      # Limite de tokens    }```bash

GEMINI_TOP_P=0.8           # Nucleus sampling

GEMINI_TOP_K=40            # Top-k sampling  ]# Test unitaire de l'agent ML



# Agent}python tests/test_agent.py

AGENT_MAX_ACTIONS=10       # Actions max par plan

AGENT_TIMEOUT=30000        # Timeout en ms```

AGENT_CONFIDENCE_THRESHOLD=0.5  # Seuil de confiance

# Test programmatique direct

# Debug

DEBUG_MODE=true            # Mode debug## 🔧 Configurationpython -c "

GEMINI_DEBUG=false         # Debug Gemini

```from core.agents.ml_agent import PlanningAgent



## Résolution de problèmes### Variables d'Environnement (.env)agent = PlanningAgent()



### Erreur de credentials```bashresult = agent.process_voice_input({'text': 'Quelle est la météo ?'})

```bash

# Vérifier le fichier de credentials# Google Cloud / Vertex AIprint(f'Intent: {result.intent}, Action: {result.action}')

ls -la avn-hackathon-project-8df77caa78b2.json

GOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json"

# Vérifier les variables d'environnement

node -e "console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)"GOOGLE_CLOUD_PROJECT=avn-hackathon-project```

```

GOOGLE_CLOUD_LOCATION=us-central1

### Erreur Gemini "Model not found"

- Vérifier que le modèle est disponible dans votre région## Structure du Projet

- Essayer `gemini-2.0-flash-001` ou `gemini-1.5-pro`

- Vérifier les permissions Vertex AI# Configuration Gemini



### Port déjà utiliséGEMINI_MODEL=gemini-1.5-pro```

```bash

# Changer le portGEMINI_TEMPERATURE=0.3avn-hackathon-project/

PORT=5001 npm start

GEMINI_MAX_TOKENS=8192├── core/

# Ou arrêter les processus existants

taskkill /F /IM node.exe│   ├── agents/

```

# Serveur│   │   ├── ml_agent.py            # Agent principal ML avec Gemini

## Performance

PORT=5000│   │   ├── credentials.py         # Gestionnaire GCP

- Temps de réponse moyen : 500ms

- Limite d'actions par plan : 10NODE_ENV=development│   │   ├── voice_input_mock.py    # Mock équipe C pour simulation

- Timeout par commande : 30 secondes

- Support utilisateurs simultanés : 10+```│   │   └── README.md              # Documentation technique détaillée



## License├── tests/



MIT License## 🧪 Tests et Validation│   ├── interface.html             # Interface web avec sidebar historique

│   ├── server.py                  # Serveur Flask avec API REST

```bash│   └── test_agent.py              # Tests unitaires

# Test rapide du système├── requirements.txt               # Dépendances Python

npm run test:quick├── Dockerfile                     # Configuration Docker

├── cloudbuild.yaml               # CI/CD Google Cloud

# Tests unitaires complets  └── .env                          # Configuration (à créer)

npm test```



# Tests en mode watch## Technologies Utilisées

npm run test:watch

- **Google Vertex AI / Gemini AI** : Traitement du langage naturel et génération de réponses

# Vérification de santé- **Python Flask** : Serveur web et API REST

npm run health- **HTML/CSS/JavaScript** : Interface web professionnelle

```- **Git** : Contrôle de version avec branches feature

- **Google Cloud Platform** : Infrastructure et authentification

## 📡 API Endpoints

## Développement

- `POST /api/process-command` - Traitement de commandes

- `GET /api/history` - Historique des plans### État Actuel (Sprint 1 - Terminé)

- `GET /api/health` - État du système

- `GET /api/tools` - Outils disponibles**Agent ML fonctionnel** avec Gemini AI intégré

- `GET /api/stats` - Statistiques de l'agent**Interface web complète** avec historique conversationnel  

**Tests unitaires** avec suppression des warnings GCP

## 🔗 Intégration Orchestrateur**Documentation** technique exhaustive

**API REST** pour intégration future avec équipes B et C

Le système génère des plans JSON structurés prêts pour l'orchestrateur :

### Structure de Tests

```javascript

// Traitement d'une commande#### Interface Web (`tests/server.py` + `tests/interface.html`)

const result = await fetch('/api/process-command', {- Serveur Flask avec endpoints API

  method: 'POST',- Interface style Claude AI avec sidebar historique

  headers: { 'Content-Type': 'application/json' },- Modes automatique et manuel

  body: JSON.stringify({ text: "votre commande" })- Gestion des intervalles de timing configurables

});- Stockage local des conversations (50 dernières)



// Récupération du plan pour l'orchestrateur#### Tests Unitaires (`tests/test_agent.py`)

const plan = await result.json();- Tests de l'agent ML avec validation des réponses

// plan.actions contient la séquence d'actions à exécuter- Suppression des warnings Google Cloud

```- Validation de la configuration GCP



## 📈 Performance### Déploiement



- **Temps de réponse** : ~500ms pour des commandes simples```bash

- **Limite d'actions** : 10 actions maximum par plan# Build Docker

- **Timeout** : 30 secondes par commandedocker build -t avn-agent-ml .

- **Cache** : Réponses mises en cache pour optimisation

# Déploiement via Google Cloud Build

## 🛡️ Sécuritégcloud builds submit --config cloudbuild.yaml

```

- **Validation des paramètres** pour tous les outils

- **Limite de taux** pour les APIs## Configuration GCP

- **Gestion des credentials** sécurisée

- **Sanitisation** des entrées utilisateur### APIs Requises



## 📚 Documentation- Vertex AI API

- Generative Language API

- **[SETUP.md](SETUP.md)** - Guide d'installation détaillé- Cloud Resource Manager API

- **Interface Web** - Documentation intégrée à l'interface

- **Code Comments** - Documentation inline dans le code### Permissions Service Account



## 🤝 Contribution- `Vertex AI User`

- `AI Platform Developer`

1. Fork du repository- `Project Viewer`

2. Création d'une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)

3. Commit des changes (`git commit -am 'Ajout nouvelle fonctionnalité'`)### Modèles Supportés

4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)

5. Création d'une Pull Request- gemini-2.0-flash-001 (recommandé)

- gemini-2.5-flash

## 📄 License- gemini-2.5-pro



MIT License - voir [LICENSE](LICENSE) pour plus de détails.

### Deliverables Sprint 1 - Réalisés

## 🏆 Équipe AVN Hackathon

- **Agent de planification ML** : Intégration complète Gemini AI avec gestion des intentions

Développé dans le cadre du hackathon AVN 2024 pour créer un agent de planification intelligent.- **Interface web professionnelle** : Simulation temps réel avec historique conversationnel

- **Tests complets** : Unitaires (ligne de commande) + Interface web interactive

---- **Documentation technique** : Setup GCP, configuration

- **Architecture sécurisée** : Credentials protégés, warnings supprimés 

**Version :** 1.0.0  - **API REST** : Endpoints pour historique, questions et traitement ML

**Technologie :** Node.js + Express + Vertex AI Gemini  

**Interface :** http://localhost:5000### API Endpoints Disponibles

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