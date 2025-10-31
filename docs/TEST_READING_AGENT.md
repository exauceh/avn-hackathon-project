# 📖 Guide de Test - Agent de Lecture avec Interruption

## 🎯 Objectif
Tester le cas d'usage #2 : **Lecture conversationnelle avec clarification contextuelle**

L'utilisateur peut :
1. Demander la lecture d'un article
2. Interrompre pendant la lecture en posant une question
3. Obtenir une réponse immédiate
4. Reprendre la lecture là où elle s'était arrêtée

## 🏗️ Architecture de l'Interruption

**Approche : Détection côté frontend pendant le TTS**

```
USER PARLE (pendant TTS)
    ↓
popup-stt.js → webkitSpeechRecognition (continu en parallèle du TTS)
    ↓
Détection mot-clé question (what, why, how, quoi, comment...)
    ↓
Message 'interrupt_tts' → background.js
    ↓
background.js → offscreen.js (stop-audio)
    ↓
background.js → sendTranscriptionToServer(transcript, isInterruption=true)
    ↓
Backend reçoit USER_INTERRUPTED_READING + question
    ↓
reading_agent._handle_clarification()
    ↓
LLM répond + "Would you like me to continue?"
    ↓
User dit "Continue"
    ↓
reading_agent._resume_reading() → reprend au chunk suivant
```

**Principe clé :** L'enregistrement audio est **toujours actif** pendant le TTS via `webkitSpeechRecognition` en mode continu. Dès qu'une question est détectée (mots-clés interrogatifs), l'audio est stoppé et la transcription envoyée au backend avec le flag `isInterruption=true`.

---

## 🔧 Prérequis

### Backend
```bash
cd cloud/services/api-gateway
source .env/bin/activate
python main.py
```
Le serveur doit tourner sur `http://localhost:8080`

### Frontend
1. Charger l'extension Chrome depuis `/frontend`
2. Vérifier que le microphone est autorisé
3. S'assurer que l'API Key Google est configurée

---

## 📋 Scénario de Test Complet

### Phase 1 : Démarrage de la Lecture

**Étape 1.1 : Ouvrir un article**
- Aller sur une page d'article (ex: Wikipedia, blog, article de presse)
- Page de test suggérée : https://en.wikipedia.org/wiki/Artificial_intelligence

**Étape 1.2 : Activer l'assistant**
- Dire : **"Hello AVN"**
- ✅ Vérifier : Son "hum" confirmant l'activation

**Étape 1.3 : Demander la lecture**
- Dire : **"Read this article"** ou **"Lis cet article"**
- ✅ Vérifier dans les logs backend (pubsub_listener.py) :
  ```
  📖 Reading agent: read this article...
  📖 Starting to read: [Titre de l'article]
  📖 Content split into X chunks
  ```

**Étape 1.4 : Écouter le début**
- L'agent commence à lire le premier chunk (≈500 caractères)
- ✅ Vérifier dans les logs du frontend (background.js) :
  ```
  📖 Lecture: started, interruption: true
  🔊 TTS démarré
  🔊 Lecture audio...
  ```
- ✅ Vérifier dans les logs de popup-stt.js :
  ```
  🔊 TTS démarré
  🎤 Activation de l'écoute d'interruption
  🎤 [Interruption] Écoute active pendant TTS
  ```

### Phase 2 : Interruption Pendant la Lecture

**Étape 2.1 : Interrompre avec une question**
- **Pendant que l'agent lit**, dire : **"What is machine learning?"** ou **"Qu'est-ce qu'un neurone?"**
- ⚠️ **Important** : Utiliser un mot-clé interrogatif (what, why, how, quoi, comment, pourquoi, etc.)

**Étape 2.2 : Vérifier la détection d'interruption**
- ✅ Logs frontend (popup-stt.js) attendus :
  ```
  🛑 [Interruption] Détectée: What is machine learning?
  ❓ Question détectée pendant la lecture, interruption...
  ```
