"""
Service Agent pour Cloud Run - Mode Push Subscription
"""

import os
import json
import base64
from flask import Flask, request, jsonify
from google.cloud import pubsub_v1
from google.cloud import texttospeech
from graph_agent import AVNGraphAgent

app = Flask(__name__)

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "avn-hackathon-project")
OUTPUT_TOPIC = "avn-agent-response"

# Initialiser l'agent ADK
print("🤖 Initialisation de l'agent ADK...")
adk_agent = AVNGraphAgent(use_openai=False)

# Clients Google Cloud
tts_client = texttospeech.TextToSpeechClient()
publisher = pubsub_v1.PublisherClient()

# Limite de sécurité
MAX_CHARS_PER_REQUEST = 4500

def split_text_into_chunks(text: str) -> list[str]:
    """Divise le texte en morceaux de taille gérable"""
    chunks = []
    current_text = text
    
    while len(current_text.encode('utf-8')) > 0:
        if len(current_text.encode('utf-8')) <= 5000:
            chunks.append(current_text)
            break

        safe_segment = current_text[:MAX_CHARS_PER_REQUEST]
        last_break = safe_segment.rfind('\n\n')
        if last_break == -1:
            last_break = safe_segment.rfind('. ')
        
        if last_break != -1 and last_break > MAX_CHARS_PER_REQUEST // 2:
            chunk = current_text[:last_break + 1].strip()
            current_text = current_text[last_break + 1:].strip()
        else:
            chunk = safe_segment.strip()
            current_text = current_text[MAX_CHARS_PER_REQUEST:].strip()
        
        if chunk:
            chunks.append(chunk)

    return chunks

def segmented_text_to_speech(text: str) -> str:
    """Convertit du texte long en audio base64"""
    if not text:
        return ""

    text_chunks = split_text_into_chunks(text)
    full_audio_content = b""

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Studio-O",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=1.0,
        pitch=0.0
    )

    for i, chunk in enumerate(text_chunks):
        try:
            print(f"🔊 Synthèse segment {i+1}/{len(text_chunks)}")
            synthesis_input = texttospeech.SynthesisInput(text=chunk)
            
            response = tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            full_audio_content += response.audio_content

        except Exception as e:
            print(f"❌ Erreur TTS segment {i+1}: {e}")
            if i == 0:
                return ""
            break
            
    if full_audio_content:
        return base64.b64encode(full_audio_content).decode('utf-8')
    
    return ""

@app.route('/')
def index():
    return {"status": "Agents Service OK", "project_id": PROJECT_ID}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/process', methods=['POST'])
def process_message():
    """
    Endpoint appelé par Pub/Sub (push subscription)
    Traite la transcription et publie la réponse
    """
    try:
        # Décoder le message Pub/Sub
        envelope = request.get_json()
        if not envelope:
            return jsonify({"error": "No Pub/Sub message"}), 400
        
        pubsub_message = envelope.get('message', {})
        data = json.loads(base64.b64decode(pubsub_message['data']).decode('utf-8'))
        
        request_id = data.get("request_id")
        transcription = data.get("text")
        context = data.get("context", {})
        
        print(f"\n{'='*60}")
        print(f"📩 Traitement requête: {request_id}")
        print(f"📝 Transcription: {transcription}")
        print(f"🌐 URL: {context.get('url', 'N/A')}")
        
        graph_state = context.get("graph_state", None)
        if graph_state:
            print(f"📚 État graphe: {len(graph_state.get('messages', []))} messages")
            
            # Vérifier interruption
            messages = graph_state.get('messages', [])
            has_interruption = any(
                isinstance(msg, dict) and msg.get('content') == 'USER_INTERRUPTED_READING'
                for msg in messages
            )
            
            if has_interruption:
                print(f"🛑 INTERRUPTION DÉTECTÉE")
        
        # Traiter avec l'agent
        result = adk_agent.process_request(
            user_message=transcription,
            context=context,
            session_id=graph_state.get("session_id", request_id) if graph_state else request_id,
            graph_state=graph_state
        )
        
        print(f"🤖 Réponse générée: {result['text'][:100]}...")
        
        # Générer l'audio
        print("🔊 Génération audio...")
        audio_base64 = segmented_text_to_speech(result['text'])
        
        # Publier la réponse
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
        
        future = publisher.publish(
            topic_path,
            json.dumps(response_data).encode('utf-8'),
            request_id=request_id
        )
        
        message_id = future.result(timeout=5.0)
        print(f"✅ Réponse publiée: message_id={message_id}")
        print("="*60 + "\n")
        
        # Pub/Sub attend un 200/204
        return '', 204
        
    except Exception as e:
        print(f"❌ Erreur traitement: {e}")
        import traceback
        traceback.print_exc()
        # Retourner 200 pour éviter les retry infinis
        return '', 200

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 DÉMARRAGE SERVICE AGENTS (GCP Mode)")
    print(f"📍 Project ID: {PROJECT_ID}")
    print("="*60 + "\n")
    
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
