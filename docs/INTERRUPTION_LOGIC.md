# Logique d'Interruption Simplifiée

## Vue d'ensemble

La logique d'interruption est maintenant simple et fluide, basée sur **deux critères principaux** :
1. **Durée de l'audio** : Détermine si l'utilisateur peut interrompre
2. **Type d'action** : Détermine si la reprise automatique est activée

---

## 🎯 Règles Principales

### 1. Interruption Vocale (Frontend)

**Condition d'activation** :
- Audio > 10 secondes → Interruption **ACTIVÉE** ✅
- Audio ≤ 10 secondes → Interruption **DÉSACTIVÉE** ❌

**Basé sur** : Estimation du nombre de mots dans `data.text`
- Formule : `durée = nombre_de_mots / 2.5`
- Exemple : 30 mots → 12 secondes → Interruptible

**Fichier** : `background.js`
```javascript
const estimatedDuration = estimateAudioDuration(data.text);
canInterrupt = estimatedDuration > 10;
```

### 2. Reprise Automatique (Offscreen)

**Condition d'activation** :
- Action de type `reading` ou `clarification` → Reprise **ACTIVÉE** ✅
- Autres actions → Reprise **DÉSACTIVÉE** ❌

**Comportement** :
1. L'utilisateur interrompt pendant une lecture
2. Le système répond à la clarification (court audio)
3. **Timer de 4 secondes** démarre après la clarification
4. Si l'utilisateur ne parle pas → **Reprise automatique** de la lecture
5. Si l'utilisateur parle → **Annulation** de la reprise

**Fichier** : `offscreen.js`
```javascript
if (wasPaused && isReading) {
    startSilenceTimer();  // 4 secondes
}
```

---

## 📊 Flux de Communication

### Scénario 1 : Lecture Simple (sans interruption)

```
1. User: "Read this article"
2. Backend → action.type = "reading", action.is_reading_action = true
3. Frontend: durée = 45s → canInterrupt = true
4. Offscreen: isReading = true
5. User écoute jusqu'à la fin
6. Audio terminé → Pas de reprise (pas d'interruption)
```

### Scénario 2 : Lecture avec Clarification

```
1. User: "Read this article"
2. Backend → action.type = "reading", action.is_reading_action = true
3. Frontend: durée = 45s → canInterrupt = true
4. Offscreen: isReading = true, audio en cours
5. User: "What is quantum physics?" (interruption vocale)
6. Frontend: stopTTSImmediate() → pause-audio
7. Offscreen: pausedAudio sauvegardé avec isReading = true
8. Backend détecte la question → action.type = "clarification"
9. Frontend: nouvelle réponse courte (5s)
10. Offscreen: audio clarification terminé → Timer 4s
11. Après 4s de silence → resumeAudio()
12. Lecture reprend automatiquement
```

### Scénario 3 : Autre Action (pas de reprise)

```
1. User: "Search for AI news"
2. Backend → action.type = "search"
3. Frontend: durée = 8s → canInterrupt = false
4. Offscreen: isReading = false
5. User écoute obligatoirement jusqu'à la fin
6. Audio terminé → Pas de reprise
```

---

## 🔧 Variables d'État

### Backend (`graph_agent.py`, `reading_agent.py`)

| Variable | Type | Usage |
|----------|------|-------|
| `action.type` | string | Type d'action : `reading`, `clarification`, `search`, etc. |
| `action.is_reading_action` | boolean | Flag pour activer la reprise automatique |

### Frontend (`background.js`)

| Variable | Type | Usage |
|----------|------|-------|
| `ttsState.canInterrupt` | boolean | L'utilisateur peut-il interrompre l'audio ? |
| `ttsState.isPlaying` | boolean | Un audio est-il en cours de lecture ? |
| `ttsState.currentAction` | object | Action en cours (pour debug) |

### Offscreen (`offscreen.js`)

