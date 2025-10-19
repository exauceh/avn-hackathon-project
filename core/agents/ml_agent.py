"""
Agent de planification - Équipe A
Reçoit input équipe C → Process avec Gemini → Envoie à équipe B
"""

import json
import os
import logging
from typing import Dict, Any
from dataclasses import dataclass

# Supprimer les messages d'avertissement Google Cloud
import warnings
warnings.filterwarnings('ignore')
logging.getLogger('google.auth').setLevel(logging.CRITICAL)
logging.getLogger('google.cloud').setLevel(logging.CRITICAL)
logging.getLogger('absl').setLevel(logging.CRITICAL)
logging.getLogger('grpc').setLevel(logging.CRITICAL)
logging.getLogger('urllib3').setLevel(logging.CRITICAL)
logging.getLogger().setLevel(logging.CRITICAL)
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GRPC_TRACE'] = ''
os.environ['GOOGLE_CLOUD_DISABLE_GRPC_TRACING'] = 'true'
try:
    from .credentials import initialize_gcp_credentials, get_project_id, get_region, is_gcp_authenticated
except ImportError:
    from credentials import initialize_gcp_credentials, get_project_id, get_region, is_gcp_authenticated

# Configuration silencieuse (pas de logging)


@dataclass
class AgentOutput:
    """Ce que l'équipe A envoie à l'équipe B"""
    intent: str
    action: str
    arguments: Dict[str, Any]
    confidence: float
    response: str  # Réponse claire à la question


class GeminiProcessor:
    """Processeur utilisant Gemini via VertexAI"""
    
    def __init__(self):
        self._available = False
        self.model = None
        self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialise Gemini avec les credentials"""
        try:
            if not is_gcp_authenticated():
                if not initialize_gcp_credentials():
                    raise Exception("Impossible de charger les credentials GCP")
            
            import vertexai
            from vertexai.generative_models import GenerativeModel
            
            # Initialiser avec le projet et la région configurés
            vertexai.init(project=get_project_id(), location=get_region())
            
            # Utiliser le modèle depuis la configuration
            model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash-001')
            self.model = GenerativeModel(model_name)
            self._available = True
            
            # Gemini initialisé
            
        except ImportError:
            # Package vertexai non installé
            pass
        except Exception as e:
            # Erreur lors de l'initialisation de Gemini
            self.is_initialized = False
    
    def process_text(self, text: str) -> Dict[str, Any]:
        """Traite le texte avec Gemini"""
        if not self._available:
            raise Exception("Gemini non disponible")
        
        prompt = f"""
Tu es un assistant qui répond aux questions des utilisateurs.

Question: "{text}"

Tu dois fournir:
1. L'INTENTION (question_factuelle, calcul, conseil_pratique, information_generale)
2. Une RÉPONSE claire et concise
3. Le niveau de CONFIANCE dans ta réponse

Réponds en JSON:
{{
    "intent": "type_question",
    "action": "provide_answer", 
    "arguments": {{"response": "ta_reponse_ici"}},
    "confidence": 0.85
}}

UNIQUEMENT le JSON, rien d'autre.
"""
        
        try:
            response = self.model.generate_content(prompt)
            return self._parse_response(response.text)
        except Exception as e:
            raise Exception(f"Erreur traitement Gemini: {e}")
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse la réponse JSON de Gemini"""
        try:
            clean_text = response_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:-3]
            elif clean_text.startswith("```"):
                clean_text = clean_text[3:-3]
            
            return json.loads(clean_text)
            
        except (json.JSONDecodeError, ValueError) as e:
            # Erreur parsing Gemini
            return {
                "intent": "parsing_error",
                "action": "ask_clarification",
                "arguments": {"error": str(e)},
                "confidence": 0.0
            }
    
    def is_available(self) -> bool:
        return self._available


class PlanningAgent:
    """
    Agent principal équipe A
    Input: Données équipe C (STT)
    Output: Instructions pour équipe B (Orchestration)
    """
    
    def __init__(self):
        self.processor = GeminiProcessor()
        self.stats = {"total": 0, "success": 0, "errors": 0}
        
        # Agent de planification initialisé
    
    def process_voice_input(self, voice_data: Dict[str, Any]) -> AgentOutput:
        """
        Traite l'input de l'équipe C et génère l'output pour l'équipe B
        
        Args:
            voice_data: Données reçues de l'équipe C via Pub/Sub
            
        Returns:
            AgentOutput: Instructions pour l'équipe B
        """
        self.stats["total"] += 1
        
        try:
            text = voice_data.get("text", "")
            if not text:
                raise ValueError("Texte vide reçu de l'équipe C")
            
            # Traitement en cours
            
            # Traite avec Gemini
            result = self.processor.process_text(text)
            
            # Crée l'output structuré avec la réponse
            response_text = result["arguments"].get("response", "Désolé, je n'ai pas pu traiter votre demande.")
            output = AgentOutput(
                intent=result["intent"],
                action=result["action"],
                arguments=result["arguments"],
                confidence=result["confidence"],
                response=response_text
            )
            
            self.stats["success"] += 1
            # Intent détecté silencieusement
            
            return output
            
        except Exception as e:
            self.stats["errors"] += 1
            # Erreur silencieuse
            
            # Fallback en cas d'erreur
            return AgentOutput(
                intent="error",
                action="request_retry",
                arguments={"error": str(e), "original_text": voice_data.get("text", "")},
                confidence=0.0,
                response="Désolé, une erreur s'est produite lors du traitement de votre demande."
            )
    
    def to_pubsub_message(self, output: AgentOutput) -> str:
        """Convertit l'output en message Pub/Sub pour équipe B"""
        return json.dumps({
            "intent": output.intent,
            "action": output.action,
            "arguments": output.arguments,
            "confidence": output.confidence,
            "source": "team_a_planning"
        }, indent=2)
    
    def get_stats(self) -> Dict[str, Any]:
        """Statistiques de l'agent"""
        total = max(self.stats["total"], 1)
        return {
            "total_processed": self.stats["total"],
            "success_rate": self.stats["success"] / total,
            "error_rate": self.stats["errors"] / total
        }


# Test de l'agent
if __name__ == "__main__":
    print("=== Test Agent Équipe A ===")
    
    # Import du mock équipe C
    try:
        from .voice_input_mock import TeamCMockInput
    except ImportError:
        from voice_input_mock import TeamCMockInput
        
    # Crée les services
    team_c = TeamCMockInput()
    agent = PlanningAgent()
    
    print("\nTest flux: Équipe C -> Équipe A -> Équipe B")
    
    # Test avec une commande
    voice_input = team_c.get_random_transcription()
    print(f"Input équipe C: '{voice_input.text}'")
    
    # Traitement équipe A
    output = agent.process_voice_input({
        "text": voice_input.text
    })
    
    # Output vers équipe B
    print(f"Output vers équipe B:")
    print(f"   Intent: {output.intent}")
    print(f"   Action: {output.action}")
    print(f"   Args: {output.arguments}")
    print(f"   Confiance: {output.confidence:.1%}")
    
    # Message Pub/Sub
    print(f"\nMessage Pub/Sub:")
    print(agent.to_pubsub_message(output))