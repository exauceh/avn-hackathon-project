import base64
import os
import uuid
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import pubsub_v1
import storage

app = Flask(__name__)
CORS(app)

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "avn-hackathon-project")
USER_TRANSCRIPTION_TOPIC = "frontend_input"

# Client Pub/Sub
publisher = pubsub_v1.PublisherClient()

@app.route('/')
def index():
    return {
        "status": "API Gateway OK",
        "pending": len(storage.pending_responses),
        "project_id": PROJECT_ID
    }

@app.route('/process', methods=['POST'])
def process_text():
    """Reçoit le texte transcrit, publie sur Pub/Sub"""
    try:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        transcription = data['text'].strip()
        context = data.get('context', {})
        
        if not transcription:
            return jsonify({"error": "Empty text"}), 400
        
        print(f"\n{'='*60}")
        print(f"📝 Traitement {request_id}: {transcription}")
        print(f"🌐 Contexte URL: {context.get('url', 'N/A')}")
        
        graph_state = context.get('graph_state', None)
        if graph_state:
            session_id = graph_state.get('session_id', request_id)
            print(f"📚 État du graphe: {len(graph_state.get('messages', []))} messages")
            print(f"🔑 Session ID: {session_id}")
            
            with storage.graph_states_lock:
                storage.graph_states[session_id] = {
                    "state": graph_state,
                    "timestamp": time.time()
                }
        
        # Stocker la requête en attente
        with storage.pending_lock:
            storage.pending_responses[request_id] = {
                "status": "waiting",
                "transcription": transcription,
                "context": context,
                "timestamp": time.time()
            }
        
        # Publier sur Pub/Sub
        topic_path = publisher.topic_path(PROJECT_ID, USER_TRANSCRIPTION_TOPIC)
        message_data = json.dumps({
            "request_id": request_id,
            "text": transcription,
            "context": context
        }).encode('utf-8')
        
        future = publisher.publish(
            topic_path,
            message_data,
            request_id=request_id  # Attribut pour le routing
        )
        
        message_id = future.result(timeout=5.0)
        print(f"✅ Publié sur Pub/Sub: message_id={message_id}")
        print("="*60 + "\n")
        
        return jsonify({
            "request_id": request_id,
            "transcription": transcription
        })
    
    except Exception as e:
        print(f"❌ Erreur traitement: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/agent-response', methods=['POST'])
def receive_agent_response():
    """
    Endpoint appelé par Pub/Sub (push subscription) avec la réponse de l'agent
    """
    try:
        # Vérifier que c'est bien Pub/Sub qui appelle
        if not request.headers.get('User-Agent', '').startswith('Google-Cloud-Pub/Sub'):
            return jsonify({"error": "Unauthorized"}), 401
        
        # Décoder le message Pub/Sub
        envelope = request.get_json()
        if not envelope:
            return jsonify({"error": "No Pub/Sub message"}), 400
        
        pubsub_message = envelope.get('message', {})
        data = json.loads(base64.b64decode(pubsub_message['data']).decode('utf-8'))
        
        request_id = data.get('request_id')
        response_text = data.get('text', '')
        audio_base64 = data.get('audio', '')
        action = data.get('action', {})
        needs_confirmation = data.get('needs_confirmation', False)
        search_results = data.get('search_results', [])
        
        print(f"\n{'='*60}")
        print(f"📨 Réponse agent reçue: {request_id}")
        print(f"📝 Texte: {response_text[:100]}...")
        print(f"🔊 Audio: {len(audio_base64)} chars")
        
        # Stocker la réponse
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                storage.pending_responses[request_id].update({
                    "status": "ready",
                    "text": response_text,
                    "audio": audio_base64,
                    "action": action,
                    "needs_confirmation": needs_confirmation,
                    "search_results": search_results
                })
                print(f"✅ Réponse stockée pour {request_id}")
            else:
                print(f"⚠️ Request ID {request_id} non trouvé dans pending")
        
        print("="*60 + "\n")
        
        # Pub/Sub attend un 200/204
        return '', 204
    
    except Exception as e:
        print(f"❌ Erreur réception réponse: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/response/<request_id>', methods=['GET'])
def get_audio_response(request_id):
    """Récupère la réponse de l'agent (polling)"""
    with storage.pending_lock:
        response = storage.pending_responses.get(request_id)
    
    if not response:
        return jsonify({"error": "Request not found"}), 404
    
    # Vérifier timeout
    if time.time() - response["timestamp"] > storage.RESPONSE_TIMEOUT:
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                del storage.pending_responses[request_id]
        return jsonify({"error": "Request timeout"}), 408
    
    # Si réponse prête
    if response["status"] == "ready":
        result = {
            "transcription": response["transcription"],
            "text": response.get("text"),
            "audio": response.get("audio"),
            "action": response.get("action", {}),
            "needs_confirmation": response.get("needs_confirmation", False),
            "search_results": response.get("search_results", [])
        }
        
        # Nettoyer
        with storage.pending_lock:
            if request_id in storage.pending_responses:
                del storage.pending_responses[request_id]
        
        return jsonify(result)
    
    # Toujours en attente
    return jsonify({"status": "waiting"}), 202

@app.route('/graph_state/<session_id>', methods=['GET'])
def get_graph_state(session_id):
    """Récupère l'état du graphe pour une session"""
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
    """Supprime l'état du graphe pour une session"""
    with storage.graph_states_lock:
        if session_id in storage.graph_states:
            del storage.graph_states[session_id]
            print(f"🗑️ État du graphe supprimé: {session_id}")
            return jsonify({"ok": True})
    
    return jsonify({"error": "Session not found"}), 404

# Health check pour Cloud Run
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 DÉMARRAGE API GATEWAY (GCP Mode)")
    print(f"📍 Project ID: {PROJECT_ID}")
    print("="*60 + "\n")
    
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
