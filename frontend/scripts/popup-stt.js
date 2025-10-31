// popup-stt.js
let isRecording = false;
// state flags for external queries
let isHotwordActive = false;
let isMainListening = false;
let hotwordUsed = false; // flag pour savoir si le hotword a déjà été utilisé
let waitingForTTS = false; // flag pour indiquer qu'on attend le TTS
let inactivityCount = 0; // compteur de cycles sans parole
const MAX_INACTIVITY = 3; // nombre max de cycles sans parole avant de revenir au hotword

// ✅ Variables pour gérer l'interruption pendant TTS
let isTTSPlaying = false;
let canInterruptTTS = false;
let ttsInterruptionRecognition = null;

/* Jouer le son "hum" avec synthèse vocale */
function playHumSound() {
    try {
        const utterance = new SpeechSynthesisUtterance('hum');
        utterance.rate = 1.2;
        utterance.pitch = 0.8;
        utterance.volume = 0.5;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('playHumSound failed', e);
        // fallback au bip si TTS échoue
        playBeep(120, 700);
    }
}

/* Notifier l'utilisateur vocalement */
function speakMessage(text) {
    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.7;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('speakMessage failed', e);
    }
}


/**
 * @returns {Promise<string>} - Texte transcrit ou null
 */
async function recognizeSpeech() {
    return new Promise((resolve, reject) => {
        console.log('recognizeSpeech() called');
        if (!('webkitSpeechRecognition' in window)) {
            return reject(new Error('Web Speech API non supportée'));
        }

        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let recognitionTimeout = null;
        const TIMEOUT_MS = 8000;
        let speechStarted = false;
        let hasResult = false;

        recognition.onstart = () => {
            console.log('recognizeSpeech.onstart');
            isMainListening = true;
            const stateMsg = { action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening };
            chrome.runtime.sendMessage(stateMsg).catch(() => { });
            try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: stateMsg })); } catch (e) { }

            recognitionTimeout = setTimeout(() => {
                if (!speechStarted) {
                    try { recognition.stop(); } catch (e) { }
                    isMainListening = false;
                    chrome.runtime.sendMessage({ action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening }).catch(() => { });
                    resolve(null);
                }
            }, TIMEOUT_MS);
        };

        recognition.onspeechstart = () => {
            speechStarted = true;
            if (recognitionTimeout) {
                clearTimeout(recognitionTimeout);
                recognitionTimeout = null;
            }
            console.log('recognizeSpeech.onspeechstart');
        };

        recognition.onspeechend = () => {
            console.log('recognizeSpeech.onspeechend - fin de parole détectée');
            recognitionTimeout = setTimeout(() => {
                try { recognition.stop(); } catch (e) { }
            }, 1500);
        };

        recognition.onresult = (event) => {
            if (recognitionTimeout) { clearTimeout(recognitionTimeout); recognitionTimeout = null; }
            hasResult = true;
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            console.log('recognizeSpeech.onresult ->', transcript);
            isMainListening = false;
            chrome.runtime.sendMessage({ action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening }).catch(() => { });
            try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }
            resolve(transcript);
        };

        recognition.onerror = (event) => {
            if (recognitionTimeout) { clearTimeout(recognitionTimeout); recognitionTimeout = null; }
            console.warn('recognizeSpeech.onerror', event.error);
            isMainListening = false;
            chrome.runtime.sendMessage({ action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening }).catch(() => { });
            try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }
            if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'not-allowed') {
                return resolve(null);
            }
            reject(new Error(event.error || 'unknown'));
        };

        recognition.onend = () => {
            console.log('recognizeSpeech.onend, hasResult:', hasResult);
            if (recognitionTimeout) { clearTimeout(recognitionTimeout); recognitionTimeout = null; }
            isMainListening = false;
            chrome.runtime.sendMessage({ action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening }).catch(() => { });
            try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }

            // Si aucun résultat n'a été reçu, résoudre avec null
            if (!hasResult) {
                resolve(null);
            }
        };

        try {
            recognition.start();
        } catch (err) {
            if (recognitionTimeout) { clearTimeout(recognitionTimeout); recognitionTimeout = null; }
            isMainListening = false;
            chrome.runtime.sendMessage({ action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening });
            reject(err);
        }
    });
}

