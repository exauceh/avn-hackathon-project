let globalRecognition = null;
let isListening = false;
let currentMode = 'active'; // hotword,active, interruption,confirmation
let waitingForTTS = false;
let inactivityCount = 0;
let isTTSPlaying = false;
let canInterruptTTS = false;
let speechStarted = false;
let lastTranscript = '';
let interimTimeout = null;
let lastCommandTime = 0;
let processingCommand = false;

const MAX_INACTIVITY = 3;
const MIN_COMMAND_INTERVAL = 1000;

function playHumSound() {
    try {
        const utterance = new SpeechSynthesisUtterance('hum');
        utterance.rate = 1.2;
        utterance.pitch = 0.8;
        utterance.volume = 0.5;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('playHumSound failed', e);
    }
}

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

function stopTTSImmediate() {
    if (isTTSPlaying && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'pause-audio' }).catch(() => { });
}


function notifyRecordingState() {
    const state = {
        action: 'recording_state_changed',
        mode: currentMode,
        isListening: isListening,
        isTTSPlaying: isTTSPlaying,
        canInterrupt: canInterruptTTS
    };
    chrome.runtime.sendMessage(state).catch(() => { });
    try {
        window.dispatchEvent(new CustomEvent('recording_state_changed', { detail: state }));
    } catch (e) { }
}

function initializeGlobalRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        console.error('Web Speech API non supportée');
        return;
    }

    if (globalRecognition) {
        try {
            globalRecognition.stop();
        } catch (e) { }
    }

    globalRecognition = new webkitSpeechRecognition();
    globalRecognition.lang = 'en-US';
    globalRecognition.continuous = true;
    globalRecognition.interimResults = true;
    globalRecognition.maxAlternatives = 1;

    globalRecognition.onstart = () => {
        isListening = true;
        notifyRecordingState();
        console.log(`🎙️ Écoute démarrée - Mode: ${currentMode}`);
    };

    globalRecognition.onspeechstart = () => {
        speechStarted = true;
        console.log('🗣️ Parole détectée');

        // Interruption immédiate du TTS dès que l'utilisateur parle
        if (isTTSPlaying && (canInterruptTTS || currentMode === 'interruption')) {
            console.log('🛑 Utilisateur parle - Interruption TTS immédiate');
            stopTTSImmediate();

            // Feedback audio rapide
            setTimeout(() => playHumSound(), 50);

            // Basculer en mode active pour capturer la commande
            if (currentMode === 'interruption') {
                currentMode = 'active';
                notifyRecordingState();
            }
        }

        if (interimTimeout) {
            clearTimeout(interimTimeout);
            interimTimeout = null;
        }
    };

    globalRecognition.onspeechend = () => {
        speechStarted = false;
    };

    globalRecognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;

        console.log(`📝 ${isFinal ? 'Final' : 'Interim'}: "${transcript}" (Mode: ${currentMode}, Conf: ${confidence?.toFixed(2) || 'N/A'})`);

        // Clear previous timeout
        if (interimTimeout) {
            clearTimeout(interimTimeout);
            interimTimeout = null;
        }

        if (currentMode === 'hotword') {
            // Détection immédiate du hotword même en interim
            const isHotword = transcript.toLowerCase().includes('hello');
            if (isHotword) {
                console.log('🔥 Hotword détecté!');
                lastTranscript = '';
                currentMode = 'active';
                inactivityCount = 0;
                waitingForTTS = false;
                playHumSound();
                notifyRecordingState();
            }
        } else if (currentMode === 'active') {
            // Utiliser les résultats intermédiaires pour détecter plus vite
            if (isFinal && transcript.length > 0) {
                handleActiveCommand(transcript);
            } else if (!isFinal && transcript.length > 10) {
                // Mettre à jour l'UI avec le transcript en cours
                chrome.runtime.sendMessage({
                    action: 'update_status',
                    data: `⏳ "${transcript}..."`
                }).catch(() => { });
            }
        } else if (currentMode === 'interruption') {
            // Réagir plus rapidement aux interruptions
            if (isFinal && transcript.length > 0) {
                handleInterruption(transcript);
            } else if (!isFinal && transcript.length > 5) {
                // Afficher un feedback immédiat
                chrome.runtime.sendMessage({
                    action: 'update_status',
                    data: `✋ "${transcript}..."`
                }).catch(() => { });
            }
        } else if (currentMode === 'confirmation') {
            if (isFinal && transcript.length > 0) {
                handleConfirmation(transcript);
            }
        }

        lastTranscript = transcript;
    };

    globalRecognition.onerror = (event) => {
        console.warn('⚠️ Erreur reconnaissance:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            isListening = false;
            notifyRecordingState();
            speakMessage('Microphone access denied. Please enable it in your browser settings.');
            return;
        }

        // Gérer l'inactivité seulement en mode actif
        if (event.error === 'no-speech' && currentMode === 'active' && !waitingForTTS) {
            inactivityCount++;
            console.log(`⏳ Inactivité: ${inactivityCount}/${MAX_INACTIVITY}`);

            if (inactivityCount >= MAX_INACTIVITY) {
                speakMessage('Going back to sleep. Say hello to wake me up.');
                currentMode = 'hotword';
                inactivityCount = 0;
                notifyRecordingState();
            }
        }

        // Auto-restart sur erreur non critique
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture') {
            setTimeout(() => restartRecognition(), 500);
        }
    };

    globalRecognition.onend = () => {
        console.log('🔄 Reconnaissance terminée - Redémarrage...');
        isListening = false;
        notifyRecordingState();

        // Toujours redémarrer sauf si explicitement arrêté
        setTimeout(() => restartRecognition(), 300);
    };

    return globalRecognition;
}

