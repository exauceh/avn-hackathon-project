const API_URL = 'http://127.0.0.1:8080';
let currentRequestId = null;
let pollInterval = null;
let currentPageContext = {}; // Contexte de la page courante
let sessionContext = {
  user_email: 'testeur@avn.com', // Email par défaut pour les démos
  search_results: []
};


// ✅ ENVOYER LA TRANSCRIPTION AU SERVEUR AVEC CONTEXTE
async function sendTranscriptionToServer(transcription) {
  try {
    console.log(`📤 Envoi transcription au serveur...`);

    // Récupérer le contexte de la page active
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'get_dom_content'
        });
        if (response && response.content) {
          currentPageContext = response.content;
          console.log("📄 Contexte capturé:", currentPageContext.title);
        }
      } catch (e) {
        console.warn("⚠️ Impossible de capturer le contexte DOM:", e);
      }
    }

    // Construire le contexte complet
    const context = {
      url: currentPageContext.url || '',
      title: currentPageContext.title || '',
      content: currentPageContext,
      user_email: sessionContext.user_email,
      search_results: sessionContext.search_results,
      preferences: {}
    };

    const response = await fetch(`${API_URL}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: transcription,
        context: context
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur serveur');
    }

    const data = await response.json();
    currentRequestId = data.request_id;

    // Démarrer le polling pour la réponse de l'agent
    startPolling(data.request_id);

  } catch (error) {
    console.error('❌ Erreur:', error);
    updatePopupStatus(`❌ ${error.message}`);
  } finally {
    isRecording = false;
  }
}

// ✅ POLLING POUR LA RÉPONSE
function startPolling(requestId) {
  console.log(`🔄 Polling pour ${requestId}...`);
  updatePopupStatus('⏳ En attente de la réponse...');

  let attempts = 0;
  const maxAttempts = 100; // 30 secondes max

  pollInterval = setInterval(async () => {
    attempts++;

    try {
      const response = await fetch(`${API_URL}/response/${requestId}`);

      if (response.status === 202) {
        // Toujours en attente
        console.log(`⏳ Attente... (${attempts}/${maxAttempts})`);
        return;
      }

      if (!response.ok) {
        throw new Error('Timeout ou erreur serveur');
      }

      // Réponse prête !
      const data = await response.json();
      console.log('🎉 Réponse reçue !');

      clearInterval(pollInterval);
      pollInterval = null;

      // Traiter la réponse de l'agent ADK
      handleAgentResponse(data);

    } catch (error) {
      console.error('❌ Erreur polling:', error);
      clearInterval(pollInterval);
      pollInterval = null;
      updatePopupStatus(`❌ ${error.message}`);
    }

    // Arrêter si timeout
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      pollInterval = null;
      updatePopupStatus('❌ Timeout');
    }

  }, 1000); // Poll toutes les secondes
}

// ✅ TRAITER LA RÉPONSE DE L'AGENT ADK
async function handleAgentResponse(data) {
  console.log("🤖 Réponse agent:", data);

  // Mettre à jour le contexte de session
  if (data.search_results && data.search_results.length > 0) {
    sessionContext.search_results = data.search_results;
  }

  // Exécuter l'action si présente
  if (data.action && data.action.type) {
    await executeAgentAction(data.action);
  }

  // Jouer l'audio
  if (data.audio) {
    console.log('🔊 Lecture audio...');
    playAudio(data.audio);
    const text = data.text ?? 'Réponse reçue';
    updatePopupStatus(`🤖 ${text}`);
  }
}

// ✅ EXÉCUTER LES ACTIONS DE L'AGENT
async function executeAgentAction(action) {
  console.log("🎬 Exécution action:", action);

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      console.warn("⚠️ Aucun onglet actif");
      return;
    }

    const tabId = tabs[0].id;

    switch (action.type) {
      case 'navigate':
        if (action.url) {
          // Naviguer vers l'URL
          await chrome.tabs.update(tabId, { url: action.url });
          console.log(`✅ Navigation vers: ${action.url}`);
        } else if (action.method === 'back') {
          // Retour en arrière (via content script)
          await chrome.tabs.sendMessage(tabId, {
            action: 'execute_dom_action',
            actionData: action
          });
        }
        break;

      case 'scroll':
      case 'fill_and_submit':
      case 'scan_forms':
        // Déléguer au content script
        await chrome.tabs.sendMessage(tabId, {
          action: 'execute_dom_action',
          actionData: action
        });
        console.log(`✅ Action ${action.type} envoyée au content script`);
        break;

      case 'info':
        // Action informative, rien à faire
        console.log("ℹ️ Action informative:", action.data);
        break;

      default:
        console.warn("⚠️ Type d'action inconnu:", action.type);
    }

  } catch (error) {
    console.error("❌ Erreur exécution action:", error);
  }
}

// ✅ MESSAGES
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Résultat de la reconnaissance envoyé depuis popup-tts
  if (message.action === 'content_recognition_result') {
    const transcription = message.transcript;
    if (!transcription) {
      updatePopupStatus('⚠️ Aucune parole détectée');
      return true;
    }
    updatePopupStatus(`✅ ${transcription}`);
    // Envoyer au serveur
    sendTranscriptionToServer(transcription);
    sendResponse({ ok: true });
    return true;
  }

  // Mise à jour du contexte de page
  if (message.action === 'page_loaded') {
    currentPageContext = message.data;
    console.log("📄 Page chargée:", message.data.title);
    sendResponse({ ok: true });
    return true;
  }

  // Formulaire soumis avec succès
  if (message.action === 'form_submitted') {
    console.log("✅ Formulaire soumis avec succès");
    updatePopupStatus('✅ Formulaire soumis !');
    sendResponse({ ok: true });
    return true;
  }

  // L'offscreen notifie que la lecture audio est terminée
  if (message.type === 'audio-playback-finished') {
    console.log('🔊 Audio playback terminé (notification de offscreen)');
    // Notifier le popup immédiatement
    chrome.runtime.sendMessage({
      action: 'tts_finished'
    }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  return true;
});

// ✅ JOUER L'AUDIO
function playAudio(base64Audio) {
  // Créer un offscreen document temporaire pour jouer l'audio
  chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Lecture de la réponse audio de l\'agent',
  }).then(() => {
    chrome.runtime.sendMessage({
      type: 'play-audio',
      target: 'offscreen',
      audio_data: base64Audio
    }).catch(() => { });
    // L'offscreen notifiera quand l'audio est terminé via 'audio-playback-finished'
  }).catch(() => {
    // Document déjà créé, juste envoyer le message
    chrome.runtime.sendMessage({
      type: 'play-audio',
      target: 'offscreen',
      audio_data: base64Audio
    }).catch(() => { });
    // L'offscreen notifiera quand l'audio est terminé via 'audio-playback-finished'
  });
}

// ✅ METTRE À JOUR LE POPUP
function updatePopupStatus(text) {
  chrome.runtime.sendMessage({
    action: 'update_status',
    data: text
  }).catch(() => { });
}


// Keyboard command (chrome.commands) to trigger listening via active tab
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    console.log('🔑 Command received:', command);
    if (command === 'toggle-listen') {
      // ouvrir la popup, puis demander à la popup de démarrer l'écoute hotword
      if (chrome.action && chrome.action.openPopup) {
        try {
          chrome.action.openPopup(() => {
            chrome.runtime.sendMessage({ action: 'start_hotword_from_shortcut' });
          });
        } catch (e) {
          console.warn('⚠️ openPopup failed, fallback sendMessage:', e);
          chrome.runtime.sendMessage({ action: 'start_hotword_from_shortcut' });
        }
      } else {
        // fallback si openPopup non dispo
        chrome.runtime.sendMessage({ action: 'start_hotword_from_shortcut' });
      }
    }
  });
}

console.log('🚀 Background Web Speech initialisé avec support ADK');