let recognitionTimeout;


// Écoute les requêtes du background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ✅ Message quand le TTS commence (pour activer l'écoute d'interruption)
    if (message && message.action === 'tts_started') {
        console.log('🔊 TTS démarré, canInterrupt:', message.canInterrupt);
        isTTSPlaying = true;
        canInterruptTTS = message.canInterrupt || false;

        console.log(`🔊 État après réception: isTTSPlaying=${isTTSPlaying}, canInterruptTTS=${canInterruptTTS}`);

        // Lancer/arrêter l'écoute d'interruption en fonction du flag
        if (canInterruptTTS) {
            console.log('🎧 TTS interrompable — démarrage écoute d\'interruption');
            startInterruptionListening();
        } else {
            console.log('🔊 TTS non-interrompable — arrêt écoute d\'interruption');
            // s'assurer qu'aucune écoute d'interruption ne tourne
            stopInterruptionListening();
        }

        sendResponse({ ok: true });
        return true;
    }

    // Message envoyé par le background quand le TTS est terminé
    if (message && message.action === 'tts_finished') {
        console.log('✅ TTS terminé, reprise de la reconnaissance principale');
        isTTSPlaying = false;
        canInterruptTTS = false;
        stopInterruptionListening();

        waitingForTTS = false;
        inactivityCount = 0; // reset le compteur après une réponse réussie
        // relancer l'écoute principale directement (pas le hotword)
        playHumSound();
        setTimeout(() => {
            startMainRecognitionLoop();
        }, 800); // délai pour laisser le "hum" se jouer
        sendResponse({ ok: true });
        return true;
    }

    // Nouveau : demande de confirmation après clarification
    if (message && message.action === 'clarification_prompt') {
        console.log('📣 Demande de confirmation après clarification reçue');
        // Lancer une écoute courte pour capter "oui" ou nouvelle question
        startConfirmationListening();
        sendResponse({ ok: true });
        return true;
    }
});

// Allow popup (or other parts) to query recording state for hotword and main listening
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'get_recording_state') {
        sendResponse({ hotwordActive: !!isHotwordActive, mainListening: !!isMainListening });
        return true;
    }
});

// Fonction pour démarrer le cycle de reconnaissance principal (sans hotword)
function startMainRecognitionLoop() {
    if (waitingForTTS || isMainListening) {
        console.log('Reconnaissance déjà en cours ou attente TTS');
        return;
    }

    // Vérifier l'inactivité
    if (inactivityCount >= MAX_INACTIVITY) {
        console.log('Trop d\'inactivité, retour au hotword');
        speakMessage('I\'m going back to sleep. Say hello AVN to wake me up.');
        inactivityCount = 0;
        hotwordUsed = false; // réinitialiser pour relancer le hotword
        setTimeout(() => {
            startHotwordListening();
        }, 2000); // délai pour laisser le message se jouer
        return;
    }

    recognizeSpeech().then(transcript => {
        if (transcript && transcript.trim().length > 0) {
            console.log('Transcription envoyée:', transcript);
            inactivityCount = 0; // reset si parole détectée
            waitingForTTS = true;
            chrome.runtime.sendMessage({ action: 'content_recognition_result', transcript });
            // Le background enverra 'tts_finished' quand le TTS sera terminé
        } else {
            console.log('Aucune transcription, compteur inactivité:', inactivityCount + 1);
            inactivityCount++;
            // Relancer après un court délai
            setTimeout(() => startMainRecognitionLoop(), 500);
        }
    }).catch(err => {
        console.error('Erreur reconnaissance:', err);
        inactivityCount++;
        // En cas d'erreur, relancer après un délai
        setTimeout(() => startMainRecognitionLoop(), 1000);
    });
}

