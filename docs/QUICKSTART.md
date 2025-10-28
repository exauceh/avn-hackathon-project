# Guide de Démarrage Rapide - AVN Hackathon

## 🚀 Installation en 5 minutes

### Prérequis
- Python 3.10+
- Google Cloud Platform account
- Google AI API Key (Gemini)

### Étape 1 : Installation automatique

```bash
./install.sh
```

Ce script va :
- ✅ Vérifier Python et pip
- ✅ Créer les environnements virtuels
- ✅ Installer toutes les dépendances
- ✅ Configurer les fichiers .env

### Étape 2 : Configuration des API Keys

Éditez `core/agents/.env` :

```bash
# Obligatoire : API Key pour Gemini
GOOGLE_API_KEY=votre_cle_ici

# Obligatoire : Credentials GCP pour Pub/Sub et TTS
GOOGLE_APPLICATION_CREDENTIALS=../../cloud/keys/avn-hackathon-project-*.json

# Optionnel : Si vous préférez OpenAI
OPENAI_API_KEY=votre_cle_openai
USE_OPENAI=false
```

**Obtenir GOOGLE_API_KEY** :
1. Allez sur https://aistudio.google.com/app/apikey
2. Créez une nouvelle clé API
3. Copiez-la dans `.env`

### Étape 3 : Configuration Google Cloud Pub/Sub

```bash
# Authentification
gcloud auth login
gcloud config set project avn-hackathon-project

# Créer les topics et subscriptions
gcloud pubsub topics create voice.input
gcloud pubsub topics create avn-agent-response

gcloud pubsub subscriptions create avn-input-sub \
  --topic=voice.input

gcloud pubsub subscriptions create agent-reply-sub \
  --topic=avn-agent-response
```

### Étape 4 : Charger l'extension Chrome

1. Ouvrez Chrome et allez sur `chrome://extensions/`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `frontend/`
5. L'extension AVN devrait apparaître avec son icône

### Étape 5 : Démarrer la démo

```bash
./start_demo.sh
```

Vous devriez voir :
```
🚀 Démarrage de l'environnement AVN Hackathon
🔍 Vérification de la configuration...
✅ Configuration OK
📡 Démarrage de l'API Gateway...
✅ API Gateway démarrée (PID: 12345)
🤖 Démarrage du service Agent ADK...
✅ Agent ADK démarré (PID: 12346)

🎉 Environnement AVN prêt !
```

---

## 🎮 Tester les Cas d'Usage

### Cas #1 : Recherche et Résumé

1. Ouvrez Chrome (avec l'extension chargée)
2. Appuyez sur **Ctrl+Shift+L** (raccourci clavier)
3. Dites : **"Recherche les dernières nouvelles sur l'intelligence artificielle"**
4. Attendez la réponse vocale avec le résumé des 3 articles

### Cas #2 : Navigation Guidée

1. Après la recherche (Cas #1), réactivez le micro
2. Dites : **"Oui, lis l'article sur Gemini"** (ou "ouvre le premier article")
3. L'onglet navigue automatiquement
4. Écoutez la confirmation vocale avec le titre de la page

### Cas #3 : Remplissage de Formulaire

1. Ouvrez la page de test : `file:///chemin/vers/frontend/test_page.html`
2. Activez le micro
3. Dites : **"Inscris-toi à la newsletter"**
4. Écoutez la question : "Dois-je utiliser votre adresse testeur@avn.com ?"
5. Répondez : **"Oui, soumets le formulaire"**
6. Le formulaire est rempli et soumis automatiquement

---

## 🔍 Vérification du Fonctionnement

### Logs API Gateway
```bash
tail -f /tmp/avn_api.log
```

Vous devriez voir :
```
📝 Traitement req_abc123: "recherche IA"
📤 Publié sur Pub/Sub: req_abc123
📨 MESSAGE PUB/SUB REÇU
✅ Réponse stockée pour req_abc123
```

### Logs Agent ADK

Dans le terminal où `start_demo.sh` tourne :
```
🎯 Router: recherche les dernières... → search
🔍 Exécution SearchAgent...
  ✅ Résultat 1: Google lance Gemini 2.5 Pro...
🤖 Réponse: J'ai trouvé 3 articles...
✅ Réponse publiée pour req_abc123
```

### Console Chrome

Ouvrez les DevTools (F12) et vérifiez :
```
📤 Envoi transcription au serveur...
📄 Contexte capturé: Test Page - AVN Demo
🔄 Polling pour req_abc123...
🎉 Réponse reçue !
🎬 Exécution action: {type: "info", data: [...]}
🔊 Lecture audio...
```

---

## 🛑 Arrêter la Démo

```bash
./stop_demo.sh
```

Ou appuyez sur **Ctrl+C** dans le terminal où `start_demo.sh` tourne.

---

## ⚠️ Dépannage

### Problème : "Module langgraph not found"

```bash
cd core/agents
source venv/bin/activate
pip install -r requirements.txt
```

### Problème : "GOOGLE_API_KEY non définie"

```bash
# Vérifier le fichier .env
cat core/agents/.env | grep GOOGLE_API_KEY

# Ajouter la clé si manquante
echo "GOOGLE_API_KEY=votre_cle" >> core/agents/.env
```

### Problème : "Port 8080 already in use"

```bash
# Trouver le processus
lsof -i :8080

# Tuer le processus
kill -9 <PID>
```

### Problème : "Recherche Google bloquée"

Le SearchAgent a un fallback avec des résultats de démo si la recherche Google échoue. C'est normal et n'empêche pas la démo de fonctionner.

### Problème : "Pub/Sub subscription not found"

```bash
# Recréer les subscriptions
gcloud pubsub subscriptions create avn-input-sub --topic=voice.input
gcloud pubsub subscriptions create agent-reply-sub --topic=avn-agent-response
```

---

## 📖 Documentation Complète

Pour plus de détails, consultez **README_DEMO.md** qui contient :
- Architecture détaillée
- Description des agents
- Format des messages
- API des actions DOM
- Métriques de performance
- Améliorations futures

---

## 🎯 Checklist Avant la Démo

- [ ] API Keys configurées dans `.env`
- [ ] Google Cloud Pub/Sub configuré
- [ ] Extension Chrome chargée
- [ ] Services démarrés (`./start_demo.sh`)
- [ ] Page de test ouverte (`test_page.html`)
- [ ] Micro fonctionnel et autorisé dans Chrome
- [ ] Volume audio activé

---

## 📞 Support

En cas de problème :
1. Vérifier les logs de chaque composant
2. Tester les agents standalone : `python core/agents/search_agent.py`
3. Vérifier la connectivité Pub/Sub : `gcloud pubsub topics list`

**Bonne démo ! 🚀**
