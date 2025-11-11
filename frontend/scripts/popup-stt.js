let globalRecognition = null;
let isListening = false;
let currentMode = 'active'; // hotword, active, interruption
let waitingForTTS = false;
let inactivityCount = 0;
let isTTSPlaying = false;
let canInterruptTTS = false;
let speechStarted = false;
let lastTranscript = '';
let interimTimeout = null;
let lastCommandTime = 0;
let processingCommand = false;
let speechDuration = 0;
let speechStartTime = 0;

const MAX_INACTIVITY = 3;
const MIN_COMMAND_INTERVAL = 1000;
const MIN_SPEECH_DURATION = 800; // ✅ Durée minimale de parole pour éviter les bruits (ms)
const MIN_CONFIDENCE = 0.6; // ✅ Confiance minimale pour une vraie parole

// Créez l'objet audio une seule fois pour de meilleures performances
const humSound = new Audio(chrome.runtime.getURL('assets/hum.mp3'));
humSound.volume = 0.5; // Vous pouvez toujours contrôler le volume

function playHumSound() {
    try {
        // Il suffit de jouer le son
        humSound.play();
    } catch (e) {
        console.warn('playHumSound failed', e);
    }
}

// Variable globale pour stocker la voix une fois qu'elle est prête
let preferredVoice = null;

// Function to load the preferred voice
function loadPreferredVoice() {
    return new Promise(resolve => {
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            // Try to find a natural-sounding English voice
            // Names may vary depending on the operating system and browser
            preferredVoice = voices.find(voice => voice.lang === 'en-US' && voice.name.includes('Google') && !voice.name.includes('male'));
            if (!preferredVoice) {
                preferredVoice = voices.find(voice => voice.lang === 'en-US');
            }
            if (preferredVoice) {
                console.log('Preferred voice loaded:', preferredVoice.name);
            } else {
                console.warn('No en-US voice found, using default voice.');
            }
            resolve(preferredVoice);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = setVoice;
        } else {
            setVoice();
        }
    });
}

// Charger la voix dès que possible
loadPreferredVoice();


function speakMessage(text, isSleepMessage = false) {
    try {
        const utterance = new SpeechSynthesisUtterance(text);

        // Utiliser la voix préférée si elle est chargée
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        if (isSleepMessage) {
            // Réglages pour simuler un ton plus calme et "endormi"
            utterance.rate = 0.85; // Un peu plus lent
            utterance.pitch = 0.8; // Un peu plus grave/calme
            utterance.volume = 0.6; // Un peu plus doux
        } else {
            // Réglages par défaut pour les autres messages
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 0.7;
        }

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('speakMessage failed', e);
    }
}

function stopTTSImmediate() {
    if (isTTSPlaying && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    // ✅ Envoyer 'stop-audio' pour un arrêt net et l'annulation de la reprise auto
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-audio' }).catch(() => { });
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
        speechStartTime = Date.now();
        console.log('🗣️ Parole détectée');

        // Notifier offscreen pour annuler la reprise auto
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'user-speaking' }).catch(() => { });

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

        // ✅ INTERRUPTION : Si TTS en cours ET parole assez longue
        if (isTTSPlaying && canInterruptTTS) {
            const currentSpeechDuration = Date.now() - speechStartTime;
            const wordCount = transcript.split(/\s+/).length;

            // Interrompre si : durée > 800ms OU plus de 3 mots
            if (currentSpeechDuration > MIN_SPEECH_DURATION || wordCount >= 3) {
                console.log('🛑 Interruption valide - Arrêt TTS');
                stopTTSImmediate();
                setTimeout(() => playHumSound(), 50);

                // Basculer en mode active pour traiter la commande
                if (currentMode === 'interruption') {
                    currentMode = 'active';
                    notifyRecordingState();
                }
            } else {
                console.log(`⏸️ Parole trop courte (${currentSpeechDuration}ms, ${wordCount} mots)`);
            }
        }

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
            // Traiter les commandes finales avec filtre qualité
            if (isFinal && transcript.length > 0) {
                const wordCount = transcript.split(/\s+/).length;
                const hasMinConfidence = !confidence || confidence >= MIN_CONFIDENCE;

                if (wordCount >= 2 && hasMinConfidence) {
                    handleActiveCommand(transcript);
                } else {
                    console.log(`⏸️ Commande filtrée (${wordCount} mots, conf: ${confidence?.toFixed(2) || 'N/A'})`);
                }
            } else if (!isFinal && transcript.length > 10) {
                // Feedback visuel en temps réel
                chrome.runtime.sendMessage({
                    action: 'update_status',
                    data: `⏳ "${transcript}..."`
                }).catch(() => { });
            }
        } else if (currentMode === 'interruption') {
            // Mode interruption : traiter la clarification
            if (isFinal && transcript.length > 0) {
                const wordCount = transcript.split(/\s+/).length;
                const hasMinConfidence = !confidence || confidence >= MIN_CONFIDENCE;

                if (wordCount >= 2 && hasMinConfidence) {
                    handleInterruption(transcript);
                } else {
                    console.log(`⏸️ Interruption filtrée (${wordCount} mots, conf: ${confidence?.toFixed(2) || 'N/A'})`);
                }
            } else if (!isFinal && transcript.length > 5) {
                chrome.runtime.sendMessage({
                    action: 'update_status',
                    data: `✋ "${transcript}..."`
                }).catch(() => { });
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
                speakMessage('Going back to sleep. Say hello to wake me up.', true);
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
    // Filtrer le hotword
    const isHotword = transcript.toLowerCase().includes('hello');
    if (isHotword) {
        console.log('🔥 Hotword ignoré en mode actif');
        playHumSound();
        return;
    }

    // Anti-rebond : éviter les commandes multiples
    const now = Date.now();
    if (processingCommand || (now - lastCommandTime) < MIN_COMMAND_INTERVAL) {
        console.log('⏸️ Commande trop rapide - ignorée');
        return;
    }

    console.log('📤 Commande:', transcript);
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
    // Anti-rebond
    const now = Date.now();
    if (processingCommand || (now - lastCommandTime) < MIN_COMMAND_INTERVAL) {
        console.log('⏸️ Interruption trop rapide - ignorée');
        return;
    }

    console.log('⚡ Interruption:', transcript);
    lastCommandTime = now;
    processingCommand = true;

    // Basculer en mode actif et réinitialiser les états
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

    setTimeout(() => {
        processingCommand = false;
    }, 2000);
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
            console.log('🎧 TTS court - Veuillez patienter');
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

        // Retour en mode actif avec feedback sonore
        if (currentMode !== 'active') {
            currentMode = 'active';
            console.log('✅ TTS terminé - Mode actif');
            playHumSound();
        }

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
