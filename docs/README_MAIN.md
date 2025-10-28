# 🎯 AVN Hackathon - Assistant Vocal de Navigation

## 🌟 Vue d'ensemble

**AVN (Assistant Vocal de Navigation)** est une extension Chrome intelligente qui permet aux personnes malvoyantes de naviguer sur le web de manière autonome grâce à un graphe d'agents basé sur **LangGraph** et **LangChain**.

### 🎯 3 Cas d'Usage Principaux

| # | Cas d'Usage | Description | Status |
|---|-------------|-------------|--------|
| 1️⃣ | **Recherche et Résumé** | Recherche Google + résumé vocal intelligent | ✅ Implémenté |
| 2️⃣ | **Navigation Guidée** | Navigation automatique avec confirmation vocale | ✅ Implémenté |
| 3️⃣ | **Action Contextuelle** | Remplissage automatique de formulaires | ✅ Implémenté |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Chrome)                       │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐           │
│  │ Popup      │  │ Background │  │ Content.js  │           │
│  │ (STT)      │  │ (Orchestr.)│  │ (DOM)       │           │
│  └─────┬──────┘  └──────┬─────┘  └──────┬──────┘           │
└────────┼────────────────┼────────────────┼──────────────────┘
         │                │                │
         └────────────────▼────────────────┘
                          │
                   HTTP REST API
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                   API GATEWAY (Flask)                      │
│  • Polling request/response                                │
│  • Google Cloud TTS                                        │
└────────────────────────┬───────────────────────────────────┘
                         │
                    Pub/Sub
                         │
┌────────────────────────▼───────────────────────────────────┐
│                  GRAPHE ADK (LangGraph)                     │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐              │
│  │ Search   │  │ Navigation │  │ Form      │              │
│  │ Agent    │  │ Agent      │  │ Agent     │              │
│  └──────────┘  └────────────┘  └───────────┘              │
│  • Gemini 2.0 / GPT-4 • Mémoire de session                │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Démarrage Rapide

### Installation (5 minutes)

```bash
# 1. Cloner le projet
git clone https://github.com/exauceh/avn-hackathon-project.git
cd avn-hackathon-project

# 2. Installation automatique
./install.sh

# 3. Configurer les API keys
nano core/agents/.env
# Ajouter : GOOGLE_API_KEY=votre_cle

# 4. Configurer Pub/Sub (si nécessaire)
gcloud pubsub topics create voice.input
gcloud pubsub topics create avn-agent-response
gcloud pubsub subscriptions create avn-input-sub --topic=voice.input
gcloud pubsub subscriptions create agent-reply-sub --topic=avn-agent-response

# 5. Charger l'extension Chrome
# chrome://extensions/ → Mode développeur → Charger frontend/

# 6. Démarrer la démo
./start_demo.sh
```

**Documentation complète** : Voir [QUICKSTART.md](QUICKSTART.md)

---

## 🎮 Utilisation

### Raccourci Clavier
Appuyez sur **Ctrl+Shift+L** pour activer l'assistant vocal.

### Commandes Vocales

#### 🔍 Recherche
```
"Recherche les dernières nouvelles sur l'IA"
"Trouve des articles sur le changement climatique"
"Cherche des recettes de cuisine française"
```

#### 🧭 Navigation
```
"Ouvre le premier article"
"Lis l'article sur Gemini"
"Va sur le deuxième lien"
"Retour à la page précédente"
```

#### 📝 Formulaires
```
"Inscris-toi à la newsletter"
"Remplis le formulaire"
"Soumets le formulaire"
```

#### 📜 Scroll
```
"Descends dans la page"
"Monte vers le haut"
"Va en bas"
```

---

## 📁 Structure du Projet

```
avn-hackathon-project/
├── core/agents/                    # 🧠 Graphe ADK
│   ├── graph_agent.py             # Orchestrateur LangGraph
│   ├── search_agent.py            # Agent de recherche
│   ├── navigation_agent.py        # Agent de navigation
│   ├── form_agent.py              # Agent de formulaires
│   ├── pubsub_listener.py         # Service d'intégration
│   └── requirements.txt
│
├── cloud/services/api-gateway/    # 🌐 API REST + Pub/Sub
│   ├── main.py
│   ├── pubsub_handler.py
│   └── tts_processor.py
│
├── frontend/                       # 🎨 Extension Chrome
│   ├── manifest.json
│   ├── popup/                     # Interface utilisateur
│   ├── scripts/
│   │   ├── background.js          # Service worker
│   │   ├── content.js             # Injection DOM
│   │   └── config.js
│   └── test_page.html             # Page de test
│
├── install.sh                      # 📦 Installation
├── start_demo.sh                   # ▶️ Démarrage
├── stop_demo.sh                    # ⏹️ Arrêt
│
├── README.md                       # Ce fichier
├── QUICKSTART.md                   # Guide rapide
├── README_DEMO.md                  # Documentation complète
└── CHANGES.md                      # Résumé des modifications
```

---

## 🧪 Tests

### Test Manuel (Recommandé)

1. **Démarrer l'environnement**
   ```bash
   ./start_demo.sh
   ```

2. **Ouvrir la page de test**
   - Fichier : `frontend/test_page.html`
   - Ou n'importe quelle page web

