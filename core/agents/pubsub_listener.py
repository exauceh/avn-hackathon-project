"""
Service PubSub pour intégrer le graphe ADK avec l'API Gateway
"""

import os
import json
import time
import base64
from google.cloud import pubsub_v1
from google.cloud import texttospeech
from graph_agent import AVNGraphAgent

# Initialiser l'agent ADK
print("🤖 Initialisation de l'agent ADK...")
adk_agent = AVNGraphAgent(use_openai=False)  # Utilise Gemini par défaut

# Configuration Pub/Sub
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "avn-hackathon-project")
OUTPUT_TOPIC = "avn-agent-response"
SUBSCRIPTION = "avn-input-sub"

# Client TTS
tts_client = texttospeech.TextToSpeechClient()


def text_to_speech(text: str) -> str:
    """
    Convertit du texte en audio base64
    
    Args:
        text: Texte à convertir
    
    Returns:
        Audio encodé en base64
    """
    try:
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code="fr-FR",
            name="fr-FR-Neural2-A",  # Voix féminine naturelle
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
            pitch=0.0
        )
        
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Encoder en base64
        audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
        return audio_base64
        
    except Exception as e:
        print(f"❌ Erreur TTS: {e}")
        return ""


def process_message(message: pubsub_v1.subscriber.message.Message):
    """
    Traite un message reçu de Pub/Sub
    
    Args:
        message: Message Pub/Sub contenant la transcription
    """
    try:
        # Décoder le message
        data = json.loads(message.data.decode('utf-8'))
        request_id = data.get("request_id")
        transcription = data.get("text")
        context = data.get("context", {})
        
        print(f"\n{'='*60}")
        print(f"📩 Message reçu: {request_id}")
        print(f"📝 Transcription: {transcription}")
        print(f"🌐 Contexte: {context}")
        print("="*60)
        
        # Acquitter le message immédiatement
        message.ack()
        
        # Traiter avec l'agent ADK
        start_time = time.time()
        result = adk_agent.process_request(
            user_message=transcription,
            context=context,
            session_id=request_id
        )
        processing_time = time.time() - start_time
        
        print(f"\n⏱️ Temps de traitement: {processing_time:.2f}s")
        print(f"🤖 Réponse: {result['text'][:100]}...")
        
        # Générer l'audio
        print("🔊 Génération audio...")
        audio_base64 = text_to_speech(result['text'])
        
        # Publier la réponse
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, OUTPUT_TOPIC)
        
        response_data = {
            "request_id": request_id,
            "text": result['text'],
            "audio": audio_base64,
            "action": result.get('action', {}),
            "needs_confirmation": result.get('needs_confirmation', False),
            "search_results": result.get('search_results', []),
            "context": result.get('context', {})
        }
        
        publisher.publish(
            topic_path,
            json.dumps(response_data).encode('utf-8')
        )
        
        print(f"✅ Réponse publiée pour {request_id}")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Erreur traitement message: {e}")
        import traceback
        traceback.print_exc()
        message.ack()  # Acquitter quand même pour éviter les boucles


def listen_pubsub():
    """
    Écoute les messages Pub/Sub en continu
    """
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION)
    
    print(f"\n{'='*60}")
    print(f"📡 Écoute de Pub/Sub...")
    print(f"📍 Subscription: {subscription_path}")
    print("="*60 + "\n")
    
    streaming_pull_future = subscriber.subscribe(
        subscription_path,
        callback=process_message
    )
    
    print("✅ Écoute active. Appuyez sur Ctrl+C pour arrêter.\n")
    
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        streaming_pull_future.cancel()
        print("\n🛑 Arrêt de l'écoute Pub/Sub")


if __name__ == "__main__":
    # Charger les variables d'environnement
    from dotenv import load_dotenv
    load_dotenv()
    
    # Vérifier la configuration
    if not os.getenv("GOOGLE_API_KEY"):
        print("❌ GOOGLE_API_KEY non définie dans .env")
        exit(1)
    
    # if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    #     print("❌ GOOGLE_APPLICATION_CREDENTIALS non définie")
    #     exit(1)
    
    print("🚀 Démarrage du service Agent ADK")
    listen_pubsub()
