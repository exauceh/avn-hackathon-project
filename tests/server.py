"""
Serveur web de test pour l'Agent ML - Équipe A
"""
from flask import Flask, request, jsonify, send_file
import sys
import os
from pathlib import Path

# Ajouter le dossier racine au PYTHONPATH
current_dir = Path(__file__).parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

# Import de l'agent et du mock
from core.agents.ml_agent import PlanningAgent
from core.agents.voice_input_mock import TeamCMockInput
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

app = Flask(__name__)

# Historique des questions/réponses
conversation_history = []
max_history_size = 50  # Limiter à 50 entrées

def add_to_history(question, result, response_time=None, source='manual'):
    """Ajouter une entrée à l'historique"""
    import datetime
    
    entry = {
        'id': len(conversation_history) + 1,
        'timestamp': datetime.datetime.now().isoformat(),
        'question': question,
        'response': result.response,
        'intent': result.intent,
        'action': result.action,
        'confidence': result.confidence,
        'response_time': response_time,
        'source': source  # 'manual' ou 'auto'
    }
    
    conversation_history.append(entry)
    
    # Garder seulement les dernières entrées
    if len(conversation_history) > max_history_size:
        conversation_history.pop(0)
    
    return entry

# Initialiser l'agent et le mock une seule fois
try:
    agent = PlanningAgent()
    team_c_mock = TeamCMockInput()
    print("Agent ML et Mock Équipe C initialisés avec succès")
except Exception as e:
    print(f"Erreur initialisation: {e}")
    agent = None
    team_c_mock = None

@app.route('/')
def index():
    """Page principale - Interface de simulation"""
    return send_file('interface.html')

@app.route('/simulation')
def simulation():
    """Page de simulation (alias)"""
    return send_file('interface.html')

@app.route('/api/random-question')
def get_random_question():
    """Endpoint pour obtenir une question aléatoire de l'équipe C"""
    if not team_c_mock:
        return jsonify({
            'error': 'Mock équipe C non disponible',
            'text': 'Question par défaut: Comment ça va ?'
        }), 500
    
    try:
        transcription = team_c_mock.get_random_transcription()
        return jsonify({
            'text': transcription.text
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'text': 'Erreur lors de la récupération de la question'
        }), 500

@app.route('/api/ask', methods=['POST'])
def ask_question():
    """Endpoint pour poser une question à l'agent (interface manuelle)"""
    if not agent:
        return jsonify({
            'error': 'Agent non disponible',
            'response': 'Désolé, l\'agent n\'est pas disponible en ce moment.'
        }), 500
    
    try:
        data = request.get_json()
        question = data.get('text', '').strip()
        
        if not question:
            return jsonify({
                'error': 'Question vide',
                'response': 'Veuillez poser une question.'
            }), 400
        
        # Traiter la question avec l'agent
        result = agent.process_voice_input({'text': question})
        
        return jsonify({
            'intent': result.intent,
            'action': result.action,
            'response': result.response,
            'confidence': result.confidence
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'response': 'Désolé, une erreur s\'est produite lors du traitement de votre question.'
        }), 500

@app.route('/api/process-question', methods=['POST'])
def process_question():
    """Endpoint pour traitement automatique des questions (simulation)"""
    if not agent:
        return jsonify({
            'error': 'Agent non disponible'
        }), 500
    
    try:
        data = request.get_json()
        question = data.get('text', '').strip()
        
        if not question:
            return jsonify({
                'error': 'Question vide'
            }), 400
        
        # Traitement silencieux (suppression des warnings)
        import sys
        from io import StringIO
        
        old_stderr = sys.stderr
        sys.stderr = StringIO()
        
        try:
            import time
            start_time = time.time()
            
            result = agent.process_voice_input({'text': question})
            
            response_time = int((time.time() - start_time) * 1000)  # en ms
            
            # Ajouter à l'historique
            source = data.get('source', 'auto')  # auto par défaut pour la simulation
            add_to_history(question, result, response_time, source)
            
            return jsonify({
                'intent': result.intent,
                'action': result.action,
                'response': result.response,
                'confidence': result.confidence
            })
        finally:
            sys.stderr = old_stderr
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/history')
def get_history():
    """Récupérer l'historique des conversations"""
    return jsonify({
        'history': conversation_history,
        'total': len(conversation_history)
    })

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    """Vider l'historique"""
    global conversation_history
    conversation_history = []
    return jsonify({'message': 'Historique vidé'})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Récupérer les paramètres actuels"""
    return jsonify({
        'auto_interval': 3000,  # valeur par défaut en ms
        'max_history': max_history_size
    })

@app.route('/api/settings', methods=['POST'])
def update_settings():
    """Mettre à jour les paramètres"""
    data = request.get_json()
    
    # Pour l'instant, on retourne juste la confirmation
    # L'intervalle sera géré côté client
    return jsonify({
        'message': 'Paramètres mis à jour',
        'settings': data
    })

@app.route('/api/status')
def status():
    """Vérifier le statut de l'agent"""
    return jsonify({
        'agent_available': agent is not None,
        'mock_available': team_c_mock is not None,
        'status': 'OK' if (agent and team_c_mock) else 'Services non disponibles'
    })

if __name__ == '__main__':
    print("Démarrage du serveur Agent ML...")
    print("Interface de simulation: http://localhost:5000")
    print("API Status: http://localhost:5000/api/status")
    app.run(debug=True, host='0.0.0.0', port=5000)