- ✅ Le TTS doit s'arrêter **immédiatement** (< 200ms)
- ✅ Logs offscreen.js :
  ```
  🟠 [OFFSCREEN] Message reçu: {type: 'stop-audio', target: 'offscreen'}
  🟠 [OFFSCREEN] ⏹️ Arrêt audio demandé
  🟠 [OFFSCREEN] ✅ Audio arrêté
  ```

**Étape 2.3 : Vérifier la transmission au backend**
- ✅ Logs background.js :
  ```
  🛑 Interruption TTS demandée depuis popup-stt
  🛑 Traitement d'une interruption pendant la lecture
  📤 Envoi transcription au serveur...
  ```
- ✅ Logs backend (pubsub_listener.py) :
  ```
  📩 Messages reçus: [..., {'role': 'system', 'content': 'USER_INTERRUPTED_READING'}, {'role': 'user', 'content': 'What is machine learning?'}]
  🛑 ⚠️ INTERRUPTION DÉTECTÉE dans les messages !
  🛑 Message utilisateur: What is machine learning?
  🛑 Cette requête va être traitée comme une clarification
  ```
- ✅ Logs backend (graph_agent.py - Router) :
  ```
  🛑 ROUTEUR: Flag d'interruption détecté !
  🎯 Router: INTERRUPTION → reading (clarification)
  🎯 Message utilisateur: What is machine learning?...
  ```
- ✅ Logs backend (reading_agent.py) :
  ```
  ============================================================
  📖 Reading agent processing: what is machine learning?...
  📖 État actuel: is_reading=True, paused=False
  📖 Position: 0/4 chunks
  🛑 Interruption détectée → Traitement clarification
  ============================================================
  ✅ Interruption confirmée: what is machine learning?...
  ⏸️ Lecture mise en pause à la position 0
  ❓ Question de clarification: what is machine learning?
  📖 État actuel: position 0/4 chunks
  💬 Réponse générée: Machine learning is a subset...
  ```

**Étape 2.4 : Écouter la réponse**
- L'agent répond à la question posée
- ✅ Vérifier que la réponse est pertinente et contextuelle
- ✅ L'agent doit terminer avec : **"Would you like me to continue reading?"** ou similaire

### Phase 3 : Reprise de la Lecture

**Étape 3.1 : Reprendre la lecture**
- Attendre la fin de la réponse
- Dire : **"Continue"** ou **"Yes, continue"** ou **"Go on"**

**Étape 3.2 : Vérifier la reprise**
- ✅ Logs backend (reading_agent.py) :
  ```
  ============================================================
  📖 Reading agent processing: yes, continue...
  📖 État actuel: is_reading=True, paused=True
  📖 Position: 0/4 chunks
  ⏯️ Intent: Reprise lecture
  ============================================================
  ⏯️ Reprise de la lecture:
     - Position: 1/4
     - Article: Introduction to Artificial Intelligence
  📖 Lecture du chunk 1: Leading AI textbooks define...
  ```
- ✅ L'agent reprend au **chunk suivant** (pas de répétition)
- ✅ Logs frontend :
  ```
  📖 Lecture: resumed, interruption: true
  🔊 TTS démarré
  🎤 [Interruption] Écoute active pendant TTS
  ```

**Étape 3.3 : Vérifier la continuité**
- ✅ Le contenu lu ne doit **PAS** répéter ce qui a déjà été lu avant l'interruption
- ✅ La lecture reprend exactement au chunk suivant

---

## 🔍 Points de Vérification Critiques

### Frontend (popup-stt.js)

| Élément | Vérification | Log attendu |
|---------|--------------|-------------|
| **Variables d'état** | `isTTSPlaying`, `canInterruptTTS` initialisées | Au début du fichier |
| **Écoute d'interruption** | Démarre avec le TTS | `🎤 [Interruption] Écoute active pendant TTS` |
| **Détection question** | Regex match mots-clés | `❓ Question détectée pendant la lecture` |
| **Arrêt TTS** | Message `interrupt_tts` envoyé | `🛑 [Interruption] Détectée: [question]` |
| **Relance automatique** | Si TTS continue, relance recognition | `onend` relance si `isTTSPlaying && canInterruptTTS` |

