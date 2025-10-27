"""
NavigationAgent - Agent spécialisé pour la navigation web
Cas d'usage #2: Navigation guidée avec confirmation
"""

from typing import Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
import re


class NavigationAgent:
    """Agent pour gérer la navigation et valider les actions"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traite une requête de navigation
        
        Args:
            state: État actuel du graphe
        
        Returns:
            État mis à jour avec l'action de navigation
        """
        
        last_message = state["messages"][-1].content.lower()
        
        print(f"🧭 Navigation: {last_message}")
        
        # Détecter le type de navigation
        if any(word in last_message for word in ["ouvre", "lis", "article", "lien"]):
            return self._handle_link_navigation(state)
        
        elif any(word in last_message for word in ["retour", "précédent"]):
            return self._handle_back_navigation(state)
        
        elif any(word in last_message for word in ["scroll", "descend", "bas"]):
            return self._handle_scroll(state, direction="down")
        
        elif any(word in last_message for word in ["haut", "monte"]):
            return self._handle_scroll(state, direction="up")
        
        else:
            # Navigation générique
            state["response_text"] = "Je n'ai pas compris l'action de navigation souhaitée. Pouvez-vous préciser ?"
            state["action"] = {}
        
        return state
    
    def _handle_link_navigation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gère la navigation vers un lien (article, page web)
        """
        
        last_message = state["messages"][-1].content
        search_results = state.get("search_results", [])
        
        # Déterminer quel article l'utilisateur veut ouvrir
        target_url = None
        target_title = None
        
        # Stratégie 1: Référence explicite (premier, deuxième, etc.)
        number_match = re.search(r'(premier|deuxième|troisième|1er|2ème|3ème|\d)', last_message.lower())
        if number_match and search_results:
            num_str = number_match.group(1)
            rank_map = {
                'premier': 1, '1er': 1,
                'deuxième': 2, '2ème': 2,
                'troisième': 3, '3ème': 3
            }
            rank = rank_map.get(num_str, int(num_str) if num_str.isdigit() else 1)
            
            if 0 < rank <= len(search_results):
                result = search_results[rank - 1]
                target_url = result['url']
                target_title = result['title']
        
        # Stratégie 2: Référence par mot-clé (ex: "l'article sur Gemini")
        elif search_results:
            # Utiliser le LLM pour matcher le meilleur résultat
            results_text = "\n".join([
                f"{r['rank']}. {r['title']}"
                for r in search_results
            ])
            
            system_prompt = """Tu es un assistant qui identifie l'article souhaité.
L'utilisateur fait référence à un article de la liste.
Réponds UNIQUEMENT avec le numéro de l'article (1, 2, ou 3).
Si tu n'es pas sûr, réponds avec 1."""
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Articles:\n{results_text}\n\nUtilisateur: {last_message}")
            ]
            
            response = self.llm.invoke(messages)
            try:
                rank = int(response.content.strip())
                if 0 < rank <= len(search_results):
                    result = search_results[rank - 1]
                    target_url = result['url']
                    target_title = result['title']
            except:
                # Par défaut, prendre le premier
                if search_results:
                    result = search_results[0]
                    target_url = result['url']
                    target_title = result['title']
        
        # Si on a trouvé un lien, préparer l'action
        if target_url:
            state["action"] = {
                "type": "navigate",
                "url": target_url,
                "method": "click"  # ou "direct" pour window.location
            }
            
            state["response_text"] = (
                f"C'est confirmé. Je vous emmène sur {target_title}. "
                f"Voulez-vous que je commence la lecture de l'introduction ?"
            )
            
            state["needs_confirmation"] = True
            state["selected_article"] = {
                "url": target_url,
                "title": target_title
            }
            
            # Simuler le nouveau contexte de page (sera mis à jour par le frontend)
            state["current_url"] = target_url
            state["page_title"] = target_title
            
        else:
            state["response_text"] = "Je n'ai pas pu identifier l'article que vous voulez ouvrir. Pouvez-vous préciser ?"
            state["action"] = {}
        
        return state
    
    def _handle_back_navigation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gère la navigation arrière
        """
        state["action"] = {
            "type": "navigate",
            "method": "back"
        }
        
        state["response_text"] = "Je reviens à la page précédente."
        
        return state
    
    def _handle_scroll(self, state: Dict[str, Any], direction: str = "down") -> Dict[str, Any]:
        """
        Gère le défilement de page
        """
        state["action"] = {
            "type": "scroll",
            "direction": direction,
            "amount": 300  # pixels
        }
        
        direction_text = "vers le bas" if direction == "down" else "vers le haut"
        state["response_text"] = f"Je fais défiler la page {direction_text}."
        
        return state
    
    def validate_page_load(
        self,
        expected_title: str,
        actual_title: str,
        expected_url: str,
        actual_url: str
    ) -> bool:
        """
        Valide qu'une page s'est bien chargée (pour le cas d'usage #2)
        
        Args:
            expected_title: Titre attendu
            actual_title: Titre réel de la page
            expected_url: URL attendue
            actual_url: URL réelle
        
        Returns:
            True si la page correspond
        """
        # Vérification simple: l'URL ou le titre correspondent partiellement
        url_match = expected_url.lower() in actual_url.lower()
        
        # Extraire les mots clés du titre attendu
        expected_keywords = set(expected_title.lower().split())
        actual_keywords = set(actual_title.lower().split())
        
        # Au moins 30% des mots en commun
        if expected_keywords:
            overlap = len(expected_keywords & actual_keywords) / len(expected_keywords)
            title_match = overlap >= 0.3
        else:
            title_match = True
        
        return url_match or title_match


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
    
    agent = NavigationAgent(llm)
    
    # Simuler des résultats de recherche
    test_state = {
        "messages": [HumanMessage(content="Oui, lis l'article sur Gemini")],
        "search_results": [
            {
                "rank": 1,
                "title": "Google lance Gemini 2.5 Pro",
                "url": "https://blog.google/technology/ai/google-gemini-ai/",
                "snippet": "Google présente Gemini 2.5 Pro..."
            },
            {
                "rank": 2,
                "title": "Les régulations de l'IA en Europe",
                "url": "https://europa.eu/ai-act",
                "snippet": "L'Union Européenne..."
            }
        ],
        "current_url": "",
        "page_title": "",
        "response_text": "",
        "needs_confirmation": False,
        "action": {},
        "selected_article": {}
    }
    
    result = agent.process(test_state)
    print("\n" + "="*60)
    print("RÉSULTAT DU TEST - NAVIGATION")
    print("="*60)
    print(f"\n🤖 Réponse:\n{result['response_text']}")
    print(f"\n🎬 Action:\n{result['action']}")
