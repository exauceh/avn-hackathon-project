document.addEventListener('DOMContentLoaded', () => {
    const micButton = document.getElementById('mic-button');
    const statusDisplay = document.getElementById('status-display');
    const statusText = statusDisplay.querySelector('.status-text');
    const ledStatus = document.getElementById('led-status');
    const connectionStatus = document.getElementById('connection-status');
    const transcriptBox = document.getElementById('transcript-box');
    const transcriptContent = document.getElementById('transcript-content');
    const resetSessionBtn = document.getElementById('reset-session');

    let currentState = 'idle'; // 'idle', 'recording', 'processing'

    // Initialiser le LED comme connecté
    ledStatus.classList.add('connected');
    connectionStatus.textContent = 'Connecté';

    // Bouton réinitialiser la session
    resetSessionBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'reset_graph_state' }, (response) => {
            if (response && response.ok) {
                // Vider le transcript
                transcriptContent.innerHTML = '';
                transcriptBox.classList.add('hidden');
                statusText.textContent = '✅ Nouvelle session démarrée';
                statusDisplay.classList.add('success');
                setTimeout(() => {
                    statusDisplay.classList.remove('success');
                    statusText.textContent = 'Prêt à écouter...';
                }, 2000);
                console.log('🔄 Session réinitialisée:', response.session_id);
            }
        });
    });

    // Messages runtime : mise à jour UI sur recording_state_changed et update_status
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || !message.action) return;

        if (message.action === 'start_hotword_from_shortcut') {
            if (typeof startHotwordListening === 'function') {
                startHotwordListening();
                sendResponse({ ok: true });
            } else {
                console.warn('startHotwordListening non défini');
                sendResponse({ ok: false });
            }
            return true;
        }

        if (message.action === 'recording_state_changed') {
            const hot = !!message.hotwordActive;
            const main = !!message.mainListening;
            console.log('📣 Event runtime recording_state_changed', { hot, main });
            updateUI({ hotwordActive: hot, mainListening: main });
            sendResponse({ ok: true });
            return true;
        }

        if (message.action === 'update_status') {
            const text = message.data;
            console.log('📩 Mise à jour status:', text);
            handleStatusUpdate(text);
            sendResponse({ ok: true });
            return true;
        }
    });

    function handleStatusUpdate(text) {
        if (typeof text !== 'string') {
            statusText.textContent = '';
            return;
        }

        if (text.startsWith('✅')) {
            const transcription = text.substring(2).trim();
            currentState = 'idle';
            updateUI();
            statusDisplay.classList.add('success');
            statusText.textContent = transcription;
            addToTranscript('Vous', transcription);

        } else if (text.startsWith('🤖')) {
            const response = text.substring(2).trim();
            currentState = 'idle';
            updateUI();
            statusDisplay.classList.add('success');
            statusText.textContent = response;
            addToTranscript('Agent', response);

        } else if (text.startsWith('❌')) {
            const error = text.substring(2).trim();
            currentState = 'idle';
            updateUI();
            statusDisplay.classList.add('error');
            statusText.textContent = error;

        } else if (text.startsWith('⏳')) {
            currentState = 'processing';
            updateUI();
            statusText.textContent = text;

        } else {
            statusText.textContent = text;
        }
    }

    function addToTranscript(label, text) {
        transcriptBox.classList.remove('hidden');
        const item = document.createElement('div');
        item.className = 'transcript-item';
        item.innerHTML = `
            <div class="transcript-label">${label}</div>
            <div class="transcript-text">${text}</div>
        `;
        transcriptContent.appendChild(item);
        transcriptContent.scrollTop = transcriptContent.scrollHeight;

        const items = transcriptContent.querySelectorAll('.transcript-item');
        if (items.length > 5) {
            items[0].remove();
        }
    }

    function clearStateClasses() {
        // bouton
        micButton.classList.remove('recording', 'processing', 'idle', 'active', 'success', 'error');
        // status card
        statusDisplay.classList.remove('listening', 'processing', 'success', 'error');
        // led
        ledStatus.classList.remove('recording', 'processing', 'connected');
    }

    function updateUI(state) {
        // state attendu : { hotwordActive: boolean, mainListening: boolean }
        const s = state || { hotwordActive: false, mainListening: false };
        clearStateClasses();

        // Priorité : mainListening > hotwordActive > idle
        if (s.mainListening) {
            micButton.classList.add('recording');
            micButton.querySelector('.mic-icon').textContent = '🎙️';
            micButton.title = 'Enregistrement en cours';
            ledStatus.classList.add('recording');
            connectionStatus.textContent = 'Enregistrement';
            statusText.textContent = '🎙️ Parlez maintenant...';
            statusDisplay.classList.add('listening');

        } else if (s.hotwordActive) {
            micButton.classList.add('recording');
            micButton.querySelector('.mic-icon').textContent = '👂';
            micButton.title = 'En attente du mot-clé';
            ledStatus.classList.add('recording');
            connectionStatus.textContent = 'Écoute hotword';
            statusText.textContent = '👂 Dites "Hello AVN"...';
            statusDisplay.classList.add('listening');

        } else {
            // idle / prêt
            micButton.classList.add('idle');
            micButton.querySelector('.mic-icon').textContent = '🎙️';
            micButton.title = 'Prêt';
            ledStatus.classList.add('connected');
            connectionStatus.textContent = 'Prêt';
            statusText.textContent = 'En attente...';
        }
    }

    // (recording_state_changed is handled in the main onMessage listener above)

    // Écoute locale (CustomEvent) envoyé par popup-stt.js pour les cas synchrones
    try {
        window.addEventListener('recording_state_changed', (e) => {
            try {
                const detail = e && e.detail ? e.detail : {};
                console.log('📣 Event local recording_state_changed', detail);
                updateUI({ hotwordActive: !!detail.hotwordActive, mainListening: !!detail.mainListening });
            } catch (err) {
                console.warn('Erreur handling local recording_state_changed', err);
            }
        });
    } catch (e) {
        // ignore
    }

    // Try synchronous getter if popup-stt.js is loaded in same page
    try {
        if (typeof window.getRecordingState === 'function') {
            const state = window.getRecordingState();
            updateUI(state);
        } else {
            // fallback: ask background (kept for compatibility)
            chrome.runtime.sendMessage({ action: 'get_recording_state' }, (resp) => {
                if (resp) updateUI({ hotwordActive: !!resp.hotwordActive, mainListening: !!resp.mainListening });
            });
        }
    } catch (e) {
        console.warn('Impossible de récupérer l’état de recording:', e);
    }

    // (optionnel) click to toggle hotword
    micButton.addEventListener('click', () => {
        // startHotwordListening doit exister dans popup-stt.js
        if (typeof startHotwordListening === 'function') startHotwordListening();
    });
});