| Variable | Type | Usage |
|----------|------|-------|
| `isReading` | boolean | Sommes-nous en mode lecture ? |
| `pausedAudio` | Audio | Audio en pause (pour reprise) |
| `pausedTime` | number | Position de l'audio pausé |
| `silenceTimer` | Timeout | Timer de 4s pour la reprise |

### Popup STT (`popup-stt.js`)

| Variable | Type | Usage |
|----------|------|-------|
| `isTTSPlaying` | boolean | TTS en cours ? |
| `canInterruptTTS` | boolean | Interruption possible ? |
| `currentMode` | string | `hotword`, `active`, ou `interruption` |

---

## 🎤 Détection d'Interruption (Popup STT)

### Critères de Validation

Pour qu'une interruption soit acceptée :

1. **TTS doit être en cours** : `isTTSPlaying === true`
2. **Interruption doit être activée** : `canInterruptTTS === true`
3. **Parole suffisamment longue** :
   - Durée > 800ms **OU**
   - Nombre de mots ≥ 3

### Anti-bruit

```javascript
const MIN_SPEECH_DURATION = 800;  // ms
const MIN_CONFIDENCE = 0.6;       // 60% de confiance minimum
```

Ces seuils évitent les faux positifs (toux, bruits ambiants).

---

## 🔄 Gestion des Modes (Popup STT)

| Mode | Description | Transitions |
|------|-------------|-------------|
| `hotword` | Attente du mot-clé "hello" | → `active` (après "hello") |
| `active` | Écoute des commandes | → `interruption` (si TTS long) |
| `interruption` | Peut interrompre l'audio | → `active` (après interruption) |

---

## 🧪 Tests à Effectuer

### Test 1 : Audio Long (> 10s)
- ✅ Bouton d'interruption visible
- ✅ Interruption vocale fonctionne
- ✅ Feedback sonore "hum" après interruption

### Test 2 : Audio Court (≤ 10s)
- ✅ Pas de bouton d'interruption
- ✅ Interruption vocale désactivée
- ✅ L'utilisateur doit attendre la fin

### Test 3 : Lecture avec Clarification
1. ✅ Démarrer une lecture (> 10s)
2. ✅ Interrompre avec une question
3. ✅ Recevoir une réponse courte
4. ✅ Attendre 4 secondes
5. ✅ Lecture reprend automatiquement

### Test 4 : Annulation de la Reprise
1. ✅ Démarrer une lecture
2. ✅ Interrompre avec une question
3. ✅ Recevoir une réponse
4. ✅ Parler AVANT les 4 secondes
5. ✅ Reprise annulée

---

## 📝 Notes Importantes

### Backend
- Le router gère les clarifications naturellement (mots-clés de questions)
- Pas de flag `was_interrupted` nécessaire
- L'état de lecture est géré dans `ReadingAgent.reading_state`

### Frontend
- Estimation basique mais efficace : `wordCount / 2.5`
- Pas de gestion complexe d'états intermédiaires
- Les flags sont transmis via les actions du backend

### Offscreen
- Un seul flag global : `isReading`
- Le timer de reprise n'est activé QUE pour les lectures
- La reprise est annulée si l'utilisateur parle

---

## 🐛 Dépannage

### L'interruption ne fonctionne pas
- Vérifier que `canInterrupt = true` dans les logs
- Vérifier la durée estimée de l'audio (> 10s ?)
- Vérifier que le micro détecte bien la parole

### La reprise ne s'active pas
- Vérifier que `isReading = true` dans offscreen
- Vérifier que `action.type = "reading"` dans le backend
- Vérifier que le timer de 4s n'est pas annulé

### La reprise s'active alors qu'elle ne devrait pas
- Vérifier que l'action n'est PAS de type `reading`
- Vérifier que `isReading = false` dans offscreen

---

## 🚀 Améliorations Futures

1. **Durée d'interruption dynamique** : Ajuster le seuil selon le type de contenu
2. **Timer de reprise personnalisable** : 4s par défaut, mais ajustable
3. **Feedback visuel** : Indicateur de reprise imminente
4. **Sauvegarde de position** : Reprendre exactement où on était dans l'article
