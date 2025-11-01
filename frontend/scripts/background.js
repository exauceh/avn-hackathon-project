// ✅ Importer la configuration (doit être en première ligne)
importScripts('config.js');

// Maintenant API_URL est disponible
console.log(`🚀 Service Worker démarré avec API: ${API_URL}`);

console.log(self.location.href);

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

// État de lecture TTS
let ttsState = {
  isPlaying: false,
  canInterrupt: false,
  currentAction: null,
  mainReadingAction: null,
  isReadingActive: false,
  wasInterrupted: false  // ✅ NOUVEAU : Flag d'interruption sans polluer les messages
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

  // ✅ Réinitialiser aussi l'état de lecture
  ttsState.isReadingActive = false;
  ttsState.mainReadingAction = null;
  ttsState.canInterrupt = false;
  ttsState.isPlaying = false;

  saveGraphState();
  console.log("🔄 État du graphe réinitialisé");
}

// Initialiser au démarrage
loadGraphState();


// ✅ ENVOYER LA TRANSCRIPTION AU SERVEUR AVEC CONTEXTE ET ÉTAT DU GRAPHE
async function sendTranscriptionToServer(transcription, isInterruption = false) {
  try {
    // ✅ Mettre à jour le flag d'interruption (sans ajouter de message)
    if (isInterruption && ttsState.isReadingActive) {
      console.log('🛑 Interruption pendant lecture active détectée');
      ttsState.wasInterrupted = true;
    } else if (isInterruption && !ttsState.isReadingActive) {
      console.log('⚠️ Interruption demandée mais pas de lecture active - ignoré');
      ttsState.wasInterrupted = false;
    }

    console.log(`📤 Envoi transcription au serveur...`);

    // ✅ Récupérer le contexte de la page active avec fallback
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let pageContext = {
      url: '',
      title: '',
      main_sections: [],
      forms: []
    };

    if (tabs && tabs[0]) {
      try {
        // ✅ Vérifier si l'onglet peut recevoir des messages (pas chrome://, about:, etc.)
        const tab = tabs[0];
        const canInject = tab.url &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('about:') &&
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('edge://');

        if (!canInject) {
          console.warn('⚠️ Page système détectée, utilisation du contexte minimal');
          pageContext = {
            url: tab.url || '',
            title: tab.title || '',
            main_sections: [],
            forms: []
          };
        } else {
          // ✅ Essayer d'injecter le content script s'il n'est pas déjà présent
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['scripts/content.js']
            });
            console.log('✅ Content script injecté');
          } catch (injectError) {
            // Le script est peut-être déjà injecté, continuer
            console.log('ℹ️ Content script déjà présent ou injection impossible');
          }

          // ✅ Essayer de récupérer le contenu
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'get_dom_content'
            });

            if (response && response.content) {
              pageContext = response.content;
              console.log("📄 Contexte capturé:", pageContext.title);
            }
          } catch (msgError) {
            console.warn("⚠️ Impossible de communiquer avec content script, utilisation du contexte minimal");
            pageContext = {
              url: tab.url || '',
              title: tab.title || '',
              main_sections: [],
              forms: []
            };
          }
        }

        // Sauvegarder le contexte
        currentPageContext = pageContext;

      } catch (e) {
        console.warn("⚠️ Erreur lors de la capture du contexte:", e);
        // Utiliser au moins l'URL et le titre de l'onglet
        pageContext = {
          url: tabs[0].url || '',
          title: tabs[0].title || '',
          main_sections: [],
          forms: []
        };
        currentPageContext = pageContext;
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
        url: pageContext.url || '',
        title: pageContext.title || ''
      }
    });

    // Construire le contexte complet avec l'état du graphe
    const context = {
      url: pageContext.url || '',
      title: pageContext.title || '',
      content: pageContext,
      user_email: graphState.user_email,
      search_results: graphState.search_results,
      preferences: graphState.user_preferences,
      // État complet du graphe pour la mémoire
      graph_state: {
        session_id: graphState.session_id,
        messages: graphState.messages,
        conversation_history: graphState.conversation_history,
        last_action: graphState.last_action,
        search_results: graphState.search_results,
        was_interrupted: ttsState.wasInterrupted  // ✅ Passer le flag d'interruption
      }
    };

    console.log(`📤 Envoi contexte:`);
    console.log(`   - Session: ${context.graph_state.session_id}`);
    console.log(`   - Messages: ${context.graph_state.messages.length}`);
    console.log(`   - URL: ${context.url || 'N/A'}`);
    console.log(`   - Title: ${context.title || 'N/A'}`);
    console.log(`   - Sections: ${context.content.main_sections?.length || 0}`);
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
  const maxAttempts = 300; // ✅ 300 secondes = 5 minutes (au lieu de 100 secondes)

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
        throw new Error('Erreur serveur: ' + response.status);
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
      updatePopupStatus('❌ Timeout (5 minutes écoulées)');
      console.warn(`⏱️ Timeout après ${maxAttempts} tentatives`);
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

    // ✅ Gérer les actions de lecture
    if (data.action.type === 'reading') {
      const isClarification = data.action.status === 'clarification_response';

      if (!isClarification) {
        // ✅ C'est une lecture principale (started ou continuing)
        ttsState.mainReadingAction = data.action;  // Sauvegarder l'action principale
        ttsState.canInterrupt = data.action.can_interrupt || false;
        ttsState.isPlaying = false; // Reset pour nouvelle lecture
        ttsState.isReadingActive = true; // ✅ Marquer lecture comme active
        console.log(`📖 Lecture principale: ${data.action.status}, interruption: ${ttsState.canInterrupt}`);
        console.log(`📖 isReadingActive = true`);
      } else {
        // ✅ C'est une clarification - ne pas écraser mainReadingAction
        console.log(`❓ Clarification: garder mainReadingAction intacte`);
      }

      ttsState.currentAction = data.action;
      console.log(`📖 currentAction mis à jour: ${data.action.status}`);
    }

    await executeAgentAction(data.action);
  }

  // Sauvegarder l'état mis à jour
  saveGraphState();

  // Jouer l'audio
  if (data.audio) {
    console.log('🔊 Lecture audio...');

    // ✅ Vérifier si c'est une réponse de clarification
    const isClarification = data.action && data.action.status === 'clarification_response';

    if (!isClarification) {
      ttsState.isPlaying = true;
      // Notifier popup-stt que le TTS démarre
      chrome.runtime.sendMessage({
        action: 'tts_started',
        canInterrupt: ttsState.canInterrupt
      }).catch(() => { });
    }

    playAudio(data.audio, isClarification).then(() => {
      if (!isClarification) {
        ttsState.isPlaying = false;
      }
      console.log('✅ Audio terminé');
    }).catch(() => {
      if (!isClarification) {
        ttsState.isPlaying = false;
      }
      console.log('❌ Audio interrompu ou erreur');
    });

    const text = data.text ?? 'Réponse reçue';
    updatePopupStatus(`🤖 ${text}`);
  }

  // ✅ Réinitialiser le flag d'interruption après traitement
  if (ttsState.wasInterrupted) {
    console.log('🧹 Réinitialisation du flag wasInterrupted');
    ttsState.wasInterrupted = false;
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
        // ✅ Déléguer au content script pour le scroll
        const scrollTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (scrollTabs && scrollTabs[0]) {
          await chrome.tabs.sendMessage(scrollTabs[0].id, {
            action: 'execute_dom_action',
            actionData: action
          });
          console.log(`✅ Action scroll (${action.direction}) envoyée au content script`);
        } else {
          console.warn("⚠️ Aucun onglet actif pour le scroll");
        }
        break;

      case 'fill_and_submit':
        // Déléguer au content script
        const formTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (formTabs && formTabs[0]) {
          await chrome.tabs.sendMessage(formTabs[0].id, {
            action: 'execute_dom_action',
            actionData: action
          });
          console.log(`✅ Action fill_and_submit envoyée au content script`);
        } else {
          console.warn("⚠️ Aucun onglet actif pour fill_and_submit");
        }
        break;

      case 'scan_forms':
        // Déléguer au content script
        const scanTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (scanTabs && scanTabs[0]) {
          await chrome.tabs.sendMessage(scanTabs[0].id, {
            action: 'execute_dom_action',
            actionData: action
          });
          console.log(`✅ Action scan_forms envoyée au content script`);
        } else {
          console.warn("⚠️ Aucun onglet actif pour scan_forms");
        }
        break;

      case 'reading':
        // ✅ Gérer l'action de lecture
        console.log(`📖 Lecture ${action.status}:`, action.article_title);
        ttsState.canInterrupt = action.can_interrupt || false;
        ttsState.currentAction = action;

        // Notifier le popup de l'état de lecture
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

  // ✅ Message venant d'offscreen : clarification audio finished
  if (message.type === 'clarification-audio-finished') {
    console.log('📣 Clarification audio finished reçu du offscreen');
    // Notifier le popup-stt pour démarrer l'écoute de confirmation utilisateur
    chrome.runtime.sendMessage({ action: 'clarification_prompt' }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  // ✅ Requête du front pour reprendre l'audio principal
  if (message.action === 'resume_audio') {
    console.log('📣 Reprise audio demandée par popup-stt');
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'resume-audio'
    }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  // ✅ Le front renvoie une follow-up (nouvelle question) après clarification
  if (message.action === 'clarification_followup') {
    const transcript = message.transcript || '';
    console.log('📣 Follow-up après clarification reçu:', transcript);
    // Envoyer au serveur en marquant interruption = true
    sendTranscriptionToServer(transcript, true);
    sendResponse({ ok: true });
    return true;
  }

  // ✅ Interruption du TTS détectée dans popup-stt
  if (message.action === 'interrupt_tts') {
    console.log('🛑 Interruption TTS demandée depuis popup-stt');

    // ✅ Mettre en pause l'audio (au lieu de l'arrêter)
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'pause-audio'
    }).catch(() => { });

    updatePopupStatus(`❓ ${message.transcript}`);

    // Envoyer la transcription d'interruption au serveur
    sendTranscriptionToServer(message.transcript, true);

    sendResponse({ ok: true });
    return true;
  }

  // ✅ Audio mis en pause (notification de offscreen)
  if (message.type === 'audio-paused') {
    console.log('⏸️ Audio mis en pause à', message.pausedTime, 's');
    sendResponse({ ok: true });
    return true;
  }

  // ✅ Audio repris (notification de offscreen)
  if (message.type === 'audio-resumed') {
    console.log('⏯️ Audio repris');
    ttsState.isPlaying = true;

    // ✅ CORRECTION : Restaurer canInterrupt depuis mainReadingAction (pas currentAction)
    if (ttsState.mainReadingAction) {
      ttsState.canInterrupt = ttsState.mainReadingAction.can_interrupt || false;
      console.log(`📖 Restauration canInterrupt = ${ttsState.canInterrupt} depuis mainReadingAction`);
      console.log(`📖 mainReadingAction.status = ${ttsState.mainReadingAction.status}`);
    } else {
      console.warn('⚠️ Pas de mainReadingAction sauvegardée !');
      ttsState.canInterrupt = false;
    }

    // Notifier popup-stt pour (re)démarrer l'écoute d'interruption si applicable
    chrome.runtime.sendMessage({
      action: 'tts_started',
      canInterrupt: ttsState.canInterrupt
    }).catch(() => { });

    console.log(`🔊 Notification tts_started envoyée avec canInterrupt=${ttsState.canInterrupt}`);

    sendResponse({ ok: true });
    return true;
  }

  // L'offscreen notifie que la lecture audio est terminée
  if (message.type === 'audio-playback-finished') {
    console.log('🔊 Audio playback terminé (notification de offscreen)');
    ttsState.isPlaying = false;
    ttsState.canInterrupt = false;

    // ✅ Vérifier si c'était la fin de la lecture principale
    if (ttsState.currentAction && ttsState.currentAction.type === 'reading') {
      const status = ttsState.currentAction.status;

      // ✅ Si c'est la fin de la lecture (pas une clarification)
      if (status === 'completed' || status === 'continuing') {
        ttsState.isReadingActive = false;
        ttsState.mainReadingAction = null;
        console.log('📖 Lecture terminée - isReadingActive = false');
      }
    }

    // Notifier le popup immédiatement
    chrome.runtime.sendMessage({
      action: 'tts_finished'
    }).catch(() => { });
    sendResponse({ ok: true });
    return true;
  }

  // Résultat de la reconnaissance envoyé depuis popup-tts
  if (message.action === 'content_recognition_result') {
    const transcription = message.transcript;
    if (!transcription) {
      updatePopupStatus('⚠️ Aucune parole détectée');
      return true;
    }
    updatePopupStatus(`✅ ${transcription}`);
    // Envoyer au serveur
    sendTranscriptionToServer(transcription, false); // false = pas d'interruption
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

    chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Lecture de la réponse audio de l\'agent',
    }).then(() => {
      chrome.runtime.sendMessage({
        type: 'play-audio',
        target: 'offscreen',
        audio_data: base64Audio,
        canInterrupt: ttsState.canInterrupt && !isClarification,
        isClarification: isClarification  // ✅ Ajouter ce flag
      }).catch(reject);
    }).catch(() => {
      chrome.runtime.sendMessage({
        type: 'play-audio',
        target: 'offscreen',
        audio_data: base64Audio,
        canInterrupt: ttsState.canInterrupt && !isClarification,
        isClarification: isClarification  // ✅ Ajouter ce flag
      }).catch(reject);
    });
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