function restartRecognition() {
    if (!globalRecognition || isListening) return;

    try {
        globalRecognition.start();
    } catch (e) {
        console.warn('Reconnaissance déjà active:', e);
    }
}

function handleActiveCommand(transcript) {
    // ✅ Filtrer le hotword
    const isHotword = transcript.toLowerCase().includes('hello');
    if (isHotword) {
        console.log('🔥 Hotword détecté dans commande active - Ignoré');
        playHumSound();
        return;
    }

    // Éviter les commandes en double
    const now = Date.now();
    if (processingCommand || (now - lastCommandTime) < MIN_COMMAND_INTERVAL) {
        console.log('⏸️ Commande ignorée (trop rapprochée)');
        return;
    }

    console.log('📤 Commande active:', transcript);
    lastCommandTime = now;
    processingCommand = true;
    lastTranscript = '';
    inactivityCount = 0;
    waitingForTTS = true;

    chrome.runtime.sendMessage({
        action: 'content_recognition_result',
        transcript
    });

    setTimeout(() => {
        processingCommand = false;
    }, 2000);
}

function handleInterruption(transcript) {
    // Éviter les interruptions multiples
    const now = Date.now();
    if (processingCommand || (now - lastCommandTime) < MIN_COMMAND_INTERVAL) {
        console.log('⏸️ Interruption ignorée (trop rapprochée)');
        return;
    }

    console.log('⚡ Interruption:', transcript);
    lastCommandTime = now;
    processingCommand = true;

    // Passer immédiatement en mode active pour traiter la commande
    currentMode = 'active';
    lastTranscript = '';
    waitingForTTS = true;
    isTTSPlaying = false;
    canInterruptTTS = false;

    notifyRecordingState();

    chrome.runtime.sendMessage({
        action: 'interrupt_tts',
        transcript: transcript
    });

    // Réinitialiser après un délai
    setTimeout(() => {
        processingCommand = false;
    }, 2000);
}

function handleConfirmation(transcript) {
    console.log('✅ Confirmation:', transcript);
    lastTranscript = '';

    const yesPatterns = /\b(yes|oui|resume|yep|yeah|correct|ok|okay|sure|continue|go ahead)\b/i;

    if (transcript.toLowerCase().match(yesPatterns)) {
        chrome.runtime.sendMessage({ action: 'resume_audio' });
        chrome.runtime.sendMessage({
            action: 'update_status',
            data: '✅ Reprise de la lecture principale...'
        });

        // Revenir en mode interruption pendant la reprise
        currentMode = 'interruption';
        isTTSPlaying = true;
    } else {
        chrome.runtime.sendMessage({
            action: 'clarification_followup',
            transcript: transcript
        });
        chrome.runtime.sendMessage({
            action: 'update_status',
            data: `⏳ Envoi de votre question...`
        });

        currentMode = 'active';
        waitingForTTS = true;
    }

    notifyRecordingState();
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === 'tts_started') {
        isTTSPlaying = true;
        canInterruptTTS = message.canInterrupt || false;
        processingCommand = false;

        if (canInterruptTTS) {
            currentMode = 'interruption';
            console.log('🎧 TTS démarré - Interruption possible');
        } else {
            console.log('🎧 TTS démarré - Pas d\'interruption');
        }

        notifyRecordingState();
        sendResponse({ ok: true });
        return true;
    }

    if (message?.action === 'tts_finished') {
        isTTSPlaying = false;
        canInterruptTTS = false;
        waitingForTTS = false;
        inactivityCount = 0;
        processingCommand = false;

        currentMode = 'active';
        console.log('✅ TTS terminé - Mode actif');
        playHumSound();

        notifyRecordingState();
        sendResponse({ ok: true });
        return true;
    }

    if (message?.action === 'clarification_prompt') {
        currentMode = 'confirmation';
        notifyRecordingState();
        sendResponse({ ok: true });
        return true;
    }

    if (message?.action === 'get_recording_state') {
        sendResponse({
            mode: currentMode,
            isListening: isListening,
            isTTSPlaying: isTTSPlaying,
            canInterrupt: canInterruptTTS
        });
        return true;
    }

    if (message?.action === 'force_hotword_mode') {
        currentMode = 'hotword';
        inactivityCount = 0;
        waitingForTTS = false;
        notifyRecordingState();
        sendResponse({ ok: true });
        return true;
    }
});

// Démarrer l'écoute globale
function startGlobalListening() {
    if (!globalRecognition) {
        initializeGlobalRecognition();
    }

    if (!isListening) {
        try {
            globalRecognition.start();
            console.log('🎙️ Écoute globale démarrée');
        } catch (e) {
            console.warn('Écoute déjà active:', e);
        }
    }
}

// Arrêter l'écoute globale
function stopGlobalListening() {
    if (globalRecognition && isListening) {
        try {
            globalRecognition.stop();
            isListening = false;
            notifyRecordingState();
            console.log('🛑 Écoute globale arrêtée');
        } catch (e) {
            console.warn('Erreur arrêt écoute:', e);
        }
    }
}

window.getRecordingState = () => ({
    mode: currentMode,
    isListening: isListening,
    isTTSPlaying: isTTSPlaying,
    canInterrupt: canInterruptTTS
});

// Fonction exposée pour le bouton
window.startListening = function () {
    currentMode = 'active';
    inactivityCount = 0;
    waitingForTTS = false;
    startGlobalListening();
};

// Auto-démarrage de l'écoute au chargement
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation de l\'écoute active directe');
    setTimeout(() => {
        playHumSound(); // ✅ Jouer le son "hum"
        window.startListening();
    }, 500);
});
