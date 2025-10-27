"""
Graphe ADK Principal - Agent de Navigation Vocale
Architecture basée sur LangGraph pour orchestrer les agents spécialisés
"""
    # Charger les variables d'environnement
from dotenv import load_dotenv
import os
from typing import TypedDict, Annotated, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Import des agents spécialisés
from search_agent import SearchAgent
from navigation_agent import NavigationAgent
from form_agent import FormAgent

load_dotenv()

class AgentState(TypedDict):
    """État partagé entre tous les agents"""
    # Messages de conversation
    messages: Annotated[List[Any], "Liste des messages de conversation"]
    
    # Contexte de navigation
    current_url: str
    page_title: str
    page_content: Dict[str, Any]
    
    # Résultats de recherche
    search_results: List[Dict[str, Any]]
    selected_article: Dict[str, Any]
    
    # Contexte utilisateur
    user_email: str
    user_preferences: Dict[str, Any]
    
    # Prochain agent à exécuter
    next_agent: str
    
    # Action à exécuter
    action: Dict[str, Any]
    
    # Réponse finale
    response_text: str
    needs_confirmation: bool

google_api_key = os.getenv("GOOGLE_API_KEY")
print(f"DEBUG: GOOGLE_API_KEY loaded: {google_api_key is not None}")
class AVNGraphAgent:
    """Agent orchestrateur principal utilisant LangGraph"""
    
    def __init__(self, use_openai: bool = False):
        """
        Initialise le graphe d'agents
        
        Args:
            use_openai: Si True, utilise OpenAI, sinon Google Gemini
        """
        # Configuration du LLM
        if use_openai:
            self.llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.7,
                api_key=google_api_key
            )
        else:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.5,
                api_key=os.getenv("GOOGLE_API_KEY")
            )
        
        # Initialiser les agents spécialisés
        self.search_agent = SearchAgent(self.llm)
        self.navigation_agent = NavigationAgent(self.llm)
        self.form_agent = FormAgent(self.llm)
        
        # Construire le graphe
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Construit le graphe de workflow avec LangGraph"""
        
        # Créer le graphe
        workflow = StateGraph(AgentState)
        
        # Ajouter les nœuds (agents)
        workflow.add_node("router", self._route_request)
        workflow.add_node("search", self._handle_search)
        workflow.add_node("navigation", self._handle_navigation)
        workflow.add_node("form", self._handle_form)
        workflow.add_node("response", self._generate_response)
        
        # Définir les transitions
        workflow.set_entry_point("router")
        
        # Router vers les agents spécialisés
        workflow.add_conditional_edges(
            "router",
            self._decide_next_agent,
            {
                "search": "search",
                "navigation": "navigation",
                "form": "form",
                "response": "response"
            }
        )
        
        # Tous les agents peuvent mener à la réponse
        workflow.add_edge("search", "response")
        workflow.add_edge("navigation", "response")
        workflow.add_edge("form", "response")
        workflow.add_edge("response", END)
        
        # Compiler le graphe avec checkpoints pour la mémoire
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)
    
    def _route_request(self, state: AgentState) -> AgentState:
        """Analyse la requête et détermine quel agent doit la traiter"""
        
        last_message = state["messages"][-1].content if state["messages"] else ""
        
        # Créer un prompt pour le routeur
        system_prompt = """Tu es un routeur intelligent pour un assistant vocal.
Analyse la requête de l'utilisateur et détermine quelle action effectuer:

- SEARCH: Si l'utilisateur demande une recherche (ex: "recherche", "trouve", "cherche")
- NAVIGATION: Si l'utilisateur veut naviguer ou ouvrir un lien (ex: "ouvre", "va sur", "lis l'article")
- FORM: Si l'utilisateur veut remplir un formulaire (ex: "inscris", "remplis", "soumets")
- RESPONSE: Pour toutes les autres questions ou confirmations

