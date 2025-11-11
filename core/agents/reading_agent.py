"""
ReadingAgent - Specialized agent for reading articles with interruption support
Use case: Conversational reading with clarifications
"""

import re
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from image_analyzer import ImageAnalyzer


class ReadingAgent:
    """Agent to handle article reading with interruptions and clarifications"""
    
    def __init__(self, llm):
        self.llm = llm
        self.image_analyzer = ImageAnalyzer()  # ✅ Ajout de l'analyseur d'images
        self.reading_state = {
            "is_reading": False,
            "article_url": None,
            "article_title": None,
            "current_position": 0,
            "content_chunks": [],
            "images": [],  # ✅ Stocker les images avec descriptions
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
        
        # ✅ DETECT IMAGE DESCRIPTION REQUEST (high priority)
        if self._is_image_description_request(last_message):
            print(f"🖼️ Image description request detected")
            print("="*60)
            return self._handle_image_description_request(state)
        
        # ✅ DETECT INTERRUPTION (clarification questions)
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
    
    def _is_image_description_request(self, message: str) -> bool:
        """Détecter si l'utilisateur demande une description d'image"""
        
        image_keywords = [
            'image', 'picture', 'photo', 'diagram', 'chart', 'graph',
            'illustration', 'figure', 'visual', 'show me', 'trump'
        ]
        
        action_keywords = [
            'describe', 'explain', 'tell me about', 'what is', 'what does',
            'show me', 'details', 'more about', 'information about',
            'can you explain', 'what\'s in', 'analyze', 'break down',
            'look at', 'see', 'view', 'check', 'examine', 'inspect','say'
        ]
        
        message_lower = message.lower()
        
        has_image_keyword = any(keyword in message_lower for keyword in image_keywords)
        has_action_keyword = any(keyword in message_lower for keyword in action_keywords)
        
        return has_image_keyword and has_action_keyword
    
    def _handle_image_description_request(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gérer une demande de description d'image détaillée
        
        Exemples:
        - "Describe the image"
        - "Tell me more about the diagram"
        - "Can you describe the images about Donald Trump?"
        """
        
        last_message = state["messages"][-1].content
        
        # Vérifier si des images sont disponibles
        if not self.reading_state.get("images"):
            state["response_text"] = "There are no images in this article."
            state["action"] = {"type": "info"}
            return state
        
        images = self.reading_state["images"]
        
        print(f"🖼️ Using LLM to identify requested image from {len(images)} available images...")
        
        try:
            # Créer un contexte des images disponibles pour le LLM
            images_context = "\n".join([
                f"{i+1}. {img.get('alt', 'Image')} - URL: {img.get('url', '')[:50]}"
                for i, img in enumerate(images)
            ])
            
            system_prompt = """You are helping identify which image a user is asking about.
Based on the user's request and the available images, return ONLY the number (1-based index) of the most relevant image.
If the user mentions a specific topic (like "Trump", "diagram", etc), find the image that best matches.
Return only a single number, nothing else."""
            
            user_prompt = f"""User request: {last_message}

Available images:
{images_context}

Which image number is the user asking about? Return only the number."""
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]
            
            response = self.llm.invoke(messages)
            image_index = int(response.content.strip()) - 1  # Convert to 0-based index
            
            # Valider l'index
            if image_index < 0 or image_index >= len(images):
                print(f"⚠️ Invalid index {image_index}, defaulting to first image")
                image_index = 0
            
            image = images[image_index]
            print(f"✅ Selected image {image_index + 1}: {image.get('url', '')[:50]}...")
            
        except Exception as e:
            print(f"⚠️ Error identifying image: {e}, defaulting to first image")
            image = images[0]
        
        print(f"🖼️ Generating detailed description for image: {image.get('url', '')[:50]}...")
        
        try:
            # Générer une description détaillée
            context = " ".join(self.reading_state["content_chunks"][:2]) if self.reading_state["content_chunks"] else ""
            
            detailed_description = self.image_analyzer.analyze_image(
                image_url=image["url"],
                mode="detailed",
                context=context,
                alt_text=image.get("alt", "")
            )
            
            state["response_text"] = detailed_description
            
        except Exception as e:
            print(f"❌ Error generating detailed description: {e}")
            # Fallback sur le alt text
            state["response_text"] = image.get("alt", "Image description unavailable")
        
        state["action"] = {
            "type": "image_description",
            "image_url": image["url"],
            "is_reading_action": True  # Permettre la reprise automatique
        }
        
        state["needs_confirmation"] = False
        
        return state
    
    def _start_reading(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Start reading an article"""
        
        last_message = state["messages"][-1].content
        current_url = state.get("current_url", "")
        page_title = state.get("page_title", "")
        page_content = state.get("page_content", {})
        print(page_content)
        
        print(f"📖 Starting reading: {page_title}")
        print(last_message)
        
        # ✅ Extract ALL content from the page (text + images)
        raw_content = self._extract_all_page_content(page_content)
        images = page_content.get("images", [])
        
        if not raw_content:
            state["response_text"] = (
                "I couldn't find readable content on this page. "
                "Make sure you've navigated to a page with text content."
            )
            state["action"] = {"type": "info"}
            state["needs_confirmation"] = False
            return state
        
        # ✅ Nettoyer le contenu ET intégrer les images de manière intelligente
        print(f"🤖 Using LLM to clean content and integrate {len(images)} images...")
        cleaned_content = self._clean_content_with_llm(
            raw_content, 
            page_title, 
            last_message,
            images  # Passer les images au LLM
        )
        
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
            "images": images,  # ✅ Stocker les images pour référence ultérieure
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
            f"{chunks[:5]}"
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
    
    def _clean_content_with_llm(
        self, 
        raw_content: str, 
        page_title: str,
        user_message: str,
        images: List[Dict[str, Any]] = None
    ) -> str:
        """
        Use LLM to extract, structure, and integrate images intelligently.
        
        Args:
            raw_content: Raw extracted content from page
            page_title: Page title for context
            user_message: User's request
            images: List of images with metadata (url, alt, caption, etc.)
            
        Returns:
            Cleaned content with integrated image descriptions
        """
        
        # Limiter la taille du contenu envoyé au LLM
        max_input_length = 150000
        truncated_content = raw_content[:max_input_length]
        
        # Préparer les informations sur les images disponibles
        images_info = ""
        if images and len(images) > 0:
            images_info = "\n\n📸 AVAILABLE IMAGES ON THE PAGE:\n"
            for i, img in enumerate(images[:10], 1):  # Limiter à 10 images
                alt = img.get('alt', 'No alt text')
                caption = img.get('caption', '')
                url = img.get('url', '')[:80]
                
                images_info += f"\n[Image {i}]"
                if alt:
                    images_info += f"\n  Alt text: {alt}"
                if caption:
                    images_info += f"\n  Caption: {caption}"
                images_info += f"\n  URL: {url}\n"
        
        system_prompt = """You are AVN, a voice assistant for visually impaired people.
Your task is to extract, clean, and format article content with INTELLIGENT IMAGE INTEGRATION.

USER INTENTIONS:
- "read the first paragraph" / "read introduction" → Extract opening + relevant images
- "read the full article" → Complete article + ALL relevant images
- "read the summary" → Key points + important visuals
- "read about [topic]" → Sections on topic + related images
- "read the conclusion" → Final paragraphs only

IMAGE INTEGRATION RULES:
1. **Analyze each image's relevance** based on alt text, caption, and context
2. **Insert placeholders** for relevant images: [IMAGE:1], [IMAGE:2], etc.
3. **Skip decorative/irrelevant** images (logos, icons, ads, UI elements)
4. **Position wisely**: After introducing a concept the image illustrates
5. Use the image NUMBER from the "AVAILABLE IMAGES" list (e.g., [IMAGE:3])

FORMATTING FOR VOICE:
- Use simple punctuation (no asterisks, markdown)
- Natural flow for Text-to-Speech
- Paragraph breaks for pacing
- Insert [IMAGE:N] placeholders where relevant

CLEANING:
- Remove: navigation, ads, comments, UI elements, unrelated content
- Keep: article text, headings, image placeholders

OUTPUT: Clean text with [IMAGE:N] placeholders that will be replaced with actual descriptions."""
        
        user_prompt = f"""Page Title: {page_title}
User Request: {user_message}

ARTICLE CONTENT:
{truncated_content}

{images_info}

TASK: Extract the content matching the user's intention and integrate ONLY relevant image descriptions naturally in the text flow. Use format "Image: [brief description]" when inserting images."""
                
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
            
            # ✅ Post-processing: Replace [IMAGE:N] placeholders with actual descriptions
            cleaned = self._replace_image_placeholders(cleaned, images, truncated_content)
            
            return cleaned
            
        except Exception as e:
            print(f"❌ Error cleaning content with LLM: {e}")
            print(f"⚠️ Falling back to raw content")
            return raw_content
    
    def _replace_image_placeholders(
        self,
        cleaned_text: str,
        images: List[Dict[str, Any]],
        article_context: str
    ) -> str:
        """
        Replace [IMAGE:N] placeholders with actual image descriptions.
        
        Args:
            cleaned_text: Text with [IMAGE:N] placeholders
            images: List of available images
            article_context: Article content for context
            
        Returns:
            Text with placeholders replaced by descriptions
        """
        
        import re
        
        # Trouver tous les placeholders [IMAGE:N]
        pattern = r'\[IMAGE:(\d+)\]'
        matches = re.finditer(pattern, cleaned_text)
        
        replacements = {}
        
        for match in matches:
            placeholder = match.group(0)  # e.g., [IMAGE:1]
            image_num = int(match.group(1))  # e.g., 1
            
            # Convertir en index 0-based
            image_index = image_num - 1
            
            if 0 <= image_index < len(images):
                image = images[image_index]
                
                # Vérifier si l'image doit être décrite
                if self.image_analyzer.should_describe_image(image):
                    try:
                        print(f"🖼️ Analyzing image {image_num}: {image.get('url', '')[:50]}...")
                        
                        # Analyser l'image avec le contexte
                        description = self.image_analyzer.analyze_image(
                            image_url=image["url"],
                            mode="contextual",  # Mode contextuel pour une description pertinente
                            context=article_context[:1000],  # Limiter le contexte
                            alt_text=image.get("alt", "")
                        )
                        
                        # Format: "Image: [description]"
                        replacements[placeholder] = f"Image: {description}"
                        
                    except Exception as e:
                        print(f"⚠️ Error analyzing image {image_num}: {e}")
                        # Fallback sur alt text
                        alt_text = image.get("alt", "")
                        if alt_text:
                            replacements[placeholder] = f"Image: {alt_text}"
                        else:
                            replacements[placeholder] = ""
                else:
                    print(f"⏭️ Skipping image {image_num} (decorative or too small)")
                    replacements[placeholder] = ""
            else:
                print(f"⚠️ Image {image_num} not found (only {len(images)} images available)")
                replacements[placeholder] = ""
        
        # Remplacer tous les placeholders
        result = cleaned_text
        for placeholder, replacement in replacements.items():
            result = result.replace(placeholder, replacement)
        
        # Nettoyer les doubles espaces
        result = re.sub(r'\n\n\n+', '\n\n', result)
        
        print(f"✅ Replaced {len(replacements)} image placeholders")
        
        return result
    
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
