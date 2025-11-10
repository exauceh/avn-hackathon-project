"""
ReadingAgent - Specialized agent for reading articles with interruption support
Use case: Conversational reading with clarifications
"""

import re
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage


class ReadingAgent:
    """Agent to handle article reading with interruptions and clarifications"""
    
    def __init__(self, llm):
        self.llm = llm
        self.reading_state = {
            "is_reading": False,
            "article_url": None,
            "article_title": None,
            "current_position": 0,
            "content_chunks": [],
            "paused": False
        }
    
    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process reading requests
        
        Handles:
        - Start reading an article
        - Pause reading
        - Answer clarification questions during reading
        - Resume reading
        """
        
        last_message = state["messages"][-1].content.lower()
        
        print(f"\n{'='*60}")
        print(f"📖 Reading agent processing: {last_message[:50]}...")
        print(f"📖 Current state: is_reading={self.reading_state['is_reading']}, paused={self.reading_state['paused']}")
        if self.reading_state['is_reading']:
            print(f"📖 Position: {self.reading_state['current_position']}/{len(self.reading_state['content_chunks'])} chunks")
        
        # ✅ DETECT INTERRUPTION FIRST
        # Check if it's a clarification BEFORE checking other intents
        if self._is_clarification_request(last_message, state):
            print(f"🛑 Interruption detected → Processing clarification")
            print("="*60)
            return self._handle_clarification(state)
        
        # Detect intent
        if self._is_start_reading_request(last_message):
            print(f"▶️ Intent: Start reading")
            print("="*60)
            return self._start_reading(state)

        else:
            # Default: treat as start reading
            print(f"▶️ Default intent: Start reading")
            print("="*60)
            return self._start_reading(state)
        
        print("="*60)
    
    def _is_start_reading_request(self, message: str) -> bool:
        """Check if user wants to start reading"""
        keywords = ['read', 'reading', 'start reading']
        return any(keyword in message for keyword in keywords)
    
    def _is_resume_request(self, message: str) -> bool:
        """Check if user wants to resume reading"""
        keywords = ['continue', 'resume', 'go ahead', 'ok continue', 'go on']
        return any(keyword in message for keyword in keywords)
    
    def _is_clarification_request(self, message: str, state: Dict[str, Any]) -> bool:
        """Check if user interrupted with a clarification question"""
        
        # 1. Vérifier si on est en mode lecture
        if not self.reading_state["is_reading"]:
            print(f"📖 Not in reading mode, not a clarification")
            return False
        
        # 2. Détecter les mots-clés de question (logique simple)
        question_keywords = ['what', 'who', 'why', 'how', 'when', 'where', 
                            'what is', 'explain', 'tell me', 'define', 'describe']
        
        is_question = any(keyword in message for keyword in question_keywords)
        
        if is_question:
            print(f"❓ Clarification détectée: {message[:50]}...")
        
        return is_question
    
    def _start_reading(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Start reading an article"""
        
        last_message = state["messages"][-1].content
        current_url = state.get("current_url", "")
        page_title = state.get("page_title", "")
        page_content = state.get("page_content", {})
        print(page_content)
        
        print(f"📖 Starting reading: {page_title}")
        print(last_message)
        
        # ✅ Extract ALL content from the page
        raw_content = self._extract_all_page_content(page_content)
        
        if not raw_content:
            state["response_text"] = (
                "I couldn't find readable content on this page. "
                "Make sure you've navigated to a page with text content."
            )
            state["action"] = {"type": "info"}
            state["needs_confirmation"] = False
            return state
        
        # ✅ UTILISER LE LLM POUR NETTOYER ET STRUCTURER LE CONTENU
        print(f"🤖 Using LLM to clean and structure content...")
        cleaned_content = self._clean_content_with_llm(raw_content, page_title,last_message)
        
        if not cleaned_content or len(cleaned_content) < 50:
            print(f"⚠️ Cleaned content too short, using raw content")
            cleaned_content = raw_content
        
        # Split content into readable chunks
        chunks = self._split_into_chunks(cleaned_content, chunk_size=500)
        
        # Store reading state
        self.reading_state = {
            "is_reading": True,
            "article_url": current_url,
            "article_title": page_title,
            "current_position": 0,
            "content_chunks": chunks,
            "paused": False
        }
        
        print(f"📖 Reading state initialized:")
        print(f"   - Article: {page_title}")
        print(f"   - URL: {current_url}")
        print(f"   - Chunks: {len(chunks)}")
        print(f"   - Position: 0/{len(chunks)}")
        
        # Read first chunk
        first_chunk = chunks[0] if chunks else ""
        
        state["response_text"] = (
            f"{chunks[0]}"
        )
        
        state["action"] = {
            "type": "reading",
            "article_url": current_url,
            "article_title": page_title,
            "chunk_index": 0,
            "total_chunks": len(chunks),
            "is_reading_action": True  # Flag pour la reprise automatique
        }
        
        state["needs_confirmation"] = False
        
        return state
    
    def _clean_content_with_llm(self, raw_content: str, page_title: str,user_message:str) -> str:
        """
        Use LLM to extract and structure only the main article content.
        Remove navigation, ads, menus, etc.
        
        Args:
            raw_content: Raw extracted content from page
            page_title: Page title for context
            
        Returns:
            Cleaned and structured content ready for reading
        """
        
        # Limiter la taille du contenu envoyé au LLM
        max_input_length = 60000  # ~3500 tokens
        truncated_content = raw_content[:max_input_length]
        
        system_prompt = """You are a content extraction and formatting specialist.
        Your task is to extract and format article content based on user's reading intention.

        USER INTENTIONS TO DETECT:
        - "read the first paragraph" / "read introduction" → Extract only opening paragraphs
        - "read the full article" / "read everything" → Extract complete article
        - "read the summary" / "give me overview" → Extract key points and summaries
        - "read about [topic]" → Extract sections mentioning that specific topic
        - "read the conclusion" → Extract final paragraphs/conclusion

        REMOVE:
        - Navigation menus, headers, footers
        - Sidebars, ads, promotions
        - Comments sections
        - Related articles, recommendations
        - UI elements (buttons, forms, login prompts)
        - Social media sharing buttons
        - Cookie notices, popups

        KEEP:
        - Article title and relevant headings
        - Content matching user's intention
        - Important lists and quotes if relevant
        - Natural paragraph breaks
        
        OUTPUT FORMAT:
        - Start with the article title (if full article requested)
        - Include section headings only if needed for context
        - Keep paragraphs intact
        - Maintain natural flow for voice reading
        - Use simple punctuation for better TTS
        - For partial reads, indicate what section is being read

        Return ONLY the cleaned content matching the user's intention, ready to be read aloud."""
        
        user_prompt = f"""Page Title: {page_title}

        Content to clean:
        {truncated_content}

        User message: {user_message}

        Extract and return ONLY the cleaned content matching the user's intention in a format suitable for voice reading."""
                
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]
            
            response = self.llm.invoke(messages)
            cleaned = response.content.strip()
            
            print(f"✨ Content cleaned by LLM:")
            print(f"   - Input: {len(raw_content)} chars")
            print(f"   - Output: {len(cleaned)} chars")
            print(f"   - Preview: {cleaned[:150]}...")
            
            return cleaned
            
        except Exception as e:
            print(f"❌ Error cleaning content with LLM: {e}")
            print(f"⚠️ Falling back to raw content")
            return raw_content
    
    def _extract_all_page_content(self, page_content: Dict[str, Any]) -> str:
        """
        Extract ALL readable text from the page (with better filtering).
        """
        
        if not page_content or not isinstance(page_content, dict):
            return ""
        
        main_sections = page_content.get("main_sections", [])
        
        if not main_sections:
            return ""
        
        # ✅ Extract content with better structure
        content_parts = []
        
        for section in main_sections:
            tag = section.get("tag", "").upper()
            text = section.get("text", "").strip()
            
            if not text or len(text) < 20:  # Skip very short text
                continue
            
            # ✅ Prioritize headings for structure
            if tag in ["H1", "H2", "H3"]:
                content_parts.append(f"\n\n{text}\n")
            
            # Add paragraphs
            elif tag == "P":
                content_parts.append(text + " ")
            
            # Add list items
            elif tag == "LI":
                content_parts.append(text + ". ")
            
            # Add blockquotes
            elif tag == "BLOCKQUOTE":
                content_parts.append(f"\n{text}\n")
        
        # Combine all parts
        full_content = "".join(content_parts)
        
        print(f"📄 Extracted {len(full_content)} characters from page")
        print(f"📄 Content preview: {full_content[:200]}...")
        
        return full_content
    
    def _split_into_chunks(self, text: str, chunk_size: int = 500) -> List[str]:
        """
        Split text into readable chunks.
        ✅ Improved: Better sentence splitting and natural breaks
        """
        
        if not text:
            return []
        
        # ✅ Split by sentences (improved regex)
        # Handle multiple punctuation patterns
        sentence_endings = r'(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\n)|(?<=\.)\s+(?=[A-Z])'
        sentences = re.split(sentence_endings, text)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # ✅ If adding this sentence would exceed chunk size
            if len(current_chunk) + len(sentence) + 1 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # ✅ If single sentence is too long, split it
                if len(sentence) > chunk_size:
                    # Split by commas or semicolons
                    sub_parts = re.split(r'[,;]\s+', sentence)
                    temp_chunk = ""
                    for part in sub_parts:
                        if len(temp_chunk) + len(part) <= chunk_size:
                            temp_chunk += part + ", "
                        else:
                            if temp_chunk:
                                chunks.append(temp_chunk.strip())
                            temp_chunk = part + ", "
                    if temp_chunk:
                        current_chunk = temp_chunk
                else:
                    current_chunk = sentence + " "
            else:
                current_chunk += sentence + " "
        
        # Add last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        print(f"📝 Split into {len(chunks)} chunks (avg {sum(len(c) for c in chunks) // len(chunks) if chunks else 0} chars/chunk)")
        
        return chunks
    
    def _handle_clarification(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle clarification questions during reading.
        Pause reading, answer the question, then allow resumption.
        """
        
        last_message = state["messages"][-1].content
        
        print(f"❓ Handling clarification: {last_message[:100]}...")
        
        # Pause reading (but DON'T reset position)
        self.reading_state["paused"] = True
        
        # Use LLM to answer the clarification based on article context
        context = ""
        if self.reading_state["content_chunks"]:
            # Get context from read chunks + current chunk
            read_chunks = self.reading_state["content_chunks"][:self.reading_state["current_position"] + 1]
            context = " ".join(read_chunks)
    
        system_prompt = f"""You are reading an article titled "{self.reading_state.get('article_title', 'the article')}".

        The user has interrupted to ask a clarification question.
        Answer BRIEFLY and CLEARLY based on the article context.
        Keep your answer SHORT (max 3 sentences) so we can quickly resume reading.

        Article context so far:
        {context[:2000]}
        """
    
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=last_message)
            ]
            
            response = self.llm.invoke(messages)
            answer = response.content.strip()

            state["response_text"] = answer
            
        except Exception as e:
            print(f"❌ Error generating clarification: {e}")
            state["response_text"] = "I'm not sure about that."

        state["action"] = {
            "type": "clarification",
            "article_url": self.reading_state["article_url"],
            "article_title": self.reading_state["article_title"],
            "chunk_index": self.reading_state["current_position"],
            "total_chunks": len(self.reading_state["content_chunks"]),
            "is_reading_action": True  # Flag pour permettre la reprise
        }
        
        state["needs_confirmation"] = False
        
        print(f"⏸️ Reading paused for clarification at chunk {self.reading_state['current_position']}")
        
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
    
    agent = ReadingAgent(llm)
    
    # Test 1: Start reading
    print("\n" + "="*60)
    print("TEST 1: Start reading")
    print("="*60)
    
    state = {
        "messages": [HumanMessage(content="Read the full article")],
        "current_url": "https://example.com/article",
        "page_title": "Understanding Neuroscience",
        "page_content": {
            "main_sections": [
                {"tag": "P", "text": "The brain is a complex organ. It contains billions of neurons. These neurons communicate through neurotransmitters."},
                {"tag": "P", "text": "Neurotransmitters are chemical messengers. They transmit signals across synapses. This process is essential for all brain functions."},
                {"tag": "P", "text": "Common neurotransmitters include dopamine, serotonin, and acetylcholine. Each has specific roles in the nervous system."}
            ]
        },
        "search_results": [],
        "action": {},
        "response_text": "",
        "needs_confirmation": False
    }
    
    result = agent.process(state)
    print(f"\n📖 Response: {result['response_text'][:200]}...")
    print(f"🎬 Action: {result['action']}")
    
    # Test 2: Clarification
    print("\n" + "="*60)
    print("TEST 2: Clarification question")
    print("="*60)
    
    state["messages"].append(HumanMessage(content="What is a neurotransmitter?"))
    result = agent.process(state)
    print(f"\n❓ Response: {result['response_text']}")
    print(f"🎬 Action: {result['action']}")
    
    # Test 3: Resume
    print("\n" + "="*60)
    print("TEST 3: Resume reading")
    print("="*60)
    
    state["messages"].append(HumanMessage(content="Ok continue"))
    result = agent.process(state)
    print(f"\n📖 Response: {result['response_text'][:200]}...")
    print(f"🎬 Action: {result['action']}")
