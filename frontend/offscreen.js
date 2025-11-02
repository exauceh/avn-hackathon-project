let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;
let pausedAudio = null; // ✅ Stocker l'audio mis en pause
let pausedTime = 0; // ✅ Position de la pause
let lastPlayedIsClarification = false; // ✅ Indique si l'audio en cours est une clarification

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🟠 [OFFSCREEN] Message reçu:', message);

    if (message.target === 'offscreen') {

        if (message.type === 'start-recording') {
            startRecording();
            sendResponse({ success: true });
        }

        else if (message.type === 'stop-recording') {
            stopRecording();
            sendResponse({ success: true });
        }

        else if (message.type === 'play-audio') {
            // Accept an explicit flag isClarification
            const isClar = message.isClarification === true;
            playAudio(message.audio_data, message.canInterrupt, isClar);
            sendResponse({ success: true });
        }

        // ✅ Pause l'audio en cours
        else if (message.type === 'pause-audio') {
            pauseAudio();
            sendResponse({ success: true });
        }

        // ✅ Reprendre l'audio mis en pause
        else if (message.type === 'resume-audio') {
            resumeAudio();
            sendResponse({ success: true });
        }

        else if (message.type === 'stop-audio') {
            stopAudio();
            sendResponse({ success: true });
        }
    }

    return true;
});

// ✅ Mettre en pause l'audio en cours (pour interruption)
function pauseAudio() {
    console.log('🟠 [OFFSCREEN] ⏸️ Pause audio demandée');

    if (currentAudio && !currentAudio.paused) {
        pausedTime = currentAudio.currentTime;
        pausedAudio = currentAudio;
        currentAudio.pause();
        console.log('🟠 [OFFSCREEN] ✅ Audio mis en pause à', pausedTime, 's');
        console.log('🟠 [OFFSCREEN] 📦 pausedAudio sauvegardé:', !!pausedAudio, 'pausedTime:', pausedTime);

        // ⚠️ IMPORTANT : Ne pas mettre currentAudio à null ici
        // currentAudio = null; // ❌ NE PAS FAIRE ÇA

        // Notifier le background
        chrome.runtime.sendMessage({
            type: 'audio-paused',
            pausedTime: pausedTime
        }).catch(() => { });
    } else {
        console.log('🟠 [OFFSCREEN] ⚠️ Pas d\'audio en cours à mettre en pause');
    }
}

// ✅ Fonction pour jouer l'audio
function playAudio(base64Audio, canInterrupt = false, isClarification = false) {
    console.log('🟠 [OFFSCREEN] 🔊 Lecture audio, taille:', base64Audio.length, 'interruption:', canInterrupt, 'isClarification:', isClarification);

    try {
        // ✅ CORRECTION : Si c'est une clarification, ne pas écraser pausedAudio
        if (!isClarification) {
            // Arrêter l'audio précédent s'il existe (mais pas pendant une clarification)
            if (currentAudio && currentAudio !== pausedAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
        } else {
            // Si clarification, juste mettre en pause currentAudio si nécessaire
            if (currentAudio && !currentAudio.paused && currentAudio !== pausedAudio) {
                console.log('🟠 [OFFSCREEN] ⏸️ Mise en pause auto pour clarification');
                pauseAudio();
            }
        }

        // Reset flag and set according to param
        lastPlayedIsClarification = !!isClarification;

        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);

        for (let i = 0; i < audioData.length; i++) {
            view[i] = audioData.charCodeAt(i);
        }

        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        currentAudio = new Audio(audioUrl);

        currentAudio.onplay = () => {
            console.log('🟠 [OFFSCREEN] 🔊 Lecture audio démarrée (clarif:', lastPlayedIsClarification, ')');
            console.log('🟠 [OFFSCREEN] 📦 État: pausedAudio existe?', !!pausedAudio, 'pausedTime:', pausedTime);
        };

        currentAudio.onended = () => {
            console.log('🟠 [OFFSCREEN] ✅ Lecture audio terminée');
            console.log('🟠 [OFFSCREEN] 📦 lastPlayedIsClarification:', lastPlayedIsClarification);
            console.log('🟠 [OFFSCREEN] 📦 pausedAudio existe?', !!pausedAudio, 'pausedTime:', pausedTime);

            URL.revokeObjectURL(audioUrl);

            if (lastPlayedIsClarification) {
                // Ne PAS reprendre l'audio principal automatiquement.
                lastPlayedIsClarification = false;
                console.log('🟠 [OFFSCREEN] ✅ Clarification audio terminée - notif background pour confirmation utilisateur');
                chrome.runtime.sendMessage({
                    type: 'clarification-audio-finished'
                }).catch(() => { });
                // currentAudio reste comme clarification terminée
                currentAudio = null;
                return;
            }

            // Behaviour for normal audio: resume paused principal if present
            if (pausedAudio) {
                console.log('🟠 [OFFSCREEN] ⏯️ Reprise automatique de l\'audio principal dans 500ms');
                setTimeout(() => {
                    resumeAudio();
                }, 500);
            } else {
                console.log('🟠 [OFFSCREEN] ⚠️ Pas de pausedAudio à reprendre');
                currentAudio = null;
                chrome.runtime.sendMessage({
                    type: 'audio-playback-finished'
                }).catch(() => { });
            }
        };

        currentAudio.onerror = (e) => {
            console.error('🟠 [OFFSCREEN] ❌ Erreur lecture audio:', e);
            currentAudio = null;
        };

        currentAudio.play().then(() => {
            console.log('🟠 [OFFSCREEN] ✅ audio.play() réussi');
        }).catch(err => {
            console.error('🟠 [OFFSCREEN] ❌ audio.play() échoué:', err);
            currentAudio = null;
        });

    } catch (e) {
        console.error('🟠 [OFFSCREEN] ❌ Erreur décodage audio:', e);
    }
}

