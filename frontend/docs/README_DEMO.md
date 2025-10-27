# 🎯 AVN Hackathon - Implémentation des Cas d'Usage avec Graphe ADK

## 📋 Vue d'ensemble

Ce document décrit l'implémentation complète des 3 cas d'usage pour la démo AVN (Assistant Vocal de Navigation) utilisant un graphe d'agents basé sur **LangGraph** et **LangChain**.

### Architecture Globale

```
┌─────────────────┐
│   Frontend      │ Chrome Extension (STT Web Speech API)
│   (Extension)   │ - Capture vocale
└────────┬────────┘ - Exécution actions DOM
         │
         ↓
┌─────────────────┐
│  API Gateway    │ Flask REST + Pub/Sub
│  (Port 8080)    │ - Polling request/response
└────────┬────────┘ - TTS (Google Cloud)
         │
         ↓
┌─────────────────┐
│  Graphe ADK     │ LangGraph + Gemini/GPT-4
│  (Agents)       │ - SearchAgent (Cas #1)
└─────────────────┘ - NavigationAgent (Cas #2)
                    - FormAgent (Cas #3)
```

---

## 🚀 Cas d'Usage Implémentés

### ✅ Cas d'Usage #1 : Recherche et Résumé

**Objectif** : L'utilisateur demande une recherche, l'agent trouve les articles et les résume vocalement.

**Flow** :
1. 🎤 Utilisateur : "Recherche les dernières nouvelles sur l'intelligence artificielle"
2. 🔍 **SearchAgent** :
   - Effectue une recherche Google (3 premiers résultats)
   - Extrait titres, URLs, snippets
   - Génère un résumé vocal intelligent
3. 🔊 TTS : "J'ai trouvé 3 articles. Le premier est 'Google lance Gemini 2.5 Pro'..."
4. ❓ Confirmation : "Voulez-vous que j'analyse l'article de Google ?"

**Fichiers concernés** :
- `core/agents/search_agent.py` : Logique de recherche et extraction
- `frontend/scripts/background.js` : Capture du contexte et gestion session

---

### ✅ Cas d'Usage #2 : Navigation Guidée

**Objectif** : Naviguer vers un article avec confirmation vocale du chargement.

**Flow** :
1. 🎤 Utilisateur : "Oui, lis l'article sur Gemini"
2. 🧭 **NavigationAgent** :
   - Identifie l'article cible (via LLM ou référence numérique)
   - Génère une action `navigate` avec l'URL
3. 🌐 Frontend : Exécute `chrome.tabs.update()` vers l'URL
4. 📄 **content.js** : Détecte le chargement, extrait `title` et `url`
5. ✅ **NavigationAgent** : Valide la page et confirme
6. 🔊 TTS : "C'est confirmé. Vous êtes sur Google. Voulez-vous que je lise l'introduction ?"

**Fichiers concernés** :
- `core/agents/navigation_agent.py` : Logique de navigation et validation
- `frontend/scripts/content.js` : Détection de chargement de page
- `frontend/scripts/background.js` : Exécution des actions de navigation

---

### ✅ Cas d'Usage #3 : Action Contextuelle (Formulaire)

**Objectif** : Remplir et soumettre un formulaire sans interaction visuelle.

**Flow** :
1. 🎤 Utilisateur : "Inscris-toi à la newsletter"
2. 📝 **FormAgent** :
   - Demande au `content.js` de scanner les formulaires
   - Identifie le formulaire de newsletter
   - Récupère l'email de l'utilisateur (contexte de session)
3. ❓ Confirmation : "Dois-je utiliser votre adresse : testeur@avn.com ?"
4. 🎤 Utilisateur : "Oui, soumets le formulaire"
5. 📤 **FormAgent** : Génère action `fill_and_submit`
6. 🌐 **content.js** : Remplit et soumet le formulaire
7. ✅ Notification : "Formulaire soumis avec succès"

**Fichiers concernés** :
- `core/agents/form_agent.py` : Détection et remplissage de formulaires
- `frontend/scripts/content.js` : Extraction et manipulation des formulaires
- `frontend/scripts/background.js` : Gestion du contexte utilisateur (email)

