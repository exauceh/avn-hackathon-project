importScripts('conf.js');

const GRAPH_STATE_KEY = 'avn_graph_state';

let currentRequestId = null;
let pollInterval = null;
let currentPageContext = {};

let graphState = {
  session_id: generateSessionId(),
  messages: [],
  user_email: 'testeur@avn.com',
  search_results: [],
  user_preferences: {},
  last_action: null,
  conversation_history: []
};

let ttsState = {
  isPlaying: false,
  canInterrupt: false,
  currentAction: null,
  mainReadingAction: null,
  isReadingActive: false,
  wasInterrupted: false
};

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function loadGraphState() {
  chrome.storage.local.get([GRAPH_STATE_KEY], (result) => {
    if (result[GRAPH_STATE_KEY]) {
      graphState = { ...graphState, ...result[GRAPH_STATE_KEY] };
      console.log("📚 État du graphe chargé:", graphState);
    }
  });
}

function saveGraphState() {
  chrome.storage.local.set({ [GRAPH_STATE_KEY]: graphState }, () => {
    console.log("💾 État du graphe sauvegardé");
  });
}

function resetGraphState() {
  graphState = {
    session_id: generateSessionId(),
    messages: [],
    user_email: graphState.user_email,
    search_results: [],
    user_preferences: {},
    last_action: null,
    conversation_history: []
  };

  ttsState = {
    isPlaying: false,
    canInterrupt: false,
    currentAction: null,
    mainReadingAction: null,
    isReadingActive: false,
    wasInterrupted: false
  };

  saveGraphState();
  console.log("🔄 État réinitialisé");
}

loadGraphState();

// Ouvrir le side panel quand on clique sur l'icône de l'extension
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.error('Erreur ouverture side panel:', e);
  }
});


async function getPageContext() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tabs || !tabs[0]) {
    return { url: '', title: '', main_sections: [], forms: [] };
  }

  const tab = tabs[0];
  const canInject = tab.url &&
    !tab.url.startsWith('chrome://') &&
    !tab.url.startsWith('about:') &&
    !tab.url.startsWith('chrome-extension://') &&
    !tab.url.startsWith('edge://');

  if (!canInject) {
    return {
      url: tab.url || '',
      title: tab.title || '',
      main_sections: [],
      forms: []
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content.js']
    });
  } catch (e) {
    console.log('Content script déjà injecté');
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'get_dom_content'
    });

    if (response && response.content) {
      return response.content;
    }
  } catch (e) {
    console.warn("Impossible de récupérer le contenu");
  }

  return {
    url: tab.url || '',
    title: tab.title || '',
    main_sections: [],
    forms: []
  };
}

