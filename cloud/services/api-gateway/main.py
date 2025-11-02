import base64
import os
import uuid
import json
import time
import logging
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1
import storage

#    Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "avn-hackathon-project")
USER_TRANSCRIPTION_TOPIC = "frontend_input"

logger.info(f"🔧 Configuration: PROJECT_ID={PROJECT_ID}, TOPIC={USER_TRANSCRIPTION_TOPIC}")

# Client Pub/Sub
try:
    publisher = pubsub_v1.PublisherClient()
    logger.info("   Client Pub/Sub initialisé")
except Exception as e:
    logger.error(f"❌ Erreur init Pub/Sub: {e}")
    raise

@app.route('/')
def index():
    return {
        "status": "API Gateway OK",
        "pending": len(storage.pending_responses),
        "project_id": PROJECT_ID,
        "topic": USER_TRANSCRIPTION_TOPIC
    }

@app.route('/process', methods=['POST'])
def process_text():
    """Reçoit le texte transcrit, publie sur Pub/Sub"""
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    
    try:
        logger.info(f"{'='*60}")
        logger.info(f"📥 Nouvelle requête: {request_id}")
        
        data = request.get_json()
        logger.info(f"📦 Données reçues: {bool(data)}")
        
        if not data or 'text' not in data:
            logger.warning("❌ Pas de texte dans la requête")
            return jsonify({"error": "No text provided"}), 400
        
        transcription = data['text'].strip()
        context = data.get('context', {})
        
        logger.info(f"📝 Transcription: {transcription}")
        logger.info(f"🌐 URL: {context.get('url', 'N/A')}")
        
        if not transcription:
            logger.warning("❌ Transcription vide")
            return jsonify({"error": "Empty text"}), 400
        
        # Gérer l'état du graphe
        graph_state = context.get('graph_state', None)
        if graph_state:
            session_id = graph_state.get('session_id', request_id)
            messages_count = len(graph_state.get('messages', []))
            logger.info(f"📚 État graphe: {messages_count} messages, session={session_id}")
            
            with storage.graph_states_lock:
                storage.graph_states[session_id] = {
                    "state": graph_state,
                    "timestamp": time.time()
                }
        
        # Stocker la requête en attente
        logger.info("💾 Stockage de la requête...")
        with storage.pending_lock:
            storage.pending_responses[request_id] = {
                "status": "waiting",
                "transcription": transcription,
                "context": context,
                "timestamp": time.time()
            }
        logger.info("   Requête stockée")
        
        # Publier sur Pub/Sub
        logger.info("📤 Début publication Pub/Sub...")
        topic_path = publisher.topic_path(PROJECT_ID, USER_TRANSCRIPTION_TOPIC)
        logger.info(f"📍 Topic: {topic_path}")
        
        message_data = json.dumps({
            "request_id": request_id,
            "text": transcription,
            "context": context
        }).encode('utf-8')
        
        logger.info(f"📦 Taille message: {len(message_data)} bytes")
        logger.info("⏳ Envoi du message...")
        
        future = publisher.publish(
            topic_path,
            message_data,
            request_id=request_id
        )
        
        logger.info("⏳ Attente de la confirmation...")
        message_id = future.result(timeout=10.0)
        
        logger.info(f"   MESSAGE PUBLIÉ ! message_id={message_id}")
        logger.info(f"{'='*60}")
        
        return jsonify({
            "request_id": request_id,
            "transcription": transcription,
            "message_id": message_id,
            "topic": USER_TRANSCRIPTION_TOPIC
        }), 200
    
    except Exception as e:
        logger.error(f"❌ ERREUR dans /process: {type(e).__name__}: {e}")
        logger.exception("Stacktrace complète:")
        return jsonify({
            "error": str(e),
            "request_id": request_id,
            "type": type(e).__name__
        }), 500

