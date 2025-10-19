"""
Mock de l'équipe C (Voice I/O) 
Simule UNIQUEMENT ce qu'on reçoit via Speech-to-Text
"""

import random
from dataclasses import dataclass
from typing import Dict, Any
import json


@dataclass
class VoiceTranscription:
    """Structure des données reçues de l'équipe C"""
    text: str


class TeamCMockInput:
    """
    Simule les inputs que l'équipe C (Voice I/O) nous envoie
    Via Pub/Sub topic: 'voice.transcribed'
    """
    
    def __init__(self):
        self.sample_transcriptions = [
            VoiceTranscription("Quelle est la capitale de la France ?"),
            VoiceTranscription("Comment faire une omelette ?"),
            VoiceTranscription("Qui a inventé l'ordinateur ?"),
            VoiceTranscription("Quelle est la météo aujourd'hui ?"),
            VoiceTranscription("Comment apprendre Python ?"),
            VoiceTranscription("Qu'est-ce que l'intelligence artificielle ?"),
            VoiceTranscription("Combien font 25 multiplié par 8 ?"),
            VoiceTranscription("Quelle heure est-il ?"),
            VoiceTranscription("Comment cuisiner du riz ?"),
            VoiceTranscription("Qui est le président de la France ?"),
            VoiceTranscription("Comment fonctionne Internet ?"),
            VoiceTranscription("Quelle est la distance entre la Terre et la Lune ?"),
            VoiceTranscription("Comment réparer une crevaison de vélo ?"),
            VoiceTranscription("Qu'est-ce que le réchauffement climatique ?"),
            VoiceTranscription("Comment planter des tomates ?")
        ]
    
    def get_random_transcription(self) -> VoiceTranscription:
        """Simule la réception d'une transcription aléatoire de l'équipe C"""
        return random.choice(self.sample_transcriptions)
    
    def get_transcription_as_pubsub_message(self) -> Dict[str, Any]:
        """Format Pub/Sub message comme reçu de l'équipe C"""
        transcription = self.get_random_transcription()
        
        return {
            "text": transcription.text
        }
    
    def simulate_specific_command(self, command_text: str) -> VoiceTranscription:
        """Simule une commande vocale spécifique"""
        return VoiceTranscription(command_text)


def start_automatic_simulation():
    """Démarre la simulation automatique avec envoi toutes les 3 secondes"""
    import time
    
    team_c_mock = TeamCMockInput()
    
    print("=== Simulation Automatique Équipe C ===")
    print("Envoi de questions toutes les 3 secondes...")
    print("Appuyez sur Ctrl+C pour arrêter\n")
    
    try:
        question_count = 0
        while True:
            question_count += 1
            transcription = team_c_mock.get_random_transcription()
            
            print(f"[{question_count:02d}] Question: {transcription.text}")
            
            # Simuler l'envoi vers l'équipe A
            pubsub_message = team_c_mock.get_transcription_as_pubsub_message()
            
            # Attendre 3 secondes avant la prochaine question
            time.sleep(3)
            
    except KeyboardInterrupt:
        print(f"\nSimulation arrêtée après {question_count} questions.")


# Test du mock
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--auto":
        start_automatic_simulation()
    else:
        print("=== Simulation des inputs de l'équipe C ===")
        
        team_c_mock = TeamCMockInput()
        
        print("\n1. Transcription aléatoire:")
        transcription = team_c_mock.get_random_transcription()
        print(f"Texte: {transcription.text}")
        
        print("\n2. Format simplifié:")
        simple_msg = team_c_mock.get_transcription_as_pubsub_message()
        print(json.dumps(simple_msg, indent=2))
        
        print("\n3. Commande spécifique:")
        specific = team_c_mock.simulate_specific_command("Trouve moi un restaurant")
        print(f"Texte: {specific.text}")
        
        print("\nPour simulation automatique: python voice_input_mock.py --auto")