### Frontend (background.js)

| Élément | Vérification | Log attendu |
|---------|--------------|-------------|
| **ttsState** | `canInterrupt` activé pour reading | `📖 Lecture: started, interruption: true` |
| **Handler interrupt_tts** | Reçoit message de popup-stt | `🛑 Interruption TTS demandée depuis popup-stt` |
| **Arrêt audio** | Message `stop-audio` envoyé à offscreen | `type: 'stop-audio', target: 'offscreen'` |
| **Message système** | `USER_INTERRUPTED_READING` ajouté | Dans `sendTranscriptionToServer(text, true)` |
| **Notification popup-stt** | `tts_started` envoyé au démarrage | `action: 'tts_started', canInterrupt: true` |

### Frontend (offscreen.js)

| Élément | Vérification | Log attendu |
|---------|--------------|-------------|
| **Variable currentAudio** | Stocke référence Audio | Initialisée en haut du fichier |
| **Handler stop-audio** | Reçoit et traite message | `🟠 [OFFSCREEN] Message reçu: {type: 'stop-audio'}` |
| **Arrêt effectif** | pause() + currentTime=0 | `🟠 [OFFSCREEN] ✅ Audio arrêté` |
| **Notification** | Message `audio-stopped` envoyé | Type `audio-stopped` vers background |

### Backend (reading_agent.py)

| Élément | Vérification | Log attendu |
|---------|--------------|-------------|
| **Démarrage lecture** | Contenu chunké | `📖 Content split into X chunks` |
| **Détection interruption** | Message système dans historique | Check `USER_INTERRUPTED_READING` |
| **Clarification** | LLM répond à la question | `📖 Reading paused for clarification` |
| **Reprise** | Position maintenue et incrémentée | `📖 Resuming reading from chunk X/Y` |
| **État** | `reading_state` conservé | `is_reading=True`, `paused=True/False` |

### Backend (graph_agent.py)

| Élément | Vérification | Log attendu |
|---------|--------------|-------------|
| **Routage READING** | Intent reconnu | Mots-clés: `read`, `lis`, `lecture` |
| **Action reading** | `can_interrupt: true` | Dans `state["action"]` |
| **Node reading** | `_handle_reading` appelé | Délégation à `reading_agent.process()` |

---

## ❌ Problèmes Potentiels et Solutions

### Problème 1 : L'interruption n'est pas détectée

**Symptômes :**
- L'utilisateur parle mais le TTS continue
- Aucun log `[Interruption] Détectée`

**Causes possibles :**
1. La question ne contient pas de mot-clé interrogatif
2. Le microphone n'est pas accessible
3. `webkitSpeechRecognition` n'a pas démarré

**Solutions :**
1. **Vérifier la regex dans popup-stt.js** :
   ```javascript
   // Ligne ~367
   const isQuestion = transcript.toLowerCase().match(/\b(what|who|why|how|when|where|which|qu'est|quoi|comment|pourquoi|c'est quoi)\b/);
   ```
   → Utiliser des questions explicites : "What is X?", "Qu'est-ce que Y?"

2. **Vérifier les permissions micro** :
   - Chrome → Paramètres → Confidentialité → Microphone
   - Autoriser l'extension à accéder au micro

3. **Vérifier les logs de démarrage** :
   ```
   🎤 [Interruption] Écoute active pendant TTS
   ```
   Si absent, la reconnaissance n'a pas démarré.

4. **Tester manuellement** :
   ```javascript
   // Console du popup
   chrome.runtime.sendMessage({
     action: 'interrupt_tts',
     transcript: 'What is artificial intelligence?'
   });
   ```

### Problème 2 : Le TTS ne s'arrête pas immédiatement

**Symptômes :**
- L'interruption est détectée mais l'audio continue
- Log `[Interruption] Détectée` présent mais pas d'arrêt

