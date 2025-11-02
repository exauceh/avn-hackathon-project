"""
SearchAgent - Agent specialized for search and summarization
Use case #1: Search for latest news and summarize them
"""

from typing import Dict, Any, List
import requests
from langchain_core.messages import SystemMessage, HumanMessage
from googleapiclient.discovery import build
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
CUSTOM_SEARCH_CX = os.getenv("CUSTOM_SEARCH_CX")
class SearchAgent:
    """Agent to perform searches and extract information"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a search query
        
        Args:
            state: Current graph state
        
        Returns:
            Updated state with results
        """
        
        # Extract search query
        last_message = state["messages"][-1].content
        
        print(f"🔍 Searching: {last_message}")
        
        # Perform Google search
        try:
            search_results = self._google_search(last_message)
            state["search_results"] = search_results
            
            # Generate summary of results
            summary = self._generate_summary(search_results, last_message)
            
            state["response_text"] = summary
            state["needs_confirmation"] = True
            
            # No DOM action for now, just informational
            state["action"] = {
                "type": "info",
                "data": search_results
            }
            
        except Exception as e:
            print(f"❌ Search error: {e}")
            state["response_text"] = f"Sorry, I couldn't perform the search. Error: {str(e)}"
            state["search_results"] = []
        
        return state
    
    def _google_search(self, query: str, num_results: int = 3) -> List[Dict[str, Any]]:
        """
        Perform a Google search using the Custom Search API (CSE).
        """


        if not GOOGLE_SEARCH_API_KEY or not CUSTOM_SEARCH_CX:
            print("❌ Error: API key or CX missing for Google Search API.")
            return self._get_demo_results(query) # Fallback

        try:
            # 1. Build API service
            service = build(
                "customsearch", 
                "v1", 
                developerKey=GOOGLE_SEARCH_API_KEY
            )

            # 2. Execute search
            res = service.cse().list(
                q=query,
                cx=CUSTOM_SEARCH_CX,
                lr='lang_en', # Limit search to French results
                num=num_results, # Number of results
                dateRestrict='7d'
            ).execute()

            results = []
            
            # 3. Process results
            for i, item in enumerate(res.get('items', [])):
                results.append({
                    "rank": i + 1,
                    "title": item.get('title', 'No title'),
                    "url": item.get('link', ''),
                    "snippet": item.get('snippet', 'No description available')
                })
                
                print(f"  ✅ Result {i+1} (API): {item.get('title', 'No title')[:50]}... - {item.get('link', '')}")

            return results

        except Exception as e:
            # API will return clear errors (403 if key invalid/quota exceeded)
            print(f"❌ Google Custom Search API Error: {e}")
            return self._get_demo_results(query) # Fallback
    
  
    def _get_demo_results(self, query: str) -> List[Dict[str, Any]]:
        """
        Return demo results if Google search fails
        Useful for testing without Internet access or if API is blocked
        """
        return [
            {
                "rank": 1,
                "title": "Google launches Gemini 2.5 Pro - A new era for AI",
                "url": "https://blog.google/technology/ai/google-gemini-ai/",
                "snippet": "Google presents Gemini 2.5 Pro, its most advanced AI model with revolutionary multimodal capabilities..."
            },
            {
                "rank": 2,
                "title": "AI regulations in Europe - What's changing in 2025",
                "url": "https://europa.eu/ai-act",
                "snippet": "The European Union is implementing new regulations to govern the development of artificial intelligence..."
            },
            {
                "rank": 3,
                "title": "OpenAI announces GPT-5 - Towards AGI?",
                "url": "https://openai.com/blog/gpt-5",
                "snippet": "OpenAI unveils GPT-5, marking a significant advancement towards artificial general intelligence..."
            }
        ]
    
    def _generate_summary(self, results: List[Dict[str, Any]], query: str) -> str:
        """
        Generate a voice summary of search results
        
        Args:
            results: List of search results
            query: Original query
        
        Returns:
            Text summary for TTS
        """
        if not results:
            return "I found no results for your search."
        
        # Create prompt for LLM
        results_text = "\n\n".join([
            f"Result {r['rank']}: {r['title']}\n"
            f"URL: {r['url']}\n"
            f"Description: {r['snippet']}"
            for r in results
        ])
        
        # Determine if query is a specific question or general search
        is_specific_question = any(word in query.lower() for word in ['what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'does', 'did', '?'])
        
        if is_specific_question:
            system_prompt = """You are AVN, a voice assistant for visually impaired people.
    The user asked a specific question. Use the search results to provide a direct, concise answer.
    - Answer the question directly based on the information found
    - Cite the most relevant source(s)
    - Keep your answer clear and to the point
    - If the results don't fully answer the question, say so briefly

    Be natural and conversational in your response."""
        else:
            system_prompt = """You are AVN, a voice assistant for visually impaired people.
    Summarize the search results in a clear and concise manner.
    Structure your response as follows:
    1. Number of results found
    2. Brief summary of each article (title + key point)
    3. Final question: "Would you like me to analyze one of these articles or continue reading?"

    Be concise and natural in your expression."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Query: {query}\n\nResults:\n{results_text}")
        ]
        
        response = self.llm.invoke(messages)
        return response.content


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
    
    agent = SearchAgent(llm)
    
    test_state = {
        "messages": [HumanMessage(content="latest AI news")],
        "search_results": [],
        "response_text": "",
        "needs_confirmation": False,
        "action": {}
    }
    
    result = agent.process(test_state)
    print("\n" + "="*60)
    print("TEST RESULT")
    print("="*60)
    print(f"\n🤖 Response:\n{result['response_text']}")
    print(f"\n📊 Results found: {len(result['search_results'])}")
    for r in result['search_results']:
        print(f"  {r['rank']}. {r['title']}")