@app.route('/agent-response', methods=['POST'])
def receive_agent_response():
    """Endpoint appelé par Pub/Sub (push subscription)"""
    try:
        logger.info(f"{'='*60}")
        logger.info("📨 Réception réponse agent")
        
        envelope = request.get_json()
        if not envelope:
            logger.error("❌ Pas d'enveloppe Pub/Sub")
            return jsonify({"error": "No Pub/Sub message"}), 400
        
        pubsub_message = envelope.get('message', {})
        data = json.loads(base64.b64decode(pubsub_message['data']).decode('utf-8'))
        
        request_id = data.get('request_id')
        logger.info(f"🔑 Request ID: {request_id}")
        logger.info(f"📝 Texte: {data.get('text', '')[:100]}...")
        
        # Stocker la réponse
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                storage.pending_responses[request_id].update({
                    "status": "ready",
                    "text": data.get('text', ''),
                    "audio": data.get('audio', ''),
                    "action": data.get('action', {}),
                    "needs_confirmation": data.get('needs_confirmation', False),
                    "search_results": data.get('search_results', [])
                })
                logger.info(f"   Réponse stockée pour {request_id}")
            else:
                logger.warning(f"⚠️ Request ID {request_id} non trouvé")
        
        logger.info(f"{'='*60}")
        return '', 204
    
    except Exception as e:
        logger.error(f"❌ Erreur /agent-response: {e}")
        logger.exception("Stacktrace:")
        return jsonify({"error": str(e)}), 500

@app.route('/response/<request_id>', methods=['GET'])
def get_audio_response(request_id):
    """Récupère la réponse de l'agent (polling)"""
    with storage.pending_lock:
        response = storage.pending_responses.get(request_id)
    
    if not response:
        return jsonify({"error": "Request not found"}), 404
    
    if time.time() - response["timestamp"] > storage.RESPONSE_TIMEOUT:
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                del storage.pending_responses[request_id]
        return jsonify({"error": "Request timeout"}), 408
    
    if response["status"] == "ready":
        result = {
            "transcription": response["transcription"],
            "text": response.get("text"),
            "audio": response.get("audio"),
            "action": response.get("action", {}),
            "needs_confirmation": response.get("needs_confirmation", False),
            "search_results": response.get("search_results", [])
        }
        
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                del storage.pending_responses[request_id]
        
        logger.info(f"   Réponse envoyée pour {request_id}")
        return jsonify(result)
    
    # Toujours en attente (pas de log pour éviter le spam)
    return jsonify({"status": "waiting"}), 202

@app.route('/graph_state/<session_id>', methods=['GET'])
def get_graph_state(session_id):
    with storage.graph_states_lock:
        state_data = storage.graph_states.get(session_id)
    
    if not state_data:
        return jsonify({"error": "Session not found"}), 404
    
    if time.time() - state_data["timestamp"] > storage.GRAPH_STATE_TIMEOUT:
        with storage.graph_states_lock:
            if session_id in storage.graph_states:
                del storage.graph_states[session_id]
        return jsonify({"error": "Session expired"}), 410
    
    return jsonify(state_data["state"])

@app.route('/graph_state/<session_id>', methods=['DELETE'])
def delete_graph_state(session_id):
    with storage.graph_states_lock:
        if session_id in storage.graph_states:
            del storage.graph_states[session_id]
            logger.info(f"🗑️ État graphe supprimé: {session_id}")
            return jsonify({"ok": True})
    
    return jsonify({"error": "Session not found"}), 404

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "project_id": PROJECT_ID,
        "topic": USER_TRANSCRIPTION_TOPIC
    }), 200

if __name__ == '__main__':
    logger.info("="*60)
    logger.info("🚀 DÉMARRAGE API GATEWAY (Mode développement)")
    logger.info(f"📍 Project ID: {PROJECT_ID}")
    logger.info(f"📍 Topic: {USER_TRANSCRIPTION_TOPIC}")
    logger.info("="*60)
    
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