function startHotwordListening() {
    if (!('webkitSpeechRecognition' in window)) {
        console.error('Web Speech API non supportée');
        return;
    }

    // Si le hotword est déjà actif, ne pas relancer
    if (isHotwordActive) {
        console.log('Hotword déjà actif');
        return;
    }

    const hotwordRec = new webkitSpeechRecognition();
    hotwordRec.lang = 'en-US';
    hotwordRec.continuous = true;
    hotwordRec.interimResults = true;

    hotwordRec.onstart = () => {
        isHotwordActive = true;
        const stateHotStart = { action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening };
        chrome.runtime.sendMessage(stateHotStart).catch(() => { });
        try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }
        console.log('[Hotword] En écoute permanente...');
    };

    hotwordRec.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        console.log('[Hotword] Résultat:', text);
        const fullHotword = text.includes('hello avn') || text.includes('hey avn') ||
            (text.includes('hello') && text.includes('avn')) ||
            (text.includes('hey') && text.includes('avn')) || (text.includes('hello'));

        if (fullHotword && !isMainListening) {
            console.log('[Hotword] Détecté ! Passage en mode reconnaissance principale');
            hotwordUsed = true; // marquer que le hotword a été utilisé
            try { hotwordRec.stop(); } catch (e) { }
            isHotwordActive = false;
            const stateHotDetected = { action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening };
            chrome.runtime.sendMessage(stateHotDetected).catch(() => { });
            try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }
        }
    };

    hotwordRec.onerror = (event) => {
        console.warn('[Hotword] Erreur:', event.error);

        // Ignorer l'erreur 'aborted' qui est normale quand on stoppe manuellement
        if (event.error === 'aborted') {
            return;
        }

        isHotwordActive = false;
        const stateHotErr = { action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening };
        chrome.runtime.sendMessage(stateHotErr).catch(() => { });
        try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }

        try { hotwordRec.stop(); } catch (e) { }

        // Relancer uniquement si pas de permission denied et si le hotword n'a pas été utilisé
        if (event.error !== 'not-allowed' && !hotwordUsed) {
            console.log('[Hotword] Relance après erreur dans 2s');
            setTimeout(() => {
                if (!hotwordUsed && !isHotwordActive) {
                    try { hotwordRec.start(); } catch (e) {
                        console.warn('[Hotword] Impossible de relancer:', e);
                    }
                }
            }, 2000);
        }
    };

    hotwordRec.onend = () => {
        isHotwordActive = false;
        const stateHotEnd = { action: 'recording_state_changed', hotwordActive: isHotwordActive, mainListening: isMainListening };
        chrome.runtime.sendMessage(stateHotEnd).catch(() => { });
        try { window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: { hotwordActive: isHotwordActive, mainListening: isMainListening } })); } catch (e) { }
        console.log('[Hotword] Arrêt');

        if (hotwordUsed) {
            // Hotword détecté, démarrer le cycle de reconnaissance principale
            playHumSound();
            setTimeout(() => {
                startMainRecognitionLoop();
            }, 800);
        } else {
            // Arrêt non intentionnel, relancer si nécessaire
            console.log('[Hotword] Arrêt non intentionnel, relance dans 1s');
            setTimeout(() => {
                if (!hotwordUsed && !isHotwordActive && !isMainListening) {
                    try { hotwordRec.start(); } catch (e) {
                        console.warn('[Hotword] Impossible de relancer:', e);
                    }
                }
            }, 1000);
        }
    };

    try {
        hotwordRec.start();
    } catch (e) {
        console.error('[Hotword] Impossible de démarrer:', e);
        isHotwordActive = false;
    }
}

// expose getter synchrone pour popup
window.getRecordingState = () => ({
    hotwordActive: !!isHotwordActive,
    mainListening: !!isMainListening
});


