document.addEventListener('DOMContentLoaded', () => {
    const statusDisplay = document.getElementById('status-display');
    const statusText = statusDisplay.querySelector('.status-text');
    const ledStatus = document.getElementById('led-status');
    const connectionStatus = document.getElementById('connection-status');
    const transcriptBox = document.getElementById('transcript-box');
    const transcriptContent = document.getElementById('transcript-content');
    const resetSessionBtn = document.getElementById('reset-session');
    const micButton = document.getElementById('mic-button');
    const themeToggleBtn = document.getElementById('theme-toggle');

    ledStatus.classList.add('connected');
    connectionStatus.textContent = 'Connecté';

    // ✅ Gestion du thème haut contraste
    let isHighContrast = localStorage.getItem('highContrast') === 'true';
    if (isHighContrast) {
        document.body.classList.add('high-contrast');
        themeToggleBtn.textContent = '☀️';
        themeToggleBtn.title = 'Mode standard';
    }

    themeToggleBtn.addEventListener('click', () => {
        isHighContrast = !isHighContrast;
        document.body.classList.toggle('high-contrast');
        localStorage.setItem('highContrast', isHighContrast);

        if (isHighContrast) {
            themeToggleBtn.textContent = '☀️';
            themeToggleBtn.title = 'Revenir au mode standard';
            statusText.textContent = '✅ Mode Haut Contraste activé';
        } else {
            themeToggleBtn.textContent = '👁️';
            themeToggleBtn.title = 'Activer mode haut contraste';
            statusText.textContent = '✅ Mode standard activé';
        }

        statusDisplay.classList.add('success');
        setTimeout(() => {
            statusDisplay.classList.remove('success');
        }, 2000);
    });

    resetSessionBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'reset_graph_state' }, (response) => {
            if (response?.ok) {
                transcriptContent.innerHTML = '';
                transcriptBox.classList.add('hidden');
                statusText.textContent = '✅ Nouvelle session démarrée';
                statusDisplay.classList.add('success');
                setTimeout(() => {
                    statusDisplay.classList.remove('success');
                    statusText.textContent = 'Prêt à écouter...';
                }, 2000);
            }
        });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message?.action) return;

        if (message.action === 'start_hotword_from_shortcut') {
            // Si le script n'est pas encore chargé, attendre un peu
            if (typeof window.startHotwordListening === 'function') {
                window.startHotwordListening();
                sendResponse({ ok: true });
            } else {
                // Réessayer après un court délai
                setTimeout(() => {
                    if (typeof window.startHotwordListening === 'function') {
                        window.startHotwordListening();
                    }
                }, 500);
                sendResponse({ ok: true });
            }
            return true;
        }

        if (message.action === 'recording_state_changed') {
            updateUI({
                mode: message.mode || 'hotword',
                isListening: !!message.isListening,
                isTTSPlaying: !!message.isTTSPlaying,
                canInterrupt: !!message.canInterrupt
            });
            sendResponse({ ok: true });
            return true;
        }

        if (message.action === 'update_status') {
            handleStatusUpdate(message.data);
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
            updateUI();
            statusDisplay.classList.add('success');
            statusText.textContent = transcription;
            addToTranscript('Vous', transcription);
        } else if (text.startsWith('🤖')) {
            const response = text.substring(2).trim();
            updateUI();
            statusDisplay.classList.add('success');
            statusText.textContent = response;
            addToTranscript('Agent', response);
        } else if (text.startsWith('❌')) {
            const error = text.substring(2).trim();
            updateUI();
            statusDisplay.classList.add('error');
            statusText.textContent = error;
        } else if (text.startsWith('⏳')) {
            statusText.textContent = text;
        } else {
            statusText.textContent = text;
        }
    }

    function addToTranscript(label, text) {
        transcriptBox.classList.remove('hidden');
        const item = document.createElement('div');
        item.className = 'transcript-item';
        item.innerHTML = `<div class="transcript-label">${label}</div><div class="transcript-text">${text}</div>`;
        transcriptContent.appendChild(item);
        transcriptContent.scrollTop = transcriptContent.scrollHeight;

        const items = transcriptContent.querySelectorAll('.transcript-item');
        if (items.length > 5) {
            items[0].remove();
        }
    }

    function clearStateClasses() {
        micButton.classList.remove('recording', 'processing', 'idle', 'active', 'success', 'error');
        statusDisplay.classList.remove('listening', 'processing', 'success', 'error');
        ledStatus.classList.remove('recording', 'processing', 'connected');
    }

    function updateUI(state = {}) {
        clearStateClasses();

        const mode = state.mode || 'hotword';
        const isListening = state.isListening || false;
        const isTTSPlaying = state.isTTSPlaying || false;
        const canInterrupt = state.canInterrupt || false;

        if (!isListening) {
            micButton.classList.add('idle');
            micButton.querySelector('.mic-icon').textContent = '🎙️';
            ledStatus.classList.add('connected');
            connectionStatus.textContent = 'Prêt';
            statusText.textContent = 'En attente...';
            return;
        }

        micButton.classList.add('recording');
        ledStatus.classList.add('recording');
        statusDisplay.classList.add('listening');

        if (mode === 'hotword') {
            micButton.querySelector('.mic-icon').textContent = '👂';
            connectionStatus.textContent = 'Écoute continue';
            statusText.textContent = '👂 Dites "Hello" pour commencer...';
        } else if (mode === 'active') {
            micButton.querySelector('.mic-icon').textContent = '🎙️';
            connectionStatus.textContent = 'Écoute active';
            statusText.textContent = '🎙️ Parlez maintenant...';
        } else if (mode === 'interruption') {
            micButton.querySelector('.mic-icon').textContent = '✋';
            connectionStatus.textContent = 'Interruption possible';
            statusText.textContent = '✋ Parlez pour interrompre...';
        } else if (mode === 'confirmation') {
            micButton.querySelector('.mic-icon').textContent = '❓';
            connectionStatus.textContent = 'Confirmation';
            statusText.textContent = '❓ Répondez à la question...';
        }
    }

    try {
        window.addEventListener('recording_state_changed', (e) => {
            const detail = e?.detail || {};
            updateUI({
                mode: detail.mode || 'hotword',
                isListening: !!detail.isListening,
                isTTSPlaying: !!detail.isTTSPlaying,
                canInterrupt: !!detail.canInterrupt
            });
        });
    } catch (e) { }

    try {
        if (typeof window.getRecordingState === 'function') {
            updateUI(window.getRecordingState());
        } else {
            chrome.runtime.sendMessage({ action: 'get_recording_state' }, (resp) => {
                if (resp) {
                    updateUI(resp);
                }
            });
        }
    } catch (e) { }

    micButton.addEventListener('click', () => {
        if (typeof window.startHotwordListening === 'function') {
            window.startHotwordListening();
        }
    });
});
