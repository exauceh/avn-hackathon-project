#!/bin/bash

# Script d'installation pour la démo AVN

echo "🚀 Installation de l'environnement AVN Hackathon"
echo "================================================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Vérifier Python
echo ""
echo "🔍 Vérification de Python..."
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python n'est pas installé${NC}"
    echo "   Installez Python 3.10+ depuis https://www.python.org/"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)
PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✅ Python $PYTHON_VERSION détecté${NC}"

# Vérifier pip
echo ""
echo "🔍 Vérification de pip..."
if ! $PYTHON_CMD -m pip --version &> /dev/null; then
    echo -e "${RED}❌ pip n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pip installé${NC}"

# Installation Backend (Agents ADK)
echo ""
echo "📦 Installation des dépendances Backend (Agents ADK)..."
cd core/agents

# Créer l'environnement virtuel
if [ ! -d "venv" ]; then
    echo "   Création de l'environnement virtuel..."
    $PYTHON_CMD -m venv venv
fi

# Activer l'environnement virtuel
source venv/bin/activate

# Installer les dépendances
echo "   Installation des packages Python..."
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances Backend installées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation${NC}"
    exit 1
fi

cd ../..

# Installation API Gateway
echo ""
echo "📦 Installation des dépendances API Gateway..."
cd cloud/services/api-gateway

# Utiliser le même environnement virtuel ou en créer un nouveau
if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances API Gateway installées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation${NC}"
    exit 1
fi

cd ../../..

# Configuration des variables d'environnement
echo ""
echo "⚙️  Configuration des variables d'environnement..."
if [ ! -f "core/agents/.env" ]; then
    echo "   Copie de .env.example vers .env..."
    cp core/agents/.env.example core/agents/.env
    echo -e "${YELLOW}⚠️  Veuillez éditer core/agents/.env et remplir vos API keys${NC}"
    echo "   - GOOGLE_API_KEY (obligatoire)"
    echo "   - GOOGLE_APPLICATION_CREDENTIALS (obligatoire)"
    echo "   - OPENAI_API_KEY (optionnel)"
else
    echo -e "${GREEN}✅ Fichier .env déjà existant${NC}"
fi

# Rendre les scripts exécutables
echo ""
echo "🔧 Configuration des scripts de démarrage..."
chmod +x start_demo.sh
chmod +x stop_demo.sh
echo -e "${GREEN}✅ Scripts configurés${NC}"



# Résumé
echo ""
echo "================================================"
echo -e "${GREEN}🎉 Installation terminée !${NC}"
echo "================================================"
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1. ${BLUE}Configurer les API Keys${NC}"
echo "   Éditez : core/agents/.env"
echo "   Ajoutez :"
echo "   - GOOGLE_API_KEY=votre_cle_google_ai"
echo "   - GOOGLE_APPLICATION_CREDENTIALS=../../cloud/keys/votre_fichier.json"
echo ""
echo "2. ${BLUE}Configurer Google Cloud Pub/Sub${NC}"
echo "   gcloud auth login"
echo "   gcloud config set project avn-hackathon-project"
echo "   gcloud pubsub topics create voice.input"
echo "   gcloud pubsub topics create avn-agent-response"
echo "   gcloud pubsub subscriptions create avn-input-sub --topic=voice.input"
echo "   gcloud pubsub subscriptions create agent-reply-sub --topic=avn-agent-response"
echo ""
echo "3. ${BLUE}Charger l'extension Chrome${NC}"
echo "   - Ouvrez chrome://extensions/"
echo "   - Activez le 'Mode développeur'"
echo "   - Cliquez 'Charger l'extension non empaquetée'"
echo "   - Sélectionnez le dossier : frontend/"
echo ""
echo "4. ${BLUE}Démarrer la démo${NC}"
echo "   ./start_demo.sh"
echo ""
echo "📖 Documentation complète : README_DEMO.md"
echo ""