// ✅ Fonction pour démarrer l'écoute d'interruption pendant le TTS
function startInterruptionListening() {
    if (!('webkitSpeechRecognition' in window)) {
        console.error('Web Speech API non supportée');
        return;
    }

    // Arrêter l'écoute précédente si elle existe
    stopInterruptionListening();

    ttsInterruptionRecognition = new webkitSpeechRecognition();
    ttsInterruptionRecognition.lang = 'en-US';
    ttsInterruptionRecognition.continuous = true;
    ttsInterruptionRecognition.interimResults = false;

    ttsInterruptionRecognition.onstart = () => {
        console.log('🎤 [Interruption] Écoute active pendant TTS');

        // ✅ Notifier l'UI que l'interruption est possible
        const stateMsg = {
            action: 'recording_state_changed',
            hotwordActive: false,
            mainListening: false,
            canInterrupt: true  // ✅ Nouveau flag
        };
        chrome.runtime.sendMessage(stateMsg).catch(() => { });
        try {
            window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: stateMsg }));
        } catch (e) { }
    };

    ttsInterruptionRecognition.onresult = (event) => {
        if (!isTTSPlaying || !canInterruptTTS) {
            return;
        }

        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        console.log('🛑 [Interruption] Détectée:', transcript);

        // Vérifier si c'est une question (heuristique simple)
        const isQuestion = transcript.toLowerCase().match(/\b(what|who|why|how|when|where|which|qu'est|quoi|comment|pourquoi|c'est quoi)\b/);

        if (isQuestion) {
            console.log('❓ Question détectée pendant la lecture, interruption...');

            // Arrêter le TTS
            chrome.runtime.sendMessage({
                action: 'interrupt_tts',
                transcript: transcript
            }).catch(() => { });

            // Arrêter l'écoute d'interruption
            stopInterruptionListening();
            isTTSPlaying = false;
            canInterruptTTS = false;
        }
    };

    ttsInterruptionRecognition.onerror = (event) => {
        console.warn('🎤 [Interruption] Erreur:', event.error);

        if (event.error === 'aborted' || event.error === 'no-speech') {
            return;
        }

        // Relancer si toujours en mode TTS
        if (isTTSPlaying && canInterruptTTS) {
            setTimeout(() => {
                if (isTTSPlaying && canInterruptTTS) {
                    try {
                        ttsInterruptionRecognition.start();
                    } catch (e) {
                        console.warn('Impossible de relancer l\'écoute d\'interruption');
                    }
                }
            }, 1000);
        }
    };

    ttsInterruptionRecognition.onend = () => {
        console.log('🎤 [Interruption] Écoute terminée');

        // Relancer si toujours en mode TTS
        if (isTTSPlaying && canInterruptTTS) {
            setTimeout(() => {
                if (isTTSPlaying && canInterruptTTS) {
                    try {
                        ttsInterruptionRecognition.start();
                    } catch (e) {
                        console.warn('Impossible de relancer l\'écoute d\'interruption');
                    }
                }
            }, 500);
        }
    };

    try {
        ttsInterruptionRecognition.start();
    } catch (e) {
        console.error('🎤 [Interruption] Impossible de démarrer:', e);
    }
}

// ✅ Fonction pour arrêter l'écoute d'interruption
function stopInterruptionListening() {
    if (ttsInterruptionRecognition) {
        try {
            ttsInterruptionRecognition.stop();
        } catch (e) {
            console.warn('Erreur arrêt écoute interruption:', e);
        }
        ttsInterruptionRecognition = null;

        // ✅ Notifier l'UI que l'interruption n'est plus possible
        const stateMsg = {
            action: 'recording_state_changed',
            hotwordActive: false,
            mainListening: false,
            canInterrupt: false
        };
        chrome.runtime.sendMessage(stateMsg).catch(() => { });
        try {
            window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: stateMsg }));
        } catch (e) { }
    }
}

