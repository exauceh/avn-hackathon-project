import base64
from google.cloud import texttospeech

# Configuration Google Cloud TTS
TTS_LANGUAGE_CODE = 'fr-FR'
TTS_VOICE_NAME = 'fr-FR-Neural2-A'  # Voix féminine française (ou 'fr-FR-Neural2-B' pour masculine)

tts_client = texttospeech.TextToSpeechClient()

def text_to_speech(text, session_id):
    """
    Convertit du texte en audio via Google Cloud TTS.
    
    Args:
        text: Texte à convertir
        session_id: ID de session (pour logs)
    
    Returns:
        str: Audio encodé en base64, ou None en cas d'erreur
    """
    
    print(f"🎵 TTS pour {session_id}: '{text[:50]}...'")
    
    try:
        # Configuration de la synthèse
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code=TTS_LANGUAGE_CODE,
            name=TTS_VOICE_NAME
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,  # Vitesse normale (0.25 à 4.0)
            pitch=0.0  # Pitch normal (-20.0 à 20.0)
        )
        
        # Appel à l'API TTS
        print(f"📡 Envoi à Google Cloud TTS...")
        response = tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Encoder en base64 pour envoi au client JS
        audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
        
        print(f"✅ [{session_id}] TTS généré: {len(audio_base64)} caractères base64")
        
        return audio_base64
    
    except Exception as e:
        print(f"❌ Erreur TTS pour {session_id}: {e}")
        import traceback
        traceback.print_exc()
        return None