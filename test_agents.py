#!/usr/bin/env python3
"""
Test rapide du graphe ADK sans dépendances externes
Vérifie que les agents sont correctement implémentés
"""

import sys
import os

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'core', 'agents'))

def test_imports():
    """Test des imports"""
    print("🔍 Test des imports...")
    
    try:
        from graph_agent import AVNGraphAgent, AgentState
        print("  ✅ graph_agent importé")
    except ImportError as e:
        print(f"  ❌ Erreur import graph_agent: {e}")
        return False
    
    try:
        from search_agent import SearchAgent
        print("  ✅ search_agent importé")
    except ImportError as e:
        print(f"  ❌ Erreur import search_agent: {e}")
        return False
    
    try:
        from navigation_agent import NavigationAgent
        print("  ✅ navigation_agent importé")
    except ImportError as e:
        print(f"  ❌ Erreur import navigation_agent: {e}")
        return False
    
    try:
        from form_agent import FormAgent
        print("  ✅ form_agent importé")
    except ImportError as e:
        print(f"  ❌ Erreur import form_agent: {e}")
        return False
    
    return True

def test_structure():
    """Test de la structure des agents"""
    print("\n🔍 Test de la structure...")
    
    try:
        from search_agent import SearchAgent
        from navigation_agent import NavigationAgent
        from form_agent import FormAgent
        
        # Créer un mock LLM simple
        class MockLLM:
            def invoke(self, messages):
                class Response:
                    content = "RESPONSE"
                return Response()
        
        llm = MockLLM()
        
        # Tester l'instanciation
        search = SearchAgent(llm)
        print("  ✅ SearchAgent instancié")
        
        navigation = NavigationAgent(llm)
        print("  ✅ NavigationAgent instancié")
        
        form = FormAgent(llm)
        print("  ✅ FormAgent instancié")
        
        # Vérifier que les méthodes process existent
        assert hasattr(search, 'process'), "SearchAgent.process manquant"
        assert hasattr(navigation, 'process'), "NavigationAgent.process manquant"
        assert hasattr(form, 'process'), "FormAgent.process manquant"
        print("  ✅ Toutes les méthodes process existent")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Erreur structure: {e}")
        return False

def test_graph():
    """Test du graphe (basique)"""
    print("\n🔍 Test du graphe...")
    
    try:
        from graph_agent import AVNGraphAgent
        
        # Vérifier que la classe existe et a les bonnes méthodes
        assert hasattr(AVNGraphAgent, '__init__'), "AVNGraphAgent.__init__ manquant"
        assert hasattr(AVNGraphAgent, '_build_graph'), "AVNGraphAgent._build_graph manquant"
        assert hasattr(AVNGraphAgent, 'process_request'), "AVNGraphAgent.process_request manquant"
        
        print("  ✅ Classe AVNGraphAgent correctement structurée")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Erreur graphe: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Fonction principale"""
    print("="*60)
    print("🧪 Tests Rapides du Graphe ADK")
    print("="*60)
    
    results = []
    
    # Test 1: Imports
    results.append(("Imports", test_imports()))
    
    # Test 2: Structure
    results.append(("Structure", test_structure()))
    
    # Test 3: Graphe
    results.append(("Graphe", test_graph()))
    
    # Résumé
    print("\n" + "="*60)
    print("📊 Résumé des Tests")
    print("="*60)
    
    for name, passed in results:
        status = "✅" if passed else "❌"
        print(f"{status} {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\n{passed}/{total} tests réussis")
    
    if passed == total:
        print("\n✅ Tous les tests sont passés !")
        print("ℹ️  Pour un test complet avec LLM, configurez .env et exécutez:")
        print("   cd core/agents")
        print("   source venv/bin/activate")
        print("   python search_agent.py")
        return 0
    else:
        print("\n❌ Certains tests ont échoué")
        print("ℹ️  Vérifiez que toutes les dépendances sont installées:")
        print("   ./install.sh")
        return 1

if __name__ == "__main__":
    sys.exit(main())
