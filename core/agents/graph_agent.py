"""
Main ADK Graph - Voice Navigation Agent
LangGraph-based architecture to orchestrate specialized agents
"""
# Load environment variables
import time
from dotenv import load_dotenv
import os
from typing import TypedDict, Annotated, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Import specialized agents
from search_agent import SearchAgent
from navigation_agent import NavigationAgent
from form_agent import FormAgent

load_dotenv()

class AgentState(TypedDict):
    """State shared between all agents"""
    # Conversation messages
    messages: Annotated[List[Any], "List of conversation messages"]
    
    # Navigation context
    current_url: str
    page_title: str
    page_content: Dict[str, Any]
    
    # Search results
    search_results: List[Dict[str, Any]]
    selected_article: Dict[str, Any]
    
    # User context
    user_email: str
    user_preferences: Dict[str, Any]
    
    # Next agent to execute
    next_agent: str
    
    # Action to execute
    action: Dict[str, Any]
    
    # Final response
    response_text: str
    needs_confirmation: bool

google_api_key = os.getenv("GOOGLE_API_KEY")
print(f"DEBUG: GOOGLE_API_KEY loaded: {google_api_key is not None}")

class AVNGraphAgent:
    """Main orchestrator agent using LangGraph"""
    
    def __init__(self, use_openai: bool = False):
        """
        Initialize the agent graph
        
        Args:
            use_openai: If True, uses OpenAI, otherwise Google Gemini
        """
        # LLM configuration
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
        
        # Initialize specialized agents
        self.search_agent = SearchAgent(self.llm)
        self.navigation_agent = NavigationAgent(self.llm)
        self.form_agent = FormAgent(self.llm)
        
        # Build the graph
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the workflow graph with LangGraph"""
        
        # Create the graph
        workflow = StateGraph(AgentState)
        
        # Add nodes (agents)
        workflow.add_node("router", self._route_request)
        workflow.add_node("search", self._handle_search)
        workflow.add_node("navigation", self._handle_navigation)
        workflow.add_node("form", self._handle_form)
        workflow.add_node("response", self._generate_response)
        
        # Define transitions
        workflow.set_entry_point("router")
        
        # Route to specialized agents
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
        
        # All agents can lead to response
        workflow.add_edge("search", "response")
        workflow.add_edge("navigation", "response")
        workflow.add_edge("form", "response")
        workflow.add_edge("response", END)
        
        # Compile the graph with checkpoints for memory
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)
    
    def _route_request(self, state: AgentState) -> AgentState:
        """Analyze the request and determine which agent should handle it"""
        
        last_message = state["messages"][-1].content if state["messages"] else ""
        
        # Create a prompt for the router
        system_prompt = """
        You are an intelligent router for a voice assistant.
        Analyze the user's request and determine which action to perform:

        - SEARCH: If the user requests a search (e.g., "search", "find", "look for")
        - NAVIGATION: If the user wants to navigate or open a link (e.g., "open", "go to", "read the article")
        - FORM: If the user wants to fill out a form (e.g., "register", "fill", "submit")
        - RESPONSE: For all other questions or confirmations

        Respond ONLY with one of these words: SEARCH, NAVIGATION, FORM, or RESPONSE
        """
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"User request: {last_message}")
        ]
        
        response = self.llm.invoke(messages)
        decision = response.content.strip().upper()
        
        # Map to agent names
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
        """Decide which agent to execute next"""
        return state.get("next_agent", "response")
    
    def _handle_search(self, state: AgentState) -> AgentState:
        """Delegate to SearchAgent"""
        print("🔍 Executing SearchAgent...")
        return self.search_agent.process(state)
    
    def _handle_navigation(self, state: AgentState) -> AgentState:
        """Delegate to NavigationAgent"""
        print("🧭 Executing NavigationAgent...")
        return self.navigation_agent.process(state)
    
    def _handle_form(self, state: AgentState) -> AgentState:
        """Delegate to FormAgent"""
        print("📝 Executing FormAgent...")
        return self.form_agent.process(state)
    
    def _generate_response(self, state: AgentState) -> AgentState:
        """Generate the final response for the user"""
        
        # If a response was already generated by an agent, return it
        if state.get("response_text"):
            return state
        
        # Otherwise, generate a default response
        last_message = state["messages"][-1].content if state["messages"] else ""
        
        system_prompt = """
        You are AVN, a voice assistant for visually impaired people.
        Respond concisely and clearly. Always mention the actions you have performed.
        """
        
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
        session_id: str = "default",
        graph_state: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process a user voice request
        
        Args:
            user_message: User transcribed text
            context: Page context (URL, title, content)
            session_id: Unique session identifier
            graph_state: État du graphe depuis le frontend (historique, résultats)
        
        Returns:
            Dictionary with response, action, and audio
        """
        
        print(f"\n{'='*60}")
        print(f"🎤 Voice request: {user_message}")
        print(f"🔑 Session: {session_id}")
        if graph_state:
            print(f"📚 Graph state: {len(graph_state.get('messages', []))} messages")
            print(f"🔍 Search results: {len(graph_state.get('search_results', []))} results")
        print("="*60)
        
        context = context or {}
        
        # Initialize state
        initial_state = {
            "messages": [HumanMessage(content=user_message)],
            "current_url": context.get("url", ""),
            "page_title": context.get("title", ""),
            "page_content": context.get("content", {}),
            "search_results": [],
            "selected_article": {},
            "user_email": context.get("user_email", "user@example.com"),
            "user_preferences": context.get("preferences", {}),
            "next_agent": "",
            "action": {},
            "response_text": "",
            "needs_confirmation": False
        }
        
        # ✅ RESTAURER L'HISTORIQUE DEPUIS LE GRAPH_STATE
        if graph_state:
            # Restaurer les derniers messages (limiter à 10 pour éviter un contexte trop grand)
            previous_messages = graph_state.get("messages", [])
            if previous_messages:
                print(f"📚 Restauration de {len(previous_messages)} messages d'historique")
                
                # Convertir les messages du graph_state en objets LangChain
                restored_messages = []
                for msg in previous_messages[-10:]:  # Limiter aux 10 derniers
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    
                    if role == "user":
                        restored_messages.append(HumanMessage(content=content))
                    elif role == "assistant":
                        restored_messages.append(AIMessage(content=content))
                
                # Ajouter le nouveau message de l'utilisateur
                restored_messages.append(HumanMessage(content=user_message))
                initial_state["messages"] = restored_messages
            
            # ✅ RESTAURER LES RÉSULTATS DE RECHERCHE
            search_results_from_state = graph_state.get("search_results", [])
            if search_results_from_state:
                initial_state["search_results"] = search_results_from_state
                print(f"🔍 Restauré {len(initial_state['search_results'])} résultats de recherche depuis graph_state")
                
                # Debug: afficher les titres
                for i, result in enumerate(initial_state["search_results"][:3], 1):
                    print(f"   {i}. {result.get('title', 'N/A')[:60]}")
            else:
                print(f"⚠️ Aucun search_results dans graph_state")
            
            # ✅ RESTAURER L'EMAIL ET LES PRÉFÉRENCES
            if graph_state.get("user_email"):
                initial_state["user_email"] = graph_state["user_email"]
            
            if graph_state.get("user_preferences"):
                initial_state["user_preferences"] = graph_state["user_preferences"]
        
        # Execute the graph
        config = {"configurable": {"thread_id": session_id}}
        
        print(f"\n🚀 Executing graph with {len(initial_state['messages'])} messages...")
        print(f"🔍 Search results available: {len(initial_state['search_results'])}")
        
        start_time = time.time()
        final_state = self.graph.invoke(initial_state, config)
        elapsed = time.time() - start_time
        
        print(f"⏱️ Processing time: {elapsed:.2f}s")
        print(f"🤖 Response: {final_state.get('response_text', '')[:100]}...")
        
        return {
            "text": final_state.get("response_text", "No response generated"),
            "action": final_state.get("action", {}),
            "needs_confirmation": final_state.get("needs_confirmation", False),
            "search_results": final_state.get("search_results", []),
            "session_id": session_id
        }


# Entry point to test the graph
if __name__ == "__main__":
    import sys
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Create the agent
    agent = AVNGraphAgent(use_openai=False)
    
    # Use case tests
    print("\n" + "="*60)
    print("TEST USE CASE #1: Search and Summary")
    print("="*60)
    result = agent.process_request(
        "Search for the latest news on artificial intelligence"
    )
    print(f"\n🤖 Response: {result['text']}")
    print(f"🎬 Action: {result['action']}")
    
    if result.get('search_results'):
        print("\n" + "="*60)
        print("TEST USE CASE #2: Guided Navigation")
        print("="*60)
        result2 = agent.process_request(
            "Yes, read the article on Gemini",
            context={
                "search_results": result['search_results']
            }
        )
        print(f"\n🤖 Response: {result2['text']}")
        print(f"🎬 Action: {result2['action']}")
