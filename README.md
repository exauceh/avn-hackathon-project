# AVN Planning Agent

Agent de planification de tâches AVN avec intégration Gemini AI pour l'automatisation et l'exécution de commandes vocales.

## Description

Ce projet implémente un agent intelligent capable de planifier et d'exécuter des tâches basées sur des commandes vocales ou textuelles. L'agent utilise Google Gemini AI pour comprendre les intentions utilisateur et générer des plans d'action structurés.

### Fonctionnalités principales

- **Planification intelligente** : Génération de plans JSON basés sur les commandes utilisateur
- **Intégration Gemini AI** : Utilisation de Google Vertex AI pour le traitement du langage naturel
- **Gestion de mémoire** : Historique des conversations et contexte persistant
- **Interface web** : Interface de test et de démonstration
- **Actions supportées** :
  - Recherche web
  - Gestion météo
  - Calculs
  - Traductions
  - Gestion des favoris
  - Téléchargement de pages
  - Analyse de texte

## Prérequis

### Logiciels requis

- **Node.js** version 16.0.0 ou supérieure
- **npm** version 8.0.0 ou supérieure
- **Git** pour le clonage du repository

### Services externes

- **Compte Google Cloud Platform** avec Vertex AI activé
- **Clé de service GCP** avec les permissions Vertex AI

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/exauceh/avn-hackathon-project.git
cd avn-hackathon-project
```

### 2. Installer les dépendances Node.js

```bash
npm install
```

Cette commande installera automatiquement toutes les dépendances listées dans `package.json` :

#### Dépendances principales
- `express` : Serveur web
- `cors` : Gestion des requêtes cross-origin
- `@google-cloud/vertexai` : SDK Google Vertex AI
- `dotenv` : Gestion des variables d'environnement
- `body-parser` : Parsing des requêtes HTTP
- `helmet` : Sécurité HTTP
- `morgan` : Logging des requêtes

#### Dépendances de développement -- (non important au sprint1)
- `jest` : Framework de tests
- `nodemon` : Redémarrage automatique en développement
- `eslint` : Linter JavaScript
- `supertest` : Tests d'API

### 3. Configuration Google Cloud

#### Créer un projet GCP
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer l'API Vertex AI

#### Créer une clé de service
1. Aller dans "IAM et administration" > "Comptes de service"
2. Créer un nouveau compte de service
3. Attribuer le rôle "Utilisateur Vertex AI"
4. Créer une clé JSON et la télécharger

#### Placer la clé de service
Copier le fichier JSON de clé de service dans le répertoire racine du projet et le renommer :
```bash
cp chemin/vers/votre/cle.json ./avn-hackathon-project-8df77caa78b2.json
```

### 4. Configuration des variables d'environnement

Le fichier `.env` contient déjà la configuration par défaut. Vérifier et ajuster si nécessaire :

```env
# Configuration Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./avn-hackathon-project-8df77caa78b2.json
GOOGLE_CLOUD_PROJECT=avn-hackathon-project
GOOGLE_CLOUD_LOCATION=europe-west9

# Configuration Gemini
GEMINI_MODEL=gemini-2.0-flash-001

# Configuration Serveur
PORT=3000
NODE_ENV=development
```

**Important** : Remplacer `GOOGLE_CLOUD_PROJECT` par l'ID de votre projet GCP.

## Utilisation

### Démarrage du serveur

#### Mode production
```bash
npm start
```

#### Mode développement (avec redémarrage automatique)
```bash
npm run dev
```

Le serveur sera accessible sur `http://localhost:3000`

### Interface web

Ouvrir un navigateur et aller à `http://localhost:3000` pour accéder à l'interface de test.

L'interface permet de :
- Tester des commandes textuelles
- Voir les plans JSON générés
- Consulter l'historique des conversations
- Voir les statistiques de l'agent

### Utilisation par API

#### Générer un plan
```bash
POST http://localhost:3000/api/plan
Content-Type: application/json

{
  "command": "Quelle est la météo à Paris ?"
}
```

#### Consulter l'historique
```bash
GET http://localhost:3000/api/memory/history
```

#### Obtenir les statistiques
```bash
GET http://localhost:3000/api/stats
```

### Exemples de commandes

