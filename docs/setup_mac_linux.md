# Configuration de l'environnement Google Cloud sur macOS

Ce guide explique comment configurer un environnement de développement sur **macOS/linux** pour travailler avec Google Cloud Platform (GCP), incluant l'installation du SDK, l'authentification sans navigateur, la gestion des Service Accounts et la configuration des variables d'environnement.

---


**Toutes les commandes sont à exécutées a la racine du depot git**

## 1. Installation du Google Cloud SDK

1. Télécharger le SDK pour macOS/linux depuis :  
    [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

2. Installer en suivant les instructions de l'installateur.  
    ⚠️ L'installateur ajoutera automatiquement `gcloud` au PATH.

3. Ouvrir **Terminal** et vérifier l'installation :

```bash
gcloud init
gcloud --version
```

## 2. Authentification sur GCP (sans navigateur)

```bash
gcloud auth login --no-launch-browser
```
Une URL sera affichée.
Copier l'URL dans un navigateur, se connecter avec votre compte Google (*Celui associé au projet*) et récupérer le code d'authentification.
Coller le code dans le terminal pour compléter l'authentification.

## 3. Définir le projet par défaut
```bash
export PROJECT_ID="avn-hackathon-project"
export REGION="europe-west9"
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
```

## 4. Activer un Service Account / Compte principal pour l'environnement
1. Liste les comptes disponibles
```bash
gcloud auth list
```
2. Active le compte principal (*email google*). Remplace {account} par le compte.
```bash
gcloud config set account {ACCOUNT}  
```

3.  Vérifier le compte actif ( avec l'etoile )
```bash
gcloud auth list
```

## 5. Configure Docker Desktop pour s'authentifier auprès de votre registre GCP
```bash
gcloud auth configure-docker europe-west9-docker.pkg.dev
```
Vérifiez que Docker Desktop est bien en cours d'exécution sur votre machine. Cette dernière commande met à jour vos identifiants Docker pour qu'il puisse communiquer avec GCP.

## 6. Test de deploiement
1. Push de l'image sur artifact registry
```bash
export PROJECT_ID="avn-hackathon-project"
export REGION="europe-west9"
export REPO="avn-registry"
export IMAGE_NAME="test_env"
export TAG="v0.1"
export IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE_NAME:$TAG"

docker build -t $IMAGE_URI -f cloud/Dockerfile .
docker push $IMAGE_URI
```

2. Deploy on Cloud Run
Variables spécifiques au déploiement Cloud Run

```bash
export SERVICE_NAME="test_env_service"
gcloud run deploy $SERVICE_NAME \
     --image $IMAGE_URI \
     --region $REGION \
     --platform managed \
     --project $PROJECT_ID \
     --allow-unauthenticated \
     --port 8080 \
     --quiet
```

