# Configuration de l'environnement Google Cloud sur Windows

Ce guide explique comment configurer un environnement de développement sur **Windows** pour travailler avec Google Cloud Platform (GCP), incluant l'installation du SDK, l'authentification sans navigateur, la gestion des Service Accounts et la configuration des variables d'environnement.

---


**Toutes les commandes sont à exécutées a la racine du depot git**

## 1. Installation du Google Cloud SDK

1. Télécharger le SDK pour Windows depuis :  
   [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

2. Installer en suivant les instructions de l’installateur.  
   ⚠️ Cocher l’option pour ajouter `gcloud` au PATH.

3. Ouvrir **PowerShell** ou **Cmd** et vérifier l'installation :

```powershell
gcloud init
gcloud --version
```

## 2. Authentification sur GCP (sans navigateur)

```powershell
gcloud auth login --no-launch-browser
```
Une URL sera affichée.
Copier l’URL dans un navigateur, se connecter avec votre compte Google (*Celui associé au projet*) et récupérer le code d’authentification.
Coller le code dans le terminal pour compléter l’authentification.

## 3. Définir le projet par défaut
```powershell
$env:PROJECT_ID="avn-hackathon-project"
$env:REGION="europe-west9"
gcloud config set project $env:PROJECT_ID
gcloud config set run/region $env:REGION
```

## 4. Activer un Service Account / Compte principal pour l’environnement
1. Liste les comptes disponibles
```powershell
gcloud auth list
```
2. Active le compte principal (*email google*). Remplace {account} par le compte.
```powershell
gcloud config set account {ACCOUNT}  
```

3.  Vérifier le compte actif ( avec l'etoile )
gcloud auth list

## 5. Configure Docker Desktop pour s'authentifier auprès de votre registre GCP
```powershell
gcloud auth configure-docker europe-west9-docker.pkg.dev
```
Vérifiez que Docker Desktop est bien en cours d'exécution sur votre machine. Cette dernière commande met à jour vos identifiants Docker pour qu'il puisse communiquer avec GCP.

## 6. Test de deploiement
1. Push de l'image sur artifact registry
```powershell
$PROJECT_ID = "avn-hackathon-project"
$REGION = "europe-west9"
$REPO = "avn-registry"
$IMAGE_NAME = "test_env"
$TAG = "v0.1"
$IMAGE_URI = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE_NAME`:$TAG"
docker build -t $IMAGE_URI -f cloud/Dockerfile .
docker push $IMAGE_URI
```

2. Deploy on Cloud Run
Variables spécifiques au déploiement Cloud Run

```powershell
$SERVICE_NAME = "test_env_service"

gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_URI `
    --region $REGION `
    --platform managed `
    --project $PROJECT_ID `
    --allow-unauthenticated `
    --port 8080 `
    --quiet
```