3. **Tester Cas #1 (Recherche)**
   - Ctrl+Shift+L
   - "Recherche les dernières nouvelles sur l'IA"
   - Vérifier le résumé vocal

4. **Tester Cas #2 (Navigation)**
   - "Ouvre le premier article"
   - Vérifier la navigation et la confirmation

5. **Tester Cas #3 (Formulaire)**
   - Sur `test_page.html`
   - "Inscris-toi à la newsletter"
   - "Oui, soumets le formulaire"

### Tests Standalone (Agents)

```bash
cd core/agents
source venv/bin/activate

# Test du SearchAgent
python search_agent.py

# Test du NavigationAgent
python navigation_agent.py

# Test du FormAgent
python form_agent.py

# Test du graphe complet
python graph_agent.py
```

---

## 🔧 Configuration

### Variables d'Environnement

Fichier : `core/agents/.env`

```bash
# API Keys
GOOGLE_API_KEY=votre_cle_google_ai
OPENAI_API_KEY=votre_cle_openai  # Optionnel

# Google Cloud Platform
GCP_PROJECT_ID=avn-hackathon-project
GOOGLE_APPLICATION_CREDENTIALS=../../cloud/keys/fichier.json

# Pub/Sub
INPUT_TOPIC=voice.input
OUTPUT_TOPIC=avn-agent-response
SUBSCRIPTION=avn-input-sub

# Agent Configuration
USE_OPENAI=false  # true pour GPT-4, false pour Gemini
RESPONSE_TIMEOUT=30
```

### Obtenir les Clés API

**Google AI (Gemini)** :
1. https://aistudio.google.com/app/apikey
2. Créer une nouvelle clé
3. Copier dans `.env`

**OpenAI (optionnel)** :
1. https://platform.openai.com/api-keys
2. Créer une nouvelle clé
3. Copier dans `.env`

**Google Cloud (Pub/Sub + TTS)** :
1. https://console.cloud.google.com/
2. Créer un service account
3. Télécharger le fichier JSON
4. Placer dans `cloud/keys/`

---

## 📊 Performances

| Métrique | Temps moyen | Status |
|----------|-------------|--------|
| Recherche + Résumé | 5-8 secondes | ✅ |
| Navigation | 3-5 secondes | ✅ |
| Remplissage formulaire | 4-6 secondes | ✅ |
| Génération TTS | 2-3 secondes | ✅ |

---

## 🐛 Dépannage

### Problème : Module non trouvé

```bash
cd core/agents
source venv/bin/activate
pip install -r requirements.txt
```

### Problème : API Key invalide

```bash
# Vérifier le fichier .env
cat core/agents/.env | grep GOOGLE_API_KEY

# Tester la clé
python -c "from langchain_google_genai import ChatGoogleGenerativeAI; ChatGoogleGenerativeAI(model='gemini-2.0-flash-exp').invoke('hello')"
```

### Problème : Port 8080 occupé

```bash
# Trouver le processus
lsof -i :8080

# Arrêter proprement
./stop_demo.sh
```

### Logs de Debug

```bash
# API Gateway
tail -f /var/log/avn_api.log

# Agent ADK
# Visible dans le terminal de start_demo.sh

# Extension Chrome
# Console Chrome : F12 → Console
```

---

## 🤝 Contribution

### Structure du Code

- **Agents** : Un fichier par agent, autonome et testable
- **Frontend** : Séparation popup / background / content
- **API Gateway** : REST + Pub/Sub pour la scalabilité

### Ajouter un Nouvel Agent

1. Créer `core/agents/mon_agent.py`
2. Implémenter la méthode `process(state: AgentState)`
3. Ajouter dans `graph_agent.py` :
   ```python
   from mon_agent import MonAgent
   self.mon_agent = MonAgent(self.llm)
   workflow.add_node("mon_agent", self._handle_mon_agent)
   ```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Ce fichier - Vue d'ensemble |
| [QUICKSTART.md](QUICKSTART.md) | Guide de démarrage rapide |
| [README_DEMO.md](README_DEMO.md) | Documentation détaillée pour la démo |
| [CHANGES.md](CHANGES.md) | Résumé des modifications |

---

## 🎯 Roadmap

### ✅ Version 1.0 (Actuelle)
- [x] Recherche Google + résumé
- [x] Navigation intelligente
- [x] Remplissage de formulaires
- [x] Architecture LangGraph
- [x] Support Gemini et GPT-4

### 🚧 Version 1.1 (Prochaine)
- [ ] Lecture intelligente d'articles
- [ ] Support multi-onglets
- [ ] Historique de navigation
- [ ] Cache des résultats

### 🔮 Version 2.0 (Future)
- [ ] Vision par ordinateur
- [ ] Mode offline
- [ ] Support mobile
- [ ] API publique

---

## 📄 Licence

Ce projet a été développé dans le cadre du **AVN Hackathon 2025**.

---

## 👥 Équipe

**Projet** : AVN Hackathon  
**Date** : Octobre 2025  
**Repository** : https://github.com/exauceh/avn-hackathon-project

---

## 🎉 Démo

Pour une démo complète, suivez les étapes de [QUICKSTART.md](QUICKSTART.md) ou consultez [README_DEMO.md](README_DEMO.md).

**Questions ?** Consultez la section Dépannage ou les logs des différents composants.

---

**🚀 Bonne navigation vocale !**