- "Quelle est la météo à Paris ?"
- "Recherche des recettes de cookies"
- "Traduis 'bonjour' en anglais"
- "Calcule 15 multiplié par 23"
- "Mets cette page dans mes favoris"
- "Télécharge cette page en PDF"
- "Analyse ce texte : 'Le projet va bien'"

## Structure du projet

```
avn-hackathon-project/
├── core/                           # Code principal de l'agent
│   └── agents/                     # Modules de l'agent
│       ├── PlanningAgent.js        # Agent principal de planification
│       ├── MemoryManager.js        # Gestionnaire de mémoire
│       ├── credentials.js          # Gestion des credentials GCP
│       └── data/                   # Données de l'agent
├── tests/                          # Tests et interface web
│   ├── server.js                   # Serveur Express
│   ├── interface.html              # Interface web de test
│   └── test.js                     # Tests unitaires
├── docs/                           # Documentation
├── frontend/                       # Interface utilisateur (si applicable)
├── package.json                    # Configuration npm et dépendances
├── .env                           # Variables d'environnement
├── .gitignore                     # Fichiers ignorés par git
└── README.md                      # Ce fichier
```

## Scripts disponibles

```bash
npm start          # Démarrer le serveur en mode production (concerne le sprint 1)
npm run dev        # Démarrer en mode développement avec nodemon
npm test           # Exécuter les tests
npm run lint       # Vérifier la qualité du code avec ESLint
npm run setup      # Installation complète + tests
npm run health     # Vérifier l'état du serveur
npm run demo       # Lancer la démonstration
```

## Tests

### Exécuter tous les tests
```bash
npm test
```

### Vérifier la santé du système
```bash
npm run health
```

### Tests manuels via l'interface web
1. Démarrer le serveur : `npm start`
2. Ouvrir `http://localhost:3000`
3. Tester différentes commandes dans l'interface

## Dépannage

### Erreurs courantes

#### "Credentials GCP non configurés"
- Vérifier que le fichier de clé de service existe
- Vérifier que `GOOGLE_APPLICATION_CREDENTIALS` pointe vers le bon fichier
- Vérifier que le compte de service a les bonnes permissions

#### "Module not found"
```bash
npm install  # Réinstaller les dépendances
```

#### "Port already in use"
```bash
# Changer le port dans .env
PORT=3000
```

#### "Gemini API errors"
- Vérifier que l'API Vertex AI est activée sur GCP
- Vérifier les quotas et limites de l'API
- Vérifier les credentials et permissions

### Exemple de sortie JSON

Voici un exemple de sortie JSON générée par `PerceptionAgent` pour la commande `"Analyse cette page"` :

```json
{
  "sections": [
    {
      "title": "Introduction",
      "content": "Bienvenue sur notre site..."
    },
    {
      "title": "Contact",
      "content": "Envoyez-nous un message via le formulaire ci-dessous."
    }
  ],
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "labels": ["Graphique", "Ventes", "2024"]
    },
    {
      "url": "https://example.com/image2.jpg",
      "labels": ["Logo", "Entreprise"]
    }
  ],
  "forms": [
    {
      "action": "/submit",
      "fields": [
        {
          "name": "email",
          "type": "email",
          "required": true
        },
        {
          "name": "message",
          "type": "textarea"
        }
      ]
    }
  ]
}

### Logs et debugging

Les logs sont affichés dans la console. Pour plus de détails :
```bash
LOG_LEVEL=debug npm start
```

## Architecture

### Composants principaux

1. **PlanningAgent** : Cerveau de l'application, génère les plans d'action
2. **MemoryManager** : Gère l'historique et le contexte des conversations
3. **Express Server** : API REST pour l'interface web
4. **Vertex AI Integration** : Communication avec Gemini AI

### Flux de données

1. L'utilisateur envoie une commande via l'interface web
2. Le serveur Express reçoit la requête
3. Le PlanningAgent analyse la commande avec Gemini
4. Un plan JSON structuré est généré
5. Le plan est sauvegardé en mémoire
6. Le résultat est retourné à l'interface

## Contribution

Pour contribuer au projet :

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Support

Pour toute question ou problème :
- Créer une issue sur GitHub
- Consulter les logs d'erreur
- Vérifier la documentation Google Cloud Vertex AI

## Versions

- **v1.0.0** : Version initiale avec intégration Gemini et interface web