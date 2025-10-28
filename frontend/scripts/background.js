const API_URL = 'http://127.0.0.1:8080';
let currentRequestId = null;
let pollInterval = null;
let currentPageContext = {}; // Contexte de la page courante

// Gestion de l'état du graphe en mémoire
const GRAPH_STATE_KEY = 'avn_graph_state';
let graphState = {
  session_id: generateSessionId(),
  messages: [],
  user_email: 'testeur@avn.com',
  search_results: [],
  user_preferences: {},
  last_action: null,
  conversation_history: []
};

// Charger l'état du graphe depuis le localStorage au démarrage
function loadGraphState() {
  chrome.storage.local.get([GRAPH_STATE_KEY], (result) => {
    if (result[GRAPH_STATE_KEY]) {
      graphState = { ...graphState, ...result[GRAPH_STATE_KEY] };
      console.log("📚 État du graphe chargé:", graphState);
    }
  });
}

// Sauvegarder l'état du graphe dans le localStorage
function saveGraphState() {
  chrome.storage.local.set({ [GRAPH_STATE_KEY]: graphState }, () => {
    console.log("💾 État du graphe sauvegardé");
  });
}

// Générer un ID de session unique
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Réinitialiser l'état du graphe (nouvelle session)
function resetGraphState() {
  graphState = {
    session_id: generateSessionId(),
    messages: [],
    user_email: graphState.user_email, // Conserver l'email
    search_results: [],
    user_preferences: {},
    last_action: null,
    conversation_history: []
  };
  saveGraphState();
  console.log("🔄 État du graphe réinitialisé");
}

// Initialiser au démarrage
loadGraphState();


// ✅ ENVOYER LA TRANSCRIPTION AU SERVEUR AVEC CONTEXTE ET ÉTAT DU GRAPHE
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

    // Ajouter le message utilisateur à l'historique du graphe
    graphState.messages.push({
      role: 'user',
      content: transcription,
      timestamp: new Date().toISOString()
    });

    graphState.conversation_history.push({
      type: 'user_message',
      content: transcription,
      timestamp: new Date().toISOString(),
      page_context: {
        url: currentPageContext.url || '',
        title: currentPageContext.title || ''
      }
    });

    // Construire le contexte complet avec l'état du graphe
    const context = {
      url: currentPageContext.url || '',
      title: currentPageContext.title || '',
      content: currentPageContext,
      user_email: graphState.user_email,
      search_results: graphState.search_results,
      preferences: graphState.user_preferences,
      // État complet du graphe pour la mémoire
      graph_state: {
        session_id: graphState.session_id,
        messages: graphState.messages,
        conversation_history: graphState.conversation_history,
        last_action: graphState.last_action,
        search_results: graphState.search_results  // ✅ Explicit
      }
    };

    console.log(`📤 Envoi contexte:`);
    console.log(`   - Session: ${context.graph_state.session_id}`);
    console.log(`   - Messages: ${context.graph_state.messages.length}`);
    console.log(`   - Search results: ${context.graph_state.search_results.length}`);

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

    // Sauvegarder l'état après l'envoi
    saveGraphState();

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

  // Mettre à jour l'état du graphe avec la réponse
  if (data.text) {
    graphState.messages.push({
      role: 'assistant',
      content: data.text,
      timestamp: new Date().toISOString()
    });

    graphState.conversation_history.push({
      type: 'agent_response',
      content: data.text,
      action: data.action || null,
      timestamp: new Date().toISOString()
    });
  }

  // Mettre à jour les résultats de recherche
  if (data.search_results && data.search_results.length > 0) {
    graphState.search_results = data.search_results;
    console.log(`🔍 ${data.search_results.length} résultats stockés dans graphState`);
  }

  // ✅ EXTRAIRE search_results depuis action.data si présents (SearchAgent)
  if (data.action && data.action.type === 'info' && data.action.data) {
    if (Array.isArray(data.action.data)) {
      graphState.search_results = data.action.data;
      console.log(`🔍 ${data.action.data.length} résultats extraits depuis action.data`);
    }
  }

  // Mettre à jour la dernière action
  if (data.action && data.action.type) {
    graphState.last_action = {
      ...data.action,
      timestamp: new Date().toISOString()
    };
    await executeAgentAction(data.action);
  }

  // Sauvegarder l'état mis à jour
  saveGraphState();

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
    switch (action.type) {
      case 'navigate':
        if (action.url) {
          // Naviguer vers l'URL - méthode plus robuste
          try {
            // Essayer d'abord avec l'onglet actif
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tabs && tabs[0]) {
              await chrome.tabs.update(tabs[0].id, { url: action.url });
              console.log(`✅ Navigation vers: ${action.url}`);
            } else {
              // Fallback: créer un nouvel onglet
              await chrome.tabs.create({ url: action.url });
              console.log(`✅ Nouvel onglet créé: ${action.url}`);
            }
          } catch (error) {
            console.error("❌ Erreur navigation:", error);
            // Dernier fallback: créer un nouvel onglet
            await chrome.tabs.create({ url: action.url });
            console.log(`✅ Nouvel onglet créé (fallback): ${action.url}`);
          }
        } else if (action.method === 'back') {
          // Retour en arrière (via content script)
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            await chrome.tabs.sendMessage(tabs[0].id, {
              action: 'execute_dom_action',
              actionData: action
            });
          }
        }
        break;

      case 'scroll':
      case 'fill_and_submit':
      case 'scan_forms':
        // Déléguer au content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'execute_dom_action',
            actionData: action
          });
          console.log(`✅ Action ${action.type} envoyée au content script`);
        } else {
          console.warn("⚠️ Aucun onglet actif pour", action.type);
        }
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

  // Récupérer l'état du graphe
  if (message.action === 'get_graph_state') {
    sendResponse({ state: graphState });
    return true;
  }

  // Réinitialiser l'état du graphe (nouvelle session)
  if (message.action === 'reset_graph_state') {
    resetGraphState();
    sendResponse({ ok: true, session_id: graphState.session_id });
    return true;
  }

  // Mettre à jour l'email utilisateur
  if (message.action === 'set_user_email') {
    graphState.user_email = message.email;
    saveGraphState();
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
