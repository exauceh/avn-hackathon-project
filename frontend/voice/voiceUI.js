// voiceUI.js — Gestion de l'interface vocale AVN Navigator

import { startListening } from "./stt.js";
import { speak } from "./tts.js";

// Sélecteurs des éléments du popup
const speakBtn = document.getElementById("speakBtn");
const stopBtn = document.getElementById("stopBtn");
const led = document.getElementById("ledIndicator");
const stateLabel = document.getElementById("stateLabel");
const transcriptText = document.getElementById("transcriptText");
const voiceStatus = document.getElementById("voiceStatus");

// État local du micro
let isListening = false;

// ---- Fonctions visuelles ---- //
function setLED(color, label) {
  led.className = `led ${color}`;
  stateLabel.textContent = label;
}

// ---- Actions bouton "Parler" ---- //
speakBtn.addEventListener("click", () => {
  if (!isListening) {
    isListening = true;
    setLED("active", "J’écoute...");
    voiceStatus.textContent = "🎙 Micro activé.";
    speak("J'écoute.");
    startListening();
  } else {
    speak("Je suis déjà en écoute.");
  }
});

// ---- Actions bouton "Stop" ---- //
stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "voice_stop" });
  isListening = false;
  setLED("off", "Mode veille");
  voiceStatus.textContent = "🛑 Micro coupé.";
  speak("Je repasse en veille.");
});

// ---- Écoute des messages venant de stt.js ---- //
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "voice_text") {
    transcriptText.innerHTML = `<strong>${msg.text}</strong>`;
  }

  if (msg.type === "voice_state") {
    switch (msg.state) {
      case "wakeword":
        setLED("waiting", "Mot-clé détecté : Dis AVN");
        voiceStatus.textContent = "👂 En attente de commande...";
        break;

      case "active":
        setLED("active", "J’écoute...");
        voiceStatus.textContent = "🎙 En écoute active...";
        break;

      case "idle":
        setLED("off", "Mode veille");
        voiceStatus.textContent = "💤 Veille...";
        break;

      case "error":
        setLED("error", "Erreur micro");
        voiceStatus.textContent = "⚠️ Erreur de reconnaissance.";
        break;
    }
  }
});

// ---- États visuels par défaut ---- //
setLED("off", "Mode veille");
voiceStatus.textContent = "💤 Veille...";

