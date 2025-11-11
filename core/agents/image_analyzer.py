"""
ImageAnalyzer - Module pour analyser les images avec Gemini Vision
Gère les descriptions automatiques et détaillées des images
"""

import os
import base64
import requests
from typing import Dict, Any, List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


class ImageAnalyzer:
    """Analyse les images en utilisant Gemini Vision"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the image analyzer
        
        Args:
            api_key: Google API key. If None, loads from environment
        """
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        
        # Utiliser Gemini 2.0 Flash avec vision
        self.vision_model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            api_key=self.api_key,
            temperature=0.3  # Plus bas pour des descriptions factuelles
        )
        
        # Cache pour éviter d'analyser les mêmes images plusieurs fois
        self.description_cache = {}
    
    def analyze_image(
        self,
        image_url: str,
        mode: str = "brief",
        context: Optional[str] = None,
        alt_text: Optional[str] = None
    ) -> str:
        """
        Analyser une image et générer une description
        
        Args:
            image_url: URL de l'image à analyser
            mode: "brief" (courte), "detailed" (détaillée), ou "contextual" (dans le contexte)
            context: Contexte textuel autour de l'image
            alt_text: Texte alternatif existant
        
        Returns:
            Description de l'image en texte
        """
        
        # Vérifier le cache
        cache_key = f"{image_url}_{mode}"
        if cache_key in self.description_cache:
            print(f"💾 Using cached description for {image_url[:50]}...")
            return self.description_cache[cache_key]
        
        try:
            # Vérifier si on a déjà un bon alt text
            if mode == "brief" and alt_text and len(alt_text) > 10:
                print(f"✅ Using existing alt text: {alt_text}")
                return alt_text
            
            print(f"🖼️ Analyzing image: {image_url[:50]}... (mode: {mode})")
            
            # Préparer le prompt selon le mode
            prompt = self._get_prompt_for_mode(mode, context, alt_text)
            
            # Créer le message avec l'image
            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": image_url
                    }
                ]
            )
            
            # Appeler Gemini Vision
            response = self.vision_model.invoke([message])
            description = response.content.strip()
            
            # Nettoyer la description
            description = self._clean_description(description, mode)
            
            # Mettre en cache
            self.description_cache[cache_key] = description
            
            print(f"✨ Description generated: {description[:100]}...")
            
            return description
            
        except Exception as e:
            print(f"❌ Error analyzing image: {e}")
            
            # Fallback sur alt text si disponible
            if alt_text:
                return alt_text
            
            return "Image description unavailable"
    
    def analyze_multiple_images(
        self,
        images: List[Dict[str, Any]],
        mode: str = "brief",
        context: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyser plusieurs images
        
        Args:
            images: Liste de dictionnaires avec 'url', 'alt', 'caption', etc.
            mode: Mode de description
            context: Contexte global
        
        Returns:
            Liste des images avec leurs descriptions ajoutées
        """
        
        enriched_images = []
        
        for i, image in enumerate(images):
            print(f"\n📸 Analyzing image {i+1}/{len(images)}")
            
            image_url = image.get("url", "")
            alt_text = image.get("alt", "")
            caption = image.get("caption", "")
            
            # Construire le contexte local
            local_context = f"{context}\n\n" if context else ""
            if caption:
                local_context += f"Image caption: {caption}\n"
            
            # Analyser l'image
            description = self.analyze_image(
                image_url=image_url,
                mode=mode,
                context=local_context if local_context else None,
                alt_text=alt_text
            )
            
            # Ajouter la description
            enriched_image = {**image}
            enriched_image["description"] = description
            enriched_image["description_mode"] = mode
            
            enriched_images.append(enriched_image)
        
        return enriched_images
    
    def _get_prompt_for_mode(
        self,
        mode: str,
        context: Optional[str] = None,
        alt_text: Optional[str] = None
    ) -> str:
        """Générer le prompt approprié selon le mode"""
        
        if mode == "brief":
            return """        
        You are AVN, a voice assistant for visually impaired people.
            Describe this image in ONE SENTENCE suitable for screen readers.
        
        Be concise and factual. Focus on what is visually important.
        Format: Start with "Image:" followed by the description.
        Use simple ponctuations for better TTS (no asterix)
        Example: "Image: A diagram showing the structure of a neuron with labeled parts."
        """
        
        elif mode == "detailed":
            prompt = """  You are AVN, a voice assistant for visually impaired people.
            Describe this image in detail for a visually impaired person.
Include:
- What type of image it is (photo, diagram, chart, etc.)
- Main subjects and their arrangement
- Important details, colors, or text visible
- Any data or information conveyed
- Use simple ponctuations for better TTS (no asterix)

Be clear and organized. Maximum 5 sentences."""
            
            if context:
                prompt += f"\n\nContext from the article:\n{context[:500]}"
            
            if alt_text:
                prompt += f"\n\nExisting alt text: {alt_text}"
            
            return prompt
        
        elif mode == "contextual":
            if not context:
                return self._get_prompt_for_mode("brief", None, alt_text)
            
            return f"""This image appears in an article with the following context:

{context[:800]}

Describe the image and explain how it relates to the text.
Be concise (2-3 sentences). Format as: "Image: [description]. [relevance to text]"
"""
        
        else:
            return self._get_prompt_for_mode("brief", context, alt_text)
    
    def _clean_description(self, description: str, mode: str) -> str:
        """Nettoyer et formater la description"""
        
        # Supprimer les préfixes redondants
        prefixes = ["Image:", "Image description:", "This image shows", "The image depicts"]
        for prefix in prefixes:
            if description.startswith(prefix):
                description = description[len(prefix):].strip()
                break
        
        # Pour le mode brief, s'assurer qu'on a un préfixe "Image:"
        if mode == "brief" and not description.startswith("Image:"):
            description = f"Image: {description}"
        
        # Limiter la longueur selon le mode
        max_lengths = {
            "brief": 150,
            "detailed": 500,
            "contextual": 300
        }
        
        max_length = max_lengths.get(mode, 150)
        if len(description) > max_length:
            # Couper à la dernière phrase complète
            sentences = description[:max_length].split('. ')
            if len(sentences) > 1:
                description = '. '.join(sentences[:-1]) + '.'
            else:
                description = description[:max_length].strip() + '...'
        
        return description
    
    def should_describe_image(
        self,
        image: Dict[str, Any],
        reading_mode: str = "normal"
    ) -> bool:
        """
        Déterminer si une image doit être décrite
        
        Args:
            image: Dictionnaire avec infos de l'image
            reading_mode: "normal", "images_only", "no_images"
        
        Returns:
            True si l'image doit être décrite
        """
        
        if reading_mode == "no_images":
            return False
        
        if reading_mode == "images_only":
            return True
        
        # Mode normal : filtrer les images insignifiantes
        
        # Toujours décrire si il y a une caption
        if image.get("caption"):
            return True
        
        # Toujours décrire si l'image est grande
        width = image.get("width", 0)
        height = image.get("height", 0)
        if width > 400 and height > 300:
            return True
        
        # Toujours décrire si il y a un alt text informatif
        alt = image.get("alt", "")
        if len(alt) > 20:
            return True
        
        # Par défaut, décrire les images dans l'article
        return True


# Fonction helper pour intégrer dans le flux de lecture
def integrate_images_in_text(
    text_sections: List[Dict[str, Any]],
    images: List[Dict[str, Any]],
    analyzer: ImageAnalyzer,
    mode: str = "brief"
) -> str:
    """
    Intégrer les descriptions d'images dans le flux de texte
    
    Args:
        text_sections: Sections de texte extraites
        images: Images avec leurs métadonnées
        analyzer: Instance de ImageAnalyzer
        mode: Mode de description
    
    Returns:
        Texte avec images intégrées
    """
    
    if not images:
        # Pas d'images, retourner le texte simple
        return "\n".join(s.get("text", "") for s in text_sections)
    
    # Analyser toutes les images
    context = "\n".join(s.get("text", "")[:500] for s in text_sections[:3])
    enriched_images = analyzer.analyze_multiple_images(images, mode, context)
    
    # Construire le texte final avec images intégrées
    result_parts = []
    image_index = 0
    
    for section in text_sections:
        text = section.get("text", "")
        result_parts.append(text)
        
        # Insérer les images approximativement à leur position
        # (logique simple : après chaque ~3 sections)
        if image_index < len(enriched_images) and len(result_parts) % 3 == 0:
            image = enriched_images[image_index]
            if analyzer.should_describe_image(image):
                result_parts.append(f"\n{image['description']}\n")
            image_index += 1
    
    # Ajouter les images restantes à la fin
    while image_index < len(enriched_images):
        image = enriched_images[image_index]
        if analyzer.should_describe_image(image):
            result_parts.append(f"\n{image['description']}\n")
        image_index += 1
    
    return "\n".join(result_parts)


# Test standalone
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    analyzer = ImageAnalyzer()
    
    # Test avec une image publique
    test_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/1200px-Google_2015_logo.svg.png"
    
    print("\n" + "="*60)
    print("TEST 1: Brief description")
    print("="*60)
    
    desc_brief = analyzer.analyze_image(test_image_url, mode="brief")
    print(f"\n📝 Brief: {desc_brief}")
    
    print("\n" + "="*60)
    print("TEST 2: Detailed description")
    print("="*60)
    
    desc_detailed = analyzer.analyze_image(test_image_url, mode="detailed")
    print(f"\n📝 Detailed: {desc_detailed}")
    
    print("\n" + "="*60)
    print("TEST 3: With context")
    print("="*60)
    
    context = "This article discusses Google's recent developments in AI technology."
    desc_contextual = analyzer.analyze_image(
        test_image_url,
        mode="contextual",
        context=context
    )
    print(f"\n📝 Contextual: {desc_contextual}")
