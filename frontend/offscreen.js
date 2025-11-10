let mediaRecorder = null;
let audioChunks = [];
let currentAudio = null;
let pausedAudio = null;
let pausedTime = 0;
let lastPlayedIsClarification = false;
let fadeOutInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return true;

    switch (message.type) {
        case 'play-audio':
            playAudio(message.audio_data, message.canInterrupt, message.isClarification === true);
            break;
        case 'pause-audio':
            pauseAudio();
            break;
        case 'resume-audio':
            resumeAudio();
            break;
        case 'stop-audio':
            stopAudio();
            break;
    }

    sendResponse({ success: true });
    return true;
});

function pauseAudio() {
    if (currentAudio && !currentAudio.paused) {
        pausedTime = currentAudio.currentTime;
        pausedAudio = currentAudio;

        // Nettoyer le fade précédent si existant
        if (fadeOutInterval) {
            clearInterval(fadeOutInterval);
            fadeOutInterval = null;
        }

        // Fade out rapide pour une interruption plus douce
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
        }, 15); // Plus rapide pour une réaction immédiate
    }
}

function playAudio(base64Audio, canInterrupt = false, isClarification = false) {
    try {
        if (!isClarification && currentAudio && currentAudio !== pausedAudio) {
            currentAudio.pause();
            currentAudio = null;
        } else if (isClarification && currentAudio && !currentAudio.paused && currentAudio !== pausedAudio) {
            pauseAudio();
        }

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
        currentAudio.volume = 0.7; // Volume initial

        currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);

            if (lastPlayedIsClarification) {
                lastPlayedIsClarification = false;
                chrome.runtime.sendMessage({ type: 'clarification-audio-finished' }).catch(() => { });
                currentAudio = null;
                return;
            }

            if (pausedAudio) {
                setTimeout(() => resumeAudio(), 500);
            } else {
                currentAudio = null;
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
    if (pausedAudio) {
        currentAudio = pausedAudio;
        currentAudio.currentTime = pausedTime;
        currentAudio.volume = 0.7; // Restaurer le volume

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

function stopAudio() {
    // Nettoyer le fade si en cours
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

    chrome.runtime.sendMessage({ type: 'audio-stopped' }).catch(() => { });
}