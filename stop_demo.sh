#!/bin/bash

# Script d'arrêt pour la démo AVN

echo "🛑 Arrêt de l'environnement AVN..."

# Lire les PIDs sauvegardés
if [ -f ".avn_api_pid" ]; then
    API_PID=$(cat .avn_api_pid)
    kill $API_PID 2>/dev/null
    echo "✅ API Gateway arrêtée (PID: $API_PID)"
    rm -f .avn_api_pid
fi

if [ -f ".avn_agent_pid" ]; then
    AGENT_PID=$(cat .avn_agent_pid)
    kill $AGENT_PID 2>/dev/null
    echo "✅ Agent ADK arrêté (PID: $AGENT_PID)"
    rm -f .avn_agent_pid
fi

# Tuer tous les processus Python liés au projet
pkill -f "main.py"
pkill -f "pubsub_listener.py"

echo "✅ Tous les services sont arrêtés"