// Fonction d'écoute dédiée à la confirmation (oui/non ou nouvelle question)
function startConfirmationListening() {
    if (!('webkitSpeechRecognition' in window)) {
        console.error('Web Speech API non supportée pour confirmation');
        return;
    }

    console.log('🔎 [Confirmation] Démarrage écoute confirmation...');

    const confRec = new webkitSpeechRecognition();
    confRec.lang = 'en-US';
    confRec.continuous = false;
    confRec.interimResults = false;
    confRec.maxAlternatives = 1;

    let hasResult = false;
    let confTimeout = null;

    confRec.onstart = () => {
        console.log('🔎 [Confirmation] ✅ Écoute en cours pour réponse oui/non ou nouvelle question');

        // Notifier UI
        const stateMsg = {
            action: 'recording_state_changed',
            hotwordActive: false,
            mainListening: true,  // ✅ Indiquer qu'on écoute
            canInterrupt: false
        };
        chrome.runtime.sendMessage(stateMsg).catch(() => { });
        try {
            window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: stateMsg }));
        } catch (e) { }

        // ✅ Timeout de sécurité (10 secondes)
        confTimeout = setTimeout(() => {
            if (!hasResult) {
                console.warn('🔎 [Confirmation] ⏱️ Timeout - reprise auto de l\'audio');
                try { confRec.stop(); } catch (e) { }
                chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
            }
        }, 10000);
    };

    confRec.onresult = (event) => {
        if (confTimeout) {
            clearTimeout(confTimeout);
            confTimeout = null;
        }

        hasResult = true;
        const transcript = event.results[0][0].transcript.trim();
        console.log('🔎 [Confirmation] ✅ Résultat reçu:', transcript);

        if (!transcript || transcript.length === 0) {
            console.warn('🔎 [Confirmation] ⚠️ Transcription vide - reprise audio');
            chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
            return;
        }

        const lower = transcript.toLowerCase();

        // Détecter réponse positive (oui)
        const yesPatterns = /\b(yes|oui|resume|yep|yeah|correct|ok|okay|sure|d'accord|continue|go ahead)\b/i;

        if (lower.match(yesPatterns)) {
            console.log('🔎 [Confirmation] ✅ Utilisateur satisfait -> reprise audio principal');
            chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
            chrome.runtime.sendMessage({
                action: 'update_status',
                data: '✅ Reprise de la lecture principale...'
            }).catch(() => { });
        } else {
            // Considérer tout autre réponse comme nouvelle question / follow-up
            console.log('🔎 [Confirmation] ❓ Nouvelle question détectée:', transcript);
            chrome.runtime.sendMessage({
                action: 'clarification_followup',
                transcript: transcript
            }).catch(() => { });
            chrome.runtime.sendMessage({
                action: 'update_status',
                data: `⏳ Envoi de votre question...`
            }).catch(() => { });
        }
    };

    confRec.onerror = (e) => {
        if (confTimeout) {
            clearTimeout(confTimeout);
            confTimeout = null;
        }

        console.warn('🔎 [Confirmation] ❌ Erreur reconnaissance:', e.error);

        // Si no-speech ou aborted, reprendre l'audio
        if (e.error === 'no-speech' || e.error === 'aborted') {
            console.log('🔎 [Confirmation] Pas de parole détectée - reprise audio');
            chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
        } else {
            console.error('🔎 [Confirmation] Erreur fatale - reprise audio');
            chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
        }
    };

    confRec.onend = () => {
        if (confTimeout) {
            clearTimeout(confTimeout);
            confTimeout = null;
        }

        console.log('🔎 [Confirmation] Fin écoute confirmation');

        // Si aucun résultat n'a été reçu, reprendre l'audio par sécurité
        if (!hasResult) {
            console.log('🔎 [Confirmation] Aucun résultat - reprise audio par défaut');
            chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
        }
    };

    try {
        confRec.start();
        console.log('🔎 [Confirmation] Reconnaissance démarrée avec succès');
    } catch (e) {
        console.error('🔎 [Confirmation] ❌ Impossible de démarrer la reconnaissance:', e);
        // fallback: reprendre audio si impossible
        chrome.runtime.sendMessage({ action: 'resume_audio' }).catch(() => { });
    }
}