// ✅ Reprendre l'audio mis en pause
function resumeAudio() {
    console.log('🟠 [OFFSCREEN] ⏯️ Reprise audio demandée');

    if (pausedAudio) {
        currentAudio = pausedAudio;
        currentAudio.currentTime = pausedTime;

        currentAudio.play().then(() => {
            console.log('🟠 [OFFSCREEN] ✅ Audio repris à', pausedTime, 's');
            pausedAudio = null;
            pausedTime = 0;

            // Notifier le background
            chrome.runtime.sendMessage({
                type: 'audio-resumed'
            }).catch(() => { });
        }).catch(err => {
            console.error('🟠 [OFFSCREEN] ❌ Erreur reprise audio:', err);
            pausedAudio = null;
            currentAudio = null;
        });
    } else {
        console.log('🟠 [OFFSCREEN] ⚠️ Pas d\'audio en pause à reprendre');
    }
}

// ✅ Arrêter complètement l'audio
function stopAudio() {
    console.log('🟠 [OFFSCREEN] ⏹️ Arrêt audio demandé');

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if (pausedAudio) {
        pausedAudio = null;
        pausedTime = 0;
    }

    chrome.runtime.sendMessage({
        type: 'audio-stopped'
    }).catch(() => { });

    console.log('🟠 [OFFSCREEN] ✅ Audio arrêté');
}

async function startRecording() {
    console.log('🟠 [OFFSCREEN] 🎤 Démarrage enregistrement audio');

    try {
        // Demander accès au micro
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            }
        });

        console.log('🟠 [OFFSCREEN] ✅ Accès micro autorisé');

        // Créer le MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 48000
        });

        audioChunks = [];

        // Collecter les chunks
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log('🟠 [OFFSCREEN] 📦 Chunk audio reçu:', event.data.size, 'bytes');
            }
        };

        // Quand l'enregistrement s'arrête
        mediaRecorder.onstop = async () => {
            console.log('🟠 [OFFSCREEN] 🏁 Enregistrement arrêté, traitement...');

            // Créer le blob final
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('🟠 [OFFSCREEN] 📦 Blob créé:', audioBlob.size, 'bytes');

            // Convertir en ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log('🟠 [OFFSCREEN] 📤 Envoi audio au background:', uint8Array.length, 'bytes');

            // Envoyer au background
            chrome.runtime.sendMessage({
                type: 'audio-complete',
                buffer: Array.from(uint8Array) // Convertir en array normal
            }).then(() => {
                console.log('🟠 [OFFSCREEN] ✅ Audio envoyé au background');
            }).catch(err => {
                console.error('🟠 [OFFSCREEN] ❌ Erreur envoi audio:', err);
            });

            // Arrêter tous les tracks
            stream.getTracks().forEach(track => track.stop());
            console.log('🟠 [OFFSCREEN] 🛑 Tracks audio fermés');

            // Envoyer confirmation
            chrome.runtime.sendMessage({
                type: 'recording-stopped'
            }).catch(() => { });
        };

        mediaRecorder.onerror = (event) => {
            console.error('🟠 [OFFSCREEN] ❌ Erreur MediaRecorder:', event.error);
            chrome.runtime.sendMessage({
                type: 'offscreen-error',
                message: event.error.message,
                name: event.error.name
            }).catch(() => { });
        };

        // Démarrer l'enregistrement
        mediaRecorder.start();
        console.log('🟠 [OFFSCREEN] ✅ MediaRecorder démarré');

    } catch (error) {
        console.error('🟠 [OFFSCREEN] ❌ Erreur accès micro:', error);
        chrome.runtime.sendMessage({
            type: 'offscreen-error',
            message: error.message,
            name: error.name
        }).catch(() => { });
    }
}

function stopRecording() {
    console.log('🟠 [OFFSCREEN] 🛑 Demande arrêt enregistrement');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log('🟠 [OFFSCREEN] ✅ MediaRecorder arrêté');
    } else {
        console.log('🟠 [OFFSCREEN] ⚠️ Pas d\'enregistrement en cours');
    }
}

console.log('🟠 [OFFSCREEN] ✅ Offscreen document initialisé');
// NOTE: hotword detection has been moved to a native host for reliable, always-on listening