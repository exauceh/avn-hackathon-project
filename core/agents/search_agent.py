"""
SearchAgent - Agent spécialisé pour la recherche et le résumé
Cas d'usage #1: Recherche les dernières nouvelles et les résume
"""

from typing import Dict, Any, List
import requests
from bs4 import BeautifulSoup
from langchain_core.messages import SystemMessage, HumanMessage
from googleapiclient.discovery import build
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
CUSTOM_SEARCH_CX = os.getenv("CUSTOM_SEARCH_CX")
class SearchAgent:
    """Agent pour effectuer des recherches et extraire des informations"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traite une requête de recherche
        
        Args:
            state: État actuel du graphe
        
        Returns:
            État mis à jour avec les résultats
        """
        
        # Extraire la requête de recherche
        last_message = state["messages"][-1].content
        
        print(f"🔍 Recherche en cours: {last_message}")
        
        # Effectuer la recherche Google
        try:
            search_results = self._google_search(last_message)
            state["search_results"] = search_results
            
            # Générer un résumé des résultats
            summary = self._generate_summary(search_results, last_message)
            
            state["response_text"] = summary
            state["needs_confirmation"] = True
            
            # Pas d'action DOM pour le moment, juste informationnel
            state["action"] = {
                "type": "info",
                "data": search_results
            }
            
        except Exception as e:
            print(f"❌ Erreur recherche: {e}")
            state["response_text"] = f"Désolé, je n'ai pas pu effectuer la recherche. Erreur: {str(e)}"
            state["search_results"] = []
        
        return state
    
    def _google_search(self, query: str, num_results: int = 3) -> List[Dict[str, Any]]:
        """
        Effectue une recherche Google en utilisant l'API Custom Search (CSE).
        """


        if not GOOGLE_SEARCH_API_KEY or not CUSTOM_SEARCH_CX:
            print("❌ Erreur: Clé API ou CX manquants pour l'API Google Search.")
            return self._get_demo_results(query) # Fallback

        try:
            # 1. Construire le service API
            service = build(
                "customsearch", 
                "v1", 
                developerKey=GOOGLE_SEARCH_API_KEY
            )

            # 2. Exécuter la recherche
            res = service.cse().list(
                q=query,
                cx=CUSTOM_SEARCH_CX,
                lr='lang_fr', # Limite la recherche aux résultats en français
                num=num_results # Nombre de résultats
            ).execute()

            results = []
            
            # 3. Traiter les résultats
            for i, item in enumerate(res.get('items', [])):
                results.append({
                    "rank": i + 1,
                    "title": item.get('title', 'Sans titre'),
                    "url": item.get('link', ''),
                    "snippet": item.get('snippet', 'Description non disponible')
                })
                
                print(f"  ✅ Résultat {i+1} (API): {item.get('title', 'Sans titre')[:50]}...")

            return results

        except Exception as e:
            # L'API renverra des erreurs claires (403 si clé invalide/quota dépassé)
            print(f"❌ Erreur API Google Custom Search: {e}")
            return self._get_demo_results(query) # Fallback
    
  
    def _get_demo_results(self, query: str) -> List[Dict[str, Any]]:
        """
        Retourne des résultats de démo si la recherche Google échoue
        Utile pour tester sans accès à Internet ou si l'API est bloquée
        """
        return [
            {
                "rank": 1,
                "title": "Google lance Gemini 2.5 Pro - Une nouvelle ère pour l'IA",
                "url": "https://blog.google/technology/ai/google-gemini-ai/",
                "snippet": "Google présente Gemini 2.5 Pro, son modèle d'IA le plus avancé avec des capacités multimodales révolutionnaires..."
            },
            {
                "rank": 2,
                "title": "Les régulations de l'IA en Europe - Ce qui change en 2025",
                "url": "https://europa.eu/ai-act",
                "snippet": "L'Union Européenne met en place de nouvelles régulations pour encadrer le développement de l'intelligence artificielle..."
            },
            {
                "rank": 3,
                "title": "OpenAI annonce GPT-5 - Vers l'AGI ?",
                "url": "https://openai.com/blog/gpt-5",
                "snippet": "OpenAI dévoile GPT-5, marquant une avancée significative vers l'intelligence artificielle générale..."
            }
        ]
    
    def _generate_summary(self, results: List[Dict[str, Any]], query: str) -> str:
        """
        Génère un résumé vocal des résultats de recherche
        
        Args:
            results: Liste des résultats de recherche
            query: Requête originale
        
        Returns:
            Résumé textuel pour TTS
        """
        if not results:
            return "Je n'ai trouvé aucun résultat pour votre recherche."
        
        # Créer un prompt pour le LLM
        results_text = "\n\n".join([
            f"Résultat {r['rank']}: {r['title']}\n"
            f"URL: {r['url']}\n"
            f"Description: {r['snippet']}"
            for r in results
        ])
        
        system_prompt = """Tu es AVN, un assistant vocal pour personnes malvoyantes.
Résume les résultats de recherche de manière claire et concise.
Structure ta réponse ainsi:
1. Nombre de résultats trouvés
2. Bref résumé de chaque article (titre + point clé)
3. Question finale: "Voulez-vous que j'analyse l'un de ces articles ou que je continue la lecture ?"

Sois concis et naturel dans ton expression."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Requête: {query}\n\nRésultats:\n{results_text}")
        ]
        
        response = self.llm.invoke(messages)
        return response.content


# Test standalone
if __name__ == "__main__":
    from langchain_google_genai import ChatGoogleGenerativeAI
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=os.getenv("GOOGLE_API_KEY")
    )
    
    agent = SearchAgent(llm)
    
    test_state = {
        "messages": [HumanMessage(content="dernières nouvelles IA")],
        "search_results": [],
        "response_text": "",
        "needs_confirmation": False,
        "action": {}
    }
    
    result = agent.process(test_state)
    print("\n" + "="*60)
    print("RÉSULTAT DU TEST")
    print("="*60)
    print(f"\n🤖 Réponse:\n{result['response_text']}")
    print(f"\n📊 Résultats trouvés: {len(result['search_results'])}")
    for r in result['search_results']:
        print(f"  {r['rank']}. {r['title']}")
