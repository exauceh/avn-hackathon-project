# API REST - Voice Gateway

## Architecture Simplifiée

```
Frontend → POST /transcribe → STT → Pub/Sub → Agent
Agent → Pub/Sub → TTS → Stored → Frontend GET /response
```

## Endpoints

### POST `/transcribe`

Envoie un fichier audio pour transcription.

**Request:**
```http
POST http://127.0.0.1:8080/transcribe
Content-Type: multipart/form-data

audio: [fichier WebM/Opus]
```

**Response (200):**
```json
{
  "request_id": "req_abc123",
  "transcription": "Bonjour, comment vas-tu ?"
}
```

**Errors:**
- `400`: Audio manquant ou vide
- `500`: Erreur de transcription

---

### GET `/response/{request_id}`

Récupère la réponse de l'agent (polling).

**Request:**
```http
GET http://127.0.0.1:8080/response/req_abc123
```

**Response (200 - Ready):**
```json
{
  "transcription": "Bonjour, comment vas-tu ?",
  "text": "Bonjour ! Je vais très bien, merci.",
  "audio": "base64_encoded_mp3..."
}
```

**Response (202 - Waiting):**
```json
{
  "status": "waiting"
}
```

**Errors:**
- `404`: Request ID inconnu
- `408`: Timeout (60 secondes)

---

## Flow Complet

1. **Frontend** enregistre audio → Envoie à `/transcribe`
2. **Backend** transcrit avec Google STT → Retourne `request_id` + transcription
3. **Backend** publie sur Pub/Sub `voice.input`
4. **Agent** traite et répond sur Pub/Sub `agent.reply`
5. **Backend** reçoit réponse → Génère TTS → Stocke en mémoire
6. **Frontend** poll `/response/{request_id}` toutes les secondes
7. **Backend** retourne texte + audio base64
8. **Frontend** joue l'audio

---

## Avantages

✅ **Simple** : Pas de gestion de connexions persistantes  
✅ **Fiable** : Pas de problèmes de reconnexion  
✅ **Stateless** : Facile à scaler  
✅ **Debug facile** : Requêtes HTTP standard  

---

## Configuration

**Variables d'environnement :**
```bash
GOOGLE_CLOUD_PROJECT=avn-hackathon-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Démarrage :**
```bash
cd cloud/services/websocket-gateway
source .env/bin/activate
python main.py
```

Le serveur démarre sur `http://0.0.0.0:8080`
