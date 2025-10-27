# 🔐 Gestion des Variables d'Environnement

## Sur Cloud Run

### ❌ **Ce qui NE fonctionne PAS :**
- Fichiers `.env` classiques (non lus par Cloud Run)
- Variables d'environnement locales de votre machine

### ✅ **Ce qui fonctionne :**

#### **Méthode 1 : Via `cloudbuild.yaml` (Recommandé)**

```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  args:
    - gcloud
    - run
    - deploy
    - your-service-name
    - --image
    - your-image-url
    - --set-env-vars
    - PROJECT_ID=$PROJECT_ID,STT_TOPIC=your-topic-name
```

**Avantages :**
- ✅ Déploiement automatique avec CI/CD
- ✅ Variables versionnées avec le code
- ✅ `$PROJECT_ID` est automatiquement injecté par Cloud Build

#### **Méthode 2 : Via la Console Google Cloud**

1. Allez sur [Cloud Run Console](https://console.cloud.google.com/run)
2. Sélectionnez votre service
3. Cliquez sur **"Modifier et déployer une nouvelle révision"**
4. Onglet **"Variables et secrets"**
5. Ajoutez vos variables :
   - `PROJECT_ID` = `your-project-id`
   - `STT_TOPIC` = `your-topic-name`
6. Déployez

#### **Méthode 3 : Via gcloud CLI**

```bash
gcloud run services update your-service-name \
  --set-env-vars PROJECT_ID=your-project-id,STT_TOPIC=your-topic-name \
  --region europe-west9
```

#### **Méthode 4 : Secrets Manager (Pour données sensibles)**

**Pour les clés API, tokens, etc. :**

```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  args:
    - gcloud
    - run
    - deploy
    - your-service-name
    - --set-secrets
    - API_KEY=my-api-key:latest
```

**Créer un secret :**
```bash
echo -n "your-api-key-value" | gcloud secrets create my-api-key --data-file=-
```

---

## Dans votre Code Python

### **Lire les variables d'environnement :**

```python
import os

# Récupérer les variables
PROJECT_ID = os.environ.get('PROJECT_ID')
STT_TOPIC = os.environ.get('STT_TOPIC')

# Avec valeur par défaut
PROJECT_ID = os.environ.get('PROJECT_ID', 'default-project-id')

# Obligatoire (lève une erreur si manquante)
PROJECT_ID = os.getenv('PROJECT_ID')
if not PROJECT_ID:
    raise ValueError("PROJECT_ID environment variable is required")
```

### **Exemple complet :**

```python
import os
from google.cloud import pubsub_v1

class Config:
    """Configuration depuis les variables d'environnement"""
    PROJECT_ID = os.environ.get('PROJECT_ID')
    STT_TOPIC = os.environ.get('STT_TOPIC', 'stt-requests')
    ENVIRONMENT = os.environ.get('ENVIRONMENT', 'production')
    
    @classmethod
    def validate(cls):
        """Valider que toutes les variables requises sont présentes"""
        required = ['PROJECT_ID', 'STT_TOPIC']
        missing = [var for var in required if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

# Valider au démarrage
Config.validate()

# Utiliser
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(Config.PROJECT_ID, Config.STT_TOPIC)
```

---

## Pour le Développement Local

### **Option 1 : Fichier `.env` avec python-dotenv**

**1. Installer :**
```bash
pip install python-dotenv
```

**2. Créer `.env` :**
```env
PROJECT_ID=avn-hackathon-project
STT_TOPIC=stt-requests-topic
ENVIRONMENT=development
```

**3. Dans votre code :**
```python
import os
from dotenv import load_dotenv

# Charger .env seulement en local
if os.path.exists('.env'):
    load_dotenv()

PROJECT_ID = os.environ.get('PROJECT_ID')
STT_TOPIC = os.environ.get('STT_TOPIC')
```

**4. Ajouter à `.gitignore` :**
```gitignore
.env
```

### **Option 2 : Variables d'environnement shell**

```bash
export PROJECT_ID=avn-hackathon-project
export STT_TOPIC=stt-requests-topic
python app.py
```

### **Option 3 : Fichier de configuration**

**`config.py` :**
```python
import os

class Config:
    PROJECT_ID = os.environ.get('PROJECT_ID', 'avn-hackathon-project')
    STT_TOPIC = os.environ.get('STT_TOPIC', 'stt-requests-topic')

class DevelopmentConfig(Config):
    DEBUG = True
    PROJECT_ID = 'avn-hackathon-project-dev'

class ProductionConfig(Config):
    DEBUG = False

# Sélection automatique
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}

current_config = config[os.environ.get('ENVIRONMENT', 'development')]
```

---

## 🔒 Bonnes Pratiques

### ✅ À FAIRE :

1. **Ne jamais commiter de secrets** dans le code
2. **Utiliser Secret Manager** pour les données sensibles (clés API, passwords)
3. **Valider les variables** au démarrage de l'application
4. **Documenter** toutes les variables requises dans un README
5. **Utiliser des valeurs par défaut** raisonnables pour le développement
6. **Nommer clairement** : `PROJECT_ID`, pas `PID`

### ❌ À ÉVITER :

1. ❌ Hardcoder les valeurs dans le code
2. ❌ Commiter des fichiers `.env` avec des vraies valeurs
3. ❌ Utiliser les mêmes credentials en dev et prod
4. ❌ Oublier de documenter les variables nécessaires

---

## 📝 Template `.env.example`

Créez un fichier `.env.example` à commiter :

```env
# Google Cloud Project
PROJECT_ID=your-project-id

# Pub/Sub Topics
STT_TOPIC=your-stt-topic-name
TTS_TOPIC=your-tts-topic-name

# Environment
ENVIRONMENT=development

# Service Account (optionnel en local avec gcloud auth)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

---

## 🧪 Vérifier les Variables sur Cloud Run

```bash
# Lister toutes les variables d'un service
gcloud run services describe your-service-name \
  --region europe-west9 \
  --format="value(spec.template.spec.containers[0].env)"

# Obtenir une variable spécifique
gcloud run services describe your-service-name \
  --region europe-west9 \
  --format="value(spec.template.spec.containers[0].env.filter('name:PROJECT_ID'))"
```

---

## 🚀 Exemple Complet : WebSocket Gateway

**`pubsub_handler.py` :**
```python
import os
from google.cloud import pubsub_v1

class PubSubHandler:
    def __init__(self):
        # Récupérer depuis l'environnement
        self.project_id = os.environ.get('PROJECT_ID')
        self.stt_topic = os.environ.get('STT_TOPIC', 'stt-requests')
        
        if not self.project_id:
            raise ValueError("PROJECT_ID environment variable is required")
        
        # Initialiser le client
        self.publisher = pubsub_v1.PublisherClient()
        self.topic_path = self.publisher.topic_path(self.project_id, self.stt_topic)
    
    def publish_message(self, data):
        """Publier un message sur Pub/Sub"""
        future = self.publisher.publish(self.topic_path, data.encode('utf-8'))
        return future.result()
```

**`cloudbuild.yaml` :**
```yaml
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  args:
    - gcloud
    - run
    - deploy
    - websocket-gateway
    - --image
    - your-image
    - --set-env-vars
    - PROJECT_ID=$PROJECT_ID,STT_TOPIC=stt-requests-topic
    - --region
    - europe-west9
```

---

## 📚 Ressources

- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Cloud Run Secrets](https://cloud.google.com/run/docs/configuring/secrets)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [python-dotenv](https://pypi.org/project/python-dotenv/)