**Causes possibles :**
1. Message `stop-audio` non reçu par offscreen
2. `currentAudio` est null
3. Timing : l'audio se termine avant l'arrêt

**Solutions :**
1. **Vérifier offscreen.js reçoit le message** :
   ```
   🟠 [OFFSCREEN] Message reçu: {type: 'stop-audio', target: 'offscreen'}
   ```

2. **Vérifier currentAudio** :
   ```javascript
   // Dans offscreen.js, fonction stopAudio()
   if (currentAudio) {
       console.log('🟠 currentAudio existe:', currentAudio);
   } else {
       console.log('⚠️ currentAudio est null !');
   }
   ```

3. **Recharger l'extension** :
   - `chrome://extensions` → Recharger
   - Parfois l'offscreen document est en état incohérent

### Problème 3 : La reprise ne fonctionne pas

**Symptômes :**
- Après "continue", l'agent relit depuis le début
- Ou l'agent dit qu'il n'y a pas de session de lecture active
- Ou l'agent répète le même chunk

**Causes possibles :**
1. `reading_state` réinitialisé entre les appels
2. `current_position` non incrémentée
3. Message système `USER_INTERRUPTED_READING` non reconnu

**Solutions :**
1. **Vérifier reading_state dans les logs backend** :
   ```python
   # Ajouter dans reading_agent.py
   print(f"📖 Reading state: {self.reading_state}")
   ```
   Doit contenir :
   ```python
   {
       "is_reading": True,
       "current_position": 1,  # Doit s'incrémenter
       "content_chunks": [...],
       "paused": True
   }
   ```

2. **Vérifier l'incrémentation** :
   ```python
   # reading_agent.py, _resume_reading()
   self.reading_state["current_position"] += 1
   ```

3. **Vérifier la détection de clarification** :
   ```python
   # reading_agent.py, _is_clarification_request()
   # Doit retourner True si USER_INTERRUPTED_READING dans messages
   ```

### Problème 4 : L'agent ne détecte pas l'intent de lecture

**Symptômes :**
- "Read this article" → Agent répond autre chose
- Pas de log `📖 Reading agent`

**Causes possibles :**
1. Router ne reconnaît pas les mots-clés
2. Intent mal routé vers un autre agent

**Solutions :**
1. **Vérifier le routeur dans graph_agent.py** :
   ```python
   # _route_request()
   if any(keyword in user_message for keyword in ['read', 'lis', 'lecture']):
       return "READING"
   ```

2. **Tester avec différentes formulations** :
   - "Start reading this article"
   - "Lis moi cet article"
   - "Read the content"
   - "Lecture de la page"

3. **Vérifier les logs du router** :
   ```
   🧭 Router: Intent detected = READING
   ```

### Problème 5 : Reconnaissance continue ne relance pas après erreur

**Symptômes :**
- Interruption fonctionne une fois puis plus jamais
- Logs `[Interruption] Écoute terminée` sans relance

**Causes possibles :**
1. Flags `isTTSPlaying` ou `canInterruptTTS` non mis à jour
2. Erreur dans `ttsInterruptionRecognition` qui stoppe définitivement

**Solutions :**
1. **Vérifier les flags dans les logs** :
   ```javascript
   // Ajouter dans popup-stt.js
   console.log('🎤 Flags:', {isTTSPlaying, canInterruptTTS});
   ```

2. **Vérifier la relance dans onend** :
   ```javascript
   // popup-stt.js, ttsInterruptionRecognition.onend
   if (isTTSPlaying && canInterruptTTS) {
       setTimeout(() => {
           if (isTTSPlaying && canInterruptTTS) {
               try {
                   ttsInterruptionRecognition.start();
               } catch (e) {
                   console.warn('Impossible de relancer');
               }
           }
       }, 500);
   }
   ```

3. **Vérifier onerror** :
   ```javascript
   // Doit relancer sauf si 'aborted' ou 'no-speech'
   if (event.error !== 'aborted' && event.error !== 'no-speech') {
       // Relancer
   }
   ```

