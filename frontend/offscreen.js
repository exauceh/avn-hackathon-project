let currentAudio = null;
let pausedAudio = null;
let pausedTime = 0;
let fadeOutInterval = null;
let silenceTimer = null;
let isReading = false;  // Flag simple : est-ce une action de lecture ?

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return true;

    switch (message.type) {
        case 'play-audio':
            playAudio(message.audio_data, message.canInterrupt, message.isReading);
            break;
        case 'pause-audio':
            pauseAudio();
            break;
        case 'stop-audio':
            stopAudio();
            break;
        case 'user-speaking':
            handleUserSpeaking();
            break;
    }

    sendResponse({ success: true });
    return true;
});

function pauseAudio() {
    if (currentAudio && !currentAudio.paused) {
        pausedTime = currentAudio.currentTime;
        pausedAudio = currentAudio;

        console.log(`⏸️ Audio en pause - isReading: ${isReading}, time: ${pausedTime.toFixed(1)}s`);

        // Fade out rapide pour une interruption douce
        if (fadeOutInterval) {
            clearInterval(fadeOutInterval);
            fadeOutInterval = null;
        }

        fadeOutInterval = setInterval(() => {
            if (currentAudio && currentAudio.volume > 0.1) {
                currentAudio.volume -= 0.15;
            } else {
                clearInterval(fadeOutInterval);
                fadeOutInterval = null;
                if (currentAudio) {
                    currentAudio.pause();
                    chrome.runtime.sendMessage({ type: 'audio-paused', pausedTime }).catch(() => { });
                }
            }
        }, 15);
    }
}

function playAudio(base64Audio, canInterrupt = false, isReadingAction = false) {
    try {
        console.log(`▶️ Lecture audio - canInterrupt: ${canInterrupt}, isReading: ${isReadingAction}, pausedAudio: ${!!pausedAudio}`);

        clearSilenceTimer();

        // Arrêter l'audio en cours s'il ne s'agit pas de l'audio pausé
        if (currentAudio && currentAudio !== pausedAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // Mettre à jour le flag global
        isReading = isReadingAction;

        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);

        for (let i = 0; i < audioData.length; i++) {
            view[i] = audioData.charCodeAt(i);
        }

        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(audioUrl);
        currentAudio.volume = 0.7;

        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            const wasPaused = !!pausedAudio;
            currentAudio = null;

            console.log(`🎵 Audio terminé - pausedAudio: ${wasPaused}, isReading: ${isReading}`);

            // ✅ REPRISE AUTOMATIQUE : Seulement si on est en mode lecture ET qu'il y a un audio en pause
            if (wasPaused && isReading) {
                console.log('🔇 Clarification terminée → Timer de reprise (4s)');
                startSilenceTimer();
            } else {
                console.log('✅ Fin normale - Pas de reprise');
                if (pausedAudio) {
                    pausedAudio = null;
                    pausedTime = 0;
                }
                chrome.runtime.sendMessage({ type: 'audio-playback-finished' }).catch(() => { });
            }
        };

        currentAudio.onerror = () => {
            currentAudio = null;
        };

        currentAudio.play().catch(() => {
            currentAudio = null;
        });

    } catch (e) {
        console.error('Erreur décodage audio:', e);
    }
}

function resumeAudio() {
    clearSilenceTimer();

    if (pausedAudio) {
        console.log('▶️ Reprise automatique de la lecture');
        currentAudio = pausedAudio;
        currentAudio.currentTime = pausedTime;
        currentAudio.volume = 0.7;

        currentAudio.onended = () => {
            pausedAudio = null;
            pausedTime = 0;
            currentAudio = null;
            chrome.runtime.sendMessage({ type: 'audio-playback-finished' }).catch(() => { });
        };

        currentAudio.play().then(() => {
            pausedAudio = null;
            pausedTime = 0;
            chrome.runtime.sendMessage({ type: 'audio-resumed' }).catch(() => { });
        }).catch(() => {
            pausedAudio = null;
            currentAudio = null;
        });
    }
}

function startSilenceTimer() {
    clearSilenceTimer();

    silenceTimer = setTimeout(() => {
        console.log('⏰ Timer de reprise expiré');

        // ✅ Reprendre SEULEMENT si on est en mode lecture ET qu'il y a un audio en pause
        if (pausedAudio && isReading) {
            console.log('📖 Reprise automatique de la lecture');
            resumeAudio();
        } else {
            console.log('🛑 Pas de reprise');
            stopAudio();
        }
    }, 4000);  // 4 secondes de silence avant reprise
}

function clearSilenceTimer() {
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
}

function handleUserSpeaking() {
    console.log('🗣️ Utilisateur parle → Annulation de la reprise');
    clearSilenceTimer();
    // Annuler la pause pour empêcher la reprise
    if (pausedAudio) {
        pausedAudio = null;
        pausedTime = 0;
    }
}

function stopAudio() {
    clearSilenceTimer();

    if (fadeOutInterval) {
        clearInterval(fadeOutInterval);
        fadeOutInterval = null;
    }

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if (pausedAudio) {
        pausedAudio = null;
        pausedTime = 0;
    }

    isReading = false;

    chrome.runtime.sendMessage({ type: 'audio-stopped' }).catch(() => { });
}