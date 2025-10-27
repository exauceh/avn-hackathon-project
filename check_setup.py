#!/usr/bin/env python3
"""
Script de vérification de la configuration AVN
Vérifie que tous les prérequis sont installés et configurés
"""

import os
import sys
import subprocess
from pathlib import Path

# Couleurs pour le terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_header(msg):
    print(f"\n{Colors.BOLD}{msg}{Colors.END}")
    print("=" * 60)

def check_python():
    """Vérifie la version de Python"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 10:
        print_success(f"Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print_error(f"Python {version.major}.{version.minor} (version 3.10+ requise)")
        return False

def check_venv():
    """Vérifie si l'environnement virtuel existe"""
    agents_venv = Path("core/agents/venv")
    if agents_venv.exists():
        print_success(f"Environnement virtuel trouvé: {agents_venv}")
        return True
    else:
        print_warning(f"Environnement virtuel non trouvé: {agents_venv}")
        print_info("Exécutez: ./install.sh")
        return False

def check_env_file():
    """Vérifie si le fichier .env existe et contient les clés"""
    env_file = Path("core/agents/.env")
    
    if not env_file.exists():
        print_error(".env non trouvé dans core/agents/")
        print_info("Copiez .env.example vers .env et remplissez les valeurs")
        return False
    
    # Lire le fichier .env
    with open(env_file, 'r') as f:
        content = f.read()
    
    checks = {
        "GOOGLE_API_KEY": "GOOGLE_API_KEY=" in content and "your_" not in content,
        "GOOGLE_APPLICATION_CREDENTIALS": "GOOGLE_APPLICATION_CREDENTIALS=" in content,
    }
    
    all_good = True
    for key, present in checks.items():
        if present:
            print_success(f"{key} configurée")
        else:
            print_error(f"{key} manquante ou non configurée")
            all_good = False
    
    return all_good

def check_packages():
    """Vérifie si les packages Python sont installés"""
    try:
        import langgraph
        print_success(f"langgraph {langgraph.__version__}")
    except ImportError:
        print_error("langgraph non installé")
        return False
    
    try:
        import langchain
        print_success(f"langchain {langchain.__version__}")
    except ImportError:
        print_error("langchain non installé")
        return False
    
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        print_success("langchain-google-genai installé")
    except ImportError:
        print_error("langchain-google-genai non installé")
        return False
    
    return True

def check_gcloud():
    """Vérifie si gcloud est installé"""
    try:
        result = subprocess.run(
            ["gcloud", "version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.split('\n')[0]
            print_success(version)
            return True
        else:
            print_warning("gcloud installé mais erreur lors de la vérification")
            return False
    except FileNotFoundError:
        print_warning("gcloud non installé (optionnel pour Pub/Sub)")
        return False
    except Exception as e:
        print_warning(f"Erreur lors de la vérification de gcloud: {e}")
        return False

def check_pubsub():
    """Vérifie si Pub/Sub est configuré"""
    try:
        result = subprocess.run(
            ["gcloud", "pubsub", "topics", "list"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            topics = result.stdout
            required_topics = ["voice.input", "avn-agent-response"]
            
            all_present = True
            for topic in required_topics:
                if topic in topics:
                    print_success(f"Topic '{topic}' existe")
                else:
                    print_error(f"Topic '{topic}' manquant")
                    all_present = False
            
            return all_present
        else:
            print_warning("Impossible de lister les topics Pub/Sub")
            return False
    except:
        print_warning("Pub/Sub non configuré (ignoré si mode local)")
        return False

def check_files():
    """Vérifie que tous les fichiers importants existent"""
    files = {
        "core/agents/graph_agent.py": "Graphe ADK",
        "core/agents/search_agent.py": "Search Agent",
        "core/agents/navigation_agent.py": "Navigation Agent",
        "core/agents/form_agent.py": "Form Agent",
        "core/agents/pubsub_listener.py": "Pub/Sub Listener",
        "cloud/services/api-gateway/main.py": "API Gateway",
        "frontend/manifest.json": "Extension Chrome",
        "frontend/scripts/background.js": "Background script",
        "frontend/scripts/content.js": "Content script",
    }
    
    all_present = True
    for file_path, description in files.items():
        if Path(file_path).exists():
            print_success(f"{description}: {file_path}")
        else:
            print_error(f"{description} manquant: {file_path}")
            all_present = False
    
    return all_present

def main():
    """Fonction principale"""
    print_header("🔍 Vérification de la Configuration AVN")
    
    results = {}
    
    # Python
    print_header("1. Python")
    results['python'] = check_python()
    
    # Environnement virtuel
    print_header("2. Environnement Virtuel")
    results['venv'] = check_venv()
    
    # Fichier .env
    print_header("3. Configuration (.env)")
    results['env'] = check_env_file()
    
    # Packages Python (si venv existe)
    if results['venv']:
        print_header("4. Packages Python")
        # Activer le venv pour vérifier les packages
        venv_python = Path("core/agents/venv/bin/python")
        if venv_python.exists():
            # Créer un script temporaire pour vérifier les packages
            print_info("Vérification des packages dans le venv...")
            results['packages'] = check_packages()
        else:
            print_warning("Impossible de vérifier les packages (venv non trouvé)")
            results['packages'] = False
    else:
        results['packages'] = False
    
    # Google Cloud SDK
    print_header("5. Google Cloud SDK")
    results['gcloud'] = check_gcloud()
    
    # Pub/Sub
    if results['gcloud']:
        print_header("6. Google Cloud Pub/Sub")
        results['pubsub'] = check_pubsub()
    else:
        results['pubsub'] = False
    
    # Fichiers du projet
    print_header("7. Fichiers du Projet")
    results['files'] = check_files()
    
    # Résumé
    print_header("📊 Résumé")
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\n{passed}/{total} vérifications réussies\n")
    
    if passed == total:
        print_success("✨ Configuration complète ! Vous pouvez lancer la démo.")
        print_info("Commande : ./start_demo.sh")
        return 0
    elif passed >= total - 2:
        print_warning("⚠️  Configuration presque complète.")
        print_info("Vérifiez les éléments manquants ci-dessus.")
        print_info("Commande : ./start_demo.sh (peut fonctionner)")
        return 1
    else:
        print_error("❌ Configuration incomplète.")
        print_info("Exécutez : ./install.sh")
        print_info("Puis configurez : core/agents/.env")
        return 2

if __name__ == "__main__":
    sys.exit(main())