Réponds UNIQUEMENT avec l'un de ces mots: SEARCH, NAVIGATION, FORM, ou RESPONSE"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Requête utilisateur: {last_message}")
        ]
        
        response = self.llm.invoke(messages)
        decision = response.content.strip().upper()
        
        # Mapper vers les noms d'agents
        agent_map = {
            "SEARCH": "search",
            "NAVIGATION": "navigation",
            "FORM": "form",
            "RESPONSE": "response"
        }
        
        state["next_agent"] = agent_map.get(decision, "response")
        print(f"🎯 Router: {last_message[:50]}... → {state['next_agent']}")
        
        return state
    
    def _decide_next_agent(self, state: AgentState) -> str:
        """Décide quel agent exécuter ensuite"""
        return state.get("next_agent", "response")
    
    def _handle_search(self, state: AgentState) -> AgentState:
        """Délègue au SearchAgent"""
        print("🔍 Exécution SearchAgent...")
        return self.search_agent.process(state)
    
    def _handle_navigation(self, state: AgentState) -> AgentState:
        """Délègue au NavigationAgent"""
        print("🧭 Exécution NavigationAgent...")
        return self.navigation_agent.process(state)
    
    def _handle_form(self, state: AgentState) -> AgentState:
        """Délègue au FormAgent"""
        print("📝 Exécution FormAgent...")
        return self.form_agent.process(state)
    
    def _generate_response(self, state: AgentState) -> AgentState:
        """Génère la réponse finale pour l'utilisateur"""
        
        # Si une réponse a déjà été générée par un agent, la retourner
        if state.get("response_text"):
            return state
        
        # Sinon, générer une réponse par défaut
        last_message = state["messages"][-1].content if state["messages"] else ""
        
        system_prompt = """Tu es AVN, un assistant vocal pour personnes malvoyantes.
Réponds de manière concise et claire. Mentionne toujours les actions que tu as effectuées."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=last_message)
        ]
        
        response = self.llm.invoke(messages)
        state["response_text"] = response.content
        state["needs_confirmation"] = False
        
        return state
    
    def process_request(
        self,
        user_message: str,
        context: Dict[str, Any] = None,
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Traite une requête utilisateur
        
        Args:
            user_message: Message de l'utilisateur
            context: Contexte additionnel (page courante, etc.)
            session_id: ID de session pour la mémoire
        
        Returns:
            Dict contenant la réponse et les actions à effectuer
        """
        
        # Initialiser l'état
        initial_state: AgentState = {
            "messages": [HumanMessage(content=user_message)],
            "current_url": context.get("url", "") if context else "",
            "page_title": context.get("title", "") if context else "",
            "page_content": context.get("content", {}) if context else {},
            "search_results": [],
            "selected_article": {},
            "user_email": context.get("user_email", "user@avn.com") if context else "user@avn.com",
            "user_preferences": context.get("preferences", {}) if context else {},
            "next_agent": "",
            "action": {},
            "response_text": "",
            "needs_confirmation": False
        }
        
        # Exécuter le graphe
        config = {"configurable": {"thread_id": session_id}}
        final_state = self.graph.invoke(initial_state, config)
        
        # Retourner le résultat
        return {
            "text": final_state.get("response_text", ""),
            "action": final_state.get("action", {}),
            "needs_confirmation": final_state.get("needs_confirmation", False),
            "search_results": final_state.get("search_results", []),
            "context": {
                "url": final_state.get("current_url", ""),
                "title": final_state.get("page_title", "")
            }
        }


# Point d'entrée pour tester le graphe
if __name__ == "__main__":
    import sys
    
    # Charger les variables d'environnement
    from dotenv import load_dotenv
    load_dotenv()
    
    # Créer l'agent
    agent = AVNGraphAgent(use_openai=False)
    
    # Tests des cas d'usage
    print("\n" + "="*60)
    print("TEST CAS D'USAGE #1: Recherche et Résumé")
    print("="*60)
    result = agent.process_request(
        "Recherche les dernières nouvelles sur l'intelligence artificielle"
    )
    print(f"\n🤖 Réponse: {result['text']}")
    print(f"🎬 Action: {result['action']}")
    
    if result.get('search_results'):
        print("\n" + "="*60)
        print("TEST CAS D'USAGE #2: Navigation Guidée")
        print("="*60)
        result2 = agent.process_request(
            "Oui, lis l'article sur Gemini",
            context={
                "search_results": result['search_results']
            }
        )
        print(f"\n🤖 Réponse: {result2['text']}")
        print(f"🎬 Action: {result2['action']}")