async function sendTranscriptionToServer(transcription, isInterruption = false) {
  try {
    if (isInterruption && ttsState.isReadingActive) {
      console.log('🛑 Interruption pendant lecture active');
      ttsState.wasInterrupted = true;
    } else if (isInterruption && !ttsState.isReadingActive) {
      ttsState.wasInterrupted = false;
    }

    console.log('📤 Envoi transcription');

    const pageContext = await getPageContext();
    currentPageContext = pageContext;

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
        url: pageContext.url,
        title: pageContext.title
      }
    });

    const context = {
      url: pageContext.url,
      title: pageContext.title,
      content: pageContext,
      user_email: graphState.user_email,
      search_results: graphState.search_results,
      preferences: graphState.user_preferences,
      graph_state: {
        session_id: graphState.session_id,
        messages: graphState.messages,
        conversation_history: graphState.conversation_history,
        last_action: graphState.last_action,
        search_results: graphState.search_results,
        was_interrupted: ttsState.wasInterrupted
      }
    };

    const response = await fetch(`${API_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: transcription, context })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur serveur');
    }

    const data = await response.json();
    currentRequestId = data.request_id;

    saveGraphState();
    startPolling(data.request_id);

  } catch (error) {
    console.error('❌ Erreur:', error);
    updatePopupStatus(`❌ ${error.message}`);
  }
}

function startPolling(requestId) {
  console.log(`🔄 Polling pour ${requestId} vers ${API_URL}/response/${requestId}`); // ✅ AMÉLIORATION
  updatePopupStatus('⏳ En attente de la réponse...');

  let attempts = 0;
  const maxAttempts = 60; // ✅ Réduit à 60 secondes
  let consecutiveErrors = 0;

  pollInterval = setInterval(async () => {
    attempts++;

    try {
      const url = `${API_URL}/response/${requestId}`;
      console.log(`🔍 Tentative ${attempts}/${maxAttempts} - ${url}`);

      const response = await fetch(url);

      console.log(`📊 Polling status: ${response.status}`);

      if (response.status === 202) {
        consecutiveErrors = 0; // ✅ Reset
        console.log('⏳ En attente (202)...');
        return;
      }

      if (!response.ok) {
        consecutiveErrors++;

        // ✅ Arrêter après 3 erreurs consécutives
        if (consecutiveErrors >= 3) {
          throw new Error(`Erreur persistante ${response.status} (${consecutiveErrors} fois) - Vérifiez que le backend est démarré`);
        }

        console.warn(`⚠️ Erreur ${response.status} (${consecutiveErrors}/3)`);
        return;
      }

      const data = await response.json();
      console.log('🎉 Réponse reçue:', data);

      clearInterval(pollInterval);
      pollInterval = null;
      consecutiveErrors = 0;

      handleAgentResponse(data);

    } catch (error) {
      console.error('❌ Erreur polling:', error);

      // ✅ Arrêter immédiatement sur erreur réseau
      if (error.message.includes('Failed to fetch')) {
        clearInterval(pollInterval);
        pollInterval = null;
        updatePopupStatus('❌ Backend inaccessible - Vérifiez que le serveur est démarré');
        return;
      }

      clearInterval(pollInterval);
      pollInterval = null;
      updatePopupStatus(`❌ ${error.message}`);
    }

    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      pollInterval = null;
      updatePopupStatus('❌ Timeout (1 minute) - Aucune réponse du backend');
    }

  }, 1000);
}

async function handleAgentResponse(data) {
  console.log("🤖 Réponse agent:", data);

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

  if (data.search_results && data.search_results.length > 0) {
    graphState.search_results = data.search_results;
  }

  if (data.action?.type === 'info' && Array.isArray(data.action.data)) {
    graphState.search_results = data.action.data;
  }

  if (data.action?.type) {
    graphState.last_action = {
      ...data.action,
      timestamp: new Date().toISOString()
    };

    if (data.action.type === 'reading') {
      const isClarification = data.action.status === 'clarification_response';

      if (!isClarification) {
        ttsState.mainReadingAction = data.action;
        ttsState.canInterrupt = data.action.can_interrupt || false;
        ttsState.isPlaying = false;
        ttsState.isReadingActive = true;
        console.log(`📖 Lecture principale: ${data.action.status}`);
      }

      ttsState.currentAction = data.action;
    }

    await executeAgentAction(data.action);
  }

  saveGraphState();

  if (data.audio) {
    const isClarification = data.action?.status === 'clarification_response';

    if (!isClarification) {
      ttsState.isPlaying = true;
      chrome.runtime.sendMessage({
        action: 'tts_started',
        canInterrupt: ttsState.canInterrupt
      }).catch(() => { });
    }

    playAudio(data.audio, isClarification).then(() => {
      if (!isClarification) {
        ttsState.isPlaying = false;
      }
    }).catch(() => {
      if (!isClarification) {
        ttsState.isPlaying = false;
      }
    });

    updatePopupStatus(`🤖 ${data.text ?? 'Réponse reçue'}`);
  }

  if (ttsState.wasInterrupted) {
    ttsState.wasInterrupted = false;
  }
}

async function sendMessageToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    await chrome.tabs.sendMessage(tabs[0].id, message);
  }
}

async function executeAgentAction(action) {
  console.log("🎬 Exécution action:", action);

  try {
    switch (action.type) {
      case 'navigate':
        if (action.url) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            await chrome.tabs.update(tabs[0].id, { url: action.url });
          } else {
            await chrome.tabs.create({ url: action.url });
          }
        } else if (action.method === 'back') {
          await sendMessageToActiveTab({ action: 'execute_dom_action', actionData: action });
        }
        break;

      case 'scroll':
      case 'fill_and_submit':
      case 'scan_forms':
        await sendMessageToActiveTab({ action: 'execute_dom_action', actionData: action });
        break;

      case 'reading':
        ttsState.canInterrupt = action.can_interrupt || false;
        ttsState.currentAction = action;
        chrome.runtime.sendMessage({
          action: 'reading_status',
          data: {
            status: action.status,
            article_title: action.article_title,
            chunk_index: action.chunk_index,
            total_chunks: action.total_chunks,
            can_interrupt: action.can_interrupt
          }
        }).catch(() => { });
        break;

      case 'info':
        console.log("ℹ️ Action informative");
        break;

      default:
        console.warn("⚠️ Type d'action inconnu:", action.type);
    }

  } catch (error) {
    console.error("❌ Erreur exécution action:", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'clarification-audio-finished') {
    chrome.runtime.sendMessage({ action: 'clarification_prompt' }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'resume_audio') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'resume-audio' }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'clarification_followup') {
    updatePopupStatus(`⏳ ${message.transcript}`);
    sendTranscriptionToServer(message.transcript || '', true);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'interrupt_tts') {
    // Arrêter immédiatement l'audio
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'pause-audio' }).catch(() => { });

    // Mettre à jour l'état TTS
    ttsState.isPlaying = false;
    ttsState.canInterrupt = false;

    updatePopupStatus(`✅ ${message.transcript}`);
    sendTranscriptionToServer(message.transcript, true);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'audio-paused') {
    ttsState.isPlaying = false;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'audio-resumed') {
    ttsState.isPlaying = true;

    if (ttsState.mainReadingAction) {
      ttsState.canInterrupt = ttsState.mainReadingAction.can_interrupt || false;
    } else {
      ttsState.canInterrupt = false;
    }

    chrome.runtime.sendMessage({
      action: 'tts_started',
      canInterrupt: ttsState.canInterrupt
    }).catch(() => { });

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'audio-playback-finished') {
    ttsState.isPlaying = false;
    ttsState.canInterrupt = false;

    if (ttsState.currentAction?.type === 'reading') {
      const status = ttsState.currentAction.status;
      if (status === 'completed' || status === 'continuing') {
        ttsState.isReadingActive = false;
        ttsState.mainReadingAction = null;
      }
    }

    chrome.runtime.sendMessage({ action: 'tts_finished' }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'content_recognition_result') {
    if (!message.transcript) {
      updatePopupStatus('⚠️ Aucune parole détectée');
      return true;
    }
    updatePopupStatus(`✅ ${message.transcript}`);
    sendTranscriptionToServer(message.transcript, false);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'page_loaded') {
    currentPageContext = message.data;
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'form_submitted') {
    updatePopupStatus('✅ Formulaire soumis !');
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'get_graph_state') {
    sendResponse({ state: graphState });
    return true;
  }

  if (message.action === 'reset_graph_state') {
    resetGraphState();
    sendResponse({ ok: true, session_id: graphState.session_id });
    return true;
  }

  if (message.action === 'set_user_email') {
    graphState.user_email = message.email;
    saveGraphState();
    sendResponse({ ok: true });
    return true;
  }

  return true;
});

function playAudio(base64Audio, isClarification = false) {
  return new Promise((resolve, reject) => {
    const messageListener = (message) => {
      if (message.type === 'audio-playback-finished') {
        chrome.runtime.onMessage.removeListener(messageListener);
        resolve();
      } else if (message.type === 'audio-stopped') {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error('Audio interrompu'));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    const audioMessage = {
      type: 'play-audio',
      target: 'offscreen',
      audio_data: base64Audio,
      canInterrupt: ttsState.canInterrupt && !isClarification,
      isClarification
    };

    chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Lecture audio agent'
    }).then(() => {
      chrome.runtime.sendMessage(audioMessage).catch(reject);
    }).catch(() => {
      chrome.runtime.sendMessage(audioMessage).catch(reject);
    });
  });
}

function updatePopupStatus(text) {
  chrome.runtime.sendMessage({ action: 'update_status', data: text }).catch(() => { });
}

if (chrome.commands?.onCommand) {
  // 1. Acceptez le "tab" comme deuxième argument
  chrome.commands.onCommand.addListener((command, tab) => {

    if (command === 'toggle-listen' && tab?.id) {
      try {
        chrome.sidePanel.open({ tabId: tab.id })
          .then(() => {
            console.log("Side panel ouvert avec succès.");
            chrome.runtime.sendMessage({ action: 'start_hotword_from_shortcut' }).catch(() => { });
          })
          .catch((e) => {
            console.error('Erreur PENDANT l\'ouverture du side panel:', e);
          });
          
      } catch (e) {
        console.error('Erreur SYNCHRONE ouverture side panel:', e);
        chrome.runtime.sendMessage({ action: 'start_hotword_from_shortcut' }).catch(() => { });
      }
    }
  });
}

console.log('🚀 Background initialisé');
