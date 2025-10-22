// stt.js — AVN Navigator (Team D)
// Version avec mot d'éveil, écoute continue et timeout silence

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.error("❌ STT non supporté ici (SpeechRecognition undefined). Utilise Chrome/Edge, pas Firefox.");
  chrome.runtime?.sendMessage?.({ type: "voice_state", state: "error" });
}

let recognition;
let mode = "idle"; // idle | wakeword | active
let silenceTimer;

try {
  recognition = SpeechRecognition ? new SpeechRecognition() : null;
} catch (e) {
  console.error("❌ Échec d'init SpeechRecognition :", e);
}

if (recognition) {
  recognition.lang = "fr-FR";
  recognition.continuous = true; // écoute en continu
  recognition.interimResults = false;

  recognition.onstart = () => {
    console.log("🎙️ STT démarré");
    chrome.runtime.sendMessage({ type: "voice_state", state: "wakeword" });
  };

  recognition.onend = () => {
    console.log("🛑 STT arrêté (onend)");
    // Redémarre si on est en mode veille (pour réécouter le mot clé)
    if (mode === "idle" || mode === "wakeword") {
      setTimeout(() => {
        console.log("🔁 Redémarrage en écoute passive...");
        try {
          recognition.start();
        } catch (e) {
          console.error("⚠️ Échec redémarrage :", e);
        }
      }, 1000);
    }
  };

  recognition.onerror = (e) => {
    console.error("⚠️ STT error:", e.error);
    chrome.runtime.sendMessage({ type: "voice_state", state: "error" });
  };

  recognition.onresult = (event) => {
    const phrase = event.results[0][0].transcript.toLowerCase().trim();
    console.log("🎤 Texte reconnu :", phrase);
    chrome.runtime.sendMessage({ type: "voice_text", text: phrase });

    // ---- 1️⃣ Mode veille : attendre mot-clé ---- //
    if (mode === "idle" || mode === "wakeword") {
      if (phrase.includes("dis avn") || phrase.includes("hey navigator")) {
        mode = "active";
        chrome.runtime.sendMessage({ type: "voice_state", state: "active" });
        speak("J’écoute.");
        resetSilenceTimer();
      } else {
        console.log("⏸ Pas de mot-clé détecté, reste en veille.");
      }
      return;
    }

    // ---- 2️⃣ Mode actif : exécuter la commande ---- //
    if (mode === "active") {
      // Réinitialiser le timer silence
      resetSilenceTimer();

      // Commande d'arrêt vocale
      if (phrase.includes("stop") || phrase.includes("mets-toi en veille")) {
        stopListening("idle");
        speak("Je repasse en veille.");
        return;
      }

      // Sinon transmettre la commande au background
      chrome.runtime.sendMessage({ type: "voice_command", text: phrase });
    }
  };
}

// ---- 🕒 Gestion du silence ---- //
function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    console.log("⏰ Silence prolongé → retour en veille");
    stopListening("idle");
    speak("Je repasse en veille.");
  }, 8000); // 8 secondes de silence
}

// ---- 🔈 Fonctions principales ---- //
export function startListening() {
  if (!recognition) {
    alert("La reconnaissance vocale n’est pas disponible ici. Utilise Chrome/Edge et autorise le micro.");
    return;
  }

  try {
    mode = "wakeword";
    recognition.start();
    chrome.runtime.sendMessage({ type: "voice_state", state: "wakeword" });
    console.log("🎧 En écoute passive pour le mot-clé...");
  } catch (e) {
    console.error("❌ recognition.start() a échoué :", e);
  }
}

export function stopListening(nextState = "idle") {
  try {
    recognition.stop();
    mode = nextState;
    chrome.runtime.sendMessage({ type: "voice_state", state: nextState });
    clearTimeout(silenceTimer);
  } catch (e) {
    console.error("⚠️ Erreur à l'arrêt :", e);
  }
}

// ---- 💬 Fonction TTS locale ---- //
function speak(text) {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("Impossible de vocaliser :", e);
  }
}

