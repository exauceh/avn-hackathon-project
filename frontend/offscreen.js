let mediaRecorder = null;
let audioChunks = [];

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
            playAudio(message.audio_data);
            sendResponse({ success: true });
        }
    }

    return true; // ✅ Important pour réponse asynchrone
});

// ✅ Fonction pour jouer l'audio
function playAudio(base64Audio) {
    console.log('🟠 [OFFSCREEN] 🔊 Lecture audio, taille:', base64Audio.length);

    try {
        // Décoder le base64
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);

        for (let i = 0; i < audioData.length; i++) {
            view[i] = audioData.charCodeAt(i);
        }

        // --- CORRECTION CLÉ : Le type doit être 'audio/mp3' ---
        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        // Créer et jouer l'audio
        const audio = new Audio(audioUrl);
        // ... (le reste du code est conservé)

        audio.onplay = () => {
            console.log('🟠 [OFFSCREEN] 🔊 Lecture audio démarrée');
        };

        audio.onended = () => {
            console.log('🟠 [OFFSCREEN] ✅ Lecture audio terminée');
            URL.revokeObjectURL(audioUrl);
            // Notifier le background que l'audio est terminé
            chrome.runtime.sendMessage({
                type: 'audio-playback-finished'
            }).catch(() => { });
        };

        audio.onerror = (e) => {
            console.error('🟠 [OFFSCREEN] ❌ Erreur lecture audio:', e);
            console.error('🟠 [OFFSCREEN] ❌ Audio error:', audio.error);
        };

        audio.play().then(() => {
            console.log('🟠 [OFFSCREEN] ✅ audio.play() réussi');
        }).catch(err => {
            console.error('🟠 [OFFSCREEN] ❌ audio.play() échoué:', err);
        });

    } catch (e) {
        console.error('🟠 [OFFSCREEN] ❌ Erreur décodage audio:', e);
    }
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