---

## 📦 Structure du Projet

### Nouveaux fichiers créés

```
core/agents/
├── graph_agent.py          # 🧠 Orchestrateur principal (LangGraph)
├── search_agent.py         # 🔍 Agent de recherche (Cas #1)
├── navigation_agent.py     # 🧭 Agent de navigation (Cas #2)
├── form_agent.py           # 📝 Agent de formulaires (Cas #3)
├── pubsub_listener.py      # 📡 Service Pub/Sub pour l'intégration
├── requirements.txt        # 📦 Dépendances Python
└── .env.example            # ⚙️ Variables d'environnement

frontend/scripts/
├── background.js           # 🔄 Mise à jour : contexte, actions ADK
└── content.js              # 🔄 Mise à jour : extraction formulaires, actions DOM

cloud/services/api-gateway/
├── main.py                 # 🔄 Mise à jour : transmission du contexte
└── pubsub_handler.py       # 🔄 Mise à jour : support du contexte
```

---

## 🛠️ Installation et Configuration

### 1. Prérequis

- Python 3.10+
- Node.js 18+ (pour le frontend)
- Google Cloud Platform account
- API Keys : Google AI (Gemini) ou OpenAI

### 2. Configuration Backend (Agents ADK)

```bash
# Naviguer vers le dossier agents
cd core/agents

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate sur Windows

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Configuration des Variables d'Environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env et remplir les valeurs
nano .env
```

**Variables importantes** :
```bash
# API Key pour Gemini (ou OpenAI)
GOOGLE_API_KEY=votre_cle_google_ai
# OPENAI_API_KEY=votre_cle_openai  # Si vous préférez GPT-4

# Google Cloud Platform
GCP_PROJECT_ID=avn-hackathon-project
GOOGLE_APPLICATION_CREDENTIALS=../../cloud/keys/avn-hackathon-project-*.json

# Configuration Pub/Sub (doit correspondre à l'API Gateway)
INPUT_TOPIC=voice.input
OUTPUT_TOPIC=avn-agent-response
SUBSCRIPTION=avn-input-sub
```

### 4. Configuration Google Cloud Pub/Sub

```bash
# Se connecter à GCP
gcloud auth login
gcloud config set project avn-hackathon-project

# Créer les topics et subscriptions si nécessaire
gcloud pubsub topics create voice.input
gcloud pubsub topics create avn-agent-response

gcloud pubsub subscriptions create avn-input-sub \
  --topic=voice.input

gcloud pubsub subscriptions create agent-reply-sub \
  --topic=avn-agent-response
```

### 5. Configuration API Gateway

```bash
# Naviguer vers l'API Gateway
cd cloud/services/api-gateway

# Installer les dépendances (si ce n'est pas déjà fait)
pip install -r requirements.txt
```

### 6. Configuration Frontend (Extension Chrome)

L'extension est déjà configurée. Assurez-vous que :
- L'API Gateway tourne sur `http://127.0.0.1:8080`
- L'extension est chargée dans Chrome (`chrome://extensions/`)

---

## 🎮 Comment Tester

### Étape 1 : Démarrer l'API Gateway

```bash
cd cloud/services/api-gateway
python main.py
```

Vous devriez voir :
```
🚀 DÉMARRAGE TEXT GATEWAY (REST)
📡 Démarrage du listener Pub/Sub...
🌐 Serveur Flask sur http://0.0.0.0:8080
```

### Étape 2 : Démarrer le Service Agent ADK

Dans un **nouveau terminal** :

```bash
cd core/agents
source venv/bin/activate  # Activer l'environnement virtuel
python pubsub_listener.py
```

Vous devriez voir :
```
🤖 Initialisation de l'agent ADK...
📡 Écoute de Pub/Sub...
✅ Écoute active. Appuyez sur Ctrl+C pour arrêter.
```

### Étape 3 : Tester Cas d'Usage #1 (Recherche et Résumé)

