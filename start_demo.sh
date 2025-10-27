#!/bin/bash

# Script de démarrage rapide pour la démo AVN

echo "🚀 Démarrage de l'environnement AVN Hackathon"
echo "=============================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si on est dans le bon répertoire
if [ ! -d "core/agents" ]; then
    echo -e "${RED}❌ Erreur: Exécutez ce script depuis la racine du projet${NC}"
    exit 1
fi

# Fonction pour vérifier si un port est occupé
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Vérifier les variables d'environnement
echo ""
echo "🔍 Vérification de la configuration..."

if [ ! -f "core/agents/.env" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé${NC}"
    echo "   Copiez .env.example vers .env et remplissez les valeurs"
    exit 1
fi

if ! grep -q "GOOGLE_API_KEY=\S" core/agents/.env; then
    echo -e "${RED}❌ GOOGLE_API_KEY non configurée dans .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration OK${NC}"

# Vérifier si l'API Gateway est déjà lancée
if check_port 8080; then
    echo -e "${YELLOW}⚠️  API Gateway déjà en cours d'exécution sur le port 8080${NC}"
else
    echo ""
    echo "📡 Démarrage de l'API Gateway..."
    cd cloud/services/api-gateway
    python main.py &
    API_GATEWAY_PID=$!
    cd ../../..
    echo -e "${GREEN}✅ API Gateway démarrée (PID: $API_GATEWAY_PID)${NC}"
    sleep 3
fi

# Démarrer le service Agent ADK
echo ""
echo "🤖 Démarrage du service Agent ADK..."
cd core/agents

# Activer l'environnement virtuel s'il existe
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo -e "${YELLOW}⚠️  Environnement virtuel non trouvé. Création...${NC}"
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Lancer le listener
python pubsub_listener.py &
AGENT_PID=$!
cd ../..

echo -e "${GREEN}✅ Agent ADK démarré (PID: $AGENT_PID)${NC}"

# Afficher les instructions
echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Environnement AVN prêt !${NC}"
echo "=============================================="
echo ""
echo "📋 Services actifs :"
echo "   • API Gateway : http://127.0.0.1:8080"
echo "   • Agent ADK   : Écoute Pub/Sub"
echo ""
echo "🎮 Pour tester :"
echo "   1. Ouvrez Chrome avec l'extension AVN"
echo "   2. Appuyez sur Ctrl+Shift+L"
echo "   3. Dites : 'Recherche les dernières nouvelles sur l'IA'"
echo ""
echo "🛑 Pour arrêter :"
echo "   Appuyez sur Ctrl+C ou exécutez : kill $API_GATEWAY_PID $AGENT_PID"
echo ""

# Sauvegarder les PIDs pour le nettoyage
echo "$API_GATEWAY_PID" > .avn_api_pid
echo "$AGENT_PID" > .avn_agent_pid

# Attendre que l'utilisateur arrête
trap 'echo ""; echo "🛑 Arrêt des services..."; kill $API_GATEWAY_PID $AGENT_PID 2>/dev/null; rm -f .avn_api_pid .avn_agent_pid; echo "✅ Services arrêtés"; exit 0' INT TERM

# Garder le script actif
wait
