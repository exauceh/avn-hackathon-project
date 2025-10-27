import os
import uuid
import json
import time
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from pubsub_handler import setup_pubsub_listener, publish_text
import storage

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return {"status": "Voice Gateway OK", "pending": len(storage.pending_responses)}

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
        print(f"📄 Titre: {context.get('title', 'N/A')}")
        
        with storage.pending_lock:
            storage.pending_responses[request_id] = {
                "status": "waiting",
                "transcription": transcription,
                "context": context,
                "timestamp": time.time()
            }
            print(f"📊 Requêtes en attente: {list(storage.pending_responses.keys())}")
        
        publish_text(request_id, transcription, context)
        
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
        print(f"\n{'='*60}")
        print(f"📤 Envoi réponse pour {request_id}")
        print(f"📝 Texte: {response.get('text', '')[:50]}...")
        print(f"🔊 Audio: {len(response.get('audio', ''))} caractères")
        print(f"🎬 Action: {response.get('action', {})}")
        print("="*60 + "\n")
        
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

def cleanup_old_responses():
    """Nettoie les réponses expirées"""
    while True:
        time.sleep(10)
        now = time.time()
        with storage.pending_lock:
            expired = [
                req_id for req_id, resp in storage.pending_responses.items()
                if now - resp["timestamp"] > storage.RESPONSE_TIMEOUT
            ]
            for req_id in expired:
                age = now - storage.pending_responses[req_id]['timestamp']
                print(f"🗑️ Nettoyage requête expirée: {req_id} (age: {age:.1f}s)")
                del storage.pending_responses[req_id]

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 DÉMARRAGE API GATEWAY")
    print("="*60)
    
    print("📡 Démarrage du listener Pub/Sub...")
    pubsub_thread = threading.Thread(target=setup_pubsub_listener, daemon=True)
    pubsub_thread.start()
    
    cleanup_thread = threading.Thread(target=cleanup_old_responses, daemon=True)
    cleanup_thread.start()
    
    print("🌐 Serveur Flask sur http://0.0.0.0:8080")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=8080, debug=False)
