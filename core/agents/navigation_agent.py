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
        if any(word in last_message for word in ["open", "read", "article", "link", "go to", "navigate to"]):
            return self._handle_link_navigation(state)
        
        elif any(word in last_message for word in ["back", "previous"]):
            return self._handle_back_navigation(state)
        
        elif any(word in last_message for word in ["scroll", "down", "bottom"]):
            return self._handle_scroll(state, direction="down")
        
        elif any(word in last_message for word in ["up", "top", "ascend"]):
            return self._handle_scroll(state, direction="up")
        
        else:
            # ✅ Generic navigation - Try to extract URL or site name
            return self._handle_generic_navigation(state)
        
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
            If you're not sure, respond with 'UNKNOWN'."""
            
            messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Articles:\n{results_text}\n\nUser: {last_message}")
            ]
            
            response = self.llm.invoke(messages)
            print(f"🤖 LLM a répondu: '{response.content}'")
            
            try:
                llm_response = response.content.strip()
                
                if llm_response.upper() == 'UNKNOWN':
                    print("⚠️ LLM ne peut pas identifier l'article, passage à la stratégie 3")
                    # Continue to Strategy 3 (generic navigation)
                else:
                    rank = int(llm_response)
                    print(f"🎯 Rang LLM: {rank}")
                    
                    if 0 < rank <= len(search_results):
                        result = search_results[rank - 1]
                        target_url = result['url']
                        target_title = result['title']
                        print(f"✅ Article trouvé via LLM: {target_title[:50]}...")
                    else:
                        print(f"⚠️ Rang LLM {rank} hors limites")
            except (ValueError, Exception) as e:
                print(f"❌ Erreur parsing LLM: {e}")
            # Continue to Strategy 3 instead of defaulting to first article
        
        # Strategy 3: No search results - Try to extract URL or site name
        if not target_url:
            print("🌐 Aucun résultat de recherche, tentative d'extraction d'URL...")
            return self._handle_generic_navigation(state)
        
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
    
    def _handle_generic_navigation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle generic navigation when no search results are available.
        Try to extract URL or website name from user message.
        
        Args:
            state: Current graph state
        
        Returns:
            Updated state with navigation action
        """
        
        last_message = state["messages"][-1].content
        
        print(f"🌐 Navigation générique: {last_message}")
        
        # Strategy 1: Extract explicit URL (http://, https://, www.)
        url_pattern = r'https?://[^\s]+|www\.[^\s]+'
        url_match = re.search(url_pattern, last_message, re.IGNORECASE)
        
        if url_match:
            target_url = url_match.group(0)
            # Add https:// if only www.
            if target_url.startswith('www.'):
                target_url = f"https://{target_url}"
            
            print(f"✅ URL détectée: {target_url}")
            
            state["action"] = {
                "type": "navigate",
                "url": target_url,
                "method": "click"
            }
            
            state["response_text"] = f"Opening {target_url}."
            state["needs_confirmation"] = False
            
            return state
        
        # Strategy 2: Extract website name and construct URL
        # Match patterns like "go to google", "open youtube", "navigate to github"
        # site_pattern = r'\b(?:go to|open|navigate to|visit)\s+([a-z0-9]+(?:\.[a-z]+)?)\b'
        # site_match = re.search(site_pattern, last_message.lower())
        
        # if site_match:
        #     site_name = site_match.group(1)
            
        #     # Add .com if no extension
        #     if '.' not in site_name:
        #         target_url = f"https://www.{site_name}.com"
        #     else:
        #         target_url = f"https://{site_name}"
            
        #     print(f"✅ Site détecté: {site_name} → {target_url}")
            
        #     state["action"] = {
        #         "type": "navigate",
        #         "url": target_url,
        #         "method": "click"
        #     }
            
        #     state["response_text"] = f"Opening {site_name}."
        #     state["needs_confirmation"] = False
            
        #     return state
        
        # Strategy 3: Use LLM to extract intent and construct URL
        system_prompt = """You are a navigation assistant.
        The user wants to navigate to a website but hasn't provided a full URL.
        Extract the website name from their message and respond with ONLY the URL in this format: https://www.example.com
        
        Examples:
        - "go to google" → https://www.google.com
        - "open youtube" → https://www.youtube.com
        - "navigate to github" → https://www.github.com
        - "visit bbc news" → https://www.bbc.com/news
        
        If you cannot determine the website, respond with: UNKNOWN"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=last_message)
        ]
        
        response = self.llm.invoke(messages)
        llm_response = response.content.strip()
        
        print(f"🤖 LLM a répondu: '{llm_response}'")
        
        if llm_response.startswith('http') and llm_response != 'UNKNOWN':
            target_url = llm_response
            
            print(f"✅ URL construite par LLM: {target_url}")
            
            state["action"] = {
                "type": "navigate",
                "url": target_url,
                "method": "click"
            }
            
            state["response_text"] = f"Opening {target_url}."
            state["needs_confirmation"] = False
            
            return state
        
        # Strategy 4: Fallback - couldn't determine navigation target
        print("❌ Impossible de déterminer la cible de navigation")
        
        state["response_text"] = (
            "I didn't understand where you want to navigate. "
            "Please provide a website name or URL. For example: 'go to google' or 'open youtube.com'"
        )
        state["action"] = {"type": "info"}
        state["needs_confirmation"] = False
        
        return state


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
        "messages": [HumanMessage(content="navigate to the french governement site")],
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
