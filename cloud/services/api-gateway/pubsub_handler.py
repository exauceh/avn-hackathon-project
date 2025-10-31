import os
import json
from google.cloud import pubsub_v1
import storage
import datetime

PROJECT_ID = 'avn-hackathon-project'
USER_TRANSCRIPTION_TOPIC = 'frontend_input'
AGENT_REPLY_SUBSCRIPTION = 'agent-reply-sub'

publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()

def publish_text(request_id, transcription, context=None):
    """Publie la transcription avec le request_id et le contexte"""
    print("1")

    try:
        topic_path = publisher.topic_path(PROJECT_ID, USER_TRANSCRIPTION_TOPIC)
        
        message_data = json.dumps({
            "request_id": request_id,
            "session_id": request_id,
            "text": transcription,
            "context": context or {},
            "timestamp": datetime.datetime.now().isoformat()
        }).encode('utf-8')
        
        future = publisher.publish(
            topic_path,
            message_data,
            session_id=request_id
        )

        # 2. Attendre le résultat et capturer l'ID
        message_id = future.result()
        print(f"✅ Publié avec succès sur Pub/Sub: Message ID={message_id}, Request ID={request_id}")
        return message_id
    except Exception as e:
        # 3. 🚨 Si le message n'est pas publié, l'erreur est ici !
        print(f"❌ Échec de la publication pour Request ID {request_id}: {e}")
    
    print(f"📤 Publié sur Pub/Sub: {request_id}")
    return message_id

def pubsub_callback(message):
    """
    Callback pour les réponses de l'agent ADK
    L'audio est déjà généré par pubsub_listener.py
    """
    
    print("\n" + "="*60)
    print("📨 MESSAGE PUB/SUB REÇU (AVEC AUDIO)")
    print(f"🔍 pending_responses id: {id(storage.pending_responses)}")
    
    try:
        data = json.loads(message.data.decode('utf-8'))
        
        # Debug complet
        print(f"📦 Data keys: {list(data.keys())}")
        print(f"🏷️ Attributes: {dict(message.attributes)}")
        
        # Récupérer le request_id
        request_id = (
            message.attributes.get('session_id') or 
            message.attributes.get('sessionId') or
            data.get('session_id') or 
            data.get('sessionId') or
            data.get('request_id')
        )
        
        # Récupérer les données de la réponse
        response_text = data.get('text', '')
        audio_base64 = data.get('audio', '')
        action = data.get('action', {})
        needs_confirmation = data.get('needs_confirmation', False)
        search_results = data.get('search_results', [])
        
        if not response_text:
            print("⚠️ Pas de texte dans le message")
            message.ack()
            print("="*60 + "\n")
            return
        
        print(f"🤖 Réponse: {response_text[:100]}...")
        print(f"🔊 Audio reçu: {len(audio_base64)} caractères")
        print(f"🎬 Action: {action.get('type', 'aucune')}")
        
        # Si pas de request_id, utiliser la requête la plus ancienne
        if not request_id:
            print("⚠️ Pas de request_id dans le message")
            
            with storage.pending_lock:
                print(f"📊 Requêtes en attente: {list(storage.pending_responses.keys())}")
                
                waiting_requests = [
                    (req_id, resp) 
                    for req_id, resp in storage.pending_responses.items() 
                    if resp.get("status") == "waiting"
                ]
            
            if waiting_requests:
                waiting_requests.sort(key=lambda x: x[1]["timestamp"])
                request_id = waiting_requests[0][0]
                print(f"✅ Utilisation de la requête en attente: {request_id}")
            else:
                print("❌ Aucune requête en attente")
                message.ack()
                print("="*60 + "\n")
                return
        
        # Vérifier que la requête existe
        with storage.pending_lock:
            if request_id not in storage.pending_responses:
                print(f"⚠️ Request ID {request_id} non trouvé")
                print(f"📊 IDs disponibles: {list(storage.pending_responses.keys())}")
                message.ack()
                print("="*60 + "\n")
                return
        
        # ✅ STOCKER DIRECTEMENT LA RÉPONSE (audio déjà généré)
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
                print(f"✅ Réponse complète stockée pour {request_id}")
                print(f"📊 Audio: {len(audio_base64)} caractères")
                print(f"🎬 Action stockée: {action}")
            else:
                print(f"⚠️ {request_id} a disparu")
        
        message.ack()
        print("="*60 + "\n")
    
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        message.ack()
        print("="*60 + "\n")

def setup_pubsub_listener():
    """Configure l'écoute Pub/Sub"""
    subscription_path = subscriber.subscription_path(PROJECT_ID, AGENT_REPLY_SUBSCRIPTION)
    print(f"👂 Écoute Pub/Sub: {subscription_path}")
    
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=pubsub_callback)
    
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        streaming_pull_future.cancel()
        print("🛑 Listener arrêté")
