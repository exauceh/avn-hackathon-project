"""
NavigationAgent - Specialized agent for web navigation
Use case #2: Guided navigation with confirmation
"""

from typing import Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
import re


class NavigationAgent:
    """Agent to manage navigation and validate actions"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a navigation request
        
        Args:
            state: Current graph state
        
        Returns:
            Updated state with navigation action
        """
        
        last_message = state["messages"][-1].content.lower()
        
        print(f"🧭 Navigation: {last_message}")
        
        # Detect navigation type
        if any(word in last_message for word in ["open", "read", "article", "link"]):
            return self._handle_link_navigation(state)
        
        elif any(word in last_message for word in ["back", "previous"]):
            return self._handle_back_navigation(state)
        
        elif any(word in last_message for word in ["scroll", "down", "bottom"]):
            return self._handle_scroll(state, direction="down")
        
        elif any(word in last_message for word in ["up", "top", "ascend"]):
            return self._handle_scroll(state, direction="up")
        
        else:
            # Generic navigation
            state["response_text"] = "I didn't understand the desired navigation action. Could you clarify?"
            state["action"] = {}
        
        return state
    
    def _handle_link_navigation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle navigation to a link (article, web page)
        """
        
        last_message = state["messages"][-1].content
        search_results = state.get("search_results", [])
        
        print(f"🔍 Analyse du message: '{last_message}'")
        print(f"📊 {len(search_results)} résultats de recherche disponibles")
        
        # Determine which article the user wants to open
        target_url = None
        target_title = None
        
        # Strategy 1: Explicit reference (first, second, etc.)
        # Amélioration: regex plus permissive
        number_match = re.search(r'\b(first|second|third|1st|2nd|3rd|one|two|three|\d)\b', last_message.lower())
        
        if number_match and search_results:
            num_str = number_match.group(1)
            print(f"✅ Numéro détecté: '{num_str}'")
            
            rank_map = {
                'first': 1, '1st': 1, 'one': 1,
                'second': 2, '2nd': 2, 'two': 2,
                'third': 3, '3rd': 3, 'three': 3
            }
            rank = rank_map.get(num_str, int(num_str) if num_str.isdigit() else 1)
            
            print(f"🎯 Rang calculé: {rank}")
            
            if 0 < rank <= len(search_results):
                result = search_results[rank - 1]
                target_url = result['url']
                target_title = result['title']
                print(f"✅ Article trouvé: {target_title[:50]}...")
            else:
                print(f"⚠️ Rang {rank} hors limites ({len(search_results)} résultats)")
        else:
            print(f"⚠️ Aucun numéro détecté dans '{last_message}', utilisation du LLM...")
        
        # Strategy 2: Keyword reference (e.g., "the article about Gemini")
        if not target_url and search_results:
            print("🤖 Utilisation du LLM pour identifier l'article...")
            
            # Use LLM to match the best result
            results_text = "\n".join([
                f"{r['rank']}. {r['title']}"
                for r in search_results
            ])
            
            system_prompt = """You are an assistant that identifies the desired article.
            The user is referring to an article from the list.
            Respond ONLY with the article number (1, 2, or 3).
            If you're not sure, respond with 1."""
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Articles:\n{results_text}\n\nUser: {last_message}")
            ]
            
            response = self.llm.invoke(messages)
            print(f"🤖 LLM a répondu: '{response.content}'")
            
            try:
                rank = int(response.content.strip())
                print(f"🎯 Rang LLM: {rank}")
                
                if 0 < rank <= len(search_results):
                    result = search_results[rank - 1]
                    target_url = result['url']
                    target_title = result['title']
                    print(f"✅ Article trouvé via LLM: {target_title[:50]}...")
                else:
                    print(f"⚠️ Rang LLM {rank} hors limites")
            except Exception as e:
                print(f"❌ Erreur parsing LLM: {e}")
                # Default to the first one
                if search_results:
                    result = search_results[0]
                    target_url = result['url']
                    target_title = result['title']
                    print(f"⚠️ Fallback sur le premier article: {target_title[:50]}...")
        
        # If we found a link, prepare the action
        if target_url:
            print(f"✅ Navigation vers: {target_url}")
            
            state["action"] = {
                "type": "navigate",
                "url": target_url,
                "method": "click"
            }
            
            state["response_text"] = (
                f"Confirmed. I'm taking you to {target_title}. "
                f"Would you like me to start reading the introduction?"
            )
            
            state["needs_confirmation"] = True
            state["selected_article"] = {
                "url": target_url,
                "title": target_title
            }
            
            # Simulate new page context (will be updated by frontend)
            state["current_url"] = target_url
            state["page_title"] = target_title
            
        else:
            print("❌ Aucun article identifié")
            state["response_text"] = "I couldn't identify which article you want to open. Could you clarify?"
            state["action"] = {}
        
        return state
    
    def _handle_back_navigation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle back navigation
        """
        state["action"] = {
            "type": "navigate",
            "method": "back"
        }
        
        state["response_text"] = "Going back to the previous page."
        
        return state
    
    def _handle_scroll(self, state: Dict[str, Any], direction: str = "down") -> Dict[str, Any]:
        """
        Handle page scrolling
        """
        state["action"] = {
            "type": "scroll",
            "direction": direction,
            "amount": 300  # pixels
        }
        
        direction_text = "down" if direction == "down" else "up"
        state["response_text"] = f"Scrolling the page {direction_text}."
        
        return state
    
    def validate_page_load(
        self,
        expected_title: str,
        actual_title: str,
        expected_url: str,
        actual_url: str
    ) -> bool:
        """
        Validate that a page loaded correctly (for use case #2)
        
        Args:
            expected_title: Expected title
            actual_title: Actual page title
            expected_url: Expected URL
            actual_url: Actual URL
        
        Returns:
            True if the page matches
        """
        # Simple check: URL or title partially match
        url_match = expected_url.lower() in actual_url.lower()
        
        # Extract keywords from expected title
        expected_keywords = set(expected_title.lower().split())
        actual_keywords = set(actual_title.lower().split())
        
        # At least 30% of words in common
        if expected_keywords:
            overlap = len(expected_keywords & actual_keywords) / len(expected_keywords)
            title_match = overlap >= 0.3
        else:
            title_match = True
        
        return url_match or title_match


# Standalone test
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
    
    # Simulate search results
    test_state = {
        "messages": [HumanMessage(content="Yes, read the first article")],
        "search_results": [
            {
                "rank": 1,
                "title": "Google launches Gemini 2.5 Pro",
                "url": "https://blog.google/technology/ai/google-gemini-ai/",
                "snippet": "Google presents Gemini 2.5 Pro..."
            },
            {
                "rank": 2,
                "title": "AI regulations in Europe",
                "url": "https://europa.eu/ai-act",
                "snippet": "The European Union..."
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
    print("TEST RESULT - NAVIGATION")
    print("="*60)
    print(f"\n🤖 Response:\n{result['response_text']}")
    print(f"\n🎬 Action:\n{result['action']}")