1. 🔌 Ouvrez Chrome avec l'extension AVN chargée
2. 🗣️ Appuyez sur `Ctrl+Shift+L` (raccourci clavier)
3. 🎤 Dites : **"Recherche les dernières nouvelles sur l'intelligence artificielle"**
4. ⏳ Attendez quelques secondes
5. 🔊 Écoutez la réponse :
   ```
   "J'ai trouvé 3 articles principaux. 
   Le premier est 'Google lance Gemini 2.5 Pro'...
   Voulez-vous que j'analyse l'un de ces articles ?"
   ```

**Vérifications** :
- ✅ Les résultats de recherche sont affichés dans les logs de l'agent
- ✅ L'audio TTS est généré et joué dans le navigateur
- ✅ Le contexte de recherche est stocké en session

### Étape 4 : Tester Cas d'Usage #2 (Navigation Guidée)

1. 🗣️ Réactivez le micro (Ctrl+Shift+L)
2. 🎤 Dites : **"Oui, lis l'article sur Gemini"** (ou "le premier article")
3. 🌐 L'onglet navigue automatiquement vers l'URL
4. 🔊 Écoutez la confirmation :
   ```
   "C'est confirmé. Vous êtes sur le site de Google. 
   Le titre de la page est 'Lancement de Gemini 2.5'. 
   Voulez-vous que je commence la lecture de l'introduction ?"
   ```

**Vérifications** :
- ✅ L'URL change dans le navigateur
- ✅ Le `content.js` extrait le titre de la nouvelle page
- ✅ L'agent confirme la navigation avec le titre exact

### Étape 5 : Tester Cas d'Usage #3 (Remplissage de Formulaire)

1. 🌐 Ouvrez une page avec un formulaire de newsletter (ou créez une page de test)
2. 🗣️ Réactivez le micro
3. 🎤 Dites : **"Inscris-toi à la newsletter"**
4. 🔊 Écoutez la réponse :
   ```
   "J'ai trouvé le formulaire d'abonnement. 
   Dois-je utiliser votre adresse par défaut : testeur@avn.com ?"
   ```
5. 🗣️ Répondez : **"Oui, soumets le formulaire"**
6. ✅ Le formulaire est rempli et soumis automatiquement

**Vérifications** :
- ✅ Les formulaires sont détectés par `content.js`
- ✅ L'email par défaut est récupéré du contexte
- ✅ Le formulaire est soumis sans interaction visuelle

---

## 🧪 Tests Standalone (Sans Frontend)

Vous pouvez tester chaque agent individuellement :

### Test du SearchAgent

```bash
cd core/agents
python search_agent.py
```

### Test du NavigationAgent

```bash
python navigation_agent.py
```

### Test du FormAgent

```bash
python form_agent.py
```

### Test du Graphe Complet

```bash
python graph_agent.py
```

---

## 🔍 Debugging

### Logs à surveiller

#### API Gateway
```
📝 Traitement req_abc123: "recherche IA"
🌐 Contexte URL: https://example.com
📄 Titre: Example Page
📤 Publié sur Pub/Sub: req_abc123
```

#### Agent ADK
```
🎯 Router: recherche IA → search
🔍 Exécution SearchAgent...
  ✅ Résultat 1: Google lance Gemini 2.5 Pro...
🤖 Réponse: J'ai trouvé 3 articles...
🔊 Génération audio...
✅ Réponse publiée pour req_abc123
```

#### Frontend (Console Chrome)
```
📤 Envoi transcription au serveur...
📄 Contexte capturé: Example Page
🔄 Polling pour req_abc123...
🎉 Réponse reçue !
🤖 Réponse agent: {...}
🎬 Exécution action: {type: "navigate", url: "..."}
🔊 Lecture audio...
```

### Problèmes courants

#### ❌ "Module 'langgraph' not found"
```bash
cd core/agents
pip install -r requirements.txt
```

#### ❌ "GOOGLE_API_KEY non définie"
```bash
# Vérifier que .env existe et contient la clé
cat .env | grep GOOGLE_API_KEY

# Si absent, ajouter
echo "GOOGLE_API_KEY=votre_cle" >> .env
```