---

## 🧪 Tests de Régression

### Test 1 : Lecture sans interruption
**Objectif :** Vérifier que la lecture complète fonctionne

1. Demander "Read this article"
2. **Ne PAS interrompre**
3. Laisser lire jusqu'au bout
4. ✅ Vérifier : "I've finished reading the article"
5. ✅ Vérifier : `reading_state.is_reading = False` dans les logs

### Test 2 : Interruption multiple
**Objectif :** Vérifier que l'état est maintenu après plusieurs interruptions

1. Lire article
2. Interrompre avec question 1 (ex: "What is AI?") → Réponse → "Continue"
3. Interrompre avec question 2 (ex: "Why is it important?") → Réponse → "Continue"
4. Laisser terminer la lecture
5. ✅ Vérifier : Position correcte après chaque interruption
6. ✅ Vérifier : Pas de répétition de contenu

### Test 3 : Interruption sans question
**Objectif :** Vérifier que seules les questions interrompent

1. Lire article
2. Dire "Hello" ou "Stop" (sans mot-clé interrogatif)
3. ✅ Vérifier : Lecture continue (pas d'interruption détectée)
4. ✅ Vérifier : Aucun log `❓ Question détectée`

### Test 4 : Nouvel article après lecture
**Objectif :** Vérifier le reset de l'état entre articles

1. Finir la lecture d'un article
2. Ouvrir un nouvel article (nouvelle URL)
3. Demander "Read this article"
4. ✅ Vérifier : Nouvelle session créée
5. ✅ Vérifier : Lecture du nouvel article (pas l'ancien)
6. ✅ Vérifier : `current_position = 0`

### Test 5 : Interruption puis changement d'article
**Objectif :** Vérifier que l'état est correctement réinitialisé

1. Démarrer lecture article A
2. Interrompre avec question → Réponse
3. **Ne PAS dire "continue"**
4. Ouvrir article B
5. Demander "Read this article"
6. ✅ Vérifier : Lecture de l'article B démarre (pas reprise de A)

### Test 6 : Reprise après longue pause
**Objectif :** Vérifier la persistance de l'état

1. Lire article
2. Interrompre avec question → Réponse
3. Attendre **30 secondes**
4. Dire "Continue"
5. ✅ Vérifier : Lecture reprend au bon endroit
6. ⚠️ Note : Si backend timeout (>1h), état perdu (comportement normal)

---

## 📊 Métriques de Succès

Pour considérer le test comme **RÉUSSI**, tous les critères suivants doivent être validés :

### Performance
- [ ] **Démarrage lecture** : < 2 secondes après la commande
- [ ] **Détection interruption** : < 500ms après parole
- [ ] **Arrêt TTS** : < 200ms après détection
- [ ] **Reprise lecture** : < 2 secondes après "continue"

### Fonctionnalité
- [ ] **Chunking** : Contenu divisé en chunks ≈500 caractères
- [ ] **Interruption** : Détection de questions avec mots-clés
- [ ] **Arrêt TTS** : Audio stoppé immédiatement
- [ ] **Clarification** : Réponse pertinente à la question
- [ ] **Reprise** : Lecture reprend au chunk suivant (pas de répétition)
- [ ] **État** : `reading_state` maintenu entre interruptions
- [ ] **Fin** : Message "finished reading" à la fin

### Robustesse
- [ ] **Multi-interruption** : Fonctionne avec 2+ interruptions
- [ ] **Nouvel article** : État correctement réinitialisé
- [ ] **Erreurs** : Reconnaissance audio relancée après erreurs
- [ ] **Logs** : Tous les logs critiques présents

### UX
- [ ] **Fluidité** : Transitions naturelles entre états
- [ ] **Clarté** : Messages vocaux compréhensibles
- [ ] **Feedback** : Utilisateur comprend l'état actuel

---

## 🐛 Debug Avancé

### Vérifier l'état du graphe (Frontend)

Ouvrir la console du service worker (background.js) :
```javascript
chrome.runtime.sendMessage({action: 'get_graph_state'}, (response) => {
  console.log('=== GRAPH STATE ===');
  console.log('Session ID:', response.state.session_id);
  console.log('Messages:', response.state.messages);
  console.log('Last Action:', response.state.last_action);
  console.log('Search Results:', response.state.search_results);
});
```

### Vérifier l'état de lecture (Backend)

Dans `reading_agent.py`, ajouter temporairement :
```python
def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
    print(f"📖 === READING STATE DEBUG ===")
    print(f"📖 is_reading: {self.reading_state['is_reading']}")
    print(f"📖 current_position: {self.reading_state['current_position']}")
    print(f"📖 total_chunks: {len(self.reading_state['content_chunks'])}")
    print(f"📖 paused: {self.reading_state['paused']}")
    print(f"📖 article_url: {self.reading_state['article_url']}")
    print(f"📖 ===========================")
    # ... reste du code
```

### Forcer une interruption (Test manuel frontend)

Console du popup ou service worker :
```javascript
// Simuler une interruption
chrome.runtime.sendMessage({
  action: 'interrupt_tts',
  transcript: 'What is artificial intelligence?'
});
```

### Vérifier les flags d'interruption (popup-stt.js)

Ajouter temporairement dans `startInterruptionListening()` :
```javascript
console.log('🎤 DEBUG FLAGS:', {
  isTTSPlaying,
  canInterruptTTS,
  isMainListening,
  isHotwordActive
});
```

### Tracer le flux complet

Pour suivre une requête de bout en bout, chercher dans les logs :

1. **Frontend (popup-stt.js)** :
   ```
   🛑 [Interruption] Détectée: What is...
   ```

2. **Frontend (background.js)** :
   ```
   🛑 Interruption TTS demandée depuis popup-stt
   📤 Envoi transcription au serveur...
   ```

3. **Backend (pubsub_listener.py)** :
   ```
   📩 Messages reçus: [...USER_INTERRUPTED_READING...]
   ```

4. **Backend (reading_agent.py)** :
   ```
   📖 Reading paused for clarification
   ```

5. **Backend → Frontend (main.py)** :
   ```
   📤 Réponse envoyée avec audio
   ```

6. **Frontend (background.js)** :
   ```
   🔊 Lecture audio...
   ```

---

## 📝 Checklist de Validation

### Avant de tester
- [ ] Backend lancé (`python main.py`)
- [ ] Frontend chargé dans Chrome
- [ ] Microphone autorisé
- [ ] Console ouverte (F12) sur l'onglet de test
- [ ] Console du service worker ouverte (`chrome://extensions` → Inspect)
- [ ] Logs backend visibles dans le terminal

### Phase 1 - Démarrage
- [ ] "Hello AVN" détecté
- [ ] Son "hum" joué
- [ ] "Read this article" reconnu
- [ ] Lecture démarre
- [ ] Log `📖 Content split into X chunks`
- [ ] TTS audio joue
- [ ] Log `🎤 [Interruption] Écoute active`

### Phase 2 - Interruption
- [ ] Question posée pendant TTS
- [ ] Log `🛑 [Interruption] Détectée`
- [ ] TTS stoppé immédiatement
- [ ] Log `🟠 [OFFSCREEN] ✅ Audio arrêté`
- [ ] Log `USER_INTERRUPTED_READING` dans backend
- [ ] Réponse pertinente reçue
- [ ] Agent demande "continue?"

### Phase 3 - Reprise
- [ ] "Continue" reconnu
- [ ] Log `📖 Resuming reading from chunk X/Y`
- [ ] Lecture reprend au chunk suivant
- [ ] Pas de répétition de contenu
- [ ] Écoute d'interruption réactivée

### Tests de régression
- [ ] Lecture complète sans interruption
- [ ] Interruptions multiples (2+)
- [ ] Interruption sans question (pas d'arrêt)
- [ ] Nouvel article (reset état)

### Validation finale
- [ ] Toutes les métriques de performance respectées
- [ ] Toutes les fonctionnalités validées
- [ ] Aucun crash ou erreur bloquante
- [ ] UX fluide et naturelle

---

## 🎓 Notes Techniques

### Mots-Clés d'Interruption

**Regex utilisée dans popup-stt.js :**
```javascript
const isQuestion = transcript.toLowerCase().match(/\b(what|who|why|how|when|where|which|qu'est|quoi|comment|pourquoi|c'est quoi)\b/);
```

**Anglais :** what, who, why, how, when, where, which  
**Français :** qu'est, quoi, comment, pourquoi, c'est quoi

Pour ajouter d'autres langues, modifier la regex :
```javascript
const isQuestion = transcript.toLowerCase().match(/\b(nouveaux|mots|clés|ici)\b/);
```

### Flags Critiques

| Flag | Fichier | Rôle | Valeurs |
|------|---------|------|---------|
| `isTTSPlaying` | popup-stt.js | TTS en cours | true/false |
| `canInterruptTTS` | popup-stt.js | Écoute d'interruption active | true/false |
| `ttsState.canInterrupt` | background.js | Transmis depuis backend | true/false |
| `ttsState.isPlaying` | background.js | Audio en cours | true/false |
| `reading_state.is_reading` | reading_agent.py | Session active | True/False |
| `reading_state.paused` | reading_agent.py | Lecture en pause | True/False |
| `reading_state.current_position` | reading_agent.py | Position chunk | 0 à N-1 |

### Messages Chrome Runtime

| Action | Émetteur | Récepteur | Payload |
|--------|----------|-----------|---------|
| `tts_started` | background.js | popup-stt.js | `{canInterrupt: bool}` |
| `tts_finished` | background.js | popup-stt.js | `{}` |
| `interrupt_tts` | popup-stt.js | background.js | `{transcript: string}` |
| `stop-audio` | background.js | offscreen.js | `{}` |
| `audio-stopped` | offscreen.js | background.js | `{}` |
| `audio-playback-finished` | offscreen.js | background.js | `{}` |

### Structure reading_state

```python
self.reading_state = {
    "is_reading": False,        # Session de lecture active
    "article_url": None,         # URL de l'article en cours
    "article_title": None,       # Titre de l'article
    "current_position": 0,       # Index du chunk actuel (0 à N-1)
    "content_chunks": [],        # Liste des chunks de texte
    "paused": False              # Lecture en pause (interruption)
}
```

### Cycle de Vie d'une Session

```
START
  ↓
_start_reading()
  ├─ Extract content from page_context
  ├─ Split into chunks (~500 chars)
  ├─ Set is_reading = True, current_position = 0
  └─ Return chunk 0 + can_interrupt=True
  ↓
[USER LISTENS] (ttsInterruptionRecognition active)
  ↓
[USER INTERRUPTS] "What is X?"
  ↓
_handle_clarification()
  ├─ Set paused = True
  ├─ LLM answers question with article context
  └─ Ask "Continue?"
  ↓
[USER RESPONDS] "Continue"
  ↓
_resume_reading()
  ├─ current_position += 1
  ├─ Set paused = False
  └─ Return chunk N + can_interrupt=True
  ↓
[REPEAT until current_position >= len(chunks)]
  ↓
FINISH
  ├─ Set is_reading = False
  └─ Return "finished reading"
```

---

## ✅ Validation Finale

**Date du test :** ___________  
**Testeur :** ___________  
**Version :** dev  
**Commit :** ___________

**Résultat :** [ ] ✅ PASS  |  [ ] ❌ FAIL

**Environnement :**
- OS : ___________
- Chrome version : ___________
- Backend Python version : ___________

**Tests réussis :**
- [ ] Phase 1 : Démarrage de la lecture
- [ ] Phase 2 : Interruption pendant la lecture
- [ ] Phase 3 : Reprise de la lecture
- [ ] Tests de régression (tous)

**Commentaires / Bugs rencontrés :**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

**Suggestions d'amélioration :**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________