#### ❌ "Pub/Sub subscription not found"
```bash
# Recréer la subscription
gcloud pubsub subscriptions create avn-input-sub \
  --topic=voice.input
```

#### ❌ "Recherche Google bloquée"
Le `SearchAgent` utilise un fallback avec des résultats de démo si la recherche Google échoue. Pour activer la vraie recherche :
- Vérifiez votre connexion Internet
- Utilisez un VPN si Google bloque les requêtes

---

## 📊 Métriques de Performance

### Temps de réponse attendus

| Cas d'Usage | Temps moyen | Décomposition |
|-------------|-------------|---------------|
| **#1 Recherche** | 5-8s | Recherche Google (2s) + LLM (2s) + TTS (2s) |
| **#2 Navigation** | 3-5s | LLM (1s) + Navigation (1s) + TTS (2s) |
| **#3 Formulaire** | 4-6s | Scan DOM (1s) + LLM (1s) + TTS (2s) |

---

## 🎨 Améliorations Futures

### Court Terme
- [ ] Ajouter pagination pour les recherches (plus de 3 résultats)
- [ ] Support multi-langues (EN, ES, etc.)
- [ ] Cache des résultats de recherche

### Moyen Terme
- [ ] Lecture intelligente des articles (extraction du contenu principal)
- [ ] Support de formulaires complexes (multi-étapes)
- [ ] Historique des conversations persistant

### Long Terme
- [ ] Vision par ordinateur pour analyser les images
- [ ] Intégration avec d'autres APIs (météo, actualités, etc.)
- [ ] Mode offline avec modèles locaux

---

## 🤝 Contribution

### Structure du Code

- **Graphe ADK** : Architecture modulaire avec agents spécialisés
- **Frontend** : Injection DOM + Background worker
- **API Gateway** : REST + Pub/Sub pour scalabilité

### Bonnes Pratiques

1. **Agents** : Chaque agent est autonome et testable
2. **Contexte** : Toujours passer le contexte complet (page, utilisateur)
3. **Actions** : Format JSON standardisé pour les actions DOM
4. **Logs** : Emoji + structure claire pour le debugging

---

## 📝 Résumé Technique

### Technologies Utilisées

- **LangGraph** : Orchestration des agents
- **LangChain** : Interactions avec les LLMs
- **Google Gemini / OpenAI GPT-4** : Modèles de langage
- **Google Cloud Pub/Sub** : Messaging asynchrone
- **Google Cloud TTS** : Synthèse vocale
- **Chrome Extensions API** : Manipulation DOM
- **Web Speech API** : Reconnaissance vocale
- **Flask** : API Gateway REST

### Flux de Données

```
Utilisateur (Voix)
    ↓
Web Speech API (STT)
    ↓
Extension Chrome (background.js)
    ↓ + Contexte (URL, titre, formulaires)
API Gateway (Flask)
    ↓
Pub/Sub (voice.input)
    ↓
Agent ADK (LangGraph)
    ├→ SearchAgent
    ├→ NavigationAgent
    └→ FormAgent
    ↓
Pub/Sub (avn-agent-response)
    ↓
API Gateway (+ TTS)
    ↓
Extension Chrome
    ↓ Exécution Action DOM
Content Script
    ↓
Audio TTS → Utilisateur
```

---

## 🎯 Objectifs de la Démo

✅ **Cas #1** : Prouver la capacité de recherche et résumé intelligent  
✅ **Cas #2** : Démontrer la navigation guidée avec confirmation  
✅ **Cas #3** : Valider l'interaction avec les formulaires sans vision  

**Valeur Ajoutée** : L'utilisateur malvoyant peut naviguer sur le web de manière autonome, avec un assistant qui comprend le contexte et agit intelligemment.

---

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs de chaque composant
2. Consulter la section **Debugging** de ce README
3. Tester les agents standalone pour isoler le problème

---

**Date** : Octobre 2025  
**Projet** : AVN Hackathon  
**Équipe** : AVN-AI  
**Version** : 1.0.0

🚀 **Bonne démo